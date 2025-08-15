const mongoose = require('mongoose');
const { sendToClients } = require('../utils/sseService');
const { Expo } = require('expo-server-sdk');

// Helper: convert ISO week to date
function getDateOfISOWeek(week, year) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4)
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  return ISOweekStart;
}

// Helper function to get models from req.db
const getModels = (req) => ({
  Deduction: req.db.model('Deduction', require('../models/deductions').schema),
  Personnel: req.db.model('Personnel', require('../models/Personnel').schema),
  DayInvoice: req.db.model('DayInvoice', require('../models/DayInvoice').schema),
  WeeklyInvoice: req.db.model('WeeklyInvoice', require('../models/WeeklyInvoice').schema),
  User: req.db.model('User', require('../models/User').schema),
  Notification: req.db.model('Notification', require('../models/Notification').schema),
  Incentive: req.db.model('Incentive', require('../models/Incentive').schema)
});

// GET route to check if a deduction is linked to any DayInvoice
const checkDayInvoice = async (req, res) => {
  const { deductionId, personnelId, date } = req.query;

  try {
    const { DayInvoice } = getModels(req);

    const dayInvoice = await DayInvoice.findOne({
      personnelId,
      date: new Date(date),
    }).lean(); // use lean for performance if you don't need Mongoose methods

    if (!dayInvoice) {
      return res.status(200).json({
        isLinked: false,
        message: 'No DayInvoice found for given personnel and date',
      });
    }

    const isLinked = dayInvoice.deductionDetail?.some(
      (ded) => ded._id?.toString() === deductionId
    );

    return res.status(200).json({
      isLinked,
      dayInvoiceId: dayInvoice._id,
      message: isLinked
        ? 'Deduction is linked to a DayInvoice'
        : 'Deduction is not linked to the DayInvoice',
    });
  } catch (error) {
    console.error('Error checking deduction link:', error);
    res.status(500).json({ message: 'Error checking deduction link', error: error.message });
  }
}

