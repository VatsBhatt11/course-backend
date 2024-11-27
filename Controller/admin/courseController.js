const mongoose = require("mongoose");
const Course = require("../../Model/courseModel");
const Video = require("../../Model/videoModel");
const userModel = require("../../Model/userModel");
const adminModel = require("../../Model/adminModel");
const Enrollment = require("../../Model/enrollmentModel");
const VideoProgress = require("../../Model/VideoProgress");
const Certificate = require("../../Model/CertificateModel");
const Purchase = require("../../Model/coursePurchaseModel");
const upload = require("../../middleware/upload");
const path = require("path");
const fs = require("fs");
const { body, validationResult } = require("express-validator");
const util = require("util");
const jwt = require("jsonwebtoken");
const pdf = require("html-pdf");
const moment = require("moment");

const createCourse = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error("Error uploading file:", err.message);
      return res.json({
        status: 400,
        message: err.message,
      });
    }

    try {
      const token = req.headers.authorization.split(" ")[1];
      const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
      const adminId = decodedToken.id;

      await Promise.all([
        body("cname")
          .notEmpty()
          .withMessage("Course name is required")
          .isLength({ min: 1, max: 255 })
          .withMessage("Course name must be between 1 and 255 characters long")
          .custom((value) => {
            const specialCharRegex = /[^a-zA-Z0-9\s\-\/]/;
            if (specialCharRegex.test(value)) {
              throw new Error(
                "Course name should not contain special characters."
              );
            }
            return true;
          })
          .run(req),
        body("learn")
          .notEmpty()
          .withMessage("What you will Learn field is required")
          .run(req),
        body("totalVideo")
          .notEmpty()
          .withMessage("Total video count is required")
          .isInt({ min: 1 })
          .withMessage("Total video count must be a positive integer")
          .run(req),
        body("author")
          .notEmpty()
          .withMessage("Author name is required")
          .isLength({ min: 1, max: 50 })
          .withMessage("Author name must be between 1 and 50 characters long")
          .custom((value) => {
            const specialCharRegex = /[^a-zA-Z0-9\s]/;
            if (specialCharRegex.test(value)) {
              throw new Error(
                "Author name should not contain special characters."
              );
            }
            return true;
          })
          .run(req),
        body("shortDescription")
          .notEmpty()
          .withMessage("Short description is required")
          .isLength({ min: 1, max: 407 })
          .withMessage("Description must be between 1 and 400 characters long")
          .run(req),
        body("longDescription")
          .notEmpty()
          .withMessage("Long description is required")
          .run(req),
        body("language")
          .notEmpty()
          .withMessage("Language is required")
          .run(req),
        body("price")
          .notEmpty()
          .withMessage("Price is required")
          .isFloat({ min: 0 })
          .withMessage("Price must be a positive number")
          .custom((value) => {
            if (value > 500000) {
              throw new Error("Price must be less than or equal to 5 lakhs.");
            }
            return true;
          })
          .run(req),
        body("dprice")
          .notEmpty()
          .withMessage("Display Price is required")
          .isFloat({ min: 0 })
          .withMessage("Display Price must be a positive number")
          .run(req),
        body("courseGst")
          .notEmpty()
          .withMessage("Course GST is required")
          .isFloat({ min: 0, max: 100 })
          .withMessage("GST must be between 0 and 100.")
          .run(req),
        body("chapters")
          .optional()
          .isArray()
          .withMessage("Chapters must be an array")
          .run(req),
        body("courseType")
          .notEmpty()
          .withMessage("Course type is required")
          .run(req),
        body("percentage")
          .optional()
          .isFloat({ min: 10, max: 100 })
          .withMessage("Percentage should be between 10 and 100.")
          .run(req),
      ]);

      const validationErrorObj = validationResult(req);
      if (!validationErrorObj.isEmpty()) {
        return res.json({
          status: 401,
          message: validationErrorObj.errors[0].msg,
        });
      }

      const {
        cname,
        totalVideo,
        learn,
        hours,
        author,
        shortDescription,
        longDescription,
        language,
        price,
        dprice,
        chapters,
        courseGst,
        courseType,
        percentage,
        startTime,
        endTime,
      } = req.body;

      const adjustToUTC = (dateTime) => {
        const date = new Date(dateTime);
        const offset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
        return new Date(date.getTime() - offset);
      };

      const startTimeUTC = startTime ? startTime : null;
      const endTimeUTC = endTime ? endTime : null;

      const courseImage =
        req.files && req.files.courseImage
          ? req.files.courseImage[0].path
          : null;

      const previewVideofile =
        req.files && req.files.previewVideofile
          ? req.files.previewVideofile[0].path
          : null;

      const existingCourse = await Course.findOne({ cname });
      if (existingCourse) {
        return res.json({
          status: 401,
          message: "Course with the same details already exists",
        });
      }

      const admin = await adminModel.findById(adminId);
      if (!admin || !mongoose.Types.ObjectId.isValid(adminId)) {
        return res.json({
          status: 401,
          message: "Admin not found",
        });
      }

      const course = new Course({
        adminId,
        cname,
        totalVideo,
        learn,
        courseImage,
        previewVideofile,
        hours,
        author,
        shortDescription,
        longDescription,
        language,
        price,
        dprice,
        chapters: chapters.map((chapter, index) => ({
          number: index + 1,
          name: chapter,
        })),
        courseGst,
        courseType,
        percentage: courseType === "percentage" ? percentage : null,
        // startTime: courseType === "timeIntervals" ? startTime : null,
        // endTime: courseType === "timeIntervals" ? endTime : null,
        startTime: courseType === "timeIntervals" ? startTimeUTC : null,
        endTime: courseType === "timeIntervals" ? endTimeUTC : null,
        createdBy: admin.name,
      });

      if (courseType === "timeIntervals") {
        course.percentage = 80;
      }
      if (courseType === "percentage") {
        course.startTime = null;
        course.endTime = null;
      }
      if (courseType === "allopen") {
        course.percentage = 80;
        course.startTime = null;
        course.endTime = null;
      }

      const savedCourse = await course.save();
      return res.json({
        status: 200,
        data: savedCourse,
      });
    } catch (error) {
      console.error("Error creating course:", error.message);
      return res.json({
        status: 500,
        message: "Failed to create course",
      });
    }
  });
};

