'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Clock, ShieldAlert, Cpu, Activity, Database, Flame, Wifi, Layers, CalendarRange } from 'lucide-react';

export default function TvDashboardPage() {
  // Clock state
  const [timeStr, setTimeStr] = useState('19:57:42');
  const [dateStr, setDateStr] = useState('27 MAY 2026');
  const [latency, setLatency] = useState('12ms');

  // Database lists
  const [directives, setDirectives] = useState([]);
  const [observations, setObservations] = useState([]);
  const [events, setEvents] = useState([]);

  // Auto-scroll ref
  const scrollContainerRef = useRef(null);

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

  // 5. Auto-Scroll observations if count > 5
  useEffect(() => {
    const scroller = scrollContainerRef.current;
    if (!scroller) return;

    let animId;
    let scrollTopVal = 0;
    const speed = 0.45; // scroll speed per frame

    function animScroll() {
      if (observations.length > 5) {
        scrollTopVal += speed;
        scroller.scrollTop = scrollTopVal;

        if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) {
          scrollTopVal = 0;
          scroller.scrollTop = 0;
        }
      }
      animId = requestAnimationFrame(animScroll);
    }

    // Delay scroll start to allow render/read
    const delay = setTimeout(() => {
      animId = requestAnimationFrame(animScroll);
    }, 2000);

    return () => {
      clearTimeout(delay);
      cancelAnimationFrame(animId);
    };
  }, [observations]);

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
      <header className="relative z-10 grid grid-cols-3 items-center border-b border-zinc-800 bg-[#0e0e11] px-6 py-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-3">
          {/* UCEMA Logo Design */}
          <img src="https://ucema.edu.ar/mailing/firmas-ucema/Firmas_Institucional/Firma_Institucional_Blanco/assets/img/LOGO.png" alt="UCEMA Logo" className="h-8 w-auto object-contain" />
          <div className="border-l border-zinc-800 pl-3">
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

      {/* TOP PANELS: DIRECTIVAS & OBSERVACIONES */}
      <div className="relative z-10 grid grid-cols-3 gap-4 flex-grow h-0 min-h-0">
        
        {/* LEFT & CENTER: DIRECTIVAS */}
        <section className="col-span-2 bg-[#0e0e11] border border-zinc-850 rounded-lg p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h2 className="text-xs font-bold tracking-widest text-zinc-200 uppercase">DIRECTIVAS</h2>
            <div className="h-px bg-zinc-800 flex-grow mx-4"></div>
            <span className="text-[9px] text-zinc-500 font-mono">HOY + MAÑANA</span>
          </div>

          <div className="grid grid-cols-2 gap-4 flex-grow overflow-hidden">
            {/* HOY Column */}
            <div className="flex flex-col gap-2 h-full">
              <div className="bg-[#141418] border border-zinc-800 px-3 py-1.5 rounded-md flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                <span className="text-[11px] font-bold tracking-wide text-red-500">HOY</span>
              </div>
              <div className="flex-grow overflow-y-auto no-scrollbar space-y-2.5">
                {directivesHoy.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 p-6 text-center border border-dashed border-zinc-800 rounded-md">
                    Sin directivas cargadas para hoy.
                  </div>
                ) : (
                  directivesHoy.map(dir => (
                    <div key={dir.id} className="bg-[#141418] border border-zinc-850 border-l-2 border-l-red-600 p-3.5 rounded-md transition hover:bg-zinc-900/10">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-bold text-white tracking-wide">{dir.classroom}</span>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">{dir.requirements}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* MAÑANA Column */}
            <div className="flex flex-col gap-2 h-full">
              <div className="bg-[#141418] border border-zinc-800 px-3 py-1.5 rounded-md flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
                <span className="text-[11px] font-bold tracking-wide text-zinc-400">MAÑANA</span>
              </div>
              <div className="flex-grow overflow-y-auto no-scrollbar space-y-2.5">
                {directivesManana.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 p-6 text-center border border-dashed border-zinc-800 rounded-md">
                    Sin directivas cargadas para mañana.
                  </div>
                ) : (
                  directivesManana.map(dir => (
                    <div key={dir.id} className="bg-[#141418] border border-zinc-850 border-l-2 border-l-zinc-600 p-3.5 rounded-md transition hover:bg-zinc-900/10">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-bold text-white tracking-wide">{dir.classroom}</span>
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">{dir.requirements}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT: OBSERVACIONES */}
        <section className="bg-[#0e0e11] border border-zinc-850 rounded-lg p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
            <h2 className="text-xs font-bold tracking-widest text-zinc-200 uppercase">OBSERVACIONES</h2>
            {observations.length > 5 && (
              <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider animate-pulse-slow">Autoscroll</span>
            )}
          </div>

          {/* Scrolling Feed Container */}
          <div className="flex-grow overflow-hidden relative border border-zinc-850 bg-zinc-950/65 rounded">
            <div 
              ref={scrollContainerRef}
              className="absolute inset-0 overflow-y-auto no-scrollbar p-2.5 space-y-2.5"
            >
              {observations.length === 0 ? (
                <div className="text-[10px] text-zinc-600 font-mono py-12 text-center">
                  SIN OBSERVACIONES NI EVENTOS DE ALERTA
                </div>
              ) : (
                observations.map(obs => (
                  <div 
                    key={obs.id} 
                    className={`bg-zinc-900 border border-zinc-850 p-2.5 rounded flex gap-2.5 transition hover:border-zinc-700 ${
                      obs.severity === 'danger' ? 'border-l-2 border-l-red-600 bg-red-950/5' : obs.severity === 'warning' ? 'border-l-2 border-l-amber-500 bg-amber-950/5' : 'border-l-2 border-l-zinc-500'
                    }`}
                  >
                    <div className="flex-grow">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-[9px] font-bold uppercase ${
                          obs.severity === 'danger' ? 'text-red-500' : obs.severity === 'warning' ? 'text-amber-500' : 'text-zinc-400'
                        }`}>{obs.severity === 'danger' ? 'ALERTA CRÍTICA' : obs.severity === 'warning' ? 'ADVERTENCIA' : 'INFO'}</span>
                      </div>
                      <p className="text-[10px] text-zinc-200 leading-snug">{obs.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      {/* BOTTOM PANEL: ALMANAQUE FIJO */}
      <section className="relative z-10 bg-[#0e0e11] border border-zinc-850 rounded-lg p-5 flex flex-col gap-4 h-[32%] min-h-[220px]">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <h2 className="text-xs font-bold tracking-widest text-zinc-200 uppercase">SOLICITUDES FIJAS SEMANAL</h2>
          <span className="text-[10px] text-zinc-400 font-medium">Lunes a Viernes</span>
        </div>

        {/* 5-Column Almanac Grid */}
        <div className="grid grid-cols-5 gap-3 flex-grow overflow-hidden">
          {['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'].map((day) => {
            const dayEvents = getEventsForDay(day);

            return (
              <div key={day} className="bg-zinc-950 border border-zinc-850 rounded flex flex-col h-full overflow-hidden">
                {/* Column header */}
                <div className="bg-zinc-900 border-b border-zinc-850 py-1.5 px-3 flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-wider text-zinc-300 font-mono">{day}</span>
                  <span className="text-[8px] text-zinc-600 font-mono">0{day === 'Lunes' ? 1 : day === 'Martes' ? 2 : day === 'Miercoles' ? 3 : day === 'Jueves' ? 4 : 5}</span>
                </div>

                {/* Column Events body */}
                <div className="flex-grow overflow-y-auto no-scrollbar p-2 space-y-1.5">
                  {dayEvents.length === 0 ? (
                    <div className="text-[8px] text-zinc-700 font-mono text-center py-6 uppercase tracking-wider">
                      SIN EVENTOS
                    </div>
                  ) : (
                    dayEvents.map(evt => (
                      <div key={evt.id} className="bg-zinc-900/80 border border-zinc-800 p-2 rounded flex flex-col gap-0.5">
                        <span className="text-[8px] font-bold text-red-400 font-mono">{evt.time_range}</span>
                        <h4 className="text-[9.5px] font-bold text-zinc-100 truncate">{evt.title}</h4>
                        {evt.description && (
                          <p className="text-[8.5px] text-zinc-500 line-clamp-2 leading-tight">{evt.description}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
