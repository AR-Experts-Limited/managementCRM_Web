const { Expo } = require('expo-server-sdk');
const { sendToClients } = require('../utils/sseService');
const nodemailer = require('nodemailer');
const DayInvoice = require('../models/DayInvoice');
const mongoose = require('mongoose');

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

const addDayInvoice = async (req, res) => {
    try {
    const { DayInvoice, IdCounter, WeeklyInvoice, Personnel, AdditionalCharges } = getModels(req);
    const {
      personnelId, week, role, invoiceGeneratedBy, date, total
    } = req.body;

    if (!personnelId || !week || !role) {
      return res.status(400).json({ message: 'personnelId, week, and role are required' });
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
          personnelEmail: personnelData.email,
          personnelName: personnelData.firstName + ' ' + personnelData.lastName,
          invoiceDetails: {
            invoiceGeneratedBy: invoiceGeneratedBy || newInvoice.invoiceGeneratedBy,
            invoiceGeneratedOn: currentDate,
          },
          referenceNumber: newInvoice.referenceNumber,
          role,
        },
      },
      { upsert: true, new: true }
    );

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
}

const fetchDayInvoiceById = async (req, res) => {
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
}

const uploadInvoice = async (req, res) => {
  const { user_ID, invoices, week } = req.body;
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
      <h2 style="color: #2a73cc;">Your PaySlip is Ready, ${user.firstName} ${user.lastName} </h2>
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
}

const fetchDayInvoiceByPersonnelId = async (req, res) => {
  const { personnelId } = req.query;
  try {
    const { DayInvoice } = getModels(req);
    const dayInvoices = await DayInvoice.find({ personnelId });
    res.status(200).json(dayInvoices);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching day invoices for given personnel ID', error: error.message });
  }
}

const workingHours = async (req, res) => {
  const { role, week, startDate, endDate } = req.body;
  const query = {};
  const isValidDate = (d) => d && !isNaN(new Date(d).getTime());

  if (role) query.role = role;
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
    const AppData = req.db.model('AppData', require('../models/appdata').schema);

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
}

const fetchDayInvoicesByRoleAndWeek = async (req, res) => {
  const { role, week, startDate, endDate } = req.query;
  const query = {};

  // Handle Role filter
  if (role) {
    query.role = role;
  }

  // Handle Week filter
  if (week) {
    query.week = week;
  }

  // Handle Date range
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
    console.error("Error fetching invoices:", error);
    res.status(500).json({
      message: 'Error fetching day invoices for given role and week',
      error: error.message,
    });
  }
}

const fetchDayInvoices = async (req, res) => {
  const { personnelId, startdate, enddate, role } = req.query;

  let query = {
    personnelId: { $in: personnelId },
    date: {
      $gte: new Date(startdate),
      $lte: new Date(enddate),
    },
  };

  if (role) query.role = role;

  try {
    const { DayInvoice } = getModels(req);
    const dayInvoices = await DayInvoice.find(query);
    res.status(200).json(dayInvoices);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoice', error: error.message });
  }
}

const deleteDayInvoice = async (req, res) => {
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

    const { personnelId, week, role } = invoice;

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
}

const updateDayInvoice = async (req, res) => {
  const round2 = (num) => +parseFloat(num || 0).toFixed(2);

  try {
    const { DayInvoice, WeeklyInvoice, Personnel, AdditionalCharges } = getModels(req);
    const { invoiceId } = req.params;
    const {
      incentiveDetail, deductionDetail, personnelId, week, role, date, modifiedBy, total
    } = req.body;

    if (!invoiceId || !personnelId || !week || !role) {
      return res.status(400).json({ message: 'invoiceId, personnelId, week, and role are required' });
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
          role,
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
}

const updateComments = async (req, res) => {
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
}

module.exports = { addDayInvoice, updateComments, updateDayInvoice, deleteDayInvoice, fetchDayInvoices, fetchDayInvoiceById, fetchDayInvoiceByPersonnelId, fetchDayInvoicesByRoleAndWeek, workingHours, uploadInvoice };