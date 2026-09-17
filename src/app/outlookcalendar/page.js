'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, ExternalLink } from 'lucide-react';

export default function OutlookCalendarPage() {
  const router = useRouter();

  const calendarUrl = process.env.NEXT_PUBLIC_HELPDESK_CALENDAR_URL || "https://outlook.office365.com/owa/calendar/433a34896a4545739e21cff1bd39ac26@ucema.edu.ar/2d9d26876dd440a3a4d723c6fe0b29175286550549318340919/calendar.html";

  return (
    <div className="h-screen w-screen flex flex-col bg-[#09090b] text-white overflow-hidden select-none">
      {/* Top bar */}
      <header className="h-14 px-6 border-b border-zinc-800 bg-[#0e0e11] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-white px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition cursor-pointer"
          >
            <ArrowLeft size={14} /> Panel Principal
          </button>
          <button 
            onClick={() => router.push('/tv2')}
            className="flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-white px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition cursor-pointer"
          >
            Ver TV 2 Dashboard
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[#940028]" />
          <span className="font-bold text-xs tracking-wider uppercase font-mono">
            Calendario Oficial Helpdesk • Microsoft Outlook 365
          </span>
        </div>

        <a 
          href={calendarUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition"
        >
          Abrir en pestaña nueva <ExternalLink size={13} />
        </a>
      </header>

      {/* Embedded Outlook iframe */}
      <main className="flex-grow w-full h-0 min-h-0 bg-white relative overflow-hidden">
        <iframe 
          src={calendarUrl} 
          className="w-full h-full border-0 bg-white"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </main>
    </div>
  );
}
