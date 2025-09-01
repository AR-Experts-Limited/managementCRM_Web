const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const { sendToClients } = require('../utils/sseService');

const getModels = (req) => ({
  Personnel: req.db.model('Personnel', require('../models/Personnel').schema),
  IdCounter: req.db.model('IdCounter', require('../models/IdCounter').schema),
  WeeklyInvoice: req.db.model('WeeklyInvoice', require('../models/WeeklyInvoice').schema),
  DayInvoice: req.db.model('DayInvoice', require('../models/DayInvoice').schema),
  User: req.db.model('User', require('../models/User').schema),
  Notification: req.db.model('Notification', require('../models/Notification').schema),
  AdditionalCharges: req.db.model('AdditionalCharges', require('../models/AdditionalCharges').schema),
});

const parseJsonField = (data, fieldName) => {
  try {
    return data[fieldName] ? JSON.parse(data[fieldName]) : null;
  } catch (error) {
    console.error(`Error parsing ${fieldName}:`, error);
    return null;
  }
};

const createFileEntry = (file, isSmall = false) => {
  const entry = {
    original: file.location,
    timestamp: new Date(),
  };
  if (!isSmall) {
    entry.temp = '';
    entry.docApproval = true;
    entry.approvedBy = '';
  }
  return entry;
};

const fetchAllPersonnels = async (req, res) => {
  const { Personnel } = getModels(req);
  const personnels = await Personnel.find().sort({ firstName: 1 });
  res.json(personnels);
}

const fetchPersonnelbyId = async (req, res) => {
  const { personnelId } = req.query;
  const { Personnel } = getModels(req);
  const personnel = await Personnel.findOne({ _id: personnelId, disabled: { $ne: true } });
  if (!personnel) throw new Error('Personnel not found');
  res.json(personnel);
}

const fetchNiNumber = async (req, res) => {
  const { niNumber } = req.query;
  const { Personnel } = getModels(req);
  const personnel = await Personnel.findOne({ "niDetails.nationalInsuranceNumber": niNumber });
  if (!personnel) throw new Error('Personnel not found');
  res.json(personnel);
}

const fetchPersonnelCount = async (req, res) => {
  const { Personnel } = getModels(req);
  const personnelCount = await Personnel.countDocuments();
  res.json({ personnelCount });
}

const fetchNotificationDetails = async (req, res) => {
  const { Personnel } = getModels(req);
  const fields = 'siteSelection firstName lastName ecsDetails.ecsExpiry passportDetails.passportExpiry drivingLicenceDetails.dlExpiry rightToWorkDetails.rightToWorkExpiry drivingLicenseFrontImage drivingLicenseBackImage rightToWorkCard ecsCard expiredReasons addedBy activeStatus suspended';
  const personnels = await Personnel.find({ disabled: { $ne: true } }, fields);
  res.json(personnels);
}

const fetchPersonnelsBySite = async (req, res) => {
  const { siteSelection } = req.params;
  const { Personnel } = getModels(req);
  const personnels = await Personnel.find({ siteSelection: {$in: siteSelection}, disabled: { $ne: true } });
  res.json(personnels);
}

