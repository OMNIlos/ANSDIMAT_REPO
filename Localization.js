// i18n.js
import { I18n } from "i18n-js";

const i18n = new I18n({
  ru: {
    // Защита авторских прав
    copyright: "© АНСДИМАТ. Все права защищены. 1993 – 2025",
    // Навигация
    home: "Главная",
    about: "О нас",
    order: "Заказ",
    subscription: "Подписка",
    download: "Скачать программу",
    contact: "Связаться с нами",
    examples: "Примеры и видео",
    utilities: "Утилиты",
    util1: "Калькулятор",
    util2: "Обработка откачек",
    toggleLang: "Переключить язык",
    homeTitle: "АНСДИМАТ",
    
    // Экран загрузки
    appSubtitle: "Анализ и обработка гидрогеологических данных",
    
    // Главная страница (рабочий стол)
    welcome: "Добро пожаловать",
    desktop: "Рабочий стол",
    search: "Поиск",
    searchButton: "Искать",
    
    // Описания карточек главного экрана
    calculatorDesc: "Гидрогеологические расчеты",
    pumpingTestDesc: "Анализ опытных откачек",
    examplesDesc: "Обучающие материалы",
    subscriptionDesc: "Управление подпиской",
    settingsDesc: "Настройки приложения",
    aboutDesc: "Информация о приложении",
    contactDesc: "Связь с разработчиками",
    appDescription: "Программный комплекс для анализа и обработки гидрогеологических данных",
    
    // Статус подписки
    subscriptionStatus: "Статус подписки",
    active: "Активна",
    inactive: "Неактивна",
    
    // Настройки
    settings: "Настройки",
    settingsDescription: "Настройка внешнего вида и поведения приложения",
    appearance: "Внешний вид",
    theme: "Тема",
    language: "Язык",
    appLanguage: "Язык приложения",
    version: "Версия",
    developer: "Разработчик",
    website: "Сайт",
    change: "Изменить",
    settingsInfo: "Изменения настроек применяются немедленно и сохраняются автоматически.",

    // О нас
    aboutTitle: "История АНСДИМАТ",
    aboutStory:
      "История АНСДИМАТ началась в середине 1990-х годов в Горном институте Санкт-Петербурга (Российский государственный технический университет). Изначально программное обеспечение было разработано для помощи нашей исследовательской группе гидрогеологов в планировании и интерпретации испытаний водоносных горизонтов.",
    aboutDevelopment:
      "В период с 1995 по 2005 год АНСДИМАТ изменил свой интерфейс с DOS на Windows и был расширен для включения инструмента аналитического моделирования (AMWELLS). Начиная с 2005 года, мы решили поделиться нашим инструментом с профессионалами за пределами нашего университета. Растущее число наших пользователей и их бесценная обратная связь поддержали дальнейшее развитие АНСДИМАТ и внедрение новых инструментов и модулей.",
    whatIsTitle: "Что такое АНСДИМАТ",
    whatIsDescription:
      "АНСДИМАТ - это набор программных инструментов, которые используют аналитические решения для решения проблем потока и транспорта подземных вод. Эти решения помогают гидрогеологам, которые работают с водоснабжением, водоотливом шахт, гражданским строительством или экологическими оценками.",
    applicationsTitle: "Типичные примеры применения АНСДИМАТ включают:",
    app1: "• Интерпретация насосных испытаний водоносных горизонтов, пакерных испытаний, slug-тестов;",
    app2: "• Проектирование и оптимизация скважинных полей для водоснабжения или водоотлива шахт;",
    app3: "• Прогнозирование притока подземных вод в открытые карьеры и подземные шахты;",
    app4: "• Прогнозирование понижения от вертикальных или горизонтальных скважин;",
    app5: "• Определение зон санитарной охраны скважин;",
    app6: "• Прогнозирование миграции загрязняющих веществ с использованием моделирования частиц или дисперсионного транспорта;",
    app7: "• Моделирование вторжения морской воды в водоносные горизонты.",
    modulesTitle: "Модули",
    modulesDescription: "АНСДИМАТ включает следующие восемь модулей:",
    module1:
      "• AnsTest – Интерпретация испытаний водоносных горизонтов, включая насосные, slug и пакерные испытания. Более 100 решений + графические методы.",
    module2:
      "• AmWells – Прогнозирование понижения или подъема от скважинных полей; контуры, карты, гидрографы.",
    module3:
      "• AnsPit – Приток подземных вод в открытые карьеры, оптимизация водоотлива.",
    module4: "• AsTrack – Отслеживание частиц, определение зон захвата.",
    module5: "• AnsRadial – Моделирование радиального потока к скважинам.",
    module6:
      "• AnsQuick – Рабочая среда с инструментами для планирования испытаний, эффективности скважин, единиц, кривых, калькуляторов.",
    module7:
      "• AnsAem – Аналитическое элементное моделирование + постобработка.",
    module8:
      "• A-Conc – 1D/2D транспорт с диффузией, дисперсией, сорбцией, распадом.",
    geographyTitle: "География наших клиентов",
    geographyDescription:
      "Сегодня АНСДИМАТ используется более чем 700 практикующими специалистами по подземным водам, которые работают в горнодобывающей промышленности, ядерной промышленности, водоснабжении, строительстве и окружающей среде.",

    // Заказ
    orderTitle: "Форма заказа ANSDIMAT",
    fullName: "ФИО",
    organization: "Организация",
    email: "E-mail",
    phone: "Телефон",
    address: "Адрес",
    licenseType: "Тип лицензии:",
    singleLicense: "Однопользовательская",
    multiLicense: "Многопользовательская",
    comment: "Комментарий",
    submit: "Отправить",
    orderSent: "Заказ отправлен",
    orderThanks: "Спасибо, {name}! Мы свяжемся с вами.",

    // Скачать
    downloadText: "Скачать АНСДИМАТ можно по ссылке ниже:",
    downloadButton: "Скачать",

    // Контакты
    contactsTitle: "Наши контакты",
    australiaTitle: "АНСДИМАТ Австралия",
    russiaTitle: "АНСДИМАТ Россия",
    websiteSupport: "Вебсайт и техническая поддержка:",
    goToWebsite: "Перейти на сайт АНСДИМАТ",

    // Примеры и видео
    examplesTitle: "Примеры и обучающие видео",
    usageExamples: "Примеры использования АНСДИМАТ:",
    pumpTestTitle: "Интерпретация насосных испытаний",
    pumpTestDescription:
      "Реальный кейс по работе с кривыми падения уровня, построение модели и анализ.",
    pitModelTitle: "Модель скважин на открытом карьере",
    pitModelDescription:
      "Использование AnsAEM для моделирования водоотлива и гидравлического влияния.",
    moreDetails: "Подробнее",
    tutorialVideos: "Обучающие видео:",
    watch: "Смотреть",
    video1Title:
      "Видеоурок. Расчет водопритоков в строительный котлован, оценка рисков суффозии бортов и прорыва воды через дно котлована.",
    video2Title:
      "Видеоурок. Расчет системы водопонижения строительного котлована иглофильтрами. Определение шага иглофильтров, глубины их погружения, водопритока и времени осушения котлована",
    video3Title:
      "Видеоурок. Создание гидрогеологической модели отработки карьера в модуле ANSAEM (Метод аналитических элементов).",
    video4Title:
      "Видеоурок. Оценка запасов подземных вод. Расчет максимального понижения. Расчет срезок от соседних водозаборов. Учет граничных условий, формирование автоматических отчетов и многое другое.",
    video5Title:
      "Видеоурок. Расчет подтопления грунтовыми водами в программе АНСДИМАТ.",
    video6Title:
      "Видеоурок. Подготовка координатно привязанного растра (подложки) в программу АНСДИМАТ.",
    video7Title:
      "Видеоурок. Расчет зон санитарной охраны (ЗСО) в программе АНСДИМАТ.",

    // Pumping Test Processing
    pumpingTestProcessingTitle: "Обработка откачек",
    pumpingTestProcessingDescription:
      "Обработка откачек - это инструмент для обработки данных откачек.",

    // Project Management
    projectManagement: "Управление",
    createProject: "Создать проект",
    projectName: "Название проекта",
    projectNamePlaceholder: "Введите название проекта",
    noProjects: "Нет проектов",
    activeProject: "Активный проект",
    selectProject: "Выберите проект",
    deleteProject: "Удалить проект",
    deleteProjectConfirm: "Удалить проект '{name}'?",
    projectDeleted: "Проект удален",
    projectCreated: "Проект создан",
    exportProject: "Экспорт проекта",
    importProject: "Импорт проекта",
    favoriteProject: "В избранное",
    unfavoriteProject: "Убрать из избранного",
    addToFavorites: "Добавить в избранное",
    removeFromFavorites: "Удалить из избранного",

    // Wizard
    wizard: "Ввод",
    wizardTitle: "Мастер создания журнала откачки",
    step1: "Шаг 1: Тип теста",
    step2: "Шаг 2: Тип слоя",
    step3: "Шаг 3: Граничные условия",
    step4: "Шаг 4: Таблица данных",
    step5: "Шаг 5: Подтверждение",
    next: "Далее",
    back: "Назад",
    finish: "Завершить",
    cancel: "Отмена",

    // Test Types
    testType: "Тип теста",
    pumpingTest: "Обработка откачек",
    slugTest: "Slug тест",
    packerTest: "Пакерный тест",

    // Layer Types
    layerType: "Тип слоя",
    confined: "Напорный",
    unconfined: "Безнапорный",
    leaky: "Полунапорный",

    // Boundary Conditions
    boundaryConditions: "Граничные условия",
    infinite: "Бесконечный пласт",
    constantHead: "Постоянный напор",
    noFlow: "Нет потока",

    // Data Table
    dataTable: "Таблица данных",
    time: "Время (мин)",
    drawdown: "Понижение (м)",
    addRow: "Добавить строку",
    deleteRow: "Удалить строку",
    noData: "Нет данных",
    rows: "строк",
    selectDateTime: "Выбрать дату/время",
    dataType: "Тип данных",
    data: "Данные",
    dataRows: "Количество строк",

    // Confirmation
    confirmation: "Подтверждение",
    journalCreated: "Журнал создан",
    journalSaved: "Журнал сохранен в проект",
    noActiveProject: "Нет активного проекта",
    selectProjectFirst: "Сначала выберите проект",

    // Data Processing
    dataProcessing: "Обработка",
    processingTitle: "Обработка журнала",
    project: "Проект",
    journal: "Журнал",
    journalManagement: "Журналы",
    journalDetails: "Детали журнала",
    editJournal: "Редактировать журнал",
    importJournal: "Импорт журнала",
    dataPreview: "Предварительный просмотр данных",
    journalUpdated: "Журнал обновлен",
    selectTwoPoints:
      "Нажмите на две точки для графоаналитического расчёта (наклон и пересечение)",
    results: "Результаты графоаналитического метода",
    slope: "Наклон (k)",
    intercept: "Пересечение (b)",
    formula: "Формула: s = k·log₁₀(t) + b",
    deleteJournal: "Удалить журнал",
    deleteJournalConfirm: "Удалить журнал '{name}'?",
    journalDeleted: "Журнал удален",
    noJournals: "Нет сохранённых журналов в проекте",
    function: "Функция",
    units: "Единицы измерения",
    time: "Время",
    distance: "Расстояние",
    scale: "Масштаб",
    dragLine: "или перетащите прямую",
    slopeUp: "Наклон +",
    slopeDown: "Наклон -",
    shiftUp: "Сдвиг +",
    shiftDown: "Сдвиг -",
    attentionNote:
      "Внимание! Построить прямую по двум выбраным точкам можно только после того, как сдвиг и наклон будут не равны 0 (k и b не равны 0).",

    // Export
    export: "Экспорт",
    exportData: "Экспорт данных",
    exportProjectJson: "Экспорт проекта (JSON)",
    exportProjectJsonDesc: "Полный экспорт проекта со всеми данными",
    exportJournalsCsv: "Экспорт журналов (CSV)",
    exportJournalsCsvDesc: "Экспорт всех журналов в табличном формате",
    exportChartPng: "Экспорт графика (PNG)",
    exportChartPngDesc: "Сохранение графика как изображение",
    exportAnalysisPdf: "Отчёт анализа (PDF)",
    exportAnalysisPdfDesc: "Генерация отчёта с результатами анализа",
    exportSuccess: "Экспорт выполнен",
    exportError: "Ошибка экспорта",
    projectNotFound: "Проект не найден",
    invalidJsonFile: "Файл не является валидным JSON",
    notAnsdimatProject: "Файл не является проектом ANSDIMAT",
    projectIdExists: "Проект с таким ID уже существует",
    projectImported: "Проект успешно импортирован!",
    importError: "Ошибка при импорте файла",
    noDataToExport: "Нет данных для экспорта",
    projectInfo: "Информация о проекте",
    created: "Создан",
    journalsCount: "Журналов",
    information: "Информация",
    infoText:
      "• Экспорт в JSON содержит все данные проекта\n• CSV формат подходит для Excel и других табличных редакторов\n• Функции экспорта графиков и PDF будут добавлены позже\n• Все данные сохраняются локально на устройстве",

    // Подписка
    subscriptionTitle: "Подписка ANSDIMAT",
    subscriptionDescription: "Получите доступ ко всем функциям приложения",
    currentPlan: "Текущий план",
    freePlan: "Бесплатный план",
    premiumPlan: "Премиум план",
    monthlySubscription: "Месячная подписка",
    yearlySubscription: "Годовая подписка",
    subscribe: "Подписаться",
    restore: "Восстановить покупки",
    subscriptionFeatures: "Возможности подписки",
    unlimitedProjects: "Неограниченное количество проектов",
    advancedAnalytics: "Расширенная аналитика",
    advancedFunctionality: "Расширенные функционал",
    exportAllFormats: "Экспорт во всех форматах",
    subscriptionActive: "Подписка активна",
    subscriptionExpires: "Подписка истекает",
    subscriptionInactive: "Подписка неактивна",
    upgradeToPremium: "Перейти на премиум",
    cancelSubscription: "Отменить подписку",
    subscriptionCancelled: "Подписка отменена",
    subscriptionRestored: "Покупки восстановлены",
    purchaseSuccessful: "Покупка успешна",
    purchaseFailed: "Ошибка покупки",
    price: "Цена",
    perMonth: "в месяц",
    perYear: "в год",
    saveWithYearly: "Сэкономьте с годовой подпиской",
    trialPeriod: "Пробный период",
    daysFree: "дней бесплатно",
    premiumFeature: "Премиум функция",
    premiumFeatureCSV:
      "Экспорт в CSV доступен только для пользователей с подпиской",
    premiumFeaturePDF:
      "Экспорт в PDF доступен только для пользователей с подпиской",
    premiumFeatureInfiltration:
      "Инфильтрационные утечки доступны только для премиум пользователей",
    premiumFeaturePitInflow:
      "Приток в котлован доступен только для премиум пользователей",
    goToPremium: "Перейти на премиум",
    premiumOnly: "Только для премиум пользователей",
    subscription: "Подписка",
    subscriptionNavigation: "Функция перехода к подписке будет добавлена позже",

    // Контакты
    anastasiaBoronina: "Анастасия Боронина",
    nevaGroundwaterConsulting: "Нева Грунтовые Воды Консалтинг",
    phoneNumber: "Номер телефона",
    antonNikulenkov: "Антон Никулинов",
    instituteOfGeoecology: "Институт геоэкологии, Академия Наук",
    address: "Адрес",
    russiaAddress: "199004, Россия, Санкт-Петербург, средний проспект V.O., 41",
    email: "Email",

    // Ошибки и сообщения
    linkOpenError: "Ошибка при открытии ссылки",
    mailClientError: "Не удалось открыть почтовый клиент",
    mailSendError: "Не удалось отправить письмо",
    invalidJsonFile: "Файл не является валидным JSON",
    notAnsdimatJournal: "Файл не является журналом ANSDIMAT",
    journalImportedSuccess: "Журнал успешно импортирован!",
    importFileError: "Ошибка при импорте файла",
    noData: "Нет данных",
    createJournalInWizard: 'Создайте журнал в разделе "Ввод"',
    noGalleryAccess: "Нет доступа к галерее",
    chartSavedSuccess: "График сохранён в галерею!",
    chartSaveError: "Не удалось сохранить график",

    // Лимиты проектов
    projectLimit: "Лимит проектов",
    projectLimitMessage:
      "Бесплатные пользователи могут создать максимум 3 проекта. Перейдите на премиум для неограниченного количества проектов.",

    // Единицы измерения для графиков
    minutes: "мин",
    meters: "м",
    minutesSqrt: "мин¹/²",
    logMinutes: "lg(мин)",
    logMeters: "lg(м)",
    perMeter: "1/м",
    minutesPowerN: "мин^n",
    logMinutesPerMeterSquared: "lg(мин/м^2)",
    metersSqrt: "м¹/²",
    metersPowerN: "м^n",
    seconds: "сек",
    hours: "час",
    centimeters: "см",
    millimeters: "мм",

    // DataProcessing
    createJournalInWizard: 'Создайте журнал в разделе "Ввод"',
    functionNotFound: "Ошибка: выбранная функция не найдена.",
    noValidDataForChart: "Нет валидных данных для построения графика",
    noGalleryAccess: "Нет доступа к галерее",
    chartSavedSuccess: "График сохранён в галерею!",
    chartSaveError: "Не удалось сохранить график",
    saveChartToGallery: "Сохранить график (PNG)",

    // Единицы измерения для функций
    unitMinutes: "мин",
    unitMeters: "м",
    unitMinutesSqrt: "мин¹/²",
    unitLogMinutes: "lg(мин)",
    unitLogMeters: "lg(м)",
    unitPerMeter: "1/м",
    unitMinutesPowerN: "мин^n",
    unitLogMinutesPerMeterSquared: "lg(мин/м^2)",
    unitMetersSqrt: "м¹/²",
    unitMetersPowerN: "м^n",
    unitDimensionless: "-",

    // Common
    save: "Сохранить",
    edit: "Редактировать",
    delete: "Удалить",
    create: "Создать",
    loading: "Загрузка...",
    error: "Ошибка",
    success: "Успех",
    warning: "Предупреждение",
    info: "Информация",
    ok: "OK",
    yes: "Да",
    no: "Нет",
    filtrationCoeff: "Коэф. фильтрации",
    mDay: "м/сут",
    mHour: "м/час",
    mMin: "м/мин",
    mSec: "м/сек",
    cmDay: "см/сут",
    cmHour: "см/час",
    cmMin: "см/мин",
    cmSec: "см/сек",
    mmDay: "мм/сут",
    mmHour: "мм/час",
    mmMin: "мм/мин",
    mmSec: "мм/сек",
    ftDay: "фут/сут",
    ftHour: "фут/час",
    ftMin: "фут/мин",
    ftSec: "фут/сек",
    meynser: "мейнцер (галлон/сут/кв.фут)",
    banner: "Рекламный баннер сайта",
    exportToJSON: "Экспорт в JSON",
    exportToPNG: "Экспорт в PNG",
    parameterEstimationTab: "Оценка параметров",
    drawdownForecastTab: "Прогноз понижений",
    pitInflowTab: "Приток в котлован",
    barrageTab: "Барраж",
    infiltrationLeakageTab: "Инфильтрационные утечки",
  },
  en: {
    // Защита авторских прав
    copyright: "© ANSDIMAT. All rights reserved. 1993 – 2025",
    // Navigation
    home: "Home",
    about: "About",
    order: "Order",
    subscription: "Subscription",
    download: "Download",
    contact: "Contact Us",
    examples: "Examples & Videos",
    utilities: "Utilities",
    util1: "Calculator",
    util2: "Pumping Test Processing",
    util3: "Calculator",
    toggleLang: "Switch Language",
    homeTitle: "ANSDIMAT",
    // Home page
    search: "Search",
    searchButton: "Search",

    // About
    aboutTitle: "The story of ANSDIMAT",
    aboutStory:
      "The story of ANSDIMAT started in the middle of 1990s at the Mining Institute of St-Petersburg (Russian State Technical University). Initially the software was developed to assist our research team of hydrogeologists with planning and interpretation of aquifer tests.",
    aboutDevelopment:
      "Between 1995 and 2005 ANSDIMAT changed its interface from DOS to Windows and was extended to include and analytical modelling tool (AMWELLS). Starting from 2005, we decided to share our tool with professionals outside of our University. The growing number of our users and their invaluable feedback supported further ANSDIMAT development and implementation of new tools and modules.",
    whatIsTitle: "What is ANSDIMAT",
    whatIsDescription:
      "ANSDIMAT is a suite of software tools that uses analytical solutions to solve groundwater flow and transport problems. These solutions provide assistance to hydrogeologists who are dealing with water supply, mine dewatering, civil construction or environmental assessments.",
    applicationsTitle: "Typical examples of ANSDIMAT applications include:",
    app1: "• Interpretation of aquifer pumping tests, packer tests, slug tests;",
    app2: "• Design and optimisation of wellfields for water supply or mine dewatering;",
    app3: "• Prediction of groundwater inflows to open pits and underground mines;",
    app4: "• Prediction of drawdown from vertical or horizontal wells;",
    app5: "• Delineation of Well Head Protection Areas;",
    app6: "• Prediction of contaminant migration using particle tracking or dispersive transport modelling;",
    app7: "• Modelling of sea water intrusion in aquifers.",
    modulesTitle: "Modules",
    modulesDescription: "ANSDIMAT comprises the following eight modules:",
    module1:
      "• AnsTest – Interpretation of aquifer tests including pumping, slug and packer tests. Over 100 solutions + graphical methods.",
    module2:
      "• AmWells – Prediction of drawdown or rise from borefields; contours, maps, hydrographs.",
    module3:
      "• AnsPit – Groundwater inflows to open pits, dewatering optimisation.",
    module4: "• AsTrack – Particle tracking, capture zones delineation.",
    module5: "• AnsRadial – Radial flow modeling towards wells.",
    module6:
      "• AnsQuick – Workbench with tools for test planning, bore efficiency, units, curves, calculators.",
    module7: "• AnsAem – Analytical element modeling + post-processing.",
    module8:
      "• A-Conc – 1D/2D transport with diffusion, dispersion, sorption, decay.",
    geographyTitle: "Geography of our clients",
    geographyDescription:
      "Today ANSDIMAT is used by more than 700 groundwater practitioners who work in the mining industry, nuclear industry, water supply, construction and environment.",

    // Order
    orderTitle: "ANSDIMAT Order Form",
    fullName: "Full Name",
    organization: "Organization",
    email: "E-mail",
    phone: "Phone",
    address: "Address",
    licenseType: "License Type:",
    singleLicense: "Single User",
    multiLicense: "Multi User",
    comment: "Comment",
    submit: "Submit",
    orderSent: "Order Sent",
    orderThanks: "Thank you, {name}! We will contact you.",

    // Download
    downloadText: "Download ANSDIMAT using the link below:",
    downloadButton: "Download",

    // Contact
    contactsTitle: "Our Contacts",
    australiaTitle: "ANSDIMAT Australia",
    russiaTitle: "ANSDIMAT Russia",
    websiteSupport: "Website and Technical Support:",
    goToWebsite: "Go to ANSDIMAT Website",

    // Examples and Videos
    examplesTitle: "Examples and Tutorial Videos",
    usageExamples: "ANSDIMAT Usage Examples:",
    pumpTestTitle: "Pump Test Interpretation",
    pumpTestDescription:
      "Real case study on working with drawdown curves, model building and analysis.",
    pitModelTitle: "Open Pit Well Model",
    pitModelDescription:
      "Using AnsAEM for dewatering modeling and hydraulic impact assessment.",
    moreDetails: "More Details",
    tutorialVideos: "Tutorial Videos:",
    watch: "Watch",
    video1Title:
      "Tutorial. Calculation of water inflows to construction pit, assessment of suffusion risks of slopes and water breakthrough through pit bottom.",
    video2Title:
      "Tutorial. Calculation of construction pit dewatering system with wellpoints. Determination of wellpoint spacing, depth of immersion, water inflow and pit dewatering time.",
    video3Title:
      "Tutorial. Creating a hydrogeological model of pit development in ANSAEM module (Analytical Element Method).",
    video4Title:
      "Tutorial. Assessment of groundwater reserves. Calculation of maximum drawdown. Calculation of interference from neighboring water intakes. Consideration of boundary conditions, automatic report generation and much more.",
    video5Title:
      "Tutorial. Calculation of groundwater flooding in ANSDIMAT program.",
    video6Title:
      "Tutorial. Preparation of coordinate-referenced raster (background) in ANSDIMAT program.",
    video7Title:
      "Tutorial. Calculation of sanitary protection zones (SPZ) in ANSDIMAT program.",

    // Pumping Test Processing
    pumpingTestProcessingTitle: "Pumping Test Processing",
    pumpingTestProcessingDescription:
      "Pumping Test Processing is a tool for processing pumping test data.",

    // Project Management
    projectManagement: "Management",
    createProject: "Create Project",
    projectName: "Project Name",
    projectNamePlaceholder: "Enter project name",
    noProjects: "No projects",
    activeProject: "Active Project",
    selectProject: "Select Project",
    deleteProject: "Delete Project",
    deleteProjectConfirm: "Delete project '{name}'?",
    projectDeleted: "Project deleted",
    projectCreated: "Project created",
    exportProject: "Export Project",
    importProject: "Import Project",
    favoriteProject: "Add to Favorites",
    unfavoriteProject: "Remove from Favorites",
    addToFavorites: "Add to Favorites",
    removeFromFavorites: "Remove from Favorites",

    // Wizard
    wizard: "Data Entry",
    wizardTitle: "Pumping Test Journal Creation Wizard",
    step1: "Step 1: Test Type",
    step2: "Step 2: Layer Type",
    step3: "Step 3: Boundary Conditions",
    step4: "Step 4: Data Table",
    step5: "Step 5: Confirmation",
    next: "Next",
    back: "Back",
    finish: "Finish",
    cancel: "Cancel",

    // Test Types
    testType: "Test Type",
    pumpingTest: "Pumping Test",
    slugTest: "Slug Test",
    packerTest: "Packer Test",

    // Layer Types
    layerType: "Layer Type",
    confined: "Confined",
    unconfined: "Unconfined",
    leaky: "Leaky",

    // Boundary Conditions
    boundaryConditions: "Boundary Conditions",
    infinite: "Infinite Aquifer",
    constantHead: "Constant Head",
    noFlow: "No Flow",
    dataType: "Data Type",

    // Data Table
    dataTable: "Data Table",
    time: "Time (min)",
    drawdown: "Drawdown (m)",
    addRow: "Add Row",
    deleteRow: "Delete Row",
    noData: "No Data",
    rows: "rows",
    selectDateTime: "Select date/time",
    dataType: "Data Type",
    data: "Data",
    dataRows: "Data Rows",

    // Confirmation
    confirmation: "Confirmation",
    journalCreated: "Journal created",
    journalSaved: "Journal saved to project",
    noActiveProject: "No active project",
    selectProjectFirst: "Select a project first",

    // Data Processing
    dataProcessing: "Processing",
    processingTitle: "Journal Processing",
    project: "Project",
    journal: "Journal",
    journalManagement: "Journals",
    journalDetails: "Journal Details",
    editJournal: "Edit Journal",
    importJournal: "Import Journal",
    dataPreview: "Data Preview",
    journalUpdated: "Journal updated",
    selectTwoPoints:
      "Click on two points for graphical analysis (slope and intercept)",
    results: "Graphical Analysis Results",
    slope: "Slope (k)",
    intercept: "Intercept (b)",
    formula: "Formula: s = k·log₁₀(t) + b",
    deleteJournal: "Delete Journal",
    deleteJournalConfirm: "Delete journal '{name}'?",
    journalDeleted: "Journal deleted",
    noJournals: "No saved journals in project",
    function: "Function",
    units: "Units",
    time: "Time",
    distance: "Distance",
    scale: "Scale",
    dragLine: "or drag the line",
    slopeUp: "Slope +",
    slopeDown: "Slope -",
    shiftUp: "Shift +",
    shiftDown: "Shift -",
    attentionNote:
      "Attention! You can only build a line by two selected points after the shift and slope are not equal to 0 (k and b not equal to 0)",

    // Export
    export: "Export",
    exportData: "Export Data",
    exportProjectJson: "Export Project (JSON)",
    exportProjectJsonDesc: "Complete project export with all data",
    exportJournalsCsv: "Export Journals (CSV)",
    exportJournalsCsvDesc: "Export all journals in table format",
    exportChartPng: "Export Chart (PNG)",
    exportChartPngDesc: "Save chart as image",
    exportAnalysisPdf: "Analysis Report (PDF)",
    exportAnalysisPdfDesc: "Generate report with analysis results",
    exportSuccess: "Export completed",
    exportError: "Export error",
    projectNotFound: "Project not found",
    invalidJsonFile: "File is not a valid JSON",
    notAnsdimatProject: "File is not an ANSDIMAT project",
    projectIdExists: "Project with this ID already exists",
    projectImported: "Project imported successfully!",
    importError: "Error importing file",
    noDataToExport: "No data to export",
    projectInfo: "Project Information",
    created: "Created",
    journalsCount: "Journals",
    information: "Information",
    infoText:
      "• JSON export contains all project data\n• CSV format is suitable for Excel and other spreadsheet editors\n• Chart and PDF export functions will be added later\n• All data is stored locally on the device",

    // Subscription
    subscriptionTitle: "ANSDIMAT Subscription",
    subscriptionDescription: "Get access to all app features",
    currentPlan: "Current Plan",
    freePlan: "Free Plan",
    premiumPlan: "Premium Plan",
    monthlySubscription: "Monthly Subscription",
    yearlySubscription: "Yearly Subscription",
    subscribe: "Subscribe",
    restore: "Restore Purchases",
    subscriptionFeatures: "Subscription Features",
    unlimitedProjects: "Unlimited projects",
    advancedAnalytics: "Advanced analytics",
    advancedFunctionality: "Advanced functionality",
    exportAllFormats: "Export in all formats",
    subscriptionActive: "Subscription active",
    subscriptionExpires: "Subscription expires",
    subscriptionInactive: "Subscription inactive",
    upgradeToPremium: "Upgrade to Premium",
    cancelSubscription: "Cancel Subscription",
    subscriptionCancelled: "Subscription cancelled",
    subscriptionRestored: "Purchases restored",
    purchaseSuccessful: "Purchase successful",
    purchaseFailed: "Purchase failed",
    price: "Price",
    perMonth: "per month",
    perYear: "per year",
    saveWithYearly: "Save with yearly subscription",
    trialPeriod: "Trial period",
    daysFree: "days free",
    premiumFeature: "Premium Feature",
    premiumFeatureCSV: "CSV export is available only for subscription users",
    premiumFeaturePDF: "PDF export is available only for subscription users",
    premiumFeatureInfiltration:
      "Infiltration leakage is available only for premium users",
    premiumFeaturePitInflow: "Pit inflow is available only for premium users",
    goToPremium: "Go to Premium",
    premiumOnly: "Premium users only",
    subscription: "Subscription",
    subscriptionNavigation: "Subscription navigation will be added later",

    // Contacts
    anastasiaBoronina: "Anastasia Boronina",
    nevaGroundwaterConsulting: "Neva Groundwater Consulting",
    phoneNumber: "Phone number",
    antonNikulenkov: "Anton Nikulenkov",
    instituteOfGeoecology: "Institute of Geoecology, Academy of Sciences",
    address: "Address",
    russiaAddress: "199004, Russia, St. Petersburg, Sredny prospect V.O., 41",
    email: "Email",

    // Errors and messages
    linkOpenError: "Error opening link",
    mailClientError: "Could not open mail client",
    mailSendError: "Could not send email",
    invalidJsonFile: "File is not a valid JSON",
    notAnsdimatJournal: "File is not an ANSDIMAT journal",
    journalImportedSuccess: "Journal imported successfully!",
    importFileError: "Error importing file",
    noData: "No data",
    createJournalInWizard: 'Create a journal in the "Data Entry" section',
    noGalleryAccess: "No access to gallery",
    chartSavedSuccess: "Chart saved to gallery!",
    chartSaveError: "Could not save chart",

    // Project limits
    projectLimit: "Project limit",
    projectLimitMessage:
      "Free users can create a maximum of 3 projects. Upgrade to premium for unlimited projects.",

    // Units for charts
    minutes: "min",
    meters: "m",
    minutesSqrt: "min¹/²",
    logMinutes: "lg(min)",
    logMeters: "lg(m)",
    perMeter: "1/m",
    minutesPowerN: "min^n",
    logMinutesPerMeterSquared: "lg(min/m^2)",
    metersSqrt: "m¹/²",
    metersPowerN: "m^n",
    seconds: "sec",
    hours: "hour",
    centimeters: "cm",
    millimeters: "mm",

    // DataProcessing
    createJournalInWizard: 'Create a journal in the "Data Entry" section',
    functionNotFound: "Error: selected function not found.",
    noValidDataForChart: "No valid data for chart construction",
    noGalleryAccess: "No access to gallery",
    chartSavedSuccess: "Chart saved to gallery!",
    chartSaveError: "Could not save chart",
    saveChartToGallery: "Save chart (PNG)",

    // Units for functions
    unitMinutes: "min",
    unitMeters: "m",
    unitMinutesSqrt: "min¹/²",
    unitLogMinutes: "lg(min)",
    unitLogMeters: "lg(m)",
    unitPerMeter: "1/m",
    unitMinutesPowerN: "min^n",
    unitLogMinutesPerMeterSquared: "lg(min/m^2)",
    unitMetersSqrt: "m¹/²",
    unitMetersPowerN: "m^n",
    unitDimensionless: "-",

    // Common
    save: "Save",
    edit: "Edit",
    delete: "Delete",
    create: "Create",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    warning: "Warning",
    info: "Information",
    ok: "OK",
    yes: "Yes",
    no: "No",
    filtrationCoeff: "Filtration coefficient",
    mDay: "m/day",
    mHour: "m/hour",
    mMin: "m/min",
    mSec: "m/sec",
    cmDay: "cm/day",
    cmHour: "cm/hour",
    cmMin: "cm/min",
    cmSec: "cm/sec",
    mmDay: "mm/day",
    mmHour: "mm/hour",
    mmMin: "mm/min",
    mmSec: "mm/sec",
    ftDay: "ft/day",
    ftHour: "ft/hour",
    ftMin: "ft/min",
    ftSec: "ft/sec",
    meynser: "Meinzer (gallon/day/sq.ft)",
    banner: "Adds banner of the website",
    exportToJSON: "Export to JSON",
    exportToPNG: "Export to PNG",
    parameterEstimationTab: "Parameter Estimation",
    drawdownForecastTab: "Drawdown Forecast",
    pitInflowTab: "Pit Inflow",
    barrageTab: "Barrage",
    infiltrationLeakageTab: "Infiltration Leakage",
  },
});

i18n.defaultLocale = "ru";
i18n.locale = "ru";
i18n.enableFallback = true;

export default i18n;
