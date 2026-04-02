import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ControlRoom from './pages/ControlRoom'
import DriverPage from './pages/DriverPage'
import HospitalPortal from './pages/HospitalPortal'
import TrafficDashboard from './pages/TrafficDashboard'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dispatch" replace />} />
          <Route path="/dispatch"  element={<ControlRoom />} />
          <Route path="/driver"    element={<DriverPage />} />
          <Route path="/hospital"  element={<HospitalPortal />} />
          <Route path="/traffic"   element={<TrafficDashboard />} />
          <Route path="*"          element={<Navigate to="/dispatch" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
