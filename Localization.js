// i18n.js
import { I18n } from "i18n-js";

const i18n = new I18n({
  ru: {
    // Навигация
    home: "Главная",
    about: "О нас",
    order: "Заказ",
    download: "Скачать программу",
    contact: "Связаться с нами",
    examples: "Примеры и видео",
    utilities: "Утилиты",
    util1: "Калькулятор",
    util2: "Обработка откачек",
    toggleLang: "Переключить язык",
    homeTitle: "АНСДИМАТ",
    // Главная страница
    search: "Поиск",
    searchButton: "Искать",

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
    projectManagement: "Управление проектами",
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

    // Wizard
    wizard: "Мастер ввода данных",
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
    pumpingTest: "Насосный тест",
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

    // Confirmation
    confirmation: "Подтверждение",
    journalCreated: "Журнал создан",
    journalSaved: "Журнал сохранен в проект",
    noActiveProject: "Нет активного проекта",
    selectProjectFirst: "Сначала выберите проект",

    // Data Processing
    dataProcessing: "Обработка данных",
    processingTitle: "Обработка журнала",
    project: "Проект",
    journal: "Журнал",
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
    noDataToExport: "Нет данных для экспорта",
    projectInfo: "Информация о проекте",
    created: "Создан",
    journalsCount: "Журналов",
    information: "Информация",
    infoText:
      "• Экспорт в JSON содержит все данные проекта\n• CSV формат подходит для Excel и других табличных редакторов\n• Функции экспорта графиков и PDF будут добавлены позже\n• Все данные сохраняются локально на устройстве",

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
  },
  en: {
    // Navigation
    home: "Home",
    about: "About",
    order: "Order",
    download: "Download",
    contact: "Contact Us",
    examples: "Examples & Videos",
    utilities: "Utilities",
    util1: "Calculator",
    util2: "Pumping Test Processing",
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
    projectManagement: "Project Management",
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

    // Wizard
    wizard: "Data Entry Wizard",
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

    // Data Table
    dataTable: "Data Table",
    time: "Time (min)",
    drawdown: "Drawdown (m)",
    addRow: "Add Row",
    deleteRow: "Delete Row",
    noData: "No Data",
    rows: "rows",

    // Confirmation
    confirmation: "Confirmation",
    journalCreated: "Journal created",
    journalSaved: "Journal saved to project",
    noActiveProject: "No active project",
    selectProjectFirst: "Select a project first",

    // Data Processing
    dataProcessing: "Data Processing",
    processingTitle: "Journal Processing",
    project: "Project",
    journal: "Journal",
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
    noDataToExport: "No data to export",
    projectInfo: "Project Information",
    created: "Created",
    journalsCount: "Journals",
    information: "Information",
    infoText:
      "• JSON export contains all project data\n• CSV format is suitable for Excel and other spreadsheet editors\n• Chart and PDF export functions will be added later\n• All data is stored locally on the device",

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
  },
});

i18n.defaultLocale = "ru";
i18n.locale = "ru";
i18n.enableFallback = true;

export default i18n;
