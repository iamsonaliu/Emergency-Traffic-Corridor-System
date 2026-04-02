/**
 * TrafficSignal – visual traffic light component.
 * Props:
 *   status  : 'green' | 'yellow' | 'red' | 'cleared' | 'preparing' | 'normal'
 *   signalId: string label shown below the light
 *   compact : bool – render a smaller inline version
 */
export default function TrafficSignal({ status = 'normal', signalId, compact = false }) {
  const mapping = {
    green:     { active: 'green',  label: 'CLEARED',    hex: '#10b981' },
    cleared:   { active: 'green',  label: 'CLEARED',    hex: '#10b981' },
    preparing: { active: 'yellow', label: 'PREPARING',  hex: '#f59e0b' },
    yellow:    { active: 'yellow', label: 'PREPARING',  hex: '#f59e0b' },
    red:       { active: 'red',    label: 'HOLD',       hex: '#ef4444' },
    normal:    { active: 'none',   label: 'STANDBY',    hex: '#374444' },
  }
  const { active, label, hex } = mapping[status] || mapping.normal

  const bulb = (color, activeColor) => {
    const isOn = active === color
    const colors = { red: '#ef4444', yellow: '#f59e0b', green: '#10b981' }
    const off = '#161b1b'
    const bg = isOn ? colors[color] : off
    const shadow = isOn ? `0 0 ${compact ? 8 : 14}px ${colors[color]}` : 'none'
    return (
      <div
        style={{
          width: compact ? 12 : 22,
          height: compact ? 12 : 22,
          borderRadius: '50%',
          background: bg,
          boxShadow: shadow,
          border: `1px solid ${isOn ? colors[color] : '#1f2b2b'}`,
          transition: 'all 0.4s ease',
        }}
      />
    )
  }

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            background: '#131616',
            border: '1px solid #1f2b2b',
            borderRadius: 4,
            padding: '4px 6px',
            display: 'flex',
            gap: 4,
            alignItems: 'center',
          }}
        >
          {bulb('red')} {bulb('yellow')} {bulb('green')}
        </div>
        {signalId && (
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7f7f', letterSpacing: '0.1em' }}>
            {signalId}
          </span>
        )}
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: hex, letterSpacing: '0.1em', marginLeft: 2 }}>
          {label}
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {/* Housing */}
      <div
        style={{
          background: '#131616',
          border: '1px solid #1f2b2b',
          borderRadius: 6,
          padding: '10px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          boxShadow: `0 0 0 1px #0d0f0f`,
        }}
      >
        {bulb('red')}
        {bulb('yellow')}
        {bulb('green')}
      </div>

      {signalId && (
        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#374444', letterSpacing: '0.08em' }}>
          {signalId}
        </span>
      )}
      <span style={{ fontFamily: 'monospace', fontSize: 10, color: hex, letterSpacing: '0.12em', fontWeight: 700 }}>
        {label}
      </span>
    </div>
  )
}
