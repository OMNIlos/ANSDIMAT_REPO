/**
 * Имя и номер релиза
 *
 * Релизы называются, как версии Android: у каждого своё имя, одно на все
 * языки. Первый — Moonflower. Имя видно на заставке при запуске и в справке.
 *
 * Номер берётся из app.json — тот же, что уходит в сборку, — чтобы справка
 * не расходилась с магазином. Выпуская следующий релиз, поменяйте имя здесь
 * и версию в app.json.
 */

import appConfig from '../app.json';

export const RELEASE_NAME = 'Moonflower';

export const RELEASE_VERSION = appConfig?.expo?.version ?? '1.0.0';
