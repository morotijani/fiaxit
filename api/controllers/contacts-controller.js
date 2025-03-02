const Contact = require('../models/contact-model')

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
            const obj = {
                fname: req.body.fname,
                lname: req.body.lname,
                email: req.body.email
            }
            res.status(200).json({
                success: true,
                method: "create",
                contact: obj
            })
        }
    }

    findById = () => {
        return (req, res, next) => {
            // console.log(req.params)
            // console.log(req.query) // eg output page=2
            res.status(200).json({
                success: true,
                method: "find by id",
                contactId: req.params.id
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
