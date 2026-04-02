import { useState, useEffect } from 'react'
import HospitalCard from '../components/HospitalCard'

const MOCK_HOSPITALS = [
  { hospitalId: 'H01', name: 'AIIMS Delhi',        distanceKm: 4.2,  etaMinutes: 7,  availableBeds: 8,  totalEmergencyBeds: 10, status: 'available', speciality: 'TRAUMA L1', location: { lat: 28.5672, lng: 77.21 } },
  { hospitalId: 'H02', name: 'Safdarjung Hospital', distanceKm: 5.1,  etaMinutes: 10, availableBeds: 3,  totalEmergencyBeds: 10, status: 'available', speciality: 'CARDIAC'  , location: { lat: 28.5685, lng: 77.20 } },
  { hospitalId: 'H03', name: 'RML Hospital',        distanceKm: 2.7,  etaMinutes: 5,  availableBeds: 0,  totalEmergencyBeds: 10, status: 'full',      speciality: 'FULL',     location: { lat: 28.6224, lng: 77.21 } },
  { hospitalId: 'H04', name: 'Max Saket',           distanceKm: 7.8,  etaMinutes: 15, availableBeds: 12, totalEmergencyBeds: 15, status: 'available', speciality: 'NEURO',    location: { lat: 28.5300, lng: 77.21 } },
  { hospitalId: 'H05', name: 'Apollo Indraprastha', distanceKm: 6.4,  etaMinutes: 12, availableBeds: 5,  totalEmergencyBeds: 12, status: 'available', speciality: 'TRAUMA L2', location: { lat: 28.6377, lng: 77.28 } },
]

const INCOMING = [
  { id: 'PT-001', unit: 'ALPHA-ONE', hospital: 'H01', eta: 7,  type: 'CARDIAC ARREST',  severity: 'critical' },
  { id: 'PT-002', unit: 'BRAVO-TWO', hospital: 'H05', eta: 12, type: 'ROAD TRAUMA',     severity: 'high' },
  { id: 'PT-003', unit: 'CHARLIE-3', hospital: 'H02', eta: 10, type: 'STROKE SYMPTOMS', severity: 'high' },
]

const sevColor = { critical: '#ef4444', high: '#f59e0b', medium: '#10b981' }

export default function HospitalPortal() {
  const [selected, setSelected] = useState('H01')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left: incoming patients */}
      <div
        className="w-[320px] shrink-0 flex flex-col overflow-hidden"
        style={{ background: '#131616', borderRight: '1px solid #1f2b2b' }}
      >
        <div className="px-4 py-3 border-b border-[#1f2b2b] flex items-center justify-between">
          <span className="font-mono text-[10px] text-[#374444] tracking-widest">INCOMING PATIENTS</span>
          <span className="font-mono text-[10px] text-[#10b981]">{INCOMING.length} ACTIVE</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {INCOMING.map(p => {
            const etaLeft = Math.max(0, p.eta - Math.floor(tick / 12))
            return (
              <div key={p.id}
                className="border p-3"
                style={{ background: '#1a1e1e', borderColor: sevColor[p.severity] + '55' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-[#6b7f7f]">{p.id}</span>
                  <span
                    className="font-display font-bold text-[9px] tracking-widest px-2 py-0.5"
                    style={{ background: sevColor[p.severity] + '22', color: sevColor[p.severity], border: `1px solid ${sevColor[p.severity]}55` }}
                  >
                    {p.severity.toUpperCase()}
                  </span>
                </div>
                <div className="font-display font-semibold text-[12px] text-[#e2e8e8] mb-1">{p.type}</div>
                <div className="flex gap-4">
                  <span className="font-mono text-[10px] text-[#6b7f7f]">UNIT: <span className="text-[#10b981]">{p.unit}</span></span>
                  <span className="font-mono text-[10px] text-[#6b7f7f]">ETA: <span className="text-[#f59e0b]">{etaLeft}m</span></span>
                </div>
                {/* eta bar */}
                <div className="mt-2 h-[2px] bg-[#1f2b2b] relative overflow-hidden">
                  <div
                    className="h-full transition-all duration-1000"
                    style={{ width: `${100 - (tick / 12 / p.eta) * 100}%`, background: sevColor[p.severity] }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Stats */}
        <div className="border-t border-[#1f2b2b] grid grid-cols-3 divide-x divide-[#1f2b2b]">
          {[{ l: 'CRITICAL', v: '1', c: '#ef4444' }, { l: 'HIGH', v: '2', c: '#f59e0b' }, { l: 'STABLE', v: '0', c: '#10b981' }].map(({ l, v, c }) => (
            <div key={l} className="px-3 py-2">
              <div className="font-mono text-[9px] text-[#374444]">{l}</div>
              <div className="font-display font-bold text-lg" style={{ color: c }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: hospitals */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1f2b2b] flex items-center gap-4" style={{ background: '#131616' }}>
          <span className="font-mono text-[10px] text-[#374444] tracking-widest">HOSPITAL NETWORK</span>
          <span className="font-mono text-[10px] text-[#6b7f7f]">{MOCK_HOSPITALS.filter(h => h.status === 'available').length} / {MOCK_HOSPITALS.length} AVAILABLE</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {MOCK_HOSPITALS.map(h => (
              <HospitalCard key={h.hospitalId} hospital={h} selected={selected === h.hospitalId} onClick={() => setSelected(h.hospitalId)} />
            ))}
          </div>
        </div>

        {/* Selected hospital detail */}
        {selected && (() => {
          const h = MOCK_HOSPITALS.find(x => x.hospitalId === selected)
          if (!h) return null
          return (
            <div className="border-t border-[#1f2b2b] p-4 flex items-center gap-6" style={{ background: '#131616' }}>
              <div>
                <div className="font-mono text-[9px] text-[#374444] mb-0.5">SELECTED DESTINATION</div>
                <div className="font-display font-bold text-base text-[#10b981]">{h.name.toUpperCase()}</div>
              </div>
              <div className="font-mono text-[10px] text-[#6b7f7f]">
                SPECIALTY: <span className="text-[#e2e8e8]">{h.speciality}</span>
              </div>
              <div className="font-mono text-[10px] text-[#6b7f7f]">
                BEDS: <span className="text-[#e2e8e8]">{h.availableBeds} / {h.totalEmergencyBeds}</span>
              </div>
              <button
                className="ml-auto py-2 px-4 font-display font-bold text-[10px] tracking-widest hover:opacity-90 transition-opacity"
                style={{ background: '#065f46', color: '#10b981', border: '1px solid #10b981' }}
              >
                ASSIGN DESTINATION
              </button>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
