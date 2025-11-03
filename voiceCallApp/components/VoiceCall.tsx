import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcConnection,
} from 'react-native-agora';

interface VoiceCallProps {
  appId: string; // Agora App ID
  channelName?: string; // Предустановленное имя канала
  token?: string; // Токен от сервера
  onEndCall?: () => void; // Callback для завершения звонка
}

const VoiceCall: React.FC<VoiceCallProps> = ({appId, channelName: initialChannelName, token: serverToken, onEndCall}) => {
  const [isJoined, setIsJoined] = useState(false);
  const [channelName, setChannelName] = useState(initialChannelName || '');
  const [token, setToken] = useState(serverToken || ''); // Токен для подключения (если требуется)
  const [isMuted, setIsMuted] = useState(false);
  const [remoteAudioStats, setRemoteAudioStats] = useState<string>('');
  const engineRef = useRef<IRtcEngine | null>(null);

  useEffect(() => {
    initEngine();
    return () => {
      destroyEngine();
    };
  }, []);

  // Автоподключение к каналу после инициализации
  useEffect(() => {
    const timer = setTimeout(() => {
      if (initialChannelName && engineRef.current && !isJoined && token) {
        console.log('[VoiceCall] Auto-joining channel:', initialChannelName);
        joinChannelAutomatically();
      }
    }, 500); // Небольшая задержка для инициализации

    return () => clearTimeout(timer);
  }, [initialChannelName, token, engineRef.current]);

  // Обновляем токен при изменении
  useEffect(() => {
    if (serverToken) {
      setToken(serverToken);
    }
  }, [serverToken]);

  const initEngine = async () => {
    try {
      // Проверка App ID
      if (!appId || appId === 'YOUR_AGORA_APP_ID' || appId.trim() === '') {
        Alert.alert('Ошибка', 'Не указан Agora App ID. Пожалуйста, укажите ваш App ID в App.tsx');
        return;
      }

      // Запрос разрешений
      await requestPermissions();

      // Инициализация Agora Engine
      const engine = createAgoraRtcEngine();
      
      // Регистрация обработчиков событий ДО инициализации
      engine.registerEventHandler({
        onJoinChannelSuccess: (connection: RtcConnection, elapsed: number) => {
          console.log('Успешно подключен к каналу:', connection.channelId, 'UID:', connection.localUid);
          setIsJoined(true);
          Alert.alert('Успех', `Подключен к каналу ${connection.channelId}`);
        },
        onUserJoined: (connection: RtcConnection, remoteUid: number, elapsed: number) => {
          console.log('Пользователь присоединился:', remoteUid);
          Alert.alert('Пользователь присоединился', `UID: ${remoteUid}`);
        },
        onUserOffline: (connection: RtcConnection, remoteUid: number, reason: number) => {
          console.log('Пользователь отключился:', remoteUid);
          Alert.alert('Пользователь отключился', `UID: ${remoteUid}`);
        },
        onLeaveChannel: (connection: RtcConnection, stats: any) => {
          console.log('Покинул канал');
          setIsJoined(false);
        },
        onError: (err: number, msg: string) => {
          console.error('Ошибка Agora:', err, msg);
          let errorMsg = `Код: ${err}`;
          if (err === 110) {
            errorMsg = 'Ошибка 110: Недействительный токен. Если в проекте включен сертификат приложения, необходимо использовать токен вместо App ID при подключении к каналу. Убедитесь, что:\n\n1. Токен сгенерирован для правильного App ID и channel name\n2. Токен не истек\n3. UID при генерации токена совпадает с UID при подключении\n\nДля получения токена используйте Agora Token Generator или ваш сервер.';
          }
          Alert.alert('Ошибка Agora', errorMsg);
        },
        onRemoteAudioStats: (connection: RtcConnection, stats: any) => {
          setRemoteAudioStats(
            `Качество: ${stats.quality}, Задержка: ${stats.networkTransportDelay}ms`,
          );
        },
      });

      // Инициализация после регистрации обработчиков
      await engine.initialize({
        appId: appId,
      });
      engineRef.current = engine;

      // Настройка профиля канала для голосового звонка
      await engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);

      // Установка роли клиента (ведущий)
      await engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

      // Включение аудио
      await engine.enableAudio();
      await engine.enableLocalAudio(true);

      console.log('Agora Engine успешно инициализирован');
    } catch (error) {
      console.error('Ошибка инициализации:', error);
      Alert.alert('Ошибка', `Не удалось инициализировать Agora Engine: ${error}`);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Ошибка', 'Требуется разрешение на использование микрофона');
          return false;
        }
        return true;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const joinChannel = async () => {
    if (!channelName.trim()) {
      Alert.alert('Ошибка', 'Введите название канала');
      return;
    }

    if (!engineRef.current) {
      Alert.alert('Ошибка', 'Engine не инициализирован');
      return;
    }

    try {
      console.log('Попытка подключения к каналу:', channelName);
      // Используем токен, если он указан, иначе пустую строку
      // Если в проекте включен сертификат, токен обязателен
      const channelToken = token.trim() || '';
      const userId = 0; // UID (0 означает автоматическое назначение, но для токена лучше использовать конкретное значение)
      
      console.log('Подключение с токеном:', channelToken ? 'Да' : 'Нет');
      const result = await engineRef.current.joinChannel(
        channelToken, // token (обязателен, если в проекте включен сертификат)
        channelName, // channelId
        userId, // uid
        {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        },
      );
      console.log('Результат подключения:', result);
    } catch (error) {
      console.error('Ошибка подключения:', error);
      Alert.alert('Ошибка', `Не удалось подключиться к каналу: ${error}`);
    }
  };

  const joinChannelAutomatically = async () => {
    if (!engineRef.current || !initialChannelName) {
      return;
    }

    try {
      const channelToken = token.trim() || '';
      const userId = 0;
      
      console.log('Автоматическое подключение к каналу:', initialChannelName);
      await engineRef.current.joinChannel(
        channelToken,
        initialChannelName,
        userId,
        {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        },
      );
    } catch (error) {
      console.error('Ошибка автоматического подключения:', error);
    }
  };

  const leaveChannel = async () => {
    if (!engineRef.current) {
      return;
    }

    try {
      await engineRef.current.leaveChannel();
      setIsJoined(false);
      // Вызываем callback вместо Alert, если передан
      if (onEndCall) {
        onEndCall();
      } else {
        Alert.alert('Успех', 'Отключен от канала');
      }
    } catch (error) {
      console.error('Ошибка отключения:', error);
      if (onEndCall) {
        onEndCall();
      } else {
        Alert.alert('Ошибка', 'Не удалось отключиться от канала');
      }
    }
  };

  const toggleMute = async () => {
    if (!engineRef.current) {
      return;
    }

    try {
      await engineRef.current.muteLocalAudioStream(!isMuted);
      setIsMuted(!isMuted);
    } catch (error) {
      console.error('Ошибка переключения звука:', error);
    }
  };

  const destroyEngine = async () => {
    if (engineRef.current) {
      try {
        await engineRef.current.leaveChannel();
        await engineRef.current.release();
        engineRef.current = null;
      } catch (error) {
        console.error('Ошибка при уничтожении engine:', error);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Agora Аудио Звонок</Text>

      {!isJoined ? (
        <View style={styles.joinContainer}>
          <TextInput
            style={styles.input}
            placeholder="Введите название канала"
            value={channelName}
            onChangeText={setChannelName}
            placeholderTextColor="#999"
          />
          <TextInput
            style={[styles.input, styles.tokenInput]}
            placeholder="Токен (если требуется в настройках проекта)"
            value={token}
            onChangeText={setToken}
            placeholderTextColor="#999"
            autoCapitalize="none"
            secureTextEntry={false}
          />
          <Text style={styles.hintText}>
            💡 Если возникает ошибка 110, значит в проекте включен сертификат приложения.{'\n'}
            Введите токен, сгенерированный для вашего App ID и канала.{'\n'}
            Или отключите авторизацию токена в настройках проекта Agora Console.
          </Text>
          <TouchableOpacity style={styles.button} onPress={joinChannel}>
            <Text style={styles.buttonText}>Присоединиться к каналу</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.callContainer}>
          <Text style={styles.channelInfo}>Канал: {channelName}</Text>
          {remoteAudioStats ? (
            <Text style={styles.stats}>{remoteAudioStats}</Text>
          ) : null}

          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.controlButton, isMuted && styles.controlButtonMuted]}
              onPress={toggleMute}>
              <Text style={styles.controlButtonText}>
                {isMuted ? '🔇 Включить звук' : '🔊 Выключить звук'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.controlButtonLeave]}
              onPress={leaveChannel}>
              <Text style={styles.controlButtonText}>📞 Завершить звонок</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  joinContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tokenInput: {
    marginBottom: 10,
  },
  hintText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
    paddingHorizontal: 5,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  callContainer: {
    width: '100%',
    alignItems: 'center',
  },
  channelInfo: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  stats: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
  },
  controls: {
    width: '100%',
    gap: 15,
  },
  controlButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  controlButtonMuted: {
    backgroundColor: '#FF3B30',
  },
  controlButtonLeave: {
    backgroundColor: '#FF3B30',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VoiceCall;