const getAllCourses = async (req, res) => {
  try {
    const {
      search,
      page,
      limit,
      sortBy = "createdAt",
      order = "desc",
      userId,
      cname,
      price,
      dprice,
      courseGst,
      totalVideo,
      hours,
      author,
      language,
      courseType,
      percentage,
      createdBy,
      createdAt,
      active,
      deleted = false,
      pageCount,
    } = req.query;

    const query = {};

    if (active) {
      query.active = active === "true";
    }

    if (search) {
      query.$or = [
        { cname: new RegExp(search, "i") },
        { author: new RegExp(search, "i") },
        { language: new RegExp(search, "i") },
        { courseType: new RegExp(search, "i") },
      ];
    }

    if (cname) {
      query.cname = new RegExp(cname, "i");
    }
    if (price) {
      query.price = price;
    }
    if (dprice) {
      query.dprice = dprice;
    }
    if (courseGst) {
      query.courseGst = courseGst;
    }
    if (totalVideo) {
      query.totalVideo = totalVideo;
    }
    if (hours) {
      query.hours = hours;
    }
    if (author) {
      query.author = new RegExp(author, "i");
    }
    if (language) {
      query.language = new RegExp(language, "i");
    }
    if (courseType) {
      query.courseType = new RegExp(courseType, "i");
    }
    if (percentage) {
      query.percentage = percentage;
    }
    if (createdBy) {
      query.createdBy = createdBy;
    }
    if (createdAt) {
      const createdAtDate = new Date(createdAt);
      query.createdAt = {
        $gte: createdAtDate.setHours(0, 0, 0, 0),
        $lt: createdAtDate.setHours(23, 59, 59, 999),
      };
    }

    const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;

    const totalCourses = await Course.countDocuments(query);

    const courses = await Course.find(query)
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    if (userId && userId !== "null") {
      const enrollments = await Enrollment.find({ userId });
      const enrolledCourseIds = enrollments.map((enrollment) =>
        enrollment.courseId.toString()
      );

      const coursesWithEnrollmentStatus = courses.map((course) => ({
        _id: course._id,
        cname: course.cname,
        totalVideo: course.totalVideo,
        courseImage: course.courseImage,
        shortDescription: course.shortDescription,
        hours: course.hours,
        language: course.language,
        author: course.author,
        price: course.price,
        dprice: course.dprice,
        isEnrolled: enrolledCourseIds.includes(course._id.toString()),
      }));

      return res.json({
        courses: coursesWithEnrollmentStatus,
        page: parseInt(page),
        pageCount,
        totalCourses,
      });
    }

    res.json({
      courses,
      totalCourses,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({
      message: error.message,
    });
  }
};

const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.json({
        status: 400,
        message: "Invalid course ID",
      });
    }

    const course = await Course.findById(id);
    if (!course) {
      return res.json({
        status: 404,
        message: "Course not found",
      });
    }

    let isEnrolled = false;

    const videos = await Video.find({ courseId: id });

    const demoVideos = videos
      .map((video) => ({
        title: video.title,
        demoVideofile: video.demoVideofile,
      }))
      .filter((video) => video.demoVideofile !== null);

    return res.json({
      status: 200,
      data: {
        ...course._doc,
        isEnrolled,
        demoVideos,
      },
    });
  } catch (error) {
    console.error("Error fetching course by ID:", error.message);
    return res.json({
      status: 500,
      message: "Failed to fetch course",
    });
  }
};

