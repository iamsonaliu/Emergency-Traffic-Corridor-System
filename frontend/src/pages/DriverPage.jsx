import { useState, useEffect } from 'react'
import TrafficSignal from '../components/TrafficSignal'
import MapView from '../components/MapView'

// Delhi signals mock data
const INITIAL_SIGNALS = [
  { signalId: 'SIG-N-001', intersection: 'Connaught Place N', status: 'cleared',   location: { lat: 28.6330, lng: 77.2194 }, phase: 38 },
  { signalId: 'SIG-S-002', intersection: 'Safdarjung Flyover', status: 'preparing', location: { lat: 28.5714, lng: 77.2161 }, phase: 22 },
  { signalId: 'SIG-E-003', intersection: 'India Gate E',        status: 'normal',   location: { lat: 28.6129, lng: 77.2295 }, phase: 60 },
  { signalId: 'SIG-W-004', intersection: 'Dhaula Kuan W',       status: 'normal',   location: { lat: 28.5933, lng: 77.1672 }, phase: 45 },
  { signalId: 'SIG-C-005', intersection: 'Rajpath Centre',      status: 'cleared',  location: { lat: 28.6129, lng: 77.2096 }, phase: 15 },
  { signalId: 'SIG-R-006', intersection: 'Ring Road Jn.',        status: 'normal',   location: { lat: 28.6000, lng: 77.1900 }, phase: 55 },
]

const statusOrder = ['cleared', 'preparing', 'normal']
const nextStatus = { cleared: 'normal', preparing: 'cleared', normal: 'preparing' }

export default function DriverPage() {
  const [signals, setSignals] = useState(INITIAL_SIGNALS)
  const [selected, setSelected] = useState(null)
  const [overrideActive, setOverrideActive] = useState(false)

  const override = (id) => {
    setSignals(prev =>
      prev.map(s => s.signalId === id ? { ...s, status: 'cleared' } : s)
    )
  }

  const cycle = (id) => {
    setSignals(prev =>
      prev.map(s => s.signalId === id ? { ...s, status: nextStatus[s.status] || 'normal' } : s)
    )
  }

  // Auto-advance phases
  useEffect(() => {
    const id = setInterval(() => {
      setSignals(prev => prev.map(s => ({
        ...s,
        phase: Math.max(0, s.phase - 1),
      })))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const cleared   = signals.filter(s => s.status === 'cleared').length
  const preparing = signals.filter(s => s.status === 'preparing').length

  return (
    <div className="h-full flex overflow-hidden">
      {/* Signals list */}
      <div
        className="w-[320px] shrink-0 flex flex-col overflow-hidden"
        style={{ background: '#131616', borderRight: '1px solid #1f2b2b' }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1f2b2b]">
          <div className="font-mono text-[10px] text-[#374444] tracking-widest mb-1">CORRIDOR SIGNALS</div>
          <div className="flex gap-3">
            <span className="font-mono text-[10px] text-[#10b981]">✔ {cleared} CLEARED</span>
            <span className="font-mono text-[10px] text-[#f59e0b]">⬤ {preparing} PREPARING</span>
          </div>
        </div>

        {/* Emergency corridor toggle */}
        <div className="px-3 py-2 border-b border-[#1f2b2b]">
          <button
            onClick={() => {
              setOverrideActive(v => !v)
              if (!overrideActive) setSignals(prev => prev.map(s => ({ ...s, status: 'cleared' })))
              else setSignals(INITIAL_SIGNALS)
            }}
            className="w-full py-2 font-display font-bold text-[10px] tracking-widest transition-all hover:opacity-90"
            style={{
              background: overrideActive ? '#7f1d1d' : '#065f46',
              color: overrideActive ? '#ef4444' : '#10b981',
              border: `1px solid ${overrideActive ? '#ef4444' : '#10b981'}`,
            }}
          >
            {overrideActive ? '⚠ DEACTIVATE CORRIDOR' : '◎ ACTIVATE FULL CORRIDOR'}
          </button>
        </div>

        {/* Signal list */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
          {signals.map(s => (
            <div
              key={s.signalId}
              onClick={() => setSelected(s.signalId === selected ? null : s.signalId)}
              className="border p-2 cursor-pointer transition-all"
              style={{
                background: selected === s.signalId ? '#1f2b2b' : '#1a1e1e',
                borderColor: selected === s.signalId ? '#2d3f3f' : '#1f2b2b',
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[9px] text-[#6b7f7f]">{s.signalId}</span>
                <TrafficSignal status={s.status} compact />
              </div>
              <div className="font-display text-[11px] text-[#e2e8e8] font-semibold mb-1.5">
                {s.intersection}
              </div>
              {/* Phase countdown bar */}
              <div className="h-[2px] bg-[#0d0f0f] mb-2">
                <div
                  className="h-full transition-all duration-1000"
                  style={{
                    width: `${(s.phase / 60) * 100}%`,
                    background: s.status === 'cleared' ? '#10b981' : s.status === 'preparing' ? '#f59e0b' : '#374444',
                  }}
                />
              </div>
              {selected === s.signalId && (
                <div className="flex gap-1.5 mt-1">
                  <button
                    onClick={e => { e.stopPropagation(); override(s.signalId) }}
                    className="flex-1 py-1 font-mono text-[9px] tracking-widest hover:opacity-80 transition-opacity"
                    style={{ background: '#065f46', color: '#10b981', border: '1px solid #10b981' }}
                  >
                    CLEAR
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); cycle(s.signalId) }}
                    className="flex-1 py-1 font-mono text-[9px] tracking-widest hover:opacity-80 transition-opacity"
                    style={{ background: '#1a1e1e', color: '#6b7f7f', border: '1px solid #2d3f3f' }}
                  >
                    CYCLE
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          center={[28.614, 77.209]}
          signals={signals}
          sectorLabel="SIGNAL CONTROL / CENTRAL DELHI"
        >
          {/* Legend overlay */}
          <div className="absolute bottom-4 right-4 z-[500] bg-[#0d0f0f]/90 border border-[#2d3f3f] p-3"
            style={{ backdropFilter: 'blur(6px)' }}
          >
            <div className="font-mono text-[9px] text-[#374444] tracking-widest mb-2">SIGNAL STATUS</div>
            {[
              { color: '#10b981', label: 'CLEARED — corridor open' },
              { color: '#f59e0b', label: 'PREPARING — transitioning' },
              { color: '#374444', label: 'NORMAL — standard op' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2 mb-1">
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span className="font-mono text-[9px]" style={{ color }}>{label}</span>
              </div>
            ))}
          </div>
        </MapView>
      </div>
    </div>
  )
}
