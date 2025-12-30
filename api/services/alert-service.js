const PriceAlert = require('../models/price-alert-model');
const axios = require('axios');
const NotificationController = require('../controllers/notification-controller');

class AlertService {
    constructor() {
        this.interval = null;
    }

    start() {
        // Check every 5 minutes
        const FIVE_MINUTES = 5 * 60 * 1000;

        console.log("Price Alert Service started.");
        this.checkAlerts();

        this.interval = setInterval(() => {
            this.checkAlerts();
        }, FIVE_MINUTES);
    }

    async checkAlerts() {
        try {
            const activeAlerts = await PriceAlert.findAll({ where: { is_active: true } });
            if (activeAlerts.length === 0) return;

            const uniqueSymbols = [...new Set(activeAlerts.map(a => a.coin_symbol))];

            // Fetch current prices
            const COINGECKO_MAP = { ETH: 'ethereum', BTC: 'bitcoin', USDT: 'tether' };
            const ids = uniqueSymbols.map(s => COINGECKO_MAP[s] || s.toLowerCase()).join(',');

            const resp = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
            const prices = resp.data;

            for (const alert of activeAlerts) {
                const id = COINGECKO_MAP[alert.coin_symbol] || alert.coin_symbol.toLowerCase();
                const currentPrice = prices[id]?.usd;

                if (!currentPrice) continue;

                let triggered = false;
                if (alert.direction === 'above' && currentPrice >= parseFloat(alert.target_price)) {
                    triggered = true;
                } else if (alert.direction === 'below' && currentPrice <= parseFloat(alert.target_price)) {
                    triggered = true;
                }

                if (triggered) {
                    console.log(`Alert triggered for user ${alert.user_id}: ${alert.coin_symbol} is ${alert.direction} ${alert.target_price}`);

                    // Create notification
                    await NotificationController.createNotification(
                        alert.user_id,
                        'Price Alert',
                        `${alert.coin_symbol} has gone ${alert.direction} $${alert.target_price}. Current price: $${currentPrice}`,
                        'price_alert'
                    );

                    // Deactivate or update alert
                    await alert.update({
                        is_active: false,
                        triggered_at: new Date()
                    });
                }
            }
        } catch (err) {
            console.error("Error checking price alerts:", err.message);
        }
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }
}

module.exports = new AlertService();
