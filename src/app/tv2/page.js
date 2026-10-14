'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Clock, ShieldAlert, Activity, Bell, X, Calendar as CalendarIcon, MapPin, 
  Ticket, AlertCircle, ChevronRight, CheckCircle2, FileText, Layers,
  Edit3, Trash2, Ban, RefreshCw, Check, User
} from 'lucide-react';
import AdaptiveWeeklyCalendar from '@/components/AdaptiveWeeklyCalendar';

// --- HELPER COMPONENT: Realtime Header Clock (isolated to avoid re-rendering entire dashboard) ---
function HeaderClock({ isLight }) {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setTimeStr(`${hours}:${minutes}:${seconds}`);

      const day = String(now.getDate()).padStart(2, '0');
      const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      setDateStr(`${day} ${month} ${year}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 sm:gap-3 text-right">
      <span className={`text-[11px] sm:text-xs font-medium ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>{dateStr}</span>
      <span className={isLight ? 'text-slate-300' : 'text-zinc-700'}>|</span>
      <span className={`text-xs sm:text-sm tracking-wider font-mono ${isLight ? 'text-slate-900 font-bold' : 'text-white font-semibold'}`}>{timeStr}</span>
    </div>
  );
}

// --- HELPER COMPONENT: AutoScrollBox for TV lists and modals ---
function AutoScrollBox({ 
  children, 
  className, 
  dependencies = [], 
  speed = 0.35, 
  pauseFrames = 120, 
  pauseDuration = null, 
  staggerMs = 0 
}) {
  const containerRef = useRef(null);
  const isHoveredRef = useRef(false);

  const depsKey = JSON.stringify(dependencies);
  const speedPxPerSec = speed < 5 ? speed * 60 : speed;
  const pauseTimeSec = pauseDuration !== null ? pauseDuration : (pauseFrames / 60);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId;
    let scrollTopVal = container.scrollTop;
    let state = 'PAUSE_TOP';
    let pauseTimer = 0;
    let lastTime = null;

    const startTimer = setTimeout(() => {
      if (!container) return;
      state = 'PAUSE_TOP';
      pauseTimer = 0;
      scrollTopVal = container.scrollTop;
      lastTime = performance.now();
      animId = requestAnimationFrame(loop);
    }, 400 + staggerMs);

    function loop(currentTime) {
      if (!container) return;

      if (lastTime === null) {
        lastTime = currentTime;
      }
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      if (isHoveredRef.current) {
        scrollTopVal = container.scrollTop;
        animId = requestAnimationFrame(loop);
        return;
      }

      const maxScroll = container.scrollHeight - container.clientHeight;

      if (maxScroll <= 4) {
        if (container.scrollTop !== 0) {
          container.scrollTop = 0;
          scrollTopVal = 0;
        }
        animId = requestAnimationFrame(loop);
        return;
      }

      if (state === 'PAUSE_TOP') {
        pauseTimer += dt;
        if (pauseTimer >= pauseTimeSec) {
          state = 'SCROLLING';
          pauseTimer = 0;
        }
      } else if (state === 'SCROLLING') {
        scrollTopVal += speedPxPerSec * dt;
        container.scrollTop = scrollTopVal;

        if (container.scrollTop >= maxScroll - 1 || scrollTopVal >= maxScroll) {
          state = 'PAUSE_BOTTOM';
          pauseTimer = 0;
        }
      } else if (state === 'PAUSE_BOTTOM') {
        pauseTimer += dt;
        if (pauseTimer >= pauseTimeSec) {
          state = 'RESETTING';
          pauseTimer = 0;
        }
      } else if (state === 'RESETTING') {
        scrollTopVal = Math.max(0, container.scrollTop - (speedPxPerSec * 4) * dt);
        container.scrollTop = scrollTopVal;

        if (scrollTopVal <= 0 || container.scrollTop <= 0) {
          scrollTopVal = 0;
          container.scrollTop = 0;
          state = 'PAUSE_TOP';
          pauseTimer = 0;
        }
      }

      animId = requestAnimationFrame(loop);
    }

    return () => {
      clearTimeout(startTimer);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [depsKey, speedPxPerSec, pauseTimeSec, staggerMs]);

  return (
    <div 
      ref={containerRef} 
      className={className}
      onMouseEnter={() => { isHoveredRef.current = true; }}
      onMouseLeave={() => { isHoveredRef.current = false; }}
      onTouchStart={() => { isHoveredRef.current = true; }}
      onTouchEnd={() => { isHoveredRef.current = false; }}
    >
      {children}
    </div>
  );
}

// --- HELPER COMPONENT: DailyEventsList using AutoScrollBox ---
function DailyEventsList({ events, isLight, staggerMs = 0 }) {
  return (
    <AutoScrollBox 
      className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-2.5 space-y-2"
      dependencies={[events]}
      speed={0.35}
      pauseFrames={120}
      staggerMs={staggerMs}
    >
      {events.map(evt => (
        <div 
          key={evt.id} 
          className={`p-3 rounded-md flex flex-col gap-1 transition shadow-sm ${
            isLight 
              ? 'bg-white border border-slate-200 hover:border-[#940028]/40 text-slate-800' 
              : 'bg-[#141418] border border-zinc-800 hover:border-zinc-700 text-white'
          }`}
        >
          <span className={`text-xs font-bold font-mono tracking-wide ${isLight ? 'text-[#940028]' : 'text-red-400'}`}>
            {evt.time_range}
          </span>
          <h4 className={`text-[13px] font-bold leading-snug ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {evt.title}
          </h4>
          {evt.description && (
            <p className={`text-xs line-clamp-2 leading-tight mt-0.5 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
              {evt.description}
            </p>
          )}
        </div>
      ))}
    </AutoScrollBox>
  );
}

const FIXED_CLASSROOMS = [
  { displayName: 'LAB MOVIL 1', dbName: 'Lab Movil 1' },
  { displayName: 'LAB MOVIL 2', dbName: 'Lab Movil 2' },
  { displayName: 'LAB MOVIL 3', dbName: 'Lab Movil 3' },
  { displayName: 'AULA 4D', dbName: '4D' },
  { displayName: 'AULA 4E', dbName: '4E' },
  { displayName: 'AULA 5E', dbName: '5E' },
];

