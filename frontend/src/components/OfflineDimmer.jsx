import React, { useState, useEffect } from 'react'
import { getSocket } from '../services/socket'

export default function OfflineDimmer() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const socket = getSocket()
    
    // Initial check
    if (!socket.connected) {
      setOffline(true)
    }

    const onConnect = () => setOffline(false)
    const onDisconnect = () => setOffline(true)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-[#060B18]/70 flex items-center justify-center backdrop-blur-[2px] pointer-events-none transition-opacity duration-300">
      <div className="bg-[#1a1e1e] border border-[#f59e0b] shadow-[0_0_30px_rgba(245,158,11,0.2)] px-8 py-6 flex flex-col items-center gap-4 animate-pulse">
         <span className="text-4xl text-[#f59e0b]">⚠</span>
         <h1 className="font-display font-bold text-xl tracking-[0.2em] text-[#f59e0b]">CONNECTION LOST</h1>
         <p className="font-mono text-xs text-[#6b7f7f] tracking-widest">ATTEMPTING RECONNECT...</p>
      </div>
    </div>
  )
}
