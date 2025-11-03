/**
 * Voice Call App with Agora
 *
 * @format
 */

import React, { useState, useEffect, useRef } from 'react';
import { StatusBar, StyleSheet, useColorScheme, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import VoiceCall from './components/VoiceCall';
import IncomingCall from './components/IncomingCall';
import UserList, { User } from './components/UserList';
import Register from './components/Register';
import WaitingForAnswer from './components/WaitingForAnswer';
import { useSocket } from './hooks/useSocket';
import { AGORA_APP_ID } from '@env';

type AppScreen = 'register' | 'userList' | 'incomingCall' | 'waitingForAnswer' | 'activeCall';

interface IncomingCallData {
  callId: string;
  channelName: string;
  fromUser: User;
  token: string;
  appId: string;
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('register');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [incomingCallData, setIncomingCallData] = useState<IncomingCallData | null>(null);
  const [activeCallData, setActiveCallData] = useState<{
    userName: string;
    channelName: string;
    token: string;
    appId?: string;
  } | null>(null);
  const socket = useSocket(currentUserId);
  const activeCallIdRef = useRef<string | null>(null);

  //test git

  // Регистрация пользователя
  const handleRegisterSuccess = (userId: string, userName: string) => {
    setCurrentUserId(userId);
    setCurrentUserName(userName);
    setCurrentScreen('userList');
  };

  // Обработчики Socket событий
  useEffect(() => {
    if (!socket.socket) return;

    // Входящий звонок
    const handleIncomingCall = (data: any) => {
      console.log('[App] Incoming call:', data);
      setIncomingCallData({
        callId: data.callId,
        channelName: data.channelName,
        fromUser: data.fromUser,
        token: data.token,
        appId: data.appId,
      });
      setCurrentScreen('incomingCall');
    };

    // Звонок инициирован (для звонящего)
    const handleCallInitiated = (data: any) => {
      console.log('[App] Call initiated:', data);
      activeCallIdRef.current = data.callId;
      setActiveCallData({
        userName: data.toUser.name,
        channelName: data.channelName,
        token: data.token,
      });
      setCurrentScreen('waitingForAnswer');
    };

    // Звонок принят
    const handleCallAccepted = (data: any) => {
      console.log('[App] Call accepted:', data);
      // Переключаем на экран активного звонка
      if (activeCallData) {
        setCurrentScreen('activeCall');
      }
    };

    // Звонок отклонен
    const handleCallDeclined = (data: any) => {
      console.log('[App] Call declined:', data);
      setActiveCallData(null);
      setCurrentScreen('userList');
      activeCallIdRef.current = null;
      Alert.alert('Звонок отклонен', 'Пользователь не ответил на звонок');
    };

    // Звонок завершен
    const handleCallEnded = (data: any) => {
      console.log('[App] Call ended:', data);
      setActiveCallData(null);
      setCurrentScreen('userList');
      activeCallIdRef.current = null;
    };

    // Ошибка звонка
    const handleCallError = (data: any) => {
      console.error('[App] Call error:', data);
      Alert.alert('Ошибка', data.message || 'Произошла ошибка при звонке');
    };

    // Регистрируем обработчики
    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:initiated', handleCallInitiated);
    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:declined', handleCallDeclined);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:error', handleCallError);

    // Очистка
    return () => {
      socket.off('call:incoming');
      socket.off('call:initiated');
      socket.off('call:accepted');
      socket.off('call:declined');
      socket.off('call:ended');
      socket.off('call:error');
    };
  }, [socket, currentScreen, activeCallData]);

  // Инициация звонка
  const handleCallUser = (userId: string) => {
    if (!currentUserId) return;

    console.log('[App] Calling user:', userId);
    socket.emit('call:initiate', {
      fromUserId: currentUserId,
      toUserId: userId,
    });
  };

  // Принятие звонка
  const handleAcceptCall = () => {
    if (!incomingCallData) return;

    console.log('[App] Accepting call:', incomingCallData.callId);
    activeCallIdRef.current = incomingCallData.callId;
    
    // Отправляем сигнал принятия на сервер
    socket.emit('call:accept', { callId: incomingCallData.callId });
    
    // Подключаемся к звонку
    setActiveCallData({
      userName: incomingCallData.fromUser.name,
      channelName: incomingCallData.channelName,
      token: incomingCallData.token,
    });
    
    setCurrentScreen('activeCall');
    setIncomingCallData(null);
  };

  // Отклонение звонка
  const handleDeclineCall = () => {
    if (!incomingCallData) return;

    console.log('[App] Declining call:', incomingCallData.callId);
    socket.emit('call:decline', { callId: incomingCallData.callId });
    
    setIncomingCallData(null);
    setCurrentScreen('userList');
  };

  // Завершение звонка
  const handleEndCall = () => {
    if (activeCallIdRef.current) {
      console.log('[App] Ending call:', activeCallIdRef.current);
      socket.emit('call:end', { callId: activeCallIdRef.current });
      activeCallIdRef.current = null;
    }
    
    setCurrentScreen('userList');
    setActiveCallData(null);
  };

  // Рендер экранов
  const renderScreen = () => {
    switch (currentScreen) {
      case 'register':
        return <Register onRegisterSuccess={handleRegisterSuccess} />;

      case 'userList':
        return (
          <UserList
            users={socket.users}
            currentUserId={currentUserId || ''}
            onCallUser={handleCallUser}
          />
        );

      case 'incomingCall':
        return incomingCallData ? (
          <IncomingCall
            callerName={incomingCallData.fromUser.name}
            channelName={incomingCallData.channelName}
            onAccept={handleAcceptCall}
            onDecline={handleDeclineCall}
          />
        ) : null;

      case 'waitingForAnswer':
        return activeCallData ? (
          <WaitingForAnswer
            userName={activeCallData.userName}
            onEndCall={handleEndCall}
          />
        ) : null;

      case 'activeCall':
        return activeCallData ? (
          <VoiceCall
            appId={activeCallData.appId || AGORA_APP_ID}
            channelName={activeCallData.channelName}
            token={activeCallData.token}
            onEndCall={handleEndCall}
          />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {renderScreen()}
    </SafeAreaProvider>
  );
}

export default App;