export default function Tv2DashboardPage() {
  // Theme state ('dark' | 'light' / 'white')
  const [tvTheme, setTvTheme] = useState('dark');
  const isLight = tvTheme === 'light' || tvTheme === 'white';

  // Database lists
  const [directives, setDirectives] = useState([]);
  const [observations, setObservations] = useState([]);
  const [events, setEvents] = useState([]);

  // Outlook Calendar Data
  const [calendarData, setCalendarData] = useState({
    todayEvents: [],
    tomorrowEvents: [],
    monthEvents: [],
    daysWithEvents: {},
    todayStr: '',
    tomorrowStr: '',
    currentMonthName: 'SEPTIEMBRE',
    currentYear: 2026,
    currentMonth: 9
  });

  // Laboratorio CeNem Data & TV Edit States
  const [cenemEvents, setCenemEvents] = useState([]);
  const [editingCenemInTv, setEditingCenemInTv] = useState(false);
  const [tvEditDate, setTvEditDate] = useState('');
  const [tvEditStartTime, setTvEditStartTime] = useState('');
  const [tvEditEndTime, setTvEditEndTime] = useState('');

  // Live Day Tracker (Checks every 5 seconds; updates immediately on midnight rollover)
  const getTodayDateKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [currentDateKey, setCurrentDateKey] = useState(getTodayDateKey);

  // Combined & Merged Calendar Data (Outlook + CeNem Events)
  const displayCalendarData = useMemo(() => {
    const [currentYear, currentMonth, currentDay] = currentDateKey.split('-').map(Number);
    const todayStr = currentDateKey;
    
    const now = new Date(currentYear, currentMonth - 1, currentDay);
    const tom = new Date(now.getTime() + 86400000);
    const tomorrowStr = `${tom.getFullYear()}-${String(tom.getMonth() + 1).padStart(2, '0')}-${String(tom.getDate()).padStart(2, '0')}`;

    const formattedCenem = (cenemEvents || []).map(c => {
      const isCancelled = c.status === 'cancelled';
      const equipmentTags = ['CeNem', 'Sede 637'];
      if (isCancelled) equipmentTags.unshift('CANCELADO');

      return {
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
        applicant: 'Sede 637',
        requirements: 'Sede 637',
        created_by_email: c.created_by_email || '',
        aiAnalysis: {
          equipment_tags: equipmentTags,
          has_discrepancy: false,
          event_real_time: c.start_time
        }
      };
    });

    const cenemToday = formattedCenem.filter(c => c.dateStr === todayStr);
    const cenemTomorrow = formattedCenem.filter(c => c.dateStr === tomorrowStr);

    const sortFn = (a, b) => (a.timeStr || '').localeCompare(b.timeStr || '');
    
    const mergedToday = [
      ...(calendarData.todayEvents || []).filter(e => !e.isCeNem),
      ...cenemToday
    ].sort(sortFn);

    const mergedTomorrow = [
      ...(calendarData.tomorrowEvents || []).filter(e => !e.isCeNem),
      ...cenemTomorrow
    ].sort(sortFn);

    const mergedDaysWithEvents = { ...(calendarData.daysWithEvents || {}) };
    const mergedMonthEvents = [...(calendarData.monthEvents || []).filter(e => !e.isCeNem)];

    formattedCenem.forEach(c => {
      if (c.dateStr) {
        const [y, m, d] = c.dateStr.split('-').map(Number);
        if (y === (calendarData.currentYear || currentYear) && m === (calendarData.currentMonth || currentMonth)) {
          mergedMonthEvents.push(c);
          if (!mergedDaysWithEvents[d]) {
            mergedDaysWithEvents[d] = [];
          }
          if (!mergedDaysWithEvents[d].some(x => x.id === c.id)) {
            mergedDaysWithEvents[d] = [...mergedDaysWithEvents[d], c];
          }
        }
      }
    });

    return {
      ...calendarData,
      todayStr,
      tomorrowStr,
      todayEvents: mergedToday,
      tomorrowEvents: mergedTomorrow,
      monthEvents: mergedMonthEvents,
      daysWithEvents: mergedDaysWithEvents
    };
  }, [calendarData, cenemEvents, currentDateKey]);

  // Combined Weekly Calendar Events (Fixed events + CeNem with day_of_week)
  const combinedWeeklyEvents = useMemo(() => {
    const dayMap = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    
    const formattedCenemWeekly = (cenemEvents || []).map(c => {
      let dayName = 'Lunes';
      if (c.event_date) {
        const [y, m, d] = c.event_date.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        dayName = dayMap[dateObj.getDay()] || 'Lunes';
      }

      return {
        id: `cenem_${c.id}`,
        rawId: c.id,
        isCeNem: true,
        status: c.status || 'active',
        day_of_week: dayName,
        title: '[CeNem] Sede 637',
        rawTitle: 'Laboratorio CeNem',
        location: 'Sede 637',
        time_range: `${c.start_time} - ${c.end_time || ''}`,
        description: 'Uso del Laboratorio CeNem en Sede 637',
        applicant: 'Sede 637',
        requirements: 'Sede 637',
        event_date: c.event_date,
        start_time: c.start_time,
        end_time: c.end_time
      };
    });

    return [...(events || []), ...formattedCenemWeekly];
  }, [events, cenemEvents]);

  // Mobile Single Day view state (defaults to today's day of week, e.g. 'Jueves')
  const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
  const todayDayIdx = new Date().getDay();
  const currentDayName = (todayDayIdx >= 1 && todayDayIdx <= 5) ? DAY_NAMES[todayDayIdx] : 'Lunes';
  const [selectedMobileDay, setSelectedMobileDay] = useState(currentDayName);

  // Interactive Ticket Detail Modal state (for Mobile and Desktop)
  const [selectedTicketModal, setSelectedTicketModal] = useState(null);

  // Alert Modal states for upcoming tasks (<15 min)
  const [upcomingAlertTasks, setUpcomingAlertTasks] = useState([]);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertCountdown, setAlertCountdown] = useState(50);
  const alertedDirectivesRef = useRef(new Set());

  // --- DESKTOP & 4-DAY MODE STATES ---
  const [isDesktop, setIsDesktop] = useState(true);
  const [isFourDayMode, setIsFourDayMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('tv2_is_four_day_mode');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const handleToggleFourDayMode = () => {
    setIsFourDayMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('tv2_is_four_day_mode', String(next));
      } catch {}
      return next;
    });
  };

  const mainContainerRef = useRef(null);

  useEffect(() => {
    const handleWindowResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    handleWindowResize();
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // Play notification chime on TV
  const playAlertChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  };

  // Fetch Outlook Calendar Data from API
  const fetchOutlookCalendar = async () => {
    try {
      const res = await fetch('/api/calendar-events');
      if (!res.ok) return;
      const data = await res.json();

      const monthNames = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
      ];
      const monthIndex = (data.currentMonth || new Date().getMonth() + 1) - 1;

      setCalendarData({
        todayEvents: data.todayEvents || [],
        tomorrowEvents: data.tomorrowEvents || [],
        monthEvents: data.monthEvents || [],
        daysWithEvents: data.daysWithEvents || {},
        todayStr: data.todayStr || '',
        tomorrowStr: data.tomorrowStr || '',
        currentMonthName: monthNames[monthIndex] || 'SEPTIEMBRE',
        currentYear: data.currentYear || new Date().getFullYear(),
        currentMonth: data.currentMonth || (new Date().getMonth() + 1)
      });
    } catch (err) {
      console.error('Error fetching Outlook calendar in /tv2:', err);
    }
  };

  // Fetch calendar on mount + poll every 60 seconds
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (isMounted) await fetchOutlookCalendar();
    };
    load();
    const interval = setInterval(fetchOutlookCalendar, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Midnight day change detector: automatically switches day and triggers fresh fetches
  useEffect(() => {
    const checkMidnight = () => {
      const nowKey = getTodayDateKey();
      if (nowKey !== currentDateKey) {
        console.log('🔄 Cambio de día detectado en TV2:', currentDateKey, '->', nowKey);
        setCurrentDateKey(nowKey);
        fetchOutlookCalendar();
        fetchInitialData();
      }
    };

    const interval = setInterval(checkMidnight, 5000);
    return () => clearInterval(interval);
  }, [currentDateKey]);

  // 24/7 Digital Signage Health: Scheduled soft reload at 03:30 AM to prevent browser memory leaks
  useEffect(() => {
    const checkScheduledReload = () => {
      const now = new Date();
      if (now.getHours() === 3 && now.getMinutes() === 30 && now.getSeconds() < 10) {
        window.location.reload();
      }
    };
    const reloadTimer = setInterval(checkScheduledReload, 8000);
    return () => clearInterval(reloadTimer);
  }, []);

  // Check for upcoming directives & calendar events (< 15 min away)
  useEffect(() => {
    const checkUpcoming = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentDay = String(now.getDate()).padStart(2, '0');
      const todayStr = `${currentYear}-${currentMonth}-${currentDay}`;
      const nowTotalMin = now.getHours() * 60 + now.getMinutes();

      const dayMap = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
      const todayDayName = dayMap[now.getDay()];
      const normalizeDay = (d) => (d || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const due = [];

      // 1. Directives check
      if (directives && directives.length > 0) {
        directives.forEach(dir => {
          if (!dir.directive_date || dir.directive_date !== todayStr) return;
          if (!dir.directive_time) return;

          const parts = dir.directive_time.split(':');
          if (parts.length < 2) return;
          const targetH = parseInt(parts[0], 10);
          const targetM = parseInt(parts[1], 10);
          if (isNaN(targetH) || isNaN(targetM)) return;

          const targetTotalMin = targetH * 60 + targetM;
          const diffMin = targetTotalMin - nowTotalMin;

          if (diffMin >= -10 && diffMin <= 15) {
            const key = `dir_${dir.id}_${dir.directive_date}_${dir.directive_time}`;
            if (!alertedDirectivesRef.current.has(key)) {
              due.push({
                id: `dir_${dir.id}`,
                dedupKey: key,
                sourceType: 'directiva',
                badge: 'DIRECTIVA',
                title: `AULA ${dir.classroom}`,
                time: dir.directive_time,
                text: dir.requirements,
                subtitle: `Aula ${dir.classroom} • Fecha: ${dir.directive_date}`,
                creator: dir.created_by_email,
                diffMinutes: diffMin
              });
            }
          }
        });
      }

      // 2. Weekly Fixed Events check
      if (events && events.length > 0) {
        events.forEach(evt => {
          if (!evt.day_of_week) return;
          if (normalizeDay(evt.day_of_week) !== todayDayName) return;

          const timeMatch = (evt.time_range || '').match(/(\d{1,2}):(\d{2})/);
          if (!timeMatch) return;

          const targetH = parseInt(timeMatch[1], 10);
          const targetM = parseInt(timeMatch[2], 10);
          if (isNaN(targetH) || isNaN(targetM)) return;

          const targetTotalMin = targetH * 60 + targetM;
          const diffMin = targetTotalMin - nowTotalMin;

          if (diffMin >= -10 && diffMin <= 15) {
            const timeStr = `${String(targetH).padStart(2, '0')}:${String(targetM).padStart(2, '0')}`;
            const key = `evt_${evt.id}_${todayStr}_${timeStr}`;
            if (!alertedDirectivesRef.current.has(key)) {
              due.push({
                id: `evt_${evt.id}`,
                dedupKey: key,
                sourceType: 'evento',
                badge: 'AGENDA SEMANAL',
                title: (evt.title || 'Evento').toUpperCase(),
                time: timeStr,
                text: evt.description || evt.title,
                subtitle: `${evt.day_of_week} • Agenda Semanal (${evt.time_range})`,
                creator: evt.created_by_email,
                diffMinutes: diffMin
              });
            }
          }
        });
      }

      // 3. Outlook Helpdesk & CeNem Events check for Today
      if (displayCalendarData.todayEvents && displayCalendarData.todayEvents.length > 0) {
        displayCalendarData.todayEvents.forEach(oEvt => {
          if (oEvt.isDateOnly || !oEvt.timeStr) return;
          if (oEvt.status === 'cancelled') return;

          const parts = oEvt.timeStr.split(':');
          if (parts.length < 2) return;
          const targetH = parseInt(parts[0], 10);
          const targetM = parseInt(parts[1], 10);
          if (isNaN(targetH) || isNaN(targetM)) return;

          const targetTotalMin = targetH * 60 + targetM;
          const diffMin = targetTotalMin - nowTotalMin;

          if (diffMin >= -10 && diffMin <= 15) {
            const key = `evt_${oEvt.id}_${todayStr}_${oEvt.timeStr}`;
            if (!alertedDirectivesRef.current.has(key)) {
              due.push({
                id: `evt_${oEvt.id}`,
                dedupKey: key,
                sourceType: oEvt.isCeNem ? 'cenem' : 'outlook',
                badge: oEvt.isCeNem ? 'LAB CeNem' : 'HELPDESK OUTLOOK',
                title: oEvt.title.toUpperCase(),
                time: oEvt.timeStr,
                text: oEvt.description || oEvt.title,
                subtitle: `${oEvt.location || 'UCEMA'} • ${oEvt.timeStr} hs`,
                creator: oEvt.location || 'Helpdesk',
                diffMinutes: diffMin
              });
            }
          }
        });
      }

      if (due.length > 0) {
        due.forEach(d => {
          alertedDirectivesRef.current.add(d.dedupKey);
        });
        setUpcomingAlertTasks(due);
        setShowAlertModal(true);
        setAlertCountdown(50);
        playAlertChime();
      }
    };

    checkUpcoming();
    const interval = setInterval(checkUpcoming, 10000);
    return () => clearInterval(interval);
  }, [directives, events, displayCalendarData.todayEvents]);

  // 50-second auto-close countdown for TV
  useEffect(() => {
    if (!showAlertModal) return;

    const interval = setInterval(() => {
      setAlertCountdown(prev => {
        if (prev <= 1) {
          setShowAlertModal(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showAlertModal]);

  const loadDemoCenemTv = () => {
    const localCenem = localStorage.getItem('demo_cenem_events');
    if (localCenem) {
      try {
        setCenemEvents(JSON.parse(localCenem));
        return;
      } catch {}
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    const tom = new Date(now.getTime() + 86400000);
    const tomY = tom.getFullYear();
    const tomM = String(tom.getMonth() + 1).padStart(2, '0');
    const tomD = String(tom.getDate()).padStart(2, '0');
    const tomorrowStr = `${tomY}-${tomM}-${tomD}`;

    const defaultCenem = [
      {
        id: 'cenem_1',
        title: 'Laboratorio CeNem',
        event_date: todayStr,
        start_time: '16:00',
        end_time: '21:00',
        requirements: 'Sede 637',
        applicant: 'Sede 637',
        status: 'active',
        created_by_email: 'sanchezmanuel397@gmail.com',
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem('demo_cenem_events', JSON.stringify(defaultCenem));
    setCenemEvents(defaultCenem);
  };

  const fetchCenemEvents = async () => {
    try {
      const { data, error } = await supabase.from('cenem_events').select('*').order('event_date', { ascending: true });
      if (!error && data) {
        setCenemEvents(data);
      } else {
        loadDemoCenemTv();
      }
    } catch {
      loadDemoCenemTv();
    }
  };

  const broadcastCenemUpdateFromTv = (updated) => {
    try {
      localStorage.setItem('demo_cenem_events', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('cenem_updated', { detail: updated }));
    } catch {}
  };

  const handleOpenEditCenemTv = (evt) => {
    setEditingCenemInTv(true);
    setTvEditDate(evt.dateStr || evt.event_date || '');
    setTvEditStartTime(evt.timeStr || evt.start_time || '');
    setTvEditEndTime(evt.endTimeStr || evt.end_time || '');
    setTvEditTitle('Laboratorio CeNem');
    setTvEditRequirements('Sede 637');
    setTvEditApplicant('Sede 637');
  };

  const handleSaveEditCenemTv = async (e) => {
    e.preventDefault();
    if (!selectedTicketModal || !tvEditDate || !tvEditStartTime || !tvEditEndTime) return;

    const rawId = selectedTicketModal.rawId || selectedTicketModal.id.replace('cenem_', '');
    const updatedData = {
      title: 'Laboratorio CeNem',
      event_date: tvEditDate,
      start_time: tvEditStartTime,
      end_time: tvEditEndTime,
      requirements: 'Sede 637',
      applicant: 'Sede 637',
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('cenem_events')
        .update(updatedData)
        .eq('id', rawId);
      if (error) throw error;
      fetchCenemEvents();
    } catch {
      const updated = cenemEvents.map(c => (c.id === rawId || `cenem_${c.id}` === selectedTicketModal.id) ? { ...c, ...updatedData } : c);
      setCenemEvents(updated);
      broadcastCenemUpdateFromTv(updated);
    }

    setEditingCenemInTv(false);
    setSelectedTicketModal(prev => prev ? {
      ...prev,
      title: 'Laboratorio CeNem',
      rawTitle: 'Laboratorio CeNem',
      timeStr: tvEditStartTime,
      endTimeStr: tvEditEndTime,
      dateStr: tvEditDate,
      location: 'Sede 637',
      description: 'Uso del Laboratorio CeNem en Sede 637',
      requirements: 'Sede 637',
      applicant: 'Sede 637'
    } : null);
  };

  const handleToggleCancelCenemTv = async (evt) => {
    if (!evt) return;
    const rawId = evt.rawId || evt.id.replace('cenem_', '');
    const newStatus = evt.status === 'cancelled' ? 'active' : 'cancelled';

    try {
      const { error } = await supabase
        .from('cenem_events')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', rawId);
      if (error) throw error;
      fetchCenemEvents();
    } catch {
      const updated = cenemEvents.map(c => (c.id === rawId || `cenem_${c.id}` === evt.id) ? { ...c, status: newStatus } : c);
      setCenemEvents(updated);
      broadcastCenemUpdateFromTv(updated);
    }

    setSelectedTicketModal(prev => prev ? { ...prev, status: newStatus } : null);
  };

  const handleDeleteCenemTv = async (id) => {
    if (!window.confirm('¿Deseas eliminar definitivamente esta reserva de Laboratorio CeNem?')) return;
    const rawId = id.replace('cenem_', '');

    try {
      const { error } = await supabase
        .from('cenem_events')
        .delete()
        .eq('id', rawId);
      if (error) throw error;
      fetchCenemEvents();
    } catch {
      const updated = cenemEvents.filter(c => c.id !== rawId && `cenem_${c.id}` !== id);
      setCenemEvents(updated);
      broadcastCenemUpdateFromTv(updated);
    }

    setSelectedTicketModal(null);
    setEditingCenemInTv(false);
  };

  const loadDemoData = () => {
    const localTheme = localStorage.getItem('demo_tv_theme');
    if (localTheme) setTvTheme(localTheme);
    setDirectives(JSON.parse(localStorage.getItem('demo_directives') || '[]'));
    setObservations(JSON.parse(localStorage.getItem('demo_observations') || '[]'));
    setEvents(JSON.parse(localStorage.getItem('demo_events') || '[]'));
    loadDemoCenemTv();
  };

  const fetchInitialData = async () => {
    try {
      const { data: themeData } = await supabase.from('tv_settings').select('value').eq('key', 'tv_theme').single();
      if (themeData?.value) {
        setTvTheme(themeData.value);
      } else {
        const localTheme = localStorage.getItem('demo_tv_theme');
        if (localTheme) setTvTheme(localTheme);
      }

      const { data: dirs } = await supabase.from('directives').select('*').order('created_at', { ascending: false });
      if (dirs) setDirectives(dirs);

      const { data: obs } = await supabase.from('observations').select('*').order('created_at', { ascending: false });
      if (obs) setObservations(obs);

      const { data: evts } = await supabase.from('fixed_events').select('*').order('created_at', { ascending: false });
      if (evts) setEvents(evts);

      await fetchCenemEvents();
    } catch (err) {
      console.error('Error fetching TV data:', err);
      loadDemoData();
    }
  };

  // Supabase Real-time subscriptions
  useEffect(() => {
    let channel;

    async function initDashboard() {
      await fetchInitialData();
      
      channel = supabase
        .channel('dashboard-tv2-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tv_settings' }, (payload) => {
          if (payload.new && payload.new.key === 'tv_theme') {
            setTvTheme(payload.new.value);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'directives' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setDirectives(prev => [payload.new, ...prev.filter(d => d.id !== payload.new.id)]);
          } else if (payload.eventType === 'DELETE') {
            setDirectives(prev => prev.filter(d => d.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setDirectives(prev => prev.map(d => d.id === payload.new.id ? payload.new : d));
          }
          fetchInitialData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'observations' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setObservations(prev => [payload.new, ...prev.filter(o => o.id !== payload.new.id)]);
          } else if (payload.eventType === 'DELETE') {
            setObservations(prev => prev.filter(o => o.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setObservations(prev => prev.map(o => o.id === payload.new.id ? payload.new : o));
          }
          fetchInitialData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fixed_events' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setEvents(prev => [payload.new, ...prev.filter(e => e.id !== payload.new.id)]);
          } else if (payload.eventType === 'DELETE') {
            setEvents(prev => prev.filter(e => e.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setEvents(prev => prev.map(e => e.id === payload.new.id ? payload.new : e));
          }
          fetchInitialData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cenem_events' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setCenemEvents(prev => [payload.new, ...prev.filter(c => c.id !== payload.new.id)]);
          } else if (payload.eventType === 'DELETE') {
            setCenemEvents(prev => prev.filter(c => c.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setCenemEvents(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
          }
          fetchCenemEvents();
        })
        .subscribe();
    }

    const handleStorageChange = (e) => {
      if (e.key === 'demo_cenem_events' && e.newValue) {
        try {
          setCenemEvents(JSON.parse(e.newValue));
        } catch {}
      }
    };
    const handleCustomCenem = (e) => {
      if (e.detail) {
        setCenemEvents(e.detail);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('cenem_updated', handleCustomCenem);

    initDashboard();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('cenem_updated', handleCustomCenem);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Listen to storage changes for cross-tab sync in Demo Mode
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'demo_tv_theme' && e.newValue) {
        setTvTheme(e.newValue);
      }
      if (e.key === 'demo_directives' || e.key === 'demo_observations' || e.key === 'demo_events') {
        loadDemoData();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Group directives dynamically by date using currentDateKey
  const todayStr = currentDateKey;
  const tomorrowStr = useMemo(() => {
    const [y, m, d] = currentDateKey.split('-').map(Number);
    const tom = new Date(y, m - 1, d + 1);
    const tomY = tom.getFullYear();
    const tomM = String(tom.getMonth() + 1).padStart(2, '0');
    const tomD = String(tom.getDate()).padStart(2, '0');
    return `${tomY}-${tomM}-${tomD}`;
  }, [currentDateKey]);

  const directivesHoy = useMemo(() => {
    return directives.filter(d => d.directive_date === todayStr);
  }, [directives, todayStr]);

  const directivesManana = useMemo(() => {
    return directives.filter(d => d.directive_date === tomorrowStr);
  }, [directives, tomorrowStr]);

  const getActiveDirectivesForDay = (directivesList) => {
    if (!directivesList || directivesList.length === 0) return [];
    const seen = new Set();
    const result = [];
    for (const dir of directivesList) {
      if (!dir.requirements || !dir.requirements.trim()) continue;
      const key = dir.classroom.toLowerCase().replace(/\s+/g, '');
      if (!seen.has(key)) {
        seen.add(key);
        const fixed = FIXED_CLASSROOMS.find(fc => fc.dbName.toLowerCase().replace(/\s+/g, '') === key);
        result.push({
          displayName: fixed ? fixed.displayName : dir.classroom.toUpperCase(),
          requirements: dir.requirements,
          time: dir.directive_time,
          id: dir.id
        });
      }
    }
    return result;
  };

  const activeDirectivesHoy = getActiveDirectivesForDay(directivesHoy);
  const activeDirectivesManana = getActiveDirectivesForDay(directivesManana);

  const getEventsForDay = (dayName) => {
    return events.filter(e => e.day_of_week.toLowerCase() === dayName.toLowerCase());
  };

  // Generate Month Grid Matrix (Monday to Sunday)
  const monthGrid = useMemo(() => {
    const year = displayCalendarData.currentYear;
    const month = displayCalendarData.currentMonth;
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const totalDays = lastDay.getDate();

    const startDayOfWeek = (firstDay.getDay() + 6) % 7;

    const cells = [];
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      cells.push({
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: false,
        events: []
      });
    }

    const currentDayNumber = Number(currentDateKey.split('-')[2]);
    for (let d = 1; d <= totalDays; d++) {
      const isToday = d === currentDayNumber;
      const dayEvents = displayCalendarData.daysWithEvents[d] || [];
      cells.push({
        day: d,
        isCurrentMonth: true,
        isToday,
        events: dayEvents
      });
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        day: i,
        isCurrentMonth: false,
        isToday: false,
        events: []
      });
    }

    return cells;
  }, [displayCalendarData.currentYear, displayCalendarData.currentMonth, displayCalendarData.daysWithEvents, currentDateKey]);

  // Formatted date string for HOY & MAÑANA headers (reacts live to midnight day change)
  const todayHeaderDate = useMemo(() => {
    const [y, m, d] = currentDateKey.split('-').map(Number);
    const day = String(d).padStart(2, '0');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${day} ${months[m - 1]}`;
  }, [currentDateKey]);

  const tomorrowHeaderDate = useMemo(() => {
    const [y, m, d] = currentDateKey.split('-').map(Number);
    const tom = new Date(y, m - 1, d + 1);
    const day = String(tom.getDate()).padStart(2, '0');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${day} ${months[tom.getMonth()]}`;
  }, [currentDateKey]);

  // Card component renderer for Outlook events (reused in desktop and mobile)
  const renderEventCard = (evt) => {
    const isAllDay = (evt.timeStr && evt.timeStr.toLowerCase().includes('todo el d')) || 
                     (evt.endTimeStr && evt.endTimeStr.toLowerCase().includes('todo el d'));

    const timeLabel = isAllDay 
      ? 'Todo el día' 
      : evt.endTimeStr && evt.endTimeStr !== evt.timeStr 
        ? `${evt.timeStr} - ${evt.endTimeStr} hs` 
        : `${evt.timeStr} hs`;

    const isCancelled = evt.status === 'cancelled';

    return (
      <div 
        key={evt.id}
        onClick={() => setSelectedTicketModal(evt)}
        className={`p-3 rounded-xl border flex flex-col gap-2 transition-all duration-200 shadow-xs cursor-pointer active:scale-[0.99] group ${
          isCancelled
            ? isLight
              ? 'bg-slate-50 border-red-200 opacity-75 hover:opacity-100'
              : 'bg-[#151113] border-red-950/70 opacity-75 hover:opacity-100'
            : isLight 
              ? 'bg-white border-slate-200 hover:border-[#940028]/60 text-slate-800 hover:shadow-md' 
              : 'bg-[#141418] border-zinc-800 hover:border-zinc-700 text-white hover:bg-[#18181e]'
        }`}
      >
        {/* Time Badges & Location */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isCancelled ? (
              <>
                <span className="text-[10px] font-extrabold font-mono px-2 py-0.5 rounded flex items-center gap-1 bg-red-700 text-white shadow-xs line-through">
                  <Clock size={11} /> {timeLabel}
                </span>
                <span className="text-[9.5px] font-bold font-mono px-2 py-0.5 rounded bg-red-950 border border-red-800 text-red-300">
                  ❌ CANCELADO
                </span>
              </>
            ) : evt.aiAnalysis?.has_discrepancy && evt.aiAnalysis?.event_real_time ? (
              <>
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                  isLight ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  EVENTO: {evt.aiAnalysis.event_real_time}
                </span>
                <span className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
                  isLight ? 'bg-slate-100 text-slate-600' : 'bg-zinc-850 text-zinc-400'
                }`}>
                  <Clock size={10} /> Armado: {evt.timeStr} hs
                </span>
              </>
            ) : isAllDay ? (
              <span className={`text-[10.5px] font-bold font-mono px-2 py-0.5 rounded flex items-center gap-1.5 ${
                isLight 
                  ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                  : 'bg-blue-950/60 text-blue-300 border border-blue-900/60'
              }`}>
                <Clock size={11} className="text-blue-400" /> Todo el día
              </span>
            ) : (
              <span className="text-[11px] font-extrabold font-mono px-2.5 py-0.5 rounded flex items-center gap-1 bg-[#940028] text-white shadow-xs">
                <Clock size={11} /> {timeLabel}
              </span>
            )}
          </div>

          {evt.isCeNem ? (
            <span className={`text-[9.5px] font-mono flex items-center gap-1 px-2 py-0.5 rounded font-bold border ${
              isLight ? 'bg-red-50 text-[#940028] border-red-200' : 'bg-[#940028]/20 text-[#f1a3b3] border-[#940028]/50'
            }`}>
              <Layers size={10} className="text-[#940028] flex-shrink-0" />
              <span>CeNem</span>
            </span>
          ) : evt.location ? (
            <span className={`text-[9.5px] font-mono truncate max-w-[140px] flex items-center gap-1 px-1.5 py-0.5 rounded ${
              isLight ? 'bg-slate-100 text-slate-600' : 'bg-zinc-850 text-zinc-300 border border-zinc-750'
            }`}>
              <MapPin size={10} className="text-[#940028] flex-shrink-0" />
              <span className="truncate">{evt.location}</span>
            </span>
          ) : null}
        </div>

        {/* Discrepancy Note if present */}
        {evt.aiAnalysis?.has_discrepancy && (
          <div className={`text-[10px] font-mono font-medium px-2 py-1 rounded flex items-center gap-1.5 ${
            isLight ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-amber-950/40 text-amber-300 border border-amber-900/60'
          }`}>
            <AlertCircle size={12} className="flex-shrink-0 text-amber-500" />
            <span className="leading-tight">{evt.aiAnalysis.explanation || `En texto: ${evt.aiAnalysis.event_real_time}`}</span>
          </div>
        )}

        {/* Title */}
        <h4 className={`text-xs sm:text-[13px] font-bold leading-snug group-hover:text-[#e03158] transition-colors ${
          isCancelled
            ? 'line-through text-zinc-500'
            : isLight ? 'text-slate-900' : 'text-zinc-100'
        }`}>
          {evt.title}
        </h4>

        {/* Equipment tags */}
        {evt.aiAnalysis?.equipment_tags && evt.aiAnalysis.equipment_tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {evt.aiAnalysis.equipment_tags.map((tag, tagIdx) => (
              <span 
                key={tagIdx}
                className={`text-[9.5px] font-mono font-semibold px-2 py-0.5 rounded border ${
                  isLight ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-zinc-850 text-zinc-300 border-zinc-750'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Description Snippet */}
        {evt.description && (
          <p className={`text-[11px] line-clamp-2 leading-relaxed ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
            {evt.description}
          </p>
        )}

        {/* Action link */}
        <div className={`pt-1.5 border-t flex items-center justify-between text-[10px] font-mono ${
          isLight ? 'border-slate-100 text-slate-500' : 'border-zinc-800/80 text-zinc-400'
        }`}>
          <span className="text-[#e03158] group-hover:text-red-300 font-bold flex items-center gap-1 transition-colors">
            Ver requerimientos <ChevronRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
          <span className="text-[9px] opacity-60">Tocar para abrir</span>
        </div>
      </div>
    );
  };

  // =========================================================================
  // RENDER BLOCKS FOR DASHBOARD WORKSPACE
  // =========================================================================
  
  // BLOCK 2: DIRECTIVAS & OBSERVACIONES (occupies 30% width)
  const renderBlockDirectivas = (extraClass = '') => (
    <section 
      className={`w-full h-full min-w-0 min-h-0 overflow-hidden border rounded-lg p-3.5 sm:p-4 flex flex-col gap-3 transition-colors duration-300 ${extraClass} ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0e0e11] border-[#19191D]'
      }`}
    >
      {/* TOP HALF: DIRECTIVAS */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className={`flex justify-between items-center border-b pb-2 mb-2 flex-shrink-0 ${isLight ? 'border-slate-200' : 'border-[#19191D]'}`}>
          <div className="flex items-center gap-2">
            <ShieldAlert size={15} className={isLight ? 'text-[#940028]' : 'text-red-400'} />
            <h2 className={`text-xs font-bold tracking-widest uppercase ${isLight ? 'text-[#940028]' : 'text-white'}`}>
              DIRECTIVAS
            </h2>
          </div>
          <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}>
            HOY + MAÑANA
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 flex-grow min-h-0 overflow-hidden">
          {/* HOY Column */}
          <div className="flex flex-col gap-1.5 h-full min-h-0">
            <div className={`px-2.5 py-1 rounded flex items-center gap-1.5 flex-shrink-0 border ${
              isLight ? 'bg-[#940028]/10 border-[#940028]/30' : 'bg-[#141418] border-[#940028]/50'
            }`}>
              <span className="w-2 h-2 rounded-full bg-[#940028]"></span>
              <span className={`text-[10px] font-bold tracking-wide ${isLight ? 'text-[#940028]' : 'text-[#f1a3b3]'}`}>HOY</span>
            </div>
            
            <AutoScrollBox 
              className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-1.5 pr-0.5 max-h-[260px] md:max-h-none"
              dependencies={[activeDirectivesHoy]}
              speed={0.35}
              pauseFrames={140}
            >
              {activeDirectivesHoy.length === 0 ? (
                <div className={`h-full min-h-[60px] flex flex-col items-center justify-center text-center p-3 rounded border border-dashed ${
                  isLight ? 'border-slate-200 bg-slate-50/50 text-slate-400' : 'border-zinc-850 bg-zinc-950/30 text-zinc-600'
                }`}>
                  <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Sin directivas hoy</span>
                </div>
              ) : (
                activeDirectivesHoy.map(item => (
                  <div 
                    key={item.id} 
                    className={`border p-2 rounded flex flex-col gap-1 transition shadow-xs ${
                      isLight 
                        ? 'bg-slate-50 border-slate-200 hover:border-[#940028]/40' 
                        : 'bg-[#141418] border-zinc-850'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`font-bold uppercase tracking-wider text-[10px] font-mono ${
                        isLight ? 'text-[#940028]' : 'text-[#f1a3b3]'
                      }`}>{item.displayName}</span>
                      {item.time && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
                          isLight 
                            ? 'bg-[#940028] text-white border border-[#7d0022]' 
                            : 'bg-[#4d0015] border border-[#7d0022] text-[#f8ccd5]'
                        }`}>
                          <Clock size={9} /> {item.time} hs
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] font-medium leading-snug ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                      {item.requirements}
                    </p>
                  </div>
                ))
              )}
            </AutoScrollBox>
          </div>

          {/* MAÑANA Column */}
          <div className="flex flex-col gap-1.5 h-full min-h-0">
            <div className={`px-2.5 py-1 rounded flex items-center gap-1.5 flex-shrink-0 border ${
              isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#141418] border-[#19191D]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-slate-400' : 'bg-zinc-500'}`}></span>
              <span className={`text-[10px] font-bold tracking-wide ${isLight ? 'text-slate-700' : 'text-zinc-400'}`}>MAÑANA</span>
            </div>
            
            <AutoScrollBox 
              className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-1.5 pr-0.5 max-h-[260px] md:max-h-none"
              dependencies={[activeDirectivesManana]}
              speed={0.35}
              pauseFrames={140}
              staggerMs={300}
            >
              {activeDirectivesManana.length === 0 ? (
                <div className={`h-full min-h-[60px] flex flex-col items-center justify-center text-center p-3 rounded border border-dashed ${
                  isLight ? 'border-slate-200 bg-slate-50/50 text-slate-400' : 'border-zinc-850 bg-zinc-950/30 text-zinc-600'
                }`}>
                  <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Sin directivas mañana</span>
                </div>
              ) : (
                activeDirectivesManana.map(item => (
                  <div 
                    key={item.id} 
                    className={`border p-2 rounded flex flex-col gap-1 transition shadow-xs ${
                      isLight 
                        ? 'bg-slate-50 border-slate-200' 
                        : 'bg-[#141418] border-zinc-850'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`font-bold uppercase tracking-wider text-[10px] font-mono ${
                        isLight ? 'text-slate-700' : 'text-zinc-400'
                      }`}>{item.displayName}</span>
                      {item.time && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
                          isLight 
                            ? 'bg-slate-200 text-slate-800 border border-slate-300' 
                            : 'bg-zinc-900 border border-zinc-700 text-zinc-300'
                        }`}>
                          <Clock size={9} /> {item.time} hs
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] font-medium leading-snug ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                      {item.requirements}
                    </p>
                  </div>
                ))
              )}
            </AutoScrollBox>
          </div>
        </div>
      </div>

      {/* BOTTOM HALF: OBSERVACIONES */}
      <div className={`flex-1 min-h-0 flex flex-col border-t pt-2.5 ${isLight ? 'border-slate-200' : 'border-[#19191D]'}`}>
        <div className="flex justify-between items-center pb-1.5 mb-1.5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity size={14} className={isLight ? 'text-[#940028]' : 'text-zinc-400'} />
            <h2 className={`text-xs font-bold tracking-widest uppercase ${isLight ? 'text-[#940028]' : 'text-zinc-400'}`}>
              OBSERVACIONES
            </h2>
          </div>
          <span className={`text-[9px] font-mono ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>ESTADO GENERAL</span>
        </div>

        <AutoScrollBox 
          className="overflow-y-auto no-scrollbar flex-grow min-h-0 pr-1 max-h-[220px] md:max-h-none"
          dependencies={[observations]}
          speed={0.3}
          pauseFrames={150}
        >
          {observations.length === 0 ? (
            <div className={`h-full min-h-[50px] flex items-center justify-center text-[10px] font-mono gap-2 py-2 px-3 rounded border border-dashed ${
              isLight ? 'border-slate-200 bg-slate-50/50 text-slate-400' : 'border-zinc-850 bg-zinc-950/30 text-zinc-500'
            }`}>
              <CheckCircle2 size={14} className="text-emerald-500/70" />
              <span className="uppercase font-bold tracking-wider">Operación Normal - Sin Observaciones</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 content-start">
              {observations.map(obs => (
                <div 
                  key={obs.id} 
                  className={`border px-2.5 py-1.5 rounded flex items-center gap-2 text-[10px] font-medium transition ${
                    obs.severity === 'danger' 
                      ? isLight 
                        ? 'border-red-300 text-red-800 bg-red-50 shadow-xs' 
                        : 'border-red-955 text-red-400 bg-red-950/15' 
                      : obs.severity === 'warning' 
                        ? isLight 
                          ? 'border-amber-300 text-amber-800 bg-amber-50 shadow-xs' 
                          : 'border-amber-955 text-amber-400 bg-amber-950/15' 
                        : isLight 
                          ? 'border-slate-200 text-slate-800 bg-slate-100 shadow-xs' 
                          : 'border-[#19191D] text-zinc-300 bg-[#141418]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    obs.severity === 'danger' ? 'bg-red-500 animate-pulse' : obs.severity === 'warning' ? 'bg-amber-500' : isLight ? 'bg-slate-400' : 'bg-zinc-400'
                  }`}></span>
                  <span className="leading-snug">{obs.text}</span>
                </div>
              ))}
            </div>
          )}
        </AutoScrollBox>
      </div>
    </section>
  );

  // BLOCK 3: CALENDARIO MENSUAL
  const renderBlockMensual = (extraClass = '') => (
    <section 
      className={`hidden md:flex w-full h-full min-w-0 min-h-0 overflow-hidden border rounded-lg p-3 sm:p-4 flex-col transition-colors duration-300 ${extraClass} ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0e0e11] border-[#19191D]'
      }`}
    >
      {/* Header con Nombre del Mes en Mayúsculas */}
      <div className="flex items-center justify-between border-b pb-2 mb-2 flex-shrink-0 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarIcon size={14} className={isLight ? 'text-[#940028]' : 'text-red-400 flex-shrink-0'} />
          <h2 className={`text-xs font-black tracking-widest font-mono uppercase truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {displayCalendarData.currentMonthName} {displayCalendarData.currentYear}
          </h2>
        </div>
        <span className={`text-[9px] font-mono px-2 py-0.5 rounded flex-shrink-0 whitespace-nowrap ${
          isLight ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
        }`}>
          {displayCalendarData.monthEvents.length} EVENTOS
        </span>
      </div>

      {/* Días de la semana (Lunes a Domingo) */}
      <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] font-bold py-1 border-b mb-1.5 flex-shrink-0">
        {['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'].map(d => (
          <span key={d} className={isLight ? 'text-slate-600' : 'text-zinc-400'}>
            {d.slice(0, 3).toUpperCase()}
          </span>
        ))}
      </div>

      {/* Grilla de Celdas del Mes (35 celdas = 5 semanas x 7 días) */}
      <div className="grid grid-cols-7 grid-rows-5 gap-1.5 flex-grow min-h-0 overflow-hidden">
        {monthGrid.map((cell, idx) => {
          const hasEvents = cell.events && cell.events.length > 0;

          return (
            <div 
              key={idx}
              className={`relative p-1 sm:p-1.5 rounded flex flex-col justify-between border transition-all overflow-hidden min-h-0 ${
                !cell.isCurrentMonth
                  ? isLight ? 'bg-slate-50/50 border-slate-100 text-slate-300 opacity-60' : 'bg-zinc-950/40 border-zinc-900 text-zinc-700 opacity-40'
                  : cell.isToday
                    ? isLight 
                      ? 'bg-[#940028]/10 border-[#940028] text-slate-900 shadow-sm ring-1 ring-[#940028]/40' 
                      : 'bg-[#940028]/20 border-[#940028] text-white shadow-sm ring-1 ring-[#940028]/60'
                    : hasEvents
                      ? isLight ? 'bg-slate-50/80 border-slate-200 hover:border-slate-300' : 'bg-[#141418] border-zinc-850 hover:border-zinc-700'
                      : isLight ? 'bg-white border-slate-100' : 'bg-[#101014] border-zinc-900'
              }`}
            >
              {/* Número de día */}
              <div className="flex justify-between items-center flex-shrink-0 leading-none">
                <span className={`text-[10.5px] font-mono font-bold leading-none ${
                  cell.isToday 
                    ? isLight ? 'text-[#940028] bg-white px-1 py-0.5 rounded shadow-2xs font-extrabold' : 'text-white bg-[#940028] px-1 py-0.5 rounded shadow-2xs' 
                    : cell.isCurrentMonth ? (isLight ? 'text-slate-700' : 'text-zinc-300') : (isLight ? 'text-slate-400' : 'text-zinc-600')
                }`}>
                  {String(cell.day).padStart(2, '0')}
                </span>

                {cell.isToday && (
                  <span className={`text-[7.5px] font-mono font-bold uppercase tracking-wider ${
                    isLight ? 'text-[#940028]' : 'text-red-300'
                  }`}>
                    HOY
                  </span>
                )}
              </div>

              {/* Pills / Eventos dentro del día */}
              <div className="flex flex-col gap-0.5 mt-0.5 overflow-hidden flex-1 min-h-0 justify-end">
                {hasEvents && cell.events.slice(0, 1).map((ev, evIdx) => (
                  <div 
                    key={evIdx}
                    onClick={() => setSelectedTicketModal(ev)}
                    title={`${ev.timeStr} ${ev.title}`}
                    className={`text-[8.5px] font-mono truncate px-1 py-0.5 rounded leading-tight border cursor-pointer ${
                      cell.isToday
                        ? isLight 
                          ? 'bg-[#940028] text-white border-[#7d0022] font-semibold' 
                          : 'bg-[#7d0022] text-white border-[#940028]'
                        : isLight
                          ? 'bg-sky-50 text-sky-900 border-sky-200 hover:bg-sky-100'
                          : 'bg-sky-950/60 text-sky-300 border-sky-900/60 hover:bg-sky-900/60'
                    }`}
                  >
                    <span className="font-bold mr-0.5">{ev.timeStr}</span> {ev.title}
                  </div>
                ))}

                {cell.events.length > 1 && (
                  <span className={`text-[7.5px] font-mono text-center font-bold ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                    +{cell.events.length - 1} más
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  // BLOCK 1: EVENTOS HOY & MAÑANA (OUTLOOK HELPDESK & CeNem)
  const renderBlockHoyManana = (extraClass = '') => {
    const hasTodayEvents = displayCalendarData.todayEvents && displayCalendarData.todayEvents.length > 0;
    const hasTomorrowEvents = displayCalendarData.tomorrowEvents && displayCalendarData.tomorrowEvents.length > 0;

    return (
      <section 
        className={`w-full h-full min-w-0 min-h-0 overflow-hidden border rounded-lg p-3 sm:p-3.5 flex flex-col gap-2.5 sm:gap-3 transition-colors duration-300 ${extraClass} ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0e0e11] border-[#19191D]'
        }`}
      >
        {/* CASE 1: HOY HAS NO EVENTS, BUT MAÑANA HAS EVENTS -> COLLAPSE HOY TO A SLEEK HEADER! */}
        {!hasTodayEvents && hasTomorrowEvents ? (
          <>
            {/* Collapsed Hoy Banner */}
            <div className={`px-3 py-2 rounded-lg border flex items-center justify-between flex-shrink-0 ${
              isLight ? 'bg-slate-50/80 border-slate-200 text-slate-700' : 'bg-[#121216] border-zinc-850 text-zinc-300'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isLight ? 'bg-slate-300' : 'bg-zinc-600'}`}></span>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider">
                  HOY - {todayHeaderDate}
                </span>
              </div>
              <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                isLight ? 'bg-slate-100 text-slate-500' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
              }`}>
                0 EVENTOS HOY
              </span>
            </div>

            {/* Tomorrow Expands into Full Height */}
            <div className="flex-1 min-h-0 flex flex-col pt-0.5">
              <div className={`flex justify-between items-center border-b pb-2 mb-2 flex-shrink-0 ${
                isLight ? 'border-slate-200' : 'border-[#19191D]'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#940028] animate-pulse"></span>
                  <h3 className={`text-xs font-black tracking-widest font-mono uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    MAÑANA - {tomorrowHeaderDate}
                  </h3>
                </div>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold ${
                  isLight ? 'bg-[#940028]/10 text-[#940028]' : 'bg-[#940028]/30 text-red-300 border border-[#940028]/40'
                }`}>
                  {displayCalendarData.tomorrowEvents.length} {displayCalendarData.tomorrowEvents.length === 1 ? 'EVENTO' : 'EVENTOS'}
                </span>
              </div>

              <AutoScrollBox 
                className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2 pr-0.5 pb-2"
                dependencies={[displayCalendarData.tomorrowEvents]}
                speed={0.3}
                pauseFrames={150}
              >
                {displayCalendarData.tomorrowEvents.map(evt => renderEventCard(evt))}
              </AutoScrollBox>
            </div>
          </>
        ) : hasTodayEvents && !hasTomorrowEvents ? (
          /* CASE 2: HOY HAS EVENTS, MAÑANA HAS NO EVENTS -> EXPAND HOY, COLLAPSE MAÑANA */
          <>
            <div className="flex-1 min-h-0 flex flex-col">
              <div className={`flex justify-between items-center border-b pb-2 mb-2 flex-shrink-0 ${
                isLight ? 'border-slate-200' : 'border-[#19191D]'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#940028] animate-pulse"></span>
                  <h3 className={`text-xs font-black tracking-widest font-mono uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    HOY - {todayHeaderDate}
                  </h3>
                </div>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold ${
                  isLight ? 'bg-[#940028]/10 text-[#940028]' : 'bg-[#940028]/30 text-red-300 border border-[#940028]/40'
                }`}>
                  {displayCalendarData.todayEvents.length} {displayCalendarData.todayEvents.length === 1 ? 'EVENTO' : 'EVENTOS'}
                </span>
              </div>

              <AutoScrollBox 
                className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2 pr-0.5 pb-2"
                dependencies={[displayCalendarData.todayEvents]}
                speed={0.3}
                pauseFrames={150}
              >
                {displayCalendarData.todayEvents.map(evt => renderEventCard(evt))}
              </AutoScrollBox>
            </div>

            {/* Collapsed Tomorrow Banner */}
            <div className={`px-3 py-2 rounded-lg border flex items-center justify-between flex-shrink-0 ${
              isLight ? 'bg-slate-50/80 border-slate-200 text-slate-700' : 'bg-[#121216] border-zinc-850 text-zinc-300'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isLight ? 'bg-slate-300' : 'bg-zinc-600'}`}></span>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider">
                  MAÑANA - {tomorrowHeaderDate}
                </span>
              </div>
              <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                isLight ? 'bg-slate-100 text-slate-500' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
              }`}>
                0 EVENTOS MAÑANA
              </span>
            </div>
          </>
        ) : (
          /* CASE 3: BOTH HAVE EVENTS (OR BOTH HAVE 0 EVENTS) -> BALANCED SPLIT */
          <>
            <div className="flex-1 min-h-0 flex flex-col">
              <div className={`flex justify-between items-center border-b pb-2 mb-2 flex-shrink-0 ${
                isLight ? 'border-slate-200' : 'border-[#19191D]'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#940028] animate-pulse"></span>
                  <h3 className={`text-xs font-black tracking-widest font-mono uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    HOY - {todayHeaderDate}
                  </h3>
                </div>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold ${
                  hasTodayEvents 
                    ? isLight ? 'bg-[#940028]/10 text-[#940028]' : 'bg-[#940028]/30 text-red-300 border border-[#940028]/40'
                    : isLight ? 'text-slate-400' : 'text-zinc-500'
                }`}>
                  {displayCalendarData.todayEvents.length} {displayCalendarData.todayEvents.length === 1 ? 'EVENTO' : 'EVENTOS'}
                </span>
              </div>

              <AutoScrollBox 
                className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2 pr-0.5 pb-2"
                dependencies={[displayCalendarData.todayEvents]}
                speed={0.3}
                pauseFrames={150}
              >
                {!hasTodayEvents ? (
                  <div className={`h-full flex flex-col items-center justify-center text-center p-4 rounded border border-dashed ${
                    isLight ? 'border-slate-200 bg-slate-50/50 text-slate-400' : 'border-zinc-850 bg-zinc-950/40 text-zinc-600'
                  }`}>
                    <CalendarIcon size={20} className="mb-1 opacity-40" />
                    <span className="text-[10px] font-mono font-bold uppercase">SIN EVENTOS HOY</span>
                  </div>
                ) : (
                  displayCalendarData.todayEvents.map(evt => renderEventCard(evt))
                )}
              </AutoScrollBox>
            </div>

            <div className={`flex-1 min-h-0 flex flex-col border-t pt-2.5 ${
              isLight ? 'border-slate-200' : 'border-[#19191D]'
            }`}>
              <div className={`flex justify-between items-center border-b pb-2 mb-2 flex-shrink-0 ${
                isLight ? 'border-slate-200' : 'border-[#19191D]'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isLight ? 'bg-slate-400' : 'bg-zinc-500'}`}></span>
                  <h3 className={`text-xs font-black tracking-widest font-mono uppercase ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                    MAÑANA - {tomorrowHeaderDate}
                  </h3>
                </div>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold ${
                  hasTomorrowEvents 
                    ? isLight ? 'bg-slate-100 text-slate-700' : 'bg-zinc-850 text-zinc-300'
                    : isLight ? 'text-slate-400' : 'text-zinc-500'
                }`}>
                  {displayCalendarData.tomorrowEvents.length} {displayCalendarData.tomorrowEvents.length === 1 ? 'EVENTO' : 'EVENTOS'}
                </span>
              </div>

              <AutoScrollBox 
                className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2 pr-0.5 pb-2"
                dependencies={[displayCalendarData.tomorrowEvents]}
                speed={0.3}
                pauseFrames={150}
                staggerMs={300}
              >
                {!hasTomorrowEvents ? (
                  <div className={`h-full flex flex-col items-center justify-center text-center p-4 rounded border border-dashed ${
                    isLight ? 'border-slate-200 bg-slate-50/50 text-slate-400' : 'border-zinc-850 bg-zinc-950/40 text-zinc-600'
                  }`}>
                    <CalendarIcon size={20} className="mb-1 opacity-40" />
                    <span className="text-[10px] font-mono font-bold uppercase">SIN EVENTOS MAÑANA</span>
                  </div>
                ) : (
                  displayCalendarData.tomorrowEvents.map(evt => renderEventCard(evt))
                )}
              </AutoScrollBox>
            </div>
          </>
        )}
      </section>
    );
  };

  // BLOCK 4: ALMANAQUE FIJO (SOLICITUDES FIJAS SEMANAL) - ADAPTATIVO
  const renderBlockWeekly = (extraClass = '') => (
    <section 
      className={`relative z-10 border rounded-lg p-3 sm:p-3.5 flex flex-col min-h-0 h-full flex-shrink-0 transition-all duration-200 ${extraClass} ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0e0e11] border-[#19191D]'
      }`}
    >
      <AdaptiveWeeklyCalendar 
        events={combinedWeeklyEvents} 
        isLight={isLight}
        isFourDayMode={isFourDayMode}
        onToggleFourDayMode={handleToggleFourDayMode}
        onEventClick={(evt) => setSelectedTicketModal(evt)}
        currentDateKey={currentDateKey}
      />
    </section>
  );

  return (
    <main className={`relative min-h-screen md:h-screen w-screen flex flex-col p-3.5 sm:p-4 md:p-6 gap-3.5 sm:gap-4 md:gap-5 overflow-y-auto md:overflow-hidden select-none transition-colors duration-500 ${isLight ? 'bg-[#f1f5f9] text-slate-900' : 'bg-[#09090b] text-zinc-100'}`}>

      {/* HEADER */}
      <header className={`relative z-10 flex items-center justify-between border-b px-4 md:px-6 py-3 md:py-4 rounded-lg shadow-sm transition-colors duration-300 ${
        isLight 
          ? 'bg-white border-[#940028]/30 shadow-[#940028]/5' 
          : 'bg-[#0e0e11] border-[#940028]/40 shadow-[#940028]/10'
      }`}>
        <div className="flex items-center gap-2.5 sm:gap-3">
          <img 
            src="/ucema-logo.png" 
            alt="UCEMA Logo" 
            className="h-7 sm:h-9 w-auto rounded object-contain shadow-xs" 
            onError={(e) => {
              e.currentTarget.src = "https://ucema.edu.ar/mailing/firmas-ucema/Firmas_Institucional/Firma_Institucional_Blanco/assets/img/LOGO.png";
            }}
          />
          <div className={`border-l pl-2.5 sm:pl-3 ${isLight ? 'border-slate-300' : 'border-[#19191D]'}`}>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className={`font-bold text-xs sm:text-sm tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>DASHBOARD UCEMA</h1>
              <span className="text-[8px] sm:text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#940028] text-white font-bold tracking-widest uppercase">
                TV 2
              </span>
            </div>
            <p className={`text-[9px] sm:text-[10px] ${isLight ? 'text-[#940028] font-bold' : 'text-zinc-400'}`}>Soporte Técnico</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <HeaderClock isLight={isLight} />
        </div>
      </header>

      {/* MAIN WORKSPACE CONTAINER (CSS GRID: 30% Directivas, 1fr Mensual, 28% Hoy/Mañana) */}
      {isDesktop ? (
        <div 
          ref={mainContainerRef}
          className="relative z-10 flex-grow h-0 min-h-0 overflow-hidden select-none grid gap-3.5 sm:gap-4"
          style={{
            gridTemplateColumns: '30% minmax(0, 1fr) 28%',
            gridTemplateRows: 'minmax(0, 1.75fr) minmax(0, 1fr)',
          }}
        >
          {/* BLOCK 2: DIRECTIVAS & OBSERVACIONES (Col 1, Row 1 -> EXACTLY 30% SCREEN WIDTH!) */}
          <div 
            className="min-h-0 min-w-0 flex items-stretch overflow-hidden"
            style={{ gridColumn: '1 / 2', gridRow: '1 / 2' }}
          >
            {renderBlockDirectivas('w-full h-full')}
          </div>

          {/* BLOCK 3: CALENDARIO MENSUAL (Col 2, Row 1 -> takes center 1fr ~42%) */}
          <div 
            className="min-h-0 min-w-0 flex items-stretch overflow-hidden"
            style={{ gridColumn: '2 / 3', gridRow: '1 / 2' }}
          >
            {renderBlockMensual('w-full h-full')}
          </div>

          {/* BLOCK 1: EVENTOS HOY & MAÑANA (Col 3 -> 28% width; in 4-day mode spans Row 1 & Row 2 full height!) */}
          <div 
            className="min-h-0 min-w-0 flex items-stretch overflow-hidden"
            style={{ 
              gridColumn: '3 / 4', 
              gridRow: isFourDayMode ? '1 / 3' : '1 / 2' 
            }}
          >
            {renderBlockHoyManana('w-full h-full')}
          </div>

          {/* BLOCK 4: ADAPTIVE WEEKLY CALENDAR (Row 2; in 4-day mode spans Col 1 & Col 2 (72% width); in 5-day mode spans Col 1 to Col 3 (100% width)) */}
          <div 
            className="min-h-0 min-w-0 flex items-stretch overflow-hidden"
            style={{ 
              gridColumn: isFourDayMode ? '1 / 3' : '1 / 4', 
              gridRow: '2 / 3' 
            }}
          >
            {renderBlockWeekly('w-full h-full')}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* MOBILE LAYOUT: Vertical stacked with comfortable touch-scrolling          */
        /* ========================================================================= */
        <div 
          ref={mainContainerRef}
          className="relative z-10 flex flex-col flex-grow overflow-y-auto gap-3.5 sm:gap-4 select-none"
        >
          {renderBlockHoyManana('order-1')}
          {renderBlockDirectivas('order-2')}
          {renderBlockWeekly('order-3')}
        </div>
      )}

      {/* ========================================================================= */}
      {/* INTERACTIVE TICKET DETAILS MODAL / BOTTOM SHEET (FOR MOBILE & DESKTOP)    */}
      {/* ========================================================================= */}
      {selectedTicketModal && (
        <div 
          onClick={() => setSelectedTicketModal(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-xl rounded-t-2xl sm:rounded-2xl border p-5 sm:p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#121216] border-zinc-800 text-white'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#940028] text-white">
                    {selectedTicketModal.isCeNem ? 'LABORATORIO CENEM' : 'HELPDESK OUTLOOK'}
                  </span>
                  {selectedTicketModal.location && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                      isLight ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}>
                      <MapPin size={11} /> {selectedTicketModal.location}
                    </span>
                  )}
                </div>
                <h3 className="font-extrabold text-base leading-snug">
                  {selectedTicketModal.title}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedTicketModal(null)}
                className={`p-2 rounded-lg cursor-pointer transition ${
                  isLight ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-800' : 'hover:bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Time Breakdown */}
            <div className={`p-3 rounded-lg border grid grid-cols-2 gap-3 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#18181e] border-zinc-800'
            }`}>
              <div>
                <span className={`text-[10px] font-mono uppercase block mb-0.5 ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                  ⏰ Horario {selectedTicketModal.isCeNem ? 'de Reserva' : 'de Armado'}
                </span>
                <span className={`text-sm font-bold font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {selectedTicketModal.timeStr} {selectedTicketModal.endTimeStr ? `- ${selectedTicketModal.endTimeStr}` : ''} hs
                </span>
              </div>
              <div>
                <span className={`text-[10px] font-mono uppercase block mb-0.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                  {selectedTicketModal.isCeNem ? '📅 Fecha' : '🎤 Inicio Real del Evento'}
                </span>
                <span className="text-sm font-bold font-mono text-amber-500">
                  {selectedTicketModal.isCeNem 
                    ? (selectedTicketModal.dateStr || 'Hoy')
                    : (selectedTicketModal.aiAnalysis?.event_real_time || `${selectedTicketModal.timeStr} hs`)}
                </span>
              </div>
            </div>

            {/* CeNem Status Banner if applicable */}
            {selectedTicketModal.isCeNem && (
              <div className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                selectedTicketModal.status === 'cancelled'
                  ? 'bg-red-950/60 border-red-800 text-red-200'
                  : 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${selectedTicketModal.status === 'cancelled' ? 'bg-red-500' : 'bg-emerald-400 animate-pulse'}`}></span>
                  <span className="font-mono font-bold uppercase">
                    ESTADO: {selectedTicketModal.status === 'cancelled' ? 'RESERVA CANCELADA' : 'RESERVA ACTIVA'}
                  </span>
                </div>
                {selectedTicketModal.applicant && (
                  <span className="font-mono text-[11px] opacity-90">
                    Docente: {selectedTicketModal.applicant}
                  </span>
                )}
              </div>
            )}

            {/* Discrepancy Alert Banner */}
            {selectedTicketModal.aiAnalysis?.has_discrepancy && (
              <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                isLight ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-amber-950/40 text-amber-300 border border-amber-900/60'
              }`}>
                <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Diferencia de Horario Detectada por IA:</strong>
                  <span>{selectedTicketModal.aiAnalysis.explanation}</span>
                </div>
              </div>
            )}

            {/* Equipment Checklist */}
            {selectedTicketModal.aiAnalysis?.equipment_tags && selectedTicketModal.aiAnalysis.equipment_tags.length > 0 && (
              <div>
                <h4 className={`text-xs font-mono font-bold uppercase mb-2 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                  Requerimientos Técnicos Identificados:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTicketModal.aiAnalysis.equipment_tags.map((tag, idx) => (
                    <span 
                      key={idx}
                      className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border shadow-xs ${
                        tag === 'CANCELADO'
                          ? 'bg-red-900 text-white border-red-700'
                          : isLight ? 'bg-white text-slate-800 border-slate-200' : 'bg-zinc-900 text-zinc-100 border-zinc-700'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Full Message Body / Edit Form */}
            {selectedTicketModal.isCeNem && editingCenemInTv ? (
              <form onSubmit={handleSaveEditCenemTv} className="space-y-3 border-t border-zinc-800 pt-3">
                <div className="bg-amber-950/40 border border-amber-800 text-amber-300 text-xs p-2 rounded font-mono flex items-center gap-2">
                  <Edit3 size={14} /> Modificando Reserva de Laboratorio CeNem
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-zinc-400 mb-1">Día (Fecha)</label>
                  <input
                    type="date"
                    value={tvEditDate}
                    onChange={(e) => setTvEditDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-xs rounded text-white font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-zinc-400 mb-1">Horario Inicio</label>
                    <input
                      type="time"
                      value={tvEditStartTime}
                      onChange={(e) => setTvEditStartTime(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-xs rounded text-white font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-zinc-400 mb-1">Horario Fin</label>
                    <input
                      type="time"
                      value={tvEditEndTime}
                      onChange={(e) => setTvEditEndTime(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-xs rounded text-white font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400 uppercase text-[10px]">Ubicación asignada:</span>
                  <span className="px-2 py-0.5 rounded bg-[#940028]/20 border border-[#940028]/40 text-red-200 font-bold flex items-center gap-1">
                    <MapPin size={11} className="text-[#940028]" /> Sede 637
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 bg-[#940028] hover:bg-[#b30032] text-white text-xs font-mono font-bold py-2 px-3 rounded transition cursor-pointer"
                  >
                    Guardar Cambios
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCenemInTv(false)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono py-2 px-3 rounded transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <h4 className={`text-xs font-mono font-bold uppercase mb-2 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                  {selectedTicketModal.isCeNem ? 'Requerimientos y Notas de Reserva:' : 'Mensaje Completo del Ticket:'}
                </h4>
                <div className={`p-4 rounded-lg border text-xs font-sans whitespace-pre-line leading-relaxed max-h-52 overflow-y-auto ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-zinc-950 border-zinc-900 text-zinc-200'
                }`}>
                  {selectedTicketModal.description || 'Sin descripción adicional.'}
                </div>
              </div>
            )}

            {/* Footer & Actions for Soportistas/Admins */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-zinc-800">
              {selectedTicketModal.isCeNem && !editingCenemInTv ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleOpenEditCenemTv(selectedTicketModal)}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border border-zinc-700"
                  >
                    <Edit3 size={13} className="text-amber-400" /> Modificar
                  </button>

                  <button
                    onClick={() => handleToggleCancelCenemTv(selectedTicketModal)}
                    className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                      selectedTicketModal.status === 'cancelled'
                        ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-800'
                        : 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border-amber-800'
                    }`}
                  >
                    {selectedTicketModal.status === 'cancelled' ? (
                      <><RefreshCw size={13} /> Reactivar</>
                    ) : (
                      <><Ban size={13} /> Cancelar</>
                    )}
                  </button>

                  <button
                    onClick={() => handleDeleteCenemTv(selectedTicketModal.id)}
                    className="px-3 py-2 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 size={13} /> Borrar
                  </button>
                </div>
              ) : (
                <div />
              )}

              <button
                onClick={() => { setSelectedTicketModal(null); setEditingCenemInTv(false); }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#940028] hover:bg-[#b30032] text-white text-xs font-bold font-mono tracking-wider transition cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE ALERTA INMINENTE (< 15 MIN)                                      */}
      {/* ========================================================================= */}
      {showAlertModal && upcomingAlertTasks.length > 0 && (
        <div 
          onClick={() => setShowAlertModal(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-300"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0e0e11] border-2 border-red-600 rounded-2xl shadow-2xl shadow-red-950/80 max-w-2xl w-full overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200"
          >
            {/* Header con alarma */}
            <div className="bg-red-950/60 border-b border-red-900/70 p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-red-600 text-white rounded-xl shadow-lg shadow-red-600/40 animate-bounce">
                  <Bell size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white tracking-wider flex items-center gap-2 sm:gap-3 font-mono">
                    ALERTA: TAREA INMINENTE
                    <span className="text-[10px] sm:text-xs bg-red-600/40 text-red-200 border border-red-500/50 px-2 py-0.5 rounded font-mono">
                      &lt; 15 MIN
                    </span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-red-200/90 font-medium">Requerimiento programado en breve para el equipo de soporte técnico</p>
                </div>
              </div>

              <button 
                onClick={() => setShowAlertModal(false)}
                className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
                title="Cerrar modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Listado de tareas próximas con AutoScroll */}
            <AutoScrollBox 
              className="p-4 sm:p-6 space-y-4 max-h-[65vh] overflow-y-auto no-scrollbar"
              dependencies={[upcomingAlertTasks]}
              speed={0.45}
              pauseFrames={120}
            >
              {upcomingAlertTasks.map((task) => (
                <div 
                  key={task.id}
                  className="bg-[#141418] border-2 border-red-900/50 p-4 sm:p-5 rounded-xl flex flex-col gap-2.5 relative overflow-hidden shadow-md"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <span className={`text-xs font-mono px-2.5 py-1 rounded font-bold uppercase ${
                        task.sourceType === 'outlook'
                          ? 'bg-blue-950 border border-blue-800 text-blue-300'
                          : task.sourceType === 'evento' 
                            ? 'bg-amber-950/80 border border-amber-800 text-amber-300' 
                            : 'bg-[#940028]/60 border border-[#940028] text-white'
                      }`}>
                        {task.badge}
                      </span>
                      <span className="font-black text-red-400 font-mono text-sm sm:text-base tracking-wider uppercase">
                        {task.title}
                      </span>
                      <span className="text-xs font-mono font-bold bg-red-950 border border-red-800 text-red-200 px-2.5 py-1 rounded flex items-center gap-1.5">
                        <Clock size={13} /> {task.time} hs
                      </span>
                    </div>
                    <span className="text-xs sm:text-sm font-extrabold text-amber-400 font-mono bg-amber-950/40 border border-amber-900/60 px-2.5 sm:px-3 py-0.5 rounded-full animate-pulse">
                      {task.diffMinutes > 0 ? `Faltan ${task.diffMinutes} min` : task.diffMinutes === 0 ? '¡COMIENZA AHORA!' : 'En curso'}
                    </span>
                  </div>

                  <p className="text-zinc-100 text-xs sm:text-sm font-semibold leading-relaxed bg-zinc-950/80 p-3 sm:p-3.5 rounded-lg border border-zinc-900">
                    {task.text}
                  </p>

                  <div className="flex justify-between items-center text-[11px] text-zinc-500 font-mono pt-1">
                    <span>{task.subtitle}</span>
                    {task.creator && (
                      <span>Referencia: {task.creator}</span>
                    )}
                  </div>
                </div>
              ))}
            </AutoScrollBox>

            {/* Footer con cuenta regresiva de 50 segundos */}
            <div className="bg-zinc-950 border-t border-zinc-900 p-3.5 sm:p-4 px-4 sm:px-6 flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-mono flex items-center gap-2">
                <Clock size={14} className="text-red-400" />
                Cierre automático en <strong className="text-white font-bold">{alertCountdown}s</strong> (o toca afuera)
              </span>

              <button
                onClick={() => setShowAlertModal(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold px-4 sm:px-5 py-2 rounded-lg transition cursor-pointer font-mono"
              >
                Entendido / Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
