const BalanceSnapshot = require('../models/balance-snapshot-model');
const Wallet = require('../models/wallet-model');
const WalletsController = require('./wallet-controller');
const { Op } = require('sequelize');

class PortfolioController {

    // Get historical snapshots for the current user
    getHistory = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                const days = parseInt(req.query.days) || 7;

                const startDate = new Date();
                startDate.setDate(startDate.getDate() - days);

                const data = await BalanceSnapshot.findAll({
                    where: {
                        user_id: userId,
                        snapshot_at: { [Op.gte]: startDate }
                    },
                    order: [['snapshot_at', 'ASC']]
                });

                res.status(200).json({
                    success: true,
                    data: data
                });
            } catch (err) {
                console.error("Failed to fetch portfolio history:", err);
                res.status(500).json({ success: false, error: err.message });
            }
        };
    };

    // Internal helper to take a snapshot for a user
    _takeSnapshotInternal = async (userId, userData) => {
        try {
            // we use WalletsController.getTotalBalance logic but without the HTTP res overhead
            // Actually, WalletsController has getTotalBalance but it's an Express route handler.
            // I'll need to compute it or call it with a mock res.

            let totalUsd = 0;
            const resMock = {
                status: () => resMock,
                json: (payload) => {
                    if (payload && payload.success && payload.data) {
                        // sum up all fiat_equivalent
                        Object.values(payload.data).forEach(coin => {
                            totalUsd += (coin.fiat_equivalent || 0);
                        });
                    }
                }
            };
            const reqMock = { userData: { user_id: userId } };

            await WalletsController.getTotalBalance()(reqMock, resMock);

            if (totalUsd > 0) {
                await BalanceSnapshot.create({
                    user_id: userId,
                    total_balance_usd: totalUsd
                });
                return totalUsd;
            }
            return 0;
        } catch (err) {
            console.error(`Snapshot failed for user ${userId}:`, err.message);
            return 0;
        }
    }

    // Manual trigger for testing
    takeSnapshot = () => {
        return async (req, res) => {
            const userId = req.userData.user_id;
            const bal = await this._takeSnapshotInternal(userId, req.userData);
            res.status(201).json({ success: true, balance: bal });
        };
    }
}

module.exports = new PortfolioController();
