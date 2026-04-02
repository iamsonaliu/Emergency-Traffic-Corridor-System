import { useState, useEffect } from 'react'

// ---- Mock data -------------------------------------------------------
const MOCK_EVENTS = [
  { id: 'EVT-001', time: '15:12:44', type: 'EMERGENCY_TRIGGERED', unit: 'ALPHA-ONE', details: 'Cardiac arrest reported, Connaught Place', severity: 'critical' },
  { id: 'EVT-002', time: '15:12:47', type: 'CORRIDOR_INITIATED',  unit: 'SYSTEM',   details: '6 signals selected for corridor',         severity: 'info' },
  { id: 'EVT-003', time: '15:12:50', type: 'SIGNAL_CLEARED',      unit: 'SIG-N-001',details: 'Green phase extended to 60s',             severity: 'success' },
  { id: 'EVT-004', time: '15:12:55', type: 'HOSPITAL_SELECTED',   unit: 'AIIMS',    details: 'ETA 7 min, 8 beds available',             severity: 'success' },
  { id: 'EVT-005', time: '15:13:10', type: 'SIGNAL_CLEARED',      unit: 'SIG-S-002',details: 'Green phase extended to 60s',             severity: 'success' },
  { id: 'EVT-006', time: '15:13:22', type: 'TELEMETRY_SYNC',      unit: 'SYSTEM',   details: 'All units GPS lock confirmed',            severity: 'info' },
  { id: 'EVT-007', time: '15:14:00', type: 'AMBULANCE_UPDATE',    unit: 'ALPHA-ONE',details: 'Speed 68 km/h | 3.1 km remaining',       severity: 'info' },
]

const DAILY_STATS = [
  { label: 'EMERGENCIES TODAY',  value: '12',    delta: '+3',  up: true  },
  { label: 'AVG RESPONSE TIME',  value: '4.8m',  delta: '-0.6m', up: true },
  { label: 'SIGNALS OVERRIDDEN', value: '84',    delta: '+11', up: false },
  { label: 'LIVES ASSISTED',     value: '12',    delta: '+3',  up: true  },
]

const INTERSECTIONS = [
  { id: 'SIG-N-001', name: 'Connaught Place N', activations: 8,  avgClear: '12s', violations: 0 },
  { id: 'SIG-S-002', name: 'Safdarjung Flyover',activations: 5,  avgClear: '18s', violations: 1 },
  { id: 'SIG-E-003', name: 'India Gate E',       activations: 3,  avgClear: '9s',  violations: 0 },
  { id: 'SIG-W-004', name: 'Dhaula Kuan W',      activations: 2,  avgClear: '21s', violations: 0 },
  { id: 'SIG-C-005', name: 'Rajpath Centre',     activations: 7,  avgClear: '11s', violations: 2 },
  { id: 'SIG-R-006', name: 'Ring Road Jn.',      activations: 4,  avgClear: '14s', violations: 0 },
]

const sevColor = { critical: '#ef4444', info: '#6b7f7f', success: '#10b981', warning: '#f59e0b' }

// ---- simple sparkline from random data --------------------------------
function MiniSparkline({ color }) {
  const pts = Array.from({ length: 12 }, (_, i) => 20 + Math.round(Math.sin(i * 0.7) * 8 + Math.random() * 6))
  const max = Math.max(...pts), min = Math.min(...pts)
  const W = 120, H = 28
  const coords = pts
    .map((v, i) => `${(i / (pts.length - 1)) * W},${H - ((v - min) / (max - min || 1)) * H}`)
    .join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
      <polyline fill="none" stroke={color} strokeWidth={1.5} points={coords} opacity={0.9} />
    </svg>
  )
}