const updateCourse = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error("Error uploading file:", err.message);
      return res.json({
        status: 400,
        message: err.message,
      });
    }

    await Promise.all([
      body("cname")
        .notEmpty()
        .withMessage("Course name is required")
        .isLength({ min: 1, max: 255 })
        .withMessage("Course name must be between 1 and 255 characters long")
        .custom((value) => {
          const specialCharRegex = /[^a-zA-Z0-9\s\-\/]/;
          if (specialCharRegex.test(value)) {
            throw new Error(
              "Course name should not contain special characters."
            );
          }
          return true;
        })
        .run(req),
      body("learn")
        .notEmpty()
        .withMessage("What you will Learn field is required")
        .run(req),
      body("totalVideo")
        .notEmpty()
        .withMessage("Total Videos cannot be empty")
        .isInt({ min: 1 })
        .withMessage("Total video count must be a positive integer")
        .run(req),

      body("shortDescription")
        .notEmpty()
        .withMessage("Short description cannot be empty")
        .isLength({ max: 407 })
        .withMessage("Short description cannot exceed 400 characters")
        .run(req),

      body("longDescription")
        .optional()
        .notEmpty()
        .withMessage("Long description cannot be empty")
        .run(req),

      body("language")
        .notEmpty()
        .withMessage("Language cannot be empty")
        .isIn(["English", "Hindi", "Gujarati"])
        .withMessage("Invalid language")
        .run(req),

      body("price")
        .notEmpty()
        .withMessage("Price is required")
        .isFloat({ min: 0 })
        .withMessage("Price must be a positive number")
        .custom((value) => {
          if (value > 500000) {
            throw new Error("Price must be less than or equal to 5 lakhs.");
          }
          return true;
        })
        .run(req),
      body("dprice")
        .notEmpty()
        .withMessage("Display Price is required")
        .isFloat({ min: 0 })
        .withMessage("Display Price must be a positive number")
        .run(req),

      body("courseGst")
        .notEmpty()
        .withMessage("Course GST is required")
        .isFloat({ min: 0, max: 100 })
        .withMessage("GST must be between 0 and 100.")
        .run(req),

      body("courseType")
        .notEmpty()
        .withMessage("Course type is required")
        .run(req),
      body("percentage")
        .optional()
        .isFloat({ min: 10, max: 100 })
        .withMessage("Percentage should be between 10 and 100.")
        .run(req),
    ]);

    const validationErrorObj = validationResult(req);
    if (!validationErrorObj.isEmpty()) {
      return res.json({
        status: 401,
        message: validationErrorObj.errors[0].msg,
      });
    }

    const { courseId } = req.params;
    const {
      cname,
      totalVideo,
      learn,
      hours,
      author,
      shortDescription,
      longDescription,
      language,
      price,
      dprice,
      chapters,
      courseGst,
      courseType,
      percentage,
      startTime,
      endTime,
    } = req.body;

    const adjustToUTC = (dateTime) => {
      const date = new Date(dateTime);
      console.log("date: ", date);
      const offset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
      console.log("offset: ", offset);
      return new Date(date.getTime() - offset);
    };

    // const startTimeUTC = startTime ? adjustToUTC(startTime) : null;
    // const endTimeUTC = endTime ? adjustToUTC(endTime) : null;
    console.log("startTime: ", startTime);
    console.log("endTime: ", endTime);
    const startTimeUTC = startTime ? startTime : null;
    const endTimeUTC = endTime ? endTime : null;


    // console.log("courseId: ", courseId);
    if (!courseId) {
      return res.json({
        status: 400,
        message: "Course ID is required.",
      });
    }

    const courseImage =
      req.files && req.files.courseImage ? req.files.courseImage[0].path : null;

    const previewVideofile =
      req.files && req.files.previewVideofile
        ? req.files.previewVideofile[0].path
        : null;

    try {
      const course = await Course.findById(courseId);
      if (!course) {
        return res.json({
          status: 404,
          message: "Course not found",
        });
      }

      const existingCourse = await Course.findOne({
        cname,
        _id: { $ne: courseId },
      });
      if (existingCourse) {
        return res.json({
          status: 401,
          message: "Course with the same details already exists",
        });
      }

      course.cname = cname || course.cname;
      course.totalVideo = totalVideo || course.totalVideo;
      course.learn = learn || course.learn;
      course.courseImage = courseImage || course.courseImage;
      course.previewVideofile = previewVideofile || course.previewVideofile;
      course.hours = hours || course.hours;
      course.author = author || course.author;
      course.shortDescription = shortDescription || course.shortDescription;
      course.longDescription = longDescription || course.longDescription;
      course.language = language || course.language;
      course.price = price || course.price;
      course.dprice = dprice || course.dprice;

      if (chapters) {
        course.chapters = chapters.map((chapter, index) => ({
          number: index + 1,
          name: chapter,
        }));
      }

      course.courseGst = courseGst || course.courseGst;
      course.courseType = courseType || course.courseType;
      if (courseType === "percentage") {
        course.percentage = percentage || course.percentage;
        course.startTime = null;
        course.endTime = null;
      } else if (courseType === "timeIntervals") {
        // course.startTime = startTime || course.startTime;
        // course.endTime = endTime || course.endTime;
        course.startTime = startTimeUTC || course.startTime;
        course.endTime = endTimeUTC || course.endTime;
        course.percentage = null;
      }

      if (courseType === "timeIntervals") {
        course.percentage = 0;
      }
      if (courseType === "percentage") {
        course.startTime = null;
        course.endTime = null;
      }
      if (courseType === "allopen") {
        course.percentage = 0;
        course.startTime = null;
        course.endTime = null;
      }

      const updatedCourse = await course.save();
      return res.json({
        status: 200,
        message: "Course updated successfully",
        data: updatedCourse,
      });
    } catch (error) {
      console.error("Error updating course:", error.message);
      return res.json({
        status: 500,
        message: "Failed to update course",
      });
    }
  });
};

