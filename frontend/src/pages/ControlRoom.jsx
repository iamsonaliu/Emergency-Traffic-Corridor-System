import { useState, useEffect } from 'react'
import MapView from '../components/MapView'
import AmbulancePanel from '../components/AmbulancePanel'

// --- Mock data for demo -------------------------------------------------
const MOCK_EMERGENCY = {
  emergencyId: 'EMG-2024-0042',
  ambulanceId: 'ALPHA-ONE',
  status: 'en_route',
  selectedHospital: { name: 'AIIMS Delhi', etaMinutes: 7 },
  route: { totalDistanceKm: '4.2', polyline: null },
  signals: Array.from({ length: 6 }, (_, i) => ({ signalId: `SIG-${i + 1}` })),
}

const MOCK_SIGNALS = [
  { signalId: 'SIG-01', status: 'cleared',   location: { lat: 28.620, lng: 77.215 } },
  { signalId: 'SIG-02', status: 'preparing', location: { lat: 28.625, lng: 77.220 } },
  { signalId: 'SIG-03', status: 'normal',    location: { lat: 28.630, lng: 77.225 } },
  { signalId: 'SIG-04', status: 'normal',    location: { lat: 28.618, lng: 77.210 } },
  { signalId: 'SIG-05', status: 'cleared',   location: { lat: 28.622, lng: 77.218 } },
]

const MOCK_HOSPITALS = [
  { hospitalId: 'H01', name: 'AIIMS Delhi',     location: { lat: 28.5672, lng: 77.2100 }, distanceKm: 4.2, etaMinutes: 7,  availableBeds: 8,  totalEmergencyBeds: 10, status: 'available' },
  { hospitalId: 'H02', name: 'Safdarjung Hosp', location: { lat: 28.5685, lng: 77.2010 }, distanceKm: 5.1, etaMinutes: 10, availableBeds: 3,  totalEmergencyBeds: 10, status: 'available' },
  { hospitalId: 'H03', name: 'RML Hospital',    location: { lat: 28.6224, lng: 77.2167 }, distanceKm: 2.7, etaMinutes: 5,  availableBeds: 0,  totalEmergencyBeds: 10, status: 'full' },
]

// ------------------------------------------------------------------------
export default function ControlRoom() {
  const [ambulancePos] = useState([28.6139, 77.213])
  const [activeEmg, setActiveEmg] = useState(MOCK_EMERGENCY)
  const [logs, setLogs] = useState([
    { id: 1, time: '15:14:02', msg: 'Emergency EMG-2024-0042 triggered', type: 'alert' },
    { id: 2, time: '15:14:05', msg: 'ALPHA-ONE dispatched from Depot-3', type: 'info' },
    { id: 3, time: '15:14:08', msg: 'Corridor established: 6 signals cleared', type: 'success' },
    { id: 4, time: '15:14:30', msg: 'Ambulance en route — ETA 7 min', type: 'success' },
  ])

  // Simulate log ticking
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date().toLocaleTimeString('en-GB', { hour12: false })
      setLogs(prev => [
        ...prev.slice(-19),
        { id: Date.now(), time: now, msg: 'Telemetry sync OK — signal corridor active', type: 'info' },
      ])
    }, 8000)
    return () => clearInterval(id)
  }, [])

  const logColor = { alert: '#ef4444', info: '#6b7f7f', success: '#10b981' }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          center={[28.614, 77.213]}
          ambulancePos={ambulancePos}
          hospitalCandidates={MOCK_HOSPITALS}
          selectedHospital={MOCK_HOSPITALS[0]}
          signals={MOCK_SIGNALS}
          sectorLabel="SECTOR-4 / CENTRAL DELHI"
        />
        {/* Floating stats */}
        <div className="absolute bottom-4 left-4 z-[500] flex gap-2">
          {[
            { label: 'ACTIVE EMERGENCIES', value: '1' },
            { label: 'SIGNALS CLEARED', value: '2/6' },
            { label: 'ETA', value: '7 MIN' },
          ].map(({ label, value }) => (
            <div key={label}
              className="bg-[#0d0f0f]/90 border border-[#2d3f3f] px-3 py-2"
              style={{ backdropFilter: 'blur(6px)' }}
            >
              <div className="font-mono text-[9px] text-[#374444] tracking-widest mb-0.5">{label}</div>
              <div className="font-display font-bold text-sm text-[#10b981]">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <aside
        className="w-[260px] shrink-0 flex flex-col overflow-hidden"
        style={{ background: '#131616', borderLeft: '1px solid #1f2b2b' }}
      >
        <div className="px-3 py-2 border-b border-[#1f2b2b]">
          <span className="font-mono text-[10px] text-[#374444] tracking-widest">ACTIVE UNIT</span>
        </div>
        <div className="p-2">
          <AmbulancePanel emergency={activeEmg} onCancel={() => setActiveEmg(null)} />
        </div>

        <div className="px-3 py-2 border-t border-b border-[#1f2b2b]">
          <span className="font-mono text-[10px] text-[#374444] tracking-widest">EVENT LOG</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {[...logs].reverse().map(l => (
            <div key={l.id} className="font-mono text-[9px] leading-relaxed">
              <span style={{ color: '#374444' }}>{l.time}</span>{' '}
              <span style={{ color: logColor[l.type] || '#6b7f7f' }}>{l.msg}</span>
            </div>
          ))}
        </div>

        {/* Trigger button */}
        <div className="p-2 border-t border-[#1f2b2b]">
          <button
            onClick={() => setActiveEmg(MOCK_EMERGENCY)}
            className="w-full py-2 font-display font-bold text-[10px] tracking-widest transition-colors hover:opacity-90"
            style={{ background: '#065f46', color: '#10b981', border: '1px solid #10b981' }}
          >
            + TRIGGER EMERGENCY
          </button>
        </div>
      </aside>
    </div>
  )
}
