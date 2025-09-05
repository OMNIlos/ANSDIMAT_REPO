# 📚 Полный мануал по проекту Ansdimat для начинающих в React Native

## 🎯 Что такое этот проект?

**Ansdimat** - это мобильное приложение для гидрогеологических расчетов, написанное на React Native. Оно помогает геологам и инженерам анализировать данные по откачке воды из скважин и строить графики для определения характеристик водоносных слоев.

---

## 🏗️ Архитектура проекта

### 📁 Структура папок

```
Ansdimat/
├── components/           # Переиспользуемые компоненты
├── screens/             # Экраны приложения
│   └── PumpingTestProcessing/  # Модуль обработки откачек
│       ├── components/         # Компоненты модуля
│       ├── utils/             # Вспомогательные функции
│       └── styles/            # Стили модуля
├── navigation/          # Навигация между экранами
├── assets/             # Изображения и иконки
├── utils/              # Общие утилиты
├── App.tsx             # Главный файл приложения
└── MANUAL.md           # Этот мануал
```

### 🔧 Основные технологии

- **React Native** - фреймворк для создания мобильных приложений
- **Expo** - платформа для разработки React Native приложений
- **React Navigation** - навигация между экранами
- **React Native Paper** - UI библиотека с Material Design
- **AsyncStorage** - локальное хранение данных

---

## 🧩 Основные концепции React Native

### 1. **Компоненты** 
Компоненты - это строительные блоки приложения. Как LEGO детали, из которых собирается интерфейс.

```javascript
// Простой компонент
const MyComponent = () => {
  return (
    <View>
      <Text>Привет, мир!</Text>
    </View>
  );
};
```

### 2. **JSX**
JSX - это способ писать HTML-подобный код внутри JavaScript.

```javascript
// Это JSX
<View style={styles.container}>
  <Text>Текст</Text>
</View>

// Это компилируется в JavaScript
React.createElement(View, {style: styles.container},
  React.createElement(Text, null, "Текст")
);
```

### 3. **Стили**
Стили в React Native похожи на CSS, но пишутся в JavaScript объектах.

```javascript
const styles = StyleSheet.create({
  container: {
    flex: 1,                    // Занимает всю доступную высоту
    backgroundColor: 'white',   // Белый фон
    padding: 20,               // Отступы 20 пикселей
  },
  text: {
    fontSize: 16,              // Размер шрифта
    color: 'black',            // Цвет текста
  }
});
```

### 4. **Состояние (State)**
Состояние - это данные, которые могут изменяться и влияют на отображение компонента.

```javascript
const [count, setCount] = useState(0);  // Создаем состояние

// count - текущее значение
// setCount - функция для изменения значения
```

---

## 📱 Главные экраны приложения

### 1. **HomeScreen** - Главный экран
```javascript
// Показывает список проектов и основные функции
const HomeScreen = () => {
  return (
    <View>
      <Text>Добро пожаловать в Ansdimat!</Text>
      <Button title="Создать проект" />
    </View>
  );
};
```

### 2. **NewWizard** - Мастер создания проекта
Это самый сложный экран с пошаговым созданием проекта.

---

## 🧙‍♂️ Детальный разбор NewWizard

### 📋 Что делает NewWizard?

NewWizard - это **мастер создания проекта** с 3 шагами:
1. **Основные параметры** - название, тип скважины, расход воды
2. **Настройка обработки** - выбор типов измерений, даты
3. **Обзор проекта** - проверка всех данных перед сохранением

### 🔄 Как работает пошаговый процесс

```javascript
const [currentStep, setCurrentStep] = useState(WIZARD_STEPS.BASIC_PARAMETERS);

// Переход к следующему шагу
const nextStep = () => {
  if (currentStep < WIZARD_STEPS.OBSERVATION_JOURNAL) {
    setCurrentStep(currentStep + 1);
  }
};

// Возврат к предыдущему шагу
const prevStep = () => {
  if (currentStep > WIZARD_STEPS.BASIC_PARAMETERS) {
    setCurrentStep(currentStep - 1);
  }
};
```

### 📊 Хранение данных

Все данные визарда хранятся в одном большом объекте:

```javascript
const [wizardData, setWizardData] = useState({
  // Основные параметры
  projectName: '',
  wellName: '',
  flowRate: '',
  flowRateUnit: 'м³/сут',
  
  // Измерения для каждой скважины
  measurements: {
    1: {  // ID скважины
      pumping: [    // Измерения откачки
        { time: '10', timeUnit: 'мин', drawdown: '0.5', date: new Date() }
      ],
      recovery: [   // Измерения восстановления
        { time: '5', timeUnit: 'мин', drawdown: '0.3', date: new Date() }
      ]
    }
  }
});
```

---

## 🎨 Модальные окна

### 🔧 Что такое модальные окна?

Модальные окна - это **всплывающие экраны**, которые появляются поверх основного контента для выполнения конкретной задачи.

### 📱 Типы модальных окон в проекте

