const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('./aws'); 
const { Expo } = require('expo-server-sdk');
const { sendToClients } = require('../utils/sseService');
const nodemailer = require('nodemailer');
const DayInvoice = require('../models/DayInvoice');

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    contentDisposition: 'inline',
    key: (req, file, cb) => {
      const user_ID = req.body.user_ID;
      const databaseName = req.db.db.databaseName
      cb(null, `${databaseName}/${user_ID}/payslips/${file.originalname}`);
    },
  }),
});

const round2 = (num) => +parseFloat(num).toFixed(2);

// Helper function to get models from req.db
const getModels = (req) => ({
  DayInvoice: req.db.model('DayInvoice', require('../models/DayInvoice').schema),
  WeeklyInvoice: req.db.model('WeeklyInvoice', require('../models/WeeklyInvoice').schema),
  User: req.db.model('User', require('../models/User').schema),
  Notification: req.db.model('Notification', require('../models/Notification').schema),
  IdCounter: req.db.model('IdCounter', require('../models/IdCounter').schema),
  Personnel: req.db.model('Personnel', require('../models/Personnel').schema),
  AdditionalCharges: req.db.model('AdditionalCharges', require('../models/AdditionalCharges').schema),
});


router.post('/', async (req, res) => {
  try {
    const { DayInvoice, IdCounter, WeeklyInvoice, Personnel, AdditionalCharges } = getModels(req);
    const {
      personnelId, week, site, personnelEmail, personnelName,
      invoiceGeneratedBy, date, total
    } = req.body;

    if (!personnelId || !week || !site) {
      return res.status(400).json({ message: 'personnelId, week, and site are required' });
    }

    const currentDate = new Date(date);
    const personnelData = await Personnel.findById(personnelId);

    // Generate invoice and reference numbers
    const invoiceCounter = await IdCounter.findOneAndUpdate(
      { idType: 'InvoiceNumber' },
      { $inc: { counterValue: 1 } },
      { new: true, upsert: true }
    );

    const existingInvoices = await DayInvoice.find({ personnelId, week });
    let referenceNumber;
    if (existingInvoices.length > 0) {
      referenceNumber = existingInvoices[0]?.referenceNumber || 0;
    } else {
      const referenceCounter = await IdCounter.findOneAndUpdate(
        { idType: 'ReferenceNumber' },
        { $inc: { counterValue: 1 } },
        { new: true, upsert: true }
      );
      referenceNumber = referenceCounter.counterValue;
    }

    // Round base total to 2 decimals
    const baseTotal = +parseFloat(total).toFixed(2);

    // Create and save new DayInvoice
    const newInvoice = new DayInvoice({
      ...req.body,
      invoiceNumber: invoiceCounter.counterValue,
      referenceNumber,
      invoiceGeneratedOn: new Date(),
      total: baseTotal,
    });
    await newInvoice.save();

    // Add newInvoice to WeeklyInvoice
    const weeklyInvoice = await WeeklyInvoice.findOneAndUpdate(
      { personnelId, week },
      {
        $addToSet: { invoices: newInvoice._id },
        $inc: { count: 1 },
        $set: {
          personnelId,
          user_ID: personnelData.user_ID,
          personnelEmail: personnelEmail || newInvoice.personnelEmail,
          personnelName: personnelName || newInvoice.personnelName,
          invoiceDetails: {
            invoiceGeneratedBy: invoiceGeneratedBy || newInvoice.invoiceGeneratedBy,
            invoiceGeneratedOn: currentDate,
          },
          referenceNumber: newInvoice.referenceNumber,
          site,
        },
      },
      { upsert: true, new: true }
    );

    // Check for existing AdditionalCharges
    // const additionalCharges = await AdditionalCharges.find({ personnelId, week: week });
    // if (additionalCharges.length > 0) {
    //   weeklyInvoice.additionalChargesDetail = weeklyInvoice.additionalChargesDetail || [];
    //   const existingChargeIds = new Set(
    //     weeklyInvoice.additionalChargesDetail.map((c) => c._id.toString())
    //   );
    //   additionalCharges.forEach((charge) => {
    //     if (!existingChargeIds.has(charge._id.toString())) {
    //       weeklyInvoice.additionalChargesDetail.push({
    //         _id: charge._id,
    //         personnelId: charge.personnelId,
    //         personnelName: charge.personnelName,
    //         site: charge.site,
    //         week: charge.week,
    //         title: charge.title,
    //         type: charge.type,
    //         rate: +parseFloat(charge.rate).toFixed(2),
    //       });
    //     }
    //   });
    // }

    // Calculate weekly total before installments
    const allInvoices = await DayInvoice.find({ personnelId, week }).lean();
    let weeklyBaseTotal = 0;
    let weeklyVatTotal = 0;

    const isVatApplicable = (date) => {
      return (
        (personnelData?.vatDetails?.vatNo && (date >= new Date(personnelData.vatDetails.vatEffectiveDate)))
      );
    };

    // Sum DayInvoice totals
    for (const inv of allInvoices) {
      const invBaseTotal = +parseFloat(inv.total || 0).toFixed(2);
      weeklyBaseTotal += invBaseTotal;
      if (isVatApplicable(new Date(inv.date))) {
        weeklyVatTotal += +parseFloat(invBaseTotal * 0.2).toFixed(2);
      }
    }

    // Add AdditionalCharges contributions
    let additionalChargesTotal = 0;
    for (const charge of weeklyInvoice.additionalChargesDetail || []) {
      let rateAdjustment = charge.rate;
      if (charge.type === 'deduction') {
        rateAdjustment = -rateAdjustment;
      }
      additionalChargesTotal += +parseFloat(rateAdjustment).toFixed(2);
      if (isVatApplicable(new Date(charge.week))) {
        weeklyVatTotal += +parseFloat(rateAdjustment * 0.2).toFixed(2);
      }
    }

    weeklyBaseTotal = +parseFloat(weeklyBaseTotal + additionalChargesTotal).toFixed(2);
    weeklyVatTotal = +parseFloat(weeklyVatTotal).toFixed(2);
    const finalWeeklyTotal = +parseFloat(weeklyBaseTotal + weeklyVatTotal).toFixed(2);

    // Update WeeklyInvoice with final totals, installments, and installment IDs
    await WeeklyInvoice.findOneAndUpdate(
      { personnelId, week },
      {
        $set: {
          vatTotal: weeklyVatTotal,
          total: finalWeeklyTotal,
          additionalChargesDetail: weeklyInvoice.additionalChargesDetail,
        },
      },
      { new: true }
    );

    sendToClients(req.db, { type: 'rotaAdded', data: newInvoice });
    res.status(200).json(newInvoice);
  } catch (error) {
    console.error('Error saving invoice:', error);
    res.status(500).json({ message: 'Error saving invoice', error: error.message });
  }
});