const unlinkFile = util.promisify(fs.unlink);
const rmdir = util.promisify(fs.rmdir);
const fsPromises = fs.promises;

const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    course.deleted = true;
    course.deletedAt = new Date();

    await course.save();

    res.json({
      status: 200,
      message: "Course deleted successfully (soft delete)",
      course,
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const courseCheckout = async (req, res) => {
  await Promise.all([
    body("courseId")
      .notEmpty()
      .withMessage("Course ID is required")
      .custom((value) => mongoose.Types.ObjectId.isValid(value))
      .withMessage("Invalid Course ID")
      .run(req),

    body("userId")
      .notEmpty()
      .withMessage("User ID is required")
      .custom((value) => mongoose.Types.ObjectId.isValid(value))
      .withMessage("Invalid User ID")
      .run(req),
  ]);

  const validationErrorObj = validationResult(req);
  if (!validationErrorObj.isEmpty()) {
    return res.status(400).json({
      status: 400,
      message: validationErrorObj.errors[0].msg,
    });
  }

  const { courseId, userId } = req.body;

  try {
    const course = await Course.findById(courseId);
    const user = await userModel.findById(userId);

    if (!course) {
      return res.json({
        status: 404,
        message: "Course not found",
      });
    }

    if (!user) {
      return res.json({
        status: 404,
        message: "User not found",
      });
    }

    if (!course.adminId) {
      return res.json({
        status: 400,
        message: "Course has no adminId assigned",
      });
    }

    const existingEnrollment = await Enrollment.findOne({
      courseId: courseId,
      userId: userId,
    });

    if (existingEnrollment) {
      return res.json({
        status: 400,
        message: "User already enrolled in this course",
      });
    }

    const EnrollCourse = new Enrollment({
      courseId: courseId,
      userId: userId,
      enrolledAt: new Date(),
    });

    await EnrollCourse.save();

    return res.json({
      status: 201,
      message: "Enrollment successful",
      data: EnrollCourse,
    });
  } catch (error) {
    console.error("Server error:", error.message);
    return res.status(500).json({
      status: 500,
      message: "Server error",
      error: error.message,
    });
  }
};

const coursetoggleButton = async (req, res) => {
  console.log(`PATCH request received for course ID: ${req.params.id}`);
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.json({
        status: 404,
        message: "Course not found",
      });
    }
    course.active = !course.active;
    await course.save();
    res.json({
      status: 200,
      course,
    });
  } catch (error) {
    console.error("Error toggling course:", error);
    res.json({
      status: 500,
      message: "Server error",
    });
  }
};

