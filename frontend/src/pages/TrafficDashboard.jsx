import { useState, useEffect } from 'react'
import MapView from '../components/MapView'
import { useSocket, useSocketEvent } from '../services/socket'

export default function TrafficDashboard() {
  const [ambulancePos, setAmbulancePos] = useState([28.6139, 77.213])
  const [targetAmbulance, setTargetAmbulance] = useState(null)
  
  const [activeCorridors, setActiveCorridors] = useState([
    { id: 'NORTH_AVE_CORE', intersections: 7, active: true },
  ])

  // Mock static layout of city signals to visualize state changes
  const [signals, setSignals] = useState([
    { signalId: 'SIG_42_CENTRAL_PARK', location: {lat: 28.6145, lng: 77.2135}, status: 'normal' },
    { signalId: 'SIG_43_NORTH_AVE', location: {lat: 28.6165, lng: 77.2140}, status: 'normal' },
    { signalId: 'SIG_44_EAST_ROUTE', location: {lat: 28.6120, lng: 77.2160}, status: 'normal' },
  ])

  const [logs, setLogs] = useState([
    { id: 1, time: new Date().toLocaleTimeString('en-GB',{hour12:false}), type: 'SYSTEM', msg: 'TRAFFIC DB INITIALIZED', color: '#e2e8e8' }
  ])

  const { connected } = useSocket('traffic', 'main')

  const addLog = (msg, type='INFO', color='#6b7f7f') => {
    setLogs(prev => {
      const time = new Date().toLocaleTimeString('en-GB',{hour12:false})
      return [{ id: Date.now()+Math.random(), time, type, msg, color }, ...prev].slice(0, 50)
    })
  }

  useSocketEvent('corridors_sync', (data) => {
    if (data.corridors) {
      // transform backend corridors array if needed
      setActiveCorridors(data.corridors.map(c => ({
        id: c.routeId || c.id,
        intersections: c.signalCount || 0,
        active: true
      })))
      addLog(`ACTIVE CORRIDORS SYNCED: ${data.corridors.length}`, 'SYSTEM', '#e2e8e8')
    }
  })

  // Specific Design Document Events
  useSocketEvent('corridor-activated', (data) => {
    setSignals(prev => prev.map(s => (data.signalIds && data.signalIds.includes(s.signalId)) ? { ...s, status: 'green' } : s))
    addLog(`CORRIDOR [${data.corridorId}] FULLY ACTIVATED`, 'INFO', '#10b981')
  })

  useSocketEvent('corridor-deactivated', (data) => {
    setSignals(prev => prev.map(s => (data.signalIds && data.signalIds.includes(s.signalId)) ? { ...s, status: 'normal' } : s))
    addLog(`CORRIDOR [${data.corridorId}] DEACTIVATED. RESUMING NORMAL CYCLES.`, 'INFO', '#6b7f7f')
  })

  useSocketEvent('signal-override', (data) => {
    setSignals(prev => prev.map(s => s.signalId === data.signalId ? { ...s, status: data.state === 'green' ? 'green' : 'red' } : s))
    addLog(`MANUAL OVERRIDE: ${data.signalId} FORCED ${data.state.toUpperCase()}`, 'WARN', data.state === 'green' ? '#10b981' : '#ef4444')
  })

  useSocketEvent('ambulance_location_update', (data) => {
    setAmbulancePos([data.lat, data.lng])
    setTargetAmbulance({
      id: data.ambulanceId,
      lat: data.lat.toFixed(4),
      lng: data.lng.toFixed(4),
      speed: data.speed
    })
  })

  const overrideSignal = async (state) => {
    try {
      // Minimal mock for the POST call / trigger local socket for immediate UI response
      // await axios.post('/api/traffic/signal/override', { signalId: 'SIG_42_CENTRAL_PARK', state })
      addLog(`SIGNAL_42 FORCED ${state.toUpperCase()} - MANUAL_USER_01`, 'WARN', state==='red'?'#ef4444':'#f59e0b')
      setSignals(prev => prev.map(s => s.signalId === 'SIG_42_CENTRAL_PARK' ? { ...s, status: state === 'green' ? 'green' : 'red' } : s))
    } catch(err) {
      addLog(`OVERRIDE FAILED`, 'ALERT', '#ef4444')
    }
  }

  return (
    <div className="h-full flex overflow-hidden bg-[#0d0f0f]">
      
      {/* Map Area */}
      <div className="flex-1 relative border-r border-[#1f2b2b]">
        
        {/* Top Left Target Vector Overlay */}
        <div className="absolute top-8 left-8 z-[500] border border-[#1f2b2b] bg-[#161b1b]/90 p-4" style={{backdropFilter: 'blur(4px)'}}>
           <div className="font-mono text-[9px] text-[#6b7f7f] tracking-widest mb-1 uppercase">TARGET VECTOR</div>
           <div className="font-display font-bold text-2xl text-[#e2e8e8] tracking-[0.1em] mb-2">{targetAmbulance ? targetAmbulance.id : 'NO_TARGET_AQUIRED'}</div>
           <div className="font-mono text-[10px] text-[#6b7f7f] tracking-widest">
             LAT: {targetAmbulance ? targetAmbulance.lat : '--'} | LON: {targetAmbulance ? targetAmbulance.lng : '--'}
           </div>
        </div>

        {/* Bottom Right System Status Overlay */}
        <div className="absolute bottom-12 right-8 z-[500] border border-[#f59e0b] bg-[#161b1b]/90 p-4 min-w-[240px] border-l-4" style={{backdropFilter: 'blur(4px)'}}>
           <div className="font-mono text-[9px] text-[#f59e0b] tracking-widest mb-0.5 text-right uppercase">SYSTEM STATUS</div>
           <div className="font-display font-bold text-2xl text-[#e2e8e8] tracking-[0.1em] text-right mb-2">
             {connected ? 'OPTIMIZED_FLOW' : 'OFFLINE'}
           </div>
           <div className="font-mono text-[10px] text-[#6b7f7f] tracking-widest text-right">RESPONSE_TIME: <span className="text-[#e2e8e8]">-14.2%</span></div>
        </div>

        <MapView
          center={[28.614, 77.213]}
          ambulancePos={ambulancePos}
          hospitalCandidates={[]}
          signals={signals}
        />
        
      </div>

      {/* Right Sidebar - Traffic Controls */}
      <aside className="w-[340px] xl:w-[420px] shrink-0 flex flex-col bg-[#131616]">
        
        {/* Active Corridors */}
        <div className="flex flex-col p-6 border-b border-[#1f2b2b]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-display font-bold text-sm tracking-widest text-[#e2e8e8] border-l-4 border-[#4DEEEA] pl-2">ACTIVE CORRIDORS</h2>
            <span className="font-mono text-[9px] text-[#6b7f7f] uppercase tracking-widest">LIVE_DATA_STREAM</span>
          </div>

          <div className="flex flex-col gap-4">
            {activeCorridors.length === 0 && <div className="text-[#6b7f7f] font-mono text-[10px] italic">NO CORRIDORS ACTIVE</div>}
            {activeCorridors.map((c, i) => (
              <div key={i} className="flex justify-between items-center border-b border-[#1f2b2b] pb-4 last:border-0 last:pb-0">
                <div>
                  <div className="font-display font-bold text-[13px] text-[#e2e8e8] tracking-widest mb-1">{c.id}</div>
                  <div className="font-mono text-[9px] text-[#6b7f7f]">{c.intersections} INTERSECTIONS ACTIVE</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[9px] uppercase tracking-widest" style={{color: c.active ? '#f59e0b' : '#6b7f7f'}}>
                    {c.active ? 'ACTIVE' : 'IDLE'}
                  </span>
                  {/* Toggle Switch UI */}
                  <div className="w-10 h-5 border border-[#1f2b2b] bg-[#1a1e1e] flex items-center p-0.5" style={{justifyContent: c.active ? 'flex-end' : 'flex-start', borderColor: c.active ? '#4DEEEA' : '#1f2b2b'}}>
                     <div className="w-3.5 h-3.5" style={{backgroundColor: c.active ? '#4DEEEA' : '#374444'}} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Manual Override Settings */}
        <div className="flex flex-col p-6 border-b border-[#1f2b2b]">
          <h2 className="font-display font-bold text-sm tracking-widest text-[#e2e8e8] border-l-4 border-[#f59e0b] pl-2 mb-6">MANUAL OVERRIDE</h2>
          
          <div className="font-mono text-[9px] text-[#6b7f7f] uppercase tracking-widest mb-2">SIGNAL_ID SELECTION</div>
          <div className="border border-[#1f2b2b] bg-[#1a1e1e] p-3 flex justify-between items-center mb-6 cursor-pointer">
             <span className="font-display font-semibold text-xs tracking-widest text-[#e2e8e8]">SIG_42_CENTRAL_PARK</span>
             <span className="text-[#6b7f7f]">▼</span>
          </div>

          <div className="flex gap-4">
             <button onClick={() => overrideSignal('green')} className="flex-1 border border-[#f59e0b]/30 bg-[#1a1e1e] text-[#f59e0b] font-display font-bold text-[11px] tracking-widest py-3 hover:bg-[#f59e0b]/10 transition-colors">
               FORCE GREEN
             </button>
             <button onClick={() => overrideSignal('red')} className="flex-1 border border-[#ef4444]/30 bg-[#ef4444]/5 text-[#ef4444] font-display font-bold text-[11px] tracking-widest py-3 hover:bg-[#ef4444]/10 transition-colors">
               FORCE RED
             </button>
          </div>
        </div>

        {/* System Log */}
        <div className="flex flex-col p-6 flex-1 overflow-hidden">
          <h2 className="font-display font-bold text-sm tracking-widest text-[#e2e8e8] border-l-4 border-[#6b7f7f] pl-2 mb-6">SYSTEM LOG</h2>
          
          <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-4 font-mono text-[10px] leading-relaxed">
            {logs.map(l => (
              <div key={l.id} className="flex gap-4">
                <span className="text-[#374444] shrink-0 w-[50px]">{l.time}</span>
                <span className="shrink-0 w-[45px]" style={{ color: l.color }}>{l.type}</span>
                <span className="text-[#e2e8e8]" style={{color: l.type === 'ALERT' ? '#ef4444' : '#e2e8e8'}}>{l.msg}</span>
              </div>
            ))}
          </div>
        </div>

      </aside>
    </div>
  )
}