//Route for Updating Comments
router.put('/comments', async (req, res) => {
  try {
    const { invoiceID } = req.query;
    const commentObj = req.body;
    const { DayInvoice } = getModels(req);

    if (!invoiceID) {
      return res.status(400).json({ message: "Missing invoiceID" });
    }

    const updatedInvoice = await DayInvoice.findByIdAndUpdate(
      invoiceID,
      { $set: { comments: commentObj } },
      { new: true }
    );
    res.status(200).json(updatedInvoice);
  } catch (error) {
    res.status(500).json({ message: "Error updating Invoice comment", error: error.message });
  }
});

router.put('/:invoiceId', async (req, res) => {
  const round2 = (num) => +parseFloat(num || 0).toFixed(2);

  try {
    const { DayInvoice, WeeklyInvoice, Personnel, AdditionalCharges } = getModels(req);
    const { invoiceId } = req.params;
    const {
      incentiveDetail, deductionDetail, personnelId, week, site, date, modifiedBy, total
    } = req.body;

    if (!invoiceId || !personnelId || !week || !site) {
      return res.status(400).json({ message: 'invoiceId, personnelId, week, and site are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json({ message: 'Invalid invoiceId provided' });
    }

    const personnelData = await Personnel.findById(personnelId).lean();
    const invoiceToUpdate = await DayInvoice.findById(invoiceId).lean();
    if (!invoiceToUpdate) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // ----------------------------------
    // PHASE 1: Validate WeeklyInvoice Total
    // ----------------------------------
    const weeklyInvoice = await WeeklyInvoice.findOne({ personnelId, week })
      .populate('personnelId')
      .lean();
    if (!weeklyInvoice) {
      return res.status(404).json({ message: 'WeeklyInvoice not found' });
    }

    // Calculate potential WeeklyInvoice total with updated DayInvoice total
    const allInvoices = await DayInvoice.find({ personnelId, week, _id: { $ne: invoiceId } }).lean();
    let weeklyBaseTotal = round2(total); // Use the new total from the request
    let weeklyVatTotal = 0;

    const isVatApplicable = (date) => {
      return (
        (personnelData?.vatDetails?.vatNo && (date >= new Date(personnelData.vatDetails.vatEffectiveDate)))
      );
    };

    // Sum other DayInvoice totals
    for (const inv of allInvoices) {
      const invBaseTotal = round2(inv.total || 0);
      weeklyBaseTotal += invBaseTotal;
      if (isVatApplicable(new Date(inv.date))) {
        weeklyVatTotal += round2(invBaseTotal * 0.2);
      }
    }

    // Add VAT for the updated invoice if applicable
    if (isVatApplicable(new Date(date))) {
      weeklyVatTotal += round2(total * 0.2);
    }

    // Add AdditionalCharges contributions
    let additionalChargesTotal = 0;
    for (const charge of weeklyInvoice.additionalChargesDetail || []) {
      let rateAdjustment = round2(charge.rate);
      if (charge.type === 'deduction') {
        rateAdjustment = -rateAdjustment;
      }
      additionalChargesTotal += rateAdjustment;
    }

    weeklyBaseTotal = round2(weeklyBaseTotal + additionalChargesTotal);
    weeklyVatTotal = round2(weeklyVatTotal);
    const weeklyTotalBeforeInstallments = round2(weeklyBaseTotal + weeklyVatTotal);

    // Check if the new WeeklyInvoice total would be negative
    if (weeklyTotalBeforeInstallments < 0) {
      return res.status(400).json({
        message: 'Cannot update invoice: weekly invoice would have a negative total',
        negativeInvoices: [{
          personnelName: personnelData?.firstName + ' ' + personnelData?.lastName || 'Unknown Personnel',
          week: weeklyInvoice.week,
          type: 'WeeklyInvoice',
        }],
        type: 'WeeklyInvoice',
      });
    }

    // ----------------------------------
    // PHASE 2: Update DayInvoice
    // ----------------------------------
    const updatedBaseTotal = round2(total);
    await DayInvoice.findByIdAndUpdate(
      invoiceId,
      {
        $set: {
          incentiveDetail,
          personnelId,
          week,
          site,
          date,
          deductionDetail,
          total: updatedBaseTotal,
          modifiedOn: new Date(),
          modifiedBy,
        },
      },
      { new: true }
    );

    // ----------------------------------
    // PHASE 3: Update WeeklyInvoice
    // ----------------------------------
    let finalWeeklyBaseTotal = 0;
    let finalWeeklyVatTotal = 0;

    // Recalculate with updated DayInvoice (re-fetch to ensure consistency)
    const updatedInvoices = await DayInvoice.find({ personnelId, week }).lean();
    for (const inv of updatedInvoices) {
      const invBaseTotal = round2(inv.total || 0);
      finalWeeklyBaseTotal += invBaseTotal;
      if (isVatApplicable(new Date(inv.date))) {
        finalWeeklyVatTotal += round2(invBaseTotal * 0.2);
      }
    }

    // Add AdditionalCharges contributions
    let finalAdditionalChargesTotal = 0;
    for (const charge of weeklyInvoice.additionalChargesDetail || []) {
      let rateAdjustment = round2(charge.rate);
      if (charge.type === 'deduction') {
        rateAdjustment = -rateAdjustment;
      }
      finalAdditionalChargesTotal += rateAdjustment;
    }

    finalWeeklyBaseTotal = round2(finalWeeklyBaseTotal + finalAdditionalChargesTotal);
    finalWeeklyVatTotal = round2(finalWeeklyVatTotal);
    const finalWeeklyTotal = round2(finalWeeklyBaseTotal + finalWeeklyVatTotal);

    // Update WeeklyInvoice
    await WeeklyInvoice.findOneAndUpdate(
      { personnelId, week },
      {
        $set: {
          vatTotal: finalWeeklyVatTotal,
          total: finalWeeklyTotal,
        },
      },
      { new: true }
    );

    // Fetch updated DayInvoice for response
    const updatedInvoice = await DayInvoice.findById(invoiceId).lean();

    sendToClients(req.db, { type: 'rotaUpdated' });
    res.status(200).json(updatedInvoice);
  } catch (err) {
    console.error('Error updating invoice:', err);
    res.status(500).json({ message: 'Error updating invoice', error: err.message });
  }
});

router.delete('/', async (req, res) => {
  const round2 = (num) => +parseFloat(num || 0).toFixed(2);

  try {
    const { DayInvoice, WeeklyInvoice, Personnel, AdditionalCharges } = getModels(req);
    const { _id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: 'Invalid DayInvoice ID provided' });
    }

    // Find the invoice
    const invoice = await DayInvoice.findById(_id).lean();
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const { personnelId, week, site } = invoice;

    // Check if this is the only DayInvoice for the week
    const remainingInvoices = await DayInvoice.find({ personnelId, week, _id: { $ne: _id } }).lean();
    const weeklyInvoice = await WeeklyInvoice.findOne({ personnelId, week })
      .populate('personnelId')
      .lean();

    // ----------------------------------
    // PHASE 1: Handle Single DayInvoice Case
    // ----------------------------------
    if (remainingInvoices.length === 0) {
      // Delete the DayInvoice
      await DayInvoice.findByIdAndDelete(_id);

      if (weeklyInvoice) {
        // Delete AdditionalCharges associated with the WeeklyInvoice
        await AdditionalCharges.deleteMany({ personnelId, week: week });

        // Delete WeeklyInvoice
        await WeeklyInvoice.findByIdAndDelete(weeklyInvoice._id);
      }

      sendToClients(req.db, { type: 'rotaUpdated' });
      return res.status(200).json({ message: 'Invoice, WeeklyInvoice, and associated additional charges deleted successfully' });
    }

    // ----------------------------------
    // PHASE 2: Validate WeeklyInvoice Total (if multiple DayInvoices)
    // ----------------------------------
    if (weeklyInvoice) {
      const personnelData = weeklyInvoice.personnelId;
      let weeklyBaseTotal = 0;
      let weeklyVatTotal = 0;

      const isVatApplicable = (date) => {
        return (
          (personnelData?.vatDetails?.vatNo && date >= new Date(personnelData.vatDetails.vatEffectiveDate))
        );
      };

      // Sum remaining DayInvoice totals (excluding the one to be deleted)
      for (const inv of remainingInvoices) {
        const invBaseTotal = round2(inv.total);
        weeklyBaseTotal += invBaseTotal;
        if (isVatApplicable(new Date(inv.date))) {
          weeklyVatTotal += round2(invBaseTotal * 0.2);
        }
      }

      // Add AdditionalCharges contributions
      let additionalChargesTotal = 0;
      for (const charge of weeklyInvoice.additionalChargesDetail || []) {
        let rateAdjustment = round2(charge.rate);
        if (charge.type === 'deduction') {
          rateAdjustment = -rateAdjustment;
        }
        additionalChargesTotal += rateAdjustment;
      }

      weeklyBaseTotal = round2(weeklyBaseTotal + additionalChargesTotal);
      weeklyVatTotal = round2(weeklyVatTotal);
      const weeklyTotalBeforeInstallments = round2(weeklyBaseTotal + weeklyVatTotal);

      // Check if the new WeeklyInvoice total would be negative
      if (weeklyTotalBeforeInstallments < 0) {
        return res.status(400).json({
          message: 'Cannot delete invoice: weekly invoice would have a negative total',
          negativeInvoices: [{
            personnelName: personnelData?.firstName + ' ' + personnelData?.lastName || 'Unknown Personnel',
            week: weeklyInvoice.week,
            type: 'WeeklyInvoice',
          }],
          type: 'WeeklyInvoice',
        });
      }
    }

    // ----------------------------------
    // PHASE 3: Delete DayInvoice and Update WeeklyInvoice
    // ----------------------------------
    // Delete the invoice
    await DayInvoice.findByIdAndDelete(_id);

    if (!weeklyInvoice) {
      sendToClients(req.db, { type: 'rotaUpdated' });
      return res.status(200).json({ message: 'Invoice deleted, no weekly invoice found' });
    }

    // ----------------------------------
    // PHASE 4: Update WeeklyInvoice
    // ----------------------------------
    const personnelData = await Personnel.findById(personnelId).lean();
    let weeklyBaseTotal = 0;
    let weeklyVatTotal = 0;

    const isVatApplicable = (date) => {
      return (
        (personnelData?.vatDetails?.vatNo && date >= new Date(personnelData.vatDetails.vatEffectiveDate))
      );
    };

    // Sum remaining DayInvoice totals
    for (const inv of remainingInvoices) {
      const invBaseTotal = round2(inv.total);
      weeklyBaseTotal += invBaseTotal;
      if (isVatApplicable(new Date(inv.date))) {
        weeklyVatTotal += round2(invBaseTotal * 0.2);
      }
    }

    // Add AdditionalCharges contributions
    let additionalChargesTotal = 0;
    for (const charge of weeklyInvoice.additionalChargesDetail || []) {
      let rateAdjustment = round2(charge.rate);
      if (charge.type === 'deduction') {
        rateAdjustment = -rateAdjustment;
      }
      additionalChargesTotal += rateAdjustment;
      if (isVatApplicable(new Date(charge.week))) {
        weeklyVatTotal += round2(rateAdjustment * 0.2);
      }
    }

    weeklyBaseTotal = round2(weeklyBaseTotal + additionalChargesTotal);
    weeklyVatTotal = round2(weeklyVatTotal);
    const finalWeeklyTotal = round2(weeklyBaseTotal + weeklyVatTotal);

    // Update WeeklyInvoice
    await WeeklyInvoice.findOneAndUpdate(
      { personnelId, week },
      {
        $pull: { invoices: invoice._id },
        $inc: { count: -1 },
        $set: {
          vatTotal: weeklyVatTotal,
          total: finalWeeklyTotal
        },
      },
      { new: true }
    );

    sendToClients(req.db, { type: 'rotaUpdated' });
    res.status(200).json({ message: 'Invoice deleted and WeeklyInvoice updated successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ message: 'Error deleting invoice', error: error.message });
  }
});

// Route for fetching invoices by personnel, date range, and optional site
router.get('/', async (req, res) => {
  const { personnelId, startdate, enddate, site } = req.query;

  let query = {
    personnelId: { $in: personnelId },
    date: {
      $gte: new Date(startdate),
      $lte: new Date(enddate),
    },
  };

  if (site) query.site = site;

  try {
    const { DayInvoice } = getModels(req);
    const dayInvoices = await DayInvoice.find(query);
    res.status(200).json(dayInvoices);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoice', error: error.message });
  }
});

router.get('/siteandweek-multi', async (req, res) => {
  const { sitesArray, week, startDate, endDate } = req.query;
  const query = {};

  // Handle multiple sites
  if (Array.isArray(sitesArray) && sitesArray.length > 0) {
    query.site = { $in: sitesArray };
  }

  // Handle week filter
  if (week) {
    query.week = week;
  }

  // Handle date range
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  try {
    const { DayInvoice } = getModels(req);
    const dayInvoices = await DayInvoice.find(query);
    res.status(200).json(dayInvoices);
  } catch (error) {
    console.error("Error fetching multi-site day invoices:", error);
    res.status(500).json({
      message: 'Error fetching day invoices for given sites and week',
      error: error.message,
    });
  }
});

router.post('/workinghours', async (req, res) => {
  const { site, week, startDate, endDate } = req.body;
  const query = {};
  const isValidDate = (d) => d && !isNaN(new Date(d).getTime());

  if (site) query.site = site;
  if (week) query.week = week;

  let dateFilter = {};
  if (isValidDate(startDate) && isValidDate(endDate)) {
    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    dateFilter = { $gte: start, $lte: end };
    query.date = dateFilter;
  }

  try {
    const { DayInvoice } = getModels(req);
    const AppData = req.db.model('AppData', require('../models/AppData').schema);

    // 1. Fetch day invoices
    const dayInvoices = await DayInvoice.find(query);

    // 2. Collect unique (personnelId, date) pairs from DayInvoice
    const personnelDaySet = new Set();
    for (const inv of dayInvoices) {
      if (inv.personnelId && inv.date) {
        const dateKey = new Date(inv.date).toISOString().split('T')[0]; // "YYYY-MM-DD"
        personnelDaySet.add(`${inv.personnelId}_${dateKey}`);
      }
    }

    const personnelIds = [...new Set(dayInvoices.map(di => di.personnelId))];
    const appDataQuery = {};

    if (personnelIds.length > 0) {
      appDataQuery.personnelId = { $in: personnelIds };
    }
    if (dateFilter.$gte && dateFilter.$lte) {
      appDataQuery.day = dateFilter;
    }

    // 3. Fetch AppData for matching personnelIds and date range
    const appData = await AppData.find(appDataQuery);

    // 4. Create map from (personnelId + date) to AppData
    const appDataMap = {};
    for (const ad of appData) {
      if (!ad.day || !ad.personnelId) continue;
      const key = `${ad.personnelId}_${new Date(ad.day).getTime()}`;
      appDataMap[key] = {
        startTime: ad.startShiftChecklist?.startShiftTimestamp || null,
        endTime: ad.endShiftChecklist?.endShiftTimestamp || null,
      };
    }

    // 5: Map over dayInvoices and attach matching shiftTimes
    const combined = dayInvoices.map(inv => {
      const key = `${inv.personnelId}_${new Date(inv.date).getTime()}`;
      return {
        ...inv.toObject(),
        shiftTimes: appDataMap[key] || { startTime: null, endTime: null },
      };
    });


    res.status(200).json(combined);
  } catch (error) {
    console.error('Error in /workinghours:', error);
    res.status(500).json({
      message: 'Error fetching day invoices and shift times',
      error: error.message,
    });
  }
});

// Route for fetching invoices by personnel ID
router.get('/personnel', async (req, res) => {
  const { personnelId } = req.query;
  try {
    const { DayInvoice } = getModels(req);
    const dayInvoices = await DayInvoice.find({ personnelId });
    res.status(200).json(dayInvoices);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching day invoices for given personnel ID', error: error.message });
  }
});

// Route for uploading an invoice document
router.post('/uploadInvoice', upload.any(), async (req, res) => {
  const { user_ID, invoices, week, personnelName, personnelEmail } = req.body;
  const parsedInvoices = invoices.map(invoice => JSON.parse(invoice));
  const invoiceIDs = parsedInvoices.map(invoice => invoice._id);

  try {
    const { User, Notification, DayInvoice } = getModels(req);
    const invoiceDoc = req.files[0]?.location || '';

    const updateResults = await Promise.all(
      invoiceIDs.map(async (invoiceId) => {
        if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
          console.error(`Invalid ObjectId: ${invoiceId}`);
          return null;
        }

        const result = await DayInvoice.updateOne(
          { _id: invoiceId },
          { $set: { invoicedoc: invoiceDoc } }
        );
        return result;
      })
    );

    // Send push notification
    const user = await User.findOne({ user_ID });
    if (user?.expoPushTokens) {
      const expo = new Expo();
      const message = {
        to: user.expoPushTokens,
        title: 'New Invoice Added',
        body: 'A new invoice has been added',
        isRead: false,
      };

      try {
        await expo.sendPushNotificationsAsync([message]);
      } catch (notificationError) {
        console.error('Error sending push notification:', notificationError.message);
      }
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail', // or your chosen email service
      auth: {
        user: process.env.MAILER_EMAIL, // Your email address
        pass: process.env.MAILER_APP_PASSWORD, // Your email password or app password
      },
    });

    // Send OTP email
    const mailOptions = {
      from: process.env.MAILER_EMAIL, // Sender address
      to: user.email, // Receiver address (user's email)
      subject: 'A new payslip has been added',
      html: `<div style="font-family: Arial, sans-serif; background-color: #f4f8ff; padding: 20px; border-radius: 10px; text-align: center;">
      <h2 style="color: #2a73cc;">Your PaySlip is Ready, ${personnelName} </h2>
      <p style="font-size: 16px; color: #333;">Check out your earnings for service week <strong>${week}</strong> below:</p>
      
      <div style="margin: 20px 0;">
          <a href=${invoiceDoc} target="_blank" rel="noopener" 
             style="background-color: #ff9900; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-size: 18px; font-weight: bold; display: inline-block;">
             📄 Download Invoice
          </a>
      </div>
      
      <p style="color: #555;">Thank you for your hard work! </p>
      <p style="font-weight: bold; color: #2a73cc;">Best wishes,<br>Raina Ltd.</p>
  </div>`,
    };

    await transporter.sendMail(mailOptions);
    // Save notification
    const notification = {
      title: 'New Invoice Added',
      user_ID,
      body: 'A new invoice has been added',
      isRead: false,
    };
    await new Notification({ notification, targetDevice: 'app' }).save();

    res.status(200).json({ url: invoiceDoc });
  } catch (error) {
    res.status(500).json({ message: 'Error saving invoice document', error: error.message });
  }
});

