const Staking = require("../models/staking-model");
const UserBalance = require("../models/user-balance-model");
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

class StakingController {

    stake = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                const { amount, duration_days } = req.body;
                const coinSymbol = 'USDT';

                if (!amount || amount <= 0) {
                    return res.status(400).json({ success: false, message: "Invalid amount." });
                }

                if (![30, 90, 180, 365].includes(parseInt(duration_days))) {
                    return res.status(400).json({ success: false, message: "Invalid duration. Choose 30, 90, 180, or 365 days." });
                }

                // 1. Check Internal Balance
                const balanceRecord = await UserBalance.findOne({
                    where: { user_id: userId, coin_symbol: coinSymbol }
                });

                if (!balanceRecord || parseFloat(balanceRecord.balance) < parseFloat(amount)) {
                    return res.status(400).json({
                        success: false,
                        message: "Insufficient internal balance. Please deposit USDT to your internal account first."
                    });
                }

                // 2. Interest Rates (Tiered by duration)
                const rates = {
                    30: 2.5,  // 2.5% APY
                    90: 5.0,  // 5% APY
                    180: 8.0, // 8% APY
                    365: 12.0 // 12% APY
                };

                const interestRate = rates[duration_days];
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + parseInt(duration_days));

                // 3. Create Staking Record
                const staking = await Staking.create({
                    staking_id: uuidv4(),
                    user_id: userId,
                    coin_symbol: coinSymbol,
                    amount: amount,
                    interest_rate: interestRate,
                    duration_days: duration_days,
                    end_date: endDate,
                    status: 'active'
                });

                // 4. Deduct from Balance
                await balanceRecord.update({
                    balance: parseFloat(balanceRecord.balance) - parseFloat(amount)
                });

                res.status(201).json({
                    success: true,
                    message: `Successfully staked ${amount} USDT for ${duration_days} days at ${interestRate}% APY.`,
                    data: staking
                });
            } catch (err) {
                console.error("Staking error:", err);
                res.status(500).json({ success: false, message: "Internal server error during staking." });
            }
        };
    }

    getMyStakes = () => {
        return async (req, res) => {
            try {
                const userId = req.userData.user_id;
                const stakes = await Staking.findAll({
                    where: { user_id: userId },
                    order: [['createdAt', 'DESC']]
                });

                res.status(200).json({
                    success: true,
                    data: stakes
                });
            } catch (err) {
                res.status(500).json({ success: false, message: "Failed to fetch stakes." });
            }
        };
    }

    // Background calculation or Manual trigger for testing
    calculateInterest = () => {
        return async (req, res) => {
            try {
                // This would normally run in a cron job
                // Simplified: Calculate interest accrued so far for all active stakes
                const activeStakes = await Staking.findAll({ where: { status: 'active' } });

                for (const stake of activeStakes) {
                    const now = new Date();
                    const start = new Date(stake.start_date);
                    const daysActive = Math.floor((now - start) / (1000 * 60 * 60 * 24));

                    // Daily interest formula: (Amount * (Rate/100) / 365) * Days
                    const dailyRate = (parseFloat(stake.interest_rate) / 100) / 365;
                    const earned = parseFloat(stake.amount) * dailyRate * daysActive;

                    await stake.update({ interest_earned: earned });

                    // If duration is reached, complete it
                    if (now >= new Date(stake.end_date)) {
                        await stake.update({ status: 'completed' });
                        // Add principal + interest back to UserBalance
                        const [balanceRecord] = await UserBalance.findOrCreate({
                            where: { user_id: stake.user_id, coin_symbol: stake.coin_symbol },
                            defaults: { balance: 0 }
                        });
                        await balanceRecord.update({
                            balance: parseFloat(balanceRecord.balance) + parseFloat(stake.amount) + earned
                        });
                    }
                }

                if (res) res.status(200).json({ success: true, message: "Interest calculated and applied." });
            } catch (err) {
                console.error("Interest calculation error:", err);
                if (res) res.status(500).json({ success: false, message: "Interest calculation failed." });
            }
        };
    }
}

module.exports = new StakingController();
