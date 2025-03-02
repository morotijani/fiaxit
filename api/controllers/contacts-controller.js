class ContactsController {
    // get all method
    getAll = () => {
        return (req, res, next) => {
            res.status(200).json({
                success: true,
                data: [
                    {fname: "tj", lname: 'moro', phone: '2222'},
                    {fname: "baba", lname: 'ali', phone: '5555'}
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

module.exports = new ContactsController();
