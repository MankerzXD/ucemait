'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Clock, ShieldAlert, Cpu, Activity, Database, Flame, Wifi, Layers, CalendarRange, Bell, X } from 'lucide-react';

// --- HELPER COMPONENT: DailyEventsList with paused auto-scroll ---
// --- HELPER COMPONENT: AutoScrollBox for TV lists and modals ---
function AutoScrollBox({ children, className, dependencies = [], speed = 0.35, pauseFrames = 120, staggerMs = 0 }) {
  const containerRef = useRef(null);
  const isHoveredRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId;
    let scrollTopVal = 0;
    let state = 'INIT';
    let timer = 0;

    const startTimer = setTimeout(() => {
      if (!container) return;
      if (container.scrollHeight <= container.clientHeight + 4) {
        container.scrollTop = 0;
        return;
      }
      state = 'PAUSE_TOP';
      timer = 0;
      scrollTopVal = 0;
      container.scrollTop = 0;
      animId = requestAnimationFrame(loop);
    }, 400 + staggerMs);

    function loop() {
      if (!container) return;

      if (isHoveredRef.current) {
        animId = requestAnimationFrame(loop);
        return;
      }

      if (container.scrollHeight <= container.clientHeight + 4) {
        container.scrollTop = 0;
        return;
      }

      if (state === 'PAUSE_TOP') {
        timer += 1;
        if (timer >= pauseFrames) {
          state = 'SCROLLING';
          timer = 0;
        }
      } else if (state === 'SCROLLING') {
        scrollTopVal += speed;
        container.scrollTop = scrollTopVal;

        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 2) {
          state = 'PAUSE_BOTTOM';
          timer = 0;
        }
      } else if (state === 'PAUSE_BOTTOM') {
        timer += 1;
        if (timer >= pauseFrames) {
          state = 'RESETTING';
          timer = 0;
        }
      } else if (state === 'RESETTING') {
        // Smooth return to top
        scrollTopVal = Math.max(0, scrollTopVal - speed * 4);
        container.scrollTop = scrollTopVal;

        if (scrollTopVal <= 0) {
          scrollTopVal = 0;
          container.scrollTop = 0;
          state = 'PAUSE_TOP';
          timer = 0;
        }
      }

      animId = requestAnimationFrame(loop);
    }

    return () => {
      clearTimeout(startTimer);
      if (animId) cancelAnimationFrame(animId);
    };
  }, dependencies);

  return (
    <div 
      ref={containerRef} 
      className={className}
      onMouseEnter={() => { isHoveredRef.current = true; }}
      onMouseLeave={() => { isHoveredRef.current = false; }}
    >
      {children}
    </div>
  );
}