#### 1. **Окно ввода даты и времени**
```javascript
const CustomDateTimeInput = ({ type, date, onDateChange }) => {
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  
  return (
    <Modal visible={showDateTimeModal} presentationStyle="fullScreen">
      <View>
        <TextInput 
          value={dateText}
          onChangeText={setDateText}
          placeholder="01.01.2024"
        />
        <TextInput 
          value={timeText}
          onChangeText={setTimeText}
          placeholder="12:00"
        />
        <Button title="Подтвердить" onPress={handleConfirm} />
      </View>
    </Modal>
  );
};
```

#### 2. **Окно выбора единиц измерения**
```javascript
const renderFlowRateUnitsModal = () => (
  <Modal visible={showFlowRateUnits} presentationStyle="fullScreen">
    <ScrollView>
      {FLOW_RATE_UNITS.map((unit) => (
        <TouchableOpacity 
          key={unit}
          onPress={() => {
            updateData('flowRateUnit', unit);
            setShowFlowRateUnits(false);
          }}
        >
          <Text>{unit}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </Modal>
);
```

#### 3. **Окно ввода измерений**
```javascript
const UnifiedMeasurementsModal = ({ visible, onClose, wizardData }) => {
  return (
    <Modal visible={visible} presentationStyle="fullScreen">
      <ScrollView>
        {/* Список всех скважин и их измерений */}
        {wizardData.observationWells.map(well => (
          <WellSection key={well.id} well={well} />
        ))}
      </ScrollView>
    </Modal>
  );
};
```

---

## 🎯 Проблемы и их решения

### ❌ **Проблема 1: Модальные окна не растягивались на весь экран на Android**

**Причина:** React Native по умолчанию не всегда корректно обрабатывает полноэкранные модальные окна на Android.

**Решение:**
```javascript
<Modal
  visible={visible}
  animationType="slide"
  presentationStyle="fullScreen"    // ✅ Принудительно полноэкранный режим
  transparent={false}
  statusBarTranslucent={Platform.OS === 'android'}  // ✅ Правильная обработка статусбара
>
  <View style={{
    ...Platform.select({
      android: {
        paddingTop: 0,      // ✅ Убираем отступы
        height: '100%',     // ✅ Полная высота
        width: '100%',      // ✅ Полная ширина
      }
    })
  }}>
    {Platform.OS === 'android' && <StatusBar backgroundColor={theme.colors.primary} />}
    {/* Контент модального окна */}
  </View>
</Modal>
```

### ❌ **Проблема 2: Пользователь терялся в навигации после закрытия модальных окон**

**Причина:** Модальные окна могли случайно вызывать навигацию назад.

**Решение:**
```javascript
// 1. Явно указываем что НЕ вызываем навигацию
onRequestClose={() => {
  setShowDateTimeModal(false);
  // НЕ вызываем navigation - остаемся в визарде ✅
}}

// 2. Блокируем навигацию когда открыты модальные окна
const handleBack = useCallback(() => {
  if (showDateTimeModal || showFlowRateUnits || showUnifiedMeasurements) {
    return; // ✅ Не обрабатываем навигацию
  }
  
  if (currentStep > WIZARD_STEPS.BASIC_PARAMETERS) {
    prevStep();
  } else {
    navigation.goBack();
  }
}, [currentStep, showDateTimeModal, showFlowRateUnits, showUnifiedMeasurements]);
```

---

## 🔧 Как работает код пошагово

### 1. **Инициализация компонента**
```javascript
export default function NewWizard({ navigation, route }) {
  // 1. Получаем тему и язык
  const theme = useTheme();
  const { locale } = useContext(LanguageContext);
  
  // 2. Создаем состояние для текущего шага
  const [currentStep, setCurrentStep] = useState(WIZARD_STEPS.BASIC_PARAMETERS);
  
  // 3. Создаем состояние для всех данных визарда
  const [wizardData, setWizardData] = useState({...});
}
```

### 2. **Обработка изменений данных**
```javascript
// Функция для обновления данных с автоматическим сохранением
const updateData = useCallback((key, value) => {
  setWizardData(prev => {
    const newData = { ...prev, [key]: value };
    debouncedSaveWizardData(newData); // Сохраняем в AsyncStorage
    return newData;
  });
}, [debouncedSaveWizardData]);
```

### 3. **Валидация данных**
```javascript
const validateStep = useCallback((step) => {
  const newErrors = {};
  
  switch (step) {
    case WIZARD_STEPS.BASIC_PARAMETERS:
      if (!wizardData.wellName.trim()) {
        newErrors.wellName = 'Введите название скважины';
      }
      if (!wizardData.flowRate.trim()) {
        newErrors.flowRate = 'Введите расход';
      }
      break;
  }
  
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
}, [wizardData]);
```

### 4. **Рендеринг разных шагов**
```javascript
const renderStepContent = () => {
  switch (currentStep) {
    case WIZARD_STEPS.BASIC_PARAMETERS:
      return renderBasicParameters();
    case WIZARD_STEPS.PROCESSING_SETUP:
      return renderProcessingSetup();
    case WIZARD_STEPS.OBSERVATION_JOURNAL:
      return renderObservationJournal();
    default:
      return renderBasicParameters();
  }
};
```

