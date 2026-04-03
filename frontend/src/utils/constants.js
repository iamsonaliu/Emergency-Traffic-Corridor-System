export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const SIGNAL_STATUS = {
  normal: { label: 'NORMAL', color: '#6b7280' },
  preparing: { label: 'PREPARING', color: '#f59e0b' },
  green: { label: 'GREEN', color: '#10b981' },
  cleared: { label: 'CLEARED', color: '#374151' },
};

export const EMERGENCY_STATUS = {
  triggered: { label: 'TRIGGERED', color: '#ef4444' },
  processing: { label: 'PROCESSING', color: '#f59e0b' },
  en_route: { label: 'EN ROUTE', color: '#10b981' },
  completed: { label: 'COMPLETED', color: '#6b7280' },
  cancelled: { label: 'CANCELLED', color: '#374151' },
};

export const HOSPITAL_STATUS = {
  available: { label: 'AVAILABLE', color: '#10b981' },
  full: { label: 'FULL', color: '#ef4444' },
  no_response: { label: 'NO RESPONSE', color: '#6b7280' },
};

// Default map center (Dehradun)
export const DEFAULT_MAP_CENTER = [30.3165, 78.0322];
export const DEFAULT_MAP_ZOOM = 13;