const addPersonnel = async (req, res) => {
  const { Personnel, Notification, User } = getModels(req);
  const personnelData = req.body;

  // Normalize siteSelection to an array of individual strings
  if (typeof personnelData.siteSelection === 'string') {
    personnelData.siteSelection = personnelData.siteSelection
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  } else if (Array.isArray(personnelData.siteSelection)) {
    // Handles: ['Site1, Site2, Site3'] -> ['Site1','Site2','Site3']
    personnelData.siteSelection = personnelData.siteSelection.flatMap(v =>
      String(v)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    );
  }

  // Parse JSON fields
  personnelData.addedBy = parseJsonField(personnelData, 'addedBy');
  personnelData.vatDetails = parseJsonField(personnelData, 'vatDetails');
  personnelData.companyVatDetails = parseJsonField(personnelData, 'companyVatDetails');
  personnelData.drivingLicenseDetails = parseJsonField(personnelData, 'drivingLicenseDetails');
  personnelData.passportDetails = parseJsonField(personnelData, 'passportDetails');
  personnelData.rightToWorkDetails = parseJsonField(personnelData, 'rightToWorkDetails');
  personnelData.ecsDetails = parseJsonField(personnelData, 'ecsDetails');
  personnelData.bankDetails = parseJsonField(personnelData, 'bankDetails');

  // Create empty arrays for standard documents
  const documentFields = [
    'profilePicture', 'drivingLicenseFrontImage',
    'drivingLicenseBackImage', 'passportDocument', 'ecsCard',
    'rightToWorkCard', 'signature'
  ];

  const personnelInitFields = {};
  documentFields.forEach(field => {
    personnelInitFields[field] = [];
  });

  // Initialize personnel document
  const newPersonnel = new Personnel({
    ...personnelData,
    ...personnelInitFields,
    additionalDocs: {},  // initially as a plain object
    docTimeStamps: {},
    disabled: false
  });

  // Temporary Map to hold additionalDocs during file processing
  const additionalDocsMap = new Map();

  req.files?.forEach((file) => {
    const isSmallEntry = ['profilePicture', 'signature'].includes(file.fieldname);
    const docEntry = createFileEntry(file, isSmallEntry);

    if (documentFields.includes(file.fieldname)) {
      newPersonnel[file.fieldname].push(docEntry);
    } else if (file.fieldname.match(/^extraDoc(\d+)_file(\d+)$/)) {
      const [, docIndex] = file.fieldname.match(/^extraDoc(\d+)_file(\d+)$/);
      const docLabel = req.body[`extraDoc${docIndex}_name`];
      if (docLabel) {
        const currentDocs = additionalDocsMap.get(docLabel) || [];
        currentDocs.push([docEntry]); // Assuming group structure
        additionalDocsMap.set(docLabel, currentDocs);
      }
    }
  });

  // Only set additionalDocs if any were uploaded
  if (additionalDocsMap.size > 0) {
    newPersonnel.additionalDocs = Object.fromEntries(additionalDocsMap);
  }

  // Generate user credentials
  const password = newPersonnel.email.split('@')[0];
  const OTP = (Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000).toString();
  const otpExpiryDate = new Date();
  otpExpiryDate.setDate(otpExpiryDate.getDate() + 365);
  const personnelAccess = [];
  const formattedUserID = newPersonnel.user_ID; // Assuming user_ID is provided in personnelData

  // Hash the password
  const saltRounds = 10;
  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, saltRounds);
  } catch (error) {
    console.error('Error hashing password:', error);
    return res.status(500).json({ message: 'Error hashing password', error: error.message });
  }

  // Create Personnel user using User model
  try {
    const newUser = new User({
      firstName: newPersonnel.firstName,
      lastName: newPersonnel.lastName,
      email: newPersonnel.email,
      password: hashedPassword,
      siteSelection: newPersonnel.siteSelection,
      role: newPersonnel.role,
      companyId: personnelData.companyId,
      access: personnelAccess,
      otp: OTP,
      otpVerified: false,
      otpExpiry: otpExpiryDate,
      user_ID: formattedUserID
    });

    await newUser.save();

    // Save personnel
    const savedPersonnel = await newPersonnel.save();

    // Create and save notification
    const notification = {
      personnel: savedPersonnel._id,
      site: personnelData.siteSelection,
      changed: 'personnels',
      message: `Personnel ${personnelData.firstName} ${personnelData.lastName} has been newly added}`,
    };
    await new Notification({ notification, targetDevice: 'website' }).save();

    // Send welcome email
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.MAILER_EMAIL,
          pass: process.env.MAILER_APP_PASSWORD,
        },
      });

      const mailOptions = {
        from: process.env.MAILER_EMAIL,
        to: newPersonnel.email,
        subject: `Welcome to Raina Ltd, ${newPersonnel.firstName} ${newPersonnel.lastName}!`,
        html: `
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
          <div style="font-family: Outfit,Arial, sans-serif; background-color: #f4f8ff; padding: 20px; border-radius: 10px; border: 2px solid #2a73cc;">
            <h2 style="color: #2a73cc; text-align: center;"> Welcome to Raina Ltd, ${newPersonnel.firstName} ${newPersonnel.lastName}! </h2>
            <p style="font-size: 16px; color: #333;">We are delighted to welcome you as a self-employed multi-drop delivery personnel. Your commitment to providing excellent delivery services is greatly appreciated, and we want to ensure you have a smooth start with us.</p>
            <h3 style="color: #ff9900;">🔍 Understanding Our Working Relationship</h3>
            <p>You have read and signed our <strong>Service Level Agreement (SLA)</strong>, which clarifies that our partnership is based on service provision, not employment. Raina Ltd serves as your <strong>Supplier</strong>, not your Employer.</p>
            <h3 style="color: #ff9900;">Invoice & Payment Information</h3>
            <ul style="color: #333;">
              <li>Your invoices will be sent to this email and can be accessed via our application.</li>
              <li>Please provide your <strong>Unique Taxpayer Reference (UTR) number</strong> within 4 weeks if not already submitted.</li>
              <li>If operating as a <strong>limited company</strong>, kindly send us your company details and bank information for smooth payments.</li>
            </ul>
            <h3 style="color: #2a73cc;"> Introducing BizAlign – Your Personnel App</h3>
            <p>To enhance your experience, we’ve introduced <strong>BizAlign</strong>, an ERP system designed to streamline administrative processes and improve efficiency.</p>
            <h3 style="color: #ff9900;">What You Need to Do</h3>
            <ul style="color: #333;">
              <li>Your login details are provided below. <strong>Save this email</strong> for future reference.</li>
              <li>Download the BizAlign app from the links below:</li>
            </ul>
            <p><strong>BizAlign Mobile Application:</strong></p>
            <p>
              <a href="https://apps.apple.com/us/app/bizalign-erp-system/id6742386791" target="_blank">
                <img src="https://erp-rainaltd.bizalign.co.uk/api/app-store-badge" 
                     alt="Download on the App Store" style="height: 40px">
              </a>
            </p>
            <p>
              <a href="https://play.google.com/store/apps/details?id=com.arexperts.bizalign&pcampaignid=web_share" target="_blank">
                <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" 
                     alt="Get it on Google Play" style="height: 60px;">
              </a>
            </p>
            <h3 style="color: #2a73cc;">Key Features of BizAlign</h3>
            <ul style="color: #333;">
              <li>✔ Track shifts & start/end procedures</li>
              <li>✔ Access self-billing invoices</li>
              <li>✔ View & manage deduction forms</li>
              <li>✔ Receive important notifications (keep them ON)</li>
              <li>✔ Upload & verify documents, sign forms digitally</li>
            </ul>
            <h3 style="color: #ff9900;">📌 Getting Started</h3>
            <p>Set up the app as soon as possible to ensure a seamless experience. Follow this video guide: <a href="https://youtu.be/PurUvKjuID0" style="color: #2a73cc; font-weight: bold;"><img src="https://upload.wikimedia.org/wikipedia/commons/4/42/YouTube_icon_%282013-2017%29.png" style="height:12px" /> Getting Started with BizAlign</a></p>
            <h3 style="color: #2a73cc;">🔑 Your Login Credentials</h3>
            <p><strong>Company ID:</strong> ${personnelData.companyId}<br>
               <strong>Username:</strong> ${newPersonnel.email}<br>
               <strong>Password:</strong> ${password}</p>
            <p><strong>One-Time Password (OTP):</strong> <span style="background-color: #ff9900; color: white; padding: 5px 10px; border-radius: 5px; font-weight: bold;">${OTP}</span></p>
            <p style="color: #555;">Thanks for your dedication, we’re excited to have you onboard!</p>
            <p style="font-weight: bold; color: #2a73cc;">Best regards,<br>Business Administrator<br>Raina Ltd</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Welcome email sent to ${newPersonnel.email}`);
    } catch (err) {
      console.error(`Failed to send welcome email to ${newPersonnel.email}:`, err);
    }

    res.status(201).json(savedPersonnel);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({
        message: "Email already exists. Please use a different email."
      });
    }
    console.error('Error creating Personnel user:', error);
    res.status(500).json({ message: 'Error creating Personnel user', error: error.message });
  }
}