const getdashboard = async (req, res) => {
  try {
    const currentDate = new Date();
    const past30Days = new Date(currentDate);
    past30Days.setDate(currentDate.getDate() - 30);

    const totalCourses = await Course.countDocuments({ active: true });
    const activeCourses = await Course.countDocuments({ active: true });

    const totalVideos = await Video.countDocuments();
    const activeVideos = await Video.countDocuments({ active: true });

    const totalUsers = await userModel.countDocuments();
    const activeUsers = await userModel.countDocuments({ active: true });
    const verifiedUsers = await userModel.countDocuments({
      otp: null,
      verification_token: null,
    });
    const unverifiedUsers = await userModel.countDocuments({
      $or: [{ otp: { $ne: null } }, { verification_token: { $ne: null } }],
    });

    const totalSales = await Enrollment.countDocuments();
    const oneMonthSales = await Purchase.countDocuments({
      transactionDate: { $gte: past30Days },
    });

    res.status(200).json({
      totalCourses,
      activeCourses,
      totalVideos,
      activeVideos,
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      activeUsers,
      totalSales,
      oneMonthSales,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const checkCourseCompletion = async (userId, courseId) => {
  try {
    const videoProgressRecords = await VideoProgress.find({ userId, courseId });

    const allVideosCompleted = videoProgressRecords.every(
      (video) => video.progress === 100
    );

    const totalProgress = videoProgressRecords.reduce(
      (acc, video) => acc + video.progress,
      0
    );
    const percentageCompleted = totalProgress / videoProgressRecords.length;

    if (allVideosCompleted) {
      await Enrollment.updateOne(
        { userId, courseId },
        { percentageCompleted, CompletedCourseStatus: true }
      );

      console.log("Course completed successfully.");
    } else {
      const totalProgress = videoProgressRecords.reduce(
        (acc, video) => acc + video.progress,
        0
      );
      const percentageCompleted = totalProgress / videoProgressRecords.length;

      await Enrollment.updateOne({ userId, courseId }, { percentageCompleted });
    }
  } catch (error) {
    console.error("Error checking course completion:", error);
  }
};

const updateVideoProgress = async (userId, videoId, courseId, progress) => {
  try {
    await VideoProgress.findOneAndUpdate(
      { userId, videoId, courseId },
      {
        progress,
        completed: progress >= 100,
        updatedAt: Date.now(),
      },
      { upsert: true, new: true }
    );

    await checkCourseCompletion(userId, courseId);
  } catch (error) {
    console.error("Error updating video progress:", error);
  }
};

const generateCertificate = async (req, res) => {
  try {
    const { userName, courseId, userId } = req.body;
    console.log("Received userName:", userName);

    if (!userName || !courseId || !userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    console.log("Course Type:", course.courseType);
    let certificateTemplate;
    switch (course.courseType) {
      case "percentage":
        certificateTemplate =
          "http://localhost:8080/public/CERTIFICATE_TYPE1.png";
        break;
      case "timeIntervals":
        certificateTemplate =
          "http://localhost:8080/public/CERTIFICATE_TYPE2.png";
        break;
      default:
        certificateTemplate = "http://localhost:8080/public/CERTIFICATE.png";
    }

    const year = moment().format("YYYY");
    const month = moment().format("MM");
    const count = await Certificate.countDocuments();
    const certificateName = `${course.cname}${userName}`;
    const certificateNumber = `MGPS/${year}/${month}/${String(
      count + 1
    ).padStart(2, "0")}`;
    const sign = "http://localhost:8080/public/Sign.jpg";
    const currentDate = moment().format("MM/DD/YYYY");

    console.log(__dirname);
    console.log(certificateTemplate);
    const html = `
<html>
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Georgia:wght@400&display=swap');
    body {
      font-family: 'Georgia', serif;
      margin: 0;
      padding: 0;
      background-color: #fff;
      color: #000;
    }
    .container {
      position: relative;
      width: 100%;
      height: 850px;
      background-image: url('${certificateTemplate}');
      background-size: contain;
      background-repeat: no-repeat;
    }
   
    .certificate-text {
      position: absolute;
      left: 380px;
      top: 230px;
      width: 700px;
    }
    .user-name {
    font-family: 'Lexend Deca', sans-serif;
      font-size: 25px;
      font-weight: bold;
    }
    .description {
     font-family: 'Montserrat', sans-serif;
      font-size: 14px;
      margin-top: 5px;
    }

    .date {
      position: absolute;
      top: 387px;
      left: 290px;
      font-size: 18px;
    }
   
    .certificate-id {
      position: absolute;
      top: 387px;
      right: 100px;
      font-size: 18px;
    }

     .sign1 {
      position: absolute;
      top: 440px;
      left: 100px;
      width: 100px;
      height: 50px;
    }

    .sign2 {
      position: absolute;
      top: 440px;
      left: 320px;
      width: 100px;
      height: 50px;
    }

    .sign3 {
      position: absolute;
      top: 440px;
      left: 530px;
      width: 100px;
      height: 50px;
    }

    .sign4 {
      position: absolute;
      top: 440px;
      left: 740px;
      width: 100px;
      height: 50px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Dynamic Text Overlay for Username and Description -->
    <div class="certificate-text">
      <p class="user-name">${userName}</p>
      <p class="description">has successfully completed the course "${course.cname}".</p>
      <p class="description">conducted by Majestic Garbhsanskar & Parenting Solution Pvt. Ltd.</p>
    </div>

    <!-- Dynamic Date placed under the Certificate Date line -->
    <p class="date">${currentDate}</p>

    <!-- Dynamic Certificate ID placed under the Certificate ID line -->
    <p class="certificate-id">${certificateNumber}</p>

    <img class="sign1" src="${sign}" alt="Signature" />
    <img class="sign2" src="${sign}" alt="Signature" />
    <img class="sign3" src="${sign}" alt="Signature" />
    <img class="sign4" src="${sign}" alt="Signature" />
  </div>
</body>
</html>
`;

    pdf.create(html).toBuffer(async (err, buffer) => {
      if (err) {
        console.error("Error generating PDF:", err);
        return res.status(500).json({ error: "Error generating PDF" });
      }

      try {
        const newCertificate = new Certificate({
          courseId,
          userId,
          userName,
          courseName: course.cname,
          certificateNumber,
        });

        console.log("Certificate data to be saved:", newCertificate);

        const savedCertificate = await newCertificate.save();

        console.log("Certificate saved:", savedCertificate);

        res.json({
          message: "Certificate generated successfully!",
          certificateUrl: `data:application/pdf;base64,${buffer.toString(
            "base64"
          )}`,
          pdfBase64: buffer.toString("base64"),
          userName,
          courseName: course.cname,
          date: currentDate,
          certificateNumber,
        });
      } catch (saveError) {
        console.error("Error saving certificate to database:", saveError);
        return res
          .status(500)
          .json({ error: "Error saving certificate to database" });
      }
    });
  } catch (error) {
    console.error("Error generating certificate:", error);
    return res.status(500).json({ error: "Error generating certificate" });
  }
};

const getRecommendedCourses = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { userId } = req.body;
    const purchasedCourse = await Course.findById(courseId);

    if (!purchasedCourse) {
      return res.status(404).json({ message: "Course not found" });
    }

    console.log("Purchased Course Details:", purchasedCourse);

    const { courseType, author, language } = purchasedCourse;

    if (!courseType || !author || !language) {
      return res.status(400).json({
        message:
          "Course information incomplete: missing courseType, author, or language",
      });
    }

    console.log("Search Criteria:", { courseType, author, language });

    const userEnrollments = await Enrollment.find({ userId }).select("courseId");
    const purchasedCourseIds = userEnrollments.map((enrollment) => enrollment.courseId.toString());

    console.log("Courses already purchased by the user:", purchasedCourseIds);

    let similarCourses = await Course.find({
      _id: { $ne: purchasedCourse._id, $nin: purchasedCourseIds },
      deleted: false,
      $or: [
        { courseType: courseType },
        { author: author },
        { language: language },
      ],
    }).limit(5);

    console.log("Similar Courses (Full Match):", similarCourses);

    if (!similarCourses.length) {
      console.log("No full match found. Relaxing search criteria...");

      similarCourses = await Course.find({
        _id: { $ne: purchasedCourse._id, $nin: purchasedCourseIds },
        deleted: false,
        $or: [{ courseType: courseType }, { author: author }],
      }).limit(5);

      console.log(
        "Similar Courses (Match by courseType and author):",
        similarCourses
      );

      if (!similarCourses.length) {
        similarCourses = await Course.find({
          _id: { $ne: purchasedCourse._id, $nin: purchasedCourseIds },
          deleted: false,
          courseType: courseType,
        }).limit(5);

        console.log(
          "Similar Courses (Match by courseType only):",
          similarCourses
        );
      }
    }

    if (!similarCourses.length) {
      return res.status(404).json({ message: "No similar courses found" });
    }

    return res.status(200).json(similarCourses);
  } catch (error) {
    console.error("Error fetching recommended courses:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  courseCheckout,
  coursetoggleButton,
  getdashboard,
  updateVideoProgress,
  generateCertificate,
  getRecommendedCourses,
};
