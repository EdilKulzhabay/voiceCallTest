import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SERVER_URL_DEV, SERVER_URL_PROD } from '@env';

const SERVER_URL = __DEV__ ? SERVER_URL_DEV : SERVER_URL_PROD;

interface User {
  id: string;
  name: string;
}

interface CallData {
  callId: string;
  channelName: string;
  token: string;
  appId: string;
  toUser?: User;
  fromUser?: User;
}

export const useSocket = (userId: string | null) => {
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, (...args: any[]) => void>>(new Map());

  useEffect(() => {
    if (!userId) {
      return;
    }

    console.log('[Socket] Connecting to server...', SERVER_URL);
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // События подключения
    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
      
      // Авторизуемся после подключения
      socket.emit('auth', { userId });
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      setIsConnected(false);
    });

    // Получение списка пользователей
    socket.on('auth:success', (data) => {
      console.log('[Socket] Authenticated:', data);
    });

    socket.on('auth:error', (error) => {
      console.error('[Socket] Auth error:', error);
    });

    socket.on('users:list', (usersList: User[]) => {
      console.log('[Socket] Users list:', usersList);
      setUsers(usersList);
    });

    socket.on('user:online', (data: { userId: string; name: string }) => {
      console.log('[Socket] User online:', data);
      setUsers(prev => {
        const existing = prev.find(u => u.id === data.userId);
        if (!existing) {
          return [...prev, { id: data.userId, name: data.name }];
        }
        return prev;
      });
    });

    socket.on('user:offline', (data: { userId: string; name: string }) => {
      console.log('[Socket] User offline:', data);
      setUsers(prev => prev.filter(u => u.id !== data.userId));
    });

    return () => {
      console.log('[Socket] Cleaning up...');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);

  // Регистрация пользовательских обработчиков
  const on = (event: string, handler: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
      listenersRef.current.set(event, handler);
    }
  };

  // Удаление обработчиков
  const off = (event: string) => {
    if (socketRef.current) {
      const handler = listenersRef.current.get(event);
      if (handler) {
        socketRef.current.off(event, handler);
        listenersRef.current.delete(event);
      }
    }
  };

  const emit = (event: string, data: any) => {
    if (socketRef.current && isConnected) {
      console.log('[Socket] Emitting:', event, data);
      socketRef.current.emit(event, data);
    } else {
      console.warn('[Socket] Cannot emit: not connected');
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    users,
    on,
    off,
    emit,
  };
};
