import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from '@/lib/apiClient';

interface UseWebSocketOptions {
  autoConnect?: boolean;
}

interface WebSocketHookReturn {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback?: (data: any) => void) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): WebSocketHookReturn {
  const { autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('✅ WebSocket already connected');
      return;
    }

    const token = getToken();
    if (!token) {
      console.error('❌ No auth token found, cannot connect to WebSocket');
      return;
    }

    const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    console.log('🔌 Connecting to WebSocket:', SOCKET_URL);
    console.log('🔑 Using token:', token.substring(0, 20) + '...');

    socketRef.current = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current.on('connect', () => {
      console.log('✅ ✅ ✅ WebSocket connected successfully! Socket ID:', socketRef.current?.id);
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', (reason: string) => {
      console.log('🔌 WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', (error: Error) => {
      console.error('❌ WebSocket connection error:', error.message);
      console.error('❌ Full error:', error);
      setIsConnected(false);
    });

    socketRef.current.on('error', (error: Error) => {
      console.error('❌ WebSocket error:', error.message || error);
    });
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('Disconnecting WebSocket');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Cannot emit, WebSocket not connected');
    }
  }, []);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback((event: string, callback?: (data: any) => void) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event, callback);
      } else {
        socketRef.current.off(event);
      }
    }
  }, []);

  const joinRoom = useCallback((room: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join_' + room.split('_')[0], room.split('_').slice(1).join('_'));
      console.log(`📍 Joined room: ${room}`);
    }
  }, []);

  const leaveRoom = useCallback((room: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave_' + room.split('_')[0], room.split('_').slice(1).join('_'));
      console.log(`📍 Left room: ${room}`);
    }
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    connect,
    disconnect,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom,
  };
}
