const express = require('express');
const router = express.Router();
const ContactsController = require('../controllers/contacts-controller');
const userAuth = require("../middleware/check-auth");

router.get('/', ContactsController.getAll());

router.post('/', ContactsController.create());

router.get('/:id', ContactsController.findById());

router.patch('/:id', ContactsController.update());

router.delete('/:id', ContactsController.delete())

module.exports = router
