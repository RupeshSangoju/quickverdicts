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
  // Queue of rooms to join once the socket connects
  const pendingRoomsRef = useRef<Set<string>>(new Set());

  const emitJoin = useCallback((room: string) => {
    const parts = room.split('_');
    // Reconstruct event name and caseId correctly regardless of underscores in room prefix.
    // Room format is always <event_name>_<caseId> where event names are known fixed strings.
    // Known room prefixes (in order of specificity, longest first):
    const knownPrefixes = [
      'jury_charge_builder',
      'verdict_monitoring',
      'case',
    ];
    for (const prefix of knownPrefixes) {
      if (room.startsWith(prefix + '_')) {
        const caseId = room.slice(prefix.length + 1);
        socketRef.current!.emit(`join_${prefix}`, caseId);
        console.log(`📍 Joined room: ${room}`);
        return;
      }
    }
    // Fallback: original behaviour
    socketRef.current!.emit('join_' + parts[0], parts.slice(1).join('_'));
    console.log(`📍 Joined room: ${room}`);
  }, []);

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
      // Drain any rooms that were requested before/during connection
      if (pendingRoomsRef.current.size > 0) {
        console.log(`📍 Rejoining ${pendingRoomsRef.current.size} pending room(s) after connect`);
        pendingRoomsRef.current.forEach((room) => emitJoin(room));
      }
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
  }, [emitJoin]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('Disconnecting WebSocket');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
    pendingRoomsRef.current.clear();
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
    // Always track this room so it can be rejoined after reconnects
    pendingRoomsRef.current.add(room);
    if (socketRef.current?.connected) {
      emitJoin(room);
    } else {
      console.log(`📍 Room queued (not yet connected): ${room}`);
    }
  }, [emitJoin]);

  const leaveRoom = useCallback((room: string) => {
    pendingRoomsRef.current.delete(room);
    if (socketRef.current?.connected) {
      const parts = room.split('_');
      const knownPrefixes = ['jury_charge_builder', 'verdict_monitoring', 'case'];
      for (const prefix of knownPrefixes) {
        if (room.startsWith(prefix + '_')) {
          const caseId = room.slice(prefix.length + 1);
          socketRef.current.emit(`leave_${prefix}`, caseId);
          console.log(`📍 Left room: ${room}`);
          return;
        }
      }
      socketRef.current.emit('leave_' + parts[0], parts.slice(1).join('_'));
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