const uploadVersion = async (req, res) => {
  const { Personnel } = getModels(req);
  const { personnelId, fieldName, approvedBy } = req.body;
  const file = req.files?.find((f) => f.fieldname === fieldName);

  if (!personnelId || !fieldName || !file) {
    return res.status(400).json({ message: 'Missing required data' });
  }

  const personnel = await Personnel.findById(personnelId);
  if (!personnel) {
    return res.status(404).json({ message: 'Personnel not found' });
  }

  const newVersion = createFileEntry(file);
  newVersion.approvedBy = parseJsonField({ approvedBy }, 'approvedBy') || '';

  if (!Array.isArray(personnel[fieldName])) {
    personnel[fieldName] = [];
  }
  personnel[fieldName].push(newVersion);

  await personnel.save();
  res.status(200).json({ message: 'New document version uploaded successfully', version: newVersion });
}

const uploadAdditionalVersion = async(req, res) => {
  const { Personnel } = getModels(req);
  const { personnelId, docLabel, fileGroupIndex } = req.body;
  const file = req.files?.[0];

  if (!personnelId || !docLabel || fileGroupIndex === undefined || !file) {
    return res.status(400).json({ message: 'Missing required data' });
  }

  const personnel = await Personnel.findById(personnelId);
  if (!personnel) {
    return res.status(404).json({ message: 'Personnel not found' });
  }

  const newVersion = createFileEntry(file);
  const docGroups = personnel.additionalDocs.get(docLabel) || [];
  const groupIndex = parseInt(fileGroupIndex);

  if (!Array.isArray(docGroups[groupIndex])) {
    docGroups[groupIndex] = [];
  }
  docGroups[groupIndex].push(newVersion);
  personnel.additionalDocs.set(docLabel, docGroups);

  await personnel.save();
  res.status(200).json({ message: 'Version uploaded successfully', version: newVersion });
}

const deleteVersion = async (req, res) => {
  const { Personnel } = getModels(req);
  const { personnelId, fieldName, versionIndex } = req.body;

  if (!personnelId || !fieldName || versionIndex === undefined) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const personnel = await Personnel.findById(personnelId);
  if (!personnel) {
    return res.status(404).json({ success: false, message: 'Personnel not found' });
  }

  const versions = personnel[fieldName];
  if (!Array.isArray(versions) || !versions[versionIndex]) {
    return res.status(400).json({ success: false, message: 'Invalid version index' });
  }

  versions.splice(versionIndex, 1);
  await personnel.save();
  res.json({ success: true, message: 'Version deleted successfully' });
}

const deleteAdditionalVersion = async (req, res) => {
  const { Personnel } = getModels(req);
  const { personnelId, docLabel, fileGroupIndex, versionIndex } = req.body;

  if (!personnelId || !docLabel || fileGroupIndex === undefined || versionIndex === undefined) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const personnel = await Personnel.findById(personnelId);
  if (!personnel) {
    return res.status(404).json({ success: false, message: 'Personnel not found' });
  }

  const docGroups = personnel.additionalDocs.get(docLabel) || [];
  if (!Array.isArray(docGroups[fileGroupIndex]) || !docGroups[fileGroupIndex][versionIndex]) {
    return res.status(400).json({ success: false, message: 'Invalid group/version index' });
  }

  docGroups[fileGroupIndex].splice(versionIndex, 1);
  if (docGroups[fileGroupIndex].length === 0) {
    docGroups.splice(fileGroupIndex, 1);
  }
  personnel.additionalDocs.set(docLabel, docGroups);

  await personnel.save();
  res.json({ success: true, message: 'Version deleted successfully' });
}

const newUpdate = async (req, res) => {
  const { Personnel, Notification, User, DayInvoice, WeeklyInvoice } = getModels(req);
  const round2 = (num) => +parseFloat(num || 0).toFixed(2);

  // Fetch the personnel
  const personnel = await Personnel.findById(req.params.id);
  if (!personnel) {
    return res.status(404).json({ message: 'Personnel not found' });
  }

  // Parse request body
  const personnelData = req.body;
  if (personnelData.addedBy)
    personnelData.addedBy = parseJsonField(personnelData, 'addedBy');
  if (personnelData.vatDetails)
    personnelData.vatDetails = parseJsonField(personnelData, 'vatDetails');
  if (personnelData.companyVatDetails)
    personnelData.companyVatDetails = parseJsonField(personnelData, 'companyVatDetails');
  if (personnelData.bankDetails) 
    personnelData.bankDetails = parseJsonField(personnelData, 'bankDetails');
  if (personnelData.passportDetails) 
    personnelData.passportDetails = parseJsonField(personnelData, 'passportDetails');
  if (personnelData.rightToWorkDetails) 
    personnelData.rightToWorkDetails = parseJsonField(personnelData, 'rightToWorkDetails');
  if (personnelData.ecsDetails) 
    personnelData.ecsDetails = parseJsonField(personnelData, 'ecsDetails');
  if (personnelData.drivingLicenseDetails) 
    personnelData.drivingLicenseDetails = parseJsonField(personnelData, 'drivingLicenseDetails');

  // Prepare update fields
  const updateFields = {
    firstName: personnelData.firstName,
    lastName: personnelData.lastName,
    address: personnelData.address,
    postcode: personnelData.postcode,
    nationalInsuranceNumber: personnelData.nationalInsuranceNumber,
    dateOfBirth: personnelData.dateOfBirth,
    nationality: personnelData.nationality,
    dateOfJoining: personnelData.dateOfJoining,
    utrNo: personnelData.utrNo,
    utrUpdatedOn: personnelData.utrUpdatedOn,
    vatDetails: personnelData.vatDetails,
    companyVatDetails: personnelData.companyVatDetails,
    email: personnelData.email,
    phone: personnelData.phone,
    activeStatus: personnelData.activeStatus,
    expiredReasons: personnelData.expiredReasons,
    addedBy: personnelData.addedBy,
    siteSelection: personnelData.siteSelection,
    dailyRate: personnelData.dailyRate,
    employmentStatus: personnelData.employmentStatus,
    companyName: personnelData.companyName,
    companyRegAddress: personnelData.companyRegAddress,
    companyRegNo: personnelData.companyRegNo,
    companyRegExpiry: personnelData.companyRegExpiry,
    companyUtrNo: personnelData.companyUtrNo,
    companyUtrUpdatedOn: personnelData.companyUtrUpdatedOn
  };

  // Handle file uploads
  if (req.files?.length > 0) {
    req.files.forEach((file) => {
      const isSmallEntry = ['profilePicture', 'signature'].includes(file.fieldname);
      const docEntry = createFileEntry(file, isSmallEntry);

      const standardFields = [
        'profilePicture', 'signature',
        'drivingLicenseFrontImage', 'drivingLicenseBackImage',
        'passportDocument', 'ecsCard', 'rightToWorkCard'
      ];

      if (standardFields.includes(file.fieldname)) {
        updateFields[file.fieldname] = updateFields[file.fieldname] || personnel[file.fieldname] || [];
        updateFields[file.fieldname].push(docEntry);
      } else if (file.fieldname.match(/^extraDoc(\d+)_file(\d+)$/)) {
        const [, docIndex] = file.fieldname.match(/^extraDoc(\d+)_file(\d+)$/);
        const docLabel = personnelData[`extraDoc${docIndex}_name`];

        if (docLabel) {
          updateFields.additionalDocs = updateFields.additionalDocs || new Map(Object.entries(personnel.additionalDocs || {}));
          const currentGroups = updateFields.additionalDocs.get(docLabel) || [];
          currentGroups.push([docEntry]);
          updateFields.additionalDocs.set(docLabel, currentGroups);
        }
      }
    });

    if (updateFields.additionalDocs) {
      updateFields.additionalDocs = Object.fromEntries(updateFields.additionalDocs);
    }
  }

  // Store original details for comparison
  const originalVatDetails = { ...(personnel.vatDetails ?? {}) };

  // Check if relevant fields have changed
  const vatChanged =
    (originalVatDetails?.vatNo !== personnelData.vatDetails?.vatNo ||
      originalVatDetails?.vatEffectiveDate !== personnelData.vatDetails?.vatEffectiveDate);

  // If no relevant changes, proceed with update
  if (!vatChanged) {
    const updatedPersonnel = await Personnel.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );

    // Update associated user if basic details changed
    if (
      personnel.email !== updatedPersonnel.email ||
      personnel.firstName !== updatedPersonnel.firstName ||
      personnel.lastName !== updatedPersonnel.lastName
    ) {
      await User.findOneAndUpdate(
        { user_ID: updatedPersonnel.user_ID },
        {
          firstName: updatedPersonnel.firstName,
          lastName: updatedPersonnel.lastName,
          email: updatedPersonnel.email,
        }
      );
    }

    const sitesAreEqual =
        Array.isArray(personnel.siteSelection) &&
        Array.isArray(updatedPersonnel.siteSelection) &&
        personnel.siteSelection.length === updatedPersonnel.siteSelection.length &&
        personnel.siteSelection.every((val, index) => val === updatedPersonnel.siteSelection[index]);

    // Send notification if siteSelection changed
    if (!sitesAreEqual) {
      const notification = {
        personnel: updatedPersonnel._id,
        site: [personnel.siteSelection, updatedPersonnel.siteSelection],
        changed: 'personnels',
        message: `Personnel ${updatedPersonnel.firstName} ${updatedPersonnel.lastName} was changed from site ${personnel.siteSelection} to ${updatedPersonnel.siteSelection}`,
      };
      await new Notification({ notification, targetDevice: 'website' }).save();
    }

    sendToClients(req.db, { type: 'personnelUpdated', personnelId: updatedPersonnel._id });
    return res.json(updatedPersonnel);
  }

  // Validation phase: Check for negative invoice totals
  console.time('Validate Invoices');

  // Determine date range for affected invoices
  const vatDates = vatChanged ? [
    originalVatDetails?.vatEffectiveDate ? new Date(originalVatDetails.vatEffectiveDate) : null,
    personnelData.vatDetails?.vatEffectiveDate ? new Date(personnelData.vatDetails.vatEffectiveDate) : null,
  ].filter(Boolean) : [];

  const allDates = [...vatDates];
  let dateFilter = {};
  if (allDates.length > 0) {
    const minDate = new Date(Math.min(...allDates.map(d => new Date(d))));
    const oneDayBeforeMin = new Date(minDate);
    oneDayBeforeMin.setDate(minDate.getDate() - 1);
    dateFilter = { date: { $gte: oneDayBeforeMin } };
  }

  // Fetch affected DayInvoices
  const affectedDayInvoices = await DayInvoice.find({
    personnelId: req.params.id,
    ...dateFilter,
  }).lean();

  const negativeInvoices = [];
  const updatedDayInvoiceTotals = new Map();
  const affectedInvoiceIds = new Set(affectedDayInvoices.map(inv => inv._id.toString()));

  // Create a temporary personnel object with updated fields for validation
  const tempPersonnel = {
    ...personnel.toObject(),
    ...updateFields,
  };

  //
  //  DISCUSS WITH SANJAY
  //  NEED TO CHECK VAT CHANGE CALCULATION HERE
  //  HOW IS IT FIGURING OUT THE REMOVAL / ADDITION OF VAT
  //

  // Process DayInvoices to check for negative totals
  for (const invoice of affectedDayInvoices) {
    const invoiceId = invoice._id.toString();
    const invDate = new Date(invoice.date);
    let newTotal = invoice.total;

    if(personnelData?.vatDetails?.vatNo && personnelData?.vatDetails?.vatEffectiveDate <= invDate)
      newTotal = 1.2 * newTotal;

    if (newTotal < 0) {
      negativeInvoices.push({
        personnelName: `${personnel.firstName} ${personnel.lastName}`,
        date: invoice.date,
        serviceWeek: invoice.serviceWeek,
        type: 'DayInvoice',
      });
    } else {
      updatedDayInvoiceTotals.set(invoiceId, {
        total: newTotal,
        personnelId: invoice.personnelId?.toString(),
        serviceWeek: invoice.serviceWeek,
        date: invoice.date,
      });
    }
  }

  if (negativeInvoices.length > 0) {
    console.warn('Update rejected due to negative DayInvoice totals:', negativeInvoices);
    console.timeEnd('Validate Invoices');
    return res.status(400).json({
      message: 'Update would cause negative totals for the following DayInvoices',
      negativeInvoices,
      type: 'DayInvoice',
    });
  }

  // Validate WeeklyInvoices using all invoices in weeklyInvoice.invoices
  const affectedServiceWeeks = [...new Set(affectedDayInvoices.map(inv => inv.serviceWeek))];
  const weeklyInvoices = await WeeklyInvoice.find({
    personnelId: req.params.id,
    serviceWeek: { $in: affectedServiceWeeks },
  }).populate('personnelId').populate('installments').lean();

  const isVatApplicable = (date, personnelData) => {
    return (
      (personnelData.vatDetails?.vatNo && date >= new Date(personnelData.vatDetails.vatEffectiveDate))
    );
  };

  for (const weeklyInvoice of weeklyInvoices) {
    const week = weeklyInvoice.serviceWeek;
    let weeklyBaseTotal = 0;
    let weeklyVatTotal = 0;

    // Fetch all DayInvoices listed in weeklyInvoice.invoices
    const allInvoiceIds = weeklyInvoice.invoices.map(id => id.toString());
    const allInvoices = await DayInvoice.find({
      _id: { $in: allInvoiceIds },
      personnelId: req.params.id,
      serviceWeek: week,
    }).lean();

    for (const invoice of allInvoices) {
      const invoiceId = invoice._id.toString();
      let invBaseTotal;

      if (affectedInvoiceIds.has(invoiceId)) {
        // Use recalculated total for affected invoices
        const updatedInvoice = updatedDayInvoiceTotals.get(invoiceId);
        invBaseTotal = updatedInvoice ? round2(updatedInvoice.total) : round2(invoice.total);
      } else {
        // Use existing total for unaffected invoices
        invBaseTotal = round2(invoice.total);
      }

      weeklyBaseTotal += invBaseTotal;
      if (isVatApplicable(new Date(invoice.date), tempPersonnel)) {
        weeklyVatTotal += round2(invBaseTotal * 0.2);
      }
    }

    // Use existing additionalChargesDetail from WeeklyInvoice
    let additionalChargesTotal = 0;
    for (const charge of weeklyInvoice.additionalChargesDetail || []) {
      let rateAdjustment = round2(charge.rate);
      if (charge.type === 'deduction') {
        rateAdjustment = -rateAdjustment;
      }
      additionalChargesTotal += rateAdjustment;
      if (isVatApplicable(new Date(charge.week), tempPersonnel)) {
        weeklyVatTotal += round2(rateAdjustment * 0.2);
      }
    }

    weeklyBaseTotal = round2(weeklyBaseTotal + additionalChargesTotal);
    weeklyVatTotal = round2(weeklyVatTotal);
    const weeklyTotalBeforeInstallments = round2(weeklyBaseTotal + weeklyVatTotal);

    if (weeklyTotalBeforeInstallments < 0) {
      negativeInvoices.push({
        personnelName: `${personnel.firstName} ${personnel.lastName}`,
        serviceWeek: week,
        type: 'WeeklyInvoice',
      });
    }
  }

  if (negativeInvoices.length > 0) {
    console.warn('Update rejected due to negative invoice totals:', negativeInvoices);
    console.timeEnd('Validate Invoices');
    return res.status(400).json({
      message: 'Update would cause negative totals for the following invoices',
      negativeInvoices,
      type: 'WeeklyInvoice',
    });
  }

  console.timeEnd('Validate Invoices');

  // Proceed with personnel update
  const updatedPersonnel = await Personnel.findByIdAndUpdate(
    req.params.id,
    { $set: updateFields },
    { new: true }
  );

  // Update affected invoices
  const invoicesByWeek = affectedDayInvoices.reduce((acc, invoice) => {
    const week = invoice.serviceWeek;
    if (!acc[week]) acc[week] = [];
    acc[week].push(invoice);
    return acc;
  }, {});

  for (const [serviceWeek, invoices] of Object.entries(invoicesByWeek)) {
    let weeklyBaseTotal = 0;
    let weeklyVatTotal = 0;

    const updateForMain = [];
    const updateForAdditional = [];

    for (const invoice of invoices) {
      const invoiceId = invoice._id.toString();
      const invDate = new Date(invoice.date);
      const newVehicleType = getPersonnelTypeForDate(updatedPersonnel, invDate);

      const mainRateCard = await rateCardFinder(RateCard, invDate, serviceWeek, invoice.mainService, updatedPersonnel);
      console.log('checkpoint for main:', mainRateCard)
      if (!mainRateCard && invoice.mainService !== 'Route Support') continue;

      const oldIncentiveRate = round2(invoice.incentiveDetailforMain?.reduce((sum, inc) => sum + Number(inc.rate || 0), 0) || 0);
      const oldDeductionTotal = invoice.deductionDetail?.reduce((sum, ded) => sum + round2(ded.rate), 0) || 0;
      const newIncentiveRate = oldIncentiveRate;
      const newDeductionTotal = oldDeductionTotal;

      const newTotal = round2(
        invoice.total
        - round2(invoice.serviceRateforMain || 0)
        - round2(invoice.byodRate || 0)
        - round2(invoice.calculatedMileage || 0)
        - oldIncentiveRate
        + oldDeductionTotal
        + round2(mainRateCard?.serviceRate || 0)
        + round2(mainRateCard?.byodRate || 0)
        + round2(invoice?.miles * (mainRateCard?.mileage || 0))
        + newIncentiveRate
        - newDeductionTotal
      );

      updateForMain.push({
        updateOne: {
          filter: { _id: invoice._id },
          update: {
            $set: {
              personnelVehicleType: newVehicleType,
              serviceRateforMain: round2(mainRateCard?.serviceRate || 0),
              rateCardIdforMain: mainRateCard?._id ? new mongoose.Types.ObjectId(mainRateCard._id) : null,
              byodRate: round2(mainRateCard?.byodRate || 0),
              mileage: round2(mainRateCard?.mileage || 0),
              calculatedMileage: round2(invoice.miles * (mainRateCard?.mileage || 0)),
              total: newTotal,
            },
          },
        },
      });

      let additionalRateCard = null;
      if (invoice.additionalServiceDetails?.service) {

        additionalRateCard = await rateCardFinder(RateCard, invDate, serviceWeek, invoice.additionalServiceDetails.service, updatedPersonnel);
        if (additionalRateCard) {
          const oldAdditionalIncentiveRate = round2(invoice.incentiveDetailforAdditional?.reduce((sum, inc) => sum + Number(inc.rate || 0), 0) || 0);

          const newAdditionalTotal = round2(
            newTotal
            - round2(invoice.additionalServiceDetails.serviceRate || 0)
            - round2(invoice.additionalServiceDetails.byodRate || 0)
            - round2(invoice.additionalServiceDetails.calculatedMileage || 0)
            - oldAdditionalIncentiveRate
            + round2(additionalRateCard?.serviceRate || 0)
            + round2(additionalRateCard?.byodRate || 0)
            + round2(invoice.additionalServiceDetails.miles * (additionalRateCard?.mileage || 0))
            + round2(invoice.incentiveDetailforAdditional?.reduce((sum, inc) => sum + Number(inc.rate || 0), 0) || 0)
          );

          updateForAdditional.push({
            updateOne: {
              filter: { _id: invoice._id },
              update: {
                $set: {
                  'additionalServiceDetails.serviceRate': round2(additionalRateCard?.serviceRate || 0),
                  'additionalServiceDetails.byodRate': round2(additionalRateCard?.byodRate || 0),
                  'additionalServiceDetails.mileage': round2(additionalRateCard?.mileage || 0),
                  'additionalServiceDetails.calculatedMileage': round2(invoice.additionalServiceDetails.miles * (additionalRateCard?.mileage || 0)),
                  rateCardIdforAdditional: additionalRateCard?._id ? new mongoose.Types.ObjectId(additionalRateCard._id) : null,
                  serviceRateforAdditional: invoice.additionalServiceApproval === 'Approved' ? round2(
                    (additionalRateCard?.serviceRate || 0) +
                    (additionalRateCard?.byodRate || 0) +
                    (invoice.additionalServiceDetails.miles * (additionalRateCard?.mileage || 0)) +
                    round2(invoice.incentiveDetailforAdditional?.reduce((sum, inc) => sum + Number(inc.rate || 0), 0) || 0)
                  ) : 0,
                  total: invoice.additionalServiceApproval === 'Approved' ? newAdditionalTotal : newTotal,
                },
              },
            },
          });

          // Update total for weekly calculation to include additional service
          invBaseTotal = round2(
            (mainRateCard?.serviceRate || 0) +
            (mainRateCard?.byodRate || 0) +
            (invoice.miles * (mainRateCard?.mileage || 0)) +
            newIncentiveRate -
            newDeductionTotal +
            (additionalRateCard?.serviceRate || 0) +
            (additionalRateCard?.byodRate || 0) +
            (invoice.additionalServiceDetails.miles * (additionalRateCard?.mileage || 0)) +
            round2(invoice.incentiveDetailforAdditional?.reduce((sum, inc) => sum + Number(inc.rate || 0), 0) || 0)
          );
        } else {
          invBaseTotal = round2(newTotal);
        }
      } else {
        invBaseTotal = round2(newTotal);
      }

      weeklyBaseTotal += invBaseTotal;
      if (isVatApplicable(invDate, updatedPersonnel)) {
        weeklyVatTotal += round2(invBaseTotal * 0.2);
      }
    }

    if (updateForMain.length > 0) {
      await DayInvoice.bulkWrite(updateForMain);
    }
    if (updateForAdditional.length > 0) {
      await DayInvoice.bulkWrite(updateForAdditional);
    }

    // Fetch WeeklyInvoice to get additionalChargesDetail
    const weeklyInvoice = await WeeklyInvoice.findOne({ personnelId: req.params.id, serviceWeek }).lean();
    if (!weeklyInvoice) continue;

    // Recalculate WeeklyInvoice totals using all invoices
    weeklyBaseTotal = 0;
    weeklyVatTotal = 0;

    const allInvoices = await DayInvoice.find({
      _id: { $in: weeklyInvoice.invoices },
      personnelId: req.params.id,
      serviceWeek,
    }).lean();

    for (const invoice of allInvoices) {
      const invoiceId = invoice._id.toString();
      let invBaseTotal;

      if (affectedInvoiceIds.has(invoiceId)) {
        // Use recalculated total for affected invoices
        const updatedInvoice = updatedDayInvoiceTotals.get(invoiceId);
        invBaseTotal = updatedInvoice ? round2(updatedInvoice.total) : round2(invoice.total);
      } else {
        // Use existing total for unaffected invoices
        invBaseTotal = round2(invoice.total);
      }

      weeklyBaseTotal += invBaseTotal;
      if (isVatApplicable(new Date(invoice.date), updatedPersonnel)) {
        weeklyVatTotal += round2(invBaseTotal * 0.2);
      }
    }

    // Use existing additionalChargesDetail from WeeklyInvoice
    let additionalChargesTotal = 0;
    for (const charge of weeklyInvoice.additionalChargesDetail || []) {
      let rateAdjustment = round2(charge.rate);
      if (charge.type === 'deduction') {
        rateAdjustment = -rateAdjustment;
      }
      additionalChargesTotal += rateAdjustment;
      if (isVatApplicable(new Date(charge.week), updatedPersonnel)) {
        weeklyVatTotal += round2(rateAdjustment * 0.2);
      }
    }

    weeklyBaseTotal = round2(weeklyBaseTotal + additionalChargesTotal);
    weeklyVatTotal = round2(weeklyVatTotal);
    const weeklyTotalBeforeInstallments = round2(weeklyBaseTotal + weeklyVatTotal);

    // Restore previous installment deductions
    const allInstallments = await Installment.find({ personnelId: req.params.id });
    for (const detail of weeklyInvoice.installmentDetail || []) {
      const inst = allInstallments.find((i) => i._id.toString() === detail._id?.toString());
      if (inst && detail.deductionAmount > 0) {
        inst.installmentPending = round2(inst.installmentPending + detail.deductionAmount);
        await inst.save();
      }
    }

    // Calculate new installment deductions
    const installmentMap = new Map();
    let remainingTotal = weeklyTotalBeforeInstallments;

    for (const inst of allInstallments) {
      const instId = inst._id.toString();
      if (inst.installmentPending <= 0) continue;

      const deduction = Math.min(
        round2(inst.spreadRate),
        round2(inst.installmentPending),
        remainingTotal
      );
      if (deduction <= 0) continue;

      inst.installmentPending = round2(inst.installmentPending - deduction);
      await inst.save();

      installmentMap.set(instId, {
        _id: inst._id,
        installmentRate: round2(inst.installmentRate),
        installmentType: inst.installmentType,
        installmentDocument: inst.installmentDocument,
        installmentPending: round2(inst.installmentPending),
        deductionAmount: round2(deduction),
        signed: inst.signed,
      });

      remainingTotal = round2(remainingTotal - deduction);
    }

    const mergedInstallments = Array.from(installmentMap.values());
    const totalInstallmentDeduction = round2(
      mergedInstallments.reduce((sum, inst) => sum + (inst.deductionAmount || 0), 0)
    );

    const finalWeeklyTotal = round2(Math.max(0, weeklyTotalBeforeInstallments - totalInstallmentDeduction));

    // Update WeeklyInvoice
    await WeeklyInvoice.updateOne(
      { personnelId: req.params.id, serviceWeek },
      {
        $set: {
          vatTotal: weeklyVatTotal,
          total: finalWeeklyTotal,
          installmentDetail: mergedInstallments,
          installments: mergedInstallments.map((inst) => inst._id),
        },
      }
    );
  }

  // Update associated user if basic details changed
  if (
    personnel.email !== updatedPersonnel.email ||
    personnel.firstName !== updatedPersonnel.firstName ||
    personnel.lastName !== updatedPersonnel.lastName
  ) {
    await User.findOneAndUpdate(
      { user_ID: updatedPersonnel.user_ID },
      {
        firstName: updatedPersonnel.firstName,
        lastName: updatedPersonnel.lastName,
        email: updatedPersonnel.email,
      }
    );
  }

  const sitesAreEqual =
        Array.isArray(personnel.siteSelection) &&
        Array.isArray(updatedPersonnel.siteSelection) &&
        personnel.siteSelection.length === updatedPersonnel.siteSelection.length &&
        personnel.siteSelection.every((val, index) => val === updatedPersonnel.siteSelection[index]);

  // Send notification if siteSelection changed
  if (!sitesAreEqual) {
    const notification = {
      personnel: updatedPersonnel._id,
      site: [personnel.siteSelection, updatedPersonnel.siteSelection],
      changed: 'personnels',
      message: `Personnel ${updatedPersonnel.firstName} ${updatedPersonnel.lastName} was changed from site ${personnel.siteSelection} to ${updatedPersonnel.siteSelection}`,
    };
    await new Notification({ notification, targetDevice: 'website' }).save();
  }

  sendToClients(req.db, { type: 'personnelUpdated', personnelId: updatedPersonnel._id });
  res.json(updatedPersonnel);
}

const docUpdate = async (req, res) => {
  const { Personnel } = getModels(req);
  const updatedPersonnel = await Personnel.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!updatedPersonnel) {
    return res.status(404).json({ message: 'Personnel not found' });
  }
  res.json(updatedPersonnel);
}

const deletePersonnel = async (req, res) => {
  const { Personnel, Notification, User } = getModels(req);
  const personnel = await Personnel.findById(req.params.id);
  if (!personnel) {
    return res.status(404).json({ message: 'Personnel not found' });
  }

  await User.deleteOne({ user_ID: personnel.user_ID });
  const notification = {
    personnel: personnel._id,
    site: personnel.siteSelection,
    changed: 'personnels',
    message: `Personnel ${personnel.firstName} ${personnel.lastName} was deleted`,
  };
  await new Notification({ notification, targetDevice: 'website' }).save();

  await Personnel.findByIdAndDelete(req.params.id);
  res.json({ message: 'Personnel deleted' });
}

const togglePersonnel = async (req, res) => {
  const { email, disabled } = req.body;
  const { Personnel, Notification } = getModels(req);

  // Update only the disabled field
  const personnel = await Personnel.findByIdAndUpdate(
    req.params.id,
    { $set: { disabled } },
    { new: true, runValidators: false } // runValidators: false skips schema validation
  );

  if (!personnel) {
    return res.status(404).json({ message: 'Personnel not found' });
  }

  const statusText = disabled ? 'disabled' : 'enabled';

  // Save notification
  const notification = {
    personnel: personnel._id,
    site: personnel.siteSelection,
    changed: 'personnels',
    message: `Personnel ${personnel.firstName} ${personnel.lastName} was ${statusText}`,
  };
  await new Notification({ notification, targetDevice: 'website' }).save();

  // Respond immediately
  res.status(200).json({
    message: `Personnel ${statusText}${disabled ? ' and email will be sent shortly' : ''} successfully`,
    disabledPersonnel: personnel
  });

  // Send email in background if disabled
  if (disabled) {
    (async () => {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.MAILER_EMAIL,
            pass: process.env.MAILER_APP_PASSWORD,
          },
        });

        const mailOptions = {
          from: process.env.MAILER_EMAIL,
          to: email,
          cc: 'fleet@rainaltd.com',
          subject: 'Vehicle Return - Off Hire',
          html: `
          <div>
          <p>Dear Independent Contractor,</p>
    
          <p>Please accept this communication to inform you that the vehicle hired yourself has been returned to us. To complete the Off-Hire process, our Fleet Team will now carry out a thorough inspection of the vehicle.
          If any new damages or issues are identified during the inspection, you will receive a detailed email containing:
    
          <ul>
          <li>On-Hire photographs</li>
          <li>Off-Hire photographs</li>
          <li>Supporting photographs of any damages (if applicable)</li>
          <li>An estimate or invoice for any necessary repairs</li>
          <li>If no further issues are found, no additional communication will be required.</li>
    
          <p>
          Regarding Final Payment:
          If applicable, your final payment will be processed once the off-hire inspection is complete within 30 days and all matters (including potential damage costs) are settled. If you do not receive payment, and no response has been provided within 30 days, please contact us at admin@rainaltd.com.</p>
          
          <p>Thank you for your cooperation. Should you have any questions or require further assistance, please email admin@rainaltd.com</p>
    
          <p>
          Best regards,</br>
          Raina Ltd</br>
          </p>
          </div>
        `,
        };

        await transporter.sendMail(mailOptions);
      } catch (err) {
        console.error(`Failed to send email to ${email}:`, err);
      }
    })();
  }
}

module.exports = { fetchAllPersonnels, fetchPersonnelbyId, fetchNiNumber, fetchPersonnelCount, fetchNotificationDetails, fetchPersonnelsBySite, addPersonnel, uploadVersion, uploadAdditionalVersion, deleteVersion, deleteAdditionalVersion, newUpdate, docUpdate, deletePersonnel, togglePersonnel }