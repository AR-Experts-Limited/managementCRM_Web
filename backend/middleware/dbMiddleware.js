const { getDatabaseConnection } = require("../config/database");

module.exports = async (req, res, next) => {
    console.log("Inside DBMiddleware");
    try {
        const origin = req.headers['origin'];
        let subdomain = "";
        let dbName = "managementCRM"; // Default DB

        if (origin) {
            const originUrl = new URL(origin);
            const hostParts = originUrl.hostname.split(".");

            if (originUrl.hostname === "localhost") {
                dbName = "managementCRM"; // Explicitly set for localhost
            } else if (hostParts.length > 2) {
                subdomain = hostParts[0];
                if (!isNaN(subdomain)) {
                    dbName = "managementCRM"
                }
                else {
                    dbName = `crm_${subdomain}`;
                }
            }
        }

        console.log("Extracted dbName from Origin:", dbName);

        req.db = await getDatabaseConnection(dbName); // Attach DB connection to request

        console.log("Req = ", dbName);

        next();
    } catch (error) {
        console.error("Database connection error:", error);
        res.status(500).json({ error: "Database connection failed" });
    }
};