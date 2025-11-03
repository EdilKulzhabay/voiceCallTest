import { useEffect, useRef } from 'react';
import Sound from 'react-native-sound';

let ringtoneSound: Sound | null = null;

export const useCallSound = (shouldPlay: boolean) => {
  const soundRef = useRef<Sound | null>(null);

  useEffect(() => {
    // Инициализация звука при первом использовании
    if (!ringtoneSound) {
      // Для React Native Sound нужно указать путь к файлу
      // Здесь используем системный звук звонка
      ringtoneSound = new Sound('ringtone.mp3', Sound.MAIN_BUNDLE, (error) => {
        if (error) {
          console.log('[Sound] Failed to load ringtone, using fallback');
          // Если файл не найден, создаем простой sound объект
          ringtoneSound = null;
        } else {
          console.log('[Sound] Ringtone loaded');
          ringtoneSound?.setNumberOfLoops(-1); // Бесконечный цикл
          ringtoneSound?.setVolume(0.7);
        }
      });
    }

    soundRef.current = ringtoneSound;

    return () => {
      if (soundRef.current) {
        soundRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (shouldPlay && soundRef.current) {
      console.log('[Sound] Playing ringtone');
      soundRef.current.play();
    } else if (!shouldPlay && soundRef.current) {
      console.log('[Sound] Stopping ringtone');
      soundRef.current.stop();
    }
  }, [shouldPlay]);
};

// Функция для вибрации (простейшая реализация)
export const triggerVibration = () => {
  // В React Native используем Vibration API
  try {
    const { Vibration } = require('react-native');
    Vibration.vibrate([500, 1000, 500], true); // Паттерн вибрации
  } catch (error) {
    console.log('[Vibration] Not available');
  }
};
