/**
 * Система интернационализации (i18n) приложения АНСДИМАТ
 *
 * Этот файл содержит все текстовые строки приложения на русском и английском языках.
 * Использует библиотеку i18n-js для управления переводами.
 *
 * Структура переводов:
 * - Основная навигация и общие элементы
 * - Экран загрузки и приветствие
 * - Модуль обработки откачек
 * - Главная страница и описания функций
 * - Настройки и конфигурация
 * - Информационные разделы (О нас, Контакты)
 * - Сообщения об ошибках и уведомления
 * - Технические термины и единицы измерения
 *
 * Использование в коде:
 * import I18n from './Localization';
 * const text = I18n.t('keyName');
 *
 */

// i18n.js
import { I18n } from "i18n-js";
import * as Localization from "expo-localization";

// Создаем экземпляр i18n с переводами для всех поддерживаемых языков
const i18n = new I18n({
  // Русский язык (основной)
  ru: {
    // ===== ОСНОВНАЯ НАВИГАЦИЯ И ОБЩИЕ ЭЛЕМЕНТЫ =====

    // Защита авторских прав
    copyright: "© АНСДИМАТ. Все права защищены. 1993 – 2025",

    // Основные пункты навигации
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
    import: "Импорт",
    util3: "Калькулятор",
    searchButton: "Поиск",

    selectOfrType: "Выберите тип ОФР",
    pumpingWellName: "Опытная скважина",
    observationWellName: "Наблюдательная скважина",
    clusterWellsHint:
      "Куст заводится с этой парой. Наблюдательные скважины можно добавить и потом, опытная в опробовании одна.",
    enterWellName: "Введите название скважины",
    wellsSection: "Скважины",
    deleteWellTitle: "Удалить скважину?",
    deleteWellMessage: "Замеры этой скважины будут удалены вместе с ней.",
    wellJournal: "Журнал замеров скважины",
    dragWellsHint: "Перетащите скважины — расстояния пересчитаются",
    wellsAtMyLocation: "Перенести куст к моему местоположению",
    addTableRow: "Добавить строку",
    newJournal: "Новый журнал",
    fillAndProcess: "Заполнить и обработать ОФР",
    previouslyCreated: "Ранее созданные",

    // ===== ОБРАБОТКА ОФР =====
    flowRateQ: "Дебит Q",
    measurementsJournal: "Журнал замеров",
    measurementsShort: "замеров",
    drawdownChart: "График понижения",
    recoveryChart: "График восстановления",
    phasePumping: "Откачка",
    phaseRecovery: "Восстановление",
    pumpingDuration: "Откачка длилась",
    finalDrawdown: "Понижение на остановке",
    recoveryComplete:
      "Уровень восстановился: остаточное понижение %{percent} % от понижения на остановке.",
    recoveryIncomplete:
      "Уровень восстановился не полностью: осталось %{percent} % понижения. Опыт принято считать законченным при 5 %.",
    journalPumping: "Журнал замеров: откачка",
    journalRecovery: "Журнал замеров: восстановление",

    // Обмен журналами через файл .ansdimat
    share: "Поделиться",
    shareAsFile: "Файл проекта (.ansdimat)",
    shareAsText: "Таблица замеров (текст)",
    importFromFile: "Импорт",
    importTitle: "Импорт журнала",
    importAction: "Импортировать",
    importReading: "Читаем файл…",
    importExportedAt: "Выгружен",
    importPumpingRows: "Замеры откачки",
    importRecoveryRows: "Замеры восстановления",
    wells: "Скважины",
    close: "Закрыть",
    importExistsTitle: "Такой журнал уже есть",
    importExistsHint:
      "Журнал «%{name}» уже заведён из этого файла. Заменить его или добавить копию?",
    importReplace: "Заменить существующий",
    importCopy: "Создать копию",
    importOpenExisting: "Открыть имеющийся",
    importFailed: "Не удалось открыть файл",
    importErrorNotAnsdimat: "Это не файл проекта АНСДИМАТ.",
    importErrorTooNew:
      "Файл создан более новой версией приложения. Обновите АНСДИМАТ.",
    importErrorCorrupted:
      "Файл повреждён при передаче. Попросите отправить его ещё раз.",
    importErrorInvalid: "Файл повреждён или заполнен не полностью.",
    importErrorReadFailed: "Не удалось прочитать файл.",

    recoveryJournalHint:
      "Время — от остановки насоса. Ноль восстановления отвечает понижению на этот момент.",
    recoveryNotCharted: " ",
    durationFromJournal: "Подставлено по последнему замеру откачки",
    recoveryAxisHint:
      "По оси X — отношение t/t′: время от начала откачки к времени от её остановки",
    pickSeriesHint:
      "Коснитесь названия кривой в легенде — прямая перейдёт на неё",
    recoveryEmptyTitle: "Журнал восстановления пуст",
    recoveryEmptyHint:
      "Внесите замеры после остановки насоса — прямая Тейса строится по ним.",
    recoveryNoStopTitle: "Не задано понижение на остановке",
    recoveryNoStopHint:
      "Остаточное понижение отсчитывается от него. Заполните журнал откачки этой скважины до момента остановки насоса или впишите понижение в поле выше.",
    recoveryOvershootTitle: "Журнал не сходится с понижением на остановке",
    recoveryOvershootHint:
      "Подъём уровня во всех строках больше понижения на остановке, и остатка не остаётся. Проверьте, что в журнале восстановления стоит подъём уровня от момента остановки, а понижение на остановке взято у этой же скважины.",
    fitBySeries: "Прямая по кривой «%{well}»",
    recoveryNeedDuration:
      "Укажите продолжительность откачки и внесите замеры после остановки насоса — иначе восстановление не обработать.",
    recoveryInterceptNote:
      "Прямая не проходит через начало координат: возможно влияние границ пласта или непостоянный дебит на откачке.",
    chartEmpty: "Добавьте замеры, чтобы построить график",
    ofr_single: "Одиночная",
    ofr_cluster: "Кустовая",
    ofr_slug: "Экспресс-откачка",
    ofr_lugeon: "Поинтервальные нагнетания",
    ofr_vadose: "Налив в шурф",
    // Виды прежних версий: новых журналов такого типа не заводят, но
    // заведённые раньше должны показываться названием, а не ключом
    ofr_fill: "Налив",
    ofr_recovery: "Восстановление",

    // ===== ОБРАБОТКА ОФР: ПОДПИСИ К РАСЧЁТУ =====
    transmissivityLabel: "T, %{unit}",
    methodRecovery:
      "T = 0.183·Q / a (восстановление по Тейсу), a — наклон прямой s′ — lg(t/t′).",
    methodCooperJacob: "T = 0.183·Q / Δs (Купер — Джейкоба).",
    methodAreaTracking:
      "Площадное прослеживание: T = 0.366·Q / C по срезу на общий момент времени.",
    methodCombinedTracking:
      "Комбинированное прослеживание: T = 0.183·Q / C по замерам всего куста.",
    methodTwoPoints: "Прямая проведена по двум выбранным точкам.",
    methodFreeLine: "Прямая проведена свободно, по двум поставленным точкам.",
    methodFitQuality: "R² = %{r2}",
    methodNeedLogAxis: "Для расчёта T переключите ось в режим lg t.",
    diffusivityLabel: "Пьезопр. a, %{unit}",
    momentLabel: "Момент времени",

    // ===== ПРИМЕРЫ И ВИДЕО (редизайн) =====
    filterAll: "Все",
    filterPumping: "Обработка ОФР",
    filterDewatering: "Водопонижение",
    filterModeling: "Моделирование",
    videoLessons: "Видеоуроки",
    studyMaterials: "Материалы",
    open: "Открыть",

    // ===== СПРАВКА (редизайн) =====
    aboutManual: "Руководство пользователя",
    aboutVideos: "Видеоуроки",
    aboutContact: "Связаться с нами",
    aboutLocalData:
      "© АНСДИМАТ. Расчёты идут на устройстве и работают без связи.",
    orderLicense: "Заказать лицензию",
    versionLabel: "версия",

    // ===== РУКОВОДСТВО ПОЛЬЗОВАТЕЛЯ =====
    manualEyebrow: "Как пользоваться",
    manualStartTitle: "С чего начать",
    manualStartIntro:
      "АНСДИМАТ — полевой инструмент гидрогеолога: журнал опытно-фильтрационных работ (ОФР), обработка замеров и расчёты параметров водоносного пласта. Всё считается на устройстве и хранится локально, интернет нужен только для входа в аккаунт и синхронизации.",
    manualStartStep1:
      "«Создать откачку» — заведите журнал: выберите тип ОФР и назовите проект.",
    manualStartStep2:
      "Заполните паспорт опыта: дебит, радиус скважины, мощность пласта.",
    manualStartStep3: "Вносите замеры «время — понижение» по ходу откачки.",
    manualStartStep4:
      "Откройте обработку: график строится сам, параметры пересчитываются на лету.",
    manualJournalTitle: "Журнал ОФР",
    manualJournalIntro:
      "Журнал — это опыт целиком: паспорт скважины, условия опробования и таблица замеров. Журналы не удаляются случайно: удаление всегда спрашивает подтверждение, а вместе с журналом удаляются и его замеры.",
    manualJournalStep1:
      "Карандаш у журнала — вернуться к вводу данных и правке замеров.",
    manualJournalStep2: "График — перейти к обработке и расчёту параметров.",
    manualJournalStep3:
      "Звезда — пометить журнал важным, он поднимется в начало списка.",
    manualJournalStep4:
      "Стрелка — выгрузить журнал вместе с замерами и передать коллеге.",
    manualJournalNote:
      "Время замеров вводится от начала откачки. Понижение — разность между статическим и динамическим уровнем, всегда положительная величина.",
    manualProcessingTitle: "Обработка ОФР",
    manualProcessingIntro:
      "Обработка идёт методом Купера — Джейкоба: замеры откладываются в полулогарифмических координатах «lg t — понижение», и по прямолинейному участку определяются параметры пласта.",
    manualFormulaT:
      "T — водопроводимость, м²/сут; Q — дебит, м³/сут; a — наклон прямой, м на логарифмический цикл.",
    manualFormulaK:
      "k — коэффициент фильтрации, м/сут; m — мощность водоносного пласта, м.",
    manualProcessingStep1:
      "По умолчанию прямая проводится методом наименьших квадратов по всем замерам.",
    manualProcessingStep2:
      "Чтобы отсечь начальный и конечный участки, переключитесь на построение по двум точкам и отметьте их — в таблице замеров или прямо на графике.",
    manualProcessingStep3:
      "График масштабируется двумя пальцами и кнопками «+» и «−», перетаскивается одним пальцем; оси при этом остаются на месте.",
    manualProcessingStep4:
      "Кнопка «Вписать» возвращает исходный масштаб по всем замерам.",
    manualProcessingNote:
      "Начальные замеры искажает ёмкость ствола скважины, конечные — влияние границ пласта. Прямолинейный участок обычно лежит между ними: именно его и стоит выбирать двумя точками.",
    manualCalculatorTitle: "Калькулятор",
    manualCalculatorIntro:
      "Четыре вкладки для быстрых расчётов, когда полного журнала нет — достаточно нескольких величин из полевой книжки.",
    manualCalcFiltration:
      "Перевод коэффициента фильтрации между единицами: м/сут, м/ч, м/с, см/с, фут/сут, мейнцеры.",
    manualCalcParams:
      "Коэффициент фильтрации по данным одиночной откачки — формулы Дюпюи для напорного и безнапорного пласта, с поправкой Козени на несовершенство скважины.",
    manualCalcForecast:
      "Понижение на заданном расстоянии и времени по формуле Тейса — через функцию скважины W(u).",
    manualCalcPit:
      "Приток воды в котлован: контур заменяется «большим колодцем» эквивалентного радиуса.",
    manualCalcBarrage:
      "Пласт с границей: непроницаемый контакт углубляет воронку, река — выполаживает. Плюс подпор уровня перед стеной в грунте.",
    manualCalcLeakage:
      "Пласт с перетеканием: понижение по Хантушу — Джейкобу, фактор перетекания B и расход утечки через кровлю.",
    manualRecoveryTitle: "Восстановление уровня",
    manualRecoveryIntro:
      "Вторая половина опыта: насос остановлен, уровень поднимается. Обрабатывать её выгодно — насос не работает, и колебания дебита уже ничего не портят.",
    manualFormulaRecovery:
      "s′ — остаточное понижение, м; t — время от начала откачки; t′ — время от остановки насоса.",
    manualRecoveryStep1: "В обработке переключитесь на «Восстановление».",
    manualRecoveryStep2:
      "Укажите, сколько длилась откачка: от этого момента отсчитывается t′.",
    manualRecoveryStep3:
      "Замеры вносятся так же — время от начала опыта и остаточное понижение.",
    manualRecoveryNote:
      "Прямая восстановления обязана проходить через начало координат. Заметный сдвиг — признак влияния границ пласта или непостоянного дебита на откачке; приложение об этом предупредит.",
    manualCalculatorNote:
      "Радиус влияния R редко замеряют — его принимают из опыта работ. Если оставить поле пустым, берётся R = 300·r₀, и в результатах появляется предупреждение: значение оценочное.",
    manualDiaryTitle: "Полевой дневник",
    manualDiaryStep1:
      "Введите название точки, опишите её и выберите тип: скважина, родник, шурф, наблюдение.",
    manualDiaryStep2:
      "Нажмите на карту в нужном месте — точка встанет по координатам нажатия.",
    manualDiaryStep3:
      "Кнопка «Отметить моё местоположение» ставит точку по координатам устройства, кружок на карте просто подводит карту к вам.",
    manualDiaryStep4:
      "Описание правится и потом — прямо в списке под точкой. Написанное сохраняется само, отдельной кнопки нет.",
    manualDiaryNote:
      "Карта подгружается из интернета, но уже отмеченные точки и их координаты хранятся на устройстве и доступны без связи.",
    manualAccountTitle: "Аккаунт и синхронизация",
    manualAccountIntro:
      "Без аккаунта приложение полностью работоспособно: журналы, замеры и точки хранятся в памяти устройства. Аккаунт нужен, чтобы те же данные открывались на другом телефоне или планшете.",
    manualGlossaryTitle: "Обозначения",
    manualTermQ: "Дебит скважины, м³/сут",
    manualTermS: "Понижение уровня, м",
    manualTermT: "Водопроводимость, м²/сут",
    manualTermK: "Коэффициент фильтрации, м/сут",
    manualTermM: "Мощность водоносного пласта, м",
    manualTermA: "Наклон прямой, м на логарифмический цикл",
    manualTermR0: "Радиус скважины, м",
    manualTermR: "Радиус влияния откачки, м",
    manualTermW: "Функция скважины Тейса, безразмерная",

    // ===== ГРАФИК ПОНИЖЕНИЯ =====
    fitAuto: "По всем точкам",
    fitFreedom: "Свободная прямая",
    selectSecondPoint: "Отметьте вторую точку — пока прямая идёт по всем замерам",
    freedomHint: "Тяните точки — прямая идёт через них. Полосы осей растягивают свою ось",
    addMeasurementsForChart: "Добавьте замеры, чтобы построить график",
    chartEmptyTitle: "График строится по двум замерам",
    chartEmptyHint:
      "Внесите время и понижение в журнале выше — прямая и T появятся сразу.",
    stepX: "Цена деления X",

    // ===== ДИАГНОСТИКА РЕЖИМА ФИЛЬТРАЦИИ =====
    chartExpand: "Развернуть график на весь экран",
    chartCollapse: "Свернуть график",
    viewFit: "Подбор прямой",
    viewDiagnostic: "Диагностика",
    diagnosticChart: "Диагностика режима",
    legendDerivative: "производная ds/d(ln t)",
    diagnosticAxes: "t, мин · по вертикали — метры",
    legendDrawdown: "понижение s",
    diagnosticEmptyTitle: "Диагностике нужно не меньше пяти замеров",
    diagnosticEmptyHint:
      "И желательно вразбивку по времени: 1, 2, 5, 10, 30 минут. По равномерному ряду форма кривой не читается.",
    timeFromPumpStart: "t от начала откачки, %{unit}",
    timeFromPumpStop: "t′ от остановки насоса, %{unit}",
    columnTime: "t, %{unit}",
    columnDrawdown: "s, %{unit}",
    columnRecovery: "восстановление, %{unit}",
    recoveryNoDuration:
      "Укажите, сколько длилась откачка — без этого восстановление не построить.",
    recoveryTimeTooSmall:
      "Время замеров меньше длительности откачки. В журнале восстановления время отсчитывается от начала откачки, а не от остановки насоса.",
    needLogMode:
      "Переключите ось X в режим lg t — по другим осям T не считается.",
    needTwoMeasurements:
      "Внесите хотя бы два замера: по одной точке прямую не провести.",
    needTwoSelected:
      "Отметьте на графике две точки, через которые провести прямую.",
    needFlowRate: "Укажите дебит Q — без него водопроводимость не рассчитать.",
    needSlope:
      "Понижение не растёт со временем: наклон прямой равен нулю, T не определена.",
    areaEmptyTitle: "Площадной график строится по кусту",
    combinedEmptyTitle: "Комбинированный график требует расстояний",
    needTwoDistances:
      "Введите расстояния хотя бы до двух скважин: площадной график строится по кусту.",
    needCommonMoment:
      "Нет момента времени, снятого хотя бы в двух скважинах. Площадной график строится по одновременным замерам.",
    needDistances:
      "Введите расстояния до скважин — без них комбинированный график не построить.",
    needWellDistance:
      "Введите расстояние до этой скважины — без него пьезопроводность и водоотдачу не получить.",
    singleNoDistance:
      "Пьезопроводность и водоотдача требуют расстояния до наблюдательной скважины: у одиночной откачки его нет.",
    recoveryNoDiffusivity:
      "Прямая Тейса даёт только водопроводимость: расстояние в неё не входит.",
    plateauEstimate: "T по полке производной",
    unitTransmissivity: "м²/сут",
    plateauMismatch:
      "Оценка расходится с расчётом по прямой больше чем на четверть — скорее всего, прямая проведена не по радиальному участку.",
    regimeRadial: "Радиальный поток",
    regimeRadialSign: "Производная вышла на полку и держится.",
    regimeRadialAdvice:
      "Пласт ведёт себя как неограниченный — формула Купера — Джейкоба применима, прямую можно вести по всем поздним точкам.",
    regimeBarrier: "Непроницаемая граница",
    regimeBarrierSign: "Полка производной выросла в %{ratio} раза.",
    regimeBarrierAdvice:
      "Понижение дошло до границы пласта. Считайте T по раннему участку: по поздним точкам она выйдет вдвое заниженной. Расстояние до границы оценивает вкладка «Барраж» в калькуляторе.",
    regimeRecharge: "Подпитка пласта",
    regimeRechargeSign: "Производная падает — понижение перестаёт расти.",
    regimeRechargeAdvice:
      "В пласт поступает вода: переток через разделяющий слой или близкий водоём. По поздним точкам T выйдет завышенной — берите участок до перегиба, а переток оцените во вкладке «Утечки».",
    regimeWellbore: "Работает ствол скважины",
    regimeWellboreSign: "Производная растёт под 45° почти на всей записи.",
    regimeWellboreAdvice:
      "Пока откачивается вода из самой скважины, пласт ещё не включился. Расчёт по этим замерам недостоверен — продолжите откачку.",
    regimeUnclear: "Режим не определён",
    regimeUnclearSign: "Замеров мало или они разбросаны.",
    regimeUnclearAdvice:
      "Нужно хотя бы пять замеров, разнесённых по времени в несколько раз: 1, 2, 5, 10, 30 минут.",

    // ===== ДЕПРЕССИОННАЯ ВОРОНКА =====
    coneSection: "Разрез депрессионной воронки",
    coneStaticLevel: "уровень до откачки",
    coneAxis: "расстояние от скважины, м",
    coneEmpty:
      "Заполните дебит, водопроводимость, водоотдачу и время — разрез построится сразу.",
    coneInfluence:
      "Радиус влияния ≈ %{radius} м — дальше понижение практически не ощущается.",

    // ===== СПИСОК ЖУРНАЛОВ =====
    measurementsCount: "%{count} замеров",
    noMeasurements: "замеров нет",
    createFailed: "Не удалось создать журнал. Попробуйте ещё раз.",

    // ===== АККАУНТ =====
    accountSection: "Аккаунт",
    accountTitle: "Аккаунт",
    signIn: "Вход",
    signUp: "Регистрация",
    signOut: "Выйти",
    signInToSync: "Войти в аккаунт",
    syncAcrossDevices: "Синхронизация между устройствами",
    password: "Пароль",
    authFillFields: "Заполните почту и пароль",
    authInvalidCredentials: "Неверная почта или пароль",
    authEmailNotConfirmed:
      "Почта не подтверждена. Откройте ссылку из письма — или выключите подтверждение почты в настройках проекта Supabase.",
    authEmailTaken: "Такая почта уже зарегистрирована",
    authWeakPassword: "Пароль короче 6 символов",
    authBadEmail: "Проверьте адрес почты",
    authNetwork: "Нет связи с сервером",
    authCheckEmail: "Подтвердите адрес по ссылке из письма, затем войдите",
    accountPurpose:
      "Аккаунт нужен, чтобы журналы и точки были на всех ваших устройствах. Без входа приложение работает локально.",
    syncNotConfigured: "Синхронизация не настроена",
    syncNotConfiguredHint:
      "Синхронизация не настроена: не заданы ключи сервера. Приложение работает локально.",

    // ===== НАСТРОЙКИ (редизайн) =====
    appearance: "Оформление",
    themeLight: "Светлая",
    themeDark: "Тёмная",
    themeSystem: "Системная",
    appLanguage: "Язык интерфейса",
    basicVersion: "Базовая версия",
    premiumPitch: "Расширьте до Premium: карта куста, приток, барраж",
    dataAndCalc: "Данные и расчёты",
    settingTablet: "Адаптация под планшет",
    settingAutoLocation: "Автоопределение координат",
    settingTabularNums: "Моноширинные цифры",
    aboutApp: "О приложении",

    // ===== ГЛАВНАЯ (редизайн) =====
    mainScenario: "Основной сценарий",
    createPumping: "Создать откачку",
    createPumpingSub: "Журнал и обработка ОФР",
    desktopBanner: "Полная версия для Windows — расчёты на компьютере",
    desktopBannerTitle: "Версия для Windows",
    desktopBannerSub: "Полные расчёты на компьютере",

    // ===== ОБЩИЕ ДЕЙСТВИЯ =====
    add: "Добавить",
    confirm: "Подтвердить",
    total: "Всего",

    // ===== КАЛЬКУЛЯТОР: вкладки и поля =====
    tabFiltration: "Пересчёт k",
    tabParams: "Параметры",
    tabForecast: "Прогноз s",
    tabPit: "Котлован",
    // ===== ЗОНА САНИТАРНОЙ ОХРАНЫ =====
    tabWhpa: "ЗСО",
    whpaMethodGroup: "Способ расчёта поясов",
    whpaMethodAnalyticalShort: "Аналитический",
    whpaMethodVolumeShort: "Объёмный",
    whpaMethodAnalytical: "Изохрона в естественном потоке · ВНИИ ВОДГЕО, 1983",
    whpaMethodVolume: "Круг по объёму отобранной воды · поток не учитывается",
    whpaIntakeGroup: "Водозабор",
    whpaFlowRate: "Дебит скважины",
    whpaAquiferGroup: "Водоносный пласт",
    whpaConductivity: "Коэффициент фильтрации",
    whpaThickness: "Мощность пласта",
    whpaPorosity: "Активная пористость",
    whpaLithologyNote: "Справочник Domenico & Schwartz: подставляет типичные k и n.",
    whpaFlowGroup: "Естественный поток",
    whpaGradient: "Градиент потока",
    whpaAzimuth: "Азимут потока",
    whpaAzimuthHint: "0° — север",
    whpaBeltsGroup: "Пояса",
    whpaFirstBelt: "Радиус I пояса",
    whpaTimeBacterial: "Время II пояса",
    whpaTimeBacterialHint: "СанПиН: 100 / 200 / 400",
    whpaTimeChemical: "Время III пояса",
    whpaTimeChemicalHint: "25 лет = 9125",
    whpaResultTitle: "III пояс, вверх по потоку",
    whpaDownstream: "Вниз по потоку",
    whpaAcross: "Ширина поперёк",
    whpaSizesGroup: "Размеры поясов",
    whpaBeltColumn: "Пояс",
    whpaSizesNote: "R — вверх по потоку, r — вниз, 2d — ширина поперёк потока.",
    whpaBelt_firstShort: "I, строгий",
    whpaBelt_bacterialShort: "II, бактер.",
    whpaBelt_chemicalShort: "III, химич.",
    whpaDetailsGroup: "Подробности",
    whpaStatQ: "Удельный расход потока q",
    whpaStatStagnation: "Водораздельная точка x_L",
    whpaStatTauBacterial: "Безразмерное время τ (II)",
    whpaStatTauChemical: "Безразмерное время τ (III)",
    whpaStatWidthLimit: "Предельная ширина захвата",
    whpaSource: "СанПиН 2.1.4.1110-02; решение ВНИИ ВОДГЕО, 1983. Оценка предварительная.",
    whpaPlanEmpty: "Задайте данные — план построится",
    whpaFlow: "поток",
    whpaNorth: "С",
    whpaWarn_beltInsideFirst: "III пояс не выходит за I: проверьте дебит и мощность пласта.",
    whpaWarn_bacterialOverChemical: "II пояс шире III — проверьте расчётные времена.",
    whpaWarn_captureLimit: "Пояс упёрся в предельную ширину захвата Q/q: дальше время его не расширяет.",
    whpaError_Q: "Задайте дебит скважины.",
    whpaError_k: "Задайте коэффициент фильтрации.",
    whpaError_m: "Задайте мощность пласта.",
    whpaError_n: "Задайте активную пористость.",
    whpaError_n_gt_1: "Активная пористость должна быть меньше единицы.",
    whpaError_I: "Задайте градиент потока: без него аналитический способ не работает. Для стоячей воды выберите объёмный.",
    whpaError_tBacterial: "Задайте время II пояса.",
    whpaError_tChemical: "Задайте время III пояса.",
    whpaError_firstBeltRadius: "Задайте радиус I пояса.",
    whpaLatitude: "Широта",
    whpaLongitude: "Долгота",
    whpaCoordsHint: "WGS-84",
    whpaPlanGroup: "План поясов на местности",
    whpaPlanNoCoords: "Без координат устья пояса показаны схемой",
    whpaMapHint: "Нажмите на карту или перетащите метку, чтобы поставить скважину.",
    whpaAtMyLocation: "Поставить скважину по моему местоположению",
    whpaWellTitle: "Скважина",
    whpaTurningGroup: "Поворотные точки",
    whpaTurningNote: "Географические координаты WGS-84 для выноса границы в натуру.",
    whpaTurningNo: "№",
    whpaTurningLat: "Широта",
    whpaTurningLon: "Долгота",
    whpaStatArea: "Площадь III пояса",
    whpaPercGroup: "Защищённость горизонта",
    whpaPercLead: "Загрязнение с поверхности идёт к воде сверху вниз: время просачивания складывается по слоям перекрывающих отложений.",
    whpaRecharge: "Питание инфильтрацией",
    whpaRechargeHint: "обычно 0.0001–0.001",
    whpaLayersGroup: "Разрез зоны аэрации",
    whpaLayerK: "k′",
    whpaLayerM: "m′",
    whpaLayerN: "n′",
    whpaLayerT0: "t₀, сут",
    whpaAddLayer: "Добавить слой",
    whpaRemoveLayer: "Убрать слой",
    whpaPercResultTitle: "Время просачивания",
    whpaPercFormula: "k′ ≥ w:  t₀ = n′ m′ / ∛(k′ w²)\nk′ < w:  t₀ = n′ m′ / k′",
    whpaPercProtected: "Горизонт можно считать защищённым: t₀ ≥ 400 сут.",
    whpaPercUnprotected: "Горизонт нельзя считать защищённым: t₀ < 400 сут.",
    whpaPercSource: "ВНИИ ВОДГЕО, 1983 · формула Аверьянова.",
    whpaLayerSaturated: "насыщенный",
    whpaLithoGravel: "Гравий",
    whpaLithoCoarseSand: "Песок крупнозернистый",
    whpaLithoMediumSand: "Песок среднезернистый",
    whpaLithoFineSand: "Песок мелкозернистый",
    whpaLithoLoess: "Супесь, лёсс",
    whpaLithoTill: "Морена",
    whpaLithoClay: "Глина",
    whpaLithoMarineClay: "Глина морская",
    whpaLithoKarst: "Известняк закарстованный",
    whpaLithoLimestone: "Известняк, доломит",
    whpaLithoSandstone: "Песчаник",
    whpaLithoSiltstone: "Алевролит",
    whpaLithoShale: "Сланец",

    // --- Приток в котлован: полная вкладка ---
    pitSchemeGroup: "Расчётная схема",
    pitSchemeUnconfined: "Безнапорный",
    pitSchemeUnconfinedRiver: "Безнапорный + река",
    pitSchemeConfined: "Напорный",
    pitSchemeConfinedRiver: "Напорный + река",
    pitMethodUnconfined: "Безнапорный неограниченный · Дюпюи",
    pitMethodUnconfinedRiver: "Безнапорный у реки · Дюпюи",
    pitMethodConfined: "Напорный неограниченный · Дюпюи–Тима",
    pitMethodConfinedRiver: "Напорный у реки · Дюпюи–Тима",
    pitResultTitle: "Приток в котлован",
    pitGeometryGroup: "Геометрия",
    pitGeomArea: "Площадь F",
    pitGeomRect: "Прямоугольник L × B",
    pitGeomRadius: "Приведённый радиус r₀",
    pitR0Area: "По равновеликой площади",
    pitR0Forchheimer: "По Форхгеймеру",
    pitArea: "Площадь котлована",
    pitLength: "Длина",
    pitWidth: "Ширина",
    pitReducedRadius: "Приведённый радиус",
    pitAquiferGroup: "Водоносный пласт",
    pitConductivity: "Коэффициент фильтрации",
    pitThicknessConfined: "Мощность пласта",
    pitThicknessUnconfined: "Начальная мощность",
    pitDrawdown: "Понижение в котловане",
    pitBoundaryGroup: "Радиус влияния",
    pitRFromWall: "R = r₀ + √(π a t)",
    pitRManual: "Задать R вручную",
    pitR_verigin: "Веригин",
    pitR_kusakin: "Кусакин",
    pitR_sichardt: "Зихардт",
    pitR_weber: "Вебер",
    pitRiverDistance: "Расстояние до реки",
    pitRiverHint: "R = 2L",
    pitManualR: "Радиус влияния",
    pitTime: "Время работы дренажа",
    pitDiffusivity: "Пьезопроводность",
    pitDiffusivityHint: "иначе k·h / μ",
    pitStorage: "Водоотдача",
    pitFactor: "Коэффициент запаса",
    pitFactorHint: "обычно 1.2–1.5",
    pitExamplesGroup: "Примеры",
    pitExample_confined_unlimited: "Напорный",
    pitExample_confined_river: "Напорный + река",
    pitExample_unconfined_unlimited: "Безнапорный",
    pitExample_unconfined_river: "Безнапорный + река",
    pitStatsGroup: "Подробности",
    pitStatR0: "Приведённый радиус r₀",
    pitStatR: "Радиус влияния R",
    pitStatRatio: "R / r₀",
    pitStatLn: "ln(R / r₀)",
    pitStatT: "Водопроводимость T",
    pitStatQHour: "Приток, м³/ч",
    pitStatQSec: "Приток, л/с",
    pitStatDesign: "Проектный приток с запасом",
    pitSectionGroup: "Разрез котлована",
    pitChartGroup: "График",
    pitCompareGroup: "Способы расчёта R",
    pitCompareNote: "Строгого решения для радиуса влияния нет — школы расходятся в разы.",
    pitWarn_R_close: "Радиус влияния меньше двух приведённых — формула Дюпюи на таком контуре работает плохо.",
    pitWarn_t_small: "Срок работы дренажа меньше 10 суток: стационарная формула завышает приток.",
    pitWarn_k_high: "Коэффициент фильтрации выше 100 м/сут — проверьте единицы.",
    pitWarn_k_low: "Коэффициент фильтрации ниже 0.01 м/сут — приток будет пренебрежимо мал.",
    pitWarn_S_large: "Понижение больше двадцати мощностей пласта — проверьте исходные данные.",
    pitWarn_elongated: "Котлован вытянут больше чем вчетверо: приведение по Форхгеймеру точнее равновеликой площади.",
    pitError_k: "Задайте коэффициент фильтрации.",
    pitError_m: "Задайте мощность пласта.",
    pitError_h0: "Задайте начальную мощность потока.",
    pitError_S: "Задайте понижение в котловане.",
    pitError_r0: "Задайте приведённый радиус.",
    pitError_F: "Задайте площадь котлована.",
    pitError_rect: "Задайте длину и ширину котлована.",
    pitError_L: "Задайте расстояние до реки.",
    pitError_L_le_r0: "Река ближе стенки котлована — проверьте расстояние.",
    pitError_t: "Задайте время работы дренажа.",
    pitError_a: "Задайте пьезопроводность или водоотдачу.",
    pitError_mu: "Задайте гравитационную водоотдачу.",
    pitError_Rmanual: "Задайте радиус влияния.",
    pitError_R_le_r0: "Радиус влияния не больше приведённого — приток не определён.",
    pitError_S_gt_h0: "Понижение больше начальной мощности: пласт осушается полностью.",

    // --- Понижение от водозабора: полная вкладка ---
    wellSchemeGroup: "Расчётная схема",
    wellSchemeTheis: "Напорный",
    wellSchemeHantush: "С перетеканием",
    wellSchemeBoulton: "Безнапорный",
    wellSchemeBoundary: "Граница питания",
    // Полное имя схемы с автором решения. Чипы выбора укорочены до одного
    // слова, и без этой строки нигде не было видно, чьим методом идёт счёт
    wellMethodTheis: "Напорный изолированный · Тейс",
    wellMethodHantush: "Пласт с перетеканием · Хантуш–Джейкоб",
    wellMethodBoulton: "Безнапорный пласт · Болтон",
    wellMethodBoundary: "Полуограниченный пласт · граница питания",
    wellResultTitle: "Понижение в опытной",
    wellResultObs: "В наблюдательной",
    wellTransmissivityHint: "T = k·m",
    wellPumpingGroup: "Откачка",
    wellFlow: "Расход скважины",
    wellTime: "Длительность откачки",
    wellYearsHint: "%{years} лет",
    wellRadius: "Радиус скважины",
    wellDistance: "До наблюдательной",
    wellBoundaryGroup: "Граница питания",
    wellToRiver: "От опытной до реки",
    wellObsToRiver: "От наблюдательной до реки",
    wellAquiferGroup: "Водоносный пласт",
    wellLithologyNote: "Подставит k, Sy и упругую ёмкость по справочнику ANSDIMAT.",
    wellConductivity: "Коэффициент фильтрации",
    wellThickness: "Мощность горизонта",
    wellSaturated: "Обводнённая мощность",
    wellYield: "Водоотдача",
    wellStorativity: "Упругая водоотдача",
    wellDiffusivity: "Пьезопроводность",
    wellDiffusivityHint: "a = k·m / S",
    wellLeakage: "Параметр перетекания",
    wellAllowableGroup: "Допустимое понижение",
    wellAllowable: "Допустимое понижение",
    wellSectionGroup: "Типовая схема",
    wellStatsGroup: "Подробности",
    wellStatT: "Водопроводимость T",
    wellStatA: "Пьезопроводность a",
    wellStatS: "Упругая водоотдача S",
    wellStatImage: "Расстояние до фиктивной скважины",
    wellStatReserve: "Запас до допустимого понижения",
    wellChartGroup: "График",
    wellTableGroup: "Таблица",
    wellTableNote: "Время разложено логарифмически.",
    wellWarn_r_le_r0: "Наблюдательная скважина ближе стенки опытной — проверьте расстояние.",
    wellWarn_exceeds_allowable: "Понижение превысило допустимое: уменьшите расход или срок откачки.",
    wellWarn_dewatered: "Безнапорный горизонт осушается: понижение достигло обводнённой мощности.",
    wellError_Q: "Задайте расход скважины.",
    wellError_t: "Задайте длительность откачки.",
    wellError_r0: "Задайте радиус опытной скважины.",
    wellError_r: "Задайте расстояние до наблюдательной скважины.",
    wellError_k: "Задайте коэффициент фильтрации.",
    wellError_m: "Задайте мощность горизонта.",
    wellError_h0: "Задайте обводнённую мощность.",
    wellError_S: "Задайте упругую водоотдачу или пьезопроводность.",
    wellError_Sy: "Задайте гравитационную водоотдачу.",
    wellError_B: "Задайте параметр перетекания B.",
    wellError_Lw: "Задайте расстояние от опытной скважины до реки.",
    wellError_Lp: "Задайте расстояние от наблюдательной скважины до реки.",

    // --- Графики калькулятора ---
    chartNoData: "Недостаточно данных для графика",
    chartTimeAxis: "Время работы дренажа, сут",
    chartInflowAxis: "Приток, м³/сут",
    chartDrawdownAxis: "Понижение, м",
    chartPumpingTimeAxis: "Время от начала откачки, сут",
    // --- Перенос веб-калькуляторов: подписи разрезов ---
    schemePitSection: "Разрез котлована",
    schemeWellSection: "Разрез скважин",
    schemeRiver: "река",
    schemeFloor: "дно",
    schemeCrest: "бровка",
    schemeSand: "песок",
    schemeClay: "глина",
    schemeAquitard: "водоупор",
    schemeDrawdownWord: "понижение",
    schemeInitialHead: "нач. пьезометр",
    schemeInitialGwl: "нач. УГВ",
    schemePumpedWell: "опытная",
    schemeObsWell: "набл.",

    // --- Типовые грунты: приток в котлован ---
    lithoClay: "Глина",
    lithoLoam: "Суглинок",
    lithoSandyLoam: "Супесь",
    lithoFineSand: "Песок мелкий",
    lithoMediumSand: "Песок средний",
    lithoCoarseSand: "Песок крупный",
    lithoGravel: "Гравий",
    lithoFractured: "Трещиноватые породы",

    // --- Типовые грунты: понижение от водозабора ---
    lithoWellGravel: "Гравий, галечник",
    lithoWellCoarseSand: "Песок крупнозернистый",
    lithoWellMediumSand: "Песок среднезернистый",
    lithoWellFineSand: "Песок мелкозернистый",
    lithoWellSiltySand: "Песок пылеватый, супесь",
    lithoWellLoam: "Суглинок",
    lithoWellClay: "Глина",
    lithoWellSandstone: "Песчаник",
    lithoWellLimestone: "Известняк трещиноватый",
    lithoWellFractured: "Трещиноватые скальные породы",

    // --- Площадь ---
    quantityArea: "Площадь",
    unitM2: "м²",
    unitHectare: "га",
    unitKm2: "км²",
    unitFt2: "фут²",

    // --- Объём ---
    quantityVolume: "Объём",
    unitM3: "м³",
    unitLiters: "л",
    unitFt3: "фут³",
    unitGallons: "гал",

    // --- Давление ---
    quantityPressure: "Давление",
    unitPascal: "Па",
    unitKiloPascal: "кПа",
    unitMegaPascal: "МПа",
    unitBar: "бар",
    unitAtmosphere: "кгс/см²",
    unitMeterH2O: "м вод. ст.",
    tabBarrage: "Барраж",
    tabLeakage: "Утечки",

    // ===== БАРРАЖ И ГРАНИЧНЫЕ УСЛОВИЯ =====
    distanceToBoundary: "Расстояние до границы",
    boundaryResultTitle: "Понижение с учётом границы",
    boundaryType: "Тип границы",
    boundaryBarrier: "Непроницаемая",
    boundaryRecharge: "Постоянный напор",
    withoutBoundary: "Без границы",
    boundaryEffect: "Вклад границы",
    boundaryNotReachedNote:
      "Возмущение ещё не дошло до границы — она пока не влияет на понижение.",
    observationBeyondBoundaryNote:
      "Точка наблюдения оказалась за границей пласта: r должно быть меньше L.",
    barrageRiseTitle: "Подпор перед сооружением",
    barrageRiseShort: "Подпор",
    naturalGradient: "Уклон потока",
    barrierLength: "Длина сооружения",

    // ===== ИНФИЛЬТРАЦИОННЫЕ УТЕЧКИ =====
    aquitardGroup: "Слабопроницаемый слой",
    aquitardThickness: "Мощность слабого слоя",
    aquitardK: "Коэф. фильтрации слоя",
    steadyDrawdown: "Стационар",
    leakageVolumeTitle: "Расход перетекания",
    leakageArea: "Площадь перетекания",
    leakageTotal: "Расход по площади",
    value: "Значение",
    result: "Результат",
    convertedToAllUnits: "Пересчёт",
    thickness: "Мощность пласта",
    influenceRadius: "Радиус влияния",
    penetrationRatio: "Доля вскрытия",
    transmissivity: "Водопроводимость",
    storativity: "Водоотдача",
    filtrationCoefficient: "Коэф. фильтрации k",
    pitRadius: "Радиус котлована r₀",
    defaultInfluenceRatioNote: "R и r₀ не заданы — принято R/r₀ = 300.",
    drawdownExceedsThicknessNote:
      "Понижение больше мощности пласта — проверьте исходные данные.",
    unitMDay: "м/сут",
    unitMHour: "м/час",
    unitMSec: "м/сек",
    unitCmDay: "см/сут",
    unitCmSec: "см/сек",
    unitMmDay: "мм/сут",
    unitFtDay: "фт/сут",
    unitFtSec: "фт/сек",
    unitMeinzer: "мейнцер",

    // ===== ПОЛЕВОЙ ДНЕВНИК: карта и точки =====
    pointTypeWell: "Скважина",
    pointTypeSpring: "Родник",
    pointTypePit: "Шурф",
    pointTypeObservationPoint: "Наблюдение",
    pointType_well: "Скважина",
    pointType_spring: "Родник",
    pointType_pit: "Шурф",
    pointType_observation: "Точка",
    pointsCount: "точек",
    typesCount: "типа",
    lastRecord: "запись",
    observationPoints: "Точки наблюдения",
    pointTitlePlaceholder: "Название точки",
    pointNote: "Описание точки",
    pointNotePlaceholder: "Описание: что за точка, что замерено, как подойти",
    addPointNote: "Добавить описание",
    // Вложения точки: снимки и голосовые заметки
    attachments: "Вложения",
    addPhoto: "Фото",
    addVoiceNote: "Запись",
    photoFromCamera: "Снять",
    photoFromLibrary: "Из галереи",
    openAttachments: "Вложения точки",
    recordingInProgress: "Идёт запись",
    stopRecording: "Остановить запись",
    playRecording: "Прослушать запись",
    pauseRecording: "Пауза",
    closePhoto: "Закрыть снимок",
    deleteAttachment: "Удалить вложение?",
    deletePhotoMessage: "Снимок будет удалён с устройства.",
    deleteAttachmentMessage: "Запись будет удалена с устройства.",
    cameraDenied: "Нет доступа к камере. Разрешите его в настройках телефона.",
    galleryDenied: "Нет доступа к галерее. Разрешите его в настройках телефона.",
    microphoneDenied: "Нет доступа к микрофону. Разрешите его в настройках телефона.",
    photoCount: "снимков",
    voiceNoteCount: "записей",
    markMyLocation: "Отметить моё местоположение",
    centerOnMyLocation: "Показать моё местоположение на карте",
    mapExpand: "Развернуть карту на весь экран",
    mapCollapse: "Свернуть карту",
    tapMapToMark: "Нажмите на карту — отметить точку",
    tapMapToAddPoint: "Нажмите на карту, чтобы отметить точку",
    mapNativeOnly: "Карта доступна в мобильном приложении",
    locationDenied:
      "Нет доступа к геопозиции. Разрешите его в настройках или отметьте точку тапом по карте.",
    locationFailed:
      "Не удалось определить местоположение. Под землёй и в здании сигнала может не быть — поставьте точку по карте.",
    locating: "Определяем координаты…",

    // ===== ПОЛЕВОЙ ДНЕВНИК: интерфейс =====
    filterByTypes: "Фильтр по типам",
    fieldDiaryStats: "Статистика полевого дневника",
    addPoint: "Добавить точку",
    editPoint: "Изменить точку",
    pointTypeLabel: "Тип точки:",

    // ===== КАЛЬКУЛЯТОР =====
    imperfectWell: "Несовершенная скважина",

    // ===== ОБЩЕЕ =====
    loadingSettings: "Загрузка настроек...",

    // ===== ПОЛЕВОЙ ДНЕВНИК: типы точек =====
    pointTypeObservation: "Наблюдение",
    pointTypeSample: "Проба",
    pointTypeMeasurement: "Измерение",
    pointTypePhoto: "Фото",
    pointTypeNote: "Заметка",

    // ===== НИЖНЕЕ МЕНЮ =====
    help: "Справка",
    exit: "Выход",
    // ===== АККАУНТ И СИНХРОНИЗАЦИЯ =====
    accountManage: "Синхронизация, пароль, удаление",
    signInAction: "Войти",
    signUpAction: "Зарегистрироваться",
    subscribeNeedsAccount:
      "Войдите в аккаунт: подписка привязывается к учётной записи.",
    billingPending:
      "Оплата подключается через App Store и Google Play. Для доступа сейчас используйте промокод в разделе «Аккаунт».",
    cancelViaStore:
      "Подписка отменяется в настройках App Store или Google Play — так требуют правила магазинов.",
    syncSection: "Синхронизация",
    syncIdle: "Готово к обмену",
    syncInProgress: "Синхронизация…",
    syncUpToDate: "Данные актуальны",
    syncConflicts: "Есть расхождения",
    syncFailed: "Не удалось синхронизировать",
    syncLast: "Последний обмен",
    syncNever: "ещё не выполнялась",
    syncJustNow: "только что",
    syncMinutesAgo: "%{count} мин назад",
    syncPending: "ждут отправки",
    syncNow: "Синхронизировать",
    conflictsSection: "Расхождения",
    conflictQuestion:
      "Запись изменена и здесь, и на другом устройстве. Какую версию оставить?",
    keepLocal: "Эту",
    keepRemote: "С другого устройства",
    passwordSection: "Пароль",
    newPassword: "Новый пароль",
    changePassword: "Сменить пароль",
    passwordChanged: "Пароль изменён",
    passwordTooShort: "Не короче 6 символов",
    forgotPassword: "Забыли пароль?",
    enterEmailFirst: "Введите адрес почты",
    resetSent: "Письмо со ссылкой отправлено. Проверьте почту.",
    dangerSection: "Управление учётной записью",
    deleteAccount: "Удалить аккаунт",
    deleteAccountTitle: "Удалить аккаунт?",
    deleteAccountMessage:
      "Учётная запись и все данные на сервере будут удалены без возможности восстановления.",
    deleteAccountHint:
      "Журналы и точки останутся на этом устройстве. С сервера данные будут удалены безвозвратно.",
    planBasic: "Базовый доступ",
    planPremium: "Премиум-доступ",
    premiumActive: "Синхронизация и расширенные расчёты открыты",
    // Заглушка закрытой карты куста
    premiumLearnMore: "Подробнее о Premium",
    clusterMapLockTitle: "Карта куста — в Premium",
    clusterMapLockNote: "Без подписки расстояния до скважин вводятся в таблице выше.",
    promoSection: "Промокод",
    promoPlaceholder: "Код от партнёра",
    promoApply: "Применить",
    promoApplied: "Промокод применён",
    signOutTitle: "Выйти из аккаунта?",
    signOutMessage:
      "Журналы и точки останутся на устройстве. Синхронизация остановится до следующего входа.",

    // ===== МОДУЛЬ ОТКАЧЕК (главный экран) =====
    loadProject: "Загрузить проект",
    processing: "Обработка",
    ofrType: "Тип ОФР",
    projectJournalName: "Название проекта/журнала",
    stepOfTotal: "Шаг %{current} из %{total}",
    drawdownData: "Данные понижений",
    projectReview: "Обзор проекта",
    processingTypeAndDates: "Тип обработки и даты",
    createJournalSubtitle:
      "Мастер создания нового журнала обработки откачки за 3 шага",
    zooming: "Масштабирование",
    distancesInfo:
      "На этом шаге важно указать расстояние от откачиваемой скважины до наблюдательной, в метрах. Если отдельной наблюдательной скважины нет, а наблюдения выполнялись в откачиваемой скважине, то за расстояние принимается радиус скважины.",
    km: "км",

    // ===== ЭКРАН ЗАГРУЗКИ =====

    // Подзаголовок приложения на экране загрузки
    appSubtitle: "полевой калькулятор гидрогеолога",

    // ===== МОДУЛЬ ОБРАБОТКИ ОТКАЧЕК =====
    // Единицы измерения расхода воды
    flowRateUnits: "Единицы измерения расхода",

    // Мастер создания проектов
    processingTypeSelection: "Выбор типа обработки",

    // Кнопки навигации и элементы мастера
    saveChanges: "Сохранить изменения",
    addObservationWell: "Добавить наблюдательную скважину",
    addMeasurement: "Добавить замер",
    deleteMeasurement: "Удалить замер",
    timeUnit: "Единица времени",
    timeUnits: "Единицы времени",
    aquiferThickness: "Мощность водоносного горизонта",
    saturatedThickness: "Насыщенная мощность",
    mainFormationThickness: "Основная мощность",
    flowRate: "Расход",
    wellName: "Название скважины",
    withInterflow: "С перетеканием",
    processingTypes: "Типы обработки",
    pumpingStart: "Начало откачки",
    recoveryStart: "Начало восстановления",
    experimentalWell: "Опытная скважина",
    measurements: "Замеры",
    distances: "Расстояния",
    dragToMove: "Перетащите для перемещения",
    pinchToZoom: "Масштабируйте пальцами",
    tapToSelect: "Нажмите для выбора",
    addWell: "Добавить скважину",
    deleteWell: "Удалить скважину",
    editWell: "Редактировать скважину",
    wellActions: "Действия со скважиной",
    measurementNumber: "Замер",
    insertMeasurement: "Вставить замер",
    selectDate: "Выбор даты и времени",
    dateTimeSelection: "Выбор даты и времени",

    // ===== ГЛАВНАЯ СТРАНИЦА (РАБОЧИЙ СТОЛ) =====

    // Приветствие и основные элементы
    welcome: "Добро пожаловать",
    desktop: "Рабочий стол",
    search: "Поиск",
    calculator: "Калькулятор",
    mainMenu: "Основные функции",

    // Описания карточек главного экрана
    // Каждая карточка имеет название и описание для лучшего понимания пользователем
    calculatorDesc: "Гидрогеологические расчеты",
    pumpingTestDesc: "Заполнение журнала и обработка ОФР",
    examplesDesc: "Обучающие материалы",

    // ===== КАРТЫ ГИДРОИЗОГИПС (AnsSurf) =====
    maps: "Карты гидроизогипс",
    mapsDesc: "Построение по скважинам",
    mapsExportShared: "Готово: файлов — %{count}. Окно «Поделиться» откроется на каждый.",
    mapsExportSaved: "Сохранено файлов: %{count}.",
    mapsFailed: "Не удалось. Попробуйте ещё раз.",
    subscriptionDesc: "Управление подпиской",
    settingsDesc: "Настройки приложения",
    fieldDesc: "Точки наблюдения с координатами",
    field: "Полевой дневник",
    programAddsDesc:
      "Программа для повседневных гидрогеологических расчетов на windows.",
    programAdds: "АНСДИМАТ",
    aboutDesc: "Информация о приложении",
    contactDesc: "Связь с разработчиками",
    appDescription:
      "Программный комплекс для анализа и обработки гидрогеологических данных",

    // ===== СТАТУС ПОДПИСКИ =====

    // Информация о подписке пользователя
    subscriptionStatus: "Статус подписки",
    active: "Активна",
    inactive: "Неактивна",

    // ===== НАСТРОЙКИ =====

    // Основные настройки приложения
    settings: "Настройки",
    settingsDescription: "Настройка внешнего вида и поведения приложения",
    theme: "Тема",
    language: "Язык",
    version: "Версия",
    developer: "Разработчик",
    website: "Сайт",
    change: "Изменить",
    settingsInfo:
      "Изменения настроек применяются немедленно и сохраняются автоматически.",

    // ===== РАЗДЕЛ "О НАС" =====

    // История и описание компании
    aboutTitle: "История АНСДИМАТ",
    aboutStory:
      "История АНСДИМАТ началась в середине 1990-х годов в Горном институте Санкт-Петербурга (Российский государственный технический университет). Изначально программное обеспечение было разработано для помощи нашей исследовательской группе гидрогеологов в планировании и интерпретации испытаний водоносных горизонтов.",
    aboutDevelopment:
      "В период с 1995 по 2005 год АНСДИМАТ изменил свой интерфейс с DOS на Windows и был расширен для включения инструмента аналитического моделирования (AMWELLS). Начиная с 2005 года, мы решили поделиться нашим инструментом с профессионалами за пределами нашего университета. Растущее число наших пользователей и их бесценная обратная связь поддержали дальнейшее развитие АНСДИМАТ и внедрение новых инструментов и модулей.",

    // Описание продукта
    whatIsTitle: "Что такое АНСДИМАТ",
    whatIsDescription:
      "АНСДИМАТ - это набор программных инструментов, которые используют аналитические решения для решения проблем потока и транспорта подземных вод. Эти решения помогают гидрогеологам, которые работают с водоснабжением, водоотливом шахт, гражданским строительством или экологическими оценками.",

    // Примеры применения
    applicationsTitle: "Типичные примеры применения АНСДИМАТ включают:",
    app1: "• Интерпретация насосных испытаний водоносных горизонтов, пакерных испытаний, slug-тестов;",
    app2: "• Проектирование и оптимизация скважинных полей для водоснабжения или водоотлива шахт;",
    app3: "• Прогнозирование притока подземных вод в открытые карьеры и подземные шахты;",
    app4: "• Прогнозирование понижения от вертикальных или горизонтальных скважин;",
    app5: "• Определение зон санитарной охраны скважин;",
    app6: "• Прогнозирование миграции загрязняющих веществ с использованием моделирования частиц или дисперсионного транспорта;",
    app7: "• Моделирование вторжения морской воды в водоносные горизонты.",

    // Описание модулей
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

    // География клиентов
    geographyTitle: "География наших клиентов",
    geographyDescription:
      "Сегодня АНСДИМАТ используется более чем 700 практикующими специалистами по подземным водам, которые работают в горнодобывающей промышленности, ядерной промышленности, водоснабжении, строительстве и окружающей среде.",

    // Заказ
    orderTitle: "Форма заказа ANSDIMAT",
    fullName: "ФИО",
    organization: "Организация",
    phone: "Телефон",
    licenseType: "Тип лицензии",
    singleLicense: "Однопользовательская",
    multiLicense: "Многопользовательская",
    comment: "Комментарий",
    submit: "Отправить",
    orderSent: "Заказ отправлен",
    orderIntro:
      "Заявка откроется письмом в почтовом приложении. Звёздочкой отмечены поля, без которых мы не сможем ответить.",
    orderThanks:
      "Спасибо, %{name}! Письмо открыто в почтовом клиенте — отправьте его, и мы свяжемся с вами.",
    fieldRequired: "Заполните поле",
    emailInvalid: "Проверьте адрес почты",

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

    // PumpingTestProcessing - Заголовки разделов
    journalCreationWizard: "Мастер создания журнала",

    // PumpingTestProcessing - Заголовки шагов мастера
    observationJournalStep: "Журнал наблюдений",
    distancesBetweenWells: "Расстояния между скважинами",

    // PumpingTestProcessing - Экспорт
    availableExportFormats: "Доступные форматы экспорта",
    exportInformation: "Информация об экспорте",
    exportInfoText:
      "• JSON формат сохраняет полную структуру данных\n• CSV формат подходит для анализа в электронных таблицах\n• PDF отчеты содержат графики и детальный анализ\n• Все экспортированные файлы можно импортировать обратно",

    // PumpingTestProcessing - Детали журнала
    measurementCount: "Количество замеров",

    // PumpingTestProcessing - Расстояния
    distanceTo: "Расстояние до",

    // Project Management
    projectManagement: "Управление",
    createProject: "Создать проект",
    projectName: "Название проекта",
    projectNamePlaceholder: "Название проекта",
    activeProject: "Активный проект",
    selectProject: "Выберите проект",
    deleteProject: "Удалить проект",
    deleteProjectConfirm: "Удалить проект '{name}'?",
    projectDeleted: "Проект удален",
    journalProcessingDescription:
      "Модуль для анализа результатов откачных испытаний скважин. Создавайте проекты, ведите журналы наблюдений и получайте подробные отчёты.",
    projectCreated: "Проект создан",
    exportProject: "Экспорт проекта",
    favoriteProject: "В избранное",
    unfavoriteProject: "Убрать из избранного",
    addToFavorites: "Добавить в избранное",
    removeFromFavorites: "Удалить из избранного",
    allProjects: "Все проекты",
    recentProjects: "Последние проекты",
    aquiferTypeLabel: "Тип водоносного горизонта",
    // Wizard
    wizard: "Ввод",
    wizardTitle: "Мастер создания журнала откачки",
    step1: "Шаг 1: Тип теста",
    step2: "Шаг 2: Тип слоя",
    step3: "Шаг 3: Граничные условия",
    step4: "Шаг 4: Таблица данных",
    step5: "Шаг 5: Подтверждение",
    next: "Далее",
    finish: "Завершить",

    // Test Types
    testType: "Тип теста",
    pumpingTest: "Обработка откачек",
    slugTest: "Slug тест",
    packerTest: "Пакерный тест",

    // Layer Types
    layerType: "Тип слоя",
    leaky: "Полунапорный",

    // Boundary Conditions
    boundaryConditions: "Граничные условия",
    infinite: "Бесконечный пласт",
    constantHead: "Постоянный напор",
    noFlow: "Нет потока",

    // Data Table
    dataTable: "Таблица данных",
    addRow: "Добавить строку",
    deleteRow: "Удалить строку",
    rows: "строк",
    dataType: "Тип данных",
    data: "Данные",
    dataRows: "Количество строк",

    // Confirmation
    confirmation: "Подтверждение",
    journalCreated: "Журнал создан",
    journalSaved: "Журнал сохранен в проект",
    selectProjectFirst: "Сначала выберите проект",

    // Data Processing
    dataProcessing: "Обработка",
    processingTitle: "Обработка журнала",
    journalProcessing: "Создать журнал откачки",
    journalProcessingSubtitle:
      "Мастер создания нового журнала обработки откачки за 3 шага",
    journal: "Журнал",
    journalManagement: "Журналы",
    noProjects: "Нет проектов",
    createFirstProject: "Создайте первый проект с помощью мастера выше",
    journalDetails: "Детали журнала",
    editJournal: "Редактировать журнал",
    importJournal: "Импорт журнала",
    dataPreview: "Предварительный просмотр данных",
    journalWillBeAddedToActiveProject:
      "Журнал будет добавлен в активный проект",
    newProjectWillBeCreated:
      "Поскольку нет активного проекта, будет создан новый проект для этого журнала откачки.",
    firstStep:
      "На первом шаге выбирается предполагаемый тип водоносного горизонта (напорный, безнапорный).",
    secondStep:
      "Далее задается имя скважины (например, скв.1) и её расход. Расход можно задать в м³/сут.",
    results: "Результаты графоаналитического метода",
    slope: "Наклон прямой C",
    intercept: "Пересечение (b)",
    formula: "Формула: s = k·log₁₀(t) + b",
    deleteJournal: "Удалить журнал",
    noJournals: "Нет сохранённых журналов в проекте",
    function: "Функция",
    units: "Единицы измерения",
    distance: "Расстояние",
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
    notAnsdimatProject: "Файл не является проектом ANSDIMAT",
    projectIdExists: "Проект с таким ID уже существует",
    projectImported: "Проект успешно импортирован!",
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
    clusterMapFeature: "Карта куста в обработке ОФР",
    advancedAnalytics: "Расширенная аналитика",
    advancedFunctionality: "Расширенный функционал",
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
    saveWithYearly: "Выгоднее на год",
    yearlySavings: "Экономия %{amount} в год",
    subscriptionAutoRenew:
      "Подписка продлевается автоматически, если не отменить её не позднее чем за 24 часа до конца оплаченного периода.",
    trialPeriod: "Пробный период",
    daysFree: "дней бесплатно",
    premiumFeature: "Премиум функция",
    premiumFeatureInfiltration:
      "Инфильтрационные утечки доступны только для премиум пользователей",
    premiumFeaturePitInflow:
      "Приток в котлован доступен только для премиум пользователей",
    goToPremium: "Перейти на премиум",
    premiumOnly: "Только для премиум пользователей",
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
    mailClientError:
      "Почтовый клиент не открылся. Отправьте заявку вручную на адрес",
    mailSendError:
      "Не удалось открыть письмо. Отправьте заявку вручную на адрес",
    invalidJsonFile: "Файл не является валидным JSON",
    journalImportedSuccess: "Журнал успешно импортирован!",
    importFileError: "Ошибка при импорте файла",

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
    scale: "Масштаб",
    move: "Перемещение",
    dragging: "Перетаскивание",
    chartInstruction:
      "Используйте жесты для масштабирования и перемещения графика",

    // Дополнительные переводы для DataProcessing
    pumpingTestJournals: "Журналы откачек",
    chartType: "Тип графика",
    chart: "График",
    zoomIn: "Увеличить",
    zoomOut: "Уменьшить",
    reset: "Сброс",
    instructions: "Инструкция",

    // Единицы измерения для функций
    unitMinutes: "мин",
    unitMSecond: "м/с",
    unitCmSecond: "см/с",
    unitFootDay: "фут/сут",
    unitGalDayFt2: "гал/сут на фут²",
    unitDays: "сут",
    unitHours: "ч",
    unitFeet: "фут",
    unitLSec: "л/с",
    unitM3Hour: "м³/ч",
    unitGalMin: "гал/мин",
    unitFt3Day: "фут³/сут",
    unitFt2Day: "фут²/сут",
    unitGalDayFt: "гал/сут на фут",
    unitM2Sec: "м²/с",
    unitsSection: "Размерности",
    unitsHint:
      "Ввод и результаты показываются в выбранных единицах. Расчёт идёт в базовых, уже введённые данные не меняются.",
    quantityTime: "Время",
    quantityDistance: "Расстояние",
    quantityFlow: "Расход",
    quantityTransmissivity: "Проводимость (T)",
    quantityConductivity: "Коэффициент фильтрации (k)",
    // Без обозначения: в карточке результата его ставит сама карточка, и
    // «Коэффициент фильтрации (k) k» читалось бы как опечатка
    resultConductivity: "Коэффициент фильтрации",
    quantityDiffusivity: "Пьезопроводность (a)",
    quantityDrawdown: "Понижение (s)",
    unitFlowRate: "м³/сут",
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

    // Дополнительные переводы для PumpingTestProcessing
    wellNamePlaceholder: "Например: Скважина №1",
    journalCreationInfo:
      'После заполнения всех данных будет создан журнал откачки, который можно будет обрабатывать в разделе "Обработка данных".',
    selectDateTime: "Выбрать дату и время",
    noData: "Нет данных",
    testTypeLabel: "Тип испытания",
    layerTypeLabel: "Тип пласта",
    boundaryConditionsLabel: "Граничные условия",
    dataTypeLabel: "Тип данных",
    journalUpdated: "Журнал обновлен",
    deleteJournalConfirm: "Удалить журнал",
    cancel: "Отмена",
    delete: "Удалить",
    journalDeleted: "Журнал удален",
    exportError: "Не удалось экспортировать журнал",
    invalidFileFormat: "Неверный формат файла",
    notAnsdimatJournal: "Файл не является журналом Ansdimat",
    journalImported: "Журнал импортирован",
    importError: "Не удалось импортировать файл",
    selectProjectInManagement:
      'Выберите проект в разделе "Управление проектами"',
    noActiveProject: "Нет активного проекта",
    projectExported: "Проект экспортирован!",
    exportProjectError: "Не удалось экспортировать проект",
    premiumFeatureCSV: "Экспорт в CSV доступен только в премиум версии",
    getPremium: "Получить премиум",
    subscription: "Подписка",
    goToSubscription: "Переход к экрану подписки",
    noDataToExport: "Нет данных для экспорта",
    csvHeader: "Журнал,Дата создания,Тип испытания,Граничные условия",
    csvDataHeader: "Время,Понижение",
    journalsExportedCSV: "Журналы экспортированы в CSV!",
    exportJournalsError: "Не удалось экспортировать журналы",
    premiumFeaturePDF: "Экспорт анализа в PDF доступен только в премиум версии",
    inDevelopment: "В разработке",
    pdfExportInDevelopment:
      "Функция экспорта анализа в PDF находится в разработке и будет доступна в ближайших обновлениях.",
    understand: "Понятно",
    exportProjectJSON: "Экспорт проекта (JSON)",
    exportProjectJSONDesc:
      "Полный экспорт проекта со всеми журналами и данными",
    exportJournalsCSV: "Экспорт журналов (CSV)",
    exportJournalsCSVDesc:
      "Экспорт всех журналов в формате CSV для анализа в Excel",
    exportAnalysisPDF: "Экспорт анализа (PDF)",
    exportAnalysisPDFDesc: "Подробный отчет с графиками и результатами анализа",
    enterProjectName: "Введите название журнала",
    createProjectError: "Не удалось создать проект",
    projectNotFound: "Проект не найден",
    projectSelected: 'Проект "{name}" выбран',
    selectProjectError: "Ошибка при выборе проекта",
    cancelSubscriptionConfirm: "Вы уверены, что хотите отменить подписку?",
    cancelSubscriptionError: "Ошибка при отмене подписки",
    savePNGError: "Не удалось сохранить PNG",
    difficultyMedium: "Средний",
    difficultyHard: "Сложный",
    categoryBasics: "Основы",
    categorySetup: "Настройка",
    categoryCalculations: "Расчеты",
    categoryAnalysis: "Анализ",
    projectAlreadyExists: "Проект уже существует",
    projectAlreadyExistsDescription:
      "Проект '{name}' уже существует. Хотите заменить его?",
    replace: "Заменить",
    projectUpdated: "Проект обновлен",
    categoryExport: "Экспорт",
    categoryCharts: "Графики",
    lugeon: "Люжон",
    express: "Экспресс",
    injection: "Налив в зону аэрации",
    packer: "Пакерное опробование",
    categoryReports: "Отчеты",
    invalidJSONFormat: "Неверный формат файла JSON",
    invalidProjectFile: "Файл не является проектом Ansdimat",
    importProject: "Импорт проекта",
    aquiferType: "Тип водоносного горизонта",
    confined: "Напорный",
    unconfined: "Безнапорный",
    basicParameters: "Основные параметры",
    confinedAquifer: "Напорный",
    unconfinedAquifer: "Безнапорный",
    wellNameLabel: "Название скважины",
    flowRateLabel: "Расход",
    aquiferThicknessLabel: "Мощность водоносного горизонта (м)",
    project: "Проект",
    newProject: "Новый проект будет создан автоматически",
    observationWells: "Наблюдательные скважины",
    startDate: "Дата начала откачки",
    dateAndTimeSelection: "Выбор даты и времени",
    pumping: "Откачка",
    recovery: "Восстановление",
    addObservationWells: "Добавить наблюдательные скважины",
    measurement: "Замер",
    time: "Время",
    drawdown: "Понижение",
    pumpingJournalCreated: "Журнал откачки",
    inNewProject: "в новом проекте",
    successfully: "успешно",
    failedToSaveJournal: "Не удалось сохранить журнал",
    previous: "Предыдущий",
    createJournal: "Создать журнал",
    back: "Назад",
    observationJournal: "Журнал наблюдений",

    // ===== ВИДЫ ОФР СО СВОЕЙ СХЕМОЙ: ОБЩЕЕ =====
    ofrInputs: "Исходные данные",
    ofrResult: "Результат",
    conductivityLabel: "k, %{unit}",
    ofrMethodTitle: "Как считается",
    ofrChart: "График",

    // ===== ЭКСПРЕСС-ОПРОБОВАНИЕ (БАУЭР — РАЙС) =====
    slugTitle: "Экспресс-опробование",
    slugSubtitle: "Решение Бауэра — Райса",
    slugWellSection: "Скважина",
    slugFilterRadius: "Радиус фильтра r_w",
    slugCasingRadius: "Радиус обсадной трубы r_c",
    slugFilterLength: "Длина фильтра l_w",
    slugFilterMiddle: "От УГВ до середины фильтра LT_w",
    slugFilterBottom: "Низ фильтра z = LT_w + l_w/2",
    slugThickness: "Обводнённая мощность m",
    slugInitialDrawdown: "Скачок понижения s⁰",
    slugJournalTitle: "Замеры: время и восстановление уровня",
    slugJournalNote:
      "В журнал идёт не остаток скачка, а насколько уровень уже вернулся: значения растут от нуля, последний замер равен s⁰.",
    slugInfluenceRadius: "ln(R/r_w)",
    slugBeta: "β = l_w/r_w",
    slugSchemePartial: "Несовершенная скважина: радиус влияния по A₁ и A₂.",
    slugSchemeFull:
      "Фильтр достаёт до подошвы пласта: радиус влияния по A₃, как у совершенной скважины.",
    slugThicknessCapped:
      "Мощность велика: ln[(m−z)/r_w] взят равным 6 — верхнему пределу зависимости.",
    slugBetaClamped:
      "β вне графика Бауэра — Райса (1…2000): коэффициенты взяты на его границе.",
    slugMethod:
      "k = 2.3·r_c²/(2·l_w)·C·ln(R/r_w) — по наклону C прямой lg(s⁰/s) — t.",
    slugTwoSegments:
      "На графике два прямолинейных участка: расчёт идёт по второму, как велит книга — первый говорит о нарушенной зоне вокруг скважины или о перетекании. Отметьте точки руками, если нужен другой отрезок.",
    slugFirstSegmentK: "k по первому участку",
    slugLineNote:
      "Прямая должна выходить из начала координат. Если прямолинейных участков два, обрабатывают второй: первый говорит о нарушенной зоне вокруг скважины или о перетекании.",
    slugNeedInitialDrawdown:
      "Укажите скачок понижения s⁰ — от него отсчитывается возврат уровня.",
    slugNeedGeometry:
      "Проверьте геометрию скважины: радиус и длину фильтра и расстояние от УГВ до его середины.",
    slugNeedMeasurements:
      "Внесите хотя бы два замера, где уровень вернулся меньше чем на скачок s⁰.",

    // ===== ПОИНТЕРВАЛЬНЫЕ НАГНЕТАНИЯ (МЕТОД ЛЮЖОНА) =====
    lugeonTitle: "Поинтервальное нагнетание",
    lugeonSubtitle: "Метод Люжона: формулы Мойе и Тима",
    lugeonWellRadius: "Радиус скважины r_w",
    lugeonIntervalLength: "Длина интервала l_w",
    lugeonReadingInterval: "Между отсчётами",
    lugeonDensity: "Плотность жидкости",
    unitDensity: "кг/м³",
    lugeonStagesTitle: "Ступени",
    lugeonStage: "Ступень %{n}",
    lugeonPressure: "Давление ΔP",
    lugeonReadings: "Накопленные показания расходомера",
    lugeonReadingsHint:
      "Вносите нарастающий итог, а не прирост за промежуток: 120, 138, 157.",
    lugeonReadingsFalling:
      "Показания убывают: внесён прирост, а не нарастающий итог.",
    lugeonMeanFlow: "Средний расход",
    lugeonStageLu: "Lu",
    lugeonMeanK: "Среднее k",
    lugeonMeanLu: "Среднее Lu",
    lugeonAddStage: "Добавить ступень",
    lugeonRemoveStage: "Убрать ступень",
    lugeonChartTitle: "Расход — давление",
    lugeonBranchRise: "Подъём давления",
    lugeonBranchFall: "Спуск давления",
    lugeonPatternTitle: "Вид зависимости",
    lugeonPatternLaminar: "Ламинарный поток",
    lugeonPatternTurbulent: "Турбулентный поток",
    lugeonPatternDilation: "Расширение трещин",
    lugeonPatternWashout: "Размыв",
    lugeonPatternVoidFilling: "Заполнение трещин",
    lugeonPatternUnknown: "Не определён",
    lugeonHintLaminar:
      "Водопоглощение не зависит от давления — представительно среднее по ступеням.",
    lugeonHintTurbulent:
      "С ростом давления поглощение падает: поток в трещинах перестал быть ламинарным. Представительно значение при наименьшем давлении.",
    lugeonHintDilation:
      "На пике давления трещины упруго раскрылись и сомкнулись обратно. Представительно значение при наименьшем давлении.",
    lugeonHintWashout:
      "Поглощение растёт от ступени к ступени и обратно не возвращается: трещины промываются, опыт меняет породу.",
    lugeonHintVoidFilling:
      "Поглощение падает от ступени к ступени: трещины забиваются взвесью.",
    lugeonHintUnknown:
      "Вид зависимости определяется по пяти ступеням: три на подъёме давления и две на спуске.",
    lugeonRepresentative: "Представительное Lu",
    lugeonMethod:
      "k = Q·ρ·g/(2π·l_w·ΔP)·(1 + ln(l_w/2r_w)) — формула Мойе, g = 9.81 м/с².",
    lugeonLuMethod:
      "Lu = Q/l_w · P₀/ΔP при Q в л/мин и P₀ = 1 МПа. Единица Люжона — 1 л/мин на метр интервала при избыточном давлении 1 МПа.",
    lugeonScale:
      "Оценочно 1 Lu ≈ 0.011 м/сут. В высокопроницаемых трещиноватых породах точность метода падает.",
    lugeonStagePlan:
      "Стандартная схема: пять ступеней с давлениями 0.5·Pmax, 0.75·Pmax, Pmax, 0.75·Pmax, 0.5·Pmax по 10 минут каждая, расход замеряется ежеминутно.",

    // --- Способ расчёта коэффициента фильтрации ---
    lugeonFormula: "Формула",
    lugeonFormulaMoye: "Мойе",
    lugeonFormulaThiem: "Тим",
    lugeonThiemMethod:
      "k = Q/(2π·l_w·Δh)·ln(R/r_w), где Δh = ΔP/(ρ·g), а радиус влияния R принят равным длине интервала. Обе формулы дают близкие результаты.",

    // --- Классификация пород по величине Люжона (табл. 13.5) ---
    lugeonRockClass: "Порода",
    lugeonPermeabilityTitle: "Проницаемость",
    lugeonRockVeryLow: "Весьма слаботрещиноватые",
    lugeonRockLow: "Слаботрещиноватые",
    lugeonRockModerate: "Трещиноватые",
    lugeonRockMedium: "Весьма сильнотрещиноватые",
    lugeonRockHigh: "Сильнотрещиноватые",
    lugeonRockVeryHigh: "Полости и каверны",
    lugeonPermeabilityVeryLow: "Очень низкая",
    lugeonPermeabilityLow: "Низкая",
    lugeonPermeabilityModerate: "Умеренная",
    lugeonPermeabilityMedium: "Средняя",
    lugeonPermeabilityHigh: "Высокая",
    lugeonPermeabilityVeryHigh: "Очень высокая",
    lugeonLuChart: "Люжон по ступеням",
    lugeonNeedStages:
      "Задайте давление ступени и хотя бы два показания расходомера.",
    lugeonNeedGeometry:
      "Укажите длину интервала опробования и радиус скважины.",

    // ===== НАЛИВ В ШУРФ В ЗОНУ АЭРАЦИИ =====
    vadoseTitle: "Налив в шурф",
    vadoseSubtitle: "Зона аэрации: Болдырев и Биндеман",
    vadosePitSection: "Шурф",
    vadoseVolume: "Налитый объём ΔV",
    vadoseInterval: "Интервал времени Δt",
    vadoseFlow: "Расход Q",
    vadoseFlowComputed: "Из объёма и интервала",
    vadoseFlowManual: "Задан вручную",
    vadoseArea: "Площадь инфильтрации F",
    vadoseHead: "Слой воды в шурфе H",
    vadoseDepth: "Глубина просачивания z",
    vadoseCapillary: "Капиллярное поднятие h_c",
    vadoseCapillarySection: "Капиллярные силы",
    vadoseUseCapillary: "Учитывать капиллярные силы",
    vadoseNoCapillary: "Не учитывать",
    vadoseLithology: "Порода",
    vadoseLithologyPick: "Выбрать породу",
    vadoseLithologyHint:
      "Половина максимального поднятия по справочнику; замеренную лучше вписать руками.",
    vadoseMethod: "Биндеман: k = Q·z / (F·(H + H_c + z)), Q = ΔV/Δt.",
    vadoseMethodBoldyrev: "Болдырев: k = Q/F = ΔV/(F·Δt).",
    vadoseMethodName: "Метод",
    vadoseMethodBoldyrevName: "Болдырев",
    vadoseMethodBindemanName: "Биндеман",
    vadoseAreaNote: "Для метода Нестерова — площадь внутреннего кольца.",
    vadoseCapillaryNote:
      "Без капиллярных сил результат завышен: вся движущая сила приписана гравитации.",
    vadoseHeadNote: "По методу слой воды в шурфе держат около 10 см.",
    vadoseNeedDepth:
      "Укажите глубину зоны просачивания z на конец опыта — без неё расчёт невозможен.",
    vadoseNeedFlow:
      "Задайте расход или налитый объём вместе с интервалом времени.",
    vadoseNeedArea: "Укажите площадь шурфа.",

    // --- Максимальное капиллярное поднятие ---
    capillaryGravel: "Гравий, галечник",
    capillaryCoarseSand: "Песок крупнозернистый",
    capillaryMediumSand: "Песок среднезернистый",
    capillaryFineSand: "Песок мелкозернистый",
    capillarySiltySand: "Песок пылеватый",
    capillarySandyLoam: "Супесь",
    capillaryLoam: "Суглинок",
    capillaryClay: "Глина",
  },
  en: {
    // Защита авторских прав
    copyright: "© ANSDIMAT. All rights reserved. 1993 – 2025",
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
    util3: "Calculator",
    toggleLang: "Switch Language",
    homeTitle: "ANSDIMAT",

    // ===== SPLASH SCREEN =====
    appSubtitle: "hydrogeologist's field calculator",

    selectOfrType: "Select test type",
    pumpingWellName: "Pumping well",
    observationWellName: "Observation well",
    clusterWellsHint:
      "The cluster starts with this pair. Observation wells can be added later; a test has exactly one pumping well.",
    enterWellName: "Enter the well name",
    wellsSection: "Wells",
    deleteWellTitle: "Delete the well?",
    deleteWellMessage: "Its measurements will be deleted along with it.",
    wellJournal: "Well measurements log",
    dragWellsHint: "Drag the wells — distances are recalculated",
    wellsAtMyLocation: "Move the cluster to my location",
    addTableRow: "Add row",
    newJournal: "New log",
    fillAndProcess: "Fill in and process the test",
    previouslyCreated: "Previously created",

    // ===== PUMPING TEST PROCESSING =====
    flowRateQ: "Discharge Q",
    measurementsJournal: "Measurements log",
    measurementsShort: "measurements",
    drawdownChart: "Drawdown chart",
    recoveryChart: "Recovery chart",
    phasePumping: "Pumping",
    phaseRecovery: "Recovery",
    pumpingDuration: "Pumping lasted",
    finalDrawdown: "Drawdown at pump stop",
    recoveryComplete:
      "The level has recovered: residual drawdown is %{percent} % of the drawdown at pump stop.",
    recoveryIncomplete:
      "The level has not fully recovered: %{percent} % of the drawdown remains. A test is considered finished at 5 %.",
    journalPumping: "Measurements log: pumping",
    journalRecovery: "Measurements log: recovery",

    // Sharing tests through an .ansdimat file
    share: "Share",
    shareAsFile: "Project file (.ansdimat)",
    shareAsText: "Measurements table (text)",
    importFromFile: "Import",
    importTitle: "Import a test",
    importAction: "Import",
    importReading: "Reading the file…",
    importExportedAt: "Exported",
    importPumpingRows: "Pumping readings",
    importRecoveryRows: "Recovery readings",
    wells: "Wells",
    close: "Close",
    importExistsTitle: "This test is already here",
    importExistsHint:
      "The test “%{name}” has already been imported from this file. Replace it or add a copy?",
    importReplace: "Replace the existing one",
    importCopy: "Add a copy",
    importOpenExisting: "Open the existing one",
    importFailed: "Could not open the file",
    importErrorNotAnsdimat: "This is not an ANSDIMAT project file.",
    importErrorTooNew:
      "The file was created by a newer version of the app. Please update ANSDIMAT.",
    importErrorCorrupted:
      "The file was damaged in transit. Ask the sender to share it again.",
    importErrorInvalid: "The file is damaged or incomplete.",
    importErrorReadFailed: "Could not read the file.",

    recoveryJournalHint:
      "Time runs from the pump stop. Zero recovery matches the drawdown at that moment.",
    recoveryNotCharted:
      "Recovery readings are not plotted: the line and transmissivity come from the pumping data.",
    durationFromJournal: "Taken from the last pumping reading",
    recoveryAxisHint:
      "The X axis shows t/t′: time since pumping started over time since it stopped",
    pickSeriesHint: "Tap a curve name in the legend — the line moves onto it",
    recoveryEmptyTitle: "The recovery journal is empty",
    recoveryEmptyHint:
      "Add readings taken after the pump stopped — the Theis line is built from them.",
    recoveryNoStopTitle: "Drawdown at pump-off is not set",
    recoveryNoStopHint:
      "Residual drawdown is measured from it. Fill in this well's pumping journal up to the moment the pump stopped, or type the drawdown in the field above.",
    recoveryOvershootTitle: "The journal does not match the drawdown at pump-off",
    recoveryOvershootHint:
      "Every row shows a water level rise larger than the drawdown at pump-off, so nothing is left over. Check that the recovery journal holds the rise measured from the moment the pump stopped, and that the drawdown at pump-off belongs to this same well.",
    fitBySeries: "Line fitted to the “%{well}” curve",
    recoveryNeedDuration:
      "Enter the pumping duration and add measurements taken after the pump stopped — otherwise recovery cannot be processed.",
    recoveryInterceptNote:
      "The line does not pass through the origin: aquifer boundaries or a variable discharge rate may be at play.",
    chartEmpty: "Add measurements to build the chart",
    ofr_single: "Single well",
    ofr_cluster: "Cluster",
    ofr_slug: "Slug test",
    ofr_lugeon: "Packer (Lugeon) test",
    ofr_vadose: "Pit infiltration",
    // Legacy types: no new journals of this kind are created, but the ones
    // created earlier must still show a name rather than a raw key
    ofr_fill: "Infiltration",
    ofr_recovery: "Recovery",

    // ===== TEST PROCESSING: CALCULATION CAPTIONS =====
    transmissivityLabel: "T, %{unit}",
    methodRecovery:
      "T = 0.183·Q / a (Theis recovery), a — slope of the s′ — lg(t/t′) line.",
    methodCooperJacob: "T = 0.183·Q / Δs (Cooper — Jacob).",
    methodAreaTracking:
      "Distance drawdown: T = 0.366·Q / C from a snapshot at a shared moment.",
    methodCombinedTracking:
      "Combined drawdown: T = 0.183·Q / C from readings across the whole cluster.",
    methodTwoPoints: "The line is drawn through the two selected points.",
    methodFreeLine: "The line is drawn freely, through two placed points.",
    methodFitQuality: "Goodness of fit R² = %{r2}",
    diffusivityLabel: "Diffusivity a, %{unit}",
    momentLabel: "Moment in time",
    methodNeedLogAxis: "Switch the X axis to lg t to compute T.",

    // ===== EXAMPLES & VIDEOS (redesign) =====
    filterAll: "All",
    filterPumping: "Test processing",
    filterDewatering: "Dewatering",
    filterModeling: "Modeling",
    videoLessons: "Video tutorials",
    studyMaterials: "Materials",
    open: "Open",

    // ===== ABOUT (redesign) =====
    aboutManual: "User manual",
    aboutVideos: "Video tutorials",
    aboutContact: "Contact us",
    aboutLocalData:
      "© ANSDIMAT. Calculations run on the device and work offline.",
    orderLicense: "Order a licence",
    versionLabel: "version",

    // ===== USER MANUAL =====
    manualEyebrow: "How to use",
    manualStartTitle: "Getting started",
    manualStartIntro:
      "ANSDIMAT is a field tool for hydrogeologists: a pumping-test journal, measurement processing and aquifer parameter calculations. Everything is computed on the device and stored locally; the internet is only needed to sign in and sync.",
    manualStartStep1:
      "Tap “Create pumping test” — pick the test type and name the project.",
    manualStartStep2:
      "Fill in the test data: discharge rate, well radius, aquifer thickness.",
    manualStartStep3: "Record time–drawdown measurements as the test runs.",
    manualStartStep4:
      "Open processing: the plot is built automatically and parameters update live.",
    manualJournalTitle: "Pumping-test journal",
    manualJournalIntro:
      "A journal holds the whole test: well data, test conditions and the measurement table. Journals are not deleted by accident — deletion always asks for confirmation, and the measurements go with the journal.",
    manualJournalStep1:
      "The pencil returns you to data entry and measurement editing.",
    manualJournalStep2:
      "The chart icon opens processing and parameter calculation.",
    manualJournalStep3:
      "The star marks a journal as important and moves it to the top of the list.",
    manualJournalStep4:
      "The arrow exports the journal together with its measurements.",
    manualJournalNote:
      "Measurement time is counted from the start of pumping. Drawdown is the difference between the static and dynamic water level and is always positive.",
    manualProcessingTitle: "Test processing",
    manualProcessingIntro:
      "Processing uses the Cooper–Jacob method: measurements are plotted in semi-log coordinates (lg t vs drawdown), and aquifer parameters are derived from the straight-line segment.",
    manualFormulaT:
      "T — transmissivity, m²/day; Q — discharge rate, m³/day; a — slope of the line, m per log cycle.",
    manualFormulaK:
      "k — hydraulic conductivity, m/day; m — aquifer thickness, m.",
    manualProcessingStep1:
      "By default the line is fitted by least squares over all measurements.",
    manualProcessingStep2:
      "To cut off the early and late segments, switch to the two-point fit and mark the points — in the measurement table or directly on the plot.",
    manualProcessingStep3:
      "Pinch with two fingers or use “+” and “−” to zoom, drag with one finger to pan; the axes stay in place.",
    manualProcessingStep4:
      "“Fit” restores the original scale covering all measurements.",
    manualProcessingNote:
      "Early measurements are distorted by wellbore storage, late ones by aquifer boundaries. The straight-line segment usually lies between them — that is what the two points should bracket.",
    manualCalculatorTitle: "Calculator",
    manualCalculatorIntro:
      "Four tabs for quick calculations when there is no full journal — a few values from the field notebook are enough.",
    manualCalcFiltration:
      "Convert hydraulic conductivity between units: m/day, m/h, m/s, cm/s, ft/day, Meinzer units.",
    manualCalcParams:
      "Hydraulic conductivity from a single-well test — Dupuit formulas for confined and unconfined aquifers, with the Kozeny partial-penetration correction.",
    manualCalcForecast:
      "Drawdown at a given distance and time from the Theis equation via the well function W(u).",
    manualCalcPit:
      "Inflow into an excavation pit: the contour is replaced by a “big well” of equivalent radius.",
    manualCalcBarrage:
      "Aquifer with a boundary: an impermeable contact deepens the cone of depression, a river flattens it. Plus head build-up upstream of a cutoff wall.",
    manualCalcLeakage:
      "Leaky aquifer: drawdown after Hantush–Jacob, the leakage factor B and the leakage rate through the aquitard.",
    manualRecoveryTitle: "Level recovery",
    manualRecoveryIntro:
      "The second half of the test: the pump is off and the level rises. Processing it pays off — with the pump stopped, discharge fluctuations no longer spoil the data.",
    manualFormulaRecovery:
      "s′ — residual drawdown, m; t — time since pumping started; t′ — time since the pump stopped.",
    manualRecoveryStep1: "In processing, switch to “Recovery”.",
    manualRecoveryStep2:
      "Enter how long pumping lasted: t′ is counted from that moment.",
    manualRecoveryStep3:
      "Measurements are entered the same way — time from the start and residual drawdown.",
    manualRecoveryNote:
      "The recovery line must pass through the origin. A noticeable offset points to aquifer boundaries or a variable discharge rate during pumping; the app warns about it.",
    manualCalculatorNote:
      "The radius of influence R is rarely measured — it is taken from experience. Leave the field empty and R = 300·r₀ is used, with a warning that the result is an estimate.",
    manualDiaryTitle: "Field diary",
    manualDiaryStep1:
      "Enter the point name, describe it and pick its type: well, spring, pit or observation.",
    manualDiaryStep2:
      "Tap the map where you need it — the point is placed at the tapped coordinates.",
    manualDiaryStep3:
      "“Mark my location” places a point at the device coordinates; the circle on the map only centres the map on you.",
    manualDiaryStep4:
      "The description can be edited later, right in the list under the point. What you write is saved on its own — there is no separate button.",
    manualDiaryNote:
      "Map tiles come from the internet, but points you have already marked and their coordinates are stored on the device and available offline.",
    manualAccountTitle: "Account and sync",
    manualAccountIntro:
      "The app works fully without an account: journals, measurements and points live in the device storage. An account lets the same data open on another phone or tablet.",
    manualGlossaryTitle: "Notation",
    manualTermQ: "Well discharge rate, m³/day",
    manualTermS: "Water level drawdown, m",
    manualTermT: "Transmissivity, m²/day",
    manualTermK: "Hydraulic conductivity, m/day",
    manualTermM: "Aquifer thickness, m",
    manualTermA: "Slope of the line, m per log cycle",
    manualTermR0: "Well radius, m",
    manualTermR: "Radius of influence, m",
    manualTermW: "Theis well function, dimensionless",

    // ===== DRAWDOWN CHART =====
    fitAuto: "All points",
    fitFreedom: "Free line",
    selectSecondPoint: "Mark a second point — for now the line runs through all readings",
    freedomHint: "Drag the points — the line runs through them. Axis strips stretch their axis",
    addMeasurementsForChart: "Add measurements to build the chart",
    chartEmptyTitle: "Two measurements build the chart",
    chartEmptyHint:
      "Enter time and drawdown in the table above — the line and T appear at once.",
    stepX: "Grid step X",

    // ===== FLOW REGIME DIAGNOSIS =====
    chartExpand: "Expand the chart to full screen",
    chartCollapse: "Collapse the chart",
    viewFit: "Straight line",
    viewDiagnostic: "Diagnosis",
    diagnosticChart: "Flow regime diagnosis",
    legendDerivative: "derivative ds/d(ln t)",
    diagnosticAxes: "t, min · vertical axis — metres",
    legendDrawdown: "drawdown s",
    diagnosticEmptyTitle: "Diagnosis needs at least five readings",
    diagnosticEmptyHint:
      "Spaced out in time — 1, 2, 5, 10, 30 minutes. An evenly spaced series hides the shape of the curve.",
    timeFromPumpStart: "t from pumping start, %{unit}",
    timeFromPumpStop: "t′ from pump stop, %{unit}",
    columnTime: "t, %{unit}",
    columnDrawdown: "s, %{unit}",
    columnRecovery: "recovery, %{unit}",
    recoveryNoDuration:
      "Enter how long the pumping lasted — recovery cannot be plotted without it.",
    recoveryTimeTooSmall:
      "Reading times are shorter than the pumping duration. In a recovery journal time is counted from the start of pumping, not from the pump stop.",
    needLogMode:
      "Switch the X axis to lg t — T is not computed on the other axes.",
    needTwoMeasurements:
      "Enter at least two readings: one point does not make a line.",
    needTwoSelected: "Mark two points on the chart to draw the line through.",
    needFlowRate:
      "Enter the discharge Q — transmissivity cannot be computed without it.",
    needSlope:
      "Drawdown does not grow with time: the slope is zero and T is undefined.",
    areaEmptyTitle: "The distance-drawdown plot is built across the cluster",
    combinedEmptyTitle: "The combined plot needs distances",
    needTwoDistances:
      "Enter distances to at least two wells: the distance-drawdown plot is built across the cluster.",
    needCommonMoment:
      "No moment in time was recorded in at least two wells. The distance-drawdown plot is built from simultaneous readings.",
    needDistances:
      "Enter distances to the wells — the combined plot cannot be built without them.",
    needWellDistance:
      "Enter the distance to this well — diffusivity and storativity cannot be obtained without it.",
    singleNoDistance:
      "Diffusivity and storativity require the distance to an observation well, which a single-well test does not have.",
    recoveryNoDiffusivity:
      "The Theis recovery line yields transmissivity only: distance does not enter it.",
    plateauEstimate: "T from the derivative plateau",
    unitTransmissivity: "m²/day",
    plateauMismatch:
      "This estimate differs from the straight-line result by more than a quarter — the line is most likely drawn outside the radial flow segment.",
    regimeRadial: "Radial flow",
    regimeRadialSign: "The derivative has reached a plateau and holds it.",
    regimeRadialAdvice:
      "The aquifer behaves as unbounded — Cooper — Jacob applies, and the line may be drawn through all late points.",
    regimeBarrier: "No-flow boundary",
    regimeBarrierSign: "The derivative plateau has risen %{ratio}-fold.",
    regimeBarrierAdvice:
      "Drawdown has reached the edge of the aquifer. Compute T from the early segment: late points halve it. The Barrage tab estimates the distance to the boundary.",
    regimeRecharge: "Aquifer is being recharged",
    regimeRechargeSign: "The derivative is falling — drawdown stops growing.",
    regimeRechargeAdvice:
      "Water enters the aquifer: leakage through the aquitard or a nearby water body. Late points overestimate T — use the segment before the bend, and assess leakage in the Leakage tab.",
    regimeWellbore: "Wellbore storage dominates",
    regimeWellboreSign:
      "The derivative rises at 45° across most of the record.",
    regimeWellboreAdvice:
      "The well is still emptying itself and the aquifer has not responded. These readings cannot be interpreted — keep pumping.",
    regimeUnclear: "Regime undetermined",
    regimeUnclearSign: "Too few readings, or they scatter.",
    regimeUnclearAdvice:
      "At least five readings are needed, spaced several times apart: 1, 2, 5, 10, 30 minutes.",

    // ===== CONE OF DEPRESSION =====
    coneSection: "Cone of depression",
    coneStaticLevel: "static water level",
    coneAxis: "distance from the well, m",
    coneEmpty:
      "Fill in discharge, transmissivity, storativity and time — the section appears at once.",
    coneInfluence:
      "Radius of influence ≈ %{radius} m — beyond it drawdown is negligible.",

    // ===== JOURNAL LIST =====
    measurementsCount: "%{count} readings",
    noMeasurements: "no readings",
    createFailed: "Could not create the journal. Please try again.",

    // ===== ACCOUNT =====
    accountSection: "Account",
    accountTitle: "Account",
    signIn: "Sign in",
    signUp: "Sign up",
    signOut: "Sign out",
    signInToSync: "Sign in",
    syncAcrossDevices: "Sync across devices",
    password: "Password",
    authFillFields: "Enter email and password",
    authInvalidCredentials: "Wrong email or password",
    authEmailNotConfirmed:
      "Email is not confirmed. Open the link from the letter — or turn off email confirmation in your Supabase project settings.",
    authEmailTaken: "This email is already registered",
    authWeakPassword: "Password is shorter than 6 characters",
    authBadEmail: "Check the email address",
    authNetwork: "No connection to the server",
    authCheckEmail: "Confirm your address via the emailed link, then sign in",
    accountPurpose:
      "An account keeps your journals and points on all your devices. Without signing in the app works locally.",
    syncNotConfigured: "Sync is not configured",
    syncNotConfiguredHint:
      "Sync is not configured: server keys are missing. The app works locally.",

    // ===== SETTINGS (redesign) =====
    appearance: "Appearance",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    appLanguage: "Interface language",
    basicVersion: "Basic version",
    premiumPitch: "Upgrade to Premium: cluster map, inflow, cutoff",
    dataAndCalc: "Data & calculations",
    settingTablet: "Tablet layout",
    settingAutoLocation: "Auto-detect coordinates",
    settingTabularNums: "Monospace numbers",
    aboutApp: "About the app",

    // ===== HOME (redesign) =====
    mainScenario: "Main scenario",
    createPumping: "Create pumping test",
    createPumpingSub: "Journal and OFR processing",
    desktopBanner: "Full Windows version — calculations on desktop",
    desktopBannerTitle: "Windows version",
    desktopBannerSub: "Full calculations on desktop",

    // ===== COMMON ACTIONS =====
    add: "Add",
    confirm: "Confirm",
    total: "Total",

    // ===== CALCULATOR: tabs and fields =====
    tabFiltration: "Convert k",
    tabParams: "Parameters",
    tabForecast: "Drawdown s",
    tabPit: "Pit",
    // ===== WELLHEAD PROTECTION AREA =====
    tabWhpa: "WHPA",
    whpaMethodGroup: "Belt calculation method",
    whpaMethodAnalyticalShort: "Analytical",
    whpaMethodVolumeShort: "Volumetric",
    whpaMethodAnalytical: "Isochrone in ambient flow · VNII VODGEO, 1983",
    whpaMethodVolume: "Circle by abstracted volume · flow ignored",
    whpaIntakeGroup: "Abstraction",
    whpaFlowRate: "Well discharge",
    whpaAquiferGroup: "Aquifer",
    whpaConductivity: "Hydraulic conductivity",
    whpaThickness: "Aquifer thickness",
    whpaPorosity: "Effective porosity",
    whpaLithologyNote: "Domenico & Schwartz reference: fills in typical k and n.",
    whpaFlowGroup: "Ambient flow",
    whpaGradient: "Hydraulic gradient",
    whpaAzimuth: "Flow azimuth",
    whpaAzimuthHint: "0° is north",
    whpaBeltsGroup: "Protection belts",
    whpaFirstBelt: "Belt I radius",
    whpaTimeBacterial: "Belt II travel time",
    whpaTimeBacterialHint: "SanPiN: 100 / 200 / 400",
    whpaTimeChemical: "Belt III travel time",
    whpaTimeChemicalHint: "25 years = 9125",
    whpaResultTitle: "Belt III, upstream",
    whpaDownstream: "Downstream",
    whpaAcross: "Width across",
    whpaSizesGroup: "Belt sizes",
    whpaBeltColumn: "Belt",
    whpaSizesNote: "R is upstream, r is downstream, 2d is the width across the flow.",
    whpaBelt_firstShort: "I, strict",
    whpaBelt_bacterialShort: "II, bacterial",
    whpaBelt_chemicalShort: "III, chemical",
    whpaDetailsGroup: "Details",
    whpaStatQ: "Ambient unit discharge q",
    whpaStatStagnation: "Stagnation point x_L",
    whpaStatTauBacterial: "Dimensionless time τ (II)",
    whpaStatTauChemical: "Dimensionless time τ (III)",
    whpaStatWidthLimit: "Capture zone width limit",
    whpaSource: "SanPiN 2.1.4.1110-02; VNII VODGEO solution, 1983. Preliminary estimate.",
    whpaPlanEmpty: "Enter the data — the plan will be drawn",
    whpaFlow: "flow",
    whpaNorth: "N",
    whpaWarn_beltInsideFirst: "Belt III does not extend beyond belt I: check the discharge and the thickness.",
    whpaWarn_bacterialOverChemical: "Belt II is wider than belt III — check the travel times.",
    whpaWarn_captureLimit: "The belt has reached the capture width limit Q/q: more time will not widen it.",
    whpaError_Q: "Enter the well discharge.",
    whpaError_k: "Enter the hydraulic conductivity.",
    whpaError_m: "Enter the aquifer thickness.",
    whpaError_n: "Enter the effective porosity.",
    whpaError_n_gt_1: "Effective porosity must be below one.",
    whpaError_I: "Enter the hydraulic gradient: the analytical method needs it. For still water pick the volumetric method.",
    whpaError_tBacterial: "Enter the belt II travel time.",
    whpaError_tChemical: "Enter the belt III travel time.",
    whpaError_firstBeltRadius: "Enter the belt I radius.",
    whpaLatitude: "Latitude",
    whpaLongitude: "Longitude",
    whpaCoordsHint: "WGS-84",
    whpaPlanGroup: "Belt plan on the map",
    whpaPlanNoCoords: "Without wellhead coordinates the belts are shown schematically",
    whpaMapHint: "Tap the map or drag the marker to place the well.",
    whpaAtMyLocation: "Place the well at my location",
    whpaWellTitle: "Well",
    whpaTurningGroup: "Turning points",
    whpaTurningNote: "WGS-84 coordinates for setting the boundary out on the ground.",
    whpaTurningNo: "No.",
    whpaTurningLat: "Latitude",
    whpaTurningLon: "Longitude",
    whpaStatArea: "Belt III area",
    whpaPercGroup: "Aquifer protection",
    whpaPercLead: "Contamination travels down from the surface: percolation time is summed over the covering layers.",
    whpaRecharge: "Infiltration recharge",
    whpaRechargeHint: "typically 0.0001–0.001",
    whpaLayersGroup: "Vadose zone section",
    whpaLayerK: "k′",
    whpaLayerM: "m′",
    whpaLayerN: "n′",
    whpaLayerT0: "t₀, d",
    whpaAddLayer: "Add layer",
    whpaRemoveLayer: "Remove layer",
    whpaPercResultTitle: "Percolation time",
    whpaPercFormula: "k′ ≥ w:  t₀ = n′ m′ / ∛(k′ w²)\nk′ < w:  t₀ = n′ m′ / k′",
    whpaPercProtected: "The aquifer may be taken as protected: t₀ ≥ 400 days.",
    whpaPercUnprotected: "The aquifer may not be taken as protected: t₀ < 400 days.",
    whpaPercSource: "VNII VODGEO, 1983 · Averyanov formula.",
    whpaLayerSaturated: "saturated",
    whpaLithoGravel: "Gravel",
    whpaLithoCoarseSand: "Coarse sand",
    whpaLithoMediumSand: "Medium sand",
    whpaLithoFineSand: "Fine sand",
    whpaLithoLoess: "Silt, loess",
    whpaLithoTill: "Glacial till",
    whpaLithoClay: "Clay",
    whpaLithoMarineClay: "Marine clay",
    whpaLithoKarst: "Karst limestone",
    whpaLithoLimestone: "Limestone, dolomite",
    whpaLithoSandstone: "Sandstone",
    whpaLithoSiltstone: "Siltstone",
    whpaLithoShale: "Shale",

    // --- Pit inflow: full tab ---
    pitSchemeGroup: "Calculation scheme",
    pitSchemeUnconfined: "Unconfined",
    pitSchemeUnconfinedRiver: "Unconfined + river",
    pitSchemeConfined: "Confined",
    pitSchemeConfinedRiver: "Confined + river",
    pitMethodUnconfined: "Unconfined unbounded · Dupuit",
    pitMethodUnconfinedRiver: "Unconfined near river · Dupuit",
    pitMethodConfined: "Confined unbounded · Dupuit–Thiem",
    pitMethodConfinedRiver: "Confined near river · Dupuit–Thiem",
    pitResultTitle: "Inflow into the pit",
    pitGeometryGroup: "Geometry",
    pitGeomArea: "Area F",
    pitGeomRect: "Rectangle L × B",
    pitGeomRadius: "Equivalent radius r₀",
    pitR0Area: "By equal area",
    pitR0Forchheimer: "By Forchheimer",
    pitArea: "Excavation area",
    pitLength: "Length",
    pitWidth: "Width",
    pitReducedRadius: "Equivalent radius",
    pitAquiferGroup: "Aquifer",
    pitConductivity: "Hydraulic conductivity",
    pitThicknessConfined: "Aquifer thickness",
    pitThicknessUnconfined: "Initial thickness",
    pitDrawdown: "Drawdown in the pit",
    pitBoundaryGroup: "Radius of influence",
    pitRFromWall: "R = r₀ + √(π a t)",
    pitRManual: "Set R manually",
    pitR_verigin: "Verigin",
    pitR_kusakin: "Kusakin",
    pitR_sichardt: "Sichardt",
    pitR_weber: "Weber",
    pitRiverDistance: "Distance to river",
    pitRiverHint: "R = 2L",
    pitManualR: "Radius of influence",
    pitTime: "Dewatering time",
    pitDiffusivity: "Diffusivity",
    pitDiffusivityHint: "else k·h / μ",
    pitStorage: "Specific yield",
    pitFactor: "Safety factor",
    pitFactorHint: "usually 1.2–1.5",
    pitExamplesGroup: "Examples",
    pitExample_confined_unlimited: "Confined",
    pitExample_confined_river: "Confined + river",
    pitExample_unconfined_unlimited: "Unconfined",
    pitExample_unconfined_river: "Unconfined + river",
    pitStatsGroup: "Details",
    pitStatR0: "Equivalent radius r₀",
    pitStatR: "Radius of influence R",
    pitStatRatio: "R / r₀",
    pitStatLn: "ln(R / r₀)",
    pitStatT: "Transmissivity T",
    pitStatQHour: "Inflow, m³/h",
    pitStatQSec: "Inflow, l/s",
    pitStatDesign: "Design inflow with safety factor",
    pitSectionGroup: "Excavation section",
    pitChartGroup: "Chart",
    pitCompareGroup: "R methods",
    pitCompareNote: "No rigorous solution for the radius of influence — schools differ several-fold.",
    pitWarn_R_close: "Radius of influence is under two equivalent radii — the Dupuit formula is unreliable on such a contour.",
    pitWarn_t_small: "Dewatering time is under 10 days: the steady-state formula overestimates inflow.",
    pitWarn_k_high: "Hydraulic conductivity above 100 m/day — check the units.",
    pitWarn_k_low: "Hydraulic conductivity below 0.01 m/day — inflow will be negligible.",
    pitWarn_S_large: "Drawdown exceeds twenty aquifer thicknesses — check the input.",
    pitWarn_elongated: "The pit is over four times as long as it is wide: Forchheimer is more accurate than equal area.",
    pitError_k: "Enter the hydraulic conductivity.",
    pitError_m: "Enter the aquifer thickness.",
    pitError_h0: "Enter the initial saturated thickness.",
    pitError_S: "Enter the drawdown in the pit.",
    pitError_r0: "Enter the equivalent radius.",
    pitError_F: "Enter the excavation area.",
    pitError_rect: "Enter the length and width of the excavation.",
    pitError_L: "Enter the distance to the river.",
    pitError_L_le_r0: "The river is closer than the pit wall — check the distance.",
    pitError_t: "Enter the dewatering time.",
    pitError_a: "Enter the diffusivity or the specific yield.",
    pitError_mu: "Enter the specific yield.",
    pitError_Rmanual: "Enter the radius of influence.",
    pitError_R_le_r0: "Radius of influence does not exceed the equivalent radius — inflow is undefined.",
    pitError_S_gt_h0: "Drawdown exceeds the initial thickness: the aquifer drains completely.",

    // --- Well drawdown: full tab ---
    wellSchemeGroup: "Calculation scheme",
    wellSchemeTheis: "Confined",
    wellSchemeHantush: "Leaky",
    wellSchemeBoulton: "Unconfined",
    wellSchemeBoundary: "Recharge boundary",
    wellMethodTheis: "Confined non-leaky · Theis",
    wellMethodHantush: "Leaky aquifer · Hantush–Jacob",
    wellMethodBoulton: "Unconfined aquifer · Boulton",
    wellMethodBoundary: "Semi-infinite · recharge boundary",
    wellResultTitle: "Drawdown in pumped well",
    wellResultObs: "In observation well",
    wellTransmissivityHint: "T = k·m",
    wellPumpingGroup: "Pumping",
    wellFlow: "Well discharge",
    wellTime: "Pumping duration",
    wellYearsHint: "%{years} years",
    wellRadius: "Pumped well radius",
    wellDistance: "To observation well",
    wellBoundaryGroup: "Recharge boundary",
    wellToRiver: "Pumped well to river",
    wellObsToRiver: "Observation to river",
    wellAquiferGroup: "Aquifer",
    wellLithologyNote: "Fills in k, Sy and elastic storage from the ANSDIMAT reference.",
    wellConductivity: "Hydraulic conductivity",
    wellThickness: "Aquifer thickness",
    wellSaturated: "Saturated thickness",
    wellYield: "Specific yield",
    wellStorativity: "Storativity",
    wellDiffusivity: "Diffusivity",
    wellDiffusivityHint: "a = k·m / S",
    wellLeakage: "Leakage factor",
    wellAllowableGroup: "Allowable drawdown",
    wellAllowable: "Allowable drawdown",
    wellSectionGroup: "Typical scheme",
    wellStatsGroup: "Details",
    wellStatT: "Transmissivity T",
    wellStatA: "Diffusivity a",
    wellStatS: "Storativity S",
    wellStatImage: "Distance to the image well",
    wellStatReserve: "Margin to allowable drawdown",
    wellChartGroup: "Chart",
    wellTableGroup: "Table",
    wellTableNote: "Time is spaced logarithmically.",
    wellWarn_r_le_r0: "The observation well is closer than the pumped well wall — check the distance.",
    wellWarn_exceeds_allowable: "Drawdown exceeds the allowable value: reduce the discharge or the pumping time.",
    wellWarn_dewatered: "The unconfined aquifer drains: drawdown has reached the saturated thickness.",
    wellError_Q: "Enter the well discharge.",
    wellError_t: "Enter the pumping duration.",
    wellError_r0: "Enter the pumped well radius.",
    wellError_r: "Enter the distance to the observation well.",
    wellError_k: "Enter the hydraulic conductivity.",
    wellError_m: "Enter the aquifer thickness.",
    wellError_h0: "Enter the saturated thickness.",
    wellError_S: "Enter the storativity or the diffusivity.",
    wellError_Sy: "Enter the specific yield.",
    wellError_B: "Enter the leakage factor B.",
    wellError_Lw: "Enter the distance from the pumped well to the river.",
    wellError_Lp: "Enter the distance from the observation well to the river.",

    // --- Calculator charts ---
    chartNoData: "Not enough data for the chart",
    chartTimeAxis: "Dewatering time, days",
    chartInflowAxis: "Inflow, m³/day",
    chartDrawdownAxis: "Drawdown, m",
    chartPumpingTimeAxis: "Time since pumping started, days",
    // --- Web calculator port: section labels ---
    schemePitSection: "Excavation section",
    schemeWellSection: "Well section",
    schemeRiver: "stream",
    schemeFloor: "floor",
    schemeCrest: "crest",
    schemeSand: "sand",
    schemeClay: "clay",
    schemeAquitard: "aquitard",
    schemeDrawdownWord: "drawdown",
    schemeInitialHead: "initial head",
    schemeInitialGwl: "initial GWL",
    schemePumpedWell: "pumped",
    schemeObsWell: "obs.",

    // --- Soil presets: pit inflow ---
    lithoClay: "Clay",
    lithoLoam: "Loam",
    lithoSandyLoam: "Sandy loam",
    lithoFineSand: "Fine sand",
    lithoMediumSand: "Medium sand",
    lithoCoarseSand: "Coarse sand",
    lithoGravel: "Gravel",
    lithoFractured: "Fractured rock",

    // --- Soil presets: well drawdown ---
    lithoWellGravel: "Gravel, pebbles",
    lithoWellCoarseSand: "Coarse sand",
    lithoWellMediumSand: "Medium sand",
    lithoWellFineSand: "Fine sand",
    lithoWellSiltySand: "Silty sand, sandy loam",
    lithoWellLoam: "Loam",
    lithoWellClay: "Clay",
    lithoWellSandstone: "Sandstone",
    lithoWellLimestone: "Fractured limestone",
    lithoWellFractured: "Fractured bedrock",

    // --- Area ---
    quantityArea: "Area",
    unitM2: "m²",
    unitHectare: "ha",
    unitKm2: "km²",
    unitFt2: "ft²",

    // --- Volume ---
    quantityVolume: "Volume",
    unitM3: "m³",
    unitLiters: "L",
    unitFt3: "ft³",
    unitGallons: "gal",

    // --- Pressure ---
    quantityPressure: "Pressure",
    unitPascal: "Pa",
    unitKiloPascal: "kPa",
    unitMegaPascal: "MPa",
    unitBar: "bar",
    unitAtmosphere: "kgf/cm²",
    unitMeterH2O: "m H₂O",
    tabBarrage: "Barrier",
    tabLeakage: "Leakage",

    // ===== BARRIER AND BOUNDARY CONDITIONS =====
    distanceToBoundary: "Distance to boundary",
    boundaryResultTitle: "Drawdown with boundary",
    boundaryType: "Boundary type",
    boundaryBarrier: "Impermeable",
    boundaryRecharge: "Constant head",
    withoutBoundary: "Without boundary",
    boundaryEffect: "Boundary contribution",
    boundaryNotReachedNote:
      "The cone of depression has not reached the boundary yet — it does not affect drawdown so far.",
    observationBeyondBoundaryNote:
      "The observation point lies beyond the aquifer boundary: r must be smaller than L.",
    barrageRiseTitle: "Head build-up upstream of the structure",
    barrageRiseShort: "Head build-up",
    naturalGradient: "Natural gradient",
    barrierLength: "Structure length",

    // ===== LEAKAGE =====
    aquitardGroup: "Aquitard",
    aquitardThickness: "Aquitard thickness",
    aquitardK: "Aquitard conductivity",
    steadyDrawdown: "Steady state",
    leakageVolumeTitle: "Leakage volume",
    leakageArea: "Leakage area",
    leakageTotal: "Total over the area",
    value: "Value",
    result: "Result",
    convertedToAllUnits: "Conversions",
    thickness: "Aquifer thickness",
    influenceRadius: "Radius of influence",
    penetrationRatio: "Penetration ratio",
    transmissivity: "Transmissivity",
    storativity: "Storativity",
    filtrationCoefficient: "Conductivity k",
    pitRadius: "Pit radius r₀",
    defaultInfluenceRatioNote:
      "R and r₀ are not set — a ratio R/r₀ = 300 is assumed. Enter actual values for an accurate result.",
    drawdownExceedsThicknessNote:
      "Drawdown exceeds aquifer thickness — check the input data.",
    unitMDay: "m/day",
    unitMHour: "m/hour",
    unitMSec: "m/sec",
    unitCmDay: "cm/day",
    unitCmSec: "cm/sec",
    unitMmDay: "mm/day",
    unitFtDay: "ft/day",
    unitFtSec: "ft/sec",
    unitMeinzer: "meinzer",

    // ===== FIELD DIARY: map and points =====
    pointTypeWell: "Well",
    pointTypeSpring: "Spring",
    pointTypePit: "Pit",
    pointTypeObservationPoint: "Observation",
    pointType_well: "Well",
    pointType_spring: "Spring",
    pointType_pit: "Pit",
    pointType_observation: "Point",
    pointsCount: "points",
    typesCount: "types",
    lastRecord: "record",
    observationPoints: "Observation points",
    pointTitlePlaceholder: "Point name",
    pointNote: "Point description",
    pointNotePlaceholder: "Description: what the point is, what was measured, how to get there",
    addPointNote: "Add a description",
    // Point attachments: photos and voice notes
    attachments: "Attachments",
    addPhoto: "Photo",
    addVoiceNote: "Record",
    photoFromCamera: "Take photo",
    photoFromLibrary: "From gallery",
    openAttachments: "Point attachments",
    recordingInProgress: "Recording",
    stopRecording: "Stop recording",
    playRecording: "Play recording",
    pauseRecording: "Pause",
    closePhoto: "Close photo",
    deleteAttachment: "Delete attachment?",
    deletePhotoMessage: "The photo will be deleted from this device.",
    deleteAttachmentMessage: "The recording will be deleted from this device.",
    cameraDenied: "No camera access. Allow it in your phone settings.",
    galleryDenied: "No gallery access. Allow it in your phone settings.",
    microphoneDenied: "No microphone access. Allow it in your phone settings.",
    photoCount: "photos",
    voiceNoteCount: "recordings",
    markMyLocation: "Mark my location",
    centerOnMyLocation: "Show my location on the map",
    tapMapToMark: "Tap the map to mark a point",
    mapExpand: "Expand the map to full screen",
    mapCollapse: "Collapse the map",
    tapMapToAddPoint: "Tap the map to add a point",
    mapNativeOnly: "The map is available in the mobile app",
    locationDenied:
      "No access to your location. Allow it in settings, or mark the point by tapping the map.",
    locationFailed:
      "Could not determine your location. Underground and indoors there may be no signal — place the point on the map.",
    locating: "Getting coordinates…",

    // ===== FIELD DIARY: interface =====
    filterByTypes: "Filter by type",
    fieldDiaryStats: "Field diary statistics",
    addPoint: "Add point",
    editPoint: "Edit point",
    pointTypeLabel: "Point type:",

    // ===== CALCULATOR =====
    imperfectWell: "Partially penetrating well",

    // ===== COMMON =====
    loadingSettings: "Loading settings...",

    // ===== FIELD DIARY: point types =====
    pointTypeObservation: "Observation",
    pointTypeSample: "Sample",
    pointTypeMeasurement: "Measurement",
    pointTypePhoto: "Photo",
    pointTypeNote: "Note",

    // ===== BOTTOM MENU =====
    help: "Help",
    exit: "Exit",
    // ===== ACCOUNT AND SYNC =====
    accountManage: "Sync, password, deletion",
    signInAction: "Sign in",
    signUpAction: "Create account",
    subscribeNeedsAccount:
      "Sign in first: the subscription is tied to your account.",
    billingPending:
      "Payments are being connected through the App Store and Google Play. For now, use a promo code in the Account section.",
    cancelViaStore:
      "Subscriptions are cancelled in App Store or Google Play settings — store rules require it.",
    syncSection: "Sync",
    syncIdle: "Ready to sync",
    syncInProgress: "Syncing…",
    syncUpToDate: "Everything is up to date",
    syncConflicts: "Conflicting changes",
    syncFailed: "Sync failed",
    syncLast: "Last sync",
    syncNever: "not yet",
    syncJustNow: "just now",
    syncMinutesAgo: "%{count} min ago",
    syncPending: "waiting to upload",
    syncNow: "Sync now",
    conflictsSection: "Conflicts",
    conflictQuestion:
      "This record changed here and on another device. Which version should stay?",
    keepLocal: "This one",
    keepRemote: "From the other device",
    passwordSection: "Password",
    newPassword: "New password",
    changePassword: "Change password",
    passwordChanged: "Password changed",
    passwordTooShort: "At least 6 characters",
    forgotPassword: "Forgot your password?",
    enterEmailFirst: "Enter your email",
    resetSent: "A reset link has been sent. Check your inbox.",
    dangerSection: "Account management",
    deleteAccount: "Delete account",
    deleteAccountTitle: "Delete account?",
    deleteAccountMessage:
      "Your account and all server-side data will be deleted permanently.",
    deleteAccountHint:
      "Journals and points stay on this device. Server data is deleted for good.",
    planBasic: "Basic access",
    planPremium: "Premium access",
    premiumActive: "Sync and advanced calculations unlocked",
    premiumLearnMore: "About Premium",
    clusterMapLockTitle: "Well cluster map is a Premium feature",
    clusterMapLockNote: "Without a subscription, enter distances in the table above.",
    promoSection: "Promo code",
    promoPlaceholder: "Partner code",
    promoApply: "Apply",
    promoApplied: "Promo code applied",
    signOutTitle: "Sign out?",
    signOutMessage:
      "Journals and points stay on the device. Syncing pauses until you sign in again.",

    // ===== HOME =====
    welcome: "Welcome",
    desktop: "Desktop",
    subscriptionStatus: "Subscription status",
    active: "Active",
    inactive: "Inactive",

    // ===== SETTINGS =====
    settings: "Settings",
    settingsDescription: "Customize the appearance and behavior of the app",
    theme: "Theme",
    language: "Language",
    version: "Version",
    developer: "Developer",
    website: "Website",
    change: "Change",
    settingsInfo:
      "Settings changes are applied immediately and saved automatically.",

    // ===== PUMPING TEST MODULE (main screen) =====
    loadProject: "Load project",
    processing: "Processing",
    ofrType: "Test type",
    projectJournalName: "Project/journal name",
    stepOfTotal: "Step %{current} of %{total}",
    drawdownData: "Drawdown data",
    projectReview: "Project review",
    processingTypeAndDates: "Processing type and dates",
    // Home page
    search: "Search",
    searchButton: "Search",
    calculator: "Calculator",
    mainMenu: "Main functions",

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

    // Descriptions of the main screen cards
    calculatorDesc: "Hydrogeological calculations",
    pumpingTestDesc: "Filling out the log and processing the OFR",
    examplesDesc: "Training materials",

    // ===== HYDROISOHYPSE MAPS (AnsSurf) =====
    maps: "Hydroisohypse maps",
    mapsDesc: "Built from observation wells",
    mapsExportShared: "Done: %{count} file(s). The share sheet opens for each one.",
    mapsExportSaved: "Files saved: %{count}.",
    mapsFailed: "That didn't work. Try again.",
    subscriptionDesc: "Subscription management",
    settingsDesc: "Application settings",
    field: "Field diary",
    programAddsDesc:
      "Program for daily hydrogeological calculations for windows.",
    programAdds: "ANSDIMAT",
    fieldDesc: "Observation points with coordinates",
    aboutDesc: "Application information",
    contactDesc: "Contact the developers",
    appDescription:
      "Software package for analyzing and processing hydrogeological data",
    // Order
    orderTitle: "ANSDIMAT Order Form",
    fullName: "Full Name",
    organization: "Organization",
    phone: "Phone",
    licenseType: "License type",
    singleLicense: "Single User",
    multiLicense: "Multi User",
    comment: "Comment",
    submit: "Submit",
    orderSent: "Order Sent",
    orderIntro:
      "The request opens as a letter in your mail app. Fields marked with an asterisk are required for us to reply.",
    orderThanks:
      "Thank you, %{name}! The letter is open in your mail app — send it and we will get back to you.",
    fieldRequired: "This field is required",
    emailInvalid: "Check the email address",
    import: "Import",
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

    // PumpingTestProcessing - Section Headers
    journalCreationWizard: "Journal Creation Wizard",

    // PumpingTestProcessing - Wizard Step Headers

    // PumpingTestProcessing - Export
    availableExportFormats: "Available Export Formats",
    exportInformation: "Export Information",
    exportInfoText:
      "• JSON format preserves complete data structure\n• CSV format is suitable for analysis in spreadsheets\n• PDF reports contain charts and detailed analysis\n• All exported files can be imported back",

    // PumpingTestProcessing - Journal Details
    measurementCount: "Measurement Count",

    // PumpingTestProcessing - Distances

    // Project Management
    projectManagement: "Management",
    createProject: "Create Project",
    projectName: "Project Name",
    journalProcessing: "Journal Processing",
    journalProcessingSubtitle: "Create a new journal in 3 steps",
    journalProcessingDescription:
      "Module for analyzing the results of pumping test data. Create projects, record observation journals and get detailed reports.",
    projectNamePlaceholder: "Project name",
    activeProject: "Active Project",
    selectProject: "Select Project",
    deleteProject: "Delete Project",
    deleteProjectConfirm: "Delete project?",
    projectDeleted: "Project deleted",
    projectCreated: "Project created",
    exportProject: "Export Project",
    favoriteProject: "Add to Favorites",
    unfavoriteProject: "Remove from Favorites",
    addToFavorites: "Add to Favorites",
    removeFromFavorites: "Remove from Favorites",
    allProjects: "All Projects",
    recentProjects: "Recent Projects",
    // Wizard
    wizard: "Data Entry",
    wizardTitle: "Pumping Test Journal Creation Wizard",
    step1: "Step 1: Test Type",
    step2: "Step 2: Layer Type",
    step3: "Step 3: Boundary Conditions",
    step4: "Step 4: Data Table",
    step5: "Step 5: Confirmation",
    finish: "Finish",
    // Test Types
    testType: "Test Type",
    pumpingTest: "Pumping Test",
    slugTest: "Slug Test",
    packerTest: "Packer Test",

    // Layer Types
    leaky: "Leaky",

    // Boundary Conditions
    boundaryConditions: "Boundary Conditions",
    infinite: "Infinite Aquifer",
    constantHead: "Constant Head",
    noFlow: "No Flow",

    // Data Table
    dataTable: "Data Table",
    addRow: "Add Row",
    deleteRow: "Delete Row",
    rows: "rows",
    dataType: "Data Type",
    data: "Data",
    dataRows: "Data Rows",

    // Confirmation
    confirmation: "Confirmation",
    journalCreated: "Journal created",
    journalSaved: "Journal saved to project",
    selectProjectFirst: "Select a project first",

    // Data Processing
    dataProcessing: "Processing",
    processingTitle: "Journal Processing",
    noProjects: "No projects",
    createFirstProject: "Create your first project using the wizard above",
    journal: "Journal",
    createJournalSubtitle: "Create a new journal in 3 steps",
    journalManagement: "Journals",
    journalDetails: "Journal Details",
    editJournal: "Edit Journal",
    importJournal: "Import Journal",
    dataPreview: "Data Preview",
    results: "Graphical Analysis Results",
    slope: "Slope C",
    intercept: "Intercept (b)",
    formula: "Formula: s = k·log₁₀(t) + b",
    deleteJournal: "Delete Journal",
    noJournals: "No saved journals in project",
    function: "Function",
    units: "Units",
    distance: "Distance",
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
    notAnsdimatProject: "File is not an ANSDIMAT project",
    projectIdExists: "Project with this ID already exists",
    projectImported: "Project imported successfully!",
    projectInfo: "Project Information",
    created: "Created",
    journalsCount: "Journals",
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
    clusterMapFeature: "Well cluster map in test processing",
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
    saveWithYearly: "Better value yearly",
    yearlySavings: "Save %{amount} a year",
    subscriptionAutoRenew:
      "The subscription renews automatically unless cancelled at least 24 hours before the end of the paid period.",
    trialPeriod: "Trial period",
    daysFree: "days free",
    premiumFeature: "Premium Feature",
    premiumFeatureInfiltration:
      "Infiltration leakage is available only for premium users",
    premiumFeaturePitInflow: "Pit inflow is available only for premium users",
    goToPremium: "Go to Premium",
    premiumOnly: "Premium users only",
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
    mailClientError: "The mail app did not open. Send your request manually to",
    mailSendError: "Could not open the letter. Send your request manually to",
    invalidJsonFile: "File is not a valid JSON",
    journalImportedSuccess: "Journal imported successfully!",
    importFileError: "Error importing file",

    // Project limits
    projectLimit: "Project limit",
    projectLimitMessage:
      "Free users can create a maximum of 3 projects. Upgrade to premium for unlimited projects.",

    // Units for charts
    meters: "m",
    minutesSqrt: "min¹/²",
    logMinutes: "lg(min)",
    logMeters: "lg(m)",
    perMeter: "1/m",
    minutesPowerN: "min^n",
    logMinutesPerMeterSquared: "lg(min/m^2)",
    metersSqrt: "m¹/²",
    metersPowerN: "m^n",
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
    scale: "Scale",
    move: "Move",
    chartInstruction: "Use gestures to zoom and pan the chart",

    // Дополнительные переводы для DataProcessing
    pumpingTestJournals: "Pumping Test Journals",
    chartType: "Chart Type",
    chart: "Chart",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    reset: "Reset",
    instructions: "Instructions",

    // Units for functions
    unitMinutes: "min",
    unitMSecond: "m/s",
    unitCmSecond: "cm/s",
    unitFootDay: "ft/day",
    unitGalDayFt2: "gal/day per ft²",
    unitDays: "day",
    unitHours: "h",
    unitFeet: "ft",
    unitLSec: "L/s",
    unitM3Hour: "m³/h",
    unitGalMin: "gal/min",
    unitFt3Day: "ft³/day",
    unitFt2Day: "ft²/day",
    unitGalDayFt: "gal/day per ft",
    unitM2Sec: "m²/s",
    unitsSection: "Units",
    unitsHint:
      "Input and results use the units you pick. Calculations run in base units, and data already entered does not change.",
    quantityTime: "Time",
    quantityDistance: "Distance",
    quantityFlow: "Discharge",
    quantityTransmissivity: "Transmissivity (T)",
    quantityConductivity: "Hydraulic conductivity (k)",
    resultConductivity: "Hydraulic conductivity",
    quantityDiffusivity: "Diffusivity (a)",
    quantityDrawdown: "Drawdown (s)",
    unitFlowRate: "m³/day",
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

    // PumpingTestProcessing - Chart
    dragToMove: "Drag to move",
    pinchToZoom: "Pinch to zoom",
    tapToSelect: "Tap to select",
    zooming: "Zooming",
    dragging: "Dragging",

    // Common
    save: "Save",
    edit: "Edit",
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

    // Additional translations for PumpingTestProcessing
    selectDateTime: "Select date and time",
    noData: "No data",
    testTypeLabel: "Test type",
    layerTypeLabel: "Layer type",
    boundaryConditionsLabel: "Boundary conditions",
    dataTypeLabel: "Data type",
    journalUpdated: "Journal updated",
    deleteJournalConfirm: "Delete journal",
    cancel: "Cancel",
    delete: "Delete",
    journalDeleted: "Journal deleted",
    exportError: "Failed to export journal",
    invalidFileFormat: "Invalid file format",
    notAnsdimatJournal: "File is not an Ansdimat journal",
    journalImported: "Journal imported",
    importError: "Failed to import file",
    selectProjectInManagement:
      'Select a project in the "Project Management" section',
    projectExported: "Project exported!",
    exportProjectError: "Failed to export project",
    premiumFeatureCSV: "CSV export is available only in premium version",
    getPremium: "Get premium",
    subscription: "Subscription",
    goToSubscription: "Go to subscription screen",
    noDataToExport: "No data to export",
    csvHeader: "Journal,Creation Date,Test Type,Boundary Conditions",
    csvDataHeader: "Time,Drawdown",
    journalsExportedCSV: "Journals exported to CSV!",
    exportJournalsError: "Failed to export journals",
    premiumFeaturePDF:
      "PDF analysis export is available only in premium version",
    inDevelopment: "In development",
    pdfExportInDevelopment:
      "PDF analysis export function is under development and will be available in upcoming updates.",
    understand: "Understand",
    exportProjectJSON: "Export project (JSON)",
    exportProjectJSONDesc: "Complete project export with all journals and data",
    exportJournalsCSV: "Export journals (CSV)",
    exportJournalsCSVDesc:
      "Export all journals in CSV format for Excel analysis",
    exportAnalysisPDF: "Export analysis (PDF)",
    exportAnalysisPDFDesc: "Detailed report with charts and analysis results",
    enterProjectName: "Enter a journal name",
    createProjectError: "Failed to create project",
    projectNotFound: "Project not found",
    projectSelected: 'Project "{name}" selected',
    selectProjectError: "Error selecting project",
    cancelSubscriptionConfirm:
      "Are you sure you want to cancel your subscription?",
    cancelSubscriptionError: "Error canceling subscription",
    savePNGError: "Failed to save PNG",
    difficultyMedium: "Medium",
    difficultyHard: "Hard",
    categoryBasics: "Basics",
    categorySetup: "Setup",
    categoryCalculations: "Calculations",
    categoryAnalysis: "Analysis",
    categoryExport: "Export",
    categoryCharts: "Charts",
    categoryReports: "Reports",
    importProject: "Import project",
    flowRateUnits: "Flow rate units",
    projectAlreadyExists: "Project already exists",
    projectAlreadyExistsDescription:
      "Project '{name}' already exists. Do you want to replace it?",
    replace: "Replace",
    projectUpdated: "Project updated",
    invalidJSONFormat: "Invalid JSON format",
    invalidProjectFile: "Invalid project file",
    lugeon: "Lugeon",
    express: "Express",
    injection: "Infiltration test",
    packer: "Packer test",
    aquiferType: "Aquifer type",
    confinedAquifer: "Confined aquifer",
    unconfinedAquifer: "Unconfined aquifer",
    aquiferTypeLabel: "Aquifer type",
    wellNameLabel: "Well Name",
    flowRateLabel: "Flow Rate",
    aquiferThicknessLabel: "Aquifer Thickness",
    startDate: "Start Date",
    dateAndTimeSelection: "Date and Time Selection",
    addObservationWells: "Add Observation Wells",
    measurement: "Measurement",
    time: "Time",
    drawdown: "Drawdown",
    distanceTo: "Distance to",
    km: "km",
    distancesInfo:
      "Specify the distances from the experimental well to each observation well in kilometers.",
    pumpingJournalCreated: "Pumping journal created",
    inNewProject: "in new project",
    successfully: "successfully",
    failedToSaveJournal: "Failed to save journal",
    observationJournal: "Observation Journal",

    // Мастер создания проектов - английские переводы
    basicParameters: "Basic Parameters",
    processingTypeSelection: "Processing Type Selection",
    observationJournalStep: "Observation Journal",
    distancesBetweenWells: "Distances Between Wells",
    wellNamePlaceholder: "Enter well name",
    project: "Project",
    newProject: "New Project",
    information: "Information",
    journalWillBeAddedToActiveProject:
      "Journal will be added to active project",
    noActiveProject: "No active project.",
    newProjectWillBeCreated: "New project will be created.",
    firstStep:
      "Step 1: Specify the main project parameters, including aquifer type, well name, flow rate and other characteristics.",
    secondStep:
      "Step 2: Select processing types (pumping/recovery) and specify start dates for processes.",
    journalCreationInfo:
      "After completing all steps, an observation journal will be created that can be used for data analysis.",

    // Мастер создания проектов - английские переводы для кнопок и элементов
    next: "Next",
    previous: "Previous",
    back: "Back",
    createJournal: "Create Journal",
    saveChanges: "Save Changes",
    addObservationWell: "Add Observation Well",
    addMeasurement: "Add Measurement",
    deleteMeasurement: "Delete Measurement",
    timeUnit: "Time Unit",
    timeUnits: "Time Units",
    seconds: "seconds",
    minutes: "minutes",
    hours: "hours",
    aquiferThickness: "Aquifer Thickness",
    saturatedThickness: "Saturated Thickness",
    mainFormationThickness: "Main Formation Thickness",
    flowRate: "Flow Rate",
    wellName: "Well Name",
    layerType: "Layer Type",
    confined: "Confined",
    unconfined: "Unconfined",
    withInterflow: "With Interflow",
    processingTypes: "Processing Types",
    pumping: "Pumping",
    recovery: "Recovery",
    pumpingStart: "Pumping Start",
    recoveryStart: "Recovery Start",
    experimentalWell: "Experimental Well",
    observationWells: "Observation Wells",
    measurements: "Measurements",
    distances: "Distances",
    addWell: "Add Well",
    deleteWell: "Delete Well",
    editWell: "Edit Well",
    wellActions: "Well Actions",
    measurementNumber: "Measurement",
    insertMeasurement: "Insert Measurement",
    selectDate: "Select Date and Time",
    dateTimeSelection: "Date and Time Selection",

    // ===== TEST TYPES WITH THEIR OWN SCHEME: SHARED =====
    ofrInputs: "Input data",
    ofrResult: "Result",
    conductivityLabel: "k, %{unit}",
    ofrMethodTitle: "How it is computed",
    ofrChart: "Chart",

    // ===== SLUG TEST (BOUWER — RICE) =====
    slugTitle: "Slug test",
    slugSubtitle: "Bouwer — Rice solution",
    slugWellSection: "Well",
    slugFilterRadius: "Screen radius r_w",
    slugCasingRadius: "Casing radius r_c",
    slugFilterLength: "Screen length l_w",
    slugFilterMiddle: "Water table to screen midpoint LT_w",
    slugFilterBottom: "Screen bottom z = LT_w + l_w/2",
    slugThickness: "Saturated thickness m",
    slugInitialDrawdown: "Initial head change s⁰",
    slugJournalTitle: "Readings: time and head recovery",
    slugJournalNote:
      "Record how far the head has already recovered, not what is left of the initial change: values grow from zero, and the last reading equals s⁰.",
    slugInfluenceRadius: "ln(R/r_w)",
    slugBeta: "β = l_w/r_w",
    slugSchemePartial:
      "Partially penetrating well: effective radius from A₁ and A₂.",
    slugSchemeFull:
      "Screen reaches the aquifer base: effective radius from A₃, as for a fully penetrating well.",
    slugThicknessCapped:
      "Thick aquifer: ln[(m−z)/r_w] is capped at 6, the upper limit of the relation.",
    slugBetaClamped:
      "β falls outside the Bouwer — Rice chart (1…2000): coefficients are taken at its edge.",
    slugMethod:
      "k = 2.3·r_c²/(2·l_w)·C·ln(R/r_w), where C is the slope of the lg(s⁰/s) — t line.",
    slugTwoSegments:
      "The plot has two straight segments: the fit uses the second one, as the book prescribes — the first indicates a disturbed zone around the well or leakage. Pick the points by hand for a different interval.",
    slugFirstSegmentK: "k from the first segment",
    slugLineNote:
      "The line must pass through the origin. With two straight segments, use the second: the first indicates a disturbed zone around the well or leakage.",
    slugNeedInitialDrawdown:
      "Enter the initial head change s⁰ — the recovery is measured from it.",
    slugNeedGeometry:
      "Check the well geometry: screen radius and length, and the distance from the water table to the screen midpoint.",
    slugNeedMeasurements:
      "Add at least two readings where the head recovery is smaller than s⁰.",

    // ===== PACKER (LUGEON) TEST =====
    lugeonTitle: "Packer test",
    lugeonSubtitle: "Lugeon test: Moye and Thiem formulas",
    lugeonWellRadius: "Borehole radius r_w",
    lugeonIntervalLength: "Test interval length l_w",
    lugeonReadingInterval: "Between readings",
    lugeonDensity: "Fluid density",
    unitDensity: "kg/m³",
    lugeonStagesTitle: "Stages",
    lugeonStage: "Stage %{n}",
    lugeonPressure: "Pressure ΔP",
    lugeonReadings: "Cumulative flowmeter readings",
    lugeonReadingsHint:
      "Enter the running total, not the increment per interval: 120, 138, 157.",
    lugeonReadingsFalling:
      "The readings decrease: an increment was entered instead of the running total.",
    lugeonMeanFlow: "Mean flow rate",
    lugeonStageLu: "Lu",
    lugeonMeanK: "Mean k",
    lugeonMeanLu: "Mean Lu",
    lugeonAddStage: "Add stage",
    lugeonRemoveStage: "Remove stage",
    lugeonChartTitle: "Flow rate vs pressure",
    lugeonBranchRise: "Pressure rise",
    lugeonBranchFall: "Pressure fall",
    lugeonPatternTitle: "Flow pattern",
    lugeonPatternLaminar: "Laminar flow",
    lugeonPatternTurbulent: "Turbulent flow",
    lugeonPatternDilation: "Dilation",
    lugeonPatternWashout: "Wash-out",
    lugeonPatternVoidFilling: "Void filling",
    lugeonPatternUnknown: "Undetermined",
    lugeonHintLaminar:
      "Water take does not depend on pressure — the mean across stages is representative.",
    lugeonHintTurbulent:
      "Water take drops as pressure rises: flow in the fractures is no longer laminar. The value at the lowest pressure is representative.",
    lugeonHintDilation:
      "At peak pressure the fractures opened elastically and closed again. The value at the lowest pressure is representative.",
    lugeonHintWashout:
      "Water take grows stage after stage and does not return: fractures are being washed out, the test alters the rock.",
    lugeonHintVoidFilling:
      "Water take falls stage after stage: fractures are being clogged by suspended matter.",
    lugeonHintUnknown:
      "The pattern is determined from five stages: three on the pressure rise and two on the way down.",
    lugeonRepresentative: "Representative Lu",
    lugeonMethod:
      "k = Q·ρ·g/(2π·l_w·ΔP)·(1 + ln(l_w/2r_w)) — Moye formula, g = 9.81 m/s².",
    lugeonLuMethod:
      "Lu = Q/l_w · P₀/ΔP with Q in L/min and P₀ = 1 MPa. One Lugeon unit is 1 L/min per metre of interval at 1 MPa excess pressure.",
    lugeonScale:
      "As a rough guide 1 Lu ≈ 0.011 m/day. In highly permeable fractured rock the method loses accuracy.",
    lugeonStagePlan:
      "Standard procedure: five stages at 0.5·Pmax, 0.75·Pmax, Pmax, 0.75·Pmax, 0.5·Pmax, ten minutes each, with the flow rate read every minute.",

    // --- Hydraulic conductivity formula ---
    lugeonFormula: "Formula",
    lugeonFormulaMoye: "Moye",
    lugeonFormulaThiem: "Thiem",
    lugeonThiemMethod:
      "k = Q/(2π·l_w·Δh)·ln(R/r_w), where Δh = ΔP/(ρ·g) and the radius of influence R is taken equal to the interval length. Both formulas give close results.",

    // --- Rock classification by Lugeon value (table 13.5) ---
    lugeonRockClass: "Rock",
    lugeonPermeabilityTitle: "Permeability",
    lugeonRockVeryLow: "Very slightly fractured",
    lugeonRockLow: "Slightly fractured",
    lugeonRockModerate: "Fractured",
    lugeonRockMedium: "Very highly fractured",
    lugeonRockHigh: "Highly fractured",
    lugeonRockVeryHigh: "Voids and caverns",
    lugeonPermeabilityVeryLow: "Very low",
    lugeonPermeabilityLow: "Low",
    lugeonPermeabilityModerate: "Moderate",
    lugeonPermeabilityMedium: "Medium",
    lugeonPermeabilityHigh: "High",
    lugeonPermeabilityVeryHigh: "Very high",
    lugeonLuChart: "Lugeon value by stage",
    lugeonNeedStages:
      "Enter the stage pressure and at least two flowmeter readings.",
    lugeonNeedGeometry: "Enter the test interval length and the borehole radius.",

    // ===== PIT INFILTRATION TEST IN THE VADOSE ZONE =====
    vadoseTitle: "Pit infiltration",
    vadoseSubtitle: "Vadose zone: Boldyrev and Bindeman",
    vadosePitSection: "Pit",
    vadoseVolume: "Water added ΔV",
    vadoseInterval: "Time interval Δt",
    vadoseFlow: "Flow rate Q",
    vadoseFlowComputed: "From volume and interval",
    vadoseFlowManual: "Entered by hand",
    vadoseArea: "Infiltration area F",
    vadoseHead: "Water depth in the pit H",
    vadoseDepth: "Wetting front depth z",
    vadoseCapillary: "Capillary rise h_c",
    vadoseCapillarySection: "Capillary forces",
    vadoseUseCapillary: "Account for capillary forces",
    vadoseNoCapillary: "Ignore",
    vadoseLithology: "Soil",
    vadoseLithologyPick: "Pick a soil",
    vadoseLithologyHint:
      "Half of the maximum rise from the reference table; a measured one is better entered by hand.",
    vadoseMethod: "Bindeman: k = Q·z / (F·(H + H_c + z)), Q = ΔV/Δt.",
    vadoseMethodBoldyrev: "Boldyrev: k = Q/F = ΔV/(F·Δt).",
    vadoseMethodName: "Method",
    vadoseMethodBoldyrevName: "Boldyrev",
    vadoseMethodBindemanName: "Bindeman",
    vadoseAreaNote: "For the Nesterov method, the area of the inner ring.",
    vadoseCapillaryNote:
      "Without capillary forces the result is overstated: the whole driving force is credited to gravity.",
    vadoseHeadNote:
      "The method keeps the water layer in the pit at about 10 cm.",
    vadoseNeedDepth:
      "Enter the wetting front depth z at the end of the test — the calculation needs it.",
    vadoseNeedFlow:
      "Enter the flow rate, or the water added together with the time interval.",
    vadoseNeedArea: "Enter the pit area.",

    // --- Maximum capillary rise ---
    capillaryGravel: "Gravel",
    capillaryCoarseSand: "Coarse sand",
    capillaryMediumSand: "Medium sand",
    capillaryFineSand: "Fine sand",
    capillarySiltySand: "Silty sand",
    capillarySandyLoam: "Sandy loam",
    capillaryLoam: "Loam",
    capillaryClay: "Clay",
  },
});

/**
 * Язык устройства, приведённый к поддерживаемым приложением
 *
 * Определяется синхронно, при загрузке модуля: LanguageContext делал это через
 * AsyncStorage, то есть уже после первого рендера, и у пользователя с
 * английской системой экран успевал отрисоваться по-русски.
 *
 * @returns {'ru'|'en'} код языка
 */
function systemLocale() {
  try {
    const locales = Localization.getLocales?.() ?? [];
    return locales[0]?.languageCode === "ru" ? "ru" : "en";
  } catch {
    // Модуль локализации недоступен (веб-сборка, тесты) — берём язык
    // по умолчанию, а не роняем приложение на первом же переводе
    return "ru";
  }
}

i18n.defaultLocale = "ru";
i18n.locale = systemLocale();
i18n.enableFallback = true;

export default i18n;
