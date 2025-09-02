// managementCRM_Web/backend/controllers/applicationDeductionsController.js

const axios = require('axios');
const { PDFDocument, rgb } = require('pdf-lib');
const moment = require('moment-timezone');
const { uploadPdfToS3 } = require('../utils/applications3Helper');
const { sendToClients } = require('../utils/sseService');

// GET a single deduction by its ID
const getDeductionDetails = async (req, res) => {
    const Deduction = req.db.model('Deduction', require('../models/Deduction').schema);
    try {
        const deduction = await Deduction.findById(req.params.id);
        if (!deduction) {
            return res.status(404).json({ message: 'Deduction not found.' });
        }
        res.status(200).json(deduction);
    } catch (error) {
        console.error('Error fetching deduction details:', error);
        res.status(500).json({ message: 'Error fetching deduction details' });
    }
};

// PATCH to sign a deduction and generate the final PDF
const signDeduction = async (req, res) => {
    const Deduction = req.db.model('Deduction', require('../models/Deduction').schema);
    try {
        const { signature } = req.body;

        if (!signature) {
            return res.status(400).json({ message: 'Signature is required.' });
        }

        const existingDeduction = await Deduction.findById(req.params.id);
        if (!existingDeduction) {
            return res.status(404).json({ message: 'Deduction not found.' });
        }

        // Prepare dates and template
        const addedOnDate = moment(existingDeduction.addedBy?.addedOn).tz('Europe/London').format('DD/MM/YYYY');
        const deductionDate = moment(existingDeduction.date).tz('Europe/London').format('DD/MM/YYYY');
        const templateUrl = 'https://mcrm.s3.eu-west-2.amazonaws.com/public/deduction_template.pdf';
        
        const templateResponse = await axios.get(templateUrl, { responseType: 'arraybuffer' });
        const pdfDoc = await PDFDocument.load(templateResponse.data);
        const form = pdfDoc.getForm();
        const page1 = pdfDoc.getPages()[0];

        // Fill PDF form fields
        form.getTextField('personnelName').setText(existingDeduction.personnelName || '');
        form.getTextField('serviceType').setText(existingDeduction.title || '');
        form.getTextField('rate').setText(`£${existingDeduction.rate || 0}`);
        form.getTextField('date').setText(deductionDate);
        form.getTextField('week').setText(existingDeduction.week || '');
        form.getTextField('addedOnDate').setText(addedOnDate);

        // Embed the signature image
        const signatureResponse = await axios.get(signature, { responseType: 'arraybuffer' });
        const signaturePng = await pdfDoc.embedPng(signatureResponse.data);
        page1.drawImage(signaturePng, { x: 350, y: 200, width: 60, height: 60 });
        form.flatten();

        // Attach the deduction document as a second page if it exists
        if (existingDeduction.deductionDocument) {
            const docUrl = existingDeduction.deductionDocument;
            const fileExtension = docUrl.split('.').pop().toLowerCase();
            
            if (['jpg', 'jpeg', 'png'].includes(fileExtension)) {
                const imageResponse = await axios.get(docUrl, { responseType: 'arraybuffer' });
                const image = fileExtension === 'png' 
                    ? await pdfDoc.embedPng(imageResponse.data) 
                    : await pdfDoc.embedJpg(imageResponse.data);
                
                const page2 = pdfDoc.addPage();
                const { width, height } = image.scale(1);
                const scaleFactor = Math.min(page2.getWidth() / width, page2.getHeight() / height);
                page2.drawImage(image, {
                    x: (page2.getWidth() - width * scaleFactor) / 2,
                    y: (page2.getHeight() - height * scaleFactor) / 2,
                    width: width * scaleFactor,
                    height: height * scaleFactor,
                });
            }
        }

        // Save the final PDF and upload it to S3
        const finalPdfBytes = await pdfDoc.save();
        const fileName = `${existingDeduction.user_ID}_${Date.now()}_signed_deduction`;
        const s3Result = await uploadPdfToS3(
            req.db.db.databaseName,
            Buffer.from(finalPdfBytes),
            existingDeduction.user_ID,
            'signed-deduction-forms',
            fileName
        );

        // Update the deduction in the database
        existingDeduction.signed = true;
        existingDeduction.deductionDocument = s3Result.url;
        const updatedDeduction = await existingDeduction.save();

        sendToClients(req.db, { type: 'deductionUpdated' });

        res.status(200).json({
            message: 'Deduction signed successfully and final PDF generated.',
            deduction: updatedDeduction,
        });

    } catch (error) {
        console.error('Error signing deduction:', error);
        res.status(500).json({ message: 'Error signing deduction.', error: error.message });
    }
};

module.exports = {
    getDeductionDetails,
    signDeduction,
};