// ---- Component -------------------------------------------------------
export default function TrafficDashboard() {
  const [logs, setLogs] = useState(MOCK_EVENTS)
  const [filter, setFilter] = useState('ALL')
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-GB', { hour12: false }))

  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString('en-GB', { hour12: false })), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date().toLocaleTimeString('en-GB', { hour12: false })
      const msgs = [
        { type: 'TELEMETRY_SYNC', unit: 'SYSTEM',    details: 'Heartbeat OK — all nodes responsive', severity: 'info' },
        { type: 'SIGNAL_CLEARED', unit: `SIG-${Math.floor(Math.random()*6)+1}-00${Math.floor(Math.random()*9)}`, details: 'Phase extended', severity: 'success' },
        { type: 'AMBULANCE_UPDATE', unit: 'ALPHA-ONE', details: `Speed ${50 + Math.floor(Math.random()*30)} km/h`, severity: 'info' },
      ]
      const pick = msgs[Math.floor(Math.random() * msgs.length)]
      setLogs(prev => [{ id: `EVT-${Date.now()}`, time: now, ...pick }, ...prev.slice(0, 49)])
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const TYPES = ['ALL', 'EMERGENCY_TRIGGERED', 'CORRIDOR_INITIATED', 'SIGNAL_CLEARED', 'HOSPITAL_SELECTED', 'TELEMETRY_SYNC', 'AMBULANCE_UPDATE']
  const filtered = filter === 'ALL' ? logs : logs.filter(l => l.type === filter)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top stats bar */}
      <div className="shrink-0 grid grid-cols-4 divide-x divide-[#1f2b2b] border-b border-[#1f2b2b]" style={{ background: '#131616' }}>
        {DAILY_STATS.map(({ label, value, delta, up }) => (
          <div key={label} className="px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-mono text-[9px] text-[#374444] tracking-widest mb-0.5">{label}</div>
              <div className="font-display font-bold text-2xl text-[#e2e8e8]">{value}</div>
              <span className="font-mono text-[9px]" style={{ color: up ? '#10b981' : '#ef4444' }}>{delta} today</span>
            </div>
            <MiniSparkline color={up ? '#10b981' : '#f59e0b'} />
          </div>
        ))}
      </div>

      {/* Body: log + intersection table */}
      <div className="flex-1 flex overflow-hidden">
        {/* Event log */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-[#1f2b2b]">
          {/* Filter chips */}
          <div className="shrink-0 px-3 py-2 border-b border-[#1f2b2b] flex gap-1.5 overflow-x-auto" style={{ background: '#131616' }}>
            {TYPES.slice(0, 6).map(t => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="font-mono text-[9px] tracking-widest px-2 py-0.5 whitespace-nowrap transition-all"
                style={{
                  background: filter === t ? '#065f46' : '#1a1e1e',
                  color: filter === t ? '#10b981' : '#374444',
                  border: `1px solid ${filter === t ? '#10b981' : '#1f2b2b'}`,
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ background: '#0d0f0f' }}>
                  {['TIME', 'TYPE', 'UNIT', 'DETAILS'].map(h => (
                    <th key={h} className="font-mono text-[9px] text-[#374444] tracking-widest px-3 py-2 sticky top-0"
                      style={{ background: '#0d0f0f', borderBottom: '1px solid #1f2b2b' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id}
                    className="hover:bg-[#1f2626] transition-colors"
                    style={{ borderBottom: '1px solid #0d0f0f' }}
                  >
                    <td className="font-mono text-[10px] text-[#374444] px-3 py-1.5 whitespace-nowrap">{e.time}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className="font-mono text-[9px] px-1.5 py-0.5 tracking-wider"
                        style={{ color: sevColor[e.severity], background: sevColor[e.severity] + '18', border: `1px solid ${sevColor[e.severity]}44` }}>
                        {e.type}
                      </span>
                    </td>
                    <td className="font-mono text-[10px] text-[#10b981] px-3 py-1.5 whitespace-nowrap">{e.unit}</td>
                    <td className="font-mono text-[10px] text-[#6b7f7f] px-3 py-1.5">{e.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-4 py-2 border-t border-[#1f2b2b] flex items-center justify-between" style={{ background: '#131616' }}>
            <span className="font-mono text-[9px] text-[#374444]">{filtered.length} EVENTS</span>
            <span className="font-mono text-[9px] text-[#374444]">LAST SYNC {time}</span>
          </div>
        </div>

        {/* Intersection performance table */}
        <div className="w-[300px] shrink-0 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1f2b2b]" style={{ background: '#131616' }}>
            <span className="font-mono text-[10px] text-[#374444] tracking-widest">INTERSECTION STATS</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {INTERSECTIONS.map((x, i) => (
              <div key={x.id} className="px-4 py-3 border-b border-[#1f2b2b] hover:bg-[#1f2626] transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[9px] text-[#374444]">{x.id}</span>
                  {x.violations > 0 && (
                    <span className="font-mono text-[9px] text-[#ef4444]">⚠ {x.violations}</span>
                  )}
                </div>
                <div className="font-display font-semibold text-[11px] text-[#e2e8e8] mb-1.5">{x.name}</div>
                <div className="flex gap-4">
                  <span className="font-mono text-[9px] text-[#6b7f7f]">ACT: <span className="text-[#10b981]">{x.activations}</span></span>
                  <span className="font-mono text-[9px] text-[#6b7f7f]">AVG: <span className="text-[#e2e8e8]">{x.avgClear}</span></span>
                </div>
                {/* activation bar */}
                <div className="mt-1.5 h-[2px] bg-[#1f2b2b]">
                  <div className="h-full bg-[#10b981]" style={{ width: `${(x.activations / 10) * 100}%`, opacity: 0.7 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
