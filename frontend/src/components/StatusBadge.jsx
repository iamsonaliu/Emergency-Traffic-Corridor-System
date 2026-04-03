import React from 'react'
import { LiveDot } from './LiveDot'

export function StatusBadge({ status, label, pulse = null }) {
  const normalized = status.toLowerCase()
  
  const map = {
    active: { bg: 'bg-[#00FF88]/10', border: 'border-[#00FF88]', text: 'text-[#00FF88]', dotColor: 'green', showDot: true, defaultPulse: true },
    critical: { bg: 'bg-[#FF3333]/10', border: 'border-[#FF3333]', text: 'text-[#FF3333]', dotColor: 'red', showDot: true, defaultPulse: true },
    idle: { bg: 'bg-[#FFB800]/10', border: 'border-[#FFB800]', text: 'text-[#FFB800]', dotColor: 'amber', showDot: true, defaultPulse: false },
    offline: { bg: 'bg-[#445566]/20', border: 'border-[#445566]', text: 'text-[#8899BB]', dotColor: null, showDot: false, defaultPulse: false },
    accepted: { bg: 'bg-[#00FF88]/10', border: 'border-[#00FF88]', text: 'text-[#00FF88]', dotColor: null, showDot: false, defaultPulse: false },
    rejected: { bg: 'bg-[#FF3333]/10', border: 'border-[#FF3333]', text: 'text-[#FF3333]', dotColor: null, showDot: false, defaultPulse: false },
    pending: { bg: 'bg-[#FFB800]/10', border: 'border-[#FFB800]', text: 'text-[#FFB800]', dotColor: null, showDot: false, defaultPulse: false }
  }

  const style = map[normalized] || map.offline
  const isPulsing = pulse !== null ? pulse : style.defaultPulse

  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1 border rounded-full font-display font-medium text-[11px] tracking-widest uppercase ${style.bg} ${style.border} ${style.text} ${isPulsing && style.text === 'text-[#FF3333]' ? 'animate-pulse' : ''} ${isPulsing && style.text === 'text-[#FFB800]' ? 'animate-pulse' : ''}`}>
      {style.showDot && <LiveDot color={style.dotColor} size="sm" />}
      {label || normalized}
    </div>
  )
}
