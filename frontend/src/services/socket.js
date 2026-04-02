import { io } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';
import { SOCKET_URL } from '../utils/constants';

// Singleton socket instance
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * useSocket(role, entityId)
 * Returns the socket instance and connection status.
 * Joins the appropriate room based on role.
 */
export function useSocket(role, entityId) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;

    s.on('connect', () => {
      setConnected(true);
      if (role && entityId) {
        s.emit('join:room', { role, entityId });
      }
    });

    s.on('disconnect', () => setConnected(false));

    if (s.connected) {
      setConnected(true);
      if (role && entityId) {
        s.emit('join:room', { role, entityId });
      }
    }

    return () => {
      s.off('connect');
      s.off('disconnect');
    };
  }, [role, entityId]);

  return { socket: socketRef.current, connected };
}

/**
 * useSocketEvent(eventName, handler)
 * Attaches a socket listener for the lifetime of the component.
 */
export function useSocketEvent(eventName, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const s = getSocket();
    const fn = (...args) => handlerRef.current(...args);
    s.on(eventName, fn);
    return () => s.off(eventName, fn);
  }, [eventName]);
}