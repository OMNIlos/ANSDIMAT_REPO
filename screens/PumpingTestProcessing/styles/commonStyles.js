/**
 * Общие стили для модуля PumpingTestProcessing
 * Переиспользуемые стили для обеспечения единообразия интерфейса
 */

import { StyleSheet, Platform } from 'react-native';

// Общие размеры и отступы
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

// Общие стили для карточек
export const cardStyles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: SPACING.md,
  },
  cardContent: {
    padding: SPACING.md,
  },
});

// Стили для кнопок
export const buttonStyles = StyleSheet.create({
  button: {
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  iconButton: {
    margin: 0,
    padding: SPACING.sm,
  },
  floatingButton: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
});

// Стили для полей ввода
export const inputStyles = StyleSheet.create({
  inputContainer: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 16,
  },
  inputError: {
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  inputWithUnit: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
});

// Стили для списков
export const listStyles = StyleSheet.create({
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: SPACING.xl * 3,
  },
  listItem: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});

// Стили для модальных окон
export const modalStyles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? 50 : SPACING.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: SPACING.md,
  },
  modalBody: {
    flex: 1,
    padding: SPACING.md,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
});

// Стили для графиков
export const chartStyles = StyleSheet.create({
  chartContainer: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginVertical: SPACING.md,
  },
  chartControlPanel: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopLeftRadius: BORDER_RADIUS.md,
    borderTopRightRadius: BORDER_RADIUS.md,
  },
  chartCanvas: {
    overflow: 'hidden',
  },
  chartInfoPanel: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomLeftRadius: BORDER_RADIUS.md,
    borderBottomRightRadius: BORDER_RADIUS.md,
  },
});

// Стили для заголовков
export const headerStyles = StyleSheet.create({
  headerContainer: {
    paddingTop: Platform.OS === 'ios' ? 50 : 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: 16,
    opacity: 0.8,
  },
  headerIcon: {
    marginRight: SPACING.md,
  },
});

// Стили для информационных панелей
export const infoStyles = StyleSheet.create({
  infoContainer: {
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoIcon: {
    marginRight: SPACING.xs,
  },
});

// Вспомогательные функции для тем
export const getThemedStyles = (theme) => ({
  // Цвета для текста
  primaryText: { color: theme.colors.onSurface },
  secondaryText: { color: theme.colors.onSurfaceVariant },
  errorText: { color: theme.colors.error },
  
  // Цвета для фонов
  primaryBackground: { backgroundColor: theme.colors.surface },
  secondaryBackground: { backgroundColor: theme.colors.surfaceVariant },
  errorBackground: { backgroundColor: theme.colors.errorContainer },
  
  // Цвета для границ
  primaryBorder: { borderColor: theme.colors.outline },
  focusedBorder: { borderColor: theme.colors.primary },
  errorBorder: { borderColor: theme.colors.error },
});
