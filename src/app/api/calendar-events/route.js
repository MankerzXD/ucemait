import { NextResponse } from 'next/server';
import { rrulestr } from 'rrule';
import { analyzeTicketWithGemini } from '@/lib/geminiParser';
import { supabase } from '@/lib/supabaseClient';

const DEFAULT_CALENDAR_URL = 'https://outlook.office365.com/owa/calendar/433a34896a4545739e21cff1bd39ac26@ucema.edu.ar/2d9d26876dd440a3a4d723c6fe0b29175286550549318340919/calendar.ics';

// Simple in-memory cache to prevent hammering Outlook if refreshed frequently
let cachedData = null;
let cacheTime = 0;
const CACHE_TTL_MS = 45 * 1000; // 45 seconds

function getArgentinaDateStr(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d); // Returns YYYY-MM-DD
  } catch {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

function parseIcsDate(rawDateStr) {
  if (!rawDateStr) return null;
  // Format can be: 20260917T153000, 20260917T153000Z, or 20260917
  const cleaned = rawDateStr.replace(/[^0-9T]/g, '');
  const isDateOnly = !cleaned.includes('T');

  const year = parseInt(cleaned.slice(0, 4), 10);
  const month = parseInt(cleaned.slice(4, 6), 10);
  const day = parseInt(cleaned.slice(6, 8), 10);

  let hours = 0;
  let minutes = 0;
  if (!isDateOnly) {
    const tIdx = cleaned.indexOf('T');
    hours = parseInt(cleaned.slice(tIdx + 1, tIdx + 3), 10) || 0;
    minutes = parseInt(cleaned.slice(tIdx + 3, tIdx + 5), 10) || 0;
  }

  // Argentina is UTC-3. Outlook ICS dates with TZID=Argentina Standard Time are already in local time.
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const timeStr = isDateOnly ? 'Todo el día' : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    hours,
    minutes,
    dateStr,
    timeStr,
    isDateOnly
  };
}

