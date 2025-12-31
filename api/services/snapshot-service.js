const User = require('../models/user-model');
const PortfolioController = require('../controllers/portfolio-controller');

class SnapshotService {
    constructor() {
        this.interval = null;
    }

    startSnapshotInterval() {
        // Run every 6 hours (4 times a day)
        const SIX_HOURS = 6 * 60 * 60 * 1000;

        console.log("Snapshot Service started. Taking first batch of snapshots...");
        this.runSnapshots();

        this.interval = setInterval(() => {
            this.runSnapshots();
        }, SIX_HOURS);
    }

    async runSnapshots() {
        try {
            const users = await User.findAll({ where: { user_verified: true } });
            console.log(`Starting snapshots for ${users.length} users...`);

            for (const user of users) {
                // We need a userData mock that has user_id
                const userData = { user_id: user.user_id };
                await PortfolioController._takeSnapshotInternal(user.user_id, userData);
            }
            console.log("Finished snapshot batch.");
        } catch (err) {
            console.error("Error running snapshot batch:", err);
        }
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }
}

module.exports = new SnapshotService();