const addDeduction = async (req, res) => {
  const { site, personnelId, user_ID, personnelName, date, signed, week } = req.body;
  let { addedBy } = req.body;

  try {
    const { Deduction, DayInvoice, WeeklyInvoice, User, Notification, Driver } = getModels(req);
    const doc = req.files[0]?.location || '';

    // Step 1: Check DayInvoice
    const dayInvoice = await DayInvoice.findOne({ personnelId, date });
    if (dayInvoice) {
      const potentialDayTotal = +parseFloat(dayInvoice.total - rate).toFixed(2);
      if (potentialDayTotal < 0) {
        return res.status(400).json({ message: 'Cannot apply deduction: resulting day invoice total would be negative' });
      }
    }

    // Step 2: Validate WeeklyInvoice using updated DayInvoice totals
    const serviceWeek = dayInvoice?.serviceWeek || week;
    const weeklyInvoice = await WeeklyInvoice.findOne({ personnelId, serviceWeek })
      .populate('personnelId')
      .populate('invoices')
      .lean();

    if (weeklyInvoice) {
      const personnelData = weeklyInvoice.personnelId;
      let weeklyBaseTotal = 0;
      let weeklyVatTotal = 0;

      const isVatApplicable = (date) => {
        return (
          (personnelData?.vatDetails?.vatNo && date >= new Date(personnelData.vatDetails.vatEffectiveDate))
        );
      };

      // Calculate updated DayInvoice totals
      const allDayInvoices = weeklyInvoice.invoices || [];
      for (const inv of allDayInvoices) {
        let totalDeductions = inv.deductionDetail?.reduce(
          (sum, ded) => sum + Number(ded.rate || 0),
          0
        );
        let invBaseTotal = +parseFloat(inv.total || 0).toFixed(2);
        if (inv._id.toString() === dayInvoice?._id.toString()) {
          invBaseTotal = +parseFloat(inv.total - rate).toFixed(2);
          totalDeductions += rate
        }
        weeklyBaseTotal += invBaseTotal;
        if (isVatApplicable(new Date(inv.date))) {
          weeklyVatTotal += +parseFloat((invBaseTotal + totalDeductions) * 0.2).toFixed(2);
        }
      }

      // Add additional charges
      let additionalChargesTotal = 0;
      for (const charge of weeklyInvoice.additionalChargesDetail || []) {
        let rateAdjustment = +parseFloat(charge.rate).toFixed(2);
        if (charge.type === 'deduction') {
          rateAdjustment = -rateAdjustment;
        }
        additionalChargesTotal += rateAdjustment;
      }

      weeklyBaseTotal = +parseFloat(weeklyBaseTotal + additionalChargesTotal).toFixed(2);
      weeklyVatTotal = +parseFloat(weeklyVatTotal).toFixed(2);
      const weeklyTotalBeforeInstallments = +parseFloat(weeklyBaseTotal + weeklyVatTotal).toFixed(2);

      if (weeklyTotalBeforeInstallments < 0) {
        return res.status(400).json({
          message: 'Cannot apply deduction: resulting weekly invoice total would be negative',
          type: 'WeeklyInvoice',
        });
      }
    }

    // Step 3: Create and save Deduction
    const newDeduction = new Deduction({
      site,
      personnelId,
      user_ID,
      personnelName,
      rate: +parseFloat(rate).toFixed(2),
      date,
      signed,
      deductionDocument: doc,
      addedBy: JSON.parse(addedBy),
      week,
    });
    await newDeduction.save();

    if (dayInvoice) {
      // Step 4: Attach deduction to DayInvoice
      dayInvoice.total = +parseFloat(dayInvoice.total - rate).toFixed(2);
      dayInvoice.deductionDetail = dayInvoice.deductionDetail || [];
      dayInvoice.deductionDetail.push({
        _id: newDeduction._id,
        personnelId,
        user_ID,
        date,
        personnelName,
        site,
        rate: +parseFloat(newDeduction.rate).toFixed(2),
        signed: newDeduction.signed,
        deductionDocument: newDeduction.deductionDocument,
      });

      await dayInvoice.save();

      // Step 5: Update WeeklyInvoice
      const weeklyInvoice = await WeeklyInvoice.findOne({ driverId, serviceWeek })
        .populate('personnelId')
        .populate('invoices');

      const personnel = weeklyInvoice?.personnelId;
      const allDayInvoices = weeklyInvoice?.invoices || [];

      let weeklyBaseTotal = 0;
      let weeklyVatTotal = 0;

      const isVatApplicable = (date) => {
        return (
          (personnel?.vatDetails?.vatNo && date >= new Date(personnel.vatDetails.vatEffectiveDate))
        );
      };

      // Sum DayInvoice totals
      for (const inv of allDayInvoices) {
        const totalDeductions = inv.deductionDetail?.reduce(
          (sum, ded) => sum + Number(ded.rate || 0),
          0
        );
        const invBaseTotal = +parseFloat(inv.total || 0).toFixed(2);
        weeklyBaseTotal += invBaseTotal;
        if (isVatApplicable(new Date(inv.date))) {
          weeklyVatTotal += +parseFloat((invBaseTotal + totalDeductions) * 0.2).toFixed(2);
        }
      }

      // Additional Charges
      let additionalChargesTotal = 0;
      for (const charge of weeklyInvoice.additionalChargesDetail || []) {
        let rateAdjustment = +parseFloat(charge.rate).toFixed(2);
        if (charge.type === 'deduction') {
          rateAdjustment = -rateAdjustment;
        }
        additionalChargesTotal += rateAdjustment;
      }

      weeklyBaseTotal = +parseFloat(weeklyBaseTotal + additionalChargesTotal).toFixed(2);
      weeklyVatTotal = +parseFloat(weeklyVatTotal).toFixed(2);
      const finalWeeklyTotal = +parseFloat(weeklyBaseTotal + weeklyVatTotal).toFixed(2);

      // Step 8: Update WeeklyInvoice
      await WeeklyInvoice.findByIdAndUpdate(
        weeklyInvoice._id,
        {
          $set: {
            total: finalWeeklyTotal,
            vatTotal: weeklyVatTotal,
            installmentDetail: mergedInstallments,
            installments: mergedInstallments.map((inst) => inst._id),
          },
        },
        { new: true }
      );
    }

    // Step 10: Notify user
    const user = await User.findOne({ user_ID });
    if (user?.expoPushTokens) {
      const expo = new Expo();
      const message = {
        to: user.expoPushTokens,
        title: 'New Deduction Added',
        body: `A new deduction has been added for ${personnelName} at ${site}`,
        data: { deductionId: newDeduction._id },
        isRead: false,
      };
      try {
        await expo.sendPushNotificationsAsync([message]);
      } catch (notificationError) {
        console.error('Push notification failed:', notificationError.message);
      }
    }

    // Step 11: Save notification
    const notification = new Notification({
      notification: {
        title: 'New Deduction Added Common',
        user_ID,
        body: `A new deduction has been added for ${personnelName} at ${site}`,
        data: { deductionId: newDeduction._id },
        isRead: false,
      },
      targetDevice: 'app',
    });
    await notification.save();

    // Step 12: Notify frontend
    sendToClients(req.db, { type: 'deductionUpdated' });

    res.status(201).json(newDeduction);

  } catch (error) {
    console.error('Error adding deduction:', error);
    res.status(500).json({ message: 'Error adding deduction', error: error.message });
  }
}