function parseICS(icsText) {
  // Unfold lines (RFC 5545: lines starting with space or tab are continuations)
  const unfolded = icsText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);
  const rawEvents = [];
  let cur = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = { exdates: [] };
    } else if (line === 'END:VEVENT') {
      if (cur && cur.summary && cur.rawStart) {
        rawEvents.push(cur);
      }
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const propPart = line.slice(0, idx);
      const val = line.slice(idx + 1).replace(/\\,/g, ',').replace(/\\n/g, '\n').trim();
      const propName = propPart.split(';')[0];

      if (propName === 'SUMMARY') cur.summary = val;
      else if (propName === 'DESCRIPTION') cur.description = val;
      else if (propName === 'LOCATION') cur.location = val;
      else if (propName === 'DTSTART') cur.rawStart = val;
      else if (propName === 'DTEND') cur.rawEnd = val;
      else if (propName === 'UID') cur.uid = val;
      else if (propName === 'RRULE') cur.rrule = val;
      else if (propName === 'EXDATE') cur.exdates.push(val);
      else if (propName === 'RECURRENCE-ID') cur.recurrenceId = val;
      else if (propName === 'STATUS') cur.status = val;
    }
  }

  // Separate individual instance overrides from master recurring events
  const overridesByUid = new Map();
  const masters = [];

  for (const ev of rawEvents) {
    if (ev.recurrenceId) {
      const p = parseIcsDate(ev.recurrenceId);
      if (p) {
        const key = `${ev.uid}_${p.dateStr}`;
        overridesByUid.set(key, ev);
      }
    } else {
      masters.push(ev);
    }
  }

  // Expansion window: 60 days before current month to 120 days into future
  const now = new Date();
  const startWindow = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 2, 1));
  const endWindow = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 4, 1));

  const events = [];

  for (const ev of masters) {
    const startParsed = parseIcsDate(ev.rawStart);
    const endParsed = parseIcsDate(ev.rawEnd);
    if (!startParsed) continue;

    const baseEvt = {
      id: ev.uid || `evt_${Math.random().toString(36).slice(2, 9)}`,
      title: ev.summary,
      description: ev.description || '',
      location: ev.location || '',
      timeStr: startParsed.timeStr,
      endTimeStr: endParsed ? endParsed.timeStr : '',
      hours: startParsed.hours,
      minutes: startParsed.minutes,
      isDateOnly: startParsed.isDateOnly
    };

    if (ev.rrule) {
      try {
        const dtstartUtc = new Date(Date.UTC(
          startParsed.year,
          startParsed.month - 1,
          startParsed.day,
          startParsed.hours,
          startParsed.minutes
        ));

        let ruleStr = ev.rrule.trim();
        if (!ruleStr.startsWith('RRULE:')) ruleStr = 'RRULE:' + ruleStr;

        const rule = rrulestr(ruleStr, { dtstart: dtstartUtc });
        const dates = rule.between(startWindow, endWindow, true);

        // Parse exception dates (EXDATE)
        const exdateSet = new Set();
        for (const ex of ev.exdates) {
          const exp = parseIcsDate(ex);
          if (exp) exdateSet.add(exp.dateStr);
        }

        for (const occ of dates) {
          const occY = occ.getUTCFullYear();
          const occM = occ.getUTCMonth() + 1;
          const occD = occ.getUTCDate();
          const dateStr = `${occY}-${String(occM).padStart(2, '0')}-${String(occD).padStart(2, '0')}`;

          // Skip if explicitly excluded in EXDATE
          if (exdateSet.has(dateStr)) continue;

          // Check if there is an instance override for this date
          const overrideKey = `${ev.uid}_${dateStr}`;
          if (overridesByUid.has(overrideKey)) {
            const ov = overridesByUid.get(overrideKey);
            if (ov.status === 'CANCELLED') {
              continue;
            }
            const ovStart = parseIcsDate(ov.rawStart) || startParsed;
            const ovEnd = parseIcsDate(ov.rawEnd) || endParsed;
            events.push({
              ...baseEvt,
              id: `${baseEvt.id}_${dateStr}`,
              title: ov.summary || baseEvt.title,
              description: ov.description || baseEvt.description,
              location: ov.location || baseEvt.location,
              dateStr,
              timeStr: ovStart.timeStr,
              endTimeStr: ovEnd ? ovEnd.timeStr : baseEvt.endTimeStr,
              year: occY,
              month: occM,
              day: occD,
              hours: ovStart.hours,
              minutes: ovStart.minutes
            });
            continue;
          }

          // Standard recurrence occurrence
          events.push({
            ...baseEvt,
            id: `${baseEvt.id}_${dateStr}`,
            dateStr,
            year: occY,
            month: occM,
            day: occD
          });
        }
      } catch (err) {
        console.warn('Failed to parse recurrence rule for:', ev.summary, err.message);
        // Fallback: push base master event
        events.push({
          ...baseEvt,
          dateStr: startParsed.dateStr,
          year: startParsed.year,
          month: startParsed.month,
          day: startParsed.day
        });
      }
    } else {
      // Non-recurring single event
      events.push({
        ...baseEvt,
        dateStr: startParsed.dateStr,
        year: startParsed.year,
        month: startParsed.month,
        day: startParsed.day
      });
    }
  }

  // Sort chronologically by date and time
  events.sort((a, b) => {
    if (a.dateStr !== b.dateStr) return a.dateStr.localeCompare(b.dateStr);
    return (a.hours * 60 + a.minutes) - (b.hours * 60 + b.minutes);
  });

  return events;
}

