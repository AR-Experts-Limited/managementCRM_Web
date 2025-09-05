const { Expo } = require('expo-server-sdk');
const { sendToClients } = require('../utils/sseService');

// Helper function to get models from req.db
const getModels = (req) => ({
  AdditionalCharges: req.db.model('AdditionalCharges', require('../models/AdditionalCharges').schema),
  Personnel: req.db.model('Personnel', require('../models/Personnel').schema),
  DayInvoice: req.db.model('DayInvoice', require('../models/DayInvoice').schema),
  WeeklyInvoice: req.db.model('WeeklyInvoice', require('../models/WeeklyInvoice').schema),
  User: req.db.model('User', require('../models/User').schema),
  Notification: req.db.model('Notification', require('../models/Notification').schema)
});

const createAdditionalCharge = async (req, res) => {
     const { personnelId, rate, role, type, week, title, vat, user_ID } = req.body;
  try {
    const { AdditionalCharges, Personnel, DayInvoice, WeeklyInvoice, User, Notification } = getModels(req);
    const doc = req.files[0]?.location || '';

    // Step 1: Find the WeeklyInvoice
    const weeklyInvoice = await WeeklyInvoice.findOne({ personnelId, week });
    if (!weeklyInvoice) {
      return res.status(404).json({ message: 'WeeklyInvoice not found for the given personnel and week' });
    }

    // Step 2: Calculate potential new total with the additional charge
    const parsedRate = +parseFloat(rate).toFixed(2);
    const isDeduction = type === 'deduction';
    const rateAdjustment = isDeduction ? -parsedRate : parsedRate;

    // Check if deduction would make total negative
    if (isDeduction && weeklyInvoice.total + rateAdjustment < 0) {
      return res.status(400).json({
        message: 'Cannot add deduction: Weekly invoice total would become negative'
      });
    }

    const personnel = await Personnel.findById(personnelId).lean();

    // Step 3: Create and save AdditionalCharges
    const newAddOn = new AdditionalCharges({
      personnelId,
      personnelName: personnel.firstName + ' ' + personnel.lastName,
      rate: parsedRate,
      role,
      type,
      vat,
      user_ID: personnel.user_ID,
      week,
      title,
      additionalChargeDocument: doc,
    });
    await newAddOn.save();

    // Step 4: Calculate base totals from linked DayInvoices
    const allDayInvoices = await DayInvoice.find({
      _id: { $in: weeklyInvoice.invoices },
    }).lean();
    
    let weeklyBaseTotal = 0;
    let weeklyVatTotal = 0;

    const isVatApplicable = (date) => {
      return (
        (personnel?.vatDetails?.vatNo && date >= new Date(personnel.vatDetails.vatEffectiveDate))
      );
    };

    // Sum DayInvoice totals
    for (const inv of allDayInvoices) {
      const invBaseTotal = +parseFloat(inv.total || 0).toFixed(2);

      console.log('Day Invoice Total:', inv._id, '-', inv.total);

      weeklyBaseTotal += invBaseTotal;
      if (isVatApplicable(new Date(inv.date))) {
        weeklyVatTotal += +parseFloat((invBaseTotal) * 0.2).toFixed(2);
      }
    }

    // Step 5: Add AdditionalCharges to WeeklyInvoice
    weeklyInvoice.additionalChargesDetail = weeklyInvoice.additionalChargesDetail || [];
    weeklyInvoice.additionalChargesDetail.push({
      _id: newAddOn._id,
      personnelId,
      personnelName: personnel.firstName + ' ' + personnel.lastName,
      role,
      week,
      vat,
      title,
      type,
      rate: newAddOn.rate,
    });

    // Step 6: Calculate AdditionalCharges total
    let additionalChargesTotal = 0;
    for (const charge of weeklyInvoice.additionalChargesDetail) {
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

    // Step 9: Update WeeklyInvoice
    console.log('Weekly Total:', weeklyInvoice.total);
    console.log('VAT Total = ', weeklyInvoice.vatTotal);
    console.log('Final Weekly Total:', finalWeeklyTotal);
    console.log('Final VAT Total = ', weeklyVatTotal);

    weeklyInvoice.total = finalWeeklyTotal;
    weeklyInvoice.vatTotal = weeklyVatTotal;
    await weeklyInvoice.save();

    // Step 10: Notify user
    const user = await User.findOne({ user_ID });
    if (user?.expoPushTokens) {
      const expo = new Expo();
      const message = {
        to: user.expoPushTokens,
        title: 'New Additional Charge Added',
        body: `A new additional charge (${title}) has been added for ${personnel.firstName} ${personnel.lastName}`,
        data: { additionalChargeId: newAddOn._id },
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
        title: 'New Additional Charge Added',
        user_ID,
        body: `A new additional charge (${title}) has been added for ${personnel.firstName} ${personnel.lastName}`,
        data: { additionalChargeId: newAddOn._id },
        isRead: false,
      },
      targetDevice: 'app',
    });
    await notification.save();

    // Step 12: Notify frontend
    sendToClients(req.db, { type: 'additionalChargeUpdated' });

    res.status(200).json({ obj: newAddOn, message: 'new additional charge added' });
  } catch (err) {
    console.error('Error adding additional charge:', err);
    res.status(500).json({ message: 'error saving additional charge', error: err.message });
  }
}

