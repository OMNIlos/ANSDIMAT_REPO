/**
 * Сборка встраиваемого AnsSurf
 *
 * Поставка — чужой минифицированный бандл, и правки в него вносятся по
 * меткам. Пропавшая метка обязана ронять сборку, а не молча оставлять на
 * телефоне подсказку про правую кнопку мыши или меню за краем экрана.
 */

const fs = require('fs');
const path = require('path');
const {
  PAGE_TEXT,
  SOURCE_PATCHES,
  replaceOnce,
  patchPage,
  addHostScript,
} = require('../build-anssurf');

const ASSETS = path.join(__dirname, '..', '..', 'assets', 'anssurf');

/**
 * Кусок бандла, где каждая правка встречается ровно по разу
 *
 * @param {string} name - имя страницы
 * @returns {string} разметка
 */
const bundle = (name) =>
  [...PAGE_TEXT[name], ...SOURCE_PATCHES].map(([from]) => `children:${from}`).join(',');

test('правка встаёт на место метки', () => {
  expect(replaceOnce('a `x` b', '`x`', '`y`')).toBe('a `y` b');
});

test('пропавшая метка роняет сборку', () => {
  expect(() => replaceOnce('<html></html>', '`x`', '`y`')).toThrow(
    'поставка AnsSurf изменилась'
  );
});

test('метка, встреченная дважды, роняет сборку', () => {
  expect(() => replaceOnce('`x` `x`', '`x`', '`y`')).toThrow('поставка AnsSurf изменилась');
});

test('знак доллара в замене не портит разметку', () => {
  // String.replace трактует $& и $1 в строке замены особо
  expect(replaceOnce('a `x` b', '`x`', '`$&`')).toBe('a `$&` b');
});

test('все правки страницы применяются', () => {
  for (const name of Object.keys(PAGE_TEXT)) {
    const out = patchPage(bundle(name), name);
    for (const [from, to] of [...PAGE_TEXT[name], ...SOURCE_PATCHES]) {
      expect(out).toContain(to);
      expect(out).not.toContain(`children:${from},`);
    }
  }
});

test('подсказки больше не упоминают правую кнопку мыши', () => {
  // Нажатие на карту работает и пальцем, и мышью: подсказка должна быть
  // верна для обоих, а не только для компьютера
  for (const name of Object.keys(PAGE_TEXT)) {
    for (const [, to] of PAGE_TEXT[name]) {
      expect(to).not.toMatch(/правая кнопка|right-click/i);
    }
  }
});

test('скрипт приложения встаёт первым в <head>', () => {
  const html = '<html><head><script>страница</script></head></html>';
  const out = addHostScript(html, 'window.__host = 1;');

  expect(out.indexOf('window.__host = 1;')).toBeLessThan(out.indexOf('страница'));
});

test('скрипт с закрывающим тегом внутри не встраивается', () => {
  expect(() => addHostScript('<head></head>', 'a = "</script>";')).toThrow('</script>');
});

describe('собранные страницы', () => {
  const host = fs.readFileSync(path.join(__dirname, '..', 'anssurf-host.js'), 'utf8');

  for (const name of Object.keys(PAGE_TEXT)) {
    test(`${name}: правки, скрипт приложения и скин на месте`, () => {
      const html = fs.readFileSync(path.join(ASSETS, name), 'utf8');
      const expected = [
        ...[...PAGE_TEXT[name], ...SOURCE_PATCHES].map(([, to]) => to),
        host.trim(),
        '.hydro-map-pane:has(.leaflet-container)',
        'scrollbar-width: none',
      ];

      // Список пропавшего, а не toContain: при сбое toContain печатает всю
      // страницу на два мегабайта
      expect(expected.filter((part) => !html.includes(part))).toEqual([]);
      // Без десктопной вёрстки скин не срабатывает вовсе
      expect(html.match(/<html\b[^>]*>/)[0]).toMatch(/class="hydro-desktop"/);
      // Прежняя развилка по типу указателя: в узком окне браузера с мышью
      // она оставляла подсказку про правую кнопку и полосы прокрутки
      expect(html.includes('matchMedia("(pointer: coarse)")')).toBe(false);
    });
  }
});

describe('встраивание ansdimat-export.js', () => {
  const { inlineExport } = require('../build-anssurf');

  test('подключение с меткой версии встраивается, как и без неё', () => {
    // С поставки от 23.09 разработчик сбивает кэш браузера меткой в адресе:
    // ansdimat-export.js?v=20260923c. Точное сравнение со старым тегом
    // останавливало сборку на первом же шаге
    const html = '<head><script src="ansdimat-export.js?v=20260923c"></script></head>';

    const out = inlineExport(html, 'window.x = 1;');

    expect(out).toContain('<script>\nwindow.x = 1;\n</script>');
    expect(out).not.toContain('ansdimat-export.js');
  });

  test('подключение без метки по-прежнему встраивается', () => {
    const out = inlineExport('<script src="ansdimat-export.js"></script>', 'y();');

    expect(out).toBe('<script>\ny();\n</script>');
  });

  test('без подключения сборка останавливается, а не собирает страницу без экспорта', () => {
    expect(() => inlineExport('<head></head>', 'y();')).toThrow(/ansdimat-export\.js/);
  });
});

describe('картинки поставки', () => {
  const os = require('os');
  const { inlineImages } = require('../build-anssurf');

  /** Каталог поставки с одной картинкой */
  const delivery = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anssurf-'));
    fs.mkdirSync(path.join(dir, 'img'));
    fs.writeFileSync(path.join(dir, 'img', 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    return dir;
  };

  test('картинка из img/ встраивается в страницу', () => {
    // WebView открывает один файл из кэша, соседней папки img/ там нет —
    // ссылка на неё давала битую картинку
    const { html } = inlineImages('<img src="img/logo.png"><b>{img:`img/logo.png`}</b>', delivery());

    expect(html).not.toContain('img/logo.png');
    expect(html.split('data:image/png;base64,iVBORw==')).toHaveLength(3);
  });

  test('картинка, которой нет в поставке, попадает в отчёт', () => {
    const { html, missing } = inlineImages('{img:`img/home/tile.jpg`}', delivery());

    expect(missing).toEqual(['img/home/tile.jpg']);
    expect(html).toContain('img/home/tile.jpg');
  });

  test('хвост чужого адреса не принимается за картинку поставки', () => {
    const source = '<img src="https://ansdimat.com/img/logo.png">';

    expect(inlineImages(source, delivery()).html).toBe(source);
  });
});

describe('десктопная вёрстка', () => {
  const { desktopLayout } = require('../build-anssurf');

  test('тег <html> получает класс hydro-desktop', () => {
    // С поставки от 23.09 класс ставится только в Electron и по ?desktop=1,
    // а без него пропадают и вёрстка поставки, и весь скин
    expect(desktopLayout('<!DOCTYPE html>\n<html lang="ru">\n<head>')).toBe(
      '<!DOCTYPE html>\n<html lang="ru" class="hydro-desktop">\n<head>'
    );
  });

  test('к своим классам поставки добавляется, повторно не ставится', () => {
    expect(desktopLayout('<html lang="en" class="dark">')).toBe(
      '<html lang="en" class="hydro-desktop dark">'
    );
    expect(desktopLayout('<html class="hydro-desktop">')).toBe('<html class="hydro-desktop">');
  });

  test('без тега или с двумя сборка останавливается', () => {
    expect(() => desktopLayout('<head></head>')).toThrow(/<html>/);
    expect(() => desktopLayout('<html><html>')).toThrow(/<html>/);
  });
});
