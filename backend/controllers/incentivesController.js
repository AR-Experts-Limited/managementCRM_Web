const Incentive = require('../models/Incentive');
const DayInvoice = require("../models/DayInvoice");
const { sendToClients } = require('../utils/sseService');
const moment = require('moment');

const getModels = (req) => ({
  Personnel: req.db.model('Personnel', require('../models/Personnel').schema),
  DayInvoice: req.db.model('DayInvoice', require('../models/DayInvoice').schema),
  WeeklyInvoice: req.db.model('WeeklyInvoice', require('../models/WeeklyInvoice').schema),
  Incentive: req.db.model('Incentive', require('../models/Incentive').schema),
  Deduction: req.db.model('Deduction', require('../models/Deduction').schema),
});

// GET route to check if an incentive is linked to any DayInvoice
const checkDayInvoice = async (req, res) => {
  const { incentiveId, personnelId, date } = req.query;

  try {
    const { DayInvoice } = getModels(req);

    const dayInvoice = await DayInvoice.findOne({
      personnelId,
      date: new Date(date),
    }).lean();

    if (!dayInvoice) {
      return res.status(200).json({
        isLinked: false,
        message: 'No DayInvoice found for given driver and date',
      });
    }

    const isLinked = dayInvoice.incentiveDetail?.some(
      (inc) => inc._id?.toString() === incentiveId
    );

    return res.status(200).json({
      isLinked,
      dayInvoiceId: dayInvoice._id,
      message: isLinked
        ? 'Incentive is linked to a DayInvoice'
        : 'Incentive is not linked to the DayInvoice',
    });
  } catch (error) {
    console.error('Error checking incentive link:', error);
    res.status(500).json({ message: 'Error checking incentive link', error: error.message });
  }
}

const fetchIncentives = async (req, res) => {
  const { Incentive } = getModels(req)
  try {
    const incentives = await Incentive.find();
    res.status(200).json(incentives);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching incentives.', error });
  }
}

// Route to fetch Incentive by Personnel
const fetchIncentiveByPersonnel = async (req, res) => {
  const Incentive = req.db.model('Incentive', require('../models/Incentive').schema);
  const { personnelId, role, date} = req.query
  try {
    const query = {
      personnelId,
      startDate: { $lte: new Date(date) },
      endDate: { $gte: new Date(date) },
    };

    if (role)
        query.role = role;

    const incentiveDetail = await Incentive.find(query);
    res.status(200).json(incentiveDetail);
  }
  catch (error) {
    res.status(500).json({ message: "error fetching driver's incentive details" })
  }
}

const addIncentive = async (req, res) => {
  const { role, startDate, endDate, type, rate, addedBy } = req.body;

  try {
    const { Incentive, DayInvoice, WeeklyInvoice, Personnel } = getModels(req);

    // Step 1: Create and save Incentive
    const newIncentive = new Incentive({
      role,
      startDate,
      endDate,
      type,
      rate: +parseFloat(rate).toFixed(2),
      addedBy,
    });
    await newIncentive.save();

    // Step 2: Find affected DayInvoices
    // const startDate = moment(month, 'YYYY-MM').startOf('month').toDate();
    // const endOfMonth = moment(month, 'YYYY-MM').endOf('month').toDate();

    const query = {
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
      role
    };

    const dayInvoices = await DayInvoice.find(query);

    const affectedWeeklyInvoices = new Set();
    const bulkDayInvoiceOps = [];

    // Step 3: Update DayInvoices
    for (const dayInvoice of dayInvoices) {
      let update = {};
      let updated = false;

      if (dayInvoice) {
        update = {
          ...update,
          $push: {
            incentiveDetail: {
              _id: String(newIncentive._id),
              type: newIncentive.type,
              rate: newIncentive.rate,
              startDate: String(newIncentive.startDate),
              endDate: String(newIncentive.endDate)
            },
          },
          $set: {
            ...(update.$set || {}),
            total: +parseFloat(dayInvoice.total + newIncentive.rate).toFixed(2),
          },
        };
        updated = true;
      }

      if (updated) {
        bulkDayInvoiceOps.push({
          updateOne: {
            filter: { _id: dayInvoice._id },
            update,
          },
        });
        affectedWeeklyInvoices.add(`${dayInvoice.personnelId}_${dayInvoice.serviceWeek}`);
      }
    }


    if (bulkDayInvoiceOps.length > 0) {
      await DayInvoice.bulkWrite(bulkDayInvoiceOps);
    }

    // Step 4: Update affected WeeklyInvoices
    const bulkWeeklyInvoiceOps = [];

    for (const weeklyKey of affectedWeeklyInvoices) {
      const [personnelId, serviceWeek] = weeklyKey.split('_');
      const weeklyInvoice = await WeeklyInvoice.findOne({ personnelId, serviceWeek })
        .lean();
      if (!weeklyInvoice) continue;

      const allDayInvoices = await DayInvoice.find({
        _id: { $in: weeklyInvoice.invoices },
      }).lean();
      const personnel = await Personnel.findById(personnelId).lean();

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
        let rateAdjustment = charge.rate;
        if (charge.type === 'deduction') {
          rateAdjustment = -rateAdjustment;
        }
        additionalChargesTotal += +parseFloat(rateAdjustment).toFixed(2);
      }

      weeklyBaseTotal = +parseFloat(weeklyBaseTotal + additionalChargesTotal).toFixed(2);
      weeklyVatTotal = +parseFloat(weeklyVatTotal).toFixed(2);
      const finalWeeklyTotal = +parseFloat(weeklyBaseTotal + weeklyVatTotal).toFixed(2);

      // Prepare bulk update for WeeklyInvoice
      bulkWeeklyInvoiceOps.push({
        updateOne: {
          filter: { _id: weeklyInvoice._id },
          update: {
            $set: {
              total: finalWeeklyTotal,
              vatTotal: weeklyVatTotal
            },
          },
        },
      });
    }

    // Execute bulk writes for Installments and WeeklyInvoices
    if (bulkWeeklyInvoiceOps.length > 0) {
      await WeeklyInvoice.bulkWrite(bulkWeeklyInvoiceOps);
    }

    sendToClients(req.db, { type: 'incentivesUpdated' });

    res.status(201).json(newIncentive);
  } catch (error) {
    console.error('Error adding incentive:', error);
    res.status(500).json({ message: 'Error adding incentive', error: error.message });
  }
}

