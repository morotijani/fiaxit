// Entry point
require('dotenv').config();
const http = require("http");
const app = require('./app');
const SnapshotService = require('./api/services/snapshot-service');
const AlertService = require('./api/services/alert-service');
const port = process.env.port || 8000;
const server = http.createServer(app);

server.listen(port, () => {
    console.log(`Listerning on port ${port}`)
    SnapshotService.startSnapshotInterval();
    AlertService.start();
});