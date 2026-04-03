import React from 'react'

export function LiveDot({ color = 'green', size = 'sm' }) {
  const colorMap = {
    green: { bg: 'bg-[#00FF88]', glow: 'shadow-[0_0_10px_rgba(0,255,136,0.6)]' },
    amber: { bg: 'bg-[#FFB800]', glow: 'shadow-[0_0_10px_rgba(255,184,0,0.6)]' },
    red: { bg: 'bg-[#FF3333]', glow: 'shadow-[0_0_10px_rgba(255,51,51,0.6)]' },
  }
  const sizeMap = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2.5 h-2.5',
    lg: 'w-4 h-4'
  }

  const { bg, glow } = colorMap[color] || colorMap.green
  const sz = sizeMap[size] || sizeMap.sm

  return (
    <div className="relative inline-flex items-center justify-center">
      <div className={`absolute ${sz} rounded-full ${bg} opacity-20 animate-ping`}></div>
      <div className={`relative ${sz} rounded-full ${bg} ${glow}`}></div>
    </div>
  )
}
