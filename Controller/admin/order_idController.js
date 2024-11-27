const Razorpay = require("razorpay");
const Order = require("../../Model/order_IdModel");
const userModel = require("../../Model/userModel");
const Course = require("../../Model/courseModel");
const CoursePurchase = require("../../Model/coursePurchaseModel");
const Enrollment = require("../../Model/enrollmentModel");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { generateInvoicePDF } = require("../user/invoiceController");
const nodemailer = require('nodemailer');
require("dotenv").config();
const path = require("path");
const ejs = require("ejs");

const instance = new Razorpay({
  key_id: "rzp_test_ijIfGspQLSfEhH",
  key_secret: "2BchtClGW9UJJd6HmHpa898i",
});

const createOrder = async (req, res) => {
  try {
    const { courseId, userId, amount, currency } = req.body;

    if (!courseId || !userId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid input data" });
    }

    // Check if the user is already enrolled in the course
    const existingEnrollment = await Enrollment.findOne({ courseId, userId });
    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: "You already enrolled in this course. Please refresh the page to view content.",
      });
    }

    const shortUserId = userId.slice(-6);
    const shortCourseId = courseId.slice(-6);
    const receipt = `recpt_${shortUserId}_${shortCourseId}_${Date.now()}`;

    const secretKey = crypto.randomBytes(32).toString("hex");

    const options = {
      amount: amount,
      currency: currency || "INR",
      receipt: receipt,
    };

    instance.orders.create(options, async (err, order) => {
      if (err) {
        console.error("Razorpay Order Error:", err);
        return res.send({
          status: 400,
          success: false,
          msg: "Something went wrong!",
          error: err.message,
        });
      }

      const newOrder = new Order({
        courseId,
        userId,
        amount: amount/100,
        currency,
        razorpayOrderId: order.id,
        secretKey,
      });

      await newOrder.save();

      res.send({
        status: 200,
        success: true,
        msg: "Order Created",
        order_id: order.id,
        key_id: process.env.RAZORPAY_ID_KEY,
        course_name: req.body.name,
      });
    });
  } catch (error) {
    console.error("Server Error:", error);
    res.send({
      status: 500,
      success: false,
      msg: "Server Error",
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log("Received orderId:", orderId);

    const order = await Order.findById(orderId);

    if (!order) {
      console.log("Order not found in database");
      return res.status(404).send({
        status: 404,
        success: false,
        msg: "Order not found",
      });
    }

    console.log("Order found:", order);

    res.status(200).send({
      status: 200,
      success: true,
      order: {
        courseId: order.courseId,
        userId: order.userId,
        razorpayOrderId: order.razorpayOrderId,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    console.error("Server Error:", error.message);
    res.status(500).send({
      status: 500,
      success: false,
      msg: "Server Error",
    });
  }
};

const getallorders = async (req, res) => {
  try {
    const {
      search,
      page = 1,
      limit = 4,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const matchStage = {};
    if (search) {
      const regex = new RegExp(search, "i");

      const searchAmount = !isNaN(search) ? Number(search) : null;

      matchStage["$or"] = [
        { "user.name": regex },
        { "course.cname": regex },
        { razorpayOrderId: regex },
        ...(searchAmount !== null ? [{ amount: searchAmount }] : []),
      ];
    }

    const totalOrders = await Order.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $lookup: {
          from: "courselists",
          localField: "courseId",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: "$course" },
      {
        $match: matchStage,
      },
      {
        $count: "total",
      },
    ]);

    const orders = await Order.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $lookup: {
          from: "courselists",
          localField: "courseId",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: "$course" },
      {
        $match: matchStage,
      },
      {
        $sort: { [sortBy]: order === "asc" ? 1 : -1 },
      },
      {
        $skip: (page - 1) * limit,
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    const totalRecords = totalOrders[0]?.total || 0;
    const pageCount = Math.ceil(totalRecords / limit);

    res.json({
      orders: orders.map((order) => ({
        ...order,
        userName: order.user.name,
        courseName: order.course.cname,
      })),
      page: parseInt(page),
      pageCount,
      totalOrders: totalRecords,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

const editOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, currency, status } = req.body;

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { amount, currency, status, updatedAt: Date.now() },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        status: 404,
        message: "Order not found",
      });
    }

    res.json({
      status: 200,
      message: "Order updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedOrder = await Order.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({
        status: 404,
        message: "Order not found",
      });
    }

    res.json({
      status: 200,
      message: "Order deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

const razorpayInstance = new Razorpay({
  key_id: "rzp_test_ijIfGspQLSfEhH",

  key_secret: "2BchtClGW9UJJd6HmHpa898i",
});


const verifyPayment = async (req, res) => {
  try {
    const {
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      customerDetails,
      courseId,
      key_secret = "2BchtClGW9UJJd6HmHpa898i",
    } = req.body;

    console.log("Customer Details:", customerDetails);

    if (!key_secret) {
      return res.json({
        status: 500,
        success: false,
        message: "Razorpay key secret is not configured.",
      });
    }

    const hmac = crypto.createHmac("sha256", key_secret);
    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    hmac.update(payload);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpaySignature) {
      await new CoursePurchase({
        courseId,
        userId: customerDetails.userId,
        transactionId: razorpayPaymentId,
        status: "Failure",
      }).save();

      return res.json({
        status: 400,
        success: false,
        message: "Invalid signature",
      });
    }

    const course = await Course.findById(courseId);
    let user = await userModel.findById(customerDetails.userId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (!user) {
      user = new userModel({
        id: customerDetails.userId,
        name: customerDetails.name,
        email: customerDetails.email,
        city: customerDetails.city,
        phoneNumber: customerDetails.mobile,
      });
      await user.save();
    } else {
      Object.assign(user, {
        name: customerDetails.name,
        email: customerDetails.email,
        city: customerDetails.city,
      });
      await user.save();
    }

    const totalPaidAmount = customerDetails.amount;
    const gstPercentage = course.courseGst || 0;
    const amountWithoutGst = parseFloat(((totalPaidAmount * 100) / (100 + gstPercentage)).toFixed(2));
    const totalGst = parseFloat((totalPaidAmount - amountWithoutGst).toFixed(2));

    const isFromGujarat = customerDetails.state === "Gujarat";
    const cgst = isFromGujarat ? totalGst / 2 : 0;
    const sgst = isFromGujarat ? totalGst / 2 : 0;
    const igst = !isFromGujarat ? totalGst : 0;

    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");

    const currentYearMonth = `${year}${month}`;
    const invoicePrefix = `COS-${currentYearMonth}`;

    const invoiceCount = await CoursePurchase.countDocuments({
      invoiceNumber: new RegExp(`^${invoicePrefix}`),
    });

    const invoiceNumber = `${invoicePrefix}${String(invoiceCount + 1).padStart(
      2,
      "0"
    )}`;

    const coursePurchase = new CoursePurchase({
      courseId,
      courseName: course.cname,
      userId: customerDetails.userId,
      transactionId: razorpayPaymentId,
      customerName: customerDetails.name,
      customerEmail: customerDetails.email,
      customerMobile: user.phoneNumber,
      customerCity: customerDetails.city,
      customerState: customerDetails.state,
      customerCountry: customerDetails.country,
      status: "Success",
      amountWithoutGst,
      cgst,
      sgst,
      igst,
      totalGst: cgst + sgst + igst,
      totalPaidAmount,
      paymentMode: customerDetails.paymentMode,
      invoiceNumber,
      cancelBillNumber: null,
    });

    await coursePurchase.save();

    const enrollment = new Enrollment({
      courseId,
      userId: customerDetails.userId,
      percentageCompleted: 0,
    });
    await enrollment.save();

    // await generateInvoicePDF(customerDetails, igst, cgst, sgst, course, user, amountWithoutGst, invoiceNumber, totalPaidAmount, totalGst, razorpayPaymentId);
    // const fs = require("fs");

    const formatDate = (timestamp) => {
      const date = new Date(timestamp);
      const options = { year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: '2-digit' };
      return date.toLocaleDateString('en-US', options).replace(',', '');
  };
  
    console.log("users", user);
    const invoice = {
      customerDetails: {
        name: customerDetails.name,
        email: customerDetails.email,
        mobile: customerDetails.mobile,
        state: customerDetails.state,
      },
      course: {
        cname: course.cname,
        courseGst: course.courseGst,
      },
      coursePurchase: {
        transactionDate: coursePurchase.transactionDate,
        transactionId: razorpayPaymentId,
        amountWithoutGst: coursePurchase.amountWithoutGst,
        totalGst: coursePurchase.totalGst,
        invoiceNumber: coursePurchase.invoiceNumber,
        totalPaidAmount: coursePurchase.totalPaidAmount,
        igst: coursePurchase.igst,
        cgst: coursePurchase.cgst,
        sgst: coursePurchase.sgst,
      },
      COMPANY_NAME: process.env.COMPANY_NAME,
      COMPANY_ADDRESS: process.env.COMPANY_ADDRESS,
      COMPANY_PAN_NUMBER: process.env.COMPANY_PAN_NUMBER,
      COMPANY_STATE: process.env.COMPANY_STATE,
      COMPANY_HSN_NUMBER: process.env.COMPANY_HSN_NUMBER,
      COMPANY_CIN_NUMBER: process.env.COMPANY_CIN_NUMBER,
      COMPANY_GST_NUMBER: process.env.COMPANY_GST_NUMBER,
      COMPANY_EMAIL: process.env.COMPANY_EMAIL,
      COMPANY_HELPLINE: process.env.COMPANY_HELPLINE,
      formatDate
    };

    const pdfPath = await generateInvoicePDF(invoice);

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: [customerDetails.email, process.env.ADMIN_EMAIL],
      subject: `🎉 Congratulations! Your Enrollment is Confirmed! Welcome to ${course.cname}!`,
      text: `Dear ${customerDetails.name},
    
    We are absolutely thrilled to welcome you to Garbhsanskar Guru! 🌟
    
    Your recent purchase of the "${course.cname}" course has been successfully processed, and we’re delighted to have you as part of our learning community. Here’s what you need to know about your purchase and what to expect next:
    
    🔑 Enrollment Details:
    - Course Name: ${course.cname}
    - Purchase Date: ${coursePurchase.transactionDate}
    - Transaction ID: ${razorpayPaymentId}
    - Total Amount Paid: ₹${totalPaidAmount}
    - Invoice Number: ${invoiceNumber}
    
    📚 What Awaits You in "${course.cname}":
    
    Prepare yourself for a transformative journey! This course has been carefully crafted to provide you with the skills, knowledge, and insights that will take you to the next level. With expert instructors, immersive content, and hands-on exercises, you’re in for an educational experience like no other.
    
    ✨ Why You’re Going to Love This Course:
    
    1. Expert Guidance:  Learn from industry leaders and seasoned professionals who are passionate about sharing their expertise.
    2. Comprehensive Content: From foundational concepts to advanced strategies, this course covers it all.
    3. Interactive Learning: Engage with interactive modules, quizzes, and real-world projects that reinforce your learning.
    4. Flexible Schedule: Learn at your own pace, on your own schedule, with 24/7 access to course materials.
    5. Community Support: Join a vibrant community of learners and connect with like-minded individuals on the same journey.
    
    🚀 Next Steps:
    
    1. Access Your Course: You can start learning right away! Simply log in to your account on [Your Platform Link] and access your course under the “My Courses” section.
    2. Get Ready to Learn: Make sure you have a comfortable learning environment, a notebook for taking notes, and a readiness to absorb all the valuable information coming your way.
    3. Stay Connected: Don’t forget to join our community on [Social Media Links] where you can share your progress, ask questions, and stay updated with the latest news and resources.
    
    🎁 A Special Gift for You!
    
    As a token of our appreciation, we’re offering you an exclusive discount on your next course with us! Stay tuned for more details in your inbox.
    
    🔁 Need Assistance? We’re Here for You!
    
    If you have any questions, concerns, or just want to share your excitement, our support team is always here to help. Reach out to us at [Support Email] or [Support Phone Number], and we’ll be happy to assist you.
    
    Thank You for Choosing Us!
    
    At Garbhsanskar Guru, we are committed to your success. We believe that education is the most powerful tool you can use to achieve your dreams, and we are honored to be part of your journey. Your investment in learning is a step towards a brighter future, and we’re here to support you every step of the way.
    
    We can’t wait to see what you’ll achieve with the knowledge you’ll gain from "${course.cname}". Happy learning!
    
    `,
    attachments: [
      {
        filename: `invoice_${invoice.coursePurchase.invoiceNumber}.pdf`,
          path: pdfPath,
      },
    ],
    };

    // await transporter.sendMail(mailOptions);
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).send('Error sending email.');
      } else {
        console.log('Email sent:', info.response);
        // Optionally delete the PDF after sending
        fs.unlinkSync(pdfPath);
        return res.status(200).send('Payment verified and email sent.');
      }
    });

    res.json({
      status: 200,
      success: true,
      message:
        "Payment verified, course purchased, and user enrolled successfully.",
    });
  } catch (error) {
    console.error("Error during payment verification:", error);
    res.json({
      status: 500,
      success: false,
      message: error.message,
    });
  }
};

