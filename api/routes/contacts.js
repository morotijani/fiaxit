const express = require('express');
const router = express.Router();
const ContactsController = require('../controllers/contacts-controller');
const userAuth = require("../middleware/check-auth");

router.get('/', userAuth, ContactsController.getAll());

router.post('/', userAuth, ContactsController.create());

router.get('/:id', userAuth, ContactsController.findById());

router.patch('/:id', userAuth, ContactsController.update());

router.delete('/:id', userAuth, ContactsController.delete())

module.exports = router