const fetchAdditionalCharges = async (req, res) => {
    const { Personnel, AdditionalCharges } = getModels(req);

    try {
      const charges = await AdditionalCharges.find({});
      const personnelIds = charges.map(c => c.personnelId);

      const activePersonnels = await Personnel.find({
        _id: { $in: personnelIds },
        disabled: { $ne: true }
      });

      const activePersonnelIds = new Set(activePersonnels.map(d => d._id.toString()));

      const filtered = charges.filter(c =>
        !c.personnelId || activePersonnelIds.has(c.personnelId.toString())
      );

      res.status(200).json(filtered);
    } catch (err) {
      console.error("Error fetching additional charges:", err);
      res.status(500).json({ message: 'Error fetching additional charges', error: err.message });
    }
}

const fetchAdditionalChargesByRolesWeek = async (req, res) => {
  const { role, week } = req.query;

  if (!role || !week) {
    return res.status(400).json({ message: "Missing role or week in query" });
  }

  try {
    const { AdditionalCharges } = getModels(req);

    const charges = await AdditionalCharges.find({
      role: role,
      week: week
    });

    res.status(200).json(charges);
  } catch (err) {
    console.error("Error fetching additional charges by role and week:", err);
    res.status(500).json({ message: 'Error fetching additional charges', error: err.message });
  }
}

const deleteAdditionalCharge = async (req, res) => {
    try {
    const { AdditionalCharges, Personnel, DayInvoice, WeeklyInvoice, User, Notification } = getModels(req);
    const additionalChargeId = req.params.id;

    // Step 1: Find the AdditionalCharges
    const additionalCharge = await AdditionalCharges.findById(additionalChargeId);
    if (!additionalCharge) {
      return res.status(404).json({ message: 'Additional Charge not found' });
    }

    // Step 2: Find the WeeklyInvoice
    const weeklyInvoice = await WeeklyInvoice.findOne({
      personnelId: additionalCharge.personnelId,
      week: additionalCharge.week,
    });

    if (!weeklyInvoice) {
      // If no WeeklyInvoice, we can safely delete the AdditionalCharge
      await AdditionalCharges.findByIdAndDelete(additionalChargeId);
      return res.status(200).json({ message: 'Additional Charge deleted, no WeeklyInvoice found' });
    }

    // Step 3: Check if removing this addition would make total negative
    if (additionalCharge.type !== 'deduction') {
      const currentWeeklyTotal = +parseFloat(weeklyInvoice.total || 0).toFixed(2);
      const chargeRate = +parseFloat(additionalCharge.rate || 0).toFixed(2);
      let potentialNewTotal = currentWeeklyTotal - chargeRate;
      if (potentialNewTotal < 0) {
        return res.status(400).json({
          message: 'Cannot delete additional charge: Weekly invoice total would become negative'
        });
      }
    }

    // Step 4: Delete the AdditionalCharges
    await AdditionalCharges.findByIdAndDelete(additionalChargeId);

    // Step 5: Remove AdditionalCharges from WeeklyInvoice
    weeklyInvoice.additionalChargesDetail = weeklyInvoice.additionalChargesDetail.filter(
      (charge) => charge._id.toString() !== additionalChargeId
    );

    // Step 6: Recalculate WeeklyInvoice totals
    const allDayInvoices = await DayInvoice.find({
      _id: { $in: weeklyInvoice.invoices },
    }).lean();

    const personnel = await Personnel.findById(additionalCharge.personnelId);
    let weeklyBaseTotal = 0;
    let weeklyVatTotal = 0;

    const isVatApplicable = (date) => {
      return (
        (personnel?.vatDetails?.vatNo && date >= new Date(personnel.vatDetails.vatEffectiveDate))
      );
    };

    // Sum DayInvoice totals
    for (const inv of allDayInvoices) {
      const invBaseTotal = +parseFloat(inv.total || 0).toFixed(2);
      weeklyBaseTotal += invBaseTotal;
      if (isVatApplicable(new Date(inv.date))) {
        weeklyVatTotal += +parseFloat((invBaseTotal) * 0.2).toFixed(2);
      }
    }

    // Add remaining AdditionalCharges
    let additionalChargesTotal = 0;
    for (const charge of weeklyInvoice.additionalChargesDetail || []) {
      let rateAdjustment = charge.rate;
      if (charge.type === 'deduction') {
        rateAdjustment = -rateAdjustment;
      }
      additionalChargesTotal += +parseFloat(rateAdjustment).toFixed(2);
      // if (isVatApplicable(new Date(charge.week))) {
      //   weeklyVatTotal += +parseFloat(rateAdjustment * 0.2).toFixed(2);
      // }
    }

    weeklyBaseTotal = +parseFloat(weeklyBaseTotal + additionalChargesTotal).toFixed(2);
    weeklyVatTotal = +parseFloat(weeklyVatTotal).toFixed(2);
    const finalWeeklyTotal = +parseFloat(weeklyBaseTotal + weeklyVatTotal).toFixed(2);

    // Step 9: Update WeeklyInvoice
    weeklyInvoice.total = finalWeeklyTotal;
    weeklyInvoice.vatTotal = weeklyVatTotal;
    await weeklyInvoice.save();

    // Step 10: Notify user
    const user = await User.findOne({ user_ID: additionalCharge.user_ID });
    if (user?.expoPushTokens) {
      const expo = new Expo();
      const message = {
        to: user.expoPushTokens,
        title: 'Additional Charge Deleted',
        body: `An additional charge (${additionalCharge.title}) for ${additionalCharge.personnelName} has been deleted`,
        data: { additionalChargeId: additionalCharge._id },
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
        title: 'Additional Charge Deleted',
        user_ID: additionalCharge.user_ID,
        body: `An additional charge (${additionalCharge.title}) for ${additionalCharge.personnelName} has been deleted`,
        data: { additionalChargeId: additionalCharge._id },
        isRead: false,
      },
      targetDevice: 'app',
    });
    await notification.save();

    // Step 12: Notify frontend
    sendToClients(req.db, { type: 'additionalChargeUpdated' });

    res.status(200).json({ message: 'Additional Charge deleted and WeeklyInvoice updated' });
  } catch (err) {
    console.error('Error deleting additional charge:', err);
    res.status(500).json({ message: 'error deleting additional charge', error: err.message });
  }
}

module.exports = { createAdditionalCharge, fetchAdditionalCharges, fetchAdditionalChargesByRolesWeek, deleteAdditionalCharge };