const deleteDeduction = async (req, res) => {
  try {
    const { Deduction, DayInvoice, WeeklyInvoice, Personnel, User, Notification } = getModels(req);
    const deductionId = req.params.id;

    const deduction = await Deduction.findById(deductionId);
    if (!deduction) {
      return res.status(404).json({ message: 'Deduction not found' });
    }

    // Step 1: Remove deduction from DayInvoice and restore its amount
    const dayInvoice = await DayInvoice.findOne({
      personnelId: deduction.personnelId,
      date: deduction.date,
      'deductionDetail._id': new mongoose.Types.ObjectId(deductionId),
    });

    if (dayInvoice) {
      dayInvoice.deductionDetail = dayInvoice.deductionDetail.filter(
        (d) => d._id?.toString() !== deductionId
      );
      dayInvoice.total = +parseFloat(dayInvoice.total + deduction.rate).toFixed(2);
      await dayInvoice.save();

      // Step 2: Recalculate WeeklyInvoice
      const { personnelId, serviceWeek } = dayInvoice;
      const weeklyInvoice = await WeeklyInvoice.findOne({ personnelId, serviceWeek })
        .populate('driverId')
        .populate('invoices');

      if (weeklyInvoice) {
        const personnel = weeklyInvoice.personnelId;
        const allDayInvoices = weeklyInvoice.invoices || [];

        let weeklyBaseTotal = 0;
        let weeklyVatTotal = 0;

        const isVatApplicable = (date) => {
          return (
            (personnel?.vatDetails?.vatNo && date >= new Date(personnel.vatDetails.vatEffectiveDate))
          );
        };

        // Sum DayInvoice totals
        for (const inv of allDayInvoices) {
          const totalDeductions = inv.deductionDetail?.reduce(
            (sum, ded) => sum + Number(ded.rate || 0),
            0
          );
          const invBaseTotal = +parseFloat(inv.total || 0).toFixed(2);
          weeklyBaseTotal += invBaseTotal;
          if (isVatApplicable(new Date(inv.date))) {
            weeklyVatTotal += +parseFloat((invBaseTotal + totalDeductions) * 0.2).toFixed(2);
          }
        }

        // Add existing AdditionalCharges contributions
        let additionalChargesTotal = 0;
        for (const charge of weeklyInvoice.additionalChargesDetail || []) {
          let rateAdjustment = +parseFloat(charge.rate).toFixed(2);
          if (charge.type === 'deduction') {
            rateAdjustment = -rateAdjustment;
          }
          additionalChargesTotal += rateAdjustment;
          if (isVatApplicable(new Date(charge.week))) {
            weeklyVatTotal += +parseFloat(rateAdjustment * 0.2).toFixed(2);
          }
        }

        weeklyBaseTotal = +parseFloat(weeklyBaseTotal + additionalChargesTotal).toFixed(2);
        weeklyVatTotal = +parseFloat(weeklyVatTotal).toFixed(2);
        const finalWeeklyTotal = +parseFloat(weeklyBaseTotal + weeklyVatTotal).toFixed(2);

        // Step 5: Update WeeklyInvoice
        await WeeklyInvoice.findByIdAndUpdate(
          weeklyInvoice._id,
          {
            $set: {
              total: finalWeeklyTotal,
              vatTotal: weeklyVatTotal
            },
          },
          { new: true }
        );
      }
    }

    // Step 7: Notify user
    const user = await User.findOne({ user_ID: deduction.user_ID });
    if (user?.expoPushTokens) {
      const expo = new Expo();
      const message = {
        to: user.expoPushTokens,
        title: 'Deduction Removed',
        body: `A deduction for ${deduction.personnelName} at ${deduction.site} has been removed`,
        data: { deductionId: deduction._id },
        isRead: false,
      };
      try {
        await expo.sendPushNotificationsAsync([message]);
      } catch (notificationError) {
        console.error('Push notification failed:', notificationError.message);
      }
    }

    // Step 8: Save notification
    const notification = new Notification({
      notification: {
        title: 'Deduction Removed',
        user_ID: deduction.user_ID,
        body: `A deduction for ${deduction.personnelName} at ${deduction.site} has been removed`,
        data: { deductionId: deduction._id },
        isRead: false,
      },
      targetDevice: 'app',
    });
    await notification.save();

    // Step 9: Delete the deduction
    await Deduction.findByIdAndDelete(deductionId);

    // Step 10: Notify frontend
    sendToClients(req.db, { type: 'deductionUpdated' });

    res.status(200).json({ message: 'Deduction deleted and invoices updated' });
  } catch (error) {
    console.error('Error deleting deduction:', error);
    res.status(500).json({ message: 'Error deleting deduction', error: error.message });
  }
}

