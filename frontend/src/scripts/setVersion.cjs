const fs = require('fs');
const path = require('path');
const pkg = require('../../package.json');

// Use package version + build timestamp
const buildVersion = `${pkg.version}-${Date.now()}`;

const versionData = { version: buildVersion };

// Path to shared version.json
const sharedVersionPath = path.join(__dirname, '../../../shared/version.json');

fs.writeFileSync(sharedVersionPath, JSON.stringify(versionData, null, 2));
console.log(`✅ Generated version.json: ${buildVersion}`);
