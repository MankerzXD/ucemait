'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Shield, Loader2, Key, Send } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  
  // Login stages: 'email' (sending OTP) or 'otp' (verifying OTP)
  const [stage, setStage] = useState('email');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Check if session is already stored in local storage
  useEffect(() => {
    async function checkCurrentSession() {
      // 1. Check offline demo session
      const demoSession = localStorage.getItem('demo_user_email');
      if (demoSession) {
        router.push('/');
        return;
      }

      // 2. Check Supabase auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Automatically mirror to demo_user_email to keep it simplified
        localStorage.setItem('demo_user_email', session.user.email);
        router.push('/');
      }
    }
    checkCurrentSession();
  }, [router]);

  // Stage 1: Send OTP code
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Fallo al enviar código.');
      }

      setSuccessMsg('Código de verificación enviado a tu email.');
      setStage('otp');
    } catch (err) {
      console.error('API OTP failed:', err);
      setErrorMsg(err.message || 'Error al enviar código de verificación.');
    } finally {
      setLoading(false);
    }
  };

  // Stage 2: Verify OTP code
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpToken.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), token: otpToken.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Código inválido.');
      }

      // Successful OTP verification
      setSuccessMsg('Código verificado. Conectando...');
      localStorage.setItem('demo_user_email', result.email);
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err) {
      console.error('API verification failed:', err);
      setErrorMsg(err.message || 'Código incorrecto. Por favor, reintenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-zinc-950 p-4 font-sans overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 tech-grid opacity-10 z-0"></div>
      
      <div className="relative z-10 w-full max-w-sm bg-zinc-900/90 border border-zinc-800 p-8 rounded shadow-2xl backdrop-blur-md">
        {/* Branding header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-red-950/40 border border-red-900 text-red-500 mb-4">
            <Shield size={24} />
          </div>
          <h1 className="text-lg font-extrabold tracking-widest text-white uppercase">SUPPORT IT // ACCESO</h1>
          <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">Universidad del CEMA</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-900 text-red-400 text-xs rounded font-mono">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-950/30 border border-emerald-900 text-emerald-400 text-xs rounded font-mono">
            {successMsg}
          </div>
        )}

        {stage === 'email' ? (
          /* FORM 1: REQUEST OTP */
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-mono mb-2">Email corporativo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3 py-2 text-xs rounded focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 font-mono"
                placeholder="user@ucema.edu.ar"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-800 hover:bg-red-700 text-white py-2 text-xs font-semibold rounded transition duration-150 uppercase tracking-widest font-mono flex justify-center items-center gap-2 cursor-pointer"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <><Send size={14} /> ENVIAR CÓDIGO</>}
            </button>
          </form>
        ) : (
          /* FORM 2: VERIFY OTP */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-center mb-3">
              <span className="text-[11px] text-zinc-400 font-mono">{email}</span>
              <button 
                type="button" 
                onClick={() => setStage('email')}
                className="block mx-auto text-[9px] text-red-400 hover:underline mt-1 cursor-pointer font-mono"
              >
                ¿Cambiar email?
              </button>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-400 font-mono mb-2">Ingresar Código OTP (6 dígitos)</label>
              <input
                type="text"
                maxLength={6}
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 px-3 py-2.5 text-center text-lg tracking-widest rounded focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 font-mono font-bold"
                placeholder="000000"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-800 hover:bg-red-700 text-white py-2 text-xs font-semibold rounded transition duration-150 uppercase tracking-widest font-mono flex justify-center items-center gap-2 cursor-pointer"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <><Key size={14} /> VERIFICAR CÓDIGO</>}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
