import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Vibration,
} from 'react-native';

interface IncomingCallProps {
  callerName: string;
  channelName: string;
  onAccept: () => void;
  onDecline: () => void;
}

const IncomingCall: React.FC<IncomingCallProps> = ({
  callerName,
  channelName,
  onAccept,
  onDecline,
}) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  React.useEffect(() => {
    // Вибрация при входящем звонке
    const pattern = [0, 1000, 1000, 1000];
    Vibration.vibrate(pattern, true);
    
    return () => {
      Vibration.cancel();
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Иконка профиля с анимацией */}
        <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {callerName.charAt(0).toUpperCase()}
            </Text>
          </View>
        </Animated.View>

        {/* Информация о звонке */}
        <Text style={styles.incomingText}>Входящий звонок</Text>
        <Text style={styles.callerName}>{callerName}</Text>
        <Text style={styles.channelName}>Канал: {channelName}</Text>

        {/* Кнопки управления */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.declineButton]}
            onPress={onDecline}>
            <View style={styles.buttonIcon}>
              <Text style={styles.buttonIconText}>📞</Text>
            </View>
            <Text style={styles.buttonText}>Отклонить</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={onAccept}>
            <View style={styles.buttonIcon}>
              <Text style={styles.buttonIconText}>✓</Text>
            </View>
            <Text style={styles.buttonText}>Принять</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  avatarContainer: {
    marginBottom: 40,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarText: {
    fontSize: 50,
    fontWeight: 'bold',
    color: '#fff',
  },
  incomingText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  callerName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  channelName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 60,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 300,
  },
  button: {
    alignItems: 'center',
    width: 80,
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  buttonIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonIconText: {
    fontSize: 30,
  },
});

export default IncomingCall;
