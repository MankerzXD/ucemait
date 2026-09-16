'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  Tv, LogOut, Shield, ClipboardList, Eye, PlusCircle, Trash2, Calendar, AlertTriangle, Bell, Clock, X
} from 'lucide-react';

export default function ManagementPage() {
  const router = useRouter();
  
  // Authentication & Role states
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('support_it'); // default fallback
  const [loading, setLoading] = useState(true);

  // Forms states
  const [directiveClassroom, setDirectiveClassroom] = useState('4D');
  const [directiveDate, setDirectiveDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [directiveTime, setDirectiveTime] = useState('');
  const [directiveReq, setDirectiveReq] = useState('');

  const [obsText, setObsText] = useState('');
  const [obsSeverity, setObsSeverity] = useState('info');

  const [eventDay, setEventDay] = useState('Lunes');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');

  // Loaded database data
  const [directivesList, setDirectivesList] = useState([]);
  const [observationsList, setObservationsList] = useState([]);
  const [eventsList, setEventsList] = useState([]);

  // Alert Modal states for upcoming tasks (<15 min)
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState(50);
  const alertedIdsRef = useRef(new Set());

  // Check roles and user session
  useEffect(() => {
    async function checkAuth() {
      // 1. Check if we have a demo bypass email in localStorage
      const demoEmail = localStorage.getItem('demo_user_email');
      
      if (demoEmail) {
        setUserEmail(demoEmail);
        determineRole(demoEmail);
        setLoading(false);
        fetchData();
        return;
      }

      // 2. Check Supabase auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Redirect to login if no auth is set up
        router.push('/login');
        return;
      }

      const email = session.user.email;
      setUserEmail(email);
      
      // Query role from Supabase DB public.user_roles table
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('email', email)
          .single();
        
        if (data) {
          setUserRole(data.role);
        } else {
          determineRole(email);
        }
      } catch (e) {
        determineRole(email);
      }
      
      setLoading(false);
      fetchData();
    }

    checkAuth();

    // Supabase Real-time subscriber to keep dashboard synced in real time
    const channel = supabase
      .channel('main-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'directives' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setDirectivesList(prev => [payload.new, ...prev.filter(d => d.id !== payload.new.id)]);
        } else if (payload.eventType === 'DELETE') {
          setDirectivesList(prev => prev.filter(d => d.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setDirectivesList(prev => prev.map(d => d.id === payload.new.id ? payload.new : d));
        }
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'observations' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setObservationsList(prev => [payload.new, ...prev.filter(o => o.id !== payload.new.id)]);
        } else if (payload.eventType === 'DELETE') {
          setObservationsList(prev => prev.filter(o => o.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setObservationsList(prev => prev.map(o => o.id === payload.new.id ? payload.new : o));
        }
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixed_events' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setEventsList(prev => [payload.new, ...prev.filter(e => e.id !== payload.new.id)]);
        } else if (payload.eventType === 'DELETE') {
          setEventsList(prev => prev.filter(e => e.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setEventsList(prev => prev.map(e => e.id === payload.new.id ? payload.new : e));
        }
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Play notification chime
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
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
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
      if (directivesList && directivesList.length > 0) {
        directivesList.forEach(dir => {
          if (!dir.directive_date || dir.directive_date !== todayStr) return;
          if (!dir.directive_time) return;

          const parts = dir.directive_time.split(':');
          if (parts.length < 2) return;
          const targetH = parseInt(parts[0], 10);
          const targetM = parseInt(parts[1], 10);
          if (isNaN(targetH) || isNaN(targetM)) return;

          const targetTotalMin = targetH * 60 + targetM;
          const diffMin = targetTotalMin - nowTotalMin;

          // Trigger if between -10 min (ongoing) and +15 min (approaching)
          if (diffMin >= -10 && diffMin <= 15) {
            const key = `dir_${dir.id}_${dir.directive_date}_${dir.directive_time}`;
            if (!alertedIdsRef.current.has(key)) {
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
      if (eventsList && eventsList.length > 0) {
        eventsList.forEach(evt => {
          if (!evt.day_of_week) return;
          if (normalizeDay(evt.day_of_week) !== todayDayName) return;

          const timeMatch = (evt.time_range || '').match(/(\d{1,2}):(\d{2})/);
          if (!timeMatch) return;

          const targetH = parseInt(timeMatch[1], 10);
          const targetM = parseInt(timeMatch[2], 10);
          if (isNaN(targetH) || isNaN(targetM)) return;

          const targetTotalMin = targetH * 60 + targetM;
          const diffMin = targetTotalMin - nowTotalMin;

          // Trigger if between -10 min (ongoing) and +15 min (approaching)
          if (diffMin >= -10 && diffMin <= 15) {
            const timeStr = `${String(targetH).padStart(2, '0')}:${String(targetM).padStart(2, '0')}`;
            const key = `evt_${evt.id}_${todayStr}_${timeStr}`;
            if (!alertedIdsRef.current.has(key)) {
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
          alertedIdsRef.current.add(d.dedupKey);
        });
        setUpcomingTasks(due);
        setShowModal(true);
        setCountdown(50);
        playAlertChime();
      }
    };

    checkUpcoming();
    const interval = setInterval(checkUpcoming, 10000);
    return () => clearInterval(interval);
  }, [directivesList, eventsList]);

  // 50-second auto-close countdown
  useEffect(() => {
    if (!showModal) return;

    setCountdown(50);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setShowModal(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showModal]);

  const determineRole = (email) => {
    if (email === 'sanchezmanuel397@gmail.com') {
      setUserRole('super_admin');
    } else if (email === 'ajgarcia@ucema.edu.ar') {
      setUserRole('coordinator');
    } else {
      setUserRole('support_it');
    }
  };

  const fetchData = async () => {
    try {
      // Directives
      const { data: dirs, error: errDirs } = await supabase.from('directives').select('*').order('created_at', { ascending: false });
      if (errDirs) throw errDirs;
      if (dirs) setDirectivesList(dirs);

      // Observations
      const { data: obs, error: errObs } = await supabase.from('observations').select('*').order('created_at', { ascending: false });
      if (errObs) throw errObs;
      if (obs) setObservationsList(obs);

      // Events
      const { data: evts, error: errEvts } = await supabase.from('fixed_events').select('*').order('created_at', { ascending: false });
      if (errEvts) throw errEvts;
      if (evts) setEventsList(evts);
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
      // Load fallback demo mock data if DB isn't online
      loadDemoData();
    }
  };

  const loadDemoData = () => {
    // Directives
    const localDirs = localStorage.getItem('demo_directives');
    if (localDirs) {
      setDirectivesList(JSON.parse(localDirs));
    } else {
      const defaultDirs = [
        { id: '1', classroom: '4D', directive_date: new Date().toISOString().split('T')[0], requirements: 'Proyector HDMI - Sin señal de entrada.', created_by_email: 'sanchezmanuel397@gmail.com' },
        { id: '2', classroom: 'Lab Movil 1', directive_date: new Date().toISOString().split('T')[0], requirements: '20 Chromebooks - Verificar carga.', created_by_email: 'ajgarcia@ucema.edu.ar' },
        { id: '3', classroom: '4E', directive_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], requirements: 'Mantenimiento PC Docente.', created_by_email: 'support@ucema.edu.ar' }
      ];
      localStorage.setItem('demo_directives', JSON.stringify(defaultDirs));
      setDirectivesList(defaultDirs);
    }

    // Observations
    const localObs = localStorage.getItem('demo_observations');
    if (localObs) {
      setObservationsList(JSON.parse(localObs));
    } else {
      const defaultObs = [
        { id: '1', text: 'Impresora Piso 3 sin tóner negro.', severity: 'warning', created_by_email: 'support@ucema.edu.ar' },
        { id: '2', text: 'Red Wi-Fi Edificio Central operando con normalidad.', severity: 'info', created_by_email: 'sanchezmanuel397@gmail.com' }
      ];
      localStorage.setItem('demo_observations', JSON.stringify(defaultObs));
      setObservationsList(defaultObs);
    }

    // Fixed Events
    const localEvts = localStorage.getItem('demo_events');
    if (localEvts) {
      setEventsList(JSON.parse(localEvts));
    } else {
      const defaultEvts = [
        { id: '1', day_of_week: 'Lunes', title: 'Backup General Servidores', description: 'Revisión periódica de cintas y almacenamiento NAS.', time_range: '08:00 - 10:00', created_by_email: 'sanchezmanuel397@gmail.com' },
        { id: '2', day_of_week: 'Miércoles', title: 'Guardia Soporte Auditorio', description: 'Conferencia ejecutiva con microfonía inalámbrica.', time_range: '14:00 - 18:00', created_by_email: 'ajgarcia@ucema.edu.ar' },
        { id: '3', day_of_week: 'Viernes', title: 'Reinicio Programado de Switches', description: 'Ventana de mantenimiento en piso 4 y 5.', time_range: '20:00 - 21:00', created_by_email: 'sanchezmanuel397@gmail.com' }
      ];
      localStorage.setItem('demo_events', JSON.stringify(defaultEvts));
      setEventsList(defaultEvts);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('demo_user_email');
    await supabase.auth.signOut();
    router.push('/login');
  };

  const addDirective = async (e) => {
    e.preventDefault();
    if (!directiveReq.trim()) return;

    const newItem = {
      classroom: directiveClassroom,
      directive_date: directiveDate,
      directive_time: directiveTime || null,
      requirements: directiveReq,
      created_by_email: userEmail || 'anonymous@ucema.edu.ar',
    };

    try {
      const { data, error } = await supabase.from('directives').insert([newItem]).select();
      if (error) throw error;
      fetchData();
    } catch {
      // DB Fallback
      const localData = [...directivesList, { id: Date.now().toString(), ...newItem }];
      localStorage.setItem('demo_directives', JSON.stringify(localData));
      setDirectivesList(localData);
    }
    setDirectiveReq('');
    setDirectiveTime('');
  };

  const addObservation = async (e) => {
    e.preventDefault();
    if (!obsText.trim()) return;

    const newItem = {
      text: obsText,
      severity: obsSeverity,
      created_by_email: userEmail || 'anonymous@ucema.edu.ar',
    };

    try {
      const { data, error } = await supabase.from('observations').insert([newItem]).select();
      if (error) throw error;
      fetchData();
    } catch {
      // DB Fallback
      const localData = [...observationsList, { id: Date.now().toString(), ...newItem }];
      localStorage.setItem('demo_observations', JSON.stringify(localData));
      setObservationsList(localData);
    }
    setObsText('');
  };

  const addEvent = async (e) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;

    const formattedTime = eventTime 
      ? (eventEndTime ? `${eventTime} - ${eventEndTime}` : `${eventTime} hs`)
      : 'Todo el día';

    const newItem = {
      day_of_week: eventDay,
      title: eventTitle,
      description: eventDesc,
      time_range: formattedTime,
      created_by_email: userEmail || 'anonymous@ucema.edu.ar',
    };

    try {
      const { data, error } = await supabase.from('fixed_events').insert([newItem]).select();
      if (error) throw error;
      fetchData();
    } catch {
      // DB Fallback
      const localData = [...eventsList, { id: Date.now().toString(), ...newItem }];
      localStorage.setItem('demo_events', JSON.stringify(localData));
      setEventsList(localData);
    }
    setEventTitle('');
    setEventDesc('');
    setEventTime('');
    setEventEndTime('');
  };

  // Delete handlers
  const deleteItem = async (table, id) => {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch {
      let storageKey = '';
      let list = [];
      let setter = null;

      if (table === 'directives') { storageKey = 'demo_directives'; list = directivesList; setter = setDirectivesList; }
      else if (table === 'observations') { storageKey = 'demo_observations'; list = observationsList; setter = setObservationsList; }
      else if (table === 'fixed_events') { storageKey = 'demo_events'; list = eventsList; setter = setEventsList; }

      const updated = list.filter(item => item.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setter(updated);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center font-mono text-zinc-400">
        CARGANDO SISTEMA // CHECKING CREDENTIALS...
      </div>
    );
  }

  const isCoordinadorOrAdmin = userRole === 'coordinator' || userRole === 'super_admin';

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <div className="absolute inset-0 tech-grid opacity-20 pointer-events-none"></div>
      
      {/* Top Navbar */}
      <header className="border-b border-[#940028]/40 bg-zinc-900/90 backdrop-blur-md py-4 px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10 shadow-sm shadow-[#940028]/10">
        <div className="flex items-center gap-3">
          <img src="https://ucema.edu.ar/mailing/firmas-ucema/Firmas_Institucional/Firma_Institucional_Blanco/assets/img/LOGO.png" alt="UCEMA Logo" className="h-7 w-auto object-contain" />
          <div>
            <h1 className="font-bold text-sm tracking-wider uppercase">SUPPORT IT CONTROL PANEL</h1>
            <p className="text-[10px] text-zinc-500 font-mono">CONECTADO: {userEmail} ({userRole.toUpperCase()})</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          {userRole === 'super_admin' && (
            <button
              onClick={() => router.push('/admin')}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-3 py-1.5 rounded font-mono flex items-center gap-1.5 border border-zinc-700 cursor-pointer flex-grow md:flex-grow-0 justify-center"
            >
              <Shield size={14} /> USER MANAGEMENT
            </button>
          )}

          {isCoordinadorOrAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-3 py-1.5 rounded font-mono flex items-center gap-1.5 border border-zinc-700 cursor-pointer flex-grow md:flex-grow-0 justify-center"
            >
              <ClipboardList size={14} /> SEGUIMIENTO
            </button>
          )}

          <button
            onClick={() => router.push('/tv')}
            className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded font-mono flex items-center gap-1.5 cursor-pointer flex-grow md:flex-grow-0 justify-center"
          >
            <Tv size={14} /> VER TV DASHBOARD
          </button>

          <button
            onClick={handleLogout}
            className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-850 text-zinc-400 text-xs px-3 py-1.5 rounded font-mono flex items-center gap-1.5 cursor-pointer flex-grow md:flex-grow-0 justify-center"
          >
            <LogOut size={14} /> SALIR
          </button>
        </div>
      </header>

      {/* Main Grid Forms */}
      <main className="flex-grow p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto w-full z-10">
        
        {/* Panel 1: Directivas */}
        <section className="bg-zinc-900/60 border border-zinc-800 rounded p-5 flex flex-col gap-4">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-sm font-bold tracking-widest text-red-500 uppercase flex items-center gap-2">
              <ClipboardList size={16} /> Agregar Directiva
            </h2>
            <p className="text-[10px] text-zinc-500 uppercase">Hoy o Mañana para Aulas</p>
          </div>

          <form onSubmit={addDirective} className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono mb-1">Aula / Recurso</label>
              <select
                value={directiveClassroom}
                onChange={(e) => setDirectiveClassroom(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-red-600 font-mono"
              >
                {['4D', '4E', '5E', 'Lab Movil 1', 'Lab Movil 2', 'Lab Movil 3'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono mb-1">Fecha de aplicación</label>
                <input
                  type="date"
                  value={directiveDate}
                  onChange={(e) => setDirectiveDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-red-600 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono mb-1">Horario (Opcional)</label>
                <input
                  type="time"
                  value={directiveTime}
                  onChange={(e) => setDirectiveTime(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-red-600 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono mb-1">Requerimientos técnicos</label>
              <textarea
                value={directiveReq}
                onChange={(e) => setDirectiveReq(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-2 text-xs rounded focus:outline-none focus:border-red-600 h-20"
                placeholder="Ej: Conectar proyector HDMI y encender switch."
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#940028] hover:bg-[#7d0022] text-white text-xs font-semibold py-2.5 rounded transition cursor-pointer flex items-center justify-center gap-2 uppercase font-mono shadow-md shadow-[#940028]/25 active:scale-[0.99]"
            >
              <PlusCircle size={14} /> Registrar Directiva
            </button>
          </form>

          {/* List display */}
          <div className="mt-4 flex-grow overflow-y-auto max-h-[300px] space-y-2">
            <h3 className="text-xs font-bold uppercase text-zinc-400 font-mono">Listado de Directivas</h3>
            {directivesList.length === 0 ? (
              <p className="text-[10px] text-zinc-600 font-mono">No hay directivas cargadas.</p>
            ) : (
              directivesList.map(dir => (
                <div key={dir.id} className="bg-zinc-950 border border-zinc-850 p-2.5 rounded text-xs relative">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-red-400 font-mono">{dir.classroom} ({dir.directive_date}{dir.directive_time ? ` · ${dir.directive_time} hs` : ''})</span>
                    <button onClick={() => deleteItem('directives', dir.id)} className="text-zinc-600 hover:text-red-500 cursor-pointer">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="text-zinc-300 text-[11px]">{dir.requirements}</p>
                  {isCoordinadorOrAdmin && (
                    <div className="mt-1.5 text-[9px] text-zinc-500 font-mono border-t border-zinc-900 pt-1 flex justify-between">
                      <span>Log: {dir.created_by_email}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Panel 2: Observaciones */}
        <section className="bg-zinc-900/60 border border-zinc-800 rounded p-5 flex flex-col gap-4">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-sm font-bold tracking-widest text-red-500 uppercase flex items-center gap-2">
              <AlertTriangle size={16} /> Agregar Observación
            </h2>
            <p className="text-[10px] text-zinc-500 uppercase">Alertas en tiempo real</p>
          </div>

          <form onSubmit={addObservation} className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono mb-1">Gravedad</label>
              <select
                value={obsSeverity}
                onChange={(e) => setObsSeverity(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-red-600 font-mono"
              >
                <option value="info">Info</option>
                <option value="warning">Advertencia</option>
                <option value="danger">Crítico</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono mb-1">Detalle técnico</label>
              <textarea
                value={obsText}
                onChange={(e) => setObsText(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-2 text-xs rounded focus:outline-none focus:border-red-600 h-20"
                placeholder="Ej: UPS de Rack A en estado crítico de sobrecarga."
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#940028] hover:bg-[#7d0022] text-white text-xs font-semibold py-2.5 rounded transition cursor-pointer flex items-center justify-center gap-2 uppercase font-mono shadow-md shadow-[#940028]/25 active:scale-[0.99]"
            >
              <PlusCircle size={14} /> Registrar Observación
            </button>
          </form>

          {/* List display */}
          <div className="mt-4 flex-grow overflow-y-auto max-h-[300px] space-y-2">
            <h3 className="text-xs font-bold uppercase text-zinc-400 font-mono">Listado de Observaciones</h3>
            {observationsList.length === 0 ? (
              <p className="text-[10px] text-zinc-600 font-mono">No hay observaciones cargadas.</p>
            ) : (
              observationsList.map(obs => (
                <div key={obs.id} className={`bg-zinc-950 border p-2.5 rounded text-xs relative ${
                  obs.severity === 'danger' ? 'border-red-900/55' : obs.severity === 'warning' ? 'border-amber-900/55' : 'border-zinc-850'
                }`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${
                      obs.severity === 'danger' ? 'bg-red-950 text-red-500' : obs.severity === 'warning' ? 'bg-amber-950 text-amber-500' : 'bg-zinc-900 text-zinc-400'
                    }`}>{obs.severity}</span>
                    <button onClick={() => deleteItem('observations', obs.id)} className="text-zinc-600 hover:text-red-500 cursor-pointer">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <p className="text-zinc-300 text-[11px]">{obs.text}</p>
                  {isCoordinadorOrAdmin && (
                    <div className="mt-1.5 text-[9px] text-zinc-500 font-mono border-t border-zinc-900 pt-1 flex justify-between">
                      <span>Log: {obs.created_by_email}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Panel 3: Almanaque Fijo */}
        <section className="bg-zinc-900/60 border border-zinc-800 rounded p-5 flex flex-col gap-4">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-sm font-bold tracking-widest text-red-500 uppercase flex items-center gap-2">
              <Calendar size={16} /> Evento Calendario
            </h2>
            <p className="text-[10px] text-zinc-500 uppercase">Agenda de Lunes a Viernes</p>
          </div>

          <form onSubmit={addEvent} className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono mb-1">Día de la semana</label>
              <select
                value={eventDay}
                onChange={(e) => setEventDay(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-red-600 font-mono"
              >
                {['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono mb-1">Título de Evento</label>
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-red-600 font-mono"
                placeholder="Ej: Auditorio - Setup"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono mb-1">Horario (Inicio)</label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-red-600 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono mb-1">Hasta (Opcional)</label>
                <input
                  type="time"
                  value={eventEndTime}
                  onChange={(e) => setEventEndTime(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-red-600 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono mb-1">Descripción corta</label>
              <input
                type="text"
                value={eventDesc}
                onChange={(e) => setEventDesc(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-red-600 font-mono"
                placeholder="Ej: Setup micrófonos"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#940028] hover:bg-[#7d0022] text-white text-xs font-semibold py-2.5 rounded transition cursor-pointer flex items-center justify-center gap-2 uppercase font-mono shadow-md shadow-[#940028]/25 active:scale-[0.99]"
            >
              <PlusCircle size={14} /> Registrar Evento
            </button>
          </form>

          {/* List display */}
          <div className="mt-4 flex-grow overflow-y-auto max-h-[300px] space-y-2">
            <h3 className="text-xs font-bold uppercase text-zinc-400 font-mono">Listado de Eventos</h3>
            {eventsList.length === 0 ? (
              <p className="text-[10px] text-zinc-600 font-mono">No hay eventos cargados.</p>
            ) : (
              eventsList.map(evt => (
                <div key={evt.id} className="bg-zinc-950 border border-zinc-850 p-2.5 rounded text-xs relative">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-amber-500 font-mono">{evt.day_of_week} ({evt.time_range})</span>
                    <button onClick={() => deleteItem('fixed_events', evt.id)} className="text-zinc-600 hover:text-red-500 cursor-pointer">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <h4 className="font-bold text-zinc-200">{evt.title}</h4>
                  <p className="text-zinc-400 text-[11px]">{evt.description}</p>
                  {isCoordinadorOrAdmin && (
                    <div className="mt-1.5 text-[9px] text-zinc-500 font-mono border-t border-zinc-900 pt-1 flex justify-between">
                      <span>Log: {evt.created_by_email}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

      </main>

      {/* MODAL: NOTIFICACIÓN DE DIRECTIVAS PRÓXIMAS (< 15 MIN) */}
      {showModal && upcomingTasks.length > 0 && (
        <div 
          onClick={() => setShowModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0e0e11] border-2 border-red-600 rounded-xl shadow-2xl shadow-red-950/50 max-w-lg w-full overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="bg-red-950/50 border-b border-red-900/60 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-600 text-white rounded-lg animate-bounce">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white tracking-wider flex items-center gap-2 font-mono">
                    ALERTA: TAREAS PRÓXIMAS
                    <span className="text-[10px] bg-red-600/40 text-red-200 border border-red-500/50 px-2 py-0.5 rounded font-mono">
                      &lt; 15 MIN
                    </span>
                  </h3>
                  <p className="text-xs text-red-200/80">Requerimientos técnicos prioritarios a preparar</p>
                </div>
              </div>

              <button 
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-md hover:bg-zinc-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content / Task List */}
            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto no-scrollbar">
              {upcomingTasks.map((task) => (
                <div 
                  key={task.id}
                  className="bg-[#141418] border border-red-900/40 p-4 rounded-lg flex flex-col gap-2 relative overflow-hidden shadow-md"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                        task.sourceType === 'evento' 
                          ? 'bg-amber-950/80 border border-amber-800 text-amber-300' 
                          : 'bg-[#940028]/40 border border-[#940028] text-red-200'
                      }`}>
                        {task.badge}
                      </span>
                      <span className="font-bold text-white font-mono text-sm tracking-wide">
                        {task.title}
                      </span>
                      <span className="text-[11px] font-mono bg-red-950 border border-red-800 text-red-200 px-2 py-0.5 rounded flex items-center gap-1 font-bold">
                        <Clock size={12} /> {task.time} hs
                      </span>
                    </div>
                    <span className="text-xs font-bold text-amber-400 font-mono flex-shrink-0">
                      {task.diffMinutes > 0 ? `Faltan ${task.diffMinutes} min` : task.diffMinutes === 0 ? '¡COMIENZA AHORA!' : 'En curso'}
                    </span>
                  </div>

                  <p className="text-zinc-100 text-xs font-medium leading-relaxed bg-zinc-950/70 p-3 rounded border border-zinc-900">
                    {task.text}
                  </p>

                  <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono pt-1">
                    <span>{task.subtitle}</span>
                    {task.creator && <span>Asignó: {task.creator}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer with 50s countdown bar */}
            <div className="bg-zinc-950 border-t border-zinc-900 p-3.5 px-5 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5">
                <Clock size={13} className="text-red-400" />
                Cierre automático en <strong className="text-white font-bold">{countdown}s</strong> (o haz clic afuera)
              </span>

              <button
                onClick={() => setShowModal(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold px-4 py-1.5 rounded transition cursor-pointer font-mono"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
