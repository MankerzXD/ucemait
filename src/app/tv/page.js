'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Clock, ShieldAlert, Cpu, Activity, Database, Flame, Wifi, Layers, CalendarRange } from 'lucide-react';

// --- HELPER COMPONENT: DailyEventsList with paused auto-scroll ---
function DailyEventsList({ events }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || events.length <= 4) {
      if (container) container.scrollTop = 0;
      return;
    }

    let animId;
    let scrollTopVal = 0;
    let state = 'PAUSE_TOP'; // PAUSE_TOP, SCROLLING, PAUSE_BOTTOM, RESETTING
    let timer = 0;

    function loop() {
      if (state === 'PAUSE_TOP') {
        timer += 1;
        if (timer >= 180) { // 3 seconds at 60fps
          state = 'SCROLLING';
          timer = 0;
        }
      } else if (state === 'SCROLLING') {
        scrollTopVal += 0.35; // slow scroll speed
        container.scrollTop = scrollTopVal;

        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 1) {
          state = 'PAUSE_BOTTOM';
          timer = 0;
        }
      } else if (state === 'PAUSE_BOTTOM') {
        timer += 1;
        if (timer >= 180) { // 3 seconds at 60fps
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

    // Stagger the initial start slightly depending on day events to avoid synchronized scrolling
    const startDelay = setTimeout(() => {
      animId = requestAnimationFrame(loop);
    }, Math.random() * 1000);

    return () => {
      clearTimeout(startDelay);
      cancelAnimationFrame(animId);
    };
  }, [events]);

  return (
    <div 
      ref={containerRef}
      className="flex-grow overflow-y-auto no-scrollbar p-2 space-y-1.5 h-full"
    >
      {events.map(evt => (
        <div key={evt.id} className="bg-zinc-900/80 border border-zinc-850 p-2 rounded flex flex-col gap-0.5 transition hover:border-zinc-700">
          <span className="text-[8px] font-bold text-red-400 font-mono">{evt.time_range}</span>
          <h4 className="text-[9.5px] font-bold text-zinc-100 truncate">{evt.title}</h4>
          {evt.description && (
            <p className="text-[8.5px] text-zinc-500 line-clamp-2 leading-tight">{evt.description}</p>
          )}
        </div>
      ))}
    </div>
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

  // 2. Latency timer oscillation
  useEffect(() => {
    const latencyInterval = setInterval(() => {
      const randomLat = Math.floor(Math.random() * 8) + 9;
      setLatency(`${randomLat}ms`);
    }, 4000);
    return () => clearInterval(latencyInterval);
  }, []);

  // 3. Database fetch & Realtime subscription
  useEffect(() => {
    async function initDashboard() {
      await fetchInitialData();
      
      // Supabase Real-time subscriber
      const channel = supabase
        .channel('dashboard-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'directives' }, fetchInitialData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'observations' }, fetchInitialData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'fixed_events' }, fetchInitialData)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    initDashboard();
  }, []);

  const fetchInitialData = async () => {
    try {
      const { data: dirs, error: errDirs } = await supabase.from('directives').select('*');
      if (errDirs) throw errDirs;
      if (dirs) setDirectives(dirs);

      const { data: obs, error: errObs } = await supabase.from('observations').select('*');
      if (errObs) throw errObs;
      if (obs) setObservations(obs);

      const { data: evts, error: errEvts } = await supabase.from('fixed_events').select('*');
      if (errEvts) throw errEvts;
      if (evts) setEvents(evts);
    } catch {
      // Fallback
      loadDemoData();
    }
  };

  const loadDemoData = () => {
    setDirectives(JSON.parse(localStorage.getItem('demo_directives') || '[]'));
    setObservations(JSON.parse(localStorage.getItem('demo_observations') || '[]'));
    setEvents(JSON.parse(localStorage.getItem('demo_events') || '[]'));
  };

  // 4. Listen to storage changes for cross-tab sync in Demo Mode
  useEffect(() => {
    const handleStorageChange = (e) => {
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

  // Helper to filter calendar events by day
  const getEventsForDay = (dayName) => {
    return events.filter(e => e.day_of_week.toLowerCase() === dayName.toLowerCase());
  };

  return (
    <main className="relative h-screen w-screen bg-[#09090b] text-zinc-100 flex flex-col p-6 gap-5 overflow-hidden select-none">

      {/* HEADER */}
      <header className="relative z-10 grid grid-cols-3 items-center border-b border-[#19191D] bg-[#0e0e11] px-6 py-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-3">
          {/* UCEMA Logo Design */}
          <img src="https://ucema.edu.ar/mailing/firmas-ucema/Firmas_Institucional/Firma_Institucional_Blanco/assets/img/LOGO.png" alt="UCEMA Logo" className="h-8 w-auto object-contain" />
          <div className="border-l border-[#19191D] pl-3">
            <h1 className="font-bold text-sm tracking-wider text-white">DASHBOARD UCEMA</h1>
            <p className="text-[10px] text-zinc-400">Soporte Técnico</p>
          </div>
        </div>

        <div></div>

        <div className="flex justify-end items-center gap-4">
          <div className="flex items-center gap-3 text-right">
            <span className="text-xs text-zinc-400 font-medium">{dateStr}</span>
            <span className="text-zinc-700">|</span>
            <span className="text-sm text-white font-semibold tracking-wider">{timeStr}</span>
          </div>
        </div>
      </header>

      {/* TOP PANELS: LEFT (DIRECTIVAS & OBSERVACIONES) & RIGHT (EMBEDDED HELPDESK CALENDAR) */}
      <div className="relative z-10 grid grid-cols-12 gap-4 flex-grow h-0 min-h-0">
        
        {/* LEFT COLUMN: SINGLE MODULE (DIRECTIVAS & OBSERVACIONES) */}
        <section className="col-span-5 bg-[#0e0e11] border border-[#19191D] rounded-lg p-5 flex flex-col gap-5 h-full min-h-0">
          
          {/* DIRECTIVAS HEADER */}
          <div className="flex justify-between items-center border-b border-[#19191D] pb-2">
            <h2 className="text-xs font-bold tracking-widest text-zinc-400 uppercase">DIRECTIVAS</h2>
            <span className="text-[9px] text-zinc-500 font-mono">HOY + MAÑANA</span>
          </div>

          {/* DIRECTIVAS GRID */}
          <div className="grid grid-cols-2 gap-4 flex-grow min-h-0 overflow-hidden">
            
            {/* HOY Column */}
            <div className="flex flex-col gap-2 h-full min-h-0">
              <div className="bg-[#141418] border border-[#19191D] px-3 py-1.5 rounded-md flex items-center gap-2 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                <span className="text-[11px] font-bold tracking-wide text-red-500">HOY</span>
              </div>
              
              <div className="flex-grow overflow-y-auto no-scrollbar space-y-1.5 pr-1">
                {FIXED_CLASSROOMS.map(classroom => {
                  const dir = findDirective(directivesHoy, classroom.dbName);
                  return (
                    <div key={classroom.dbName} className="flex justify-between items-start text-[10.5px] py-1 border-b border-zinc-900/60 last:border-0 min-h-[26px]">
                      <span className="text-zinc-500 font-bold uppercase tracking-wider w-20 flex-shrink-0">{classroom.displayName}</span>
                      <span className="text-zinc-300 font-medium text-right flex-grow leading-tight pl-2">{dir ? dir.requirements : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* MAÑANA Column */}
            <div className="flex flex-col gap-2 h-full min-h-0">
              <div className="bg-[#141418] border border-[#19191D] px-3 py-1.5 rounded-md flex items-center gap-2 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
                <span className="text-[11px] font-bold tracking-wide text-zinc-400">MAÑANA</span>
              </div>
              
              <div className="flex-grow overflow-y-auto no-scrollbar space-y-1.5 pr-1">
                {FIXED_CLASSROOMS.map(classroom => {
                  const dir = findDirective(directivesManana, classroom.dbName);
                  return (
                    <div key={classroom.dbName} className="flex justify-between items-start text-[10.5px] py-1 border-b border-zinc-900/60 last:border-0 min-h-[26px]">
                      <span className="text-zinc-500 font-bold uppercase tracking-wider w-20 flex-shrink-0">{classroom.displayName}</span>
                      <span className="text-zinc-300 font-medium text-right flex-grow leading-tight pl-2">{dir ? dir.requirements : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* OBSERVACIONES SECTION */}
          <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-[#19191D] flex-shrink-0">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold tracking-widest text-zinc-400 uppercase">OBSERVACIONES</h2>
              <span className="text-[9px] text-zinc-500 font-mono">ESTADO GENERAL</span>
            </div>

            {/* Chips Container */}
            <div className="overflow-y-auto no-scrollbar max-h-[85px] min-h-[45px]">
              {observations.length === 0 ? (
                <div className="text-[10px] text-zinc-600 font-mono py-2">
                  SIN OBSERVACIONES NI EVENTOS DE ALERTA
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {observations.map(obs => (
                    <div 
                      key={obs.id} 
                      className={`bg-[#141418] border px-2.5 py-1.5 rounded flex items-center gap-2 text-[10px] font-medium transition hover:bg-[#19191D]/40 ${
                        obs.severity === 'danger' 
                          ? 'border-red-955 text-red-400 bg-red-950/5' 
                          : obs.severity === 'warning' 
                            ? 'border-amber-955 text-amber-400 bg-amber-950/5' 
                            : 'border-[#19191D] text-zinc-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        obs.severity === 'danger' ? 'bg-red-500 animate-pulse' : obs.severity === 'warning' ? 'bg-amber-500' : 'bg-zinc-400'
                      }`}></span>
                      <span className="leading-snug">{obs.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </section>

        {/* RIGHT COLUMN: CALENDARIO HELPDESK EMBEBIDO (100% del espacio del div) */}
        <section className="col-span-7 bg-white border border-[#19191D] rounded-lg flex flex-col h-full min-h-0 overflow-hidden">
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

      {/* BOTTOM PANEL: ALMANAQUE FIJO (SOLICITUDES FIJAS SEMANAL) - Mayor Altura */}
      <section className="relative z-10 bg-[#0e0e11] border border-[#19191D] rounded-lg p-5 flex flex-col h-[38%] min-h-[260px]">

        {/* 5-Column Almanac Grid */}
        <div className="grid grid-cols-5 gap-3 flex-grow overflow-hidden">
          {['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'].map((day) => {
            const dayEvents = getEventsForDay(day);

            return (
              <div key={day} className="bg-zinc-950 border border-[#19191D] rounded flex flex-col h-full overflow-hidden">
                {/* Column header */}
                <div className="bg-zinc-900 border-b border-[#19191D] py-1.5 px-3 flex justify-between items-center flex-shrink-0">
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-300 font-mono">{day}</span>
                  <span className="text-[8px] text-zinc-600 font-mono">0{day === 'Lunes' ? 1 : day === 'Martes' ? 2 : day === 'Miercoles' ? 3 : day === 'Jueves' ? 4 : 5}</span>
                </div>

                {/* Column Events body */}
                {dayEvents.length === 0 ? (
                  <div className="text-[8px] text-zinc-700 font-mono text-center py-6 uppercase tracking-wider flex-grow flex items-center justify-center">
                    SIN EVENTOS
                  </div>
                ) : (
                  <DailyEventsList events={dayEvents} />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
