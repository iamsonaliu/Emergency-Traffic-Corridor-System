import React, { useState, useEffect } from 'react'

export function ETATimer({ seconds, size = 'sm', onExpire }) {
  const [timeLeft, setTimeLeft] = useState(seconds)

  useEffect(() => {
    setTimeLeft(seconds)
  }, [seconds])

  useEffect(() => {
    if (timeLeft <= 0) {
      if (onExpire) onExpire()
      return
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Determine color base
  let colorClass = 'text-[#00E5FF]'
  if (timeLeft < 20) colorClass = 'text-[#FF3333]'
  else if (timeLeft < 60) colorClass = 'text-[#FFB800]'

  if (size === 'xl') {
    return (
      <div className="flex flex-col items-center justify-center font-display leading-none">
         <span className={`text-[72px] font-bold ${colorClass}`}>{Math.ceil(timeLeft / 60)}</span>
         <span className="font-mono text-xl tracking-[0.2em] text-[#6b7f7f] uppercase">MIN</span>
      </div>
    )
  }

  const sizes = {
    sm: 'text-xs',
    md: 'text-base',
    lg: 'text-2xl',
  }

  return (
    <div className={`font-mono font-bold tracking-widest ${sizes[size]} ${colorClass}`}>
      {formatTime(timeLeft)}
    </div>
  )
}
