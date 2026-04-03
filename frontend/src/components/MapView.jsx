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
  const colors = {
    green: '#10b981',
    preparing: '#f59e0b',
    pending: '#2d3f3f',
    restored: '#374151',
    cleared: '#374151',
    normal: '#2d3f3f'
  }
  const c = colors[status] || '#2d3f3f'
  const hasGlow = status === 'green' || status === 'preparing'
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${c};border:2px solid ${c};box-shadow:${hasGlow ? `0 0 8px ${c}` : 'none'};"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

function FlyTo({ center, zoom=14 }) {
  const map = useMap()
  useEffect(() => { if (center) map.flyTo(center, zoom, { duration:1.2 }) }, [center?.toString()])
  return null
}

export default function MapView({
  center=[30.3165, 78.0322], zoom=13,  // Dehradun coordinates
  ambulances=[], hospitalCandidates=[], selectedHospital,
  signals=[], routePolyline, flyTo, sectorLabel, children,
}) {
  let routeCoords = []
  try {
    if (routePolyline) {
      if (typeof routePolyline === 'string') {
        routeCoords = JSON.parse(routePolyline).map(([lg, lt]) => [lt, lg])
      } else if (routePolyline?.coordinates) {
        routeCoords = routePolyline.coordinates.map(([lg, lt]) => [lt, lg])
      }
    }
  } catch (err) {
    console.warn('MapView: invalid routePolyline', err)
  }

  const validAmbulances = ambulances.filter((ambulance) =>
    ambulance?.lastKnownGps?.lat !== undefined && ambulance?.lastKnownGps?.lng !== undefined
  )

  const validHospitals = hospitalCandidates.filter((h) => h?.lat !== undefined && h?.lng !== undefined)
  const validSignals = signals.filter((s) => (s?.lat !== undefined && s?.lng !== undefined) || (s?.location?.lat !== undefined && s?.location?.lng !== undefined))

  return (
    <div className="relative w-full h-full">
      <MapContainer center={center} zoom={zoom} style={{width:'100%',height:'100%'}} zoomControl>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
        {flyTo && <FlyTo center={flyTo} />}
        {routeCoords.length>0 && <Polyline positions={routeCoords} pathOptions={{color:'#10b981',weight:4,opacity:0.9}} />}
        {validAmbulances.map((ambulance) => (
          <Marker
            key={ambulance.ambulanceId}
            position={[ambulance.lastKnownGps.lat, ambulance.lastKnownGps.lng]}
            icon={ambulanceMarker}
          >
            <Popup>
              <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: '#10b981' }}>
                🚑 {ambulance.ambulanceId}
                <br />
                {ambulance.driverName}
                <br />
                Status: {ambulance.status?.toUpperCase()}
                <br />
                Speed: {Math.round(ambulance.lastKnownGps?.speed || 0)} km/h
              </span>
            </Popup>
          </Marker>
        ))}
        {validHospitals.map((h) => (
          <Marker
            key={h.hospitalId}
            position={[h.lat, h.lng]}
            icon={makeHospitalIcon(selectedHospital?.hospitalId === h.hospitalId)}
          >
            <Popup>
              <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11 }}>
                {h.name} | Beds:{h.emergencyBeds?.available ?? '?'} / {h.emergencyBeds?.total ?? '?'} | Status:{h.status}
              </span>
            </Popup>
          </Marker>
        ))}
        {validSignals.map((s) => {
          const signalLat = s?.lat ?? s?.location?.lat
          const signalLng = s?.lng ?? s?.location?.lng
          return (
            <Marker key={s.signalId} position={[signalLat, signalLng]} icon={makeSignalIcon(s.status)}>
              <Popup>
                <span style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: '#e2e8e8' }}>
                  {s.signalId} <br />
                  Status: <span style={{ color: s.status === 'green' ? '#10b981' : s.status === 'preparing' ? '#f59e0b' : '#6b7f7f' }}>
                    {s.status?.toUpperCase()}
                  </span><br />
                  ETA: {s.etaMinutes?.toFixed(1)}min
                </span>
              </Popup>
            </Marker>
          )
        })}
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