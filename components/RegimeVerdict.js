/**
 * Вывод диагностики: какой режим фильтрации виден и что с ним делать
 *
 * Форму производной надо уметь читать, и по одному графику новичок расчётную
 * схему не выберет. Карточка называет режим словами, объясняет, по чему он
 * распознан, и говорит, что делать дальше — потому что от этого зависит,
 * какие точки брать в прямую и какой формулой считать.
 *
 * Отдельно показана водопроводимость по полке производной. Это независимая
 * оценка: она не зависит от того, какие точки геолог выбрал для прямой,
 * поэтому расхождение с основным расчётом — сигнал, что участок выбран не тот.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import I18n from '../Localization';
import { REGIMES, transmissivityFromPlateau } from '../calc/diagnostics';
import { spacing, radius, type, elevation, numericAt } from '../theme';

/** Расхождение оценок T, начиная с которого стоит предупредить, доли */
const T_MISMATCH = 0.25;

/**
 * Описание режима: заголовок, признак и рекомендация
 *
 * @param {string} regime - режим из REGIMES
 * @param {Object} result - результат диагностики
 * @returns {{icon: string, tone: string, title: string, sign: string, advice: string}}
 */
function describe(regime, result) {
  switch (regime) {
    case REGIMES.RADIAL:
      return {
        icon: 'check-circle-outline',
        tone: 'ok',
        title: I18n.t('regimeRadial', { defaultValue: 'Радиальный поток' }),
        sign: I18n.t('regimeRadialSign', {
          defaultValue: 'Производная вышла на полку и держится.',
        }),
        advice: I18n.t('regimeRadialAdvice', {
          defaultValue:
            'Пласт ведёт себя как неограниченный — формула Купера — Джейкоба применима, прямую можно вести по всем поздним точкам.',
        }),
      };

    case REGIMES.BARRIER:
      return {
        icon: 'wall',
        tone: 'warn',
        title: I18n.t('regimeBarrier', { defaultValue: 'Непроницаемая граница' }),
        sign: I18n.t('regimeBarrierSign', {
          // Число подставляется через плейсхолдер, а не вклеивается в текст:
          // иначе английский перевод потерял бы его вместе со строкой
          ratio: isFinite(result.ratio) ? result.ratio.toFixed(1) : '—',
          defaultValue: 'Полка производной выросла в %{ratio} раза.',
        }),
        advice: I18n.t('regimeBarrierAdvice', {
          defaultValue:
            'Понижение дошло до границы пласта. Считайте T по раннему участку: по поздним точкам она выйдет вдвое заниженной. Расстояние до границы оценивает вкладка «Барраж» в калькуляторе.',
        }),
      };

    case REGIMES.RECHARGE:
      return {
        icon: 'water-plus-outline',
        tone: 'warn',
        title: I18n.t('regimeRecharge', { defaultValue: 'Подпитка пласта' }),
        sign: I18n.t('regimeRechargeSign', {
          defaultValue: 'Производная падает — понижение перестаёт расти.',
        }),
        advice: I18n.t('regimeRechargeAdvice', {
          defaultValue:
            'В пласт поступает вода: переток через разделяющий слой или близкий водоём. По поздним точкам T выйдет завышенной — берите участок до перегиба, а переток оцените во вкладке «Утечки».',
        }),
      };

    case REGIMES.WELLBORE:
      return {
        icon: 'progress-clock',
        tone: 'warn',
        title: I18n.t('regimeWellbore', { defaultValue: 'Работает ствол скважины' }),
        sign: I18n.t('regimeWellboreSign', {
          defaultValue: 'Производная растёт под 45° почти на всей записи.',
        }),
        advice: I18n.t('regimeWellboreAdvice', {
          defaultValue:
            'Пока откачивается вода из самой скважины, пласт ещё не включился. Расчёт по этим замерам недостоверен — продолжите откачку.',
        }),
      };

    default:
      return {
        icon: 'help-circle-outline',
        tone: 'muted',
        title: I18n.t('regimeUnclear', { defaultValue: 'Режим не определён' }),
        sign: I18n.t('regimeUnclearSign', { defaultValue: 'Замеров мало или они разбросаны.' }),
        advice: I18n.t('regimeUnclearAdvice', {
          defaultValue:
            'Нужно хотя бы пять замеров, разнесённых по времени в несколько раз: 1, 2, 5, 10, 30 минут.',
        }),
      };
  }
}

export default function RegimeVerdict({ result, Q, comparisonT }) {
  const theme = useTheme();
  const c = theme.colors;

  const info = describe(result?.regime, result ?? {});
  const plateauT = transmissivityFromPlateau(Q, result?.plateau);

  const accent = info.tone === 'ok' ? c.secondary : info.tone === 'warn' ? c.primaryAccent : c.textSecondary;

  // Две независимые оценки разошлись — почти всегда это значит, что прямая
  // проведена по точкам вне радиального участка
  const mismatch =
    isFinite(plateauT) &&
    isFinite(comparisonT) &&
    comparisonT > 0 &&
    Math.abs(plateauT - comparisonT) / comparisonT > T_MISMATCH;

  return (
    <View
      style={[
        styles.card,
        elevation.card,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: c.primaryWash }]}>
          <MaterialCommunityIcons name={info.icon} size={20} color={accent} />
        </View>
        <View style={styles.headText}>
          <Text style={[type.cardTitle, { color: c.text }]}>{info.title}</Text>
          <Text style={[type.caption, { color: c.textSecondary }]}>{info.sign}</Text>
        </View>
      </View>

      <Text style={[type.body, styles.advice, { color: c.textSecondary }]}>{info.advice}</Text>

      {isFinite(plateauT) && (
        <View style={[styles.estimate, { borderTopColor: c.border }]}>
          <Text style={[type.caption, { color: c.textSecondary }]}>
            {I18n.t('plateauEstimate', { defaultValue: 'T по полке производной' })}
          </Text>
          <Text style={[styles.estimateValue, { color: accent }]}>
            {plateauT.toFixed(2)} {I18n.t('unitTransmissivity', { defaultValue: 'м²/сут' })}
          </Text>
        </View>
      )}

      {mismatch && (
        <Text style={[type.caption, styles.mismatch, { color: c.primaryAccent }]}>
          {I18n.t('plateauMismatch', {
            defaultValue:
              'Оценка расходится с расчётом по прямой больше чем на четверть — скорее всего, прямая проведена не по радиальному участку.',
          })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    flex: 1,
  },
  advice: {
    marginTop: spacing.md,
    lineHeight: 20,
  },
  estimate: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  estimateValue: {
    ...numericAt(18),
    fontWeight: '600',
  },
  mismatch: {
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
