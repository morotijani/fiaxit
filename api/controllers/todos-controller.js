const Todo = require('../models/todo-model');

class TodosController {
    // get all method
    getAll = () => {
        return async (req, res, next) => {
            const userId = req.userData.user_id;
            const {count, rows} = await Todo.findAndCountAll({
                where: {
                    user_id: userId
                }
            })
            res.status(200).json({
                success: true,
                data: rows,
                total: count
            });
        }
    }

    create = () => {
        return async (req, res, next) => {
            try {
                const todo = await Todo.create({
                    name: req.body.name,
                    user_id: req.userData.user_id,
                    completed: req.body.completed
                });
                res.status(201).json({ // 201 (success) use for creating often a post and put request
                    success: true,
                    method: "create",
                    todo: todo
                })
            } catch(err) {
                res.status(422).json(err.errors) // 422 unprocessible entity 
            }
        }
    }

    findById = () => {
        return async (req, res, next) => {
            const userId = req.userData.user_id;
            const todoId = req.params.id;
            const todo = await Todo.findOne({
                where: {
                    id: todoId, 
                    user_id: userId
                }
            })
            const resp = {success: false, todo: null}
            if (todo) {
                resp.success = true,
                resp.todo = todo
            }
            res.status(200).json(resp)
        }
    }

    update = () => {
        return async (req, res, next) => {
            const todoId = req.params.id;
            const userId = req.userData.user_id;
            const resp = {success: false, msg: "Todo not found"}
            const todo = await Todo.findOne({
                where: {
                    id: todoId, 
                    user_id: userId
                } 
            })
            if (todo) {
                const vals = {
                    name: req.body.name, 
                    completed: req.body.completed
                };
                await Todo.update(vals, {
                    where: {
                        id: todoId
                    }
                })
                await todo.reload();
                resp.success = true;
                resp.msg = "Todo updated",
                resp.todo = todo
            }
            res.status(200).json(resp);
        }
    }

    delete = () => {
        return async (req, res, next) => {
            const todoId = req.params.id;
            const userId = req.userData.user_id;
            const todo = await Todo.findOne({
                where: {
                    id: todoId, 
                    user_id: userId
                }
            })
            const resp = {success: false, msg: "Todo not found"};
            if (todo) {
                await Todo.destroy(
                    {
                        where: {
                        id: todoId,
                        user_id: userId
                    }
                })
                resp.success = true;
                resp.msg = "Todo deleted";
            }
            res.status(200).json(resp)
        }
    }
}

module.exports = new TodosController();
