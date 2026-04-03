import { useState, useEffect } from 'react'
import MapView from '../components/MapView'
import { useSocket, useSocketEvent, getSocket } from '../services/socket'
import axios from 'axios'

export default function DriverPage() {
  const [ambulancePos, setAmbulancePos] = useState([28.6139, 77.213])
  const [speed, setSpeed] = useState(84)
  const [eta, setEta] = useState(7)
  const [distance, setDistance] = useState(3.2)
  const [hospitalInfo, setHospitalInfo] = useState({ name: 'CITY GENERAL', capacity: 92, status: 'OPEN' })
  const [rerouting, setRerouting] = useState(false)
  
  const AMB_ID = 'AMB-04'
  const { connected } = useSocket('ambulance', AMB_ID)

  // Simulate movement and send to backend
  useEffect(() => {
    if (!connected) return
    const interval = setInterval(() => {
       // Random jitter
       setAmbulancePos(prev => [prev[0] + (Math.random()-0.5)*0.001, prev[1] + (Math.random()-0.5)*0.001])
       
       let currentSpeed = Math.floor(Math.random() * 20) + 70
       setSpeed(currentSpeed)

       getSocket().emit('ambulance_gps', {
         ambulanceId: AMB_ID,
         lat: ambulancePos[0],
         lng: ambulancePos[1],
         speed: currentSpeed,
         heading: Math.floor(Math.random()*360),
         routeId: 'ROUTE_TEST_1',
         currentSignalIndex: 0
       })
    }, 2000)
    return () => clearInterval(interval)
  }, [connected, ambulancePos])

  useSocketEvent('ambulance_rerouted', (data) => {
    if (data.ambulanceId === AMB_ID) {
      setRerouting(true)
      setTimeout(() => setRerouting(false), 8000)
      if (data.newHospital) {
         setHospitalInfo({ name: data.newHospital.name, capacity: 'N/A', status: 'OPEN' })
         setEta(parseInt(data.newHospital.eta) || 12)
      }
    }
  })

  useSocketEvent('hospital_rejected', (data) => {
    if (data.ambulanceId === AMB_ID) {
      triggerFailover()
    }
  })

  const triggerFailover = async () => {
    setRerouting(true)
    try {
       await axios.post('http://localhost:5000/api/ambulance/failover', { ambulanceId: AMB_ID })
    } catch (err) {
       console.error("Failover failed", err)
       // Mock fallback if api fails
       setTimeout(() => {
         setHospitalInfo({ name: 'SECONDARY CARE CTR', capacity: '50%', status: 'REROUTED' })
         setEta(14)
         setDistance(8.4)
         setRerouting(false)
       }, 3000)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0c0c] relative">
      
      {/* Upper Map Area */}
      <div className="flex-1 relative border-b border-[#4DEEEA]">
        
        {/* Top Centered Red Alert Banner */}
        {rerouting && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[500] bg-[#7f1d1d] border border-[#ef4444] px-12 py-4 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse">
             <div className="font-display font-bold text-lg tracking-[0.2em] text-[#e2e8e8] flex items-center gap-3">
               <span className="text-[#ef4444]">⚠</span> 
               HOSPITAL UNAVAILABLE / OBSTRUCTION — REROUTING IN PROGRESS
             </div>
          </div>
        )}

        {/* Top Right Floating Telemetry Metrics */}
        <div className="absolute top-6 right-6 z-[500] flex flex-col gap-2">
           <div className="bg-[#1a1e1e] border-l-4 border-[#374444] p-3 w-40">
             <div className="font-mono text-[9px] text-[#6b7f7f] tracking-widest mb-1">CURRENT SPEED</div>
             <div className="font-display font-bold text-3xl text-[#e2e8e8] leading-none">
               {speed} <span className="text-sm text-[#6b7f7f]">KM/H</span>
             </div>
           </div>
           
           <div className="bg-[#1a1e1e] border-l-4 border-[#374444] p-3 w-40">
             <div className="font-mono text-[9px] text-[#6b7f7f] tracking-widest mb-1">ENGINE TEMP</div>
             <div className="font-display font-bold text-3xl text-[#f59e0b] leading-none">
               92<span className="text-sm">°C</span>
             </div>
           </div>
        </div>

        {/* Floating Hospital Status Tag */}
        <div className="absolute bottom-[20%] right-[10%] z-[500] bg-[#1a1e1e] border border-[#f59e0b] w-48 shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-colors" style={{borderColor: rerouting ? '#ef4444' : '#f59e0b'}}>
           <div className="flex items-center gap-2 p-2 border-b border-[#1f2b2b]">
              <span className="text-[10px]" style={{color: rerouting ? '#ef4444' : '#f59e0b'}}>✚</span>
              <span className="font-display font-bold text-xs tracking-widest text-[#e2e8e8] truncate">{hospitalInfo.name}</span>
           </div>
           <div className="p-2 flex justify-between font-mono text-[9px] tracking-widest">
              <span className="text-[#6b7f7f]">CAP: <span className="text-[#e2e8e8]">{hospitalInfo.capacity}</span></span>
              <span style={{color: rerouting ? '#ef4444' : '#f59e0b'}}>ST: {hospitalInfo.status}</span>
           </div>
        </div>

        {/* Soft cyan gradient fade at the bottom of the map above the panel */}
        <div className="absolute bottom-0 w-full h-8 bg-gradient-to-t from-[#4DEEEA]/20 to-transparent z-[400] pointer-events-none" />

        <MapView
          center={[28.614, 77.213]}
          ambulancePos={ambulancePos}
          hospitalCandidates={[]}
          signals={[]}
        />
      </div>

      {/* Bottom Telemetry & Navigation Panel */}
      <div className="h-[180px] shrink-0 bg-[#161b1b] flex flex-col relative">
        
        {/* Main Controls Row */}
        <div className="flex-1 flex px-8 py-6 items-stretch border-b border-[#1f2b2b]">
          
          {/* Left: ETA & Distance */}
          <div className="flex gap-16 pr-12 border-r border-[#1f2b2b]">
             <div className="flex flex-col justify-center">
                <div className="font-mono text-[10px] text-[#e2e8e8] uppercase tracking-widest mb-2">TIME TO<br/>DESTINATION</div>
                <div className="font-display font-bold text-6xl text-[#4DEEEA] leading-none flex items-baseline gap-2">
                   {String(eta).padStart(2,'0')} <span className="text-xl">MIN</span>
                </div>
             </div>
             <div className="flex flex-col justify-center">
                <div className="font-mono text-[10px] text-[#e2e8e8] uppercase tracking-widest mb-2">REMAINING<br/>DISTANCE</div>
                <div className="font-display font-bold text-5xl text-[#e2e8e8] leading-none flex items-baseline gap-2">
                   {distance} <span className="text-xl text-[#6b7f7f]">KM</span>
                </div>
             </div>
          </div>

          {/* Middle: Sequence Timeline */}
          <div className="flex-1 px-12 flex flex-col justify-center">
             <div className="font-mono text-[10px] text-[#6b7f7f] uppercase tracking-widest mb-3">MISSION SEQUENCE</div>
             
             <div className="flex flex-col gap-3 font-mono text-[10px] tracking-widest relative">
                
                {/* Timeline connecting line behind nodes */}
                <div className="absolute left-[3px] top-2 h-14 w-[1px] bg-[#1f2b2b] -z-0" />

                <div className="flex items-center gap-4 z-10">
                   <div className="w-2 h-2 rounded-full bg-[#374444]" />
                   <span className="text-[#374444] line-through decoration-[#374444]">ST. MARY'S CROSSING [PASSED]</span>
                </div>
                
                <div className="flex items-center gap-4 z-10">
                   <div className="w-2.5 h-2.5 bg-[#4DEEEA] shadow-[0_0_10px_rgba(77,238,234,0.6)]" />
                   <span className="text-[#e2e8e8]">CITY SQUARE INTERSECTION <span className="text-[#4DEEEA]">[APPROACHING]</span></span>
                </div>
                
                <div className="flex items-center gap-4 z-10">
                   <div className="w-2 h-2 border border-[#6b7f7f] bg-[#161b1b]" />
                   <span className="text-[#6b7f7f]">{hospitalInfo.name} BAY 4 [DESTINATION]</span>
                </div>
             </div>
          </div>

          {/* Right: Urgent Actions */}
          <div className="pl-12 flex flex-col gap-3 justify-center border-l border-[#1f2b2b] min-w-[280px]">
             <button onClick={triggerFailover} disabled={rerouting} className="w-full bg-[#f59e0b] disabled:bg-[#f59e0b]/50 hover:bg-[#d97706] text-[#0d0f0f] font-display font-bold text-sm tracking-widest py-3 flex justify-between px-4 items-center transition-colors">
               <span>REPORT OBSTRUCTION</span>
               <span className="text-lg leading-none">⚠</span>
             </button>
             <button onClick={triggerFailover} disabled={rerouting} className="w-full bg-[#7f1d1d] disabled:bg-[#7f1d1d]/50 hover:bg-[#ef4444] border border-[#ef4444] text-[#e2e8e8] font-display font-bold text-sm tracking-widest py-3 flex justify-between px-4 items-center transition-colors">
               <span>REQUEST REROUTE</span>
               <span className="text-lg leading-none">↶</span>
             </button>
          </div>
        </div>

        {/* Micro Footer Stats */}
        <div className="h-8 shrink-0 flex items-center justify-between px-8 font-mono text-[8px] text-[#374444] tracking-[0.2em] bg-[#0d0f0f]">
           <div className="flex gap-8">
              <span>GPS_ACCURACY: 0.2m</span>
              <span>SAT_LINK: UP_99%</span>
              <span>VEHICLE_VIB: NOMINAL</span>
           </div>
           <div className="flex gap-8 text-[#6b7f7f]">
              <span className="text-[#6b7f7f]">SYNC_TIME: {new Date().toLocaleTimeString()}</span>
              <span>ENCRYPTED_FEED_L3</span>
              <span style={{color: connected ? '#10b981' : '#ef4444'}}>{connected ? 'SOCKET: CON' : 'SOCKET: ERR'}</span>
           </div>
        </div>

      </div>
    </div>
  )
}