const initiateRefund = async (purchaseId) => {
  try {
    const purchase = await CoursePurchase.findById(purchaseId);

    if (!purchase) {
      throw new Error("Purchase not found");
    }

    purchase.cancelBillNumber = `CNCL-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    purchase.active = false;

    const refund = await razorpay.payments.refund(purchase.transactionId, {
      amount: purchase.totalPaidAmount * 100,
      notes: {
        cancelBillNumber: purchase.cancelBillNumber,
      },
    });

    if (!refund) {
      throw new Error("Failed to initiate refund with Razorpay");
    }

    await purchase.save();

    return {
      success: true,
      message: "Refund initiated and cancel bill number generated.",
      cancelBillNumber: purchase.cancelBillNumber,
    };
  } catch (error) {
    console.error("Error initiating refund:", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

const getAllCoursePurchases = async (req, res) => {
  try {
    const {
      search,
      page = 1,
      limit = 4,
      sortBy = "transactionDate",
      order = "desc",
      userId,
    } = req.query;

    const query = {};

    if (userId && userId !== "null") {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          status: 400,
          message: "Invalid user ID",
        });
      }
      query.userId = userId;
    }

    if (search) {
      const regex = new RegExp(search, "i");

      const searchNumber = !isNaN(search) ? Number(search) : null;

      query["$or"] = [
        { customerName: regex },
        { customerEmail: regex },
        { transactionId: regex },
        { invoiceNumber: regex },
        ...(searchNumber !== null
          ? [{ mobileNumber: searchNumber }, { totalPaidAmount: searchNumber }]
          : []),
      ];
    }

    const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;

    const totalPayments = await CoursePurchase.countDocuments(query);
    const pageCount = Math.ceil(totalPayments / limit);

    const payments = await CoursePurchase.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .exec();

    res.json({
      payments: payments.map((payment) => ({
        ...payment._doc,
      })),
      page: parseInt(page),
      pageCount,
      totalPayments,
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({
      status: 500,
      message: error.message,
    });
  }
};

const transactiontoggleButton = async (req, res) => {
  console.log(`PATCH request received for course ID: ${req.params.id}`);
  try {
    const purchase = await CoursePurchase.findById(req.params.id);
    if (!purchase) {
      return res.json({
        status: 404,
        message: "Transaction not found",
      });
    }
    purchase.active = !purchase.active;
    await purchase.save();
    res.json({
      status: 200,
      purchase,
    });
  } catch (error) {
    console.error("Error toggling transaction:", error);
    res.json({
      status: 500,
      message: "Server error",
    });
  }
};

const deleteCoursePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    await CoursePurchase.findByIdAndDelete(id);
    res.json({
      status: 200,
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    res.json({
      status: 500,
      message: "Error deleting transaction",
      error: error.message,
    });
  }
};

const coursePurchasetoggleButton = async (req, res) => {
  console.log(
    `PATCH request received for course purchase ID: ${req.params.id}`
  );
  try {
    const coursePurchase = await CoursePurchase.findById(req.params.id);
    if (!coursePurchase) {
      return res.json({
        status: 404,
        message: "Purchased course not found",
      });
    }
    coursePurchase.active = !coursePurchase.active;
    await coursePurchase.save();
    res.json({
      status: 200,
      coursePurchase,
    });
  } catch (error) {
    console.error("Error toggling Purchased course:", error);
    res.json({
      status: 500,
      message: "Server error",
    });
  }
};

const getEnrolledCourses = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: 400,
        message: "Invalid user ID",
      });
    }

    const enrollments = await Enrollment.find({ userId });

    if (enrollments.length === 0) {
      return res.status(404).json({
        status: 404,
        message: "No courses found for this user",
      });
    }

    const courseIds = enrollments.map((enrollment) => enrollment.courseId);

    const courses = await Course.find({ _id: { $in: courseIds } });

    return res.status(200).json({
      status: 200,
      data: courses,
    });
  } catch (error) {
    console.error("Error fetching enrolled courses:", error.message);
    return res.status(500).json({
      status: 500,
      message: "Failed to fetch enrolled courses",
    });
  }
};

const createSkipOrder = async (req, res) => {
  try {
    const { courseId, userId, amount, currency,paymentOption, customerDetails } = req.body;
    console.log("Received payload:", req.body);
    console.log("customerDetails", customerDetails);
    // Validate input data
    if (!courseId || !userId || !customerDetails) {
      return res.status(400).json({
        success: false,
        message: "Invalid input data",
      });
    }

    // Check if the user is already enrolled in the course
    const existingEnrollment = await Enrollment.findOne({ courseId, userId });
    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: "You are already enrolled in this course.",
      });
    }

    // Generate a unique order ID
    const shortUserId = userId.slice(-6);
    const shortCourseId = courseId.slice(-6);
    const orderId = `ORD-${shortUserId}-${shortCourseId}-${Date.now()}`;

    const newOrder = new Order({
      courseId,
      userId,
      amount,
      currency: customerDetails.currency,
      razorpayOrderId: orderId,
    });

    console.log("newOrder: ", newOrder);

    await newOrder.save();

    // // Simulate payment verification logic
    // const keySecret = "2BchtClGW9UJJd6HmHpa898i";
    // const payload = `${orderId}|${amount}`;
    // const hmac = crypto.createHmac("sha256", keySecret);
    // hmac.update(payload);
    // const generatedSignature = hmac.digest("hex");

    // if (req.body.signature !== generatedSignature) {
    //   await new CoursePurchase({
    //     courseId,
    //     userId,
    //     transactionId: orderId,
    //     status: "Failure",
    //   }).save();

    //   return res.status(400).json({
    //     success: false,
    //     message: "Invalid signature. Payment verification failed.",
    //   });
    // }

    // Fetch course details
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Fetch or create user
    let user = await userModel.findById(userId);
    if (!user) {
      user = new userModel({
        id: userId,
        ...customerDetails,
      });
      await user.save();
    } else {
      Object.assign(user, customerDetails);
      await user.save();
    }

    // Calculate GST and other details
    const gstPercentage = course.courseGst || 0;
    const amountWithoutGst = parseFloat(((amount * 100) / (100 + gstPercentage)).toFixed(2));
    const totalGst = parseFloat((amount - amountWithoutGst).toFixed(2));
    const isFromGujarat = customerDetails.state === "Gujarat";
    const cgst = isFromGujarat ? totalGst / 2 : 0;
    const sgst = isFromGujarat ? totalGst / 2 : 0;
    const igst = !isFromGujarat ? totalGst : 0;

    // Generate invoice number
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const currentYearMonth = `${year}${month}`;
    const invoicePrefix = `COS-${currentYearMonth}`;
    const invoiceCount = await CoursePurchase.countDocuments({
      invoiceNumber: new RegExp(`^${invoicePrefix}`),
    });
    const invoiceNumber = `${invoicePrefix}${String(invoiceCount + 1).padStart(2, "0")}`;

    // Save course purchase details
    const coursePurchase = new CoursePurchase({
      courseId,
      courseName: course.cname,
      userId,
      transactionId: orderId,
      customerName: customerDetails.name,
      customerEmail: customerDetails.email,
      customerMobile: customerDetails.phoneNumber,
      customerCity: "null",
      customerState: customerDetails.state,
      customerCountry: "null",
      status: "Success",
      amountWithoutGst,
      cgst,
      sgst,
      igst,
      totalGst,
      totalPaidAmount: amount,
      paymentMode: "Admin_Skip",
      invoiceNumber,
    });
    await coursePurchase.save();

    // Enroll the user in the course
    const enrollment = new Enrollment({
      courseId,
      userId,
      percentageCompleted: 0,
    });
    await enrollment.save();

    // (Optional) Generate and send the invoice PDF and confirmation email here
    const formatDate = (timestamp) => {
      const date = new Date(timestamp);
      const options = { year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: '2-digit' };
      return date.toLocaleDateString('en-US', options).replace(',', '');
  };
  
    console.log("users", user);
    const invoice = {
      customerDetails: {
        name: customerDetails.name,
        email: customerDetails.email,
        mobile: customerDetails.phoneNumber,
        state: customerDetails.state,
      },
      course: {
        cname: course.cname,
        courseGst: course.courseGst,
      },
      coursePurchase: {
        transactionDate: coursePurchase.transactionDate,
        amountWithoutGst: coursePurchase.amountWithoutGst,
        totalGst: coursePurchase.totalGst,
        invoiceNumber: coursePurchase.invoiceNumber,
        totalPaidAmount: coursePurchase.totalPaidAmount,
        igst: coursePurchase.igst,
        cgst: coursePurchase.cgst,
        sgst: coursePurchase.sgst,
      },
      COMPANY_NAME: process.env.COMPANY_NAME,
      COMPANY_ADDRESS: process.env.COMPANY_ADDRESS,
      COMPANY_PAN_NUMBER: process.env.COMPANY_PAN_NUMBER,
      COMPANY_STATE: process.env.COMPANY_STATE,
      COMPANY_HSN_NUMBER: process.env.COMPANY_HSN_NUMBER,
      COMPANY_CIN_NUMBER: process.env.COMPANY_CIN_NUMBER,
      COMPANY_GST_NUMBER: process.env.COMPANY_GST_NUMBER,
      COMPANY_EMAIL: process.env.COMPANY_EMAIL,
      COMPANY_HELPLINE: process.env.COMPANY_HELPLINE,
      formatDate
    };

    const pdfPath = await generateInvoicePDF(invoice);

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: paymentOption === "withoutPayment" ? process.env.ADMIN_EMAIL : [customerDetails.email, process.env.ADMIN_EMAIL],
      subject: `🎉 Congratulations! Your Enrollment is Confirmed! Welcome to ${course.cname}!`,
      text: `Dear ${customerDetails.name},
    
    We are absolutely thrilled to welcome you to Garbhsanskar Guru! 🌟
    
    Your recent purchase of the "${course.cname}" course has been successfully processed, and we’re delighted to have you as part of our learning community. Here’s what you need to know about your purchase and what to expect next:
    
    🔑 Enrollment Details:
    - Course Name: ${course.cname}
    - Purchase Date: ${coursePurchase.transactionDate}
    - Total Amount Paid: ₹${amount}
    - Invoice Number: ${invoiceNumber}
    
    📚 What Awaits You in "${course.cname}":
    
    Prepare yourself for a transformative journey! This course has been carefully crafted to provide you with the skills, knowledge, and insights that will take you to the next level. With expert instructors, immersive content, and hands-on exercises, you’re in for an educational experience like no other.
    
    ✨ Why You’re Going to Love This Course:
    
    1. Expert Guidance:  Learn from industry leaders and seasoned professionals who are passionate about sharing their expertise.
    2. Comprehensive Content: From foundational concepts to advanced strategies, this course covers it all.
    3. Interactive Learning: Engage with interactive modules, quizzes, and real-world projects that reinforce your learning.
    4. Flexible Schedule: Learn at your own pace, on your own schedule, with 24/7 access to course materials.
    5. Community Support: Join a vibrant community of learners and connect with like-minded individuals on the same journey.
    
    🚀 Next Steps:
    
    1. Access Your Course: You can start learning right away! Simply log in to your account on [Your Platform Link] and access your course under the “My Courses” section.
    2. Get Ready to Learn: Make sure you have a comfortable learning environment, a notebook for taking notes, and a readiness to absorb all the valuable information coming your way.
    3. Stay Connected: Don’t forget to join our community on [Social Media Links] where you can share your progress, ask questions, and stay updated with the latest news and resources.
    
    🎁 A Special Gift for You!
    
    As a token of our appreciation, we’re offering you an exclusive discount on your next course with us! Stay tuned for more details in your inbox.
    
    🔁 Need Assistance? We’re Here for You!
    
    If you have any questions, concerns, or just want to share your excitement, our support team is always here to help. Reach out to us at [Support Email] or [Support Phone Number], and we’ll be happy to assist you.
    
    Thank You for Choosing Us!
    
    At Garbhsanskar Guru, we are committed to your success. We believe that education is the most powerful tool you can use to achieve your dreams, and we are honored to be part of your journey. Your investment in learning is a step towards a brighter future, and we’re here to support you every step of the way.
    
    We can’t wait to see what you’ll achieve with the knowledge you’ll gain from "${course.cname}". Happy learning!
    
    `,
    attachments: [
      {
        filename: `invoice_${invoice.coursePurchase.invoiceNumber}.pdf`,
          path: pdfPath,
      },
    ],
    };

    // await transporter.sendMail(mailOptions);
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).send('Error sending email.');
      } else {
        console.log('Email sent:', info.response);
        // Optionally delete the PDF after sending
        fs.unlinkSync(pdfPath);
        return res.status(200).send('Payment verified and email sent.');
      }
    });

    res.status(200).json({
      status: 200,
      success: true,
      message: "Order created, payment verified, and user enrolled successfully.",
      orderId: newOrder.razorpayOrderId,
    });
  } catch (error) {
    console.error("Error in createOrder:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


module.exports = {
  createOrder,
  getOrderById,
  getallorders,
  editOrder,
  deleteOrder,
  verifyPayment,
  getAllCoursePurchases,
  transactiontoggleButton,
  coursePurchasetoggleButton,
  deleteCoursePurchase,
  initiateRefund,
  getEnrolledCourses,
  createSkipOrder,
};