// Route for fetching an invoice by ID
router.get('/dayInvoiceById/:id', async (req, res) => {
  try {
    const { DayInvoice } = getModels(req);
    const dayInvoice = await DayInvoice.findById(req.params.id);

    if (!dayInvoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.status(200).json(dayInvoice);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoice', error: error.message });
  }
});

router.post('/weekly-invoices', async (req, res) => {
  try {
    const { personnelIds, startdate, enddate } = req.body;
    const { DayInvoice, WeeklyInvoice } = getModels(req);

    if (!personnelIds || !Array.isArray(personnelIds) || personnelIds.length === 0) {
      return res.status(400).json({ error: 'personnelIds array is required' });
    }

    // Fetch invoices from DailyInvoice model
    const invoices = await DayInvoice.find({
      personnelId: { $in: personnelIds },
      date: {
        $gte: new Date(startdate),
        $lte: new Date(enddate),
      },
    });

    if (!invoices || invoices.length === 0) {
      return res.status(404).json({ error: 'No invoices found' });
    }

    // Group invoices by personnelId and week
    const groupedInvoices = invoices.reduce((acc, invoice) => {
      // Calculate ISO week from date
      const date = new Date(invoice.date);
      const week = invoice.week;

      const key = `${invoice.personnelId}-${week}`;

      if (!acc[key]) {
        acc[key] = {
          personnelId: invoice.personnelId,
          personnelEmail: invoice.personnelEmail,
          personnelName: invoice.personnelName,
          week: week,
          site: invoice.site,
          invoices: [],
          count: 0,
          invoiceDetails: {
            invoiceGeneratedBy: invoice.invoiceDetails.invoiceGeneratedBy,
            invoiceGeneratedOn: invoice.invoiceDetails.invoiceGeneratedOn,
          },
          referenceNumber: invoice.referenceNumber,
          unsigned: false,
        };
      }

      // Check for unsigned deductions or installments
      const unsignedDeductions = invoice.deductionDetail?.filter((dd) => !dd.signed);
      if (unsignedDeductions?.length > 0) {
        acc[key].unsigned = true;
      }
      acc[key].invoices.push(invoice._id);
      acc[key].count++;
      return acc;
    }, {});

    // Convert grouped invoices to array and save to WeeklyInvoice model
    const weeklyInvoices = Object.values(groupedInvoices);

    // Clear existing records for the same personnelId and week to avoid duplicates
    for (const invoice of weeklyInvoices) {

      const newWeeklyInvoice = new WeeklyInvoice({
        personnelId: invoice.personnelId,
        week: invoice.week,
        personnelEmail: invoice.personnelEmail,
        personnelName: invoice.personnelName,
        site: invoice.site,
        invoices: invoice.invoices,
        count: invoice.count,
        invoiceDetails: {
            invoiceGeneratedBy: invoice.invoiceDetails.invoiceGeneratedBy,
            invoiceGeneratedOn: invoice.invoiceDetails.invoiceGeneratedOn,
        },
        referenceNumber: invoice.referenceNumber,
        unsigned: invoice.unsigned,
      });

      await newWeeklyInvoice.save();
    }

    res.status(201).json({ message: 'Weekly invoices saved successfully', data: weeklyInvoices });
  } catch (error) {
    console.error('Error saving weekly invoices:', error);
    res.status(500).json({ error: 'Internal server error', errormsg: error });
  }
});

module.exports = router;