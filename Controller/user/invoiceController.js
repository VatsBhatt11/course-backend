// const PDFDocument = require("pdfkit");
// const fs = require("fs");

// function generateInvoicePDF(customerDetails, igst, cgst, sgst, course, user, amountWithoutGst, invoiceNumber, totalPaidAmount, totalGst, razorpayPaymentId) {
//   const doc = new PDFDocument(); // Create a new PDFDocument instance
//   const filePath = `public/invoice/invoice_${invoiceNumber}.pdf`; // Define the file path for the PDF

//   // Pipe the PDF into a writable stream
//   doc.pipe(fs.createWriteStream(filePath));

//   // Add content to the PDF
//   doc.fontSize(20).text(`Invoice #${invoiceNumber}`, { align: "center" });
//   doc.moveDown();
//   doc.fontSize(14).text(`Customer Name: ${customerDetails.name}`);
//   doc.text(`Course Name: ${course.cname}`);
//   doc.text(`Total Amount Paid:  Rs.${totalPaidAmount}`);
//   doc.text(`Transaction ID: ${razorpayPaymentId}`); // Assuming transactionId is part of customerDetails
//   doc.text(`Purchase Date: ${Date.now()}`); // Assuming transactionDate is part of customerDetails
//   doc.text(`Invoice Number: ${invoiceNumber}`);
//   doc.text(`Amount Without GST:  Rs.${amountWithoutGst}`);
//   if (igst <= 0 && cgst > 0 && sgst > 0) {
//     doc.text(`CGST:  Rs.${cgst}`);
//     doc.text(`SGST:  Rs.${sgst}`);
//   } else {
//     doc.text(`IGST:  Rs.${igst}`);
//   }
//   doc.text(`Total GST:  Rs.${totalGst}`);
//   doc.text(`Payment Mode: ${customerDetails.paymentMode}`);
//   doc.text(`Customer Email: ${customerDetails.email}`);
//   doc.text(`Customer Mobile: ${user.phoneNumber}`);
//   doc.text(`Customer City: ${customerDetails.city}`);
//   doc.text(`Customer State: ${customerDetails.state}`);
//   doc.text(`Customer Country: ${customerDetails.country}`);

//   // Finalize the PDF and save it
//   doc.end();
// }

// module.exports = {
//   generateInvoicePDF,
// };

const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');

const generateInvoicePDF = async (invoice) => {
    try {
      const templatePath = path.join(__dirname, '../../views/invoiceTemplate.ejs');
      const logoBase64 = fs.readFileSync(path.join(__dirname, '../../public', 'brand-logo.png'), 'base64');
      const signBase64 = fs.readFileSync(path.join(__dirname, '../../public', 'hardik_sign.png'), 'base64');
      const phoneBase64 = fs.readFileSync(path.join(__dirname, '../../public', 'phone_icon.svg'), 'base64');
      const emailBase64 = fs.readFileSync(path.join(__dirname, '../../public', 'home_icon.svg'), 'base64');

        invoice.logoBase64 = logoBase64;
        invoice.signBase64 = signBase64;
        invoice.phoneBase64 = phoneBase64;
        invoice.emailBase64 = emailBase64;

        const html = await ejs.renderFile(templatePath, invoice);

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load' });

        const pdfPath = path.join(__dirname, `../../public/invoice/invoice_${invoice.coursePurchase.invoiceNumber}.pdf`);
        await page.pdf({ path: pdfPath, format: 'A4' });

        await browser.close();

        return pdfPath; // Return the path to the generated PDF
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw new Error('Error generating invoice PDF.');
    }
};

module.exports = {
    generateInvoicePDF,
};
