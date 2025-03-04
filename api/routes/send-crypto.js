const express = require('express')
const router = express.Router()
const SendCryptosController = require("../controllers/send-crypto-controller");

router.post('/', userAuth, SendCryptosController.create());

module.exports = router