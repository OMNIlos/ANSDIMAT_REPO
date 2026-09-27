/**
 * Полноэкранный просмотр снимков точки
 *
 * Миниатюра в шторке показывает, что снимок есть, но не показывает, что на
 * нём: разглядеть оголовок скважины на квадрате в палец нельзя.
 *
 * Фон чёрный, а не «бумажный» фон приложения: снимок должен читаться, а не
 * соревноваться с интерфейсом за внимание. Это единственное место, где
 * приложение отступает от своей палитры, и отступает намеренно.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import I18n from '../Localization';
import { spacing } from '../theme';

/**
 * @param {Object} props
 * @param {Array} props.photos - вложения вида photo
 * @param {number} props.initialIndex - какой снимок открыт первым
 * @param {boolean} props.visible - показан ли просмотр
 * @param {Function} props.onClose - закрытие
 * @param {Function} props.onDelete - удаление открытого снимка
 */
export default function PhotoViewer({ photos, initialIndex, visible, onClose, onDelete }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  const scrollRef = useRef(null);

  // Открывать нужно тот снимок, по которому нажали, а не первый в ленте
  useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  const current = photos[index] ?? null;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: initialIndex * width, y: 0 }}
          onMomentumScrollEnd={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
          }
        >
          {photos.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: photo.uri }}
              style={{ width, height }}
              resizeMode="contain"
            />
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.action, styles.close, { top: insets.top + spacing.md }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={I18n.t('closePhoto', { defaultValue: 'Закрыть снимок' })}
        >
          <MaterialIcons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {!!current && (
          <TouchableOpacity
            style={[styles.action, styles.delete, { top: insets.top + spacing.md }]}
            onPress={() => onDelete(current)}
            accessibilityRole="button"
            accessibilityLabel={I18n.t('delete', { defaultValue: 'Удалить' })}
          >
            <MaterialIcons name="delete-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  action: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    // Полупрозрачная подложка: на светлом снимке белая иконка без неё пропадает
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  close: {
    left: spacing.lg,
  },
  delete: {
    right: spacing.lg,
  },
});
