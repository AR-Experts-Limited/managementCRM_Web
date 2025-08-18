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
    const AppData = req.db.model('AppData', require('../models/appdata').schema);
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

module.exports = { addSpendingInsight };