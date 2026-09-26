/**
 * Руководство пользователя
 *
 * Раньше пункт «Руководство пользователя» в справке вёл на видеоуроки —
 * текстового руководства в приложении не было вовсе. Здесь оно и живёт:
 * порядок работы по каждому модулю, применяемые формулы и обозначения.
 *
 * Разделы свёрнуты: руководство длинное, а нужен обычно один раздел.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import I18n from '../Localization';
import { spacing, radius, type, elevation, fontFamily, brandHeader } from '../theme';
import { useContentMaxWidth } from '../lib/appPrefs';

/**
 * Разделы руководства
 *
 * Каждый блок раздела — либо абзац (text), либо нумерованные шаги (steps),
 * либо формула с расшифровкой (formula), либо строки глоссария (terms),
 * либо примечание (note).
 *
 * Порядок — как у работы в поле: журнал и его обработка, затем виды ОФР со
 * своей расчётной схемой, калькулятор, карты и дневник, обмен и настройки.
 * Названия вкладок, видов ОФР и переключателей берутся теми же ключами, что
 * на самих экранах, — переименуют их там, и руководство не отстанет.
 *
 * @returns {Array<Object>} разделы в порядке показа
 */
function buildSections() {
  return [
    {
      key: 'start',
      icon: 'play-circle-outline',
      title: I18n.t('manualStartTitle', { defaultValue: 'С чего начать' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualStartIntro', {
            defaultValue:
              'АНСДИМАТ — полевой инструмент гидрогеолога: журналы опытно-фильтрационных работ (ОФР) и их обработка, калькулятор, карты гидроизогипс и полевой дневник. Всё считается на устройстве и хранится в его памяти; интернет нужен только для подложки карт, входа в аккаунт и синхронизации.',
          }),
        },
        {
          type: 'steps',
          steps: [
            I18n.t('manualStartStep1', {
              defaultValue: '«Создать откачку» на главной: выберите вид ОФР, назовите журнал и нажмите «Создать».',
            }),
            I18n.t('manualStartStep2', {
              defaultValue: 'Внесите исходные данные опыта и замеры по ходу опробования.',
            }),
            I18n.t('manualStartStep3', {
              defaultValue: 'Обработка идёт сразу: график строится по мере ввода, параметры пересчитываются на лету.',
            }),
            I18n.t('manualStartStep4', {
              defaultValue:
                'Созданные журналы хранятся в «Архиве откачек» — плитка на главной ведёт прямо к их списку.',
            }),
          ],
        },
      ],
    },

    {
      key: 'journal',
      icon: 'edit-note',
      title: I18n.t('manualJournalTitle', { defaultValue: 'Журналы и архив откачек' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualJournalIntro', {
            defaultValue:
              'Журнал — это опыт целиком: вид ОФР, исходные данные, замеры и результат расчёта. Все журналы собраны на экране «Обработка откачек» в списке «Ранее созданные»; туда же ведёт плитка «Архив откачек» на главной.',
          }),
        },
        {
          type: 'terms',
          terms: [
            {
              term: I18n.t('ofr_single', { defaultValue: 'Одиночная' }),
              definition: I18n.t('manualTypeSingle', {
                defaultValue: 'Откачка из одной скважины: понижение и восстановление уровня в ней самой, водопроводимость T.',
              }),
            },
            {
              term: I18n.t('ofr_cluster', { defaultValue: 'Кустовая' }),
              definition: I18n.t('manualTypeCluster', {
                defaultValue:
                  'Опытная скважина и наблюдательные вокруг неё: по наблюдательным считаются ещё пьезопроводность a и водоотдача S.',
              }),
            },
            {
              term: I18n.t('ofr_slug', { defaultValue: 'Экспресс-откачка' }),
              definition: I18n.t('manualTypeSlug', {
                defaultValue: 'Мгновенный сдвиг уровня и его возврат — решение Бауэра — Райса.',
              }),
            },
            {
              term: I18n.t('ofr_lugeon', { defaultValue: 'Поинтервальные нагнетания' }),
              definition: I18n.t('manualTypeLugeon', {
                defaultValue: 'Нагнетание воды в интервал скважины ступенями давления — метод Люжона.',
              }),
            },
            {
              term: I18n.t('ofr_vadose', { defaultValue: 'Налив в шурф' }),
              definition: I18n.t('manualTypeVadose', {
                defaultValue: 'Опробование зоны аэрации — методы Болдырева и Биндемана.',
              }),
            },
          ],
        },
        {
          type: 'steps',
          steps: [
            I18n.t('manualJournalStep1', {
              defaultValue: 'Нажмите на журнал в списке, чтобы открыть его и продолжить ввод или обработку.',
            }),
            I18n.t('manualJournalStep2', {
              defaultValue: 'Звезда — закрепить журнал: избранные стоят в начале списка.',
            }),
            I18n.t('manualJournalStep3', {
              defaultValue:
                '«Поделиться» — отправить журнал файлом проекта или таблицей замеров, см. раздел «Обмен журналами».',
            }),
            I18n.t('manualJournalStep4', {
              defaultValue: 'Корзина — удалить журнал вместе с замерами; удаление всегда спрашивает подтверждение.',
            }),
          ],
        },
        {
          type: 'note',
          text: I18n.t('manualJournalNote', {
            defaultValue:
              'Время замеров вводится от начала откачки, понижение — разность статического и динамического уровня, всегда положительная величина.',
          }),
        },
      ],
    },

    {
      key: 'processing',
      icon: 'show-chart',
      title: I18n.t('manualProcessingTitle', { defaultValue: 'Обработка откачки' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualProcessingIntro', {
            defaultValue:
              'Одиночная и кустовая откачки обрабатываются методом Купера — Джейкоба: замеры откладываются в координатах «lg t — понижение», и по прямолинейному участку определяются параметры пласта.',
          }),
        },
        {
          type: 'formula',
          formula: 'T = 0,183 · Q / C',
          caption: I18n.t('manualFormulaT', {
            defaultValue:
              'T — водопроводимость, м²/сут; Q — дебит, м³/сут; C — наклон прямой: приращение понижения за логарифмический цикл времени, м.',
          }),
        },
        {
          type: 'steps',
          steps: [
            I18n.t('manualProcessingStep1', {
              defaultValue: 'Над графиком выберите ось времени: lg t, t или √t. Водопроводимость считается по оси lg t.',
            }),
            I18n.t('manualProcessingStep2', {
              defaultValue:
                '«По всем точкам» — прямая проводится методом наименьших квадратов. Чтобы отсечь начальный и конечный участки, отметьте две точки — кружками в таблице замеров или прямо на графике.',
            }),
            I18n.t('manualProcessingStep3', {
              defaultValue: '«Свободная прямая» — проведите прямую руками: тяните её точки, как на чертеже.',
            }),
            I18n.t('manualProcessingStep4', {
              defaultValue:
                'График масштабируется двумя пальцами и кнопками «+» и «−», сдвигается одним пальцем. «Сброс» возвращает исходный вид, кнопка с рамкой разворачивает график на весь экран.',
            }),
          ],
        },
        {
          type: 'note',
          text: I18n.t('manualProcessingNote', {
            defaultValue:
              'Начальные замеры искажает ёмкость ствола скважины, конечные — влияние границ пласта. Прямолинейный участок обычно лежит между ними: его и стоит отмечать двумя точками. Какой участок выбрать, подскажет «Диагностика».',
          }),
        },
      ],
    },

    {
      key: 'diagnostics',
      icon: 'insights',
      title: I18n.t('diagnosticChart', { defaultValue: 'Диагностика режима' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualDiagIntro', {
            defaultValue:
              'Вкладка «Диагностика» над графиком строит понижение и его производную ds/d(ln t) в логарифмическом масштабе. По форме производной видно, какой режим был на каждом участке опыта и по каким точкам вести прямую.',
          }),
        },
        {
          type: 'terms',
          terms: [
            {
              term: I18n.t('regimeRadial', { defaultValue: 'Радиальный поток' }),
              definition: I18n.t('manualDiagRadial', {
                defaultValue:
                  'Производная держится на полке: формула Купера — Джейкоба применима, прямую ведут по этому участку.',
              }),
            },
            {
              term: I18n.t('regimeBarrier', { defaultValue: 'Непроницаемая граница' }),
              definition: I18n.t('manualDiagBarrier', {
                defaultValue:
                  'Полка производной поднялась примерно вдвое: понижение дошло до границы пласта. T считают по раннему участку.',
              }),
            },
            {
              term: I18n.t('regimeRecharge', { defaultValue: 'Подпитка пласта' }),
              definition: I18n.t('manualDiagRecharge', {
                defaultValue:
                  'Производная падает: в пласт поступает вода — переток или близкий водоём. Берите участок до перегиба.',
              }),
            },
            {
              term: I18n.t('regimeWellbore', { defaultValue: 'Работает ствол скважины' }),
              definition: I18n.t('manualDiagWellbore', {
                defaultValue:
                  'Производная растёт под 45°: откачивается вода из самого ствола, пласт ещё не включился. По этим замерам считать нельзя.',
              }),
            },
          ],
        },
        {
          type: 'note',
          text: I18n.t('manualDiagNote', {
            defaultValue:
              'Нужно не меньше пяти замеров, разнесённых по времени в несколько раз: 1, 2, 5, 10, 30 минут. Режим приложение подпишет под графиком само.',
          }),
        },
      ],
    },

    {
      key: 'recovery',
      icon: 'trending-up',
      title: I18n.t('manualRecoveryTitle', { defaultValue: 'Восстановление уровня' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualRecoveryIntro', {
            defaultValue:
              'Вторая половина опыта: насос остановлен, уровень возвращается. Её выгодно обрабатывать — колебания дебита на откачке здесь уже ничего не портят.',
          }),
        },
        {
          type: 'formula',
          formula: 's′ = 0,183 · Q / T · lg(t / t′)',
          caption: I18n.t('manualFormulaRecovery', {
            defaultValue:
              's′ — остаточное понижение, м; t — время от начала откачки; t′ — время от остановки насоса.',
          }),
        },
        {
          type: 'steps',
          steps: [
            I18n.t('manualRecoveryStep1', {
              defaultValue: 'В обработке переключитесь на «Восстановление».',
            }),
            I18n.t('manualRecoveryStep2', {
              defaultValue:
                'Длительность откачки и понижение на остановке подставляются из журнала откачки — проверьте их.',
            }),
            I18n.t('manualRecoveryStep3', {
              defaultValue:
                'Во второй таблице ведите журнал восстановления: время t′ от остановки насоса и подъём уровня от момента остановки — значения растут от нуля.',
            }),
            I18n.t('manualRecoveryStep4', {
              defaultValue: 'Остаточное понижение приложение считает само: понижение на остановке минус подъём.',
            }),
          ],
        },
        {
          type: 'note',
          text: I18n.t('manualRecoveryNote', {
            defaultValue:
              'Прямая восстановления должна проходить через начало координат; заметный сдвиг — признак влияния границ пласта или непостоянного дебита, приложение об этом предупредит. Опыт считается законченным, когда остаточное понижение меньше 5 % от понижения на остановке.',
          }),
        },
      ],
    },

    {
      key: 'cluster',
      icon: 'hub',
      title: I18n.t('manualClusterTitle', { defaultValue: 'Кустовая откачка' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualClusterIntro', {
            defaultValue:
              'Куст — опытная скважина и одна или несколько наблюдательных. У каждой скважины свой журнал замеров, расстояния от опытной до наблюдательных задаются в таблице.',
          }),
        },
        {
          type: 'steps',
          steps: [
            I18n.t('manualClusterStep1', {
              defaultValue:
                'При создании куста назовите опытную и первую наблюдательную скважину. Пустые поля получат имена «w» и «p», как в настольном АНСДИМАТ.',
            }),
            I18n.t('manualClusterStep2', {
              defaultValue: 'Наблюдательные скважины можно добавить и потом; опытная в опробовании одна.',
            }),
            I18n.t('manualClusterStep3', {
              defaultValue: 'Переключайте скважины над журналом: график и расчёт идут по той, что открыта.',
            }),
            I18n.t('manualClusterStep4', {
              defaultValue:
                'По наблюдательной скважине кроме T считаются пьезопроводность a и водоотдача S — для них нужно расстояние до опытной.',
            }),
          ],
        },
      ],
    },

    {
      key: 'slug',
      icon: 'bolt',
      title: I18n.t('slugTitle', { defaultValue: 'Экспресс-опробование' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualSlugIntro', {
            defaultValue:
              'Уровень в скважине мгновенно сдвигают — подливом, сбросом или вытеснителем — и следят, как он возвращается. Обработка по решению Бауэра — Райса.',
          }),
        },
        {
          type: 'steps',
          steps: [
            I18n.t('manualSlugStep1', {
              defaultValue:
                'Задайте геометрию скважины: радиус фильтра r_w, радиус обсадной трубы r_c, длину фильтра l_w, расстояние от уровня грунтовых вод до середины фильтра LT_w и обводнённую мощность m.',
            }),
            I18n.t('manualSlugStep2', {
              defaultValue: 'Укажите скачок понижения s⁰ — насколько уровень сместился в начале опыта.',
            }),
            I18n.t('manualSlugStep3', {
              defaultValue:
                'В журнал вносите время и подъём уровня — насколько он уже вернулся: значения растут от нуля до s⁰.',
            }),
            I18n.t('manualSlugStep4', {
              defaultValue:
                'По прямой lg(s⁰/s) — t считается коэффициент фильтрации; радиус влияния подбирается по схеме скважины сам.',
            }),
          ],
        },
        {
          type: 'formula',
          formula: 'k = 2,3 · r_c² / (2 · l_w) · C · ln(R / r_w)',
          caption: I18n.t('manualFormulaSlug', {
            defaultValue: 'C — наклон прямой lg(s⁰/s) — t; R — радиус влияния по коэффициентам A₁—A₃.',
          }),
        },
        {
          type: 'note',
          text: I18n.t('manualSlugNote', {
            defaultValue:
              'Если на графике два прямолинейных участка, считают по второму: первый говорит о нарушенной зоне вокруг скважины или о перетекании.',
          }),
        },
      ],
    },

    {
      key: 'lugeon',
      icon: 'compress',
      title: I18n.t('lugeonTitle', { defaultValue: 'Поинтервальное нагнетание' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualLugeonIntro', {
            defaultValue:
              'Метод Люжона: воду нагнетают в изолированный интервал скважины ступенями давления и по расходу на каждой ступени оценивают проницаемость трещиноватых пород.',
          }),
        },
        {
          type: 'steps',
          steps: [
            I18n.t('manualLugeonStep1', {
              defaultValue: 'Задайте радиус скважины r_w, длину интервала l_w и промежуток между отсчётами расходомера.',
            }),
            I18n.t('manualLugeonStep2', {
              defaultValue:
                'Для каждой ступени впишите давление ΔP и показания расходомера нарастающим итогом (120, 138, 157…), а не прирост за промежуток.',
            }),
            I18n.t('manualLugeonStep3', {
              defaultValue:
                'Стандартная схема — пять ступеней по 10 минут: 0,5, 0,75, 1, 0,75 и 0,5 от максимального давления.',
            }),
            I18n.t('manualLugeonStep4', {
              defaultValue:
                'Приложение считает средний расход, Lu на каждой ступени и k по формуле Мойе или Тима, определяет вид зависимости «расход — давление» и представительное Lu.',
            }),
          ],
        },
        {
          type: 'formula',
          formula: 'Lu = Q / l_w · P₀ / ΔP',
          caption: I18n.t('manualFormulaLu', {
            defaultValue: 'Q — л/мин, l_w — м, P₀ = 1 МПа. Оценочно 1 Lu ≈ 0,011 м/сут.',
          }),
        },
        {
          type: 'note',
          text: I18n.t('manualLugeonNote', {
            defaultValue:
              'Вид зависимости — ламинарный или турбулентный поток, раскрытие трещин, размыв, заполнение — определяется по пяти ступеням: три на подъёме давления и две на спуске.',
          }),
        },
      ],
    },

    {
      key: 'vadose',
      icon: 'water-drop',
      title: I18n.t('vadoseTitle', { defaultValue: 'Налив в шурф' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualVadoseIntro', {
            defaultValue:
              'Опробование зоны аэрации: в шурф доливают воду, держа постоянный слой, и по расходу оценивают коэффициент фильтрации.',
          }),
        },
        {
          type: 'terms',
          terms: [
            {
              term: I18n.t('vadoseMethodBoldyrevName', { defaultValue: 'Болдырев' }),
              definition: I18n.t('manualVadoseBoldyrev', {
                defaultValue:
                  'k = Q / F — расход, делённый на площадь инфильтрации. Для двух колец (метод Нестерова) F — площадь внутреннего кольца.',
              }),
            },
            {
              term: I18n.t('vadoseMethodBindemanName', { defaultValue: 'Биндеман' }),
              definition: I18n.t('manualVadoseBindeman', {
                defaultValue:
                  'k = Q · z / (F · (H + H_c + z)) — учитывает глубину просачивания z, слой воды H и капиллярное поднятие H_c.',
              }),
            },
          ],
        },
        {
          type: 'steps',
          steps: [
            I18n.t('manualVadoseStep1', {
              defaultValue:
                'Задайте расход Q — или налитый объём ΔV вместе с интервалом Δt — и площадь инфильтрации F.',
            }),
            I18n.t('manualVadoseStep2', {
              defaultValue:
                'Для Биндемана укажите слой воды в шурфе H (по методу около 10 см) и глубину просачивания z на конец опыта.',
            }),
            I18n.t('manualVadoseStep3', {
              defaultValue:
                'Капиллярное поднятие можно взять по справочнику, выбрав породу, но замеренное лучше вписать руками.',
            }),
          ],
        },
        {
          type: 'note',
          text: I18n.t('manualVadoseNote', {
            defaultValue: 'Без капиллярных сил результат завышен: вся движущая сила приписана гравитации.',
          }),
        },
      ],
    },

    {
      key: 'calculator',
      icon: 'calculate',
      title: I18n.t('manualCalculatorTitle', { defaultValue: 'Калькулятор' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualCalculatorIntro', {
            defaultValue:
              'Вкладки для быстрых расчётов, когда полного журнала нет: достаточно нескольких величин из полевой книжки.',
          }),
        },
        {
          type: 'terms',
          terms: [
            {
              term: I18n.t('tabFlow', { defaultValue: 'Пересчёт Q' }),
              definition: I18n.t('manualCalcFlow', {
                defaultValue:
                  'Перевод расхода между единицами — метрическими, британскими и американскими, массовыми (по плотности). Нажмите строку, чтобы вводить в её единице.',
              }),
            },
            {
              term: I18n.t('tabFiltration', { defaultValue: 'Пересчёт k' }),
              definition: I18n.t('manualCalcFiltration', {
                defaultValue: 'Перевод коэффициента фильтрации: м/сут, м/с, см/с, фт/сут, мейнцеры и другие единицы.',
              }),
            },
            {
              term: I18n.t('tabParams', { defaultValue: 'Оценка по Q/s' }),
              definition: I18n.t('manualCalcParams', {
                defaultValue:
                  'Водопроводимость напорного или коэффициент фильтрации безнапорного пласта по удельному дебиту Q/s — формулы настольного АНСДИМАТ, с поправкой на несовершенство скважины.',
              }),
            },
            {
              term: I18n.t('tabForecast', { defaultValue: 'Расчёт понижения' }),
              definition: I18n.t('manualCalcForecast', {
                defaultValue:
                  'Понижение в опытной и наблюдательной скважинах по четырём схемам: Тейс, пласт с перетеканием, безнапорный пласт Болтона, граница питания. Показывает запас до допустимого понижения.',
              }),
            },
            {
              term: I18n.t('tabPit', { defaultValue: 'Котлован' }),
              definition: I18n.t('manualCalcPit', {
                defaultValue:
                  'Приток воды в котлован в безнапорном и напорном пласте, с рекой и без: контур заменяется «большим колодцем» эквивалентного радиуса.',
              }),
            },
            {
              term: I18n.t('tabWhpa', { defaultValue: 'ЗСО' }),
              definition: I18n.t('manualCalcWhpa', {
                defaultValue:
                  'Пояса зоны санитарной охраны водозабора: аналитически в естественном потоке или по объёму отобранной воды. План поясов на карте с координатами поворотных точек и оценка защищённости горизонта.',
              }),
            },
          ],
        },
        {
          type: 'note',
          text: I18n.t('manualCalculatorNote', {
            defaultValue:
              'Оценка по Q/s даёт порядок величины по одному замеру: множители 1,22 и 2,43 уже содержат типичное отношение радиуса влияния к радиусу скважины. Точные параметры даёт обработка журнала откачки.',
          }),
        },
      ],
    },

    {
      key: 'maps',
      icon: 'layers',
      title: I18n.t('maps', { defaultValue: 'Карты гидроизогипс' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualMapsIntro', {
            defaultValue:
              'Построитель карт AnsSurf: по уровням в скважинах строит изолинии поверх подложки OpenStreetMap и выгружает результат в форматы, которые понимает настольный АНСДИМАТ.',
          }),
        },
        {
          type: 'steps',
          steps: [
            I18n.t('manualMapsStep1', {
              defaultValue:
                '«Данные» — загрузите таблицу уровней (TXT, DAT, XYZ, CSV, XLS, XLSX: колонки X, Y и УГВ), укажите скважины на карте вручную или откройте сохранённый проект. Для знакомства есть пример на 20 скважин.',
            }),
            I18n.t('manualMapsStep2', {
              defaultValue: '«Скважины» — проверьте точки и поправьте ошибочные.',
            }),
            I18n.t('manualMapsStep3', {
              defaultValue: '«Изогипсы» — постройте карту изолиний уровня по скважинам.',
            }),
            I18n.t('manualMapsStep4', {
              defaultValue: '«Выгрузка» — сохраните или отправьте файлы для настольной программы.',
            }),
          ],
        },
        {
          type: 'note',
          text: I18n.t('manualMapsNote', {
            defaultValue: 'Подложке карты нужен интернет; скважины и изолинии от него не зависят.',
          }),
        },
      ],
    },

    {
      key: 'diary',
      icon: 'place',
      title: I18n.t('manualDiaryTitle', { defaultValue: 'Полевой дневник' }),
      blocks: [
        {
          type: 'steps',
          steps: [
            I18n.t('manualDiaryStep1', {
              defaultValue:
                'Введите название точки, опишите её и выберите тип: скважина, родник, шурф, наблюдение.',
            }),
            I18n.t('manualDiaryStep2', {
              defaultValue: 'Нажмите на карту в нужном месте — точка встанет по координатам нажатия.',
            }),
            I18n.t('manualDiaryStep3', {
              defaultValue:
                'Кнопка «Отметить моё местоположение» ставит точку по координатам устройства, кружок на карте только подводит карту к вам. Карту можно развернуть на весь экран.',
            }),
            I18n.t('manualDiaryStep4', {
              defaultValue:
                'Описание правится и потом — прямо в списке под точкой. Написанное сохраняется само, отдельной кнопки нет.',
            }),
            I18n.t('manualDiaryStep5', {
              defaultValue:
                'Скрепка у точки открывает вложения: снимки с камеры или из галереи и голосовые заметки. Запись начинается касанием «Запись» и останавливается вторым касанием.',
            }),
          ],
        },
        {
          type: 'note',
          text: I18n.t('manualDiaryNote', {
            defaultValue:
              'Карта подгружается из интернета, но уже отмеченные точки, их координаты и вложения хранятся на устройстве и доступны без связи.',
          }),
        },
      ],
    },

    {
      key: 'exchange',
      icon: 'swap-horiz',
      title: I18n.t('manualExchangeTitle', { defaultValue: 'Обмен журналами' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualExchangeIntro', {
            defaultValue:
              'Журналом можно поделиться с коллегой или перенести его на другое устройство без аккаунта — файлом проекта.',
          }),
        },
        {
          type: 'steps',
          steps: [
            I18n.t('manualExchangeStep1', {
              defaultValue: 'В списке журналов нажмите «Поделиться» и выберите вид выгрузки.',
            }),
            I18n.t('manualExchangeStep2', {
              defaultValue:
                '«Файл проекта (.ansdimat)» переносит журнал целиком: скважины, обе фазы замеров, исходные данные и результаты.',
            }),
            I18n.t('manualExchangeStep3', {
              defaultValue: '«Таблица замеров (текст)» — замеры и результаты для отчёта: таблицу можно вставить в Excel.',
            }),
            I18n.t('manualExchangeStep4', {
              defaultValue:
                'Присланный файл откройте нажатием в мессенджере или почте — или кнопкой «Импорт» над списком журналов.',
            }),
          ],
        },
        {
          type: 'note',
          text: I18n.t('manualExchangeNote', {
            defaultValue:
              'Если журнал из этого файла уже есть, приложение предложит заменить его, создать копию или открыть имеющийся.',
          }),
        },
      ],
    },

    {
      key: 'settings',
      icon: 'settings',
      title: I18n.t('settings', { defaultValue: 'Настройки' }),
      blocks: [
        {
          type: 'terms',
          terms: [
            {
              term: I18n.t('theme', { defaultValue: 'Тема' }),
              definition: I18n.t('manualSettingsTheme', {
                defaultValue: 'Светлая, тёмная или как в системе телефона.',
              }),
            },
            {
              term: I18n.t('appLanguage', { defaultValue: 'Язык интерфейса' }),
              definition: I18n.t('manualSettingsLanguage', {
                defaultValue: 'Русский или английский; сайт АНСДИМАТ по ссылкам открывается на том же языке.',
              }),
            },
            {
              term: I18n.t('unitsSection', { defaultValue: 'Размерности' }),
              definition: I18n.t('manualSettingsUnits', {
                defaultValue:
                  'Единицы для ввода и результатов. Расчёт идёт в базовых единицах, уже введённые данные не меняются.',
              }),
            },
            {
              term: I18n.t('settingTablet', { defaultValue: 'Адаптация под планшет' }),
              definition: I18n.t('manualSettingsTablet', {
                defaultValue:
                  'На широком экране содержимое собирается в колонку по центру; выключите, чтобы отдать ему всю ширину.',
              }),
            },
            {
              term: I18n.t('settingAutoLocation', { defaultValue: 'Автоопределение координат' }),
              definition: I18n.t('manualSettingsLocation', {
                defaultValue: 'Дневник сам подводит карту к вам, если доступ к геопозиции уже выдан.',
              }),
            },
          ],
        },
      ],
    },

    {
      key: 'account',
      icon: 'cloud-sync',
      title: I18n.t('manualAccountTitle', { defaultValue: 'Аккаунт и синхронизация' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualAccountIntro', {
            defaultValue:
              'Без аккаунта приложение полностью работоспособно: журналы, замеры и точки хранятся в памяти устройства. Аккаунт нужен, чтобы те же данные открывались на другом телефоне или планшете.',
          }),
        },
        {
          type: 'steps',
          steps: [
            I18n.t('manualAccountStep1', {
              defaultValue: '«Настройки» → «Войти в аккаунт»: вход по почте и паролю или регистрация.',
            }),
            I18n.t('manualAccountStep2', {
              defaultValue:
                'Синхронизация идёт сама — при входе, при возвращении в приложение и вскоре после правок. Кнопка «Синхронизировать» на экране аккаунта запускает её сразу.',
            }),
          ],
        },
      ],
    },

    {
      key: 'glossary',
      icon: 'menu-book',
      title: I18n.t('manualGlossaryTitle', { defaultValue: 'Обозначения' }),
      blocks: [
        {
          type: 'terms',
          terms: [
            { term: 'Q', definition: I18n.t('manualTermQ', { defaultValue: 'Дебит скважины, м³/сут' }) },
            { term: 's', definition: I18n.t('manualTermS', { defaultValue: 'Понижение уровня, м' }) },
            { term: 's′', definition: I18n.t('manualTermSResidual', { defaultValue: 'Остаточное понижение после остановки насоса, м' }) },
            {
              term: 's⁰',
              definition: I18n.t('manualTermS0', {
                defaultValue: 'Понижение на остановке насоса; в экспресс-опробовании — скачок уровня, м',
              }),
            },
            {
              term: 't, t′',
              definition: I18n.t('manualTermTime', { defaultValue: 'Время от начала откачки и от остановки насоса' }),
            },
            { term: 'T', definition: I18n.t('manualTermT', { defaultValue: 'Водопроводимость, м²/сут' }) },
            { term: 'k', definition: I18n.t('manualTermK', { defaultValue: 'Коэффициент фильтрации, м/сут' }) },
            { term: 'm', definition: I18n.t('manualTermM', { defaultValue: 'Мощность водоносного пласта, м' }) },
            { term: 'C', definition: I18n.t('manualTermC', { defaultValue: 'Наклон прямой, м на логарифмический цикл' }) },
            { term: 'a', definition: I18n.t('manualTermA', { defaultValue: 'Пьезопроводность, м²/сут' }) },
            { term: 'S', definition: I18n.t('manualTermStorativity', { defaultValue: 'Водоотдача, безразмерная' }) },
            { term: 'r_w', definition: I18n.t('manualTermRw', { defaultValue: 'Радиус скважины (фильтра), м' }) },
            {
              term: 'r',
              definition: I18n.t('manualTermRObs', { defaultValue: 'Расстояние от опытной до наблюдательной скважины, м' }),
            },
            { term: 'R', definition: I18n.t('manualTermR', { defaultValue: 'Радиус влияния, м' }) },
            {
              term: 'Lu',
              definition: I18n.t('manualTermLu', {
                defaultValue: 'Единица Люжона: 1 л/мин на метр интервала при избыточном давлении 1 МПа',
              }),
            },
            { term: 'W(u)', definition: I18n.t('manualTermW', { defaultValue: 'Функция скважины Тейса, безразмерная' }) },
          ],
        },
      ],
    },
  ];
}

export default function UserManualScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const sections = useMemo(() => buildSections(), []);
  // Первый раздел раскрыт: пустой аккордеон выглядит как пустой экран
  const [openKey, setOpenKey] = useState(sections[0].key);

  // «Адаптация под планшет» в настройках: колонка по центру или вся ширина
  const column = useContentMaxWidth(640);
  const contentMaxWidth = width >= 700 ? column : undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor={brandHeader} barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, contentMaxWidth && { maxWidth: contentMaxWidth }]}>
          <Text style={[type.eyebrow, { color: colors.textSecondary }]}>
            {I18n.t('manualEyebrow', { defaultValue: 'Как пользоваться' })}
          </Text>
          <Text style={[type.display, styles.title, { color: colors.text }]}>
            {I18n.t('aboutManual', { defaultValue: 'Руководство пользователя' })}
          </Text>

          {sections.map((section) => {
            const open = section.key === openKey;
            return (
              <View
                key={section.key}
                style={[
                  styles.card,
                  elevation.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <TouchableOpacity
                  style={styles.cardHead}
                  onPress={() => setOpenKey(open ? null : section.key)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={section.title}
                >
                  <MaterialIcons name={section.icon} size={22} color={colors.primaryAccent} />
                  <Text style={[type.cardTitle, styles.cardTitle, { color: colors.text }]}>
                    {section.title}
                  </Text>
                  <MaterialIcons
                    name={open ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                {open && (
                  <View style={styles.cardBody}>
                    {section.blocks.map((block, index) => (
                      <ManualBlock key={index} block={block} colors={colors} />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Один блок раздела
 *
 * @param {Object} block - описание блока
 * @param {Object} colors - цвета активной темы
 */
function ManualBlock({ block, colors }) {
  if (block.type === 'text') {
    return <Text style={[type.body, { color: colors.textSecondary }]}>{block.text}</Text>;
  }

  if (block.type === 'steps') {
    return (
      <View style={styles.steps}>
        {block.steps.map((step, index) => (
          <View key={index} style={styles.step}>
            <View style={[styles.stepBadge, { backgroundColor: colors.primaryWash }]}>
              <Text style={[styles.stepNumber, { color: colors.primaryAccent }]}>{index + 1}</Text>
            </View>
            <Text style={[type.body, styles.stepText, { color: colors.textSecondary }]}>{step}</Text>
          </View>
        ))}
      </View>
    );
  }

  if (block.type === 'formula') {
    return (
      <View style={[styles.formula, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
        <Text style={[type.numeric, styles.formulaText, { color: colors.text }]}>{block.formula}</Text>
        <Text style={[type.caption, { color: colors.textSecondary }]}>{block.caption}</Text>
      </View>
    );
  }

  if (block.type === 'terms') {
    return (
      <View style={styles.terms}>
        {block.terms.map((item) => (
          <View key={item.term} style={styles.term}>
            <Text style={[type.numeric, styles.termName, { color: colors.primaryAccent }]}>
              {item.term}
            </Text>
            <Text style={[type.caption, styles.termText, { color: colors.textSecondary }]}>
              {item.definition}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  // note
  return (
    <View style={[styles.note, { borderLeftColor: colors.primaryAccent }]}>
      <Text style={[type.caption, { color: colors.textSecondary }]}>{block.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 128,
    alignItems: 'center',
  },
  content: { width: '100%' },

  title: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },

  card: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardTitle: { flex: 1 },
  cardBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },

  steps: { gap: spacing.md },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: { flex: 1 },

  formula: {
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.xs,
  },
  formulaText: {
    fontSize: 17,
    fontFamily: fontFamily.monoSemibold,
  },

  terms: { gap: spacing.md },
  // Термин и пояснение идут друг под другом, а не в две колонки: длинное
  // название забирало полстроки, и описание рвалось на обрывки по два слова
  term: {
    gap: 2,
  },
  termName: {
    fontFamily: fontFamily.monoSemibold,
  },
  termText: {
    lineHeight: 19,
  },

  note: {
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
  },
});