---

## 🎨 Стилизация и UI

### 🎨 **React Native Paper**
Используется для красивого Material Design интерфейса:

```javascript
import { Card, Button, TextInput, Surface } from 'react-native-paper';

// Карточка с тенью
<Card style={styles.parameterCard}>
  <Card.Content>
    <Text>Содержимое карточки</Text>
  </Card.Content>
</Card>

// Кнопка в стиле Material Design
<Button 
  mode="contained" 
  icon="water"
  onPress={handlePress}
>
  Измерения
</Button>
```

### 📱 **Адаптивные стили**
```javascript
const styles = StyleSheet.create({
  container: {
    flex: 1,  // Занимает всю доступную высоту
  },
  inputGroup: {
    marginBottom: 20,  // Отступ снизу
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  }
});
```

---

## 💾 Работа с данными

### 📱 **AsyncStorage - локальное хранение**
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Сохранение данных
const saveData = async (data) => {
  try {
    await AsyncStorage.setItem('wizard_temp_data', JSON.stringify(data));
  } catch (error) {
    console.error('Ошибка сохранения:', error);
  }
};

// Загрузка данных
const loadData = async () => {
  try {
    const savedData = await AsyncStorage.getItem('wizard_temp_data');
    if (savedData) {
      return JSON.parse(savedData);
    }
  } catch (error) {
    console.error('Ошибка загрузки:', error);
  }
};
```

### 🔄 **Debounce - оптимизация сохранения**
```javascript
// Сохраняем данные не при каждом изменении, а через 1 секунду после последнего изменения
const debouncedSaveWizardData = useCallback(
  debounce(async (data) => {
    await AsyncStorage.setItem('wizard_temp_data', JSON.stringify(data));
  }, 1000),
  []
);
```

---

## 🗺️ Навигация

### 🗺️ **React Navigation**
```javascript
// Переход к экрану
navigation.navigate('ScreenName', { param1: 'value1' });

// Возврат назад
navigation.goBack();

// Переход назад с параметрами
navigation.goBack();
```

### 🔄 **Передача данных между экранами**
```javascript
// Отправка данных
navigation.navigate('NewWizard', {
  projectId: '123',
  projectName: 'Мой проект',
  isEditing: true
});

// Получение данных
const projectId = route?.params?.projectId;
const projectName = route?.params?.projectName;
```

---

## 🐛 Отладка и решение проблем

### 🔍 **Console.log для отладки**
```javascript
console.log('Текущий шаг:', currentStep);
console.log('Данные визарда:', wizardData);
console.log('Ошибки валидации:', errors);
```

### ⚠️ **Обработка ошибок**
```javascript
try {
  const data = await AsyncStorage.getItem('data');
  // Работаем с данными
} catch (error) {
  console.error('Ошибка:', error);
  Alert.alert('Ошибка', 'Не удалось загрузить данные');
}
```

### 📱 **Проверка платформы**
```javascript
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  // Код только для Android
} else if (Platform.OS === 'ios') {
  // Код только для iOS
}
```

---

## 🚀 Как запустить проект

### 1. **Установка зависимостей**
```bash
npm install
# или
yarn install
```

### 2. **Запуск Metro (сервер разработки)**
```bash
npx expo start
```

### 3. **Запуск на устройстве**
```bash
# Android
npx expo run:android

# iOS
npx expo run:ios
```

### 4. **Альтернативные команды (для чистого React Native)**
```bash
# Запуск Metro
npx react-native start

# Запуск на Android
npx react-native run-android

# Запуск на iOS
npx react-native run-ios
```

---

## 📚 Полезные ресурсы для изучения

### 📖 **Официальная документация**
- [React Native Docs](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Paper](https://reactnativepaper.com/)
- [Expo Docs](https://docs.expo.dev/)

### 🎥 **Видеоуроки**
- "React Native для начинающих" на YouTube
- "Expo Tutorial" - официальные туториалы
- "React Native Paper Tutorial" - изучение UI библиотеки

### 🛠️ **Инструменты разработки**
- **Expo Go** - приложение для тестирования на телефоне
- **React Native Debugger** - отладчик
- **Flipper** - инструмент для отладки
- **Metro Bundler** - сервер разработки (аналог webpack)

---

## 🎯 Заключение

Этот проект демонстрирует:
- ✅ Сложную навигацию между экранами
- ✅ Работу с модальными окнами
- ✅ Валидацию пользовательского ввода
- ✅ Локальное хранение данных
- ✅ Адаптивный дизайн для разных платформ
- ✅ Обработку ошибок и edge cases

**Главное правило:** React Native - это JavaScript + специальные компоненты для мобильных устройств. Если вы знаете JavaScript и HTML/CSS, то React Native будет понятен! 🚀

---

## 📝 Быстрый старт для разработчика

1. **Клонируйте проект**
2. **Установите зависимости:** `npm install`
3. **Запустите Metro:** `npx expo start`
4. **Откройте на устройстве:** сканируйте QR-код в Expo Go
5. **Начните редактировать:** изменения появятся автоматически!

**Удачной разработки! 🎉**
