/**
 * Каталог видеоуроков и учебных материалов АНСДИМАТ
 *
 * Ссылки и заставки взяты со страницы «Примеры и видео» официального сайта
 * (ansdimat.com/Ru/video_cases). Раньше на экране лежали выдуманные карточки
 * с несуществующей длительностью — нажатие на них ничего не открывало.
 *
 * Заставки грузятся с сайта, поэтому без сети карточка покажет подложку —
 * заголовок и ссылка при этом остаются на месте.
 */

/** Разделы каталога — по типу задачи, а не по модулю программы */
export const VIDEO_CATEGORIES = {
  PUMPING: 'pumping',
  DEWATERING: 'dewatering',
  MODELING: 'modeling',
};

const THUMB_BASE = 'https://ansdimat.com/Ru/wp-content/uploads';

export const VIDEO_LESSONS = [
  {
    id: 'journal',
    category: VIDEO_CATEGORIES.PUMPING,
    title: 'Заполнение журнала откачки',
    description: 'Расширенный редактор: паспорт опыта и ввод замеров',
    url: 'https://rutube.ru/video/6088fc77131e6807fd94ddaa83d11c0f/',
    thumb: `${THUMB_BASE}/Ansdi_plus_v1.jpg`,
  },
  {
    id: 'single',
    category: VIDEO_CATEGORIES.PUMPING,
    title: 'Обработка одиночной откачки',
    description: 'Базовый сценарий: от замеров к параметрам пласта',
    url: 'https://rutube.ru/video/79346b7e7b67b6fac56e0c1447975b01/',
    thumb: `${THUMB_BASE}/Ansdi_plus_v2.jpg`,
  },
  {
    id: 'anisotropic',
    category: VIDEO_CATEGORIES.PUMPING,
    title: 'Откачка в безнапорном анизотропном пласте',
    description: 'Учёт анизотропии и запаздывания гравитационной ёмкости',
    url: 'https://rutube.ru/video/bbe4ec31519b20964c75d771f8abfeb9/',
    thumb: `${THUMB_BASE}/Ansdi_plus_v3.jpg`,
  },
  {
    id: 'group',
    category: VIDEO_CATEGORIES.PUMPING,
    title: 'Групповая откачка с переменным расходом',
    description: 'Несколько скважин и ступенчатый дебит',
    url: 'https://rutube.ru/video/156762483fb92f466f67deffe2f44fcf/',
    thumb: `${THUMB_BASE}/Ansdi_plus_v4.jpg`,
  },
  {
    id: 'slug',
    category: VIDEO_CATEGORIES.PUMPING,
    title: 'Экспресс-откачка (слаг-тест)',
    description: 'Короткий опыт, когда откачку не поставить',
    url: 'https://www.youtube.com/watch?v=YMSWEF-g71g',
    thumb: `${THUMB_BASE}/Ansdi_plus_v5.jpg`,
  },
  {
    id: 'raster',
    category: VIDEO_CATEGORIES.PUMPING,
    title: 'Координатно привязанная подложка',
    description: 'Подготовка растра для плана участка',
    url: 'https://rutube.ru/video/a96c453b0b730de20ac58e0cc097acff/',
    thumb: `${THUMB_BASE}/elementor/thumbs/42-qt57m2hj9veys2x5qy67jxm30hb83mejae68tgirk0.jpg`,
  },

  {
    id: 'mine',
    category: VIDEO_CATEGORIES.DEWATERING,
    title: 'Водопритоки в подземные горные выработки',
    description: 'Ствол, штрек, шахтное поле и водозащитные мероприятия',
    url: 'https://rutube.ru/video/30b532b8a8d52b3d5b77ed7e8e318515/',
    thumb: `${THUMB_BASE}/elementor/thumbs/Mine_inflows3-ri4v8ruxolia5enq6s9f6tpiasza7ore6dicf5uwao.png`,
  },
  {
    id: 'pit',
    category: VIDEO_CATEGORIES.DEWATERING,
    title: 'Водопритоки в строительный котлован',
    description: 'Риск суффозии бортов и прорыва воды через дно',
    url: 'https://rutube.ru/video/a86ee3f1bdd6896d95afc1bd8aa13851/',
    thumb: `${THUMB_BASE}/elementor/thumbs/openPit_calc-e1769356853573-ri6kz8favlvz5wetkyek5htq3cr8w6ruqj54qsledc.gif`,
  },
  {
    id: 'wellpoints',
    category: VIDEO_CATEGORIES.DEWATERING,
    title: 'Водопонижение иглофильтрами',
    description: 'Шаг и глубина иглофильтров, время осушения',
    url: 'https://rutube.ru/video/6107cc6ecaf01a721d30661569f92ac0/',
    thumb: `${THUMB_BASE}/elementor/thumbs/iglofilter2-qvhstxrq2dpc20bozp5k380scphzgsg01yscz86qkg.jpg`,
  },

  {
    id: 'ansaem',
    category: VIDEO_CATEGORIES.MODELING,
    title: 'Модель отработки карьера в AnsAEM',
    description: 'Метод аналитических элементов',
    url: 'https://rutube.ru/video/472c734ab749122fd95c4506a05e6d41/',
    thumb: `${THUMB_BASE}/elementor/thumbs/22-qt57cyfv0oxw865nyidevqe7p084h987pahsbw15vk.jpg`,
  },
  {
    id: 'reserves',
    category: VIDEO_CATEGORIES.MODELING,
    title: 'Оценка запасов подземных вод',
    description: 'Максимальное понижение, срезки от соседних водозаборов',
    url: 'https://rutube.ru/video/2e106a4faaf4f34fa315b5a5ac8b8b2a/',
    thumb: `${THUMB_BASE}/elementor/thumbs/WaterSupply-r3peleshg5h5sx5lsa66ue93858txiobw3qpx8ukn4.jpg`,
  },
  {
    id: 'flooding',
    category: VIDEO_CATEGORIES.MODELING,
    title: 'Расчёт подтопления грунтовыми водами',
    description: 'Прогноз подъёма уровня на застроенной территории',
    url: 'https://rutube.ru/video/23f1fc0ac55afbec746b9689a30fae0c/',
    thumb: `${THUMB_BASE}/elementor/thumbs/12-qt577qg51tsjq5qqg94111u0vxyppshwbg0ocjrwg0.jpg`,
  },
  {
    id: 'zso',
    category: VIDEO_CATEGORIES.MODELING,
    title: 'Зоны санитарной охраны (ЗСО)',
    description: 'Построение поясов ЗСО водозабора',
    url: 'https://rutube.ru/video/58b871942dede6a61eb5e70ba9f391d5/',
    thumb: `${THUMB_BASE}/elementor/thumbs/32-qt57incoekqej5w0pyy2zaop706539tp5gpmy7lc74.jpg`,
  },
];

/** Материалы для скачивания — то, что открывается не видео, а документом */
export const STUDY_MATERIALS = [
  {
    id: 'training',
    icon: 'picture-as-pdf',
    title: 'Практикум по обработке ОФР',
    description: 'Разбор опытов с исходными данными, PDF',
    url: 'https://www.ansdimat.com/download/trening/treningOFO.pdf',
  },
  {
    id: 'manual',
    icon: 'menu-book',
    title: 'Руководство пользователя АНСДИМАТ',
    description: 'Полное описание методик десктопной версии',
    url: 'https://disk.yandex.ru/i/3ErGfV6fql-XPw',
  },
  {
    id: 'site',
    icon: 'public',
    title: 'Все примеры на ansdimat.com',
    description: 'Каталог видео и расчётов на реальных объектах',
    url: 'https://ansdimat.com/Ru/video_cases/',
  },
];

/**
 * Определяет площадку по адресу видео
 *
 * @param {string} url - адрес видео
 * @returns {string} короткая подпись для бейджа
 */
export function videoHost(url) {
  if (/youtu/i.test(url)) return 'YouTube';
  if (/rutube/i.test(url)) return 'Rutube';
  return 'Видео';
}
