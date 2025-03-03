const Contact = require('../models/contact-model')

class ContactsController {
    // get all method
    getAll = () => {
        return async (req, res, next) => {
            const userId = req.userData.user_id;
            const {count, rows} = await Contact.findAndCountAll({
                where: {
                    user_id: userId,
                }, 
                order: [
                    ["lname", "ASC"], ["fname", "ASC"]
                ]
            })
            res.status(200).json({
                success: true,
                data: rows,
                total: count
            })
        }
    }

    create = () => {
        return async (req, res, next) => {
            try {
                const userId = req.userData.user_id
                const contact = await Contact.create({
                    fname: req.body.fname,
                    lname: req.body.lname,
                    email: req.body.email,
                    phone: req.body.phone,
                    user_id: userId
                });
                res.status(200).json({
                    success: true, 
                    method: "create",  
                    contact: contact
                })
            } catch (err) {
                res.status(422).json(err.error)
            }
        }
    }

    findById = () => {
        return async (req, res, next) => {
            // console.log(req.params)
            // console.log(req.query) // eg output page=2
            const userId = req.userData.user_id
            const contactId = req.params.id
            const contact = await Contact.findOne({
                where: {
                    id: contactId,
                    user_id: userId
                }
            })
            const resp = {
                success: false, 
                method: "find by id",
                contact: null
            }
            if (contact) {
                resp.success = true,
                resp.method = "find by id",
                resp.contact = contact
            }
            res.status(200).json(resp)
        }
    }

    update = () => {
        return async (req, res, next) => {
            try {
                const userId = req.userData.user_id
                const contactId = req.params.id
                const resp = {
                    success: false, 
                    method: "update", 
                    contact: null,
                    msg: "Contact not found."
                }
                const contact = await Contact.findOne({
                    where: {
                        id: contactId, 
                        user_id: userId
                    }
                })
                if (contact) {
                    // if any of the values are null it does not update it to null
                    const vals = {
                        fname: req.body.fname,
                        lname: req.body.lname,
                        email: req.body.email,
                        phone: req.body.phone
                    }
                    await Contact.update(
                        vals, 
                        {
                            where: {
                                id: contact.id
                            }
                        }
                    );
                    await contact.reload(); //  reload so that we get the updated information
                    resp.success = true;
                    resp.method = 'update';
                    resp.msg = "Contact updated.";
                    resp.contact = contact;
                }
                res.status(200).json(resp)
            } catch(err) {
                res.status(422).json(err.error)
            }
            
        }
    }

    delete = () => {
        return async (req, res, next) => {
            const contactId = req.params.id
            const userId = req.userData.user_id;
            const contact = await Contact.findOne({
                where: {
                    id: contactId, 
                    user_id: userId
                }
            })
            const resp = {
                success: false, 
                method: "delete", 
                msg: "Contact not found.", 
                contact: null
            }
            if (contact) {
                await contact.destroy(); // delete contact
                resp.success = true;
                resp.method = "delete";
                resp.msg = "Contact deleted.";
            }
            res.status(200).json(resp)
        }
    }
}

module.exports = new ContactsController();