export async function GET() {
  const currentTodayStr = getArgentinaDateStr(0);
  
  // Return cached if still valid AND matches current day
  if (cachedData && (Date.now() - cacheTime < CACHE_TTL_MS) && cachedData.todayStr === currentTodayStr) {
    return NextResponse.json(cachedData);
  }

  try {
    let icsUrl = process.env.NEXT_PUBLIC_HELPDESK_CALENDAR_URL || DEFAULT_CALENDAR_URL;
    if (icsUrl.endsWith('.html')) {
      icsUrl = icsUrl.replace(/\.html$/, '.ics');
    }

    const response = await fetch(icsUrl, {
      next: { revalidate: 60 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UCEMAIT-Dashboard/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ICS feed. Status: ${response.status}`);
    }

    const icsText = await response.text();
    const allEvents = parseICS(icsText);

    // Fetch CeNem events from Supabase if table exists
    try {
      const { data: dbCenems } = await supabase.from('cenem_events').select('*');
      if (dbCenems && dbCenems.length > 0) {
        dbCenems.forEach(c => {
          if (c.event_date) {
            const [y, m, d] = c.event_date.split('-').map(Number);
            const isCancelled = c.status === 'cancelled';
            const equipmentTags = ['CeNem', 'Sede 637'];
            if (isCancelled) equipmentTags.unshift('CANCELADO');

            allEvents.push({
              id: `cenem_${c.id}`,
              rawId: c.id,
              isCeNem: true,
              status: c.status || 'active',
              title: 'Laboratorio CeNem',
              rawTitle: 'Laboratorio CeNem',
              description: 'Uso del Laboratorio CeNem en Sede 637',
              location: 'Sede 637',
              dateStr: c.event_date,
              timeStr: c.start_time,
              endTimeStr: c.end_time || '',
              year: y,
              month: m,
              day: d,
              applicant: c.applicant || '',
              requirements: c.requirements || '',
              created_by_email: c.created_by_email || '',
              aiAnalysis: {
                equipment_tags: equipmentTags,
                has_discrepancy: false,
                event_real_time: c.start_time
              }
            });
          }
        });
      }
    } catch {}

    // Calculate Today & Tomorrow in Argentina local date
    const todayStr = getArgentinaDateStr(0);
    const tomorrowStr = getArgentinaDateStr(1);

    const todayEvents = allEvents.filter(e => e.dateStr === todayStr);
    const tomorrowEvents = allEvents.filter(e => e.dateStr === tomorrowStr);

    const [todayY, todayM] = todayStr.split('-').map(Number);
    const currentYear = todayY;
    const currentMonth = todayM;
    const monthEvents = allEvents.filter(e => e.year === currentYear && e.month === currentMonth);

    // Map of day -> events for fast lookup in month view
    const daysWithEvents = {};
    monthEvents.forEach(e => {
      if (!daysWithEvents[e.day]) {
        daysWithEvents[e.day] = [];
      }
      daysWithEvents[e.day].push(e);
    });

    // Enrich today & tomorrow events with AI / Smart ticket analysis
    const enrichedTodayEvents = await Promise.all(
      todayEvents.map(async (e) => {
        try {
          const aiAnalysis = await analyzeTicketWithGemini({
            id: e.id,
            title: e.title,
            timeStr: e.timeStr,
            description: e.description
          });
          return { ...e, aiAnalysis };
        } catch {
          return e;
        }
      })
    );

    const enrichedTomorrowEvents = await Promise.all(
      tomorrowEvents.map(async (e) => {
        try {
          const aiAnalysis = await analyzeTicketWithGemini({
            id: e.id,
            title: e.title,
            timeStr: e.timeStr,
            description: e.description
          });
          return { ...e, aiAnalysis };
        } catch {
          return e;
        }
      })
    );

    cachedData = {
      todayStr,
      tomorrowStr,
      currentYear,
      currentMonth,
      totalEvents: allEvents.length,
      todayEvents: enrichedTodayEvents,
      tomorrowEvents: enrichedTomorrowEvents,
      monthEvents,
      daysWithEvents,
      lastFetched: new Date().toISOString()
    };
    cacheTime = Date.now();

    return NextResponse.json(cachedData);
  } catch (error) {
    console.error('Error in /api/calendar-events:', error);

    // If fetch failed but we have stale cache, return stale cache
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    return NextResponse.json({
      error: error.message,
      todayEvents: [],
      tomorrowEvents: [],
      monthEvents: [],
      daysWithEvents: {}
    }, { status: 500 });
  }
}
