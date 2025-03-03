const express = require('express');
const router = express.Router();
const TodosController = require('../controllers/todos-controller');
const userAuth = require("../middleware/check-auth");

router.get('/', TodosController.getAll());

router.post('/', TodosController.create());

router.get('/:id', TodosController.findById());

router.patch('/:id', TodosController.update());

router.delete('/:id', TodosController.delete())

module.exports = router
