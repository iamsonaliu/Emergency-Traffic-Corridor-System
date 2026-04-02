export default function AmbulancePanel({ emergency, onCancel }) {
  if (!emergency) {
    return (
      <div className="bg-[#1a1e1e] border border-[#1f2b2b] p-4 text-center">
        <div className="font-mono text-[10px] text-[#374444] tracking-widest mb-1">NO ACTIVE EMERGENCY</div>
        <div className="font-mono text-[9px] text-[#1f2b2b]">SYSTEM STANDBY</div>
      </div>
    )
  }

  const statusColor = {
    triggered:'text-[#ef4444]', processing:'text-[#f59e0b]',
    en_route:'text-[#10b981]', completed:'text-[#6b7f7f]', cancelled:'text-[#374444]',
  }[emergency.status] || 'text-[#e2e8e8]'

  return (
    <div className="bg-[#1a1e1e] border border-[#2d3f3f] animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1f2b2b]">
        <span className="font-mono text-[10px] text-[#6b7f7f] tracking-widest">{emergency.emergencyId}</span>
        <span className={`font-display font-bold text-[10px] tracking-widest ${statusColor}`}>
          {emergency.status?.toUpperCase().replace('_',' ')}
        </span>
      </div>

      {/* Unit */}
      <div className="px-3 py-2 border-b border-[#1f2b2b]">
        <div className="font-mono text-[9px] text-[#374444] mb-0.5">UNIT</div>
        <div className="font-display font-bold text-sm text-[#10b981]">{emergency.ambulanceId}</div>
      </div>

      {/* Destination */}
      {emergency.selectedHospital && (
        <div className="px-3 py-2 border-b border-[#1f2b2b]">
          <div className="font-mono text-[9px] text-[#374444] mb-0.5">DESTINATION</div>
          <div className="font-display font-semibold text-[12px] text-[#e2e8e8] truncate">
            {emergency.selectedHospital.name}
          </div>
          <div className="font-mono text-[9px] text-[#10b981]">
            ETA {emergency.selectedHospital.etaMinutes} MIN
          </div>
        </div>
      )}

      {/* Route stats */}
      {emergency.route && (
        <div className="grid grid-cols-2 gap-px border-b border-[#1f2b2b]">
          <div className="px-3 py-2 bg-[#161b1b]">
            <div className="font-mono text-[9px] text-[#374444] mb-0.5">DISTANCE</div>
            <div className="font-mono text-sm text-[#e2e8e8]">{emergency.route.totalDistanceKm} km</div>
          </div>
          <div className="px-3 py-2 bg-[#161b1b]">
            <div className="font-mono text-[9px] text-[#374444] mb-0.5">SIGNALS</div>
            <div className="font-mono text-sm text-[#e2e8e8]">{emergency.signals?.length || 0}</div>
          </div>
        </div>
      )}

      {/* Cancel */}
      {['triggered','processing','en_route'].includes(emergency.status) && (
        <div className="p-2">
          <button
            onClick={() => onCancel?.(emergency.emergencyId)}
            className="w-full py-2 text-[#ef4444] border border-[#7f1d1d] font-display font-bold text-[10px] tracking-widest hover:bg-[#ef4444]/10 transition-colors"
          >
            CANCEL EMERGENCY
          </button>
        </div>
      )}
    </div>
  )
}