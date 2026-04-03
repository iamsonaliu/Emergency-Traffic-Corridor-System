import axios from 'axios';
import { API_BASE } from '../utils/constants';

const api = axios.create({ baseURL: API_BASE, timeout: 10000 });

// ── Ambulance ──────────────────────────────────────────────────
export const triggerEmergency = (payload) =>
  api.post('/ambulance/trigger', payload).then((r) => r.data);

export const getEmergencyStatus = (emergencyId) =>
  api.get(`/ambulance/emergency/${emergencyId}`).then((r) => r.data);

export const getActiveEmergencies = () =>
  api.get('/ambulance/active').then((r) => r.data);

export const cancelEmergency = (emergencyId) =>
  api.patch(`/ambulance/emergency/${emergencyId}/cancel`).then((r) => r.data);

// ── Hospitals ──────────────────────────────────────────────────
export const getAllHospitals = () =>
  api.get('/hospital').then((r) => r.data);

export const getHospital = (id) =>
  api.get(`/hospital/${id}`).then((r) => r.data);

export const respondToRequest = (id, action, emergencyId) =>
  api.post(`/hospital/${id}/respond`, { action, ambulanceId: id, emergencyId }).then((r) => r.data);

export const updateBedCount = (id, data) =>
  api.put(`/hospital/${id}/beds`, data).then((r) => r.data);

export const getIncomingRequests = (id) =>
  api.get(`/hospital/${id}/requests`).then((r) => r.data);

// ── Traffic ────────────────────────────────────────────────────
export const getActiveCorridors = () =>
  api.get('/traffic/corridors').then((r) => r.data);

export const getCorridorStatus = (emergencyId) =>
  api.get(`/traffic/corridor/${emergencyId}`).then((r) => r.data);

export const advanceSignal = (emergencyId, signalId) =>
  api.post('/traffic/signal/advance', { emergencyId, signalId }).then((r) => r.data);

export const restoreCorridor = (emergencyId) =>
  api.post(`/traffic/corridor/${emergencyId}/restore`).then((r) => r.data);

// ── Health ─────────────────────────────────────────────────────
export const healthCheck = () =>
  api.get('/health').then((r) => r.data);

export default api;