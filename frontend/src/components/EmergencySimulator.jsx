import { useState } from 'react'
import { triggerEmergency } from '../services/api'

const EMERGENCY_TYPES = [
  { value: 'cardiac', label: 'CARDIAC ARREST', color: '#ef4444' },
  { value: 'trauma', label: 'TRAUMA', color: '#f59e0b' },
  { value: 'stroke', label: 'STROKE', color: '#8b5cf6' },
  { value: 'respiratory', label: 'RESPIRATORY', color: '#06b6d4' },
  { value: 'general', label: 'GENERAL EMERGENCY', color: '#6b7280' }
]

export default function EmergencySimulator({ onEmergencyTriggered }) {
  const [selectedType, setSelectedType] = useState('cardiac')
  const [isLoading, setIsLoading] = useState(false)

  const handleTriggerEmergency = async () => {
    setIsLoading(true)
    try {
      // Generate random location in Dehradun area
      const dehradunBounds = {
        lat: { min: 30.25, max: 30.40 },
        lng: { min: 77.95, max: 78.10 }
      }

      const randomLat = dehradunBounds.lat.min + Math.random() * (dehradunBounds.lat.max - dehradunBounds.lat.min)
      const randomLng = dehradunBounds.lng.min + Math.random() * (dehradunBounds.lng.max - dehradunBounds.lng.min)

      const emergencyData = {
        emergencyType: selectedType,
        location: { lat: randomLat, lng: randomLng },
        patientInfo: {
          age: Math.floor(Math.random() * 80) + 10,
          gender: Math.random() > 0.5 ? 'male' : 'female',
          condition: 'CRITICAL'
        }
      }

      const result = await triggerEmergency(emergencyData)

      if (onEmergencyTriggered) {
        onEmergencyTriggered(result)
      }

      console.log('Emergency triggered:', result)
    } catch (error) {
      console.error('Failed to trigger emergency:', error)
      alert('Failed to trigger emergency simulation')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-[#161b1b] border border-[#1f2b2b] p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#e2e8e8]">🚨</span>
        <h3 className="font-display font-bold text-sm tracking-widest text-[#e2e8e8]">EMERGENCY SIMULATOR</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block font-mono text-[10px] text-[#6b7f7f] tracking-widest mb-2">
            EMERGENCY TYPE
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-[#0d0f0f] border border-[#1f2b2b] text-[#e2e8e8] font-mono text-[10px] tracking-widest px-3 py-2 focus:border-[#4DEEEA] focus:outline-none"
          >
            {EMERGENCY_TYPES.map(type => (
              <option key={type.value} value={type.value} style={{ backgroundColor: '#0d0f0f' }}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleTriggerEmergency}
          disabled={isLoading}
          className={`w-full font-mono text-[10px] tracking-widest px-4 py-3 border transition-colors ${
            isLoading
              ? 'border-[#374444] text-[#374444] cursor-not-allowed'
              : 'border-[#ef4444] text-[#ef4444] hover:bg-[#ef4444]/10'
          }`}
        >
          {isLoading ? 'TRIGGERING...' : 'TRIGGER EMERGENCY'}
        </button>

        <div className="font-mono text-[9px] text-[#6b7f7f] tracking-widest">
          <div>LOCATION: RANDOM DEHRADUN</div>
          <div>STATUS: {isLoading ? 'PROCESSING' : 'READY'}</div>
        </div>
      </div>
    </div>
  )
}