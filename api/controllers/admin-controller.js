const User = require('../models/user-model');
const Transaction = require('../models/transaction-model');
const UserKyc = require('../models/user-kyc-model');
const Coin = require('../models/coin-model');
const { Op, fn, col } = require('sequelize');

class AdminController {
    // Get aggregated statistics for the dashboard
    getStats = () => {
        return async (req, res) => {
            try {
                // Total counts
                const totalUsers = await User.count();
                const verifiedUsers = await User.count({ where: { kyc_status: 'verified' } });
                const pendingKyc = await UserKyc.count({ where: { kyc_status: 'pending' } });

                // Transaction stats (simplified for now)
                const totalTransactions = await Transaction.count();
                const totalVolume = await Transaction.sum('transaction_amount', {
                    where: { transaction_status: 'Completed' }
                });

                // Get 24h stats
                const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const newUsers24h = await User.count({
                    where: { createdAt: { [Op.gt]: last24h } }
                });

                const recentTransactions = await Transaction.findAll({
                    limit: 10,
                    order: [['createdAt', 'DESC']],
                    include: [{
                        model: User,
                        as: 'sender', // Assuming association exists or will be added
                        attributes: ['user_fname', 'user_lname', 'user_email'],
                        foreignKey: 'transaction_by'
                    }]
                });

                res.status(200).json({
                    success: true,
                    data: {
                        summary: {
                            totalUsers,
                            verifiedUsers,
                            pendingKyc,
                            totalTransactions,
                            totalVolume: totalVolume || 0,
                            newUsers24h
                        },
                        recentTransactions
                    }
                });
            } catch (error) {
                console.error('[AdminController] getStats error:', error);
                res.status(500).json({
                    success: false,
                    message: "Failed to fetch dashboard stats.",
                    error: error.message
                });
            }
        };
    }

    // List all users with pagination and filters
    listUsers = () => {
        return async (req, res) => {
            try {
                const { page = 1, limit = 20, search = '', kycStatus = '' } = req.query;
                const offset = (page - 1) * limit;

                const where = {};
                if (search) {
                    where[Op.or] = [
                        { user_email: { [Op.like]: `%${search}%` } },
                        { user_fname: { [Op.like]: `%${search}%` } },
                        { user_lname: { [Op.like]: `%${search}%` } }
                    ];
                }
                if (kycStatus) {
                    where.kyc_status = kycStatus;
                }

                const { count, rows } = await User.findAndCountAll({
                    where,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    order: [['createdAt', 'DESC']],
                    attributes: { exclude: ['user_password', 'user_pin'] }
                });

                res.status(200).json({
                    success: true,
                    data: rows,
                    total: count,
                    pages: Math.ceil(count / limit)
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Failed to fetch users.",
                    error: error.message
                });
            }
        };
    }

    // List all transactions with pagination
    listTransactions = () => {
        return async (req, res) => {
            try {
                const { page = 1, limit = 20, status = '' } = req.query;
                const offset = (page - 1) * limit;

                const where = {};
                if (status) {
                    where.transaction_status = status;
                }

                const { count, rows } = await Transaction.findAndCountAll({
                    where,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    order: [['createdAt', 'DESC']]
                });

                res.status(200).json({
                    success: true,
                    data: rows,
                    total: count,
                    pages: Math.ceil(count / limit)
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Failed to fetch transactions.",
                    error: error.message
                });
            }
        };
    }

    // Update user detail/status
    updateUser = () => {
        return async (req, res) => {
            try {
                const { userId } = req.params;
                const updates = req.body;

                const user = await User.findOne({ where: { user_id: userId } });
                if (!user) {
                    return res.status(404).json({ success: false, message: "User not found." });
                }

                await user.update(updates);

                res.status(200).json({
                    success: true,
                    message: "User updated successfully.",
                    data: user
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: "Failed to update user.",
                    error: error.message
                });
            }
        };
    }
}

module.exports = new AdminController();
