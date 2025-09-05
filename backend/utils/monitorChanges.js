// utils/monitorChanges.js
const mongoose = require('mongoose');
const { sendToClients } = require('./sseService');
const moment = require('moment')

// Import schemas
const DayInvoiceSchema = require('../models/DayInvoice').schema;
const AppDataSchema = require('../models/AppData').schema;
const NotificationSchema = require('../models/Notification').schema;
const PersonnelSchema = require('../models/Personnel').schema;
const WeeklyInvoiceSchema = require('../models/WeeklyInvoice').schema;

const activeStreams = new Map();

async function initializeChangeStreams(connection) {
  if (!connection || activeStreams.has(connection.name)) return;

  const streams = {
    appData: null,
    notifications: null,
    personnel: null,
    weeklyInvoice: null,
  };

  try {
    // Ensure collections exist
    const collections = await connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    if (!collectionNames.includes('appdatas')) {
      await connection.createCollection('appdatas');
    }
    if (!collectionNames.includes('notifications')) {
      await connection.createCollection('notifications');
    }
    if (!collectionNames.includes('personnels')) {
      await connection.createCollection('personnels');
    }
    if (!collectionNames.includes('weeklyinvoices')) {
      await connection.createCollection('weeklyinvoices');
    }

    // AppData Change Stream
    streams.appData = connection.collection('appdatas').watch([], { fullDocument: 'updateLookup' });
    streams.appData.on('change', (change) =>
      handleAppDataChange(change, connection));

    // Notifications Change Stream
    streams.notifications = connection.collection('notifications').watch([], { fullDocument: 'updateLookup' });
    streams.notifications.on('change', (change) =>
      handleNotificationChange(change, connection));

    // Store streams and connection
    activeStreams.set(connection.name, {
      connection,
      streams,
      models: {
        DayInvoice: connection.model('DayInvoice', DayInvoiceSchema),
        Notification: connection.model('Notification', NotificationSchema),
        AppData: connection.model('AppData', AppDataSchema),
        Personnel: connection.model('Personnel', PersonnelSchema),
        WeeklyInvoice: connection.model('WeeklyInvoice', WeeklyInvoiceSchema)
      }
    });

    // Cleanup on connection close
    connection.on('close', () => {
      cleanupConnection(connection.name);
    });

  } catch (error) {
    console.error(`[${connection.name}] Error initializing change streams:`, error);
  }
}

function cleanupConnection(dbName) {
  if (activeStreams.has(dbName)) {
    const { streams } = activeStreams.get(dbName);
    Object.values(streams).forEach(stream => stream.close());
    activeStreams.delete(dbName);
    console.log(`Cleaned up streams for ${dbName}`);
  }
}


// AppData Change Handler
async function handleAppDataChange(change, connection) {
  const { DayInvoice, AppData, Personnel, WeeklyInvoice } = activeStreams.get(connection.name).models;

  try {
    console.log('appData changed')

    if (change.operationType === 'update') {
      const updatedFields = change.updateDescription.updatedFields;

      if (updatedFields.trip_status !== undefined && updatedFields.trip_status === 'completed') {
        const personnelId = change.fullDocument.personnel_id.toString();

        const personnelDetails = await Personnel.findOne({ _id: personnelId });


        // Create and save new DayInvoice
        const newInvoice = new DayInvoice({
          personnelId: personnelDetails._id,
          user_ID: personnelDetails.user_ID,
          role: personnelDetails.role,
          date: change.fullDocument.date,
          week: moment(change.fullDocument.date).format('GGGG-[W]WW'),
          total: personnelDetails.dailyRate,
        });

        await newInvoice.save();

        // Add newInvoice to WeeklyInvoice
        const weeklyInvoice = await WeeklyInvoice.findOneAndUpdate(
          { personnelId: personnelDetails._id, week: moment(change.fullDocument.date).format('GGGG-[W]WW') },
          {
            $addToSet: { invoices: newInvoice._id },
            $set: {
              personnelId,
              user_ID: personnelDetails.user_ID,
              personnelEmail: personnelDetails.email,
              personnelName: personnelDetails.firstName + ' ' + personnelDetails.lastName,
              role: personnelDetails.role,
            },
          },
          { upsert: true, new: true }
        );
      }
    }
  } catch (error) {
    console.error(`[${connection.name}] Installment handler error:`, error);
  }
}


// Notification Change Handler
async function handleNotificationChange(change, connection) {
  try {
    console.log(`[${connection.name}] Notification change:`, change.operationType);

    if (change.operationType === 'insert' || change.operationType === 'delete') {
      sendToClients(connection, {
        type: 'notificationUpdated',
      });
    }
  } catch (error) {
    console.error(`[${connection.name}] Notification handler error:`, error);
  }
}

module.exports = {
  initializeChangeStreams,
  cleanupConnection,
  handleAppDataChange,
  handleNotificationChange
};