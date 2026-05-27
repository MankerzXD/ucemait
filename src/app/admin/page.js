'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Shield, Users, UserPlus, FileText, CheckCircle2 } from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [userRole, setUserRole] = useState('');

  // Role management states
  const [targetEmail, setTargetEmail] = useState('');
  const [targetRole, setTargetRole] = useState('coordinator');
  const [rolesList, setRolesList] = useState([]);
  const [roleMessage, setRoleMessage] = useState('');

  // Audit Logs lists
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    async function checkPrivileges() {
      // 1. Demo Mode Check
      const demoEmail = localStorage.getItem('demo_user_email');
      let email = '';
      let role = 'support_it';

      if (demoEmail) {
        email = demoEmail;
        setCurrentUserEmail(demoEmail);
        if (email === 'sanchezmanuel397@gmail.com') role = 'super_admin';
        else if (email === 'ajgarcia@ucema.edu.ar') role = 'coordinator';
        setUserRole(role);
      } else {
        // 2. Supabase Auth Check
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        email = session.user.email;
        setCurrentUserEmail(email);

        try {
          const { data } = await supabase
            .from('user_roles')
            .select('role')
            .eq('email', email)
            .single();
          if (data) {
            role = data.role;
            setUserRole(role);
          } else {
            if (email === 'sanchezmanuel397@gmail.com') role = 'super_admin';
            else if (email === 'ajgarcia@ucema.edu.ar') role = 'coordinator';
            setUserRole(role);
          }
        } catch {
          if (email === 'sanchezmanuel397@gmail.com') role = 'super_admin';
          else if (email === 'ajgarcia@ucema.edu.ar') role = 'coordinator';
          setUserRole(role);
        }
      }

      // Check if user has coordinator/admin rights
      if (role !== 'super_admin' && role !== 'coordinator') {
        router.push('/');
        return;
      }

      setLoading(false);
      fetchData(role);
    }

    checkPrivileges();
  }, []);

  const fetchData = async (role) => {
    try {
      // Fetch User Roles for display if Super Admin
      if (role === 'super_admin') {
        const { data: roles, error: errRoles } = await supabase.from('user_roles').select('*');
        if (errRoles) throw errRoles;
        if (roles) {
          setRolesList(roles);
        } else {
          loadDemoRoles();
        }
      }

      // Fetch tracking logs (aggregating tables)
      const { data: dirs, error: errDirs } = await supabase.from('directives').select('*');
      if (errDirs) throw errDirs;

      const { data: obs, error: errObs } = await supabase.from('observations').select('*');
      if (errObs) throw errObs;

      const { data: evts, error: errEvts } = await supabase.from('fixed_events').select('*');
      if (errEvts) throw errEvts;

      combineLogs(dirs || [], obs || [], evts || []);
    } catch {
      // Fallback
      loadDemoRoles();
      loadDemoLogs();
    }
  };

  const loadDemoRoles = () => {
    const localRoles = localStorage.getItem('demo_roles');
    if (localRoles) {
      setRolesList(JSON.parse(localRoles));
    } else {
      const defaultRoles = [
        { id: '1', email: 'sanchezmanuel397@gmail.com', role: 'super_admin' },
        { id: '2', email: 'ajgarcia@ucema.edu.ar', role: 'coordinator' }
      ];
      localStorage.setItem('demo_roles', JSON.stringify(defaultRoles));
      setRolesList(defaultRoles);
    }
  };

  const loadDemoLogs = () => {
    const defaultDirs = JSON.parse(localStorage.getItem('demo_directives') || '[]');
    const defaultObs = JSON.parse(localStorage.getItem('demo_observations') || '[]');
    const defaultEvts = JSON.parse(localStorage.getItem('demo_events') || '[]');
    combineLogs(defaultDirs, defaultObs, defaultEvts);
  };

  const combineLogs = (dirs, obs, evts) => {
    const combined = [];
    
    dirs.forEach(d => {
      combined.push({
        id: d.id,
        type: 'DIRECTIVA',
        details: `Aula ${d.classroom} (${d.day.toUpperCase()}): ${d.requirements}`,
        email: d.created_by_email,
        date: d.created_at || new Date().toISOString()
      });
    });

    obs.forEach(o => {
      combined.push({
        id: o.id,
        type: 'OBSERVACIÓN',
        details: `[${o.severity.toUpperCase()}] ${o.text}`,
        email: o.created_by_email,
        date: o.created_at || new Date().toISOString()
      });
    });

    evts.forEach(e => {
      combined.push({
        id: e.id,
        type: 'EVENTO FIJO',
        details: `${e.day_of_week} (${e.time_range}) - ${e.title}: ${e.description}`,
        email: e.created_by_email,
        date: e.created_at || new Date().toISOString()
      });
    });

    // Sort by date descending
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));
    setLogs(combined);
  };

  const saveRole = async (e) => {
    e.preventDefault();
    if (!targetEmail.trim()) return;

    setRoleMessage('');

    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({ email: targetEmail, role: targetRole }, { onConflict: 'email' });
      
      if (error) throw error;
      setRoleMessage(`Permisos actualizados para: ${targetEmail}`);
      fetchData(userRole);
    } catch {
      // Mock save
      const mockRoles = [...rolesList.filter(r => r.email !== targetEmail), { id: Date.now().toString(), email: targetEmail, role: targetRole }];
      localStorage.setItem('demo_roles', JSON.stringify(mockRoles));
      setRolesList(mockRoles);
      setRoleMessage(`[Demo] Permisos actualizados para: ${targetEmail}`);
    }
    setTargetEmail('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center font-mono text-zinc-400">
        AUTENTICANDO ROL DE COORDINACIÓN...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <div className="absolute inset-0 tech-grid opacity-20 pointer-events-none"></div>

      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md py-4 px-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/')}
            className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded flex items-center justify-center border border-zinc-700 text-zinc-300 transition cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="font-bold text-sm tracking-wider uppercase">SISTEMA DE SEGUIMIENTO // AUDITORÍA</h1>
            <p className="text-[10px] text-zinc-500 font-mono">USUARIO COORDINADOR: {currentUserEmail}</p>
          </div>
        </div>
      </header>

      <main className="flex-grow p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 z-10">
        
        {/* Left / Mid Column: Audit Logs */}
        <section className="bg-zinc-900/60 border border-zinc-800 rounded p-5 flex flex-col gap-4 lg:col-span-2">
          <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold tracking-widest text-red-500 uppercase flex items-center gap-2">
                <FileText size={16} /> Panel de Seguimiento
              </h2>
              <p className="text-[10px] text-zinc-500 uppercase">Trazabilidad de modificaciones en tiempo real</p>
            </div>
            <span className="bg-red-950/50 border border-red-900 text-red-500 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
              {logs.length} EVENTOS REGISTRADOS
            </span>
          </div>

          <div className="flex-grow overflow-y-auto max-h-[600px] space-y-3 pr-2">
            {logs.length === 0 ? (
              <p className="text-xs text-zinc-600 font-mono py-8 text-center">No hay registros de auditoría disponibles.</p>
            ) : (
              logs.map(log => (
                <div key={log.id} className="bg-zinc-950 border border-zinc-850 p-3 rounded flex flex-col gap-1.5 transition hover:border-zinc-750">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                      {log.type}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(log.date).toLocaleString('es-AR')}
                    </span>
                  </div>
                  <p className="text-zinc-200 text-xs font-semibold">{log.details}</p>
                  <div className="text-[9px] text-zinc-400 font-mono flex items-center gap-1 border-t border-zinc-900/80 pt-1.5 mt-0.5">
                    <span className="text-zinc-500">CREADO POR:</span>
                    <span className="text-red-400 font-bold">{log.email}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Right Column: User Management (Super Admin only) */}
        <section className="bg-zinc-900/60 border border-zinc-800 rounded p-5 flex flex-col gap-4">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-sm font-bold tracking-widest text-red-500 uppercase flex items-center gap-2">
              <Users size={16} /> Gestión de Roles
            </h2>
            <p className="text-[10px] text-zinc-500 uppercase">
              {userRole === 'super_admin' ? 'Asignación de privilegios' : 'Sólo disponible para Super Admin'}
            </p>
          </div>

          {userRole !== 'super_admin' ? (
            <div className="p-4 bg-zinc-950/60 border border-zinc-850 rounded text-center text-xs text-zinc-500 py-12">
              Privilegios insuficientes. Tu rol actual es: <strong className="text-zinc-400 font-mono">{userRole.toUpperCase()}</strong>.
              <br />Sólo <strong className="text-red-500 font-mono">sanchezmanuel397@gmail.com</strong> puede asignar coordinadores.
            </div>
          ) : (
            <>
              {roleMessage && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-900 text-emerald-400 text-xs rounded font-mono flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> {roleMessage}
                </div>
              )}

              <form onSubmit={saveRole} className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono mb-1">Email del Staff</label>
                  <input
                    type="email"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-red-600 font-mono"
                    placeholder="name@ucema.edu.ar"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono mb-1">Rol a asignar</label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 px-3 py-1.5 text-xs rounded focus:outline-none focus:border-red-600 font-mono"
                  >
                    <option value="coordinator">Coordinador</option>
                    <option value="support_it">Support IT (Estándar)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-red-800 hover:bg-red-700 text-white text-xs font-semibold py-2 rounded transition cursor-pointer flex items-center justify-center gap-1.5 uppercase font-mono"
                >
                  <UserPlus size={14} /> Asignar Rol
                </button>
              </form>

              {/* Roles listing */}
              <div className="mt-4 flex-grow overflow-y-auto max-h-[300px] space-y-2">
                <h3 className="text-xs font-bold uppercase text-zinc-400 font-mono">Staff Registrado</h3>
                {rolesList.map(r => (
                  <div key={r.id} className="bg-zinc-950 border border-zinc-850 p-2 rounded text-xs flex justify-between items-center font-mono">
                    <span className="truncate text-zinc-300 mr-2">{r.email}</span>
                    <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                      r.role === 'super_admin' ? 'bg-red-950/60 text-red-500' : 'bg-amber-950/60 text-amber-500'
                    }`}>{r.role.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

      </main>
    </div>
  );
}
