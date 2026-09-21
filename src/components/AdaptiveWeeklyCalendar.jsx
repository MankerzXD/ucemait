'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, Calendar as CalendarIcon } from 'lucide-react';

const WEEK_DAYS = [
  { name: 'Lunes', code: '01', short: 'LUN', jsDay: 1 },
  { name: 'Martes', code: '02', short: 'MAR', jsDay: 2 },
  { name: 'Miercoles', code: '03', short: 'MIE', jsDay: 3 },
  { name: 'Jueves', code: '04', short: 'JUE', jsDay: 4 },
  { name: 'Viernes', code: '05', short: 'VIE', jsDay: 5 }
];

// Helper: AutoScrollBox for smooth vertical scrolling without cutting off items
function AutoScrollBox({ 
  children, 
  className, 
  dependencies = [], 
  speed = 0.35, 
  pauseFrames = 150, 
  staggerMs = 0 
}) {
  const containerRef = useRef(null);
  const isHoveredRef = useRef(false);

  const depsKey = JSON.stringify(dependencies);
  const speedPxPerSec = speed < 5 ? speed * 60 : speed;
  const pauseTimeSec = pauseFrames / 60;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId;
    let scrollTopVal = 0;
    let state = 'PAUSE_TOP';
    let pauseTimer = 0;
    let lastTime = null;

    container.scrollTop = 0;

    const startTimer = setTimeout(() => {
      if (!container) return;
      state = 'PAUSE_TOP';
      pauseTimer = 0;
      scrollTopVal = 0;
      container.scrollTop = 0;
      lastTime = performance.now();
      animId = requestAnimationFrame(loop);
    }, 600 + staggerMs);

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

      // If content fits or only has negligible overflow, stay at top without scrolling
      if (maxScroll <= 16) {
        if (container.scrollTop !== 0) {
          container.scrollTop = 0;
          scrollTopVal = 0;
        }
        animId = requestAnimationFrame(loop);
        return;
      }

      if (state === 'PAUSE_TOP') {
        container.scrollTop = 0;
        scrollTopVal = 0;
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

export default function AdaptiveWeeklyCalendar({ 
  events = [], 
  isLight = false,
  isFourDayMode: propIsFourDayMode,
  onToggleFourDayMode,
  bottomWidthPct = 100,
  setBottomWidthPct,
  isFourDayOverride = null,
  setIsFourDayOverride
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [containerHeight, setContainerHeight] = useState(260);

  // Determine current day of week (Lunes - Viernes). If weekend, default to Lunes.
  const todayDayName = useMemo(() => {
    const jsDay = new Date().getDay(); // 0: Dom, 1: Lun, ..., 6: Sab
    const found = WEEK_DAYS.find(d => d.jsDay === jsDay);
    return found ? found.name : 'Lunes';
  }, []);

  // Track container dimensions with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerWidth(width);
        setContainerHeight(height);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Filter events for a given day
  const getEventsForDay = (dayName) => {
    if (!events || events.length === 0) return [];
    return events.filter(e => (e.day_of_week || '').toLowerCase() === dayName.toLowerCase());
  };

  // Rule requested by user:
  // "si hoy es lunes, tiene que ocultar el viernes"
  // "si hoy es martes tiene que ocultar el viernes"
  // "ahora si hoy es miercoles tiene que ocultar el lunes"
  // "y si hoy es jueves tiene que ocultar el lunes"
  // "y si hoy es vienres tiene que ocultar el lunes"
  const hiddenDayName = useMemo(() => {
    const norm = todayDayName.toLowerCase();
    if (norm === 'lunes' || norm === 'martes') {
      return 'Viernes';
    }
    return 'Lunes';
  }, [todayDayName]);

  // Is 4-day mode active?
  const isFourDayMode = propIsFourDayMode !== undefined 
    ? propIsFourDayMode 
    : (isFourDayOverride !== null ? isFourDayOverride : (bottomWidthPct < 92 || containerWidth < 1050));

  // Compute visible days (5 days vs 4 days)
  const visibleDays = useMemo(() => {
    if (!isFourDayMode) return WEEK_DAYS;
    return WEEK_DAYS.filter(d => d.name.toLowerCase() !== hiddenDayName.toLowerCase());
  }, [isFourDayMode, hiddenDayName]);

  // Adaptive content density tier based on container height & column width
  const density = useMemo(() => {
    if (containerHeight < 195 || (containerWidth / visibleDays.length < 160)) {
      return 'micro'; // Ultra-compact 1-line horizontal pill
    }
    if (containerHeight < 270 || (containerWidth / visibleDays.length < 210)) {
      return 'compact'; // Sleek 2-line item
    }
    return 'full'; // Full card with description
  }, [containerHeight, containerWidth, visibleDays.length]);

  const handleToggleFourDayMode = () => {
    if (onToggleFourDayMode) {
      onToggleFourDayMode();
      return;
    }
    const nextMode = !isFourDayMode;
    if (setIsFourDayOverride) {
      setIsFourDayOverride(nextMode);
    }
    if (setBottomWidthPct) {
      setBottomWidthPct(nextMode ? 80 : 100);
    }
  };

  // Helper to render event item according to dynamic density tier
  const renderAdaptiveEvent = (evt, isHighlight = false) => {
    if (density === 'micro') {
      return (
        <div 
          key={evt.id} 
          className={`px-2 py-1 rounded flex items-center justify-between gap-1.5 border transition-all text-[10px] font-mono shadow-2xs ${
            isHighlight
              ? isLight
                ? 'bg-red-50/90 border-[#940028]/40 text-slate-900 hover:border-[#940028]'
                : 'bg-[#1b0d12] border-[#940028]/60 text-white hover:border-[#940028]'
              : isLight 
                ? 'bg-white border-slate-200 hover:border-slate-300 text-slate-800' 
                : 'bg-[#141418] border-zinc-800/80 hover:border-zinc-700 text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className={`font-black flex-shrink-0 text-[10px] ${
              isHighlight
                ? isLight ? 'text-[#940028]' : 'text-red-400'
                : isLight ? 'text-[#940028]' : 'text-red-400'
            }`}>
              {evt.time_range}
            </span>
            <span className="font-semibold truncate text-[10.5px]">{evt.title}</span>
          </div>
          {isHighlight && (
            <span className={`text-[8px] font-mono font-bold px-1 rounded flex-shrink-0 ${
              isLight ? 'bg-[#940028] text-white' : 'bg-[#940028] text-white'
            }`}>
              HOY
            </span>
          )}
        </div>
      );
    }

    if (density === 'compact') {
      return (
        <div 
          key={evt.id} 
          className={`p-2 rounded-lg flex flex-col gap-0.5 transition-all shadow-2xs border ${
            isHighlight
              ? isLight
                ? 'bg-red-50/80 border-[#940028]/40 text-slate-900 hover:border-[#940028]'
                : 'bg-[#1a0e13] border-[#940028]/60 text-white hover:border-[#940028]'
              : isLight 
                ? 'bg-white border-slate-200 hover:border-slate-300 text-slate-800' 
                : 'bg-[#141418] border-zinc-800/80 hover:border-zinc-700 text-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10.5px] font-extrabold font-mono tracking-wide ${
              isHighlight
                ? isLight ? 'text-[#940028]' : 'text-red-400'
                : isLight ? 'text-[#940028]' : 'text-red-400'
            }`}>
              {evt.time_range}
            </span>
            {isHighlight && (
              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded ${
                isLight ? 'bg-[#940028] text-white' : 'bg-[#940028] text-white'
              }`}>
                FIJO HOY
              </span>
            )}
          </div>
          <h4 className={`text-[11px] font-bold leading-tight truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {evt.title}
          </h4>
        </div>
      );
    }

    // Full Density
    return (
      <div 
        key={evt.id} 
        className={`p-2.5 sm:p-3 rounded-lg flex flex-col gap-1 transition-all duration-200 shadow-xs border ${
          isHighlight
            ? isLight
              ? 'bg-red-50/80 border-red-200 text-slate-900 shadow-sm hover:border-[#940028]/60'
              : 'bg-[#181216] border-[#940028]/50 text-white shadow-sm hover:border-[#940028]'
            : isLight 
              ? 'bg-white border-slate-200 hover:border-slate-300 text-slate-800' 
              : 'bg-[#141418] border-zinc-800/80 hover:border-zinc-700 text-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-extrabold font-mono tracking-wide ${
            isHighlight
              ? isLight ? 'text-[#940028]' : 'text-red-400'
              : isLight ? 'text-[#940028]' : 'text-red-400'
          }`}>
            {evt.time_range}
          </span>
          {isHighlight && (
            <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${
              isLight ? 'bg-[#940028] text-white' : 'bg-[#940028]/40 border border-[#940028]/60 text-red-200'
            }`}>
              FIJO HOY
            </span>
          )}
        </div>

        <h4 className={`text-xs font-bold leading-snug ${isLight ? 'text-slate-900' : 'text-white'}`}>
          {evt.title}
        </h4>

        {evt.description && (
          <p className={`text-[11px] line-clamp-2 leading-tight mt-0.5 ${
            isLight ? 'text-slate-600' : 'text-zinc-400'
          }`}>
            {evt.description}
          </p>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full flex flex-col min-h-0 overflow-hidden relative select-none"
    >
      {/* Top Header & View Controls Bar */}
      <div className={`flex items-center justify-between px-1 flex-shrink-0 gap-2 ${
        containerHeight < 200 ? 'pb-1' : 'pb-2'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider truncate ${
            isLight ? 'text-slate-500' : 'text-zinc-400'
          }`}>
            AGENDA SEMANAL ({isFourDayMode ? `4 DÍAS - ${hiddenDayName.toUpperCase()} OCULTO` : '5 DÍAS'})
          </span>

          {isFourDayMode && (
            <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
              isLight 
                ? 'bg-amber-100/80 text-amber-900 border border-amber-300' 
                : 'bg-amber-950/40 text-amber-300 border border-amber-800/60'
            }`}>
              <Sparkles size={10} /> Hoy: {todayDayName} • Oculto: {hiddenDayName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Quick toggle between 5-day view and 4-day view */}
          <button
            onClick={handleToggleFourDayMode}
            className={`text-[9.5px] font-mono font-bold px-2.5 py-1 rounded flex items-center gap-1.5 transition cursor-pointer border shadow-2xs ${
              isFourDayMode
                ? isLight
                  ? 'bg-[#940028] text-white border-[#7d0022] hover:bg-[#7d0022]'
                  : 'bg-[#940028] text-white border-red-600 hover:bg-[#7d0022]'
                : isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
            }`}
            title={isFourDayMode ? "Restablecer a semana completa de 5 días" : `Achicar calendario a 4 días (ocultando ${hiddenDayName})`}
          >
            <CalendarIcon size={11} />
            <span>{isFourDayMode ? `Restablecer 5 Días (Ver ${hiddenDayName})` : `Achicar a 4 Días (Ocultar ${hiddenDayName})`}</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* GRID VIEW: 5 COLUMNS (FULL) OR 4 COLUMNS (ACHICADO)           */}
      {/* FIXED TO THE LEFT, TODAY HIGHLIGHTED PROMINENTLY              */}
      {/* ------------------------------------------------------------- */}
      <div className={`grid ${
        visibleDays.length === 4 ? 'grid-cols-4' : 'grid-cols-5'
      } gap-2.5 flex-grow h-full min-h-0 overflow-hidden transition-all duration-300 ease-out`}>
        {visibleDays.map((dayObj, idx) => {
          const dayName = dayObj.name;
          const dayEvents = getEventsForDay(dayName);
          const isToday = dayName.toLowerCase() === todayDayName.toLowerCase();

          return (
            <div 
              key={dayName} 
              className={`border rounded-lg flex flex-col h-full overflow-hidden transition-all duration-300 relative ${
                isToday
                  ? isLight 
                    ? 'bg-white border-[#940028] ring-2 ring-[#940028]/35 shadow-md shadow-[#940028]/10' 
                    : 'bg-zinc-950 border-[#940028] ring-2 ring-[#940028]/60 shadow-xl shadow-[#940028]/20'
                  : isLight 
                    ? 'bg-slate-50/80 border-slate-200 hover:border-slate-300' 
                    : 'bg-zinc-950/80 border-[#19191D] hover:border-zinc-800'
              }`}
            >
              {/* Day Header */}
              <div className={`sticky top-0 z-10 border-b flex justify-between items-center flex-shrink-0 backdrop-blur-md transition-colors ${
                density === 'micro' ? 'py-1 px-2' : 'py-1.5 px-3'
              } ${
                isToday
                  ? isLight
                    ? 'bg-red-50/95 border-[#940028]/40'
                    : 'bg-[#1e0d13]/95 border-[#940028]/50'
                  : isLight 
                    ? 'bg-slate-100/90 border-slate-200' 
                    : 'bg-zinc-900/90 border-[#19191D]'
              }`}>
                <div className="flex items-center gap-1.5">
                  {isToday && (
                    <span className="w-2 h-2 rounded-full bg-[#940028] animate-pulse" />
                  )}
                  <span className={`font-bold uppercase tracking-wider font-mono ${
                    density === 'micro' ? 'text-[10px]' : 'text-[11px]'
                  } ${
                    isToday 
                      ? isLight ? 'text-[#940028] font-black' : 'text-red-300 font-black'
                      : isLight ? 'text-slate-800' : 'text-zinc-200'
                  }`}>
                    {dayName}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {isToday ? (
                    <span className="text-[8px] font-mono font-extrabold px-1.5 py-0.5 rounded tracking-wider uppercase bg-[#940028] text-white shadow-2xs">
                      HOY
                    </span>
                  ) : (
                    <span className={`text-[9px] font-mono ${isLight ? 'text-slate-400' : 'text-zinc-500'}`}>
                      {dayObj.code}
                    </span>
                  )}
                </div>
              </div>

              {/* Day Events Body with AutoScrollBox */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {dayEvents.length === 0 ? (
                  <div className={`text-[10px] font-mono text-center py-4 uppercase tracking-wider flex-grow flex items-center justify-center ${
                    isLight ? 'text-slate-400' : 'text-zinc-600'
                  }`}>
                    SIN EVENTOS
                  </div>
                ) : (
                  <AutoScrollBox 
                    className={`flex-1 min-h-0 overflow-y-auto no-scrollbar pt-1.5 pb-2 ${
                      density === 'micro' ? 'p-1.5 space-y-1' : 'p-2 space-y-1.5'
                    }`}
                    dependencies={[dayEvents]}
                    speed={0.35}
                    pauseFrames={150}
                    staggerMs={idx * 180}
                  >
                    {dayEvents.map(evt => renderAdaptiveEvent(evt, isToday))}
                  </AutoScrollBox>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