//Get Deductions where Personnel is not Disabled
const fetchDeductions = async (req, res) => {
  const { site } = req.query; // Optional site filter

  try {
    const { Deduction, Personnel } = getModels(req); // Ensure both models are registered

    // Step 1: Fetch all deductions (optionally filtered by site)
    const query = site ? { site } : {};
    const deductions = await Deduction.find(query).populate('associatedIncentive');

    // Step 2: Get all driverIds from those deductions
    const personnelIds = deductions.map(d => d.personnelId);

    // Step 3: Fetch only disabled drivers (opposite of before)
    const disabledPersonnels = await Personnel.find({
      _id: { $in: personnelIds },
      disabled: true
    });

    const disabledPersonnelIds = new Set(disabledPersonnels.map(d => d._id.toString()));

    // Step 4: Filter out deductions linked to explicitly disabled drivers
    const filteredDeductions = deductions.filter(d =>
      !disabledPersonnelIds.has(d.personnelId.toString())
    );

    res.status(200).json(filteredDeductions);
  } catch (error) {
    console.error('Error fetching deductions:', error);
    res.status(500).json({ message: 'Error fetching deductions', error: error.message });
  }
}

// GET deductions filtered by site and ISO week (YYYY-W##)
const fetchDeductionBySiteWeek = async (req, res) => {
  const { site, serviceWeek } = req.query;

  if (!site || !serviceWeek) {
    return res.status(400).json({ message: "Both 'site' and 'serviceWeek' are required." });
  }

  try {
    const { Deduction } = getModels(req);
    const [year, weekStr] = serviceWeek.split("-W");
    const week = parseInt(weekStr, 10);
    const startDate = getDateOfISOWeek(week, parseInt(year));
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    // Query for deductions that fall in that week
    const deductions = await Deduction.find({
      site,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    });

    res.status(200).json(deductions);
  } catch (error) {
    console.error("Error fetching deductions for site and week:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
}

// GET deductions filtered by personnelId and date
const fetchDeductionByPersonnelId = async (req, res) => {
  const { personnelId, date } = req.query;
  try {
    const { Deduction } = getModels(req);
    const deductions = await Deduction.find({ personnelId, date });
    res.json(deductions);
  } catch (error) {
    console.error('Error fetching deductions:', error);
    res.status(500).json({ message: 'Error fetching deductions', error: error.message });
  }
}

const uploadDocument = async (req, res) => {
  const { _id } = req.body;
  const objectId = new mongoose.Types.ObjectId(_id);

  try {
    const { Deduction } = getModels(req);
    const doc = req.files[0]?.location || '';
    const updatedDeduction = await Deduction.findByIdAndUpdate(objectId, {
      $set: { deductionDocument: doc },
    });
    sendToClients(
      req.db, {
      type: 'deductionUpdated', // Custom event to signal data update
    });
    res.status(200).json(updatedDeduction);
  } catch (error) {
    res.status(500).json({ message: 'Error uploading document', error: error.message });
  }
}

const deleteUpload = async (req, res) => {
  const { id } = req.body;
  const objectId = new mongoose.Types.ObjectId(id);

  try {
    const { Deduction } = getModels(req);
    const updatedDeduction = await Deduction.findByIdAndUpdate(objectId, {
      $unset: { deductionDocument: '' },
    });
    sendToClients(
      req.db, {
      type: 'deductionUpdated', // Custom event to signal data update
    });
    res.status(200).json(updatedDeduction);
  } catch (error) {
    res.status(500).json({ message: 'Error deleting document', error: error.message });
  }
}


const fetchAllDeductionsForPersonnel = async (req, res) => {
  const { personnelId } = req.query;
  try {
    const { Deduction } = getModels(req);
    const deductions = await Deduction.find({ personnelId });
    res.json(deductions);
  } catch (error) {
    console.error('Error fetching deductions:', error);
    res.status(500).json({ message: 'Error fetching deductions', error: error.message });
  }
}

module.exports = { checkDayInvoice, addDeduction, deleteDeduction, fetchDeductions, fetchAllDeductionsForPersonnel, fetchDeductionBySiteWeek, fetchDeductionByPersonnelId, uploadDocument, deleteUpload }