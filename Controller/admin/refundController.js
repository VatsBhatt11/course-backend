const CoursePurchase = require("../../Model/coursePurchaseModel");
const Enrollment = require("../../Model/enrollmentModel");
const order_IdModel = require("../../Model/order_IdModel");
const Razorpay = require("razorpay");
require("dotenv").config();

const razorpayInstance = new Razorpay({
  key_id: "rzp_test_ijIfGspQLSfEhH",
  key_secret: "2BchtClGW9UJJd6HmHpa898i",
});

const checkRefundStatus = async (refundId) => {
  try {
    const refundDetails = await razorpayInstance.refunds.fetch(refundId);
    return refundDetails;
  } catch (error) {
    console.error("Error fetching refund status:", error);
    throw error;
  }
};

const nodemailer = require('nodemailer');
// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
 service: 'Gmail', // or your email service
 auth: {
   user: process.env.EMAIL_USER, // your email
   pass: process.env.EMAIL_PASS, // your email password
 },
});

// Function to initiate a refund
const initiateRefund = async (req, res) => {
  const { transactionId } = req.params;
  const { refundAmount } = req.body;

  try {
    // Fetch purchase details
    const purchase = await CoursePurchase.findOne({ transactionId });
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    if (purchase.refundStatus) {
      return res.status(400).json({ message: "Refund has already been processed" });
    }

    // Fetch payment details from Razorpay
    const paymentDetails = await razorpayInstance.payments.fetch(transactionId);
    console.log("Payment Details:", paymentDetails);

    // Validate refund amount
    if (refundAmount * 100 > paymentDetails.amount) {
      return res.status(400).json({
        message: `Refund amount exceeds the captured amount of ₹${paymentDetails.amount / 100}`,
      });
    }

    // Generate cancel bill number
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const currentYearMonth = `${year}${month}`;
    const cancelPrefix = `CNC-${currentYearMonth}`;
    const refundCount = await CoursePurchase.countDocuments({
      cancelBillNumber: new RegExp(`^${cancelPrefix}`),
    });
    const cancelBillNumber = `${cancelPrefix}${String(refundCount + 1).padStart(2, "0")}`;

    // Handle payment statuses
    if (paymentDetails.status === "authorized") {
      console.log("Payment is authorized. Capturing payment before refund...");

      // Capture the payment
      const captureResponse = await razorpayInstance.payments.capture(
        transactionId,
        paymentDetails.amount
      );

      if (captureResponse.status !== "captured") {
        throw new Error("Failed to capture the payment. Refund cannot be initiated.");
      }

      console.log("Payment captured successfully.");
    }

    // Wait and re-fetch the payment status to ensure it is updated
    const updatedPaymentDetails = await razorpayInstance.payments.fetch(transactionId);
    if (updatedPaymentDetails.status !== "captured") {
      return res.status(400).json({
        message: "Payment capture is still in progress. Please try again shortly.",
      });
    }

    console.log("Payment is captured. Initiating refund...");

    // Initiate the refund
    const refund = await razorpayInstance.payments.refund(transactionId, {
      amount: refundAmount * 100, // Refund amount in paise
      notes: { cancelBillNumber },
    });

    if (!refund) {
      throw new Error("Failed to initiate refund with Razorpay.");
    }

    console.log("Refund initiated successfully:", refund);

    // Update the purchase record with refund details
    purchase.refundId = refund.id;
    purchase.refundStatus = true;
    purchase.cancelBillNumber = cancelBillNumber;
    purchase.refundAmount = refundAmount;
    purchase.refundDate = new Date();
    await purchase.save();

    // Compose and send email notification
    const emailSubject = purchase.refundStatus
      ? "Refund Processed Successfully"
      : "Refund Initiation Failed";

    const emailText = purchase.refundStatus
      ? `Dear ${purchase.customerName},\n\nYour refund of ₹${refundAmount} has been processed successfully.\n\nThank you for your patience.\n\nBest regards,\n${process.env.COMPANY_NAME}`
      : `Dear Admin,\n\nRefund initiation failed for Transaction ID: ${transactionId}. Please investigate.\n\nThank you,\n${process.env.COMPANY_NAME}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: purchase.refundStatus
        ? [purchase.customerEmail, process.env.ADMIN_EMAIL]
        : [process.env.ADMIN_EMAIL],
      subject: emailSubject,
      text: emailText,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
      } else {
        console.log("Email sent successfully:", info.response);
        console.log(`Notification email sent to: ${mailOptions.to.join(", ")}`);
      }
    });

    // Respond with success
    return res.status(200).json({
      success: true,
      message: "Refund initiated successfully",
      refundDetails: refund,
    });
  } catch (error) {
    console.error("Error initiating refund:", error);

    // Send email notification for failure
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: "Refund Failed",
      text: `Dear Admin,\n\nAn error occurred while initiating a refund for Transaction ID: ${transactionId}.\n\nError Details: ${error.message}\n\nPlease investigate.\n\nThank you,\n${process.env.COMPANY_NAME}`,
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending failure email:", err);
      } else {
        console.log("Failure email sent successfully:", info.response);
      }
    });

    return res.status(500).json({
      success: false,
      message: `Error initiating refund: ${error.message}`,
    });
  }
};

const getAllRefunds = async (req, res) => {
  try {
    const {
      search,
      page,
      limit,
      sortBy = "refundDate",
      order = "desc",
      courseName,
      customerName,
      refundId,
      cancelBillNumber,
      pageCount,
      refundStatusField = "refundStatus",
    } = req.query;

    const query = {
      [refundStatusField]: true,
    };

    // Fetch all purchases with refund details
    const purchases = await CoursePurchase.find({
      refundStatus: true,
    }).populate("courseId userId", "courseName customerName"); // Populate course and user details if needed

    if (search) {
      query.$or = [
        { courseName: new RegExp(search, "i") },
        { customerName: new RegExp(search, "i") },
        { refundId: new RegExp(search, "i") },
        { cancelBillNumber: new RegExp(search, "i") },
      ];
    }

    if (courseName) {
      query.courseName = new RegExp(courseName, "i");
    }
    if (customerName) {
      query.customerName = customerName;
    }
    if (refundId) {
      query.refundId = refundId;
    }
    if (cancelBillNumber) {
      query.cancelBillNumber = cancelBillNumber;
    }

    const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;

    const totalrefunds = await CoursePurchase.countDocuments(query);

    const refunds = await CoursePurchase.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    // Prepare the response data
    const responseData = refunds.map((refund) => ({
      transactionId: refund.transactionId,
      refundId: refund.refundId,
      refundDate: refund.updatedAt, // Assuming the refund date is the updated date of the purchase
      courseName: refund.courseName,
      customerName: refund.customerName,
      customerEmail: refund.customerEmail,
      mobileNumber: refund.mobileNumber,
      totalPaidAmount: refund.totalPaidAmount,
      cancelBillNumber: refund.cancelBillNumber,
      discountCode: refund.discountCode || null,
    }));

    res.status(200).json({
      success: true,
      message: "All refund details retrieved successfully",
      data: responseData,
      page: parseInt(page),
      pageCount,
      totalrefunds,
    });
    
  } catch (error) {
    console.error("Error fetching all refund details:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  initiateRefund,
  getAllRefunds,
};
