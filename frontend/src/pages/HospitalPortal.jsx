import { useState, useEffect } from 'react'
import { useSocket, useSocketEvent, getSocket } from '../services/socket'
import { getHospital, getIncomingRequests, respondToRequest } from '../services/api'
import MapView from '../components/MapView'
import { LiveDot } from '../components/LiveDot'

export default function HospitalPortal() {
  const [hospitalData, setHospitalData] = useState(null)
  const [incoming, setIncoming] = useState([])
  const [confirmed, setConfirmed] = useState([])
  const [departments, setDepartments] = useState([])

  // Join 'hospital' room - we'll use the first hospital from the database
  const { connected } = useSocket('hospital', 'HOSP_DOON') // Default to Doon Government Hospital

  useEffect(() => {
    if (connected) {
      loadHospitalData()
    }
  }, [connected])

  const loadHospitalData = async () => {
    try {
      const hospital = await getHospital('HOSP_DOON')
      setHospitalData(hospital)

      // Set up departments based on hospital specialties
      const deptData = hospital.specialties.map((specialty, index) => ({
        id: `DEPT_${String(index + 1).padStart(2, '0')}`,
        name: specialty.toUpperCase(),
        current: Math.floor(Math.random() * 10) + 5, // Mock current patients
        max: Math.floor(Math.random() * 15) + 10, // Mock max capacity
        color: ['#3b82f6', '#f59e0b', '#ef4444', '#4DEEEA'][index % 4],
        label: 'BED CONTROLS'
      }))
      setDepartments(deptData)

      // Load incoming requests
      const requests = await getIncomingRequests('HOSP_DOON')
      setIncoming(requests.map(req => ({
        id: req.ambulanceId,
        emergencyId: req.emergencyId,
        type: req.emergencyType?.toUpperCase() || 'GENERAL',
        patient: 'UNKNOWN',
        vitals: 'UNKNOWN',
        eta: `${Math.floor(req.eta / 60)}:${String(req.eta % 60).padStart(2, '0')}`,
        distance: `${req.distanceRemaining?.toFixed(1) || 0} KM`,
        color: '#f59e0b',
        icon: '⚠'
      })))
    } catch (error) {
      console.error('Error loading hospital data:', error)
    }
  }

  useSocketEvent('emergency_dispatched', (data) => {
    // New emergency broadcasted
    setIncoming(prev => [...prev, {
      id: data.ambulanceId || 'AMB-??',
      emergencyId: data.emergencyId,
      type: data.emergencyType || 'GENERAL',
      patient: 'UNKNOWN',
      vitals: 'UNKNOWN',
      eta: `${data.hospital?.eta || 5}:00`,
      distance: `${data.hospital?.distanceKm || 3.1} KM`,
      color: '#f59e0b',
      icon: '⚠'
    }])
  })

  // When a hospital accepts an ambulance (could be us or someone else)
  useSocketEvent('hospital_accepted', (data) => {
    // move from incoming to confirmed if it was us
    const itm = incoming.find(x => x.id === data.ambulanceId)
    if (itm) {
      setIncoming(prev => prev.filter(x => x.id !== data.ambulanceId))
      setConfirmed(prev => [{
        id: data.ambulanceId,
        type: itm.type,
        eta: itm.eta,
        bay: `BAY_0${Math.floor(Math.random()*4)+1}`
      }, ...prev])
    }
  })

  const respond = async (ambulanceId, emergencyId, action) => {
    if (!connected) return alert("Socket disconnected")

    try {
      await respondToRequest('HOSP_DOON', action, emergencyId)

      // Emit the hospital_response up to socketHandler
      getSocket().emit('hospital_response', {
        hospitalId: 'HOSP_DOON',
        ambulanceId,
        emergencyId,
        action
      })

      // Optimistically update
      if (action === 'reject') {
         setIncoming(prev => prev.filter(x => x.id !== ambulanceId))
      } else {
         // Move to confirmed
         const itm = incoming.find(x => x.id === ambulanceId)
         if (itm) {
           setIncoming(prev => prev.filter(x => x.id !== ambulanceId))
           setConfirmed(prev => [{
             id: ambulanceId,
             type: itm.type,
             eta: itm.eta,
             bay: `BAY_0${Math.floor(Math.random()*4)+1}`
           }, ...prev])
         }
      }
    } catch (error) {
      console.error('Error responding to request:', error)
      alert('Failed to respond to ambulance request')
    }
  }

  const adjustBed = (deptIdx, delta) => {
    setDepartments(prev => {
      const np = [...prev]
      const curr = np[deptIdx].current
      np[deptIdx].current = Math.max(0, Math.min(np[deptIdx].max, curr + delta))
      return np
    })
  }

  return (
    <div className="h-full flex overflow-hidden bg-[#0d0f0f]">
      
      {/* Left Column - Queues & Header */}
      <div className="w-[450px] shrink-0 flex flex-col border-r border-[#1f2b2b]">
        
        {/* Hospital Header */}
        <div className="p-6 bg-[#161b1b] border-b border-[#1f2b2b] flex justify-between items-start">
          <div>
            <h1 className="text-[#e2e8e8] font-display font-bold text-lg mb-2">
              {hospitalData?.name || 'Loading Hospital...'} — Emergency Bay
            </h1>
            <div className="flex gap-4 font-mono text-[10px] tracking-widest text-[#6b7f7f] uppercase">
               <span>STATUS: {connected ? <span className="text-[#10b981]">CONNECTED</span> : <span className="text-[#ef4444]">OFFLINE</span>}</span>
               <span>|</span>
               <span>SECTOR: <span className="text-[#e2e8e8]">DEHRADUN</span></span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[9px] text-[#6b7f7f] uppercase tracking-widest mb-1">EMERGENCY BEDS</div>
            <div className="font-display font-bold text-2xl text-[#4DEEEA]">
              BEDS:<br/>
              {hospitalData ? `${hospitalData.emergencyBeds.available}/${hospitalData.emergencyBeds.total}` : '0/0'}
            </div>
          </div>
        </div>

        {/* Incoming Queue Section */}
        <div className="flex flex-col p-6 flex-1 overflow-y-auto">
          
          <div className="text-center font-mono text-[10px] text-[#e2e8e8] tracking-widest mb-4 border-b border-[#1f2b2b] pb-2">
            INCOMING QUEUE [{incoming.length < 10 ? '0'+incoming.length : incoming.length}]
          </div>

          <div className="flex flex-col gap-4 mb-8">
            {incoming.length === 0 && <div className="text-[#6b7f7f] font-mono text-[10px] text-center italic py-4">NO PENDING REQUESTS</div>}
            {incoming.map(unit => (
              <div key={unit.id} className="relative bg-[#161b1b] border border-[#1f2b2b] p-4 flex gap-4 pr-24 border-l-4" style={{borderLeftColor: unit.color}}>
                
                {/* Icon Box */}
                <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-[#1a1e1e] border border-[#2d3f3f] text-2xl" style={{color: unit.color}}>
                  {unit.icon}
                </div>
                
                {/* Details */}
                <div className="flex-1">
                  <div className="flex gap-2 items-center mb-1">
                    <span className="font-display font-bold text-[#e2e8e8] text-sm tracking-widest">{unit.id}</span>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 tracking-widest" style={{backgroundColor: unit.color, color: '#0d0f0f'}}>{unit.type}</span>
                  </div>
                  <div className="font-mono text-[10px] text-[#6b7f7f] mb-3">PATIENT: {unit.patient} | VITALS: {unit.vitals}</div>
                  <div className="flex gap-4 font-mono text-[10px]">
                    <span className="text-[#4DEEEA]">⏱ ETA: {unit.eta}</span>
                    <span className="text-[#4DEEEA]">📍 {unit.distance}</span>
                  </div>
                </div>

                {/* Accept/Reject Buttons */}
                <div className="absolute top-1/2 -translate-y-1/2 right-4 flex gap-2">
                  <button onClick={() => respond(unit.id, unit.emergencyId, 'accept')} className="w-8 h-8 border border-[#1f2b2b] bg-[#1a1e1e] text-[#10b981] hover:bg-[#10b981]/20 flex items-center justify-center transition-colors shadow">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>
                  </button>
                  <button onClick={() => respond(unit.id, unit.emergencyId, 'reject')} className="w-8 h-8 border border-[#1f2b2b] bg-[#1a1e1e] text-[#ef4444] hover:bg-[#ef4444]/20 flex items-center justify-center transition-colors shadow">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center font-mono text-[10px] text-[#10b981] tracking-widest mb-4 border-b border-[#10b981]/30 pb-2">
            CONFIRMED INCOMING [{confirmed.length < 10 ? '0'+confirmed.length : confirmed.length}]
          </div>
          
          <div className="flex flex-col gap-3">
            {confirmed.length === 0 && <div className="text-[#6b7f7f] font-mono text-[10px] text-center italic py-4">NO CONFIRMED UNITS</div>}
            {confirmed.map((c, i) => (
              <div key={i} className="relative bg-[#1a1e1e]/50 border border-[#1f2b2b] p-4 flex gap-4 opacity-70">
                <div className="w-6 h-6 rounded-full border border-[#10b981] flex items-center justify-center text-[#10b981]">
                   <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>
                </div>
                <div className="flex-1">
                  <div className="font-display font-bold text-[#e2e8e8] text-sm tracking-widest mb-1">{c.id} — {c.type}</div>
                  <div className="font-mono text-[10px] text-[#6b7f7f] flex justify-between">
                    <span>ETA: {c.eta} | DOCK: {c.bay}</span>
                    <span className="text-[#10b981] tracking-[0.2em] flex items-center gap-1.5"><LiveDot color="green" size="sm"/> DOCKING_SEQUENCE</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Right Column - Capacity Stack */}
      <div className="flex-1 flex flex-col bg-[#0a0c0c]">

        <div className="h-72 border-b border-[#1f2b2b]">
          <MapView
            center={[30.3165, 78.0322]}
            zoom={13}
            ambulances={[]}
            hospitalCandidates={hospitalData ? [hospitalData] : []}
            signals={[]}
          />
        </div>
        
        <div className="px-8 py-6 flex justify-between items-center shrink-0">
          <h2 className="font-display font-bold text-lg text-[#e2e8e8] tracking-[0.2em]">DEPARTMENTAL CAPACITY</h2>
          <button className="bg-[#4DEEEA]/10 border border-[#4DEEEA] px-4 py-2 font-display font-bold text-[10px] tracking-widest text-[#4DEEEA] hover:bg-[#4DEEEA]/20 transition-colors cursor-pointer">
            REFRESH_DATA
          </button>
        </div>

        <div className="flex-1 px-8 pb-8 flex flex-col gap-4 overflow-y-auto w-full max-w-2xl mx-auto">
          {departments.map((dept, idx) => {
            const pct = (dept.current / dept.max) * 100;
            const isFull = pct >= 90;
            return (
              <div key={dept.id} className="bg-[#131616] border border-[#1f2b2b] p-5 flex items-center gap-6 relative group hover:border-[#374444] transition-colors">
                
                {/* Label Info */}
                <div className="w-32 shrink-0">
                  <div className="font-mono text-[10px] text-[#6b7f7f] tracking-widest mb-1">{dept.id}</div>
                  <div className="font-display font-bold text-sm tracking-widest" style={{color: dept.color}}>{dept.name}</div>
                </div>
                
                {/* Arc/Bar Metric */}
                <div className="flex-1 flex flex-col relative justify-center gap-2">
                  <div className="flex justify-between items-end font-mono text-[10px]">
                    <span className="text-[#6b7f7f]">OCCUPANCY</span>
                    <span style={{color: isFull ? '#ef4444' : '#e2e8e8'}}>{Math.round(pct)}%</span>
                  </div>
                  {/* The visual bar mimicking flattened arc */}
                  <div className="w-full h-4 bg-[#1f2b2b] relative overflow-hidden flex shadow-inner">
                    <div 
                      className="h-full transition-all duration-700 ease-out" 
                      style={{
                        width: `${pct}%`, 
                        backgroundColor: isFull ? '#ef4444' : dept.color,
                        boxShadow: `0 0 10px ${isFull ? '#ef4444' : dept.color}66`
                      }} 
                    />
                    {/* Tick marks for sci-fi look */}
                    <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
                      {[1,2,3,4,5,6,7,8,9].map(t => <div key={t} className="w-px h-full bg-[#0a0c0c]" />)}
                    </div>
                  </div>
                </div>

                {/* Score / Max */}
                <div className="w-20 shrink-0 text-right flex flex-col items-end">
                   <div className="flex items-baseline gap-1">
                     <span className={`font-display font-bold text-3xl leading-none ${isFull?'text-[#ef4444]':'text-[#e2e8e8]'}`}>{String(dept.current).padStart(2,'0')}</span>
                     <span className="font-mono text-sm text-[#6b7f7f]">/{dept.max}</span>
                   </div>
                </div>

                {/* Controls */}
                <div className="flex gap-1 ml-4 border-l border-[#1f2b2b] pl-4">
                  <button onClick={() => adjustBed(idx, -1)} className="w-8 h-8 bg-[#1a1e1e] border border-[#1f2b2b] text-[#e2e8e8] hover:border-[#6b7f7f] hover:bg-[#1f2b2b] flex items-center justify-center transition-colors">-</button>
                  <button onClick={() => adjustBed(idx, 1)} className="w-8 h-8 bg-[#1a1e1e] border border-[#1f2b2b] text-[#e2e8e8] hover:border-[#6b7f7f] hover:bg-[#1f2b2b] flex items-center justify-center transition-colors">+</button>
                </div>

              </div>
            )
          })}
        </div>

        {/* Footer Stats Row */}
        <div className="h-24 shrink-0 border-t border-[#1f2b2b] bg-[#131616] flex">
          {[
            { label: 'TODAY ADMITTED', value: '34' },
            { label: 'TODAY REJECTED', value: '08', text: '#ef4444' },
            { label: 'AVG WAIT TIME', value: '4.2 MIN', text: '#4DEEEA' }
          ].map(stat => (
            <div key={stat.label} className="flex-1 flex flex-col justify-center items-center border-r border-[#1f2b2b] last:border-0">
              <div className="font-mono text-[10px] text-[#6b7f7f] tracking-widest mb-1">{stat.label}</div>
              <div className="font-display font-bold text-2xl" style={{color: stat.text || '#e2e8e8'}}>{stat.value}</div>
            </div>
          ))}
        </div>

      </div>

    </div>
  )
}

