const PriceAlert = require('../models/price-alert-model');

class PriceAlertController {

    getAll = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                const alerts = await PriceAlert.findAll({
                    where: { user_id: userId },
                    order: [['createdAt', 'DESC']]
                });
                res.status(200).json({ success: true, data: alerts });
            } catch (err) {
                res.status(500).json({ success: false, error: err.message });
            }
        };
    };

    create = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                const { coin_symbol, target_price, direction } = req.body;

                if (!coin_symbol || !target_price || !direction) {
                    return res.status(400).json({ success: false, message: "Missing required fields" });
                }

                const alert = await PriceAlert.create({
                    user_id: userId,
                    coin_symbol: coin_symbol.toUpperCase(),
                    target_price,
                    direction
                });

                res.status(201).json({ success: true, data: alert });
            } catch (err) {
                res.status(500).json({ success: false, error: err.message });
            }
        };
    };

    delete = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                const alertId = req.params.id;

                const deleted = await PriceAlert.destroy({
                    where: { id: alertId, user_id: userId }
                });

                if (deleted) {
                    res.status(200).json({ success: true, message: "Alert deleted" });
                } else {
                    res.status(404).json({ success: false, message: "Alert not found" });
                }
            } catch (err) {
                res.status(500).json({ success: false, error: err.message });
            }
        };
    };
}

module.exports = new PriceAlertController();
