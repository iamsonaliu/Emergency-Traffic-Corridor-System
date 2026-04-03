import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useSocket } from '../services/socket'
import OfflineDimmer from './OfflineDimmer'

const NAV = [
  { to: '/dispatch',  label: 'CONTROL ROOM',  icon: '⊞' },
  { to: '/driver',    label: 'AMBULANCE VIEW', icon: '✱' },
  { to: '/hospital',  label: 'HOSPITAL ADMIN', icon: '✚' },
  { to: '/traffic',   label: 'TRAFFIC ADMIN',  icon: '🚦' }, // Custom icon equivalent
]

export default function Layout() {
  const { connected } = useSocket('control', 'main')
  const [time, setTime] = useState('')
  const location = useLocation()

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB',{hour12:false}))
    tick(); const id = setInterval(tick,1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden" style={{background:'#0d0f0f'}}>
      <OfflineDimmer />
      
      {/* Sidebar */}
      <aside style={{background:'#131616', borderRight:'1px solid #1f2b2b', width: '260px'}}
        className="flex flex-col shrink-0 z-50">
        
        {/* Profile / Avatar Sector */}
        <div className="flex items-center gap-3 px-6 py-6 h-24 border-b border-[#1f2b2b]">
          <div style={{background:'#1a1e1e', border:'1px solid #2d3f3f'}}
            className="w-10 h-10 shrink-0 flex items-center justify-center overflow-hidden">
            <span style={{color: '#6b7f7f', fontSize: '20px'}}>👤</span>
          </div>
          <div className="flex flex-col">
            <span style={{color:'#e2e8e8'}} className="font-display font-bold text-sm tracking-[0.15em] leading-tight hover:text-[#4DEEEA] transition-colors cursor-pointer">
              MISSION CONTROL
            </span>
            <span style={{color:'#6b7f7f'}} className="font-mono text-[11px] tracking-widest mt-1">
              SECTOR_7G
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => [
              'flex items-center gap-4 px-6 py-4',
              'font-display font-semibold text-xs tracking-[0.15em]',
              'border-l-[3px] transition-all duration-150 cursor-pointer',
              isActive
                ? 'border-l-[#4DEEEA] bg-[rgba(77,238,234,0.05)] text-[#4DEEEA]' // Active Cyan
                : 'border-l-transparent text-[#6b7f7f] hover:bg-[#1f2626] hover:text-[#e2e8e8]',
            ].join(' ')}
            >
              <span className="w-4 h-4 flex items-center justify-center text-sm">{icon}</span>
              <span className="whitespace-nowrap">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer / Logout */}
        <div className="px-6 py-6 border-t border-[#1f2b2b]">
          <button style={{color:'#6b7f7f'}} className="flex items-center gap-3 font-display font-bold text-[11px] tracking-widest hover:text-[#e2e8e8] transition-colors">
            <span className="text-lg">☄</span> LOGOUT
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Top Header Bar */}
        <header style={{background:'#0d0f0f', borderBottom:'1px solid #1f2b2b'}}
          className="h-14 shrink-0 flex items-center px-6 gap-8 z-40">
          
          <div className="flex items-center gap-6 border-r border-[#1f2b2b] pr-6">
            <span style={{color:'#e2e8e8'}} className="font-display font-bold text-[15px] tracking-[0.2em]">
              ETCS COMMAND
            </span>
          </div>

          {/* Metrics Top Center */}
          <div className="flex gap-8 font-mono text-[10px] tracking-widest uppercase">
            <div className="flex gap-2">
              <span style={{color: '#6b7f7f'}}>CORRIDORS:</span>
              <span style={{color: '#4DEEEA'}}>03</span>
            </div>
            <div className="flex gap-2">
              <span style={{color: '#6b7f7f'}}>AMBULANCES:</span>
              <span style={{color: '#4DEEEA'}}>12</span>
            </div>
            <div className="flex gap-2">
              <span style={{color: '#6b7f7f'}}>INCIDENTS:</span>
              <span style={{color: '#ef4444'}}>05</span>
            </div>
          </div>

          {/* Right Header Area */}
          <div className="ml-auto flex items-center gap-4 shrink-0">
             <div className="flex items-center gap-2 mr-4 opacity-70">
              <span className={`w-1.5 h-1.5 rounded-full ${connected?'bg-[#4DEEEA] animate-pulse-green':'bg-[#ef4444]'}`} />
              <span style={{color:'#6b7f7f'}} className="font-mono text-[10px] tracking-wider whitespace-nowrap">
                {connected ? `SYSTEM_LIVE: ${time}` : 'DISCONNECTED'}
              </span>
            </div>
            <button className="text-[#e2e8e8] hover:text-[#4DEEEA] transition-colors">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
            </button>
            <button className="text-[#e2e8e8] hover:text-[#4DEEEA] transition-colors">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22l-1.92 3.32c-.12.21-.07.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .43-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
            </button>
          </div>
        </header>

        {/* Content View with padding applied per-page, or strict boundaries */}
        <main className="flex-1 overflow-hidden relative">
          {/* Subtle Corner Brackets purely for Sci-Fi aesthetic overlay */}
          <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#1f2b2b] pointer-events-none z-10" />
          <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#1f2b2b] pointer-events-none z-10" />
          <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#1f2b2b] pointer-events-none z-10" />
          <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#1f2b2b] pointer-events-none z-10" />
          
          <div className="h-full w-full p-4 overflow-y-auto overflow-x-hidden">
             <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}