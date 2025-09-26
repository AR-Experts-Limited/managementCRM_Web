const getModels = (req) => ({
  Personnel: req.db.model('Personnel', require('../models/Personnel').schema),
  DayInvoice: req.db.model('DayInvoice', require('../models/DayInvoice').schema),
  ProfitLoss: req.db.model('ProfitLoss', require('../models/ProfitLoss').schema)
});

const addSpendingInsight = async (req, res) => {
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
    const Personnel = req.db.model('Personnel', require('../models/Personnel').schema);

    // 1) Fetch day invoices
    const dayInvoices = await DayInvoice.find(query);

    // 2) Collect unique personnelIds from DayInvoice
    const personnelIds = [...new Set(dayInvoices.map(di => di.personnelId).filter(Boolean))];

    // 3) Build AppData query (schema uses `date`, not `day`)
    const appDataQuery = {};
    if (personnelIds.length) appDataQuery.personnelId = { $in: personnelIds };
    if (dateFilter.$gte && dateFilter.$lte) appDataQuery.date = dateFilter;

    // 4) Fetch AppData and Personnel(dailyRate) in parallel
    const [appData, personnelRows] = await Promise.all([
      AppData.find(appDataQuery).lean(),
      personnelIds.length
        ? Personnel.find({ _id: { $in: personnelIds } })
            .select('_id dailyRate')
            .lean()
        : Promise.resolve([]),
    ]);

    // 5) Map: (personnelId + YYYY-MM-DD) -> shiftTimes
    const toYMD = (d) => new Date(d).toISOString().split('T')[0];
    const appDataMap = {};
    for (const ad of appData) {
      if (!ad.personnelId || !ad.date) continue;
      const key = `${ad.personnelId}_${toYMD(ad.date)}`;
      appDataMap[key] = {
        startTime: ad.startShiftChecklist?.startShiftTimestamp || null,
        endTime: ad.endShiftChecklist?.endShiftTimestamp || null,
      };
    }

    // 6) Map: personnelId -> dailyRate
    const rateMap = {};
    for (const p of personnelRows) {
      rateMap[p._id?.toString()] = p.dailyRate ?? null;
    }

    // 7) Attach shiftTimes + dailyRate to each invoice
    const combined = dayInvoices.map(inv => {
      const key = `${inv.personnelId}_${toYMD(inv.date)}`;
      return {
        ...inv.toObject(),
        shiftTimes: appDataMap[key] || { startTime: null, endTime: null },
        dailyRate: rateMap[inv.personnelId?.toString()] ?? null,
      };
    });

    return res.status(200).json(combined);
  } catch (error) {
    console.error('Error in /workinghours:', error);
    return res.status(500).json({
      message: 'Error fetching day invoices, shift times, and daily rate',
      error: error.message,
    });
  }
}

const fetchProfitLoss = async (req, res) => {
  const ProfitLoss = req.db.model('ProfitLoss', require('../models/ProfitLoss').schema);
  const { week } = req.query;
  try {
    const profitLoss = await ProfitLoss.find({ week });
    res.status(200).json(profitLoss);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching Profit Loss values!' });
  }
}

// POST /api/profitloss (upsert version)
const addProfitLoss = async (req, res) => {
  const ProfitLoss = req.db.model('ProfitLoss', require('../models/ProfitLoss').schema);

  try {
    let { personnelId, week, profitLoss, revenue, addedBy } = req.body || {};
    const pid = personnelId && typeof personnelId === 'object' ? personnelId._id : personnelId;

    if (!pid || !week) {
      return res.status(400).json({ message: 'personnelId and week are required' });
    }

    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const doc = await ProfitLoss.findOneAndUpdate(
      { personnelId: pid, week: String(week) },
      {
        $set: {
          profitLoss: toNum(profitLoss),
          revenue: toNum(revenue),
          addedBy: typeof addedBy === 'string' ? addedBy : JSON.stringify(addedBy || {})
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json(doc);
  } catch (error) {
    console.error('addProfitLoss error:', error);
    return res.status(500).json({ message: 'Error creating/updating Profit/Loss entry!' });
  }
};

module.exports = { addSpendingInsight, fetchProfitLoss, addProfitLoss };