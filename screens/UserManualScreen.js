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

/**
 * Разделы руководства
 *
 * Каждый блок раздела — либо абзац (text), либо нумерованные шаги (steps),
 * либо формула с расшифровкой (formula), либо строки глоссария (terms).
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
              'АНСДИМАТ — полевой инструмент гидрогеолога: журнал опытно-фильтрационных работ (ОФР), обработка замеров и расчёты параметров водоносного пласта. Всё считается на устройстве и хранится локально, интернет нужен только для входа в аккаунт и синхронизации.',
          }),
        },
        {
          type: 'steps',
          steps: [
            I18n.t('manualStartStep1', {
              defaultValue: '«Создать откачку» — заведите журнал: выберите тип ОФР и назовите проект.',
            }),
            I18n.t('manualStartStep2', {
              defaultValue: 'Заполните паспорт опыта: дебит, радиус скважины, мощность пласта.',
            }),
            I18n.t('manualStartStep3', {
              defaultValue: 'Вносите замеры «время — понижение» по ходу откачки.',
            }),
            I18n.t('manualStartStep4', {
              defaultValue: 'Откройте обработку: график строится сам, параметры пересчитываются на лету.',
            }),
          ],
        },
      ],
    },

    {
      key: 'journal',
      icon: 'edit-note',
      title: I18n.t('manualJournalTitle', { defaultValue: 'Журнал ОФР' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualJournalIntro', {
            defaultValue:
              'Журнал — это опыт целиком: паспорт скважины, условия опробования и таблица замеров. Журналы не удаляются случайно: удаление всегда спрашивает подтверждение, а вместе с журналом удаляются и его замеры.',
          }),
        },
        {
          type: 'steps',
          steps: [
            I18n.t('manualJournalStep1', {
              defaultValue: 'Карандаш у журнала — вернуться к вводу данных и правке замеров.',
            }),
            I18n.t('manualJournalStep2', {
              defaultValue: 'График — перейти к обработке и расчёту параметров.',
            }),
            I18n.t('manualJournalStep3', {
              defaultValue: 'Звезда — пометить журнал важным, он поднимется в начало списка.',
            }),
            I18n.t('manualJournalStep4', {
              defaultValue: 'Стрелка — выгрузить журнал вместе с замерами и передать коллеге.',
            }),
          ],
        },
        {
          type: 'note',
          text: I18n.t('manualJournalNote', {
            defaultValue:
              'Время замеров вводится от начала откачки. Понижение — разность между статическим и динамическим уровнем, всегда положительная величина.',
          }),
        },
      ],
    },

    {
      key: 'processing',
      icon: 'show-chart',
      title: I18n.t('manualProcessingTitle', { defaultValue: 'Обработка ОФР' }),
      blocks: [
        {
          type: 'text',
          text: I18n.t('manualProcessingIntro', {
            defaultValue:
              'Обработка идёт методом Купера — Джейкоба: замеры откладываются в полулогарифмических координатах «lg t — понижение», и по прямолинейному участку определяются параметры пласта.',
          }),
        },
        {
          type: 'formula',
          formula: 'T = 0,183 · Q / a',
          caption: I18n.t('manualFormulaT', {
            defaultValue:
              'T — водопроводимость, м²/сут; Q — дебит, м³/сут; a — наклон прямой, м на логарифмический цикл.',
          }),
        },
        {
          type: 'formula',
          formula: 'k = T / m',
          caption: I18n.t('manualFormulaK', {
            defaultValue: 'k — коэффициент фильтрации, м/сут; m — мощность водоносного пласта, м.',
          }),
        },
        {
          type: 'steps',
          steps: [
            I18n.t('manualProcessingStep1', {
              defaultValue:
                'По умолчанию прямая проводится методом наименьших квадратов по всем замерам.',
            }),
            I18n.t('manualProcessingStep2', {
              defaultValue:
                'Чтобы отсечь начальный и конечный участки, переключитесь на построение по двум точкам и отметьте их — в таблице замеров или прямо на графике.',
            }),
            I18n.t('manualProcessingStep3', {
              defaultValue:
                'График масштабируется двумя пальцами и кнопками «+» и «−», перетаскивается одним пальцем; оси при этом остаются на месте.',
            }),
            I18n.t('manualProcessingStep4', {
              defaultValue: 'Кнопка «Вписать» возвращает исходный масштаб по всем замерам.',
            }),
          ],
        },
        {
          type: 'note',
          text: I18n.t('manualProcessingNote', {
            defaultValue:
              'Начальные замеры искажает ёмкость ствола скважины, конечные — влияние границ пласта. Прямолинейный участок обычно лежит между ними: именно его и стоит выбирать двумя точками.',
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
              'Вторая половина опыта: насос остановлен, уровень поднимается. Обрабатывать её выгодно — насос не работает, и колебания дебита уже ничего не портят.',
          }),
        },
        {
          type: 'formula',
          formula: "s′ = 0,183 · Q/T · lg(t/t′)",
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
                'Укажите, сколько длилась откачка: от этого момента отсчитывается t′.',
            }),
            I18n.t('manualRecoveryStep3', {
              defaultValue:
                'Замеры вносятся так же — время от начала опыта и остаточное понижение.',
            }),
          ],
        },
        {
          type: 'note',
          text: I18n.t('manualRecoveryNote', {
            defaultValue:
              'Прямая восстановления обязана проходить через начало координат. Заметный сдвиг — признак влияния границ пласта или непостоянного дебита на откачке; приложение об этом предупредит.',
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
              'Четыре вкладки для быстрых расчётов, когда полного журнала нет — достаточно нескольких величин из полевой книжки.',
          }),
        },
        {
          type: 'terms',
          terms: [
            {
              term: I18n.t('tabFiltration', { defaultValue: 'Фильтрация' }),
              definition: I18n.t('manualCalcFiltration', {
                defaultValue:
                  'Коэффициент фильтрации по данным одиночной откачки — формулы Дюпюи для напорного и безнапорного пласта.',
              }),
            },
            {
              term: I18n.t('tabParams', { defaultValue: 'Параметры' }),
              definition: I18n.t('manualCalcParams', {
                defaultValue:
                  'Водопроводимость, пьезопроводность и радиус влияния по наклону прямой Купера — Джейкоба.',
              }),
            },
            {
              term: I18n.t('tabForecast', { defaultValue: 'Прогноз' }),
              definition: I18n.t('manualCalcForecast', {
                defaultValue:
                  'Понижение на заданном расстоянии и времени по формуле Тейса — через функцию скважины W(u).',
              }),
            },
            {
              term: I18n.t('tabPit', { defaultValue: 'Котлован' }),
              definition: I18n.t('manualCalcPit', {
                defaultValue:
                  'Приток воды в котлован: контур заменяется «большим колодцем» эквивалентного радиуса.',
              }),
            },
            {
              term: I18n.t('tabBarrage', { defaultValue: 'Барраж' }),
              definition: I18n.t('manualCalcBarrage', {
                defaultValue:
                  'Пласт с границей: непроницаемый контакт углубляет воронку, река — выполаживает. Плюс подпор уровня перед стеной в грунте.',
              }),
            },
            {
              term: I18n.t('tabLeakage', { defaultValue: 'Утечки' }),
              definition: I18n.t('manualCalcLeakage', {
                defaultValue:
                  'Пласт с перетеканием: понижение по Хантушу — Джейкобу, фактор перетекания B и расход утечки через кровлю.',
              }),
            },
          ],
        },
        {
          type: 'note',
          text: I18n.t('manualCalculatorNote', {
            defaultValue:
              'Радиус влияния R редко замеряют — его принимают из опыта работ. Если оставить поле пустым, берётся R = 300·r₀, и в результатах появляется предупреждение: значение оценочное.',
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
              defaultValue: 'Введите название точки и выберите тип: скважина, родник, шурф, наблюдение.',
            }),
            I18n.t('manualDiaryStep2', {
              defaultValue: 'Нажмите на карту в нужном месте — точка встанет по координатам нажатия.',
            }),
            I18n.t('manualDiaryStep3', {
              defaultValue:
                'Кнопка «Отметить моё местоположение» ставит точку по координатам устройства, кружок на карте просто подводит карту к вам.',
            }),
          ],
        },
        {
          type: 'note',
          text: I18n.t('manualDiaryNote', {
            defaultValue:
              'Карта подгружается из интернета, но уже отмеченные точки и их координаты хранятся на устройстве и доступны без связи.',
          }),
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
            { term: 'T', definition: I18n.t('manualTermT', { defaultValue: 'Водопроводимость, м²/сут' }) },
            { term: 'k', definition: I18n.t('manualTermK', { defaultValue: 'Коэффициент фильтрации, м/сут' }) },
            { term: 'm', definition: I18n.t('manualTermM', { defaultValue: 'Мощность водоносного пласта, м' }) },
            { term: 'a', definition: I18n.t('manualTermA', { defaultValue: 'Наклон прямой, м на логарифмический цикл' }) },
            { term: 'r₀', definition: I18n.t('manualTermR0', { defaultValue: 'Радиус скважины, м' }) },
            { term: 'R', definition: I18n.t('manualTermR', { defaultValue: 'Радиус влияния откачки, м' }) },
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

  const contentMaxWidth = width >= 700 ? 640 : undefined;

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
    fontWeight: '600',
  },

  terms: { gap: spacing.md },
  // Термин и пояснение идут друг под другом, а не в две колонки: длинное
  // название забирало полстроки, и описание рвалось на обрывки по два слова
  term: {
    gap: 2,
  },
  termName: {
    fontWeight: '700',
  },
  termText: {
    lineHeight: 19,
  },

  note: {
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
  },
});
