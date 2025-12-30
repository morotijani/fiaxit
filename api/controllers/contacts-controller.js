const Contact = require('../models/contact-model')

class ContactsController {
    // get all method
    getAll = () => {
        return async (req, res, next) => {
            const userId = req.userData.user_id;
            const { count, rows } = await Contact.findAndCountAll({
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
                const userId = req.userData.user_id;
                const { fname, lname, nickname, email, phone, wallet_address, coin_symbol, message } = req.body;

                // Simple backend validation
                if (!wallet_address || !coin_symbol) {
                    return res.status(422).json({ success: false, message: "Wallet address and coin are required." });
                }

                const contact = await Contact.create({
                    fname, lname, nickname, email, phone, wallet_address, coin_symbol, message,
                    user_id: userId
                });

                res.status(200).json({
                    success: true,
                    method: "create",
                    contact: contact
                })
            } catch (err) {
                console.error("Create contact error:", err);
                res.status(422).json({
                    success: false,
                    message: err.message || "Failed to create contact",
                    errors: err.errors
                });
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
                    const vals = {
                        fname: req.body.fname,
                        lname: req.body.lname,
                        nickname: req.body.nickname,
                        email: req.body.email,
                        phone: req.body.phone,
                        wallet_address: req.body.wallet_address,
                        coin_symbol: req.body.coin_symbol,
                        message: req.body.message
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
            } catch (err) {
                console.error("Update contact error:", err);
                res.status(422).json({
                    success: false,
                    message: err.message || "Failed to update contact",
                    errors: err.errors
                })
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
