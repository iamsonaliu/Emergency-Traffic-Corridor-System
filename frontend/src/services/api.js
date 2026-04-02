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
  api.get('/hospitals').then((r) => r.data);

export const getHospital = (id) =>
  api.get(`/hospitals/${id}`).then((r) => r.data);

export const respondToRequest = (id, action, emergencyId) =>
  api.patch(`/hospitals/${id}/respond`, { action, emergencyId }).then((r) => r.data);

export const updateBedCount = (id, data) =>
  api.patch(`/hospitals/${id}/beds`, data).then((r) => r.data);

export const getIncomingRequests = (id) =>
  api.get(`/hospitals/${id}/incoming`).then((r) => r.data);

// ── Traffic ────────────────────────────────────────────────────
export const getActiveCorridors = () =>
  api.get('/traffic/active').then((r) => r.data);

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