const deleteIncentive = async (req, res) => {
  const round2 = (num) => +parseFloat(num || 0).toFixed(2);

  try {
    const { Incentive, DayInvoice, WeeklyInvoice, Personnel } = getModels(req);
    const incentiveId = req.params.id;

    // Find the incentive
    const incentive = await Incentive.findById(incentiveId);
    if (!incentive) {
      return res.status(404).json({ message: 'Incentive not found' });
    }

    // Find DayInvoices that reference the incentive
    const dayInvoices = await DayInvoice.find({'incentiveDetail._id': incentiveId}).populate('personnelId').lean();

    if (!dayInvoices.length) {
      await Incentive.findByIdAndDelete(incentiveId);
      return res.status(200).json({ message: 'Incentive deleted, no DayInvoices found' });
    }

    // ----------------------------------
    // PHASE 1: Validate DayInvoices
    // ----------------------------------
    const negativeInvoices = [];
    const updatedDayInvoiceTotals = new Map();
    const bulkDayInvoiceOps = [];

    for (const invoice of dayInvoices) {
      let total = invoice.total;
      let updated = false;
      const update = {};

      const mainMatch = invoice.incentiveDetail?.find?.((i) => i._id.toString() === incentiveId);

      if (mainMatch) {
        total -= mainMatch.rate || 0;
        update.$pull = {
          ...update.$pull,
          incentiveDetailforMain: { _id: mainMatch._id },
        };
        updated = true;
      }

      if (updated && total < 0) {
        negativeInvoices.push({
          personnelName: invoice.personnelName || 'Unknown Driver',
          date: invoice.date,
          type: 'DailyInvoice',
        });
      } else if (updated) {
        update.$set = { total: round2(total) };
        bulkDayInvoiceOps.push({
          updateOne: {
            filter: { _id: invoice._id },
            update,
          },
        });
        updatedDayInvoiceTotals.set(invoice._id.toString(), {
          total: round2(total),
          personnelId: invoice.personnelId?._id?.toString(),
          serviceWeek: invoice.serviceWeek,
        });
      }
    }

    if (negativeInvoices.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete incentive: some daily invoices would have negative totals',
        negativeInvoices,
        type: 'DailyInvoice',
      });
    }

    // ----------------------------------
    // PHASE 2: Validate WeeklyInvoices
    // ----------------------------------
    const affectedWeeklyInvoices = new Set();
    const weeklyInvoices = await WeeklyInvoice.find({
      invoices: { $in: [...new Set(dayInvoices.map((inv) => inv._id))] },
    })
      .populate('personnelId')
      .lean();

    for (const weeklyInvoice of weeklyInvoices) {
      const personnelData = weeklyInvoice.personnelId;
      const personnelId = personnelData?._id?.toString();
      const week = weeklyInvoice.serviceWeek;

      // Fetch ALL DayInvoices for this WeeklyInvoice
      const allDayInvoices = await DayInvoice.find({
        _id: { $in: weeklyInvoice.invoices },
      }).lean();

      let weeklyBaseTotal = 0;
      let weeklyVatTotal = 0;

      const isVatApplicable = (date) => {
        return (
          (personnelData?.vatDetails?.vatNo && date >= new Date(personnelData.vatDetails.vatEffectiveDate))
        );
      };

      // Sum ALL DayInvoice totals, using updated totals for affected invoices
      for (const invoice of allDayInvoices) {
        const updatedInvoice = updatedDayInvoiceTotals.get(invoice._id.toString());
        const invBaseTotal = updatedInvoice ? updatedInvoice.total : round2(invoice.total);
        weeklyBaseTotal += invBaseTotal;
        const totalDeductions = invoice.deductionDetail?.reduce(
          (sum, ded) => sum + Number(ded.rate || 0),
          0
        );
        if (isVatApplicable(new Date(invoice.date))) {
          weeklyVatTotal += round2((invBaseTotal + totalDeductions) * 0.2);
        }
      }

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

      if (weeklyTotalBeforeInstallments < 0) {
        negativeInvoices.push({
          driverName: personnelData?.firstName + ' ' + personnelData?.lastName || 'Unknown Driver',
          serviceWeek: weeklyInvoice.serviceWeek,
          type: 'WeeklyInvoice',
        });
      } else {
        affectedWeeklyInvoices.add(`${personnelId}_${week}`);
      }
    }

    if (negativeInvoices.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete incentive: some weekly invoices would have negative totals',
        negativeInvoices,
        type: 'WeeklyInvoice',
      });
    }

    // ----------------------------------
    // PHASE 3: Apply DayInvoice Updates
    // ----------------------------------
    if (bulkDayInvoiceOps.length > 0) {
      await DayInvoice.bulkWrite(bulkDayInvoiceOps);
    }

    // ----------------------------------
    // PHASE 4: Recalculate WeeklyInvoices and Installments
    // ----------------------------------
    const bulkWeeklyInvoiceOps = [];

    for (const weeklyKey of affectedWeeklyInvoices) {
      const [personnelId, serviceWeek] = weeklyKey.split('_');
      const weeklyInvoice = await WeeklyInvoice.findOne({ driverId, serviceWeek })
        .lean();
      if (!weeklyInvoice) continue;

      const personnelData = await Personnel.findById(personnelId).lean();

      // Fetch ALL DayInvoices for this WeeklyInvoice
      const allDayInvoices = await DayInvoice.find({
        _id: { $in: weeklyInvoice.invoices },
      }).lean();

      let weeklyBaseTotal = 0;
      let weeklyVatTotal = 0;

      const isVatApplicable = (date) => {
        return (
          (personnelData?.vatDetails?.vatNo && date >= new Date(personnelData.vatDetails.vatEffectiveDate))
        );
      };

      // Sum ALL DayInvoice totals, using updated totals for affected invoices
      for (const invoice of allDayInvoices) {
        const updatedInvoice = updatedDayInvoiceTotals.get(invoice._id.toString());
        const invBaseTotal = updatedInvoice ? updatedInvoice.total : round2(invoice.total);
        weeklyBaseTotal += invBaseTotal;
        const totalDeductions = invoice.deductionDetail?.reduce(
          (sum, ded) => sum + Number(ded.rate || 0),
          0
        );
        if (isVatApplicable(new Date(invoice.date))) {
          weeklyVatTotal += round2((invBaseTotal + totalDeductions) * 0.2);
        }
      }

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
      const finalWeeklyTotal = round2(weeklyBaseTotal + weeklyVatTotal);

      bulkWeeklyInvoiceOps.push({
        updateOne: {
          filter: { _id: weeklyInvoice._id },
          update: {
            $set: {
              total: finalWeeklyTotal,
              vatTotal: weeklyVatTotal
            },
          },
        },
      });
    }

    if (bulkWeeklyInvoiceOps.length > 0) {
      await WeeklyInvoice.bulkWrite(bulkWeeklyInvoiceOps);
    }

    await Incentive.findByIdAndDelete(incentiveId);
    sendToClients(req.db, { type: 'incentivesUpdated' });

    res.status(200).json({ message: 'Incentive deleted and invoices updated' });
  } catch (error) {
    console.error('Error deleting incentive:', error);
    res.status(500).json({ message: 'Error deleting incentive', error: error.message });
  }
}

module.exports = { checkDayInvoice, fetchIncentives, fetchIncentiveByPersonnel, addIncentive, deleteIncentive };