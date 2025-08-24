/**
 * SimpleChart.js - Упрощенная версия графика с надежным сенсорным взаимодействием
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  PanResponder,
  ScrollView,
  Platform,
} from 'react-native';
import Svg, {
  G,
  Line,
  Circle,
  Text as SvgText,
  Rect,
} from 'react-native-svg';
import { useTheme, Surface, IconButton } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { WELL_COLORS } from '../utils/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import I18n from '../../../Localization';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Улучшенная функция форматирования значений осей
const formatAxisValue = (value) => {
  // Обрабатываем значения, близкие к нулю
  if (Math.abs(value) < 0.0000001) {
    return '0';
  }
  
  // Очень маленькие или очень большие значения в экспоненциальной форме
  if (Math.abs(value) < 0.01 || Math.abs(value) > 10000) {
    return value.toExponential(1); // Уменьшаем количество знаков после запятой
  }
  
  // Для дробных значений
  if (Math.abs(value) < 1) {
    // Для очень маленьких дробей ограничиваем до 2 знаков
    const precision = Math.abs(value) < 0.1 ? 2 : 1;
    return value.toFixed(precision);
  }
  
  // Для целых чисел и чисел с дробной частью
  if (Math.abs(value) < 10) {
    return value.toFixed(1);
  }
  
  // Для больших чисел округляем до целых
  return Math.round(value).toString();
};

export default function SimpleChart({
  points,
  selectedPoints = {},
  onPointPress,
  lineParams = {},
  selectedFunction,
  colorByWellId = {},
  chartRef,
  isFullScreen = false,
}) {
  const theme = useTheme();
  
  // Базовые настройки размеров
  const chartWidth = isFullScreen ? SCREEN_WIDTH : SCREEN_WIDTH - 16;
  const chartHeight = isFullScreen ? SCREEN_HEIGHT * 0.6 : 350;
  const padding = 40; // Отступ от краев для осей
  
  // Состояние для масштабирования и смещения
  const [scale, setScale] = useState(1.0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  
  // Состояние для отслеживания жестов
  const lastGestureState = useRef({ x: 0, y: 0, scale: 1, distance: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  
  // Вычисляем границы данных с улучшенными отступами
  const bounds = React.useMemo(() => {
    if (!points || points.length === 0) {
      return { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };
    }
    
    let xMin = Math.min(...points.map(p => p.x));
    let xMax = Math.max(...points.map(p => p.x));
    let yMin = Math.min(...points.map(p => p.y));
    let yMax = Math.max(...points.map(p => p.y));
    
    // Вычисляем диапазоны
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    
    // Добавляем отступы 15% для лучшей видимости
    const xPadding = xRange * 0.15;
    const yPadding = yRange * 0.15;
    
    return {
      xMin: xMin - xPadding,
      xMax: xMax + xPadding,
      yMin: yMin - yPadding,
      yMax: yMax + yPadding,
    };
  }, [points]);
  
  // Вычисляем диапазоны для использования в других функциях
  const xRange = bounds.xMax - bounds.xMin;
  const yRange = bounds.yMax - bounds.yMin;
  
  // Функция для преобразования координат данных в координаты экрана
  const dataToScreen = (x, y) => {
    const xRange = bounds.xMax - bounds.xMin;
    const yRange = bounds.yMax - bounds.yMin;
    
    // Применяем масштаб и смещение
    const scaledWidth = (chartWidth - 2 * padding) * scale;
    const scaledHeight = (chartHeight - 2 * padding) * scale;
    
    const screenX = padding + (x - bounds.xMin) / xRange * scaledWidth + offsetX;
    const screenY = chartHeight - padding - (y - bounds.yMin) / yRange * scaledHeight + offsetY;
    
    return { x: screenX, y: screenY };
  };
  
  // Загрузка сохраненного состояния
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        const key = `simple_chart_state_${selectedFunction?.name || 'default'}`;
        const savedState = await AsyncStorage.getItem(key);
        if (savedState) {
          const { scale: savedScale, offsetX: savedOffsetX, offsetY: savedOffsetY } = JSON.parse(savedState);
          setScale(savedScale);
          setOffsetX(savedOffsetX);
          setOffsetY(savedOffsetY);
        }
      } catch (error) {
        // Ошибка загрузки состояния графика
      }
    };
    
    loadSavedState();
  }, [selectedFunction]);
  
  // Сохранение состояния
  const saveState = async () => {
    try {
      const key = `simple_chart_state_${selectedFunction?.name || 'default'}`;
      await AsyncStorage.setItem(key, JSON.stringify({ scale, offsetX, offsetY }));
    } catch (error) {
      // Ошибка сохранения состояния графика
    }
  };
  
  // Улучшенная обработка жестов для Android и iOS
  const panResponder = PanResponder.create({
    // Начальное определение нажатия
    onStartShouldSetPanResponder: (evt) => {
      // На Android сначала проверим, не было ли нажатие на точку
      const { nativeEvent } = evt;
      const touch = nativeEvent.touches[0];
      
      // Если это одиночное касание, проверяем, не нажата ли точка
      if (nativeEvent.touches.length === 1 && onPointPress) {
        // Ищем ближайшую точку в пределах 50px для Android, 30px для iOS
        const touchRadius = Platform.OS === 'android' ? 50 : 30;
        let closestPointIndex = -1;
        let minDistance = Number.MAX_VALUE;
        
        points.forEach((point, index) => {
          const screenPos = dataToScreen(point.x, point.y);
          const dx = screenPos.x - touch.pageX;
          const dy = screenPos.y - touch.pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < touchRadius && distance < minDistance) {
            minDistance = distance;
            closestPointIndex = index;
          }
        });
        
        if (closestPointIndex !== -1) {
          // Для Android немедленно вызываем обработчик точки
          if (Platform.OS === 'android') {
            // Используем более быстрый вызов для Android
            setTimeout(() => {
              if (onPointPress) {
                onPointPress(closestPointIndex);
              }
            }, 10);
          } else {
            // Для iOS оставляем прежнюю логику
            setTimeout(() => {
              if (onPointPress) {
                onPointPress(closestPointIndex);
              }
            }, 10);
          }
          return false; // Не перехватываем жест для точек
        }
      }
      return true; // Перехватываем остальные касания
    },
    
    // Определение движения
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Для мультитач всегда перехватываем
      if (evt.nativeEvent.touches.length >= 2) {
        return true;
      }
      
      // Для одиночного касания - только при значительном движении
      // Увеличиваем порог для Android для лучшего распознавания тапов
      const threshold = Platform.OS === 'android' ? 8 : 5;
      return Math.abs(gestureState.dx) > threshold || Math.abs(gestureState.dy) > threshold;
    },
    
    onPanResponderGrant: (evt) => {
      const touches = evt.nativeEvent.touches;
      
      if (touches.length === 1) {
        // Начало перетаскивания
        lastGestureState.current.x = touches[0].pageX;
        lastGestureState.current.y = touches[0].pageY;
      } else if (touches.length === 2) {
        // Начало масштабирования
        const dx = touches[1].pageX - touches[0].pageX;
        const dy = touches[1].pageY - touches[0].pageY;
        lastGestureState.current.distance = Math.sqrt(dx * dx + dy * dy);
        setIsPinching(true);
      }
    },
    
    onPanResponderMove: (evt, gestureState) => {
      const touches = evt.nativeEvent.touches;
      
      if (touches.length === 1 && !isPinching) {
        // Перетаскивание
        if (!isDragging) {
          setIsDragging(true);
        }
        
        const dx = touches[0].pageX - lastGestureState.current.x;
        const dy = touches[0].pageY - lastGestureState.current.y;
        
        setOffsetX(prev => prev + dx * 0.5); // Замедляем движение для лучшего контроля
        setOffsetY(prev => prev + dy * 0.5);
        
        lastGestureState.current.x = touches[0].pageX;
        lastGestureState.current.y = touches[0].pageY;
      } 
      else if (touches.length === 2) {
        // Масштабирование (pinch-to-zoom) - улучшенная обработка для Android
        const dx = touches[1].pageX - touches[0].pageX;
        const dy = touches[1].pageY - touches[0].pageY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Предотвращаем деление на ноль и обрабатываем некорректные значения
        if (lastGestureState.current.distance > 10 && distance > 10) { // Минимальное расстояние для надежности
          // Более плавное масштабирование для Android
          const scaleFactor = distance / lastGestureState.current.distance;
          
          // Дополнительное сглаживание для Android
          const smoothFactor = Platform.OS === 'android' ? 0.7 : 0.8;
          const newScale = scale * (smoothFactor * scaleFactor + (1 - smoothFactor));
          
          // Ограничиваем масштаб
          const limitedScale = Math.min(Math.max(newScale, 0.5), 5.0);
          
          // Обновляем только если изменение значительное (предотвращение дрожания)
          if (Math.abs(limitedScale - scale) > 0.01) {
            setScale(limitedScale);
          }
          
          lastGestureState.current.distance = distance;
        }
      }
    },
    
    onPanResponderRelease: (evt, gestureState) => {
      // Завершение жеста
      const wasDragging = isDragging;
      const wasPinching = isPinching;
      
      setIsDragging(false);
      setIsPinching(false);
      
      // Сохраняем состояние
      saveState();
      
      // Проверяем, был ли это тап (если не было перетаскивания или масштабирования)
      const touchThreshold = Platform.OS === 'android' ? 12 : 5; // Больший порог для Android
      if (!wasDragging && !wasPinching && Math.abs(gestureState.dx) < touchThreshold && Math.abs(gestureState.dy) < touchThreshold) {
        // Это был тап, ищем ближайшую точку
        const touch = evt.nativeEvent.changedTouches[0];
        
        let closestPointIndex = -1;
        let minDistance = Number.MAX_VALUE;
        const touchRadius = Platform.OS === 'android' ? 50 : 30; // Больший радиус для Android
        
        points.forEach((point, index) => {
          const screenPos = dataToScreen(point.x, point.y);
          const dx = screenPos.x - touch.pageX;
          const dy = screenPos.y - touch.pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < touchRadius && distance < minDistance) {
            minDistance = distance;
            closestPointIndex = index;
          }
        });
        
        if (closestPointIndex !== -1 && onPointPress) {
          // Более длительная задержка для Android
          const delay = Platform.OS === 'android' ? 150 : 50;
          setTimeout(() => {
            if (onPointPress) {
              onPointPress(closestPointIndex);
            }
          }, delay);
        }
      }
    }
  });
  
  // Обработчики кнопок управления с улучшенным поведением
  const handleZoomIn = () => {
    const newScale = Math.min(scale * 1.2, 5.0);
    setScale(newScale);
    // Сбрасываем смещение при увеличении масштаба для центрирования
    if (offsetX !== 0 || offsetY !== 0) {
      setOffsetX(offsetX * 0.8); // Постепенно возвращаем к центру
      setOffsetY(offsetY * 0.8);
    }
    saveState();
  };
  
  const handleZoomOut = () => {
    const newScale = Math.max(scale / 1.2, 0.5);
    setScale(newScale);
    // Сбрасываем смещение при уменьшении масштаба для центрирования
    if (offsetX !== 0 || offsetY !== 0) {
      setOffsetX(offsetX * 0.8); // Постепенно возвращаем к центру
      setOffsetY(offsetY * 0.8);
    }
    saveState();
  };
  
  const handleReset = () => {
    setScale(1.0);
    setOffsetX(0);
    setOffsetY(0);
    saveState();
  };
  
  // Рендеринг сетки
  const renderGrid = () => {
    const gridLines = [];
    const xRange = bounds.xMax - bounds.xMin;
    const yRange = bounds.yMax - bounds.yMin;
    
    // Улучшенный алгоритм выбора шага сетки
    const getStep = (range, scaleFactor = 1) => {
      // Учитываем масштаб при расчете шага
      const targetLines = 10 / Math.sqrt(scale); // Меньше линий при уменьшении масштаба
      const roughStep = range / targetLines;
      
      // Определяем порядок величины
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(roughStep, 1e-10))));
      const normalized = roughStep / magnitude;
      
      // Выбираем ближайшее "красивое" значение
      let step;
      if (normalized <= 1) step = magnitude;
      else if (normalized <= 2) step = 2 * magnitude;
      else if (normalized <= 5) step = 5 * magnitude;
      else step = 10 * magnitude;
      
      // Для очень малых масштабов (меньше 0.3) добавляем больше линий
      if (scale < 0.3) {
        step = step / 2;
      }
      
      return step * scaleFactor;
    };
    
    // Рассчитываем шаги с учетом масштаба
    const xStep = getStep(xRange, 1/scale+1);
    const yStep = getStep(yRange, 1/scale);
    
    // Горизонтальные линии
    for (let y = Math.floor(bounds.yMin / yStep) * yStep; y <= bounds.yMax; y += yStep) {
      const { x: x1, y: y1 } = dataToScreen(bounds.xMin, y);
      const { x: x2, y: y2 } = dataToScreen(bounds.xMax, y);
      
      // Проверяем, что линия в пределах экрана
      if (y1 >= padding && y1 <= chartHeight - padding) {
        gridLines.push(
          <Line
            key={`hgrid-${y}`}
            x1={padding}
            y1={y1}
            x2={chartWidth - padding}
            y2={y1}
            stroke={theme.colors.outline}
            strokeWidth={y === 0 ? 1.5 : 0.5}
            opacity={y === 0 ? 1 : 0.3}
          />
        );
        
        // Метка оси Y с адаптивным форматированием
        gridLines.push(
          <SvgText
            key={`ylabel-${y}`}
            x={padding - 5}
            y={y1}
            fontSize={11} // Увеличиваем размер шрифта
            fontWeight="500" // Делаем шрифт полужирным
            fill={theme.colors.onSurface} // Более контрастный цвет
            textAnchor="end"
            alignmentBaseline="middle"
          >
            {formatAxisValue(y)} {/* Используем умную функцию форматирования */}
          </SvgText>
        );
      }
    }
    
    // Вертикальные линии
    for (let x = Math.floor(bounds.xMin / xStep) * xStep; x <= bounds.xMax; x += xStep) {
      const { x: x1, y: y1 } = dataToScreen(x, bounds.yMin);
      const { x: x2, y: y2 } = dataToScreen(x, bounds.yMax);
      
      // Проверяем, что линия в пределах экрана
      if (x1 >= padding && x1 <= chartWidth - padding) {
        gridLines.push(
          <Line
            key={`vgrid-${x}`}
            x1={x1}
            y1={padding}
            x2={x1}
            y2={chartHeight - padding}
            stroke={theme.colors.outline}
            strokeWidth={x === 0 ? 1.5 : 0.5}
            opacity={x === 0 ? 1 : 0.3}
          />
        );
        
        // Метка оси X с адаптивным форматированием
        gridLines.push(
          <SvgText
            key={`xlabel-${x}`}
            x={x1}
            y={chartHeight - padding + 15}
            fontSize={11} // Увеличиваем размер шрифта
            fontWeight="500" // Делаем шрифт полужирным
            fill={theme.colors.onSurface} // Более контрастный цвет
            textAnchor="middle"
          >
            {formatAxisValue(x)} {/* Используем умную функцию форматирования */}
          </SvgText>
        );
      }
    }
    
    return gridLines;
  };
  
  // Улучшенный рендеринг точек с более надежной обработкой нажатий для Android
  const renderPoints = () => {
    return points.map((point, index) => {
      const { x, y } = dataToScreen(point.x, point.y);
      
      // Проверяем, что точка в пределах графика
      if (x < padding || x > chartWidth - padding || y < padding || y > chartHeight - padding) {
        return null;
      }
      
      // Определяем, выбрана ли точка
      const wellId = point.wellId || 'main';
      let isSelected = false;
      
      // Проверяем выбрана ли точка для этой конкретной скважины
      if (selectedPoints && typeof selectedPoints === 'object') {
        // Проверяем наличие выбранных точек для этой скважины
        const wellSelectedPoints = selectedPoints[wellId];
        if (Array.isArray(wellSelectedPoints)) {
          isSelected = wellSelectedPoints.includes(index);
        }
        
        // Если точка не выбрана для своей скважины, проверяем все остальные скважины
        if (!isSelected) {
          Object.entries(selectedPoints).forEach(([otherWellId, pointIndices]) => {
            if (Array.isArray(pointIndices) && pointIndices.includes(index)) {
              isSelected = true;
            }
          });
        }
      } else if (Array.isArray(selectedPoints)) {
        // Обратная совместимость со старым форматом
        isSelected = selectedPoints.includes(index);
      }
      
      // Цвет точки
      const color = colorByWellId[wellId] || WELL_COLORS[0];
      
      // Улучшенный обработчик нажатия - использует таймаут для Android
      const handlePointPress = () => {
        if (onPointPress) {
          // Увеличенная задержка для Android для лучшей совместимости
          const delay = Platform.OS === 'android' ? 150 : 50;
          setTimeout(() => {
            if (onPointPress) {
              onPointPress(index);
            }
          }, delay);
        }
      };
      
      // Увеличиваем радиус прозрачной области для лучшей обработки касаний на Android
      const touchRadius = Platform.OS === 'android' ? 50 : 30;
      
      return (
        <G key={`point-${index}`}>
          {/* Увеличенная прозрачная область для тапа */}
          <Circle
            cx={x}
            cy={y}
            r={touchRadius}
            fill="rgba(255, 0, 0, 0.0)" // Полностью прозрачный
            onPress={handlePointPress}
            stroke="none"
          />
          
          {/* Видимая точка - увеличенная для лучшего захвата на Android */}
          <Circle
            cx={x}
            cy={y}
            r={isSelected ? (Platform.OS === 'android' ? 10 : 8) : (Platform.OS === 'android' ? 8 : 6)}
            fill={color}
            stroke={isSelected ? theme.colors.primary : color}
            strokeWidth={isSelected ? 2 : 1}
            onPress={handlePointPress} // Дублируем обработчик для надежности
          />
          
          {/* Индикатор выбранной точки */}
          {isSelected && (
            <Circle
              cx={x}
              cy={y}
              r={Platform.OS === 'android' ? 14 : 12}
              fill="transparent"
              stroke={theme.colors.primary}
              strokeWidth={Platform.OS === 'android' ? 2 : 1}
              strokeDasharray="3,3"
            />
          )}
        </G>
      );
    });
  };
  
  // Дополнительные TouchableOpacity области для Android (более надежная обработка касаний)
  const renderAndroidTouchablePoints = () => {
    if (Platform.OS !== 'android') return null;
    
    return points.map((point, index) => {
      const { x, y } = dataToScreen(point.x, point.y);
      
      // Проверяем, что точка в пределах графика
      if (x < padding || x > chartWidth - padding || y < padding || y > chartHeight - padding) {
        return null;
      }
      
      const touchSize = 60; // Большая область касания для Android
      
      return (
        <TouchableOpacity
          key={`android-touch-${index}`}
          style={{
            position: 'absolute',
            left: x - touchSize / 2,
            top: y - touchSize / 2,
            width: touchSize,
            height: touchSize,
            backgroundColor: 'transparent',
            // Добавляем отладочную границу (можно убрать позже)
            // borderWidth: 1,
            // borderColor: 'red',
            // opacity: 0.3,
          }}
          onPress={() => {
            if (onPointPress) {
              onPointPress(index);
            }
          }}
          activeOpacity={1}
        />
      );
    });
  };
  
  // Улучшенное построение линий тренда
  const renderTrendLines = () => {
    return Object.entries(lineParams).map(([groupId, params]) => {
      // Проверяем, что у нас есть корректные параметры линии
      // и что выбрано две точки (линия не должна отображаться при выборе одной точки)
      if (!params || typeof params.k !== 'number' || typeof params.b !== 'number') {
        return null;
      }
      
      // Проверяем, что у нас выбрано две точки
      const selectedPointsList = selectedPoints[groupId];
      if (!selectedPointsList || !Array.isArray(selectedPointsList) || selectedPointsList.length < 2) {
        return null; // Не рисуем линию, если выбрано меньше двух точек
      }
      
      // Вычисляем точки для линии
      const { k, b } = params;
      const color = params.color || theme.colors.primary;
      
      // Определяем видимую область графика с учетом отступов
      const visibleBounds = {
        xMin: padding,
        xMax: chartWidth - padding,
        yMin: padding,
        yMax: chartHeight - padding
      };
      
      // Расширяем границы для линии тренда, чтобы она всегда была видна
      const extendedBounds = {
        xMin: bounds.xMin - xRange * 0.2,
        xMax: bounds.xMax + xRange * 0.2,
        yMin: bounds.yMin - yRange * 0.2,
        yMax: bounds.yMax + yRange * 0.2
      };
      
      // Находим точки пересечения с расширенными границами
      const points = [];
      
      // Пересечение с левой границей
      const leftY = k * extendedBounds.xMin + b;
      points.push({ x: extendedBounds.xMin, y: leftY });
      
      // Пересечение с правой границей
      const rightY = k * extendedBounds.xMax + b;
      points.push({ x: extendedBounds.xMax, y: rightY });
      
      // Пересечение с нижней границей
      if (k !== 0) {
        const bottomX = (extendedBounds.yMin - b) / k;
        points.push({ x: bottomX, y: extendedBounds.yMin });
        
        // Пересечение с верхней границей
        const topX = (extendedBounds.yMax - b) / k;
        points.push({ x: topX, y: extendedBounds.yMax });
      }
      
      // Сортируем точки по X для правильного порядка
      points.sort((a, b) => a.x - b.x);
      
      // Берем крайние точки для линии
      if (points.length >= 2) {
        // Преобразуем точки данных в координаты экрана
        let start = dataToScreen(points[0].x, points[0].y);
        let end = dataToScreen(points[points.length - 1].x, points[points.length - 1].y);
        
        // Ограничиваем линию видимой областью графика
        // Если линия выходит за пределы, обрезаем её до границ графика
        if (start.x < visibleBounds.xMin) {
          // Вычисляем y-координату на границе
          const ratio = (visibleBounds.xMin - start.x) / (end.x - start.x);
          const newY = start.y + ratio * (end.y - start.y);
          start = { x: visibleBounds.xMin, y: newY };
        }
        if (end.x > visibleBounds.xMax) {
          // Вычисляем y-координату на границе
          const ratio = (visibleBounds.xMax - start.x) / (end.x - start.x);
          const newY = start.y + ratio * (end.y - start.y);
          end = { x: visibleBounds.xMax, y: newY };
        }
        if (start.y < visibleBounds.yMin) {
          // Вычисляем x-координату на границе
          const ratio = (visibleBounds.yMin - start.y) / (end.y - start.y);
          const newX = start.x + ratio * (end.x - start.x);
          start = { x: newX, y: visibleBounds.yMin };
        }
        if (end.y > visibleBounds.yMax) {
          // Вычисляем x-координату на границе
          const ratio = (visibleBounds.yMax - start.y) / (end.y - start.y);
          const newX = start.x + ratio * (end.x - start.x);
          end = { x: newX, y: visibleBounds.yMax };
        }
        
        return (
          <Line
            key={`trend-${groupId}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={color}
            strokeWidth={3}
            strokeDasharray="5,5"
          />
        );
      }
      
      return null;
    });
  };
  
  return (
    <View style={styles.container}>
      {/* Панель управления с улучшенным UI */}
      <Surface style={[styles.controlPanel, { backgroundColor: theme.colors.background }]}>
        <View style={styles.controlRow}>
          <IconButton
            icon="plus"
            size={24} // Увеличиваем размер иконок для лучшего тапа
            onPress={handleZoomIn}
            iconColor={theme.colors.primary}
            style={styles.controlButton}
          />
          <IconButton
            icon="minus"
            size={24} // Увеличиваем размер иконок для лучшего тапа
            onPress={handleZoomOut}
            iconColor={theme.colors.primary}
            style={styles.controlButton}
          />
          <IconButton
            icon="refresh"
            size={24} // Увеличиваем размер иконок для лучшего тапа
            onPress={handleReset}
            iconColor={theme.colors.primary}
            style={styles.controlButton}
          />
          <Text style={[styles.scaleText, { color: theme.colors.onSurface }]}>
            {I18n.t('scale') || 'Масштаб'}: {scale.toFixed(1)}x
          </Text>
        </View>
      </Surface>
      
      {/* График */}
      <View
        ref={chartRef}
        style={[styles.chartContainer, { backgroundColor: theme.colors.surface }]}
        {...panResponder.panHandlers}
      >
        <Svg width={chartWidth} height={chartHeight}>
          {/* Фон */}
          <Rect
            x={padding}
            y={padding}
            width={chartWidth - 2 * padding}
            height={chartHeight - 2 * padding}
            fill={theme.colors.surface}
            stroke={theme.colors.outline}
            strokeWidth={1}
          />
          
          {/* Сетка и оси */}
          {renderGrid()}
          
          {/* Линии тренда */}
          {renderTrendLines()}
          
          {/* Точки данных */}
          {renderPoints()}
          
          {/* Подписи осей */}
          <SvgText
            x={chartWidth / 2}
            y={chartHeight - 10}
            fontSize={12}
            fill={theme.colors.primary}
            textAnchor="middle"
            fontWeight="bold"
          >
            {selectedFunction?.xLabel || 'x'}
          </SvgText>
          <SvgText
            x={10}
            y={chartHeight / 2}
            fontSize={12}
            fill={theme.colors.primary}
            textAnchor="middle"
            fontWeight="bold"
            transform={`rotate(-90, 10, ${chartHeight / 2})`}
          >
            {selectedFunction?.yLabel || 'y'}
          </SvgText>
        </Svg>
        
        {/* Дополнительные области касания для Android */}
        {renderAndroidTouchablePoints()}
        
        {/* Индикатор перетаскивания */}
        {isDragging && (
          <View style={[styles.indicator, { backgroundColor: theme.colors.primaryContainer }]}>
            <Text style={{ color: theme.colors.onPrimaryContainer }}>{I18n.t('dragging')}</Text>
          </View>
        )}
        
        {/* Индикатор масштабирования */}
        {isPinching && (
          <View style={[styles.indicator, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Text style={{ color: theme.colors.onSecondaryContainer }}>{I18n.t('zooming')}</Text>
          </View>
        )}
      </View>
      
      {/* Инструкция */}
      <Surface style={[styles.instructionPanel, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text style={[styles.instructionText, { color: theme.colors.onSurfaceVariant }]}>
          {I18n.t('dragToMove')} • {I18n.t('pinchToZoom')} • {I18n.t('tapToSelect')}
        </Text>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  controlPanel: {
    padding: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    elevation: 2, // Добавляем тень для Android
    shadowColor: '#000', // Тень для iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around', // Равномерно распределяем элементы
  },
  controlButton: {
    margin: 0,
    width: 48, // Фиксированная ширина для лучшего тапа
    height: 48, // Фиксированная высота для лучшего тапа
  },
  scaleText: {
    fontSize: 14, // Увеличиваем размер текста
    fontWeight: '500', // Делаем текст полужирным
    marginLeft: 8,
  },
  chartContainer: {
    borderRadius: 0,
    overflow: 'hidden',
    elevation: 1, // Добавляем легкую тень
  },
  indicator: {
    position: 'absolute',
    top: 5,
    right: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  instructionPanel: {
    padding: 10,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    elevation: 2, // Добавляем тень для Android
    shadowColor: '#000', // Тень для iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  instructionText: {
    fontSize: 14, // Увеличиваем размер текста
    fontWeight: '500', // Делаем текст полужирным
    textAlign: 'center',
  },
});
