// Cache in-memory keyed by ticket id / content signature to avoid duplicate LLM calls
const analysisCache = new Map();

function extractWithRegex(title, timeStr, text) {
  if (!text) {
    return {
      has_discrepancy: false,
      event_real_time: null,
      setup_time: timeStr ? `${timeStr} hs` : null,
      explanation: null,
      equipment_tags: []
    };
  }

  // Regex for patterns like: a las 18hs, a las 18:00, para las 18, arranca a las 18, etc.
  const timeMatch = text.match(/(?:a\s+las?|para\s+las?|desde\s+las?|arranc[aá]\s+a\s+las?|inici[ao]\s+a\s+las?|comienz[ao]\s+a\s+las?)\s*(\d{1,2}(?:[:.]\d{2})?)\s*(?:hs?|horas?|h\b)?/i);
  let event_real_time = null;
  let has_discrepancy = false;

  if (timeMatch) {
    let t = timeMatch[1].replace('.', ':');
    if (!t.includes(':')) {
      t = `${t.padStart(2, '0')}:00`;
    } else {
      const [h, m] = t.split(':');
      t = `${h.padStart(2, '0')}:${m}`;
    }
    const fullTime = `${t} hs`;
    
    // Check if differs from calendar slot time
    if (!timeStr || !timeStr.startsWith(t)) {
      event_real_time = fullTime;
      has_discrepancy = true;
    }
  }

  // Extract key equipment keywords
  const equipment_tags = [];
  const micMatch = text.match(/(\d+)\s*(?:de\s+los\s+)?micr[oó]fonos?/i);
  if (micMatch) {
    equipment_tags.push(`🎤 ${micMatch[1]} micrófonos`);
  } else if (/micr[oó]fono/i.test(text)) {
    equipment_tags.push('🎤 Micrófono');
  }

  if (/zoom/i.test(text)) equipment_tags.push('📹 Zoom');
  if (/proyector/i.test(text)) equipment_tags.push('📽️ Proyector');
  if (/mesa/i.test(text)) equipment_tags.push('🪑 Mesas / Sillas');
  if (/vincha/i.test(text)) equipment_tags.push('🎧 Vincha');
  if (/hdmi/i.test(text)) equipment_tags.push('🔌 HDMI');
  if (/atril/i.test(text)) equipment_tags.push('🎙️ Atril');

  return {
    has_discrepancy,
    event_real_time,
    setup_time: timeStr ? `${timeStr} hs` : null,
    explanation: has_discrepancy && event_real_time ? `Evento inicia a las ${event_real_time} (armado agendado ${timeStr} hs)` : null,
    equipment_tags: equipment_tags.slice(0, 4)
  };
}

export async function analyzeTicketWithGemini({ id, title, timeStr, description }) {
  if (!description || description.trim().length < 8) {
    return {
      has_discrepancy: false,
      event_real_time: null,
      setup_time: timeStr ? `${timeStr} hs` : null,
      explanation: null,
      equipment_tags: []
    };
  }

  const cacheKey = `${id || title}_${description.slice(0, 50)}`;
  if (analysisCache.has(cacheKey)) {
    return analysisCache.get(cacheKey);
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || process.env.GOOGLE_API_KEY;

  if (apiKey && !apiKey.includes('placeholder')) {
    try {
      const prompt = `Analiza este ticket de soporte técnico universitario para una pantalla de TV de la guardia:
Título: "${title}"
Horario agendado en el calendario: "${timeStr || 'No especificado'}"
Contenido del ticket:
"""
${description}
"""

Responde ÚNICAMENTE con un JSON válido (sin markdown) con:
{
  "has_discrepancy": boolean (true si el texto menciona un horario de inicio del evento DIFERENTE al horario agendado en el calendario),
  "event_real_time": string o null (hora en que arranca el evento según el texto, ej: "18:00 hs", o null si no se menciona una hora distinta),
  "setup_time": string (hora en que el equipo debe armar, ej: "${timeStr || '15:30'} hs"),
  "explanation": string (máximo 12 palabras, ej: "Evento real a las 18:00 hs (armado a las 15:30 hs)"),
  "equipment_tags": array de strings (máximo 4 items con emoji, ej: ["🎤 4 micrófonos", "📹 Zoom grabado", "🪑 2 mesas altas"])
}`;

      const candidateModels = [
        'gemini-3.5-flash',
        'gemini-flash-latest',
        'gemini-2.5-flash',
        'gemini-1.5-flash'
      ];

      for (const model of candidateModels) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: 'application/json'
                }
              }),
              signal: AbortSignal.timeout(6000)
            }
          );

          if (res.ok) {
            const data = await res.json();
            const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawJson) {
              const parsed = JSON.parse(rawJson);
              analysisCache.set(cacheKey, parsed);
              return parsed;
            }
          }
        } catch {}
      }
    } catch (err) {
      console.warn('Gemini API call failed or timed out, using fallback:', err.message);
    }
  }

  // Fallback: Smart regex extraction
  const fallbackResult = extractWithRegex(title, timeStr, description);
  analysisCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}
