/**
 * Проверка распознавания входящих ссылок
 *
 * Приложение слушает все ссылки, которыми его открывают, поэтому важно, что
 * именно оно считает файлом проекта. Ошибка в обе стороны заметна: пропустив
 * свой файл, приложение молча ничего не сделает; приняв чужую ссылку, оно
 * покажет диалог там, где его не ждали.
 */

import { classifyIncomingUrl } from '../incomingFile';

describe('classifyIncomingUrl', () => {
  test('файл с нашим расширением принимается', () => {
    expect(classifyIncomingUrl('file:///var/mobile/Inbox/Куст.ansdimat')).toEqual({
      uri: 'file:///var/mobile/Inbox/Куст.ansdimat',
      certain: true,
    });
  });

  test('процентное кодирование в пути не мешает узнать расширение', () => {
    const url = 'file:///data/user/0/cache/%D0%9A%D1%83%D1%81%D1%82%20%E2%84%963.ansdimat';
    expect(classifyIncomingUrl(url)?.certain).toBe(true);
  });

  test('строка запроса не мешает узнать расширение', () => {
    expect(classifyIncomingUrl('content://media/external/file.ansdimat?id=42')?.certain).toBe(true);
  });

  test('расширение в верхнем регистре тоже наше', () => {
    expect(classifyIncomingUrl('file:///tmp/Kust.ANSDIMAT')?.certain).toBe(true);
  });

  test('чужой файл не наш', () => {
    expect(classifyIncomingUrl('file:///tmp/report.pdf')).toBeNull();
    expect(classifyIncomingUrl('file:///tmp/data.json')).toBeNull();
  });

  test('безымянная ссылка от поставщика документов берётся, но без уверенности', () => {
    // Провайдеры Android прячут имя файла. Читать такую ссылку надо, но если
    // внутри окажется не наш файл — промолчать, а не показывать ошибку
    const result = classifyIncomingUrl('content://com.android.providers.downloads/document/msf%3A42');
    expect(result).toEqual({
      uri: 'content://com.android.providers.downloads/document/msf%3A42',
      certain: false,
    });
  });

  test('собственная схема приложения — не файл', () => {
    // По ней приходят обычные deep-link, и диалог импорта на них не нужен
    expect(classifyIncomingUrl('ansdimat://project/42')).toBeNull();
  });

  test('обычные ссылки игнорируются', () => {
    expect(classifyIncomingUrl('https://ansdimat.com/file.ansdimat')).toBeNull();
    expect(classifyIncomingUrl('mailto:geo@example.com')).toBeNull();
  });

  test('пустая ссылка не роняет разбор', () => {
    expect(classifyIncomingUrl(null)).toBeNull();
    expect(classifyIncomingUrl(undefined)).toBeNull();
    expect(classifyIncomingUrl('')).toBeNull();
    expect(classifyIncomingUrl(42)).toBeNull();
  });

  test('битое процентное кодирование не роняет разбор', () => {
    expect(classifyIncomingUrl('file:///tmp/%E0%A4%A.ansdimat')?.certain).toBe(true);
  });
});
