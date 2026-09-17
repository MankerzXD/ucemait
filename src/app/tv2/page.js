'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  Clock, ShieldAlert, Activity, Bell, X, Calendar as CalendarIcon, MapPin, 
  Ticket, AlertCircle, ChevronRight, CheckCircle2, FileText, Layers
} from 'lucide-react';

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
    fetchOutlookCalendar();
    const interval = setInterval(fetchOutlookCalendar, 60000);
    return () => clearInterval(interval);
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

      // 3. Outlook Helpdesk Events check for Today
      if (calendarData.todayEvents && calendarData.todayEvents.length > 0) {
        calendarData.todayEvents.forEach(oEvt => {
          if (oEvt.isDateOnly || !oEvt.timeStr) return;

          const parts = oEvt.timeStr.split(':');
          if (parts.length < 2) return;
          const targetH = parseInt(parts[0], 10);
          const targetM = parseInt(parts[1], 10);
          if (isNaN(targetH) || isNaN(targetM)) return;

          const targetTotalMin = targetH * 60 + targetM;
          const diffMin = targetTotalMin - nowTotalMin;

          if (diffMin >= -10 && diffMin <= 15) {
            const key = `outlook_${oEvt.id}_${todayStr}_${oEvt.timeStr}`;
            if (!alertedDirectivesRef.current.has(key)) {
              due.push({
                id: `outlook_${oEvt.id}`,
                dedupKey: key,
                sourceType: 'outlook',
                badge: 'HELPDESK OUTLOOK',
                title: oEvt.title.toUpperCase(),
                time: oEvt.timeStr,
                text: oEvt.description || oEvt.title,
                subtitle: `Calendario Helpdesk UCEMA • ${oEvt.timeStr} hs`,
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
  }, [directives, events, calendarData.todayEvents]);

  // 50-second auto-close countdown for TV
  useEffect(() => {
    if (!showAlertModal) return;

    setAlertCountdown(50);
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
        .subscribe();
    }

    initDashboard();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

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
    } catch (err) {
      console.error('Error fetching TV data:', err);
      loadDemoData();
    }
  };

  const loadDemoData = () => {
    const localTheme = localStorage.getItem('demo_tv_theme');
    if (localTheme) setTvTheme(localTheme);
    setDirectives(JSON.parse(localStorage.getItem('demo_directives') || '[]'));
    setObservations(JSON.parse(localStorage.getItem('demo_observations') || '[]'));
    setEvents(JSON.parse(localStorage.getItem('demo_events') || '[]'));
  };

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

  // Group directives dynamically by date
  const getLocalDateString = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString(0);
  const tomorrowStr = getLocalDateString(1);

  const directivesHoy = directives.filter(d => d.directive_date === todayStr);
  const directivesManana = directives.filter(d => d.directive_date === tomorrowStr);

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
    const year = calendarData.currentYear;
    const month = calendarData.currentMonth;
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

    const currentDayNumber = new Date().getDate();
    for (let d = 1; d <= totalDays; d++) {
      const isToday = d === currentDayNumber;
      const dayEvents = calendarData.daysWithEvents[d] || [];
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
  }, [calendarData.currentYear, calendarData.currentMonth, calendarData.daysWithEvents]);

  // Formatted date string for HOY & MAÑANA headers
  const todayHeaderDate = useMemo(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${day} ${months[now.getMonth()]}`;
  }, []);

  const tomorrowHeaderDate = useMemo(() => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const day = String(tom.getDate()).padStart(2, '0');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${day} ${months[tom.getMonth()]}`;
  }, []);

  // Card component renderer for Outlook events (reused in desktop and mobile)
  const renderEventCard = (evt) => (
    <div 
      key={evt.id}
      onClick={() => setSelectedTicketModal(evt)}
      className={`p-3.5 rounded-lg border flex flex-col gap-2.5 transition shadow-xs cursor-pointer active:scale-[0.99] group ${
        isLight 
          ? 'bg-white border-slate-200 hover:border-[#940028]/60 text-slate-800 hover:shadow-md' 
          : 'bg-[#141418] border-zinc-800 hover:border-zinc-700 text-white hover:bg-zinc-900/60'
      }`}
    >
      {/* Time Badges & Location */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {evt.aiAnalysis?.has_discrepancy && evt.aiAnalysis?.event_real_time ? (
            <>
              <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                isLight ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-amber-950/80 text-amber-300 border border-amber-800'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                EVENTO: {evt.aiAnalysis.event_real_time}
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
                isLight ? 'bg-slate-100 text-slate-600' : 'bg-zinc-850 text-zinc-400'
              }`}>
                <Clock size={10} /> Armado: {evt.timeStr} hs
              </span>
            </>
          ) : (
            <span className={`text-xs font-extrabold font-mono px-2.5 py-0.5 rounded flex items-center gap-1 ${
              isLight ? 'bg-[#940028] text-white shadow-2xs' : 'bg-[#940028] text-white shadow-2xs'
            }`}>
              <Clock size={11} /> {evt.timeStr} {evt.endTimeStr ? `- ${evt.endTimeStr}` : 'hs'}
            </span>
          )}
        </div>

        {evt.location && (
          <span className={`text-[9px] font-mono truncate max-w-[130px] flex items-center gap-0.5 ${
            isLight ? 'text-slate-500' : 'text-zinc-400'
          }`}>
            <MapPin size={10} /> {evt.location}
          </span>
        )}
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
      <h4 className={`text-xs sm:text-[13px] font-bold leading-snug group-hover:text-[#940028] transition-colors ${
        isLight ? 'text-slate-900' : 'text-white'
      }`}>
        {evt.title}
      </h4>

      {/* Equipment tags */}
      {evt.aiAnalysis?.equipment_tags && evt.aiAnalysis.equipment_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {evt.aiAnalysis.equipment_tags.map((tag, tagIdx) => (
            <span 
              key={tagIdx}
              className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
                isLight ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-zinc-900 text-zinc-300 border-zinc-800'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Description Snippet */}
      {evt.description && (
        <p className={`text-[11px] line-clamp-2 leading-tight ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
          {evt.description}
        </p>
      )}

      {/* Tap hint for mobile & desktop */}
      <div className={`pt-1 border-t border-dashed flex items-center justify-between text-[10px] font-mono ${
        isLight ? 'border-slate-200 text-slate-500' : 'border-zinc-800 text-zinc-500'
      }`}>
        <span className="text-[#940028] font-bold group-hover:underline flex items-center gap-0.5">
          Ver requerimientos completos <ChevronRight size={11} />
        </span>
        <span className="text-[9px] opacity-70">Tocar para abrir</span>
      </div>
    </div>
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

        <div className="flex justify-end items-center">
          <HeaderClock isLight={isLight} />
        </div>
      </header>

      {/* MAIN LAYOUT: MOBILE-FIRST FLEX ORDER VS DESKTOP 12-COLUMN GRID */}
      <div className="relative z-10 flex flex-col md:grid md:grid-cols-12 gap-3.5 sm:gap-4 md:flex-grow md:h-0 md:min-h-0">
        
        {/* ========================================================================= */}
        {/* BLOCK 1: EVENTOS HOY & MAÑANA                                              */}
        {/* MOBILE: 1ER LUGAR (order-1) | DESKTOP: 3ER LUGAR (md:order-3, col-span-3)   */}
        {/* ========================================================================= */}
        <section className={`order-1 md:order-3 col-span-12 md:col-span-3 border rounded-lg p-3.5 sm:p-4 flex flex-col gap-3.5 sm:gap-4 md:h-full md:min-h-0 transition-colors duration-300 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0e0e11] border-[#19191D]'
        }`}>
          
          {/* HOY - EVENTOS OUTLOOK */}
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
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                calendarData.todayEvents.length > 0 
                  ? isLight ? 'bg-[#940028]/10 text-[#940028]' : 'bg-[#940028]/30 text-red-300'
                  : isLight ? 'text-slate-400' : 'text-zinc-500'
              }`}>
                {calendarData.todayEvents.length} {calendarData.todayEvents.length === 1 ? 'EVENTO' : 'EVENTOS'}
              </span>
            </div>

            {/* Event list: AutoScroll on desktop, comfortable touch-scroll on mobile */}
            <AutoScrollBox 
              className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2.5 pr-0.5 max-h-[380px] md:max-h-none"
              dependencies={[calendarData.todayEvents]}
              speed={0.35}
              pauseFrames={140}
            >
              {calendarData.todayEvents.length === 0 ? (
                <div className={`h-full flex flex-col items-center justify-center text-center p-6 rounded border border-dashed ${
                  isLight ? 'border-slate-200 bg-slate-50/50 text-slate-400' : 'border-zinc-850 bg-zinc-950/40 text-zinc-600'
                }`}>
                  <CalendarIcon size={22} className="mb-1.5 opacity-40" />
                  <span className="text-[10px] font-mono font-bold uppercase">SIN EVENTOS PROGRAMADOS HOY</span>
                </div>
              ) : (
                calendarData.todayEvents.map(evt => renderEventCard(evt))
              )}
            </AutoScrollBox>
          </div>

          {/* MAÑANA - EVENTOS OUTLOOK */}
          <div className={`flex-1 min-h-0 flex flex-col border-t pt-3 ${
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
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                calendarData.tomorrowEvents.length > 0 
                  ? isLight ? 'bg-slate-100 text-slate-700' : 'bg-zinc-850 text-zinc-300'
                  : isLight ? 'text-slate-400' : 'text-zinc-500'
              }`}>
                {calendarData.tomorrowEvents.length} {calendarData.tomorrowEvents.length === 1 ? 'EVENTO' : 'EVENTOS'}
              </span>
            </div>

            <AutoScrollBox 
              className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2.5 pr-0.5 max-h-[380px] md:max-h-none"
              dependencies={[calendarData.tomorrowEvents]}
              speed={0.35}
              pauseFrames={140}
              staggerMs={300}
            >
              {calendarData.tomorrowEvents.length === 0 ? (
                <div className={`h-full flex flex-col items-center justify-center text-center p-6 rounded border border-dashed ${
                  isLight ? 'border-slate-200 bg-slate-50/50 text-slate-400' : 'border-zinc-850 bg-zinc-950/40 text-zinc-600'
                }`}>
                  <CalendarIcon size={22} className="mb-1.5 opacity-40" />
                  <span className="text-[10px] font-mono font-bold uppercase">SIN EVENTOS PROGRAMADOS MAÑANA</span>
                </div>
              ) : (
                calendarData.tomorrowEvents.map(evt => renderEventCard(evt))
              )}
            </AutoScrollBox>
          </div>

        </section>

        {/* ========================================================================= */}
        {/* BLOCK 2: DIRECTIVAS & OBSERVACIONES                                       */}
        {/* MOBILE: 2DO LUGAR (order-2) | DESKTOP: 1ER LUGAR (md:order-1, col-span-4)   */}
        {/* ========================================================================= */}
        <section className={`order-2 md:order-1 col-span-12 md:col-span-4 border rounded-lg p-3.5 sm:p-4 flex flex-col gap-3 md:h-full md:min-h-0 transition-colors duration-300 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0e0e11] border-[#19191D]'
        }`}>
          
          {/* TOP HALF: DIRECTIVAS */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className={`flex justify-between items-center border-b pb-2 mb-2 flex-shrink-0 ${isLight ? 'border-slate-200' : 'border-[#19191D]'}`}>
              <h2 className={`text-xs font-bold tracking-widest uppercase ${isLight ? 'text-[#940028]' : 'text-zinc-400'}`}>DIRECTIVAS</h2>
              <span className={`text-[9px] font-mono ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>HOY + MAÑANA</span>
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
                    <div className={`h-full flex items-center justify-center text-[10px] font-mono text-center py-4 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
                      SIN DIRECTIVAS ACTIVAS
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
                    <div className={`h-full flex items-center justify-center text-[10px] font-mono text-center py-4 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
                      SIN DIRECTIVAS ACTIVAS
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
              <h2 className={`text-xs font-bold tracking-widest uppercase ${isLight ? 'text-[#940028]' : 'text-zinc-400'}`}>OBSERVACIONES</h2>
              <span className={`text-[9px] font-mono ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>ESTADO GENERAL</span>
            </div>

            <AutoScrollBox 
              className="overflow-y-auto no-scrollbar flex-grow min-h-0 pr-1 max-h-[220px] md:max-h-none"
              dependencies={[observations]}
              speed={0.3}
              pauseFrames={150}
            >
              {observations.length === 0 ? (
                <div className={`h-full flex items-center justify-center text-[10px] font-mono gap-2 py-4 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
                  <span className={`w-2 h-2 rounded-full ${isLight ? 'bg-slate-300' : 'bg-zinc-700'}`}></span>
                  SIN OBSERVACIONES NI EVENTOS DE ALERTA
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

        {/* ========================================================================= */}
        {/* BLOCK 3: CALENDARIO MENSUAL ("SEPTIEMBRE 2026")                           */}
        {/* MOBILE: OCULTO (hidden) | DESKTOP: MOSTRADO (md:flex, md:order-2, col-5)   */}
        {/* ========================================================================= */}
        <section className={`hidden md:flex order-last md:order-2 md:col-span-5 border rounded-lg p-4 flex-col h-full min-h-0 transition-colors duration-300 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0e0e11] border-[#19191D]'
        }`}>
          
          {/* Header con Nombre del Mes en Mayúsculas */}
          <div className="flex items-center justify-between border-b pb-2 mb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <CalendarIcon size={14} className={isLight ? 'text-[#940028]' : 'text-red-400'} />
              <h2 className={`text-xs font-black tracking-widest font-mono uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {calendarData.currentMonthName} {calendarData.currentYear}
              </h2>
            </div>
            <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
              isLight ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
            }`}>
              {calendarData.monthEvents.length} EVENTOS EN EL MES
            </span>
          </div>

          {/* Días de la semana (Lunes a Domingo) */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] font-bold py-1.5 border-b mb-1.5 flex-shrink-0">
            {['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'].map(d => (
              <span key={d} className={isLight ? 'text-slate-600' : 'text-zinc-400'}>
                {d.slice(0, 3).toUpperCase()}
              </span>
            ))}
          </div>

          {/* Grilla de Celdas del Mes (35 celdas = 5 semanas x 7 días) */}
          <div className="grid grid-cols-7 grid-rows-5 gap-1.5 flex-grow min-h-0">
            {monthGrid.map((cell, idx) => {
              const hasEvents = cell.events && cell.events.length > 0;

              return (
                <div 
                  key={idx}
                  className={`relative p-1.5 rounded flex flex-col justify-between border transition-all overflow-hidden ${
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
                  <div className="flex justify-between items-center">
                    <span className={`text-[11px] font-mono font-bold leading-none ${
                      cell.isToday 
                        ? isLight ? 'text-[#940028] bg-white px-1 py-0.5 rounded shadow-2xs font-extrabold' : 'text-white bg-[#940028] px-1 py-0.5 rounded shadow-2xs' 
                        : cell.isCurrentMonth ? (isLight ? 'text-slate-700' : 'text-zinc-300') : (isLight ? 'text-slate-400' : 'text-zinc-600')
                    }`}>
                      {String(cell.day).padStart(2, '0')}
                    </span>

                    {cell.isToday && (
                      <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${
                        isLight ? 'text-[#940028]' : 'text-red-300'
                      }`}>
                        HOY
                      </span>
                    )}
                  </div>

                  {/* Pills / Eventos dentro del día */}
                  <div className="flex flex-col gap-0.5 mt-0.5 overflow-hidden">
                    {hasEvents ? (
                      cell.events.slice(0, 2).map((ev, evIdx) => (
                        <div 
                          key={evIdx}
                          onClick={() => setSelectedTicketModal(ev)}
                          title={`${ev.timeStr} ${ev.title}`}
                          className={`text-[9px] font-mono truncate px-1 py-0.5 rounded leading-tight border cursor-pointer ${
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
                      ))
                    ) : null}

                    {cell.events.length > 2 && (
                      <span className={`text-[8px] font-mono text-center font-bold ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                        +{cell.events.length - 2} más
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </section>
      </div>

      {/* ========================================================================= */}
      {/* BLOCK 4: ALMANAQUE FIJO (SOLICITUDES FIJAS SEMANAL)                       */}
      {/* MOBILE: 3ER LUGAR (order-3) con selector diario | DESKTOP: 5 columnas      */}
      {/* ========================================================================= */}
      <section className={`relative z-10 border rounded-lg p-3.5 flex flex-col md:h-[30%] md:min-h-[200px] transition-colors duration-300 order-3 md:order-4 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0e0e11] border-[#19191D]'
      }`}>

        {/* 1. DESKTOP VIEW: 5-Column Almanac Grid with AutoScroll */}
        <div className="hidden md:grid md:grid-cols-5 gap-3 flex-grow overflow-hidden">
          {['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'].map((day, idx) => {
            const dayEvents = getEventsForDay(day);

            return (
              <div 
                key={day} 
                className={`border rounded flex flex-col h-full overflow-hidden transition-colors ${
                  isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-zinc-950 border-[#19191D]'
                }`}
              >
                {/* Column header */}
                <div className={`border-b py-2 px-3 flex justify-between items-center flex-shrink-0 ${
                  isLight ? 'bg-slate-100 border-slate-200' : 'bg-zinc-900 border-[#19191D]'
                }`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider font-mono ${
                    isLight ? 'text-slate-800' : 'text-zinc-200'
                  }`}>{day}</span>
                  <span className={`text-[9px] font-mono ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                    0{day === 'Lunes' ? 1 : day === 'Martes' ? 2 : day === 'Miercoles' ? 3 : day === 'Jueves' ? 4 : 5}
                  </span>
                </div>

                {/* Column Events body with AutoScroll */}
                {dayEvents.length === 0 ? (
                  <div className={`text-[10px] font-mono text-center py-6 uppercase tracking-wider flex-grow flex items-center justify-center ${
                    isLight ? 'text-slate-400' : 'text-zinc-600'
                  }`}>
                    SIN EVENTOS
                  </div>
                ) : (
                  <DailyEventsList events={dayEvents} isLight={isLight} staggerMs={idx * 200} />
                )}
              </div>
            );
          })}
        </div>

        {/* 2. MOBILE VIEW: Daily View defaulting to today's day (e.g. Jueves) + Day Selector Tabs */}
        <div className="md:hidden flex flex-col gap-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className={`text-xs font-bold uppercase tracking-wider font-mono ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
              SOLICITUDES SEMANALES
            </h3>
            <span className="text-[10px] font-mono font-bold text-[#940028]">
              {selectedMobileDay.toUpperCase()}
            </span>
          </div>

          {/* Day Selector Pills */}
          <div className={`grid grid-cols-5 gap-1.5 p-1 rounded-lg border ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-zinc-950 border-zinc-800'
          }`}>
            {['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'].map(d => {
              const isSelected = selectedMobileDay.toLowerCase() === d.toLowerCase();
              const isActualToday = currentDayName.toLowerCase() === d.toLowerCase();

              return (
                <button
                  key={d}
                  onClick={() => setSelectedMobileDay(d)}
                  className={`py-2 px-1 rounded text-center font-mono text-xs font-bold transition flex flex-col items-center gap-0.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#940028] text-white shadow-xs'
                      : isLight 
                        ? 'text-slate-600 hover:bg-slate-200/70' 
                        : 'text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  <span>{d.slice(0, 3).toUpperCase()}</span>
                  {isActualToday ? (
                    <span className={`text-[8px] font-extrabold uppercase ${isSelected ? 'text-red-200' : 'text-[#940028]'}`}>
                      • HOY
                    </span>
                  ) : (
                    <span className="text-[8px] opacity-0">•</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Cards for selected mobile day */}
          <div className="space-y-2 pt-1">
            {getEventsForDay(selectedMobileDay).length === 0 ? (
              <div className={`text-xs font-mono text-center py-8 uppercase tracking-wider rounded border border-dashed ${
                isLight ? 'border-slate-200 bg-slate-50/50 text-slate-400' : 'border-zinc-850 bg-zinc-950/40 text-zinc-600'
              }`}>
                SIN SOLICITUDES PARA EL {selectedMobileDay.toUpperCase()}
              </div>
            ) : (
              getEventsForDay(selectedMobileDay).map(evt => (
                <div 
                  key={evt.id} 
                  className={`p-3.5 rounded-lg border flex flex-col gap-1.5 shadow-xs ${
                    isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#141418] border-zinc-850 text-white'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-bold font-mono ${isLight ? 'text-[#940028]' : 'text-red-400'}`}>
                      {evt.time_range}
                    </span>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      isLight ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                    }`}>
                      {selectedMobileDay.toUpperCase()}
                    </span>
                  </div>
                  <h4 className={`text-sm font-bold leading-snug ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {evt.title}
                  </h4>
                  {evt.description && (
                    <p className={`text-xs leading-relaxed mt-0.5 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                      {evt.description}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </section>

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
                    HELPDESK OUTLOOK
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
                  ⏰ Horario de Armado
                </span>
                <span className={`text-sm font-bold font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {selectedTicketModal.timeStr} {selectedTicketModal.endTimeStr ? `- ${selectedTicketModal.endTimeStr}` : ''} hs
                </span>
              </div>
              <div>
                <span className={`text-[10px] font-mono uppercase block mb-0.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                  🎤 Inicio Real del Evento
                </span>
                <span className="text-sm font-bold font-mono text-amber-500">
                  {selectedTicketModal.aiAnalysis?.event_real_time || `${selectedTicketModal.timeStr} hs`}
                </span>
              </div>
            </div>

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
                        isLight ? 'bg-white text-slate-800 border-slate-200' : 'bg-zinc-900 text-zinc-100 border-zinc-700'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Full Message Body */}
            <div>
              <h4 className={`text-xs font-mono font-bold uppercase mb-2 ${isLight ? 'text-slate-600' : 'text-zinc-400'}`}>
                Mensaje Completo del Ticket:
              </h4>
              <div className={`p-4 rounded-lg border text-xs font-sans whitespace-pre-line leading-relaxed max-h-52 overflow-y-auto ${
                isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-zinc-950 border-zinc-900 text-zinc-200'
              }`}>
                {selectedTicketModal.description || 'Sin descripción adicional.'}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedTicketModal(null)}
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
