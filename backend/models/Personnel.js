const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PersonnelSchema = new mongoose.Schema({
    firstName: { type : String, required: true},
    lastName: {type : String, required: true},
    address: {type : String, required: true},
    user_ID: { type: String, required: true },
    postcode: { type: String, required: true, match: /^[A-Z0-9 ]{3,10}$/i },
    role: {type: String },
    nationalInsuranceNumber: {type: String, required: true},
    dateOfBirth: { type: Date, required: true },
    nationality: { type: String, required: true },
    dateOfJoining: { type: Date, required: false },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    addedBy: { type: Object },
    siteSelection: { type: Array, required: true },
    utrNo: { type: String, required: false },
    utrUpdatedOn: { type: Date, required: false },
    activeStatus: { type: String, required: true, default: "Active" },
    vatDetails: {
        vatNo: {
            type: String,
            required: function () { return this.vatDetails != null; }
        },
        vatEffectiveDate: {
            type: Date,
            required: function () { return this.vatDetails != null; }
        }
    },
    dailyRate: { type: Number, required: true },
    bankDetails: {
        type: new mongoose.Schema({
            bankName: { type: String, required: true },
            sortCode: { type: String, required: true },
            accNo: { type: String, required: true },
            accName: { type: String, required: true },
            bankType: { type: String, required: true }
        }, {_id: false}),
        required: true
    },
    passportDetails: {
        type: new mongoose.Schema({
            issuedFrom: { type: String, required: true },
            passportNumber: { type: String, required: true },
            passportValidity: { type: Date, required: true },
            passportExpiry: { type: Date, required: true }
        }, { _id: false }),
        required: true
    },
    rightToWorkDetails: {
        type: new mongoose.Schema({
            rightToWorkValidity: { type: Date, required: true },
            rightToWorkExpiry: { type: Date, required: true }
        }, { _id: false }),
        required: true
    },
    profilePic: { type: String },
    drivingLicenseDetails: {
        type: new mongoose.Schema({
            dlNumber: { type: String, maxlength: 20, required: true },
            dlValidity: { type: Date, required: true },
            dlExpiry: { type: Date, required: true }, 
            dlIssue: { type: Date, required: true }
        }, { _id: false }),
        required: true
    },
    ecsDetails: {
        ecsIssue: { type: Date },
        ecsExpiry: { type: Date },
        active: { type: Boolean }
    },
    expiredReasons: { type: Array },
    dailyRate: { type: Number },
    // File Uploads
    signature: [
      {
        original: { type: String },
        timestamp: { type: Date }
      }
    ],
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