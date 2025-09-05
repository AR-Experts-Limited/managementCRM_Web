
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require("path");
const { registerClient } = require('./utils/sseService');


const dbMiddleware = require("./middleware/dbMiddleware");

const { protectApp } = require('./middleware/applicationAuthMiddleware'); // Middleware for app routes

const app = express();
app.use(dbMiddleware);
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));



// Routes
const authRoutes = require('./routes/auth');
const personnelRoutes = require('./routes/personnels');
const dayInvoiceRoutes = require('./routes/dayinvoice');
const weeklyInvoiceRoutes = require('./routes/weeklyInvoice');
const auditLogRoutes = require('./routes/auditlog');
const deductionRoutes = require('./routes/deductions');
const incentiveRoutes = require('./routes/incentives');
const additionalChargeRoutes = require('./routes/additionalCharges');
const IdCounterRoutes = require('./routes/IdCounter');
const liveOpsRoutes = require('./routes/liveOps');
const spendingInsightsRoutes = require('./routes/spendingInsights');

//App Route 
const applicationAuthRoutes = require('./routes/applicationAuthRoutes');
const applicationLocationRoutes = require('./routes/applicationLocationRoutes');//App
const applicationDataRoutes = require('./routes/applicationData');//App
const appVersionRoutes = require('./routes/applicationVersion');
const applicationProfileRoutes = require('./routes/applicationProfileRoutes');
const applicationInboxRoutes = require('./routes/applicationInboxRoutes');
const applicationDeductionsRoutes = require('./routes/applicationDeductions');
const applicationNotificationsRoutes = require('./routes/applicationNotifications'); 
const applicationRestrictionsRoutes = require('./routes/applicationRestrictionsRoutes');
const applicationStatsRoutes = require('./routes/applicationStatsRoutes');





// Routes Usage
app.use('/api/auth', authRoutes);
app.use('/api/personnels', personnelRoutes);
app.use('/api/dayinvoice', dayInvoiceRoutes);
app.use('/api/weeklyinvoice', weeklyInvoiceRoutes);
app.use('/api/auditlog', auditLogRoutes);
app.use('/api/deduction', deductionRoutes);
app.use('/api/incentive', incentiveRoutes);
app.use('/api/additional-charge', additionalChargeRoutes);
app.use('/api/idcounter', IdCounterRoutes);
app.use('/api/live-ops', liveOpsRoutes);
app.use('/api/spending-insights', spendingInsightsRoutes);


//app Auth route
app.use('/api/applicationAuth', applicationAuthRoutes);
//App Routes
app.use('/api/location', protectApp, applicationLocationRoutes);
app.use('/api/applicationData', protectApp, applicationDataRoutes);//App
app.use('/api', protectApp, appVersionRoutes);//App
app.use('/api/app-profile', protectApp, applicationProfileRoutes);
app.use('/api/app-inbox', protectApp, applicationInboxRoutes);
app.use('/api/app-deductions', protectApp, applicationDeductionsRoutes);
app.use('/api/app-notifications', applicationNotificationsRoutes); 
app.use('/api/app-restrictions', protectApp, applicationRestrictionsRoutes);
app.use('/api/app-stats', protectApp, applicationStatsRoutes);





const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('./routes/aws');

const getFormattedDateTime = () => {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, '0'); // e.g., 30
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[now.getMonth()]; // e.g., Dec
  const year = now.getFullYear(); // e.g., 2024

  const hours = String(now.getHours()).padStart(2, '0'); // e.g., 15
  const minutes = String(now.getMinutes()).padStart(2, '0'); // e.g., 45
  const seconds = String(now.getSeconds()).padStart(2, '0'); // e.g., 12

  return `${day}${month}${year}_${hours}${minutes}${seconds}`;
};

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
      cb(null, `${user_ID}/${file.fieldname}/${getFormattedDateTime()}/${file.originalname}`);
    },
  }),
});

app.get('/api/stream', (req, res) => {
  registerClient(req, res);  // Register this client to listen for events
});

app.use('/uploads', express.static('uploads'));
app.use(express.static(path.join(__dirname, "public")));

app.use(express.static(path.join(__dirname, "../frontend/build")));

//app.get("*", (req, res) => {
//  res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
//});

// After all API routes and static middleware:
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
});

const port = process.env.PORT || 5700;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});