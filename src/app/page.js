'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
  Tv, LogOut, Shield, ClipboardList, Eye, PlusCircle, Trash2, Calendar, AlertTriangle
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
    return today.toISOString().split('T')[0];
  });
  const [directiveReq, setDirectiveReq] = useState('');

  const [obsText, setObsText] = useState('');
  const [obsSeverity, setObsSeverity] = useState('info');

  const [eventDay, setEventDay] = useState('Lunes');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventTime, setEventTime] = useState('');

  // Loaded database data
  const [directivesList, setDirectivesList] = useState([]);
  const [observationsList, setObservationsList] = useState([]);
  const [eventsList, setEventsList] = useState([]);

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
  }, []);

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
        { id: '1', text: 'Corte de fibra en bloque oeste.', severity: 'danger', created_by_email: 'sanchezmanuel397@gmail.com' },
        { id: '2', text: 'Access Point AP-09 reporta sobrecarga.', severity: 'warning', created_by_email: 'ajgarcia@ucema.edu.ar' }
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
        { id: '1', day_of_week: 'Lunes', title: 'Auditorio - Setup', description: 'Micrófonos y consola', time_range: '08:00 - 09:30', created_by_email: 'ajgarcia@ucema.edu.ar' },
        { id: '2', day_of_week: 'Miércoles', title: '4E - Mantenimiento', description: 'Fijación de proyector', time_range: '10:00 - 12:00', created_by_email: 'support@ucema.edu.ar' }
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

    const newItem = {
      day_of_week: eventDay,
      title: eventTitle,
      description: eventDesc,
      time_range: eventTime || 'Todo el día',
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
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md py-4 px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10">
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
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold py-2 rounded transition cursor-pointer flex items-center justify-center gap-1.5 uppercase font-mono"
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
                    <span className="font-bold text-red-400 font-mono">{dir.classroom} ({dir.directive_date})</span>
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
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold py-2 rounded transition cursor-pointer flex items-center justify-center gap-1.5 uppercase font-mono"
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
                <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono mb-1">Rango Horario</label>
                <input
                  type="text"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-red-600 font-mono"
                  placeholder="Ej: 08:00 - 09:30"
                />
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
            </div>

            <button
              type="submit"
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold py-2 rounded transition cursor-pointer flex items-center justify-center gap-1.5 uppercase font-mono"
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
    </div>
  );
}
