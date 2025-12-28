const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
    }
});

/**
 * Sends an email using the configured transporter.
 * @param {Object} options - Email options (to, subject, html, etc.)
 * @returns {Promise}
 */
const sendMail = async (options) => {
    const mailOptions = {
        from: `"Fiaxit" <${process.env.EMAIL_USERNAME}>`,
        ...options
    };

    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('[EmailHelper] Error sending email:', error);
                reject(error);
            } else {
                console.log('[EmailHelper] Email sent:', info.response);
                resolve(info);
            }
        });
    });
};

/**
 * Returns a styled HTML template for transactions.
 */
const getTransactionTemplate = (userFname, amount, cryptoSymbol, type, address, txId) => {
    const isSent = type.toLowerCase() === 'send' || type.toLowerCase() === 'sent';
    const action = isSent ? 'Sent' : 'Received';
    const color = isSent ? '#dc3545' : '#198754';
    const arrow = isSent ? '↗' : '↙';

    return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
            <div style="text-align: center; padding: 20px 0;">
                <h1 style="color: #0d6efd; margin: 0; font-size: 28px; letter-spacing: -1px;">Fiaxit</h1>
            </div>
            <div style="background-color: #ffffff; border-radius: 12px; padding: 35px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <h2 style="margin-top: 0; color: #1a202c; font-size: 22px;">Transaction ${action}</h2>
                <p style="font-size: 16px; color: #4a5568;">Hello ${userFname}, your transaction has been successfully processed on the network.</p>
                
                <div style="background-color: #f8fafc; border-radius: 10px; padding: 25px; margin: 25px 0; border: 1px solid #edf2f7; text-align: center;">
                    <div style="font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Amount</div>
                    <div style="font-size: 32px; font-weight: bold; color: ${color}; margin-bottom: 10px;">
                        ${arrow} ${amount} ${cryptoSymbol}
                    </div>
                </div>

                <div style="margin: 25px 0;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr>
                            <td style="padding: 10px 0; color: #718096; width: 120px; border-bottom: 1px solid #f1f5f9;">Status</td>
                            <td style="padding: 10px 0; color: #1a202c; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9;">
                                <span style="background-color: #d1e7dd; color: #0f5132; padding: 4px 12px; border-radius: 20px; font-size: 12px;">Completed</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #718096; border-bottom: 1px solid #f1f5f9;">${isSent ? 'To' : 'From'} Address</td>
                            <td style="padding: 10px 0; color: #2d3748; font-family: monospace; text-align: right; border-bottom: 1px solid #f1f5f9; font-size: 12px;">
                                ${address.substring(0, 15)}...${address.substring(address.length - 15)}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; color: #718096; border-bottom: 1px solid #f1f5f9;">Transaction ID</td>
                            <td style="padding: 10px 0; color: #2d3748; font-family: monospace; text-align: right; border-bottom: 1px solid #f1f5f9; font-size: 12px;">
                                ${txId.substring(0, 20)}...
                            </td>
                        </tr>
                    </table>
                </div>

                <div style="text-align: center; margin-top: 30px;">
                    <a href="http://sites.local:3000/transactions" style="background-color: #0d6efd; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">View Activity</a>
                </div>
                
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">If you have any questions regarding this transaction, please contact our support team.</p>
            </div>
            <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Fiaxit. All rights reserved.
            </div>
        </div>
    `;
};

module.exports = { sendMail, getTransactionTemplate };
