const { Expo } = require('expo-server-sdk');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

// Initialize transporter once at module level
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAILER_EMAIL,
        pass: process.env.MAILER_APP_PASSWORD,
    },
    pool: true, // Enable connection pooling for better performance
});


const getModels = (req) => ({
    WeeklyInvoice: req.db.model('WeeklyInvoice', require('../models/WeeklyInvoice').schema),
});

// GET route to retrieve weekly invoices
const fetchWeeklyInvoices = async (req, res) => {
    try {
        const { WeeklyInvoice } = getModels(req)
        const { personnelIds, serviceWeeks, site } = req.body;

        // Build query object
        const query = {};
        if (personnelIds && personnelIds.length > 0) {
            query.personnelId = { $in: personnelIds.map(id => new mongoose.Types.ObjectId(id)) };
        }
        if (serviceWeeks) query.week = { $in: serviceWeeks };
        if (site) query.site = site;

        console.log("Query = ", query);
        // Fetch weekly invoices and populate the invoices field
        const weeklyInvoices = await WeeklyInvoice.find(query).populate('invoices').populate({ path: 'personnelId' });

        res.status(200).json({ message: 'Weekly invoices retrieved successfully', data: weeklyInvoices });
    } catch (error) {
        console.error('Error retrieving weekly invoices:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// PUT route to update weekly invoice and associated installments
const updateWeeklyInvoice = async (req, res) => {
    try {
        const { WeeklyInvoice } = getModels(req);
        const { weeklyInvoiceId, weeklyTotal } = req.body;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(weeklyInvoiceId)) {
            return res.status(400).json({ message: 'Invalid weeklyInvoiceId format' });
        }

        // Update the WeeklyInvoice document
        await WeeklyInvoice.findByIdAndUpdate(
            weeklyInvoiceId,
            {
                total: weeklyTotal,
            },
            { new: true }
        );

        const updatedWeeklyInvoice = await WeeklyInvoice.findById(weeklyInvoiceId).populate('invoices').populate({ path: 'personnelId' });

        if (!updatedWeeklyInvoice) {
            return res.status(404).json({ message: 'Weekly invoice not found' });
        }

        res.status(200).json({
            message: 'Weekly invoice updated successfully',
            weeklyInvoice: updatedWeeklyInvoice
        });
    } catch (error) {
        console.error('Error updating weekly invoice:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const updateDocument = async (req, res) => {
    try {
        const { WeeklyInvoice, User, Notification } = getModels(req);
        const { weeklyInvoiceId, personnelId, personnelEmail, personnelName, actionType, serviceWeek } = req.body;

        if (!['sentInvoice', 'downloadInvoice'].includes(actionType)) {
            return res.status(400).json({ message: 'Invalid actionType' });
        }

        if (!mongoose.Types.ObjectId.isValid(weeklyInvoiceId)) {
            return res.status(400).json({ message: 'Invalid weeklyInvoiceId' });
        }

        const fileUrl = req.file?.location;
        if (!fileUrl) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const update = {
            $push: {
                [actionType]: {
                    date: new Date(),
                    document: fileUrl,
                },
            },
        };

        await WeeklyInvoice.findByIdAndUpdate(weeklyInvoiceId, update, { new: true });

        const updated = await WeeklyInvoice.findById(weeklyInvoiceId).populate('invoices').populate({ path: 'personnelId' });

        if (!updated) {
            return res.status(404).json({ message: 'Weekly invoice not found' });
        }

        // --- Send email if sentInvoice ---
        if (actionType === 'sentInvoice') {

            const mailOptions = {
                from: process.env.MAILER_EMAIL,
                to: personnelEmail,
                subject: 'Your Payslip is Ready',
                html: `
          <div style="font-family: Arial, sans-serif; background-color: #f4f8ff; padding: 20px; border-radius: 10px; text-align: center;">
            <h2 style="color: #2a73cc;">Your PaySlip is Ready, ${personnelName} </h2>
            <p style="font-size: 16px; color: #333;">Please check your earnings for the Week ${serviceWeek} below:</p>
            <div style="margin: 20px 0;">
              <a href="${fileUrl}" target="_blank" rel="noopener" 
                style="background-color: #ff9900; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold; display: inline-block;">
                📄 Download Invoice
              </a>
            </div>
            <p style="color: #555;">Thank you for your hard work!</p>
            <p style="font-weight: bold; color: #2a73cc;">Best wishes,<br>Raina Ltd.</p>
          </div >
                `,
            };

            await transporter.sendMail(mailOptions);

            // Optional: Send push notification if user has Expo token
            // const user = await User.findById(driverId);
            // if (user?.expoPushTokens?.length) {
            //     const expo = new Expo();
            //     const message = {
            //         to: user.expoPushTokens,
            //         title: 'New Invoice Available',
            //         body: 'Your new payslip has been sent.',
            //         isRead: false,
            //     };

            //     try {
            //         await expo.sendPushNotificationsAsync([message]);
            //     } catch (err) {
            //         console.error('Expo notification error:', err.message);
            //     }
            // }

            // // Save notification in DB
            // await new Notification({
            //     title: 'Invoice Sent',
            //     user_ID: user?.user_ID,
            //     body: 'A new payslip has been emailed to you.',
            //     isRead: false,
            //     targetDevice: 'app',
            // }).save();

        }

        res.status(200).json({
            message: `${actionType === 'sentInvoice' ? 'Invoice sent and saved' : 'Invoice downloaded and saved'} `,
            url: fileUrl,
            updatedWeeklyInvoice: updated,
        });
    } catch (error) {
        console.error('Error uploading document:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

module.exports = { fetchWeeklyInvoices, updateWeeklyInvoice, updateDocument };