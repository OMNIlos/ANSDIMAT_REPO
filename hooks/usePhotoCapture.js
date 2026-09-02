/**
 * Съёмка снимка для точки наблюдения
 *
 * Камера системная, а не своя на expo-camera: родное приложение отдаёт
 * вспышку, фокус, HDR и зум бесплатно и в том виде, к которому геолог привык.
 * Свой экран съёмки дал бы фирменный вид и подпись координат на кадре — ценой
 * заметно худшего снимка, а снимок здесь документальный.
 *
 * Галерея нужна наравне с камерой: часть снимков делают до того, как поставят
 * точку, и без неё их к точке не пришить.
 */

import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

/**
 * Сжатие снимка
 *
 * Кадр с современного телефона весит 3–5 МБ, и десяток точек за смену съедал
 * бы полгигабайта в песочнице приложения. На снимке оголовка скважины
 * разница между 0.6 и 1.0 не видна.
 */
export const PHOTO_QUALITY = 0.6;

/**
 * @returns {{capture: Function, denied: string|null, clearDenied: Function}}
 */
export default function usePhotoCapture() {
  // Какой доступ не выдан: показывается плашкой на месте, а не Alert.alert —
  // тот не показывает кнопок в веб-сборке
  const [denied, setDenied] = useState(null);

  /**
   * Открывает камеру или галерею
   *
   * @param {'camera'|'library'} source - откуда брать снимок
   * @returns {Promise<string|null>} адрес снимка или null, если отменили
   *   либо не выдали доступ
   */
  const capture = useCallback(async (source) => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setDenied(source);
      return null;
    }
    setDenied(null);

    const options = {
      // Массив, а не MediaTypeOptions: перечисление объявлено устаревшим
      mediaTypes: ['images'],
      quality: PHOTO_QUALITY,
      // Кадрировать документальный снимок скважины незачем
      allowsEditing: false,
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled) return null;
    return result.assets?.[0]?.uri ?? null;
  }, []);

  const clearDenied = useCallback(() => setDenied(null), []);

  return { capture, denied, clearDenied };
}
