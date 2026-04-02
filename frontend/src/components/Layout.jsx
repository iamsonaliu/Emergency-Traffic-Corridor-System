import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSocket } from '../services/socket'

const NAV = [
  { to: '/dispatch',  label: 'DISPATCH' },
  { to: '/driver',    label: 'SIGNALS'  },
  { to: '/hospital',  label: 'MEDICAL'  },
  { to: '/traffic',   label: 'LOGS'     },
]

export default function Layout() {
  const { connected } = useSocket('control', 'main')
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB',{hour12:false}))
    tick(); const id = setInterval(tick,1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden" style={{background:'#0d0f0f'}}>
      {/* Sidebar */}
      <aside style={{background:'#131616',borderRight:'1px solid #1f2b2b'}}
        className="flex flex-col shrink-0 w-14 sm:w-[220px] z-50">
        {/* Logo */}
        <div style={{borderBottom:'1px solid #1f2b2b'}}
          className="flex items-center gap-2.5 px-3 sm:px-4 h-[52px] shrink-0">
          <div style={{background:'#065f46',border:'1px solid #10b981'}}
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0">
            <span style={{color:'#10b981'}} className="text-[10px] font-bold font-mono">MC</span>
          </div>
          <span style={{color:'#10b981'}} className="hidden sm:block font-display font-bold text-base tracking-wider whitespace-nowrap">
            MISSION CONTROL
          </span>
        </div>

        {/* Unit */}
        <div style={{borderBottom:'1px solid #1f2b2b'}}
          className="flex items-center gap-2.5 px-3 sm:px-4 py-3">
          <div style={{background:'rgba(6,95,70,0.4)',border:'1px solid rgba(16,185,129,0.4)'}}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
            <span style={{color:'#10b981'}} className="text-[9px] font-mono">A1</span>
          </div>
          <div className="hidden sm:block">
            <div style={{color:'#10b981'}} className="font-display font-bold text-sm tracking-widest">ALPHA-ONE</div>
            <div style={{color:'#6b7f7f'}} className="font-mono text-[10px] tracking-wider">ACTIVE OPS</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV.map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => [
              'flex items-center gap-2.5 px-3 sm:px-4 py-3',
              'font-display font-semibold text-xs tracking-[0.1em]',
              'border-l-[3px] transition-all duration-150 cursor-pointer',
              isActive
                ? 'border-l-[#10b981] bg-[rgba(16,185,129,0.05)]'
                : 'border-l-transparent hover:bg-[#1f2626]',
            ].join(' ')}
              style={({ isActive }) => ({ color: isActive ? '#10b981' : '#6b7f7f' })}
            >
              <NavIcon label={label} />
              <span className="hidden sm:block">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{borderTop:'1px solid #1f2b2b'}} className="p-2 sm:p-3 flex flex-col gap-2">
          <button style={{background:'#ef4444',color:'#fff'}}
            className="w-full font-display font-bold text-[10px] tracking-[0.1em] py-2.5 px-2 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            <span>⚠</span>
            <span className="hidden sm:block">EMERGENCY OVERRIDE</span>
          </button>
          <div className="hidden sm:flex flex-col gap-1">
            <button style={{color:'#374444'}} className="flex items-center gap-2 px-2 py-1 font-display text-[10px] tracking-widest hover:text-[#6b7f7f] transition-colors">
              ? SUPPORT
            </button>
            <button style={{color:'#374444'}} className="flex items-center gap-2 px-2 py-1 font-display text-[10px] tracking-widest hover:text-[#6b7f7f] transition-colors">
              → EXIT
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header style={{background:'#131616',borderBottom:'1px solid #1f2b2b'}}
          className="h-[52px] shrink-0 flex items-center px-4 gap-4 z-40">
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {NAV.map(({ to, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => [
                  'px-3 py-1 font-display font-semibold text-[11px] tracking-widest',
                  'border-b-2 whitespace-nowrap transition-all duration-150',
                  isActive ? 'border-b-[#10b981]' : 'border-b-transparent hover:border-b-[#2d3f3f]',
                ].join(' ')}
                style={({ isActive }) => ({ color: isActive ? '#10b981' : '#6b7f7f' })}
              >
                {label}
              </NavLink>
            ))}
          </div>

          {/* Right */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div style={{background:'#1a1e1e',border:'1px solid #2d3f3f'}}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${connected?'animate-pulse-green':'animate-pulse-red'}`}
                style={{background: connected?'#10b981':'#ef4444'}} />
              <span style={{color:'#10b981'}} className="font-mono text-[10px] tracking-wider whitespace-nowrap">
                {connected ? 'SYSTEM_STATUS_NOMINAL' : 'DISCONNECTED'}
              </span>
            </div>
            <span style={{color:'#374444'}} className="hidden md:block font-mono text-[10px]">{time}</span>
            {['🔔','⚙','📡'].map(ic => (
              <button key={ic} style={{background:'#1a1e1e',border:'1px solid #1f2b2b',color:'#6b7f7f'}}
                className="w-7 h-7 flex items-center justify-center text-xs hover:border-[#2d3f3f] transition-all">
                {ic}
              </button>
            ))}
            <div style={{background:'#1a1e1e',border:'1px solid #2d3f3f'}}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs">👤</div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavIcon({ label }) {
  const icons = { DISPATCH:'◎', SIGNALS:'⌖', MEDICAL:'✚', LOGS:'≡' }
  return <span className="w-4 h-4 shrink-0 flex items-center justify-center text-xs">{icons[label]||'•'}</span>
}