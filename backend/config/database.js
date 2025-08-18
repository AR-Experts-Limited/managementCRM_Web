const mongoose = require("mongoose");

const connections = {}; // Store connections

const dbUser = process.env.MONGODB_USER;
const dbPassword = encodeURIComponent(process.env.MONGODB_PASSWORD);
const dbCluster = process.env.MONGODB_CLUSTER;

const getDatabaseConnection = async (dbName) => {
  try {
    if (!connections[dbName]) {
      const conn = mongoose.createConnection(
        `mongodb+srv://${dbUser}:${dbPassword}@${dbCluster}/${dbName}?retryWrites=true&w=majority&appName=${dbName}`,
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        }
      );

      await conn.asPromise();

      if (dbName !== "ClientMapDB") {
        conn.on("connected", () => {
          // initializeChangeStreams(conn);
        });
      }

      connections[dbName] = conn;
    }
    return connections[dbName];
  } catch (error) {
    console.error("Error connecting to MongoDB", error);
    throw error;
  }
};

module.exports = { getDatabaseConnection };
