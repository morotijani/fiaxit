const express = require('express');
const router = express.Router();
const ContactsController = require('../controllers/contacts-controller');
const { authenticate } = require("../middleware/check-auth");

router.get('/', authenticate, ContactsController.getAll());

router.post('/', authenticate, ContactsController.create());

router.get('/:id', authenticate, ContactsController.findById());

router.patch('/:id', authenticate, ContactsController.update());

router.delete('/:id', authenticate, ContactsController.delete())

module.exports = router