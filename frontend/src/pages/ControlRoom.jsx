import { useState, useEffect } from 'react'
import MapView from '../components/MapView'
import { useSocket, useSocketEvent, getSocket } from '../services/socket'
import { getAllHospitals } from '../services/api'
import { IncidentTypeTag } from '../components/IncidentTypeTag'
import { ETATimer } from '../components/ETATimer'
import { StatusBadge } from '../components/StatusBadge'
import { LiveDot } from '../components/LiveDot'
import { DEFAULT_MAP_CENTER } from '../utils/constants'

export default function ControlRoom() {
  const [ambulancePos] = useState(DEFAULT_MAP_CENTER)
  const [fleet, setFleet] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [corridors, setCorridors] = useState([])
  const [incidents, setIncidents] = useState([
    { id: 'INC-2041', type: 'TRAUMA', unit: 'AMB-04', status: 'active', eta: 420 },
    { id: 'INC-2040', type: 'CARDIAC', unit: 'AMB-02', status: 'idle', eta: 0 }
  ])
  const [logs, setLogs] = useState([
    { id: 1, time: new Date().toLocaleTimeString('en-GB', { hour12: false }), msg: 'SYSTEM_AUTH: OPERATOR_01 LOGIN SUCCESSFUL', type: 'info' }
  ])

  // Map Controls State
  const [showAmbulances, setShowAmbulances] = useState(true)
  const [showHospitals, setShowHospitals] = useState(true)

  // Join 'control' room
  const { connected } = useSocket('control', 'main')

  useEffect(() => {
    if (connected) {
      getSocket().emit('request_all_positions')
      addLog('SYSTEM: CONNECTED TO SOCKET ROOM [control]', 'success')
      loadInitialData()
    } else {
       addLog('SYSTEM: SOCKET DISCONNECTED - RETRYING...', 'alert')
    }
  }, [connected])

  const loadInitialData = async () => {
    try {
      const hospitalsData = await getAllHospitals()
      setHospitals(hospitalsData)
      addLog(`SYSTEM: LOADED ${hospitalsData.length} HOSPITALS`, 'success')
    } catch (err) {
      addLog('SYSTEM: FAILED TO LOAD HOSPITALS', 'alert')
      console.error('Error loading hospitals:', err)
    }
  }

  const addLog = (msg, type) => {
    setLogs(prev => {
      const now = new Date().toLocaleTimeString('en-GB', { hour12: false })
      return [{ id: Date.now() + Math.random(), time: now, msg, type }, ...prev].slice(0, 50)
    })
  }

  useSocketEvent('incident-created', (data) => {
    setIncidents(prev => [{
      id: data.incidentId || `INC-${Math.floor(Math.random()*1000)+3000}`,
      type: data.type || 'GENERAL',
      unit: data.ambulanceId || 'AMB-??',
      status: 'active',
      eta: data.eta || 600
    }, ...prev])
    addLog(`INCIDENT ${data.incidentId} DECLARED`, 'alert')
  })

  useSocketEvent('all_positions', (data) => {
    if (data.ambulances) setFleet(data.ambulances)
    addLog(`TELEMETRY: FULL FLEET SYNC COMPLETE (${data.ambulances?.length} UNITS)`, 'info')
  })

  useSocketEvent('ambulances_telemetry', (data) => {
    if (data.ambulances) setFleet(data.ambulances)
  })

  useSocketEvent('hospital_accepted', (data) => {
    addLog(`HOSPITAL [${data.hospitalName}] ACCEPTED ${data.ambulanceId}`, 'success')
  })

  useSocketEvent('hospital_rejected', (data) => {
    addLog(`HOSPITAL [${data.hospitalName}] REJECTED ${data.ambulanceId}`, 'alert')
  })

  useSocketEvent('emergency_dispatched', (data) => {
    addLog(`EMERGENCY DISPATCHED: ${data.ambulanceId} → ${data.hospital.name} (ETA: ${data.route.totalTimeMinutes}min)`, 'success')
  })

  useSocketEvent('corridor_initialized', (data) => {
    setCorridors(prev => [...prev, {
      routeId: data.routeId,
      emergencyId: data.emergencyId,
      signals: data.signals || [],
      passedCount: 0,
      totalSignals: data.totalSignals || (data.signals?.length || 0),
      progress: `0/${data.totalSignals || (data.signals?.length || 0)}`,
      polyline: data.polyline || null,
      navigationSteps: data.navigationSteps || []
    }])
    addLog(`CORRIDOR ${data.routeId} INITIALIZED (${data.totalSignals || (data.signals?.length || 0)} SIGNALS)`, 'success')
  })

  useSocketEvent('signal_update', (data) => {
    setCorridors(prev => prev.map(corridor => {
      if (corridor.routeId === data.routeId) {
        const updatedSignals = corridor.signals.map(signal => 
          signal.signalId === data.signalId 
            ? { ...signal, status: data.status, lat: data.lat, lng: data.lng }
            : signal
        )
        return { ...corridor, signals: updatedSignals }
      }
      return corridor
    }))
  })

  useSocketEvent('corridor_progress', (data) => {
    setCorridors(prev => prev.map(corridor => 
      corridor.routeId === data.routeId 
        ? { ...corridor, passedCount: data.passedCount, progress: data.progress }
        : corridor
    ))
  })

  useSocketEvent('corridor_complete', (data) => {
    setCorridors(prev => prev.filter(c => c.routeId !== data.routeId))
    addLog(`CORRIDOR ${data.routeId} COMPLETED`, 'success')
  })

  const displayFleet = fleet.length > 0 ? fleet.map((f, i) => ({
    unit: f.ambulanceId || `AMB-0${i}`,
    driver: 'DRIVER ' + String.fromCharCode(65 + i),
    status: f.status === 'active' ? 'emergency' : 'idle',
    speed: `${Math.round(f.speed || 0)} KM/H`,
    ping: (Math.random() * 0.8 + 0.1).toFixed(1) + 'S'
  })) : [
    { unit: 'WAITING', driver: '-', status: 'idle', speed: '0 KM/H', ping: '-' }
  ]

  const activeAmbulances = fleet.filter(f => f.status === 'active').length

  return (
    <div className="h-full flex overflow-hidden">
      {/* Map Area */}
      <div className="flex-1 relative border-r border-[#1f2b2b]">
        
        {/* Floating Top Left Overlay map stats */}
        <div className="absolute top-4 left-4 z-[500] border border-[#1f2b2b] bg-[#131616]/80 p-2 flex items-center gap-4" style={{backdropFilter: 'blur(4px)'}}>
           <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#e2e8e8] tracking-widest"><LiveDot color="green" size="sm"/> ACTIVE CORRIDORS: {corridors.length}</div>
           <div className="text-[#374444]">|</div>
           <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#4DEEEA] tracking-widest"><LiveDot color="amber" size="sm"/> AMBULANCES: {fleet.length}</div>
           <div className="text-[#374444]">|</div>
           <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#ef4444] tracking-widest"><LiveDot color="red" size="sm"/> INCIDENTS: {activeAmbulances}</div>
        </div>

        {/* Floating Map Controls (Bottom Right) */}
        <div className="absolute bottom-6 right-4 z-[500] flex flex-col gap-2">
           <button onClick={() => setShowAmbulances(!showAmbulances)} className={`font-mono text-[9px] tracking-widest px-3 py-2 border flex items-center gap-2 ${showAmbulances ? 'bg-[#4DEEEA]/10 border-[#4DEEEA] text-[#4DEEEA]' : 'bg-[#1a1e1e] border-[#1f2b2b] text-[#6b7f7f]'}`}>
             <div className={`w-2 h-2 ${showAmbulances ? 'bg-[#4DEEEA]' : 'bg-[#1f2b2b]'}`}/> AMBULANCES
           </button>
           <button onClick={() => setShowHospitals(!showHospitals)} className={`font-mono text-[9px] tracking-widest px-3 py-2 border flex items-center gap-2 ${showHospitals ? 'bg-[#10b981]/10 border-[#10b981] text-[#10b981]' : 'bg-[#1a1e1e] border-[#1f2b2b] text-[#6b7f7f]'}`}>
             <div className={`w-2 h-2 ${showHospitals ? 'bg-[#10b981]' : 'bg-[#1f2b2b]'}`}/> HOSPITALS
           </button>
        </div>

        <MapView
          center={DEFAULT_MAP_CENTER}
          ambulances={showAmbulances ? fleet : []}
          hospitalCandidates={showHospitals ? hospitals : []}
          signals={corridors.flatMap(c => c.signals || [])}
          routePolyline={corridors.length > 0 ? corridors[0].polyline : null}
        />
        
        {/* Map Coordinates overlay bottom left */}
        <div className="absolute bottom-4 left-4 z-[500]">
           <span className="font-mono text-[9px] text-[#374444] tracking-[0.15em]">
             LAT: 30.3165 | LNG: 78.0322 | ALT: 435M
           </span>
        </div>
      </div>

      {/* Right Sidebar - Dashboard Widgets */}
      <aside className="w-[320px] lg:w-[400px] shrink-0 flex flex-col bg-[#0d0f0f] border-l border-[#1f2b2b]">
        
        {/* Active Incidents Module */}
        <div className="p-5 flex-shrink-0 max-h-[40%] overflow-y-auto border-b border-[#1f2b2b]">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[#e2e8e8]">◬</span>
            <h2 className="font-display font-bold text-sm tracking-widest text-[#e2e8e8]">ACTIVE INCIDENTS</h2>
            <span className="ml-auto"><StatusBadge status="critical" label={`${incidents.length} CRITICAL`} pulse={true}/></span>
          </div>

          <div className="flex flex-col gap-3">
             {incidents.map((inc, i) => (
               <div key={inc.id+i} className={`border ${inc.status==='active'?'border-[#ef4444] bg-[#1a1e1e]/50':'border-[#1f2b2b] bg-[#131616]'} p-4 relative`}>
                  <div className="absolute top-0 right-0 p-3 text-right">
                     <div className="font-mono text-[9px] text-[#6b7f7f] mb-0.5">ETA</div>
                     <ETATimer seconds={inc.eta} size="md" />
                  </div>
                  
                  <div className="font-mono text-[10px] text-[#6b7f7f] mb-2">ID: {inc.id}</div>
                  <div className="mb-4">
                     <IncidentTypeTag type={inc.type} />
                  </div>
                  
                  <div className={`flex justify-between font-mono text-[10px] tracking-widest border-t ${inc.status==='active'?'border-[#ef4444]/30':'border-[#1f2b2b]'} pt-3`}>
                    <div><span className="text-[#6b7f7f] mr-1">UNIT:</span> <span className="text-[#4DEEEA]">{inc.unit}</span></div>
                    <div><StatusBadge status={inc.status} /></div>
                  </div>
                  
                  {/* Corner brackets */}
                  {inc.status === 'active' && (
                    <>
                      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#ef4444]"></div>
                      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#ef4444]"></div>
                    </>
                  )}
               </div>
             ))}
          </div>
        </div>

        {/* Fleet Status Module */}
        <div className="p-5 flex-shrink-0 border-b border-[#1f2b2b]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[#e2e8e8]">🚐</span>
              <h2 className="font-display font-bold text-sm tracking-widest text-[#e2e8e8]">FLEET STATUS</h2>
            </div>
            <span className="font-mono text-[10px] text-[#6b7f7f] tracking-widest">ONLINE: {fleet.length}</span>
          </div>
          
          <div className="font-mono text-[10px] w-full max-h-[200px] overflow-y-auto pr-1">
            <div className="flex text-[#6b7f7f] border-b border-[#1f2b2b] pb-2 mb-2 tracking-widest sticky top-0 bg-[#0d0f0f]">
              <div className="w-16">UNIT</div>
              <div className="flex-1">DRIVER</div>
              <div className="w-14 text-center">STATUS</div>
              <div className="w-16 text-right">SPEED</div>
              <div className="w-12 text-right">PING</div>
            </div>
            
            <div className="flex flex-col gap-3">
              {displayFleet.map((unit, idx) => (
                <div key={unit.unit + idx} className="flex text-[#e2e8e8] items-center">
                  <div className="w-16 text-[#e2e8e8]">{unit.unit}</div>
                  <div className="flex-1 text-[#6b7f7f]">{unit.driver}</div>
                  <div className="w-14 flex justify-center">
                    <LiveDot color={unit.status === 'emergency' ? 'red' : 'amber'} size="sm" />
                  </div>
                  <div className="w-16 text-right">{unit.speed}</div>
                  <div className="w-12 text-right text-[#6b7f7f]">{unit.ping}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Event Log Module */}
        <div className="p-5 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <span className="text-[#e2e8e8]">🖺</span>
            <h2 className="font-display font-bold text-sm tracking-widest text-[#e2e8e8]">EVENT LOG</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2 font-mono text-[9px] leading-relaxed">
            {logs.map(l => (
              <div key={l.id} className="flex gap-2">
                <span className="text-[#374444] shrink-0">[{l.time}]</span>
                <span style={{ color: l.type === 'alert' ? '#ef4444' : l.type === 'success' ? '#10b981' : '#6b7f7f' }}>
                  {l.msg}
                </span>
              </div>
            ))}
          </div>
          <div className="shrink-0 pt-2 text-right">
             <span className="text-[9px] font-mono tracking-widest text-[#10b981] animate-pulse">STREAMING LIVE</span>
          </div>
        </div>

      </aside>
    </div>
  )
}
