/**
 * Менеджер подписок приложения АНСДИМАТ
 * 
 * Этот класс отвечает за управление подписками пользователей:
 * - Проверка статуса подписки
 * - Установка и обновление данных подписки
 * - Проверка доступа к премиум функциям
 * - Расчет оставшихся дней подписки
 * - Форматирование дат и статусов
 * 
 * Данные подписки хранятся в AsyncStorage:
 * - subscription_status: статус подписки (active/inactive)
 * - subscription_type: тип подписки
 * - subscription_expiry: дата истечения подписки
 * 
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Класс для управления подписками пользователей
 * 
 * Предоставляет статические методы для работы с подписками:
 * - Получение и установка статуса подписки
 * - Проверка активности подписки
 * - Расчет оставшихся дней
 * - Форматирование данных для отображения
 */
class SubscriptionManager {
  /**
   * Получает полный статус подписки пользователя
   * 
   * Проверяет:
   * 1. Статус подписки в AsyncStorage
   * 2. Тип подписки
   * 3. Дату истечения
   * 4. Автоматически деактивирует истекшие подписки
   * 
   * @returns {Promise<Object>} Объект с информацией о подписке:
   *   - isActive: boolean - активна ли подписка
   *   - type: string|null - тип подписки
   *   - expiryDate: Date|null - дата истечения
   */
  static async getSubscriptionStatus() {
    try {
      // Получаем данные подписки из AsyncStorage
      const status = await AsyncStorage.getItem("subscription_status");
      const type = await AsyncStorage.getItem("subscription_type");
      const expiry = await AsyncStorage.getItem("subscription_expiry");

      // Если подписка неактивна или отсутствует
      if (!status || status === "inactive") {
        return {
          isActive: false,
          type: null,
          expiryDate: null,
        };
      }

      // Парсим дату истечения
      const expiryDate = expiry ? new Date(expiry) : null;
      const now = new Date();

      // Проверяем, не истекла ли подписка
      if (expiryDate && expiryDate < now) {
        // Автоматически деактивируем истекшую подписку
        await this.setSubscriptionStatus("inactive");
        return {
          isActive: false,
          type: null,
          expiryDate: null,
        };
      }

      // Возвращаем активную подписку
      return {
        isActive: true,
        type: type,
        expiryDate: expiryDate,
      };
    } catch (error) {
      console.error("Error getting subscription status:", error);
      // В случае ошибки возвращаем неактивную подписку
      return {
        isActive: false,
        type: null,
        expiryDate: null,
      };
    }
  }

  /**
   * Устанавливает статус подписки пользователя
   * 
   * Сохраняет в AsyncStorage:
   * - Статус подписки (active/inactive)
   * - Тип подписки (если указан)
   * - Дату истечения (если указана)
   * 
   * @param {string} status - Статус подписки ('active' или 'inactive')
   * @param {string|null} type - Тип подписки (опционально)
   * @param {Date|null} expiryDate - Дата истечения подписки (опционально)
   */
  static async setSubscriptionStatus(status, type = null, expiryDate = null) {
    try {
      // Сохраняем основной статус
      await AsyncStorage.setItem("subscription_status", status);

      // Сохраняем тип подписки или удаляем его
      if (type) {
        await AsyncStorage.setItem("subscription_type", type);
      } else {
        await AsyncStorage.removeItem("subscription_type");
      }

      // Сохраняем дату истечения или удаляем её
      if (expiryDate) {
        await AsyncStorage.setItem(
          "subscription_expiry",
          expiryDate.toISOString()
        );
      } else {
        await AsyncStorage.removeItem("subscription_expiry");
      }
    } catch (error) {
      console.error("Error setting subscription status:", error);
    }
  }

  /**
   * Проверяет, активна ли подписка пользователя
   * 
   * @returns {Promise<boolean>} true если подписка активна, false в противном случае
   */
  static async isSubscriptionActive() {
    const status = await this.getSubscriptionStatus();
    return status.isActive;
  }

  /**
   * Получает тип подписки пользователя
   * 
   * @returns {Promise<string|null>} Тип подписки или null если подписка неактивна
   */
  static async getSubscriptionType() {
    const status = await this.getSubscriptionStatus();
    return status.type;
  }

  /**
   * Получает дату истечения подписки
   * 
   * @returns {Promise<Date|null>} Дата истечения или null если подписка неактивна
   */
  static async getExpiryDate() {
    const status = await this.getSubscriptionStatus();
    return status.expiryDate;
  }

  /**
   * Отменяет подписку пользователя
   * 
   * Устанавливает статус подписки как неактивный
   */
  static async cancelSubscription() {
    await this.setSubscriptionStatus("inactive");
  }

  /**
   * Проверяет доступ к премиум функциям
   * 
   * В текущей реализации премиум функции доступны всем активным подписчикам
   * 
   * @returns {Promise<boolean>} true если есть доступ к премиум функциям
   */
  static async hasPremiumAccess() {
    return await this.isSubscriptionActive();
  }

  /**
   * Рассчитывает количество оставшихся дней подписки
   * 
   * @returns {Promise<number>} Количество оставшихся дней (0 если подписка неактивна или истекла)
   */
  static async getRemainingDays() {
    const status = await this.getSubscriptionStatus();

    // Если подписка неактивна или нет даты истечения
    if (!status.isActive || !status.expiryDate) {
      return 0;
    }

    // Рассчитываем разность между датой истечения и текущей датой
    const now = new Date();
    const expiry = new Date(status.expiryDate);
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Возвращаем количество дней (не меньше 0)
    return Math.max(0, diffDays);
  }

  /**
   * Форматирует дату истечения подписки для отображения
   * 
   * @param {Date} date - Дата для форматирования
   * @param {string} locale - Локаль для форматирования ('ru' или 'en')
   * @returns {string} Отформатированная дата или пустая строка если дата не указана
   */
  static formatExpiryDate(date, locale = "ru") {
    if (!date) return "";

    return date.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  /**
   * Получает текстовое представление статуса подписки
   * 
   * @param {string} status - Статус подписки
   * @param {string} locale - Локаль для перевода ('ru' или 'en')
   * @returns {string} Локализованный текст статуса
   */
  static getStatusText(status, locale = "ru") {
    const texts = {
      ru: {
        active: "Подписка активна",
        inactive: "Подписка неактивна",
        expired: "Подписка истекла",
      },
      en: {
        active: "Subscription active",
        inactive: "Subscription inactive",
        expired: "Subscription expired",
      },
    };

    return texts[locale]?.[status] || texts.en[status] || status;
  }
}

export { SubscriptionManager };
