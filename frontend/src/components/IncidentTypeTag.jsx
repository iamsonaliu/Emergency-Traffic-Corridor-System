import React from 'react'

export function IncidentTypeTag({ type }) {
  const normalized = (type || 'GENERAL').toUpperCase()
  
  const map = {
    CARDIAC: { border: 'border-[#FF3333]', text: 'text-[#FF3333]', icon: '❤' },
    TRAUMA: { border: 'border-[#FFB800]', text: 'text-[#FFB800]', icon: '⚡' },
    BURNS: { border: 'border-[#00E5FF]', text: 'text-[#00E5FF]', icon: '🔥' },
    RESPIRATORY: { border: 'border-[#00FF88]', text: 'text-[#00FF88]', icon: '🫁' },
    GENERAL: { border: 'border-[#D0D8E8]', text: 'text-[#D0D8E8]', icon: '✚' }
  }

  const style = map[normalized] || map.GENERAL

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 border ${style.border} bg-[#0A1020]`}>
      <span className={style.text}>{style.icon}</span>
      <span className={`font-mono text-[9px] tracking-widest ${style.text}`}>{normalized}</span>
    </div>
  )
}