// --- HELPER COMPONENT: DailyEventsList using AutoScrollBox ---
function DailyEventsList({ events, isLight }) {
  return (
    <AutoScrollBox 
      className="flex-grow overflow-y-auto no-scrollbar p-2.5 space-y-2 h-full"
      dependencies={[events]}
      speed={0.35}
      pauseFrames={120}
      staggerMs={Math.random() * 800}
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

// --- HELPER COMPONENT: MockCalendarTimeline with auto-scroll ---
function MockCalendarTimeline() {
  const containerRef = useRef(null);
  
  const events = [
    { id: 1, time: '08:30', type: 'RED', title: 'Diagnóstico de fibra óptica bloque oeste', category: 'Infraestructura', tech: 'M. Sanchez', status: 'completed', statusLabel: 'COMPLETADO' },
    { id: 2, time: '10:00', type: 'SOPORTE', title: 'Instalación de cables HDMI en Aula 3D', category: 'Hardware', tech: 'J. Garcia', status: 'active', statusLabel: 'EN CURSO' },
    { id: 3, time: '12:00', type: 'REUNIÓN', title: 'Reunión semanal Soporte IT - UCEMA', category: 'Coordinación', tech: 'Todo el Equipo', status: 'pending', statusLabel: 'PENDIENTE' },
    { id: 4, time: '14:00', type: 'SERVIDORES', title: 'Migración y Backup DNS Interno', category: 'Sistemas', tech: 'M. Sanchez', status: 'pending', statusLabel: 'PENDIENTE' },
    { id: 5, time: '15:30', type: 'DISPOSITIVOS', title: 'Testeo de tablets y Chromebooks Lab Movil 2', category: 'Inventario', tech: 'A. Garcia', status: 'pending', statusLabel: 'PENDIENTE' },
    { id: 6, time: '17:00', type: 'RED', title: 'Mantenimiento preventivo Access Point Aula 4D', category: 'Conectividad', tech: 'Support IT', status: 'pending', statusLabel: 'PENDIENTE' }
  ];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId;
    let scrollTopVal = 0;
    let state = 'PAUSE_TOP';
    let timer = 0;

    function loop() {
      if (state === 'PAUSE_TOP') {
        timer += 1;
        if (timer >= 240) { // 4 seconds
          state = 'SCROLLING';
          timer = 0;
        }
      } else if (state === 'SCROLLING') {
        scrollTopVal += 0.35;
        container.scrollTop = scrollTopVal;

        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 1) {
          state = 'PAUSE_BOTTOM';
          timer = 0;
        }
      } else if (state === 'PAUSE_BOTTOM') {
        timer += 1;
        if (timer >= 240) { // 4 seconds
          state = 'RESETTING';
          timer = 0;
        }
      } else if (state === 'RESETTING') {
        scrollTopVal = 0;
        container.scrollTop = 0;
        state = 'PAUSE_TOP';
      }

      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="w-full h-full flex flex-col p-4 bg-zinc-950/40">
      <div className="flex items-center justify-between mb-3 text-[10px] text-zinc-500 font-mono border-b border-zinc-900 pb-2">
        <span>TICKETS & TAREAS HOY</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          ACTIVO
        </span>
      </div>

      <div ref={containerRef} className="flex-grow overflow-y-auto no-scrollbar space-y-3 pr-1">
        {events.map((evt) => (
          <div key={evt.id} className="relative bg-[#141418] border border-zinc-850 p-3.5 rounded-lg flex flex-col gap-2 transition hover:bg-zinc-900/40">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-400 font-mono bg-zinc-900 px-2 py-0.5 rounded">
                  {evt.time}
                </span>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono ${
                  evt.type === 'RED' ? 'bg-[#1e1b4b] text-[#c7d2fe] border border-[#312e81]' :
                  evt.type === 'SOPORTE' ? 'bg-[#064e3b] text-[#a7f3d0] border border-[#065f46]' :
                  evt.type === 'SERVIDORES' ? 'bg-[#7f1d1d] text-[#fca5a5] border border-[#991b1b]' :
                  evt.type === 'REUNIÓN' ? 'bg-[#78350f] text-[#fde68a] border border-[#92400e]' :
                  'bg-zinc-850 text-zinc-400 border border-zinc-800'
                }`}>
                  {evt.type}
                </span>
              </div>

              <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full ${
                evt.status === 'completed' ? 'text-zinc-500 bg-zinc-900/40 border border-zinc-800' :
                evt.status === 'active' ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-900' :
                'text-amber-400 bg-amber-950/40 border border-amber-900'
              }`}>
                {evt.statusLabel}
              </span>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-zinc-100 leading-snug">{evt.title}</h3>
              <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                <span>Ref: <span className="text-zinc-300">{evt.category}</span></span>
                <span>Asignado: <span className="text-zinc-300">{evt.tech}</span></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
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

const findDirective = (list, dbName) => {
  if (!list) return null;
  return list.find(d => d.classroom.toLowerCase().replace(/\s+/g, '') === dbName.toLowerCase().replace(/\s+/g, ''));
};

export default function TvDashboardPage() {
  // Theme state ('dark' | 'light' / 'white')
  const [tvTheme, setTvTheme] = useState('dark');
  const isLight = tvTheme === 'light' || tvTheme === 'white';

  // Clock state
  const [timeStr, setTimeStr] = useState('19:57:42');
  const [dateStr, setDateStr] = useState('27 MAY 2026');
  const [latency, setLatency] = useState('12ms');

  // Database lists
  const [directives, setDirectives] = useState([]);
  const [observations, setObservations] = useState([]);
  const [events, setEvents] = useState([]);

  // 1. Clock timer
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
      
      // Capitalized date
      setDateStr(`${day} ${month} ${year}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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

          // Trigger if between -10 min and +15 min
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

      // 2. Calendar Events check (Lunes a Viernes)
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

          // Trigger if between -10 min and +15 min
          if (diffMin >= -10 && diffMin <= 15) {
            const timeStr = `${String(targetH).padStart(2, '0')}:${String(targetM).padStart(2, '0')}`;
            const key = `evt_${evt.id}_${todayStr}_${timeStr}`;
            if (!alertedDirectivesRef.current.has(key)) {
              due.push({
                id: `evt_${evt.id}`,
                dedupKey: key,
                sourceType: 'evento',
                badge: 'EVENTO',
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
  }, [directives, events]);

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

  // 3. Database fetch & Realtime subscription
  useEffect(() => {
    let channel;

    async function initDashboard() {
      await fetchInitialData();
      
      // Supabase Real-time subscriber - INSTANT MIRROR
      channel = supabase
        .channel('dashboard-tv-live')
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
        .subscribe((status) => {
          console.log('TV Realtime mirror status:', status);
        });
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

      const { data: dirs, error: errDirs } = await supabase.from('directives').select('*').order('created_at', { ascending: false });
      if (errDirs) throw errDirs;
      if (dirs) setDirectives(dirs);

      const { data: obs, error: errObs } = await supabase.from('observations').select('*').order('created_at', { ascending: false });
      if (errObs) throw errObs;
      if (obs) setObservations(obs);

      const { data: evts, error: errEvts } = await supabase.from('fixed_events').select('*').order('created_at', { ascending: false });
      if (errEvts) throw errEvts;
      if (evts) setEvents(evts);
    } catch (err) {
      console.error('Error fetching TV data:', err);
      // Fallback
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

  // 4. Listen to storage changes for cross-tab sync in Demo Mode
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

  // Helper to get active directives with actual content (only show if has information)
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

  // Helper to filter calendar events by day
  const getEventsForDay = (dayName) => {
    return events.filter(e => e.day_of_week.toLowerCase() === dayName.toLowerCase());
  };

  return (
    <main className={`relative h-screen w-screen flex flex-col p-6 gap-5 overflow-hidden select-none transition-colors duration-500 ${isLight ? 'bg-[#f1f5f9] text-slate-900' : 'bg-[#09090b] text-zinc-100'}`}>

      {/* HEADER */}
      <header className={`relative z-10 grid grid-cols-3 items-center border-b px-6 py-4 rounded-lg shadow-sm transition-colors duration-300 ${
        isLight 
          ? 'bg-white border-[#940028]/30 shadow-[#940028]/5' 
          : 'bg-[#0e0e11] border-[#940028]/40 shadow-[#940028]/10'
      }`}>
        <div className="flex items-center gap-3">
          {/* UCEMA Logo Design */}
          <img 
            src="/ucema-logo.png" 
            alt="UCEMA Logo" 
            className="h-9 w-auto rounded object-contain shadow-xs" 
            onError={(e) => {
              e.currentTarget.src = "https://ucema.edu.ar/mailing/firmas-ucema/Firmas_Institucional/Firma_Institucional_Blanco/assets/img/LOGO.png";
            }}
          />
          <div className={`border-l pl-3 ${isLight ? 'border-slate-300' : 'border-[#19191D]'}`}>
            <h1 className={`font-bold text-sm tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>DASHBOARD UCEMA</h1>
            <p className={`text-[10px] ${isLight ? 'text-[#940028] font-bold' : 'text-zinc-400'}`}>Soporte Técnico</p>
          </div>
        </div>

        <div></div>

        <div className="flex justify-end items-center gap-4">
          <div className="flex items-center gap-3 text-right">
            <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>{dateStr}</span>
            <span className={isLight ? 'text-slate-300' : 'text-zinc-700'}>|</span>
            <span className={`text-sm tracking-wider ${isLight ? 'text-slate-900 font-bold' : 'text-white font-semibold'}`}>{timeStr}</span>
          </div>
        </div>
      </header>

      {/* TOP PANELS: LEFT (DIRECTIVAS & OBSERVACIONES) & RIGHT (EMBEDDED HELPDESK CALENDAR) */}
      <div className="relative z-10 grid grid-cols-12 gap-4 flex-grow h-0 min-h-0">
        
        {/* LEFT COLUMN: SINGLE MODULE (DIRECTIVAS 50% & OBSERVACIONES 50%) */}
        <section className={`col-span-5 border rounded-lg p-5 flex flex-col gap-4 h-full min-h-0 transition-colors duration-300 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0e0e11] border-[#19191D]'
        }`}>
          
          {/* TOP HALF: DIRECTIVAS (50% de alto) */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className={`flex justify-between items-center border-b pb-2 mb-2 flex-shrink-0 ${isLight ? 'border-slate-200' : 'border-[#19191D]'}`}>
              <h2 className={`text-xs font-bold tracking-widest uppercase ${isLight ? 'text-[#940028]' : 'text-zinc-400'}`}>DIRECTIVAS</h2>
              <span className={`text-[9px] font-mono ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>HOY + MAÑANA</span>
            </div>

            {/* DIRECTIVAS GRID (HOY & MAÑANA) */}
            <div className="grid grid-cols-2 gap-3 flex-grow min-h-0 overflow-hidden">
              
              {/* HOY Column */}
              <div className="flex flex-col gap-2 h-full min-h-0">
                <div className={`px-3 py-1.5 rounded-md flex items-center gap-2 flex-shrink-0 border ${
                  isLight ? 'bg-[#940028]/10 border-[#940028]/30' : 'bg-[#141418] border-[#940028]/50'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-[#940028]"></span>
                  <span className={`text-[11px] font-bold tracking-wide ${isLight ? 'text-[#940028]' : 'text-[#f1a3b3]'}`}>HOY</span>
                </div>
                
                <AutoScrollBox 
                  className="flex-grow overflow-y-auto no-scrollbar space-y-2 pr-1"
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
                        className={`border p-2.5 rounded flex flex-col gap-1 transition shadow-xs ${
                          isLight 
                            ? 'bg-slate-50 border-slate-200 hover:border-[#940028]/40' 
                            : 'bg-[#141418] border-zinc-850'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`font-bold uppercase tracking-wider text-[11px] font-mono ${
                            isLight ? 'text-[#940028]' : 'text-[#f1a3b3]'
                          }`}>{item.displayName}</span>
                          {item.time && (
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
                              isLight 
                                ? 'bg-[#940028] text-white border border-[#7d0022]' 
                                : 'bg-[#4d0015] border border-[#7d0022] text-[#f8ccd5]'
                            }`}>
                              <Clock size={10} /> {item.time} hs
                            </span>
                          )}
                        </div>
                        <p className={`text-xs font-medium leading-snug ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                          {item.requirements}
                        </p>
                      </div>
                    ))
                  )}
                </AutoScrollBox>
              </div>

              {/* MAÑANA Column */}
              <div className="flex flex-col gap-2 h-full min-h-0">
                <div className={`px-3 py-1.5 rounded-md flex items-center gap-2 flex-shrink-0 border ${
                  isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#141418] border-[#19191D]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-slate-400' : 'bg-zinc-500'}`}></span>
                  <span className={`text-[11px] font-bold tracking-wide ${isLight ? 'text-slate-700' : 'text-zinc-400'}`}>MAÑANA</span>
                </div>
                
                <AutoScrollBox 
                  className="flex-grow overflow-y-auto no-scrollbar space-y-2 pr-1"
                  dependencies={[activeDirectivesManana]}
                  speed={0.35}
                  pauseFrames={140}
                  staggerMs={400}
                >
                  {activeDirectivesManana.length === 0 ? (
                    <div className={`h-full flex items-center justify-center text-[10px] font-mono text-center py-4 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
                      SIN DIRECTIVAS ACTIVAS
                    </div>
                  ) : (
                    activeDirectivesManana.map(item => (
                      <div 
                        key={item.id} 
                        className={`border p-2.5 rounded flex flex-col gap-1 transition shadow-xs ${
                          isLight 
                            ? 'bg-slate-50 border-slate-200' 
                            : 'bg-[#141418] border-zinc-850'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`font-bold uppercase tracking-wider text-[11px] font-mono ${
                            isLight ? 'text-slate-700' : 'text-zinc-400'
                          }`}>{item.displayName}</span>
                          {item.time && (
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1 ${
                              isLight 
                                ? 'bg-slate-200 text-slate-800 border border-slate-300' 
                                : 'bg-zinc-900 border border-zinc-700 text-zinc-300'
                            }`}>
                              <Clock size={10} /> {item.time} hs
                            </span>
                          )}
                        </div>
                        <p className={`text-xs font-medium leading-snug ${isLight ? 'text-slate-800' : 'text-zinc-200'}`}>
                          {item.requirements}
                        </p>
                      </div>
                    ))
                  )}
                </AutoScrollBox>
              </div>

            </div>
          </div>

          {/* BOTTOM HALF: OBSERVACIONES (50% de alto) */}
          <div className={`flex-1 min-h-0 flex flex-col border-t pt-3 ${isLight ? 'border-slate-200' : 'border-[#19191D]'}`}>
            <div className="flex justify-between items-center pb-2 mb-2 flex-shrink-0">
              <h2 className={`text-xs font-bold tracking-widest uppercase ${isLight ? 'text-[#940028]' : 'text-zinc-400'}`}>OBSERVACIONES</h2>
              <span className={`text-[9px] font-mono ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>ESTADO GENERAL</span>
            </div>

            {/* Chips / Cards Container - Ocupa todo el alto de su 50% con auto-scroll */}
            <AutoScrollBox 
              className="overflow-y-auto no-scrollbar flex-grow min-h-0 pr-1"
              dependencies={[observations]}
              speed={0.3}
              pauseFrames={150}
            >
              {observations.length === 0 ? (
                <div className={`h-full flex items-center justify-center text-[11px] font-mono gap-2 py-4 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
                  <span className={`w-2 h-2 rounded-full ${isLight ? 'bg-slate-300' : 'bg-zinc-700'}`}></span>
                  SIN OBSERVACIONES NI EVENTOS DE ALERTA
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5 content-start">
                  {observations.map(obs => (
                    <div 
                      key={obs.id} 
                      className={`border px-3 py-2 rounded-md flex items-center gap-2.5 text-[11px] font-medium transition ${
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
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
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

        {/* RIGHT COLUMN: CALENDARIO HELPDESK EMBEBIDO (100% del espacio del div) */}
        <section className={`col-span-7 bg-white border rounded-lg flex flex-col h-full min-h-0 overflow-hidden ${
          isLight ? 'border-slate-200 shadow-sm' : 'border-[#19191D]'
        }`}>
          <div className="flex-grow w-full h-full bg-white relative overflow-hidden">
            <iframe 
              src={process.env.NEXT_PUBLIC_HELPDESK_CALENDAR_URL || "https://outlook.office365.com/owa/calendar/433a34896a4545739e21cff1bd39ac26@ucema.edu.ar/2d9d26876dd440a3a4d723c6fe0b29175286550549318340919/calendar.html"} 
              className="absolute border-0 bg-white"
              style={{
                top: '-72px',
                left: '-44px',
                width: 'calc(100% + 108px)',
                height: 'calc(100% + 90px)'
              }}
              scrolling="no"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
        </section>
      </div>

      {/* BOTTOM PANEL: ALMANAQUE FIJO (SOLICITUDES FIJAS SEMANAL) - 20% más bajo */}
      <section className={`relative z-10 border rounded-lg p-3.5 flex flex-col h-[30%] min-h-[200px] transition-colors duration-300 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0e0e11] border-[#19191D]'
      }`}>

        {/* 5-Column Almanac Grid */}
        <div className="grid grid-cols-5 gap-3 flex-grow overflow-hidden">
          {['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'].map((day) => {
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

                {/* Column Events body */}
                {dayEvents.length === 0 ? (
                  <div className={`text-[10px] font-mono text-center py-6 uppercase tracking-wider flex-grow flex items-center justify-center ${
                    isLight ? 'text-slate-400' : 'text-zinc-600'
                  }`}>
                    SIN EVENTOS
                  </div>
                ) : (
                  <DailyEventsList events={dayEvents} isLight={isLight} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* MODAL EN PANTALLA DE TV: NOTIFICACIÓN DE TAREAS PRÓXIMAS (< 15 MIN) */}
      {showAlertModal && upcomingAlertTasks.length > 0 && (
        <div 
          onClick={() => setShowAlertModal(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-300"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0e0e11] border-2 border-red-600 rounded-2xl shadow-2xl shadow-red-950/80 max-w-2xl w-full overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200"
          >
            {/* Header con alarma */}
            <div className="bg-red-950/60 border-b border-red-900/70 p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-600 text-white rounded-xl shadow-lg shadow-red-600/40 animate-bounce">
                  <Bell size={26} />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white tracking-wider flex items-center gap-3 font-mono">
                    ALERTA: TAREA INMINENTE
                    <span className="text-xs bg-red-600/40 text-red-200 border border-red-500/50 px-2.5 py-0.5 rounded font-mono">
                      &lt; 15 MINUTOS
                    </span>
                  </h3>
                  <p className="text-xs text-red-200/90 font-medium">Requerimiento técnico programado en breve para el equipo de soporte</p>
                </div>
              </div>

              <button 
                onClick={() => setShowAlertModal(false)}
                className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
                title="Cerrar modal"
              >
                <X size={22} />
              </button>
            </div>

            {/* Listado de tareas próximas con AutoScroll */}
            <AutoScrollBox 
              className="p-6 space-y-4 max-h-[65vh] overflow-y-auto no-scrollbar"
              dependencies={[upcomingAlertTasks]}
              speed={0.45}
              pauseFrames={120}
            >
              {upcomingAlertTasks.map((task) => (
                <div 
                  key={task.id}
                  className="bg-[#141418] border-2 border-red-900/50 p-5 rounded-xl flex flex-col gap-2.5 relative overflow-hidden shadow-md"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-xs font-mono px-2.5 py-1 rounded font-bold uppercase ${
                        task.sourceType === 'evento' 
                          ? 'bg-amber-950/80 border border-amber-800 text-amber-300' 
                          : 'bg-[#940028]/60 border border-[#940028] text-white'
                      }`}>
                        {task.badge || (task.classroom ? 'DIRECTIVA' : 'EVENTO')}
                      </span>
                      <span className="font-black text-red-400 font-mono text-base tracking-wider uppercase">
                        {task.title || (task.classroom ? `AULA ${task.classroom}` : '')}
                      </span>
                      <span className="text-xs font-mono font-bold bg-red-950 border border-red-800 text-red-200 px-2.5 py-1 rounded flex items-center gap-1.5">
                        <Clock size={13} /> {task.time || task.directive_time} hs
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-amber-400 font-mono bg-amber-950/40 border border-amber-900/60 px-3 py-0.5 rounded-full animate-pulse">
                      {task.diffMinutes > 0 ? `Faltan ${task.diffMinutes} min` : task.diffMinutes === 0 ? '¡COMIENZA AHORA!' : 'En curso'}
                    </span>
                  </div>

                  <p className="text-zinc-100 text-sm font-semibold leading-relaxed bg-zinc-950/80 p-3.5 rounded-lg border border-zinc-900">
                    {task.text || task.requirements}
                  </p>

                  <div className="flex justify-between items-center text-[11px] text-zinc-500 font-mono pt-1">
                    <span>{task.subtitle || `Fecha: ${task.directive_date}`}</span>
                    {(task.creator || task.created_by_email) && (
                      <span>Registrado por: {task.creator || task.created_by_email}</span>
                    )}
                  </div>
                </div>
              ))}
            </AutoScrollBox>

            {/* Footer con cuenta regresiva de 50 segundos */}
            <div className="bg-zinc-950 border-t border-zinc-900 p-4 px-6 flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-mono flex items-center gap-2">
                <Clock size={14} className="text-red-400" />
                Cierre automático en <strong className="text-white font-bold">{alertCountdown}s</strong> (o haz clic afuera)
              </span>

              <button
                onClick={() => setShowAlertModal(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold px-5 py-2 rounded-lg transition cursor-pointer font-mono"
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
