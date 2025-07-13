import AsyncStorage from "@react-native-async-storage/async-storage";

class SubscriptionManager {
  static async getSubscriptionStatus() {
    try {
      const status = await AsyncStorage.getItem("subscription_status");
      const type = await AsyncStorage.getItem("subscription_type");
      const expiry = await AsyncStorage.getItem("subscription_expiry");

      if (!status || status === "inactive") {
        return {
          isActive: false,
          type: null,
          expiryDate: null,
        };
      }

      const expiryDate = expiry ? new Date(expiry) : null;
      const now = new Date();

      // Проверяем, не истекла ли подписка
      if (expiryDate && expiryDate < now) {
        await this.setSubscriptionStatus("inactive");
        return {
          isActive: false,
          type: null,
          expiryDate: null,
        };
      }

      return {
        isActive: true,
        type: type,
        expiryDate: expiryDate,
      };
    } catch (error) {
      console.error("Error getting subscription status:", error);
      return {
        isActive: false,
        type: null,
        expiryDate: null,
      };
    }
  }

  static async setSubscriptionStatus(status, type = null, expiryDate = null) {
    try {
      await AsyncStorage.setItem("subscription_status", status);

      if (type) {
        await AsyncStorage.setItem("subscription_type", type);
      } else {
        await AsyncStorage.removeItem("subscription_type");
      }

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

  static async isSubscriptionActive() {
    const status = await this.getSubscriptionStatus();
    return status.isActive;
  }

  static async getSubscriptionType() {
    const status = await this.getSubscriptionStatus();
    return status.type;
  }

  static async getExpiryDate() {
    const status = await this.getSubscriptionStatus();
    return status.expiryDate;
  }

  static async cancelSubscription() {
    await this.setSubscriptionStatus("inactive");
  }

  // Метод для проверки доступа к премиум функциям
  static async hasPremiumAccess() {
    return await this.isSubscriptionActive();
  }

  // Метод для получения оставшихся дней подписки
  static async getRemainingDays() {
    const status = await this.getSubscriptionStatus();

    if (!status.isActive || !status.expiryDate) {
      return 0;
    }

    const now = new Date();
    const expiry = new Date(status.expiryDate);
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  // Метод для форматирования даты истечения
  static formatExpiryDate(date, locale = "ru") {
    if (!date) return "";

    return date.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  // Метод для получения статуса в текстовом виде
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

export default SubscriptionManager;
