import { NextResponse } from 'next/server';

const DEFAULT_CALENDAR_URL = 'https://outlook.office365.com/owa/calendar/433a34896a4545739e21cff1bd39ac26@ucema.edu.ar/2d9d26876dd440a3a4d723c6fe0b29175286550549318340919/calendar.ics';

// Simple in-memory cache to prevent hammering Outlook if refreshed frequently
let cachedData = null;
let cacheTime = 0;
const CACHE_TTL_MS = 45 * 1000; // 45 seconds

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
  const events = [];
  let cur = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
    } else if (line === 'END:VEVENT') {
      if (cur && cur.summary && cur.rawStart) {
        const startParsed = parseIcsDate(cur.rawStart);
        const endParsed = parseIcsDate(cur.rawEnd);

        if (startParsed) {
          events.push({
            id: cur.uid || `evt_${Math.random().toString(36).slice(2, 9)}`,
            title: cur.summary,
            description: cur.description || '',
            location: cur.location || '',
            dateStr: startParsed.dateStr,
            timeStr: startParsed.timeStr,
            endTimeStr: endParsed ? endParsed.timeStr : '',
            year: startParsed.year,
            month: startParsed.month,
            day: startParsed.day,
            hours: startParsed.hours,
            minutes: startParsed.minutes,
            isDateOnly: startParsed.isDateOnly
          });
        }
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
  const now = new Date();
  
  // Return cached if still valid
  if (cachedData && (Date.now() - cacheTime < CACHE_TTL_MS)) {
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

    // Calculate Today & Tomorrow in Argentina local date
    const getLocalFormattedDate = (offsetDays = 0) => {
      const d = new Date(now.getTime() + offsetDays * 86400000);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const todayStr = getLocalFormattedDate(0);
    const tomorrowStr = getLocalFormattedDate(1);

    const todayEvents = allEvents.filter(e => e.dateStr === todayStr);
    const tomorrowEvents = allEvents.filter(e => e.dateStr === tomorrowStr);

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthEvents = allEvents.filter(e => e.year === currentYear && e.month === currentMonth);

    // Map of day -> events for fast lookup in month view
    const daysWithEvents = {};
    monthEvents.forEach(e => {
      if (!daysWithEvents[e.day]) {
        daysWithEvents[e.day] = [];
      }
      daysWithEvents[e.day].push(e);
    });

    cachedData = {
      todayStr,
      tomorrowStr,
      currentYear,
      currentMonth,
      totalEvents: allEvents.length,
      todayEvents,
      tomorrowEvents,
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
