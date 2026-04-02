import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const ambulanceMarker = L.divIcon({
  className: '',
  html: `<div style="width:38px;height:38px;background:#ef4444;border:2px solid #fff;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 16px rgba(239,68,68,0.7);">🚑</div>`,
  iconSize:[38,38], iconAnchor:[19,19],
})

const makeHospitalIcon = (selected) => L.divIcon({
  className: '',
  html: `<div style="width:34px;height:34px;background:${selected?'#065f46':'#161b1b'};border:2px solid ${selected?'#10b981':'#2d3f3f'};border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:${selected?'0 0 14px rgba(16,185,129,0.6)':'none'};">🏥</div>`,
  iconSize:[34,34], iconAnchor:[17,17],
})

const makeSignalIcon = (status) => {
  const c = {green:'#10b981',preparing:'#f59e0b',cleared:'#374151',normal:'#2d3f3f'}[status]||'#2d3f3f'
  return L.divIcon({
    className:'',
    html:`<div style="width:12px;height:12px;border-radius:50%;background:${c};border:1px solid ${c};box-shadow:${status==='green'?`0 0 8px ${c}`:'none'};"></div>`,
    iconSize:[12,12], iconAnchor:[6,6],
  })
}

function FlyTo({ center, zoom=14 }) {
  const map = useMap()
  useEffect(() => { if (center) map.flyTo(center, zoom, { duration:1.2 }) }, [center?.toString()])
  return null
}

export default function MapView({
  center=[28.6139,77.209], zoom=13,
  ambulancePos, hospitalCandidates=[], selectedHospital,
  signals=[], routePolyline, flyTo, sectorLabel, children,
}) {
  let routeCoords = []
  try { if (routePolyline) routeCoords = JSON.parse(routePolyline).map(([lg,lt])=>[lt,lg]) } catch {}

  return (
    <div className="relative w-full h-full">
      <MapContainer center={ambulancePos||center} zoom={zoom} style={{width:'100%',height:'100%'}} zoomControl>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
        {flyTo && <FlyTo center={flyTo} />}
        {routeCoords.length>0 && <Polyline positions={routeCoords} pathOptions={{color:'#10b981',weight:4,opacity:0.9}} />}
        {ambulancePos && (
          <Marker position={ambulancePos} icon={ambulanceMarker}>
            <Popup><span style={{fontFamily:'Share Tech Mono',fontSize:11,color:'#10b981'}}>🚑 AMBULANCE</span></Popup>
          </Marker>
        )}
        {hospitalCandidates.map(h=>(
          <Marker key={h.hospitalId} position={[h.location.lat,h.location.lng]} icon={makeHospitalIcon(selectedHospital?.hospitalId===h.hospitalId)}>
            <Popup><span style={{fontFamily:'Share Tech Mono',fontSize:11}}>{h.name} | Beds:{h.availableBeds} | ETA:{h.etaMinutes}min</span></Popup>
          </Marker>
        ))}
        {signals.map(s=>(
          <Marker key={s.signalId} position={[s.location.lat,s.location.lng]} icon={makeSignalIcon(s.status)}>
            <Popup><span style={{fontFamily:'Share Tech Mono',fontSize:11}}>{s.signalId} {s.status.toUpperCase()}</span></Popup>
          </Marker>
        ))}
      </MapContainer>

      {sectorLabel && (
        <div className="absolute top-3 left-3 z-[500] bg-[#0d0f0f]/85 border border-[#2d3f3f] px-3 py-2">
          <div className="font-mono text-[9px] text-[#6b7f7f] tracking-widest mb-0.5">CURRENT SECTOR</div>
          <div className="font-display font-bold text-sm tracking-widest text-[#e2e8e8]">{sectorLabel}</div>
        </div>
      )}
      {children}
    </div>
  )
}