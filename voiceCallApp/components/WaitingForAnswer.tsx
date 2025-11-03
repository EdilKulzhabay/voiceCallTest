import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';

interface WaitingForAnswerProps {
  userName: string;
  onEndCall: () => void;
}

const WaitingForAnswer: React.FC<WaitingForAnswerProps> = ({ userName, onEndCall }) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Анимация звонка */}
        <Animated.View style={[styles.phoneIconContainer, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.phoneIcon}>📞</Text>
        </Animated.View>

        {/* Информация о звонке */}
        <Text style={styles.statusText}>Звоним...</Text>
        <Text style={styles.userName}>{userName}</Text>
        <Text style={styles.hintText}>Ожидание ответа</Text>

        {/* Кнопка завершения звонка */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onEndCall}>
          <View style={styles.cancelButtonIcon}>
            <Text style={styles.cancelButtonIconText}>📞</Text>
          </View>
          <Text style={styles.cancelButtonText}>Отменить</Text>
        </TouchableOpacity>
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
  phoneIconContainer: {
    marginBottom: 40,
  },
  phoneIcon: {
    fontSize: 80,
  },
  statusText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  userName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  hintText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 60,
  },
  cancelButton: {
    alignItems: 'center',
    width: 100,
  },
  cancelButtonIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelButtonIconText: {
    fontSize: 30,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default WaitingForAnswer;
