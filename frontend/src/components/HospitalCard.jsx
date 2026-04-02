export default function HospitalCard({ hospital, selected, onClick }) {
  const total = hospital.totalEmergencyBeds || 10
  const avail = hospital.availableBeds ?? hospital.availableEmergencyBeds ?? 0
  const pct   = Math.round((avail / total) * 100)
  const barColor = pct > 60 ? '#10b981' : pct > 30 ? '#f59e0b' : '#ef4444'
  const isAvail  = hospital.status === 'available' && avail > 0

  return (
    <div
      onClick={onClick}
      className={`
        border p-3 mb-2 cursor-pointer transition-all duration-150
        ${selected
          ? 'border-[#10b981] bg-[#10b981]/5'
          : 'border-[#1f2b2b] bg-[#1a1e1e] hover:border-[#2d3f3f]'}
      `}
    >
      {/* Name + distance */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-display font-bold text-[13px] tracking-wider text-[#e2e8e8] truncate">
          {hospital.name?.toUpperCase()}
        </span>
        <span className="font-mono text-[10px] text-[#6b7f7f] ml-2 shrink-0">
          {hospital.distanceKm?.toFixed(1) ?? '—'} KM
        </span>
      </div>

      {/* Meta row */}
      <div className="flex gap-4 mb-2">
        <span className="font-mono text-[10px] text-[#6b7f7f]">
          ER CAP:{' '}
          <span style={{ color: barColor }} className="font-semibold">
            {pct}%
          </span>
        </span>
        <span className="font-mono text-[10px] text-[#6b7f7f]">
          TRAUMA:{' '}
          <span className={`font-semibold ${isAvail ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
            {isAvail ? 'LEVEL 1' : hospital.status === 'full' ? 'FULL' : 'N/R'}
          </span>
        </span>
        <span className="font-mono text-[10px] text-[#6b7f7f] ml-auto">
          ETA: <span className="text-[#e2e8e8]">{hospital.etaMinutes}m</span>
        </span>
      </div>

      {/* Capacity bar */}
      <div className="h-[3px] bg-[#0d0f0f] rounded-sm overflow-hidden">
        <div
          className="h-full rounded-sm transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  )
}