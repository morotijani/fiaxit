class TodosController {
    // get all method
    getAll = () => {
        return (req, res, next) => {
            res.status(200).json({
                success: true,
                data: [
                    {todo: "learn js"},
                    {todo: "get job"}
                ]
            });
        }
    }

    create = () => {
        return (req, res, next) => {
            res.status(200).json({
                success: true,
                method: "create"
            })
        }
    }

    findById = () => {
        return (req, res, next) => {
            res.status(200).json({
                success: true,
                method: "find by id"
            })
        }
    }

    update = () => {
        return (req, res, next) => {
            res.status(200).json({
                success: true,
                method: "update"
            })
        }
    }

    delete = () => {
        return (req, res, next) => {
            res.status(200).json({
                success: true,
                method: "delete"
            })
        }
    }
}

module.exports = new TodosController();
