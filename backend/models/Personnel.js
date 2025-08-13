const mongoose = require('mongoose');

const PersonnelSchema = new mongoose.Schema({
    firstName: { type : String },
    lastName: {type : String},
    address: {type : String},
    user_ID: { type: String, required: true },
    postcode: { type: String, required: true, match: /^[A-Z0-9 ]{3,10}$/i },
    role: {type: String },
    niDetails: { 
        nationalInsuranceNumber: {type: String, required: true},
        doc: {type: String, required: true}
    },
    dateOfBirth: { type: Date, required: true },
    nationality: { type: String, required: true },
    dateOfJoining: { type: Date, required: false },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    addedBy: { type: Object },
    siteSelection: { type: Array },
    utrNo: { type: String, required: false },
    utrUpdatedOn: { type: Date, required: false },
    activeStatus: { type: String, required: true, default: "Active" },
    vatDetails: {
        vatNo: { type: String, required: true },
        vatEffectiveDate: { type: Date, required: true }
    },
    bankDetails: {
        bankName: { type: String, required: true },
        sortCode: { type: String, required: true },
        accNo: { type: String, required: true },
        accName: { type: String, required: true },
        bankType: { type: String, required: true }
    },
    passportDetails: {
        issuedFrom: { type: String },
        passportNumber: { type: String },
        passportValidity: { type: Date },
        passportExpiry: { type: Date },
    },
    rightToWorkDetails: {
        rightToWorkValidity: { type: Date },
        rightToWorkExpiry: { type: Date },
    },
    profilePic: { type: String },
    drivingLicenseDetails: {
        dlNumber: { type: String, maxlength: 20 },  // Optional length validation
        dlValidity: { type: Date },
        dlExpiry: { type: Date }, 
        dlIssue: { type: Date },
    },
    ecsDetails: {
        ecsIssue: { type: Date },
        ecsExpiry: { type: Date },
        active: { type: Boolean }
    },
    expiredReasons: { type: Array },
    dailyRate: { type: Number },
    // File Uploads
    signature: { type: String },
    profilePicture: [
        {
            original: { type: String },
            timestamp: { type: Date }
        }
    ],
    drivingLicenseFrontImage: [
        {
            original: { type: String },
            temp: { type: String },
            docApproval: { type: Boolean, default: false },
            timestamp: { type: Date },
            approvedBy: { type: Object }
        }
    ],
    drivingLicenseBackImage: [
        {
            original: { type: String },
            temp: { type: String },
            docApproval: { type: Boolean, default: false },
            timestamp: { type: Date },
            approvedBy: { type: Object }
        }
    ],
    passportDocument: [
        {
            original: { type: String },
            temp: { type: String },
            docApproval: { type: Boolean, default: false },
            timestamp: { type: Date },
            approvedBy: { type: Object }
        }
    ],
    ecsCard: [
        {
            original: { type: String },
            temp: { type: String },
            docApproval: { type: Boolean, default: false },
            timestamp: { type: Date },
            approvedBy: { type: Object }
        }
    ],
    rightToWorkCard: [
        {
            original: { type: String },
            temp: { type: String },
            docApproval: { type: Boolean, default: false },
            timestamp: { type: Date },
            approvedBy: { type: Object }
        }
    ],
    additionalDocs: {
    type: Map,
    of: {
        type: [[
          new mongoose.Schema({
            original: String,
            timestamp: Date,
            approvedBy: Object
          })
        ]]
      }
    },
    docTimeStamps: {
      type: Map,
      of: Schema.Types.Mixed,
    },
});

const Personnel = mongoose.model('Personnel', PersonnelSchema);

module.exports = Personnel;