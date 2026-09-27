/**
 * SHA-256 на чистом JavaScript
 *
 * Своя реализация вместо `expo-crypto` по двум причинам. Первая: нативный
 * модуль пришлось бы подменять заглушкой в Jest, и проверялась бы заглушка,
 * а не подсчёт суммы. Вторая: сумма должна сходиться на всех платформах, где
 * открывается файл, — свой код даёт одинаковый ответ и на телефоне, и в
 * веб-сборке, и в тестах.
 *
 * Задача здесь не криптографическая: сумма ловит порчу файла при пересылке,
 * а не подделку. Но именно sha-256, а не самодельная свёртка: алгоритм
 * известный, и известные векторы дают чем проверить реализацию.
 */

/** Константы раундов: дробные части кубических корней первых 64 простых */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Начальное состояние: дробные части квадратных корней первых восьми простых */
const INITIAL = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

/**
 * Циклический сдвиг вправо
 *
 * @param {number} value - 32-битное слово
 * @param {number} bits - на сколько сдвинуть
 * @returns {number} результат
 */
function rotr(value, bits) {
  return (value >>> bits) | (value << (32 - bits));
}

/**
 * Кодирует строку в UTF-8
 *
 * Своя кодировка, а не `TextEncoder`: наличие последнего в Hermes зависит от
 * версии рантайма, и падать из-за этого посреди экспорта нельзя.
 *
 * Непарные суррогаты заменяются на U+FFFD — так же поступает `TextEncoder`.
 * Молча пропустить их нельзя: сумма отправителя и получателя разошлась бы.
 *
 * @param {string} text - исходная строка
 * @returns {number[]} байты
 */
function utf8Bytes(text) {
  const bytes = [];

  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code > 0xdfff) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      // Суррогатная пара: старший идёт первым, младший следом
      const low = index + 1 < text.length ? text.charCodeAt(index + 1) : 0;
      const paired = code <= 0xdbff && low >= 0xdc00 && low <= 0xdfff;

      if (paired) {
        const point = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        bytes.push(
          0xf0 | (point >> 18),
          0x80 | ((point >> 12) & 0x3f),
          0x80 | ((point >> 6) & 0x3f),
          0x80 | (point & 0x3f),
        );
        index++;
      } else {
        bytes.push(0xef, 0xbf, 0xbd);
      }
    }
  }

  return bytes;
}

/**
 * Считает sha-256 от строки
 *
 * @param {string} text - исходная строка
 * @returns {string} 64 шестнадцатеричных знака в нижнем регистре
 */
export function sha256Hex(text) {
  const bytes = utf8Bytes(String(text));
  const bitLength = bytes.length * 8;

  // Дополнение по стандарту: бит 1, нули до 56 байт по модулю 64,
  // затем длина в битах 64-битным числом со старшего конца
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);

  // Длина сообщения в байтах в JS заведомо меньше 2^53, поэтому старшее
  // слово считается делением, а не сдвигом: сдвиги в JS работают с 32 битами
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  bytes.push(
    (high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff,
    (low >>> 24) & 0xff, (low >>> 16) & 0xff, (low >>> 8) & 0xff, low & 0xff,
  );

  const hash = INITIAL.slice();
  const w = new Uint32Array(64);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const at = offset + i * 4;
      w[i] =
        ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
    }

    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  let hex = '';
  for (let i = 0; i < hash.length; i++) {
    hex += hash[i].toString(16).padStart(8, '0');
  }
  return hex;
}
