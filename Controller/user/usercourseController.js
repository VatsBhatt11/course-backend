const mongoose = require("mongoose");
const Course = require("../../Model/courseModel");
const Video = require("../../Model/videoModel");
const userModel = require("../../Model/userModel");
const adminModel = require("../../Model/adminModel");
const VideoProgress = require("../../Model/VideoProgress");
const Enrollment = require("../../Model/enrollmentModel");
const Order = require("../../Model/order_IdModel");
const Purchase = require("../../Model/coursePurchaseModel");
const upload = require("../../middleware/upload");
const path = require("path");
const fs = require("fs");
const { body, validationResult } = require("express-validator");
const util = require("util");
const jwt = require("jsonwebtoken");

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

    // if (deleted) {
    //   query.deleted = deleted === "flse";
    // }

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

    // Find all courses that match the query
    const courses = await Course.find(query).sort({ [sortBy]: sortOrder });
    
    // Filter courses to only include those that have videos or documents
    const coursesWithMedia = await Promise.all(
      courses.map(async (course) => {
        const videoExists = await Video.exists({
          courseId: course._id,
          $or: [{ type: "video" }, { type: "document" }],
        });
        
        // Only include the course if videos or documents exist
        if (videoExists) {
          return course;
        }
        return null; // Filter out courses without media
      })
    );
    
    // Filter out null values
    const filteredCourses = coursesWithMedia.filter((course) => course !== null);
    
    const totalCourses = filteredCourses.length;

    // Apply pagination
    const paginatedCourses = filteredCourses.slice((page - 1) * limit, page * limit);
    
    if (userId && userId !== "null") {
      const enrollments = await Enrollment.find({ userId });
      const enrolledCourseIds = enrollments.map((enrollment) =>
        enrollment.courseId.toString()
    );
    
    // const coursesWithEnrollmentStatus = paginatedCourses.map((course) => ({
      //   _id: course._id,
      //   cname: course.cname,
      //   totalVideo: course.totalVideo,
      //   courseImage: course.courseImage,
      //   previewVideofile: course.previewVideofile,
      //   shortDescription: course.shortDescription,
      //   hours: course.hours,
      //   language: course.language,
      //   author: course.author,
      //   price: course.price,
      //   dprice: course.dprice,
      //   isEnrolled: enrolledCourseIds.includes(course._id.toString()),
      // }));
      
      const coursesWithEnrollmentStatus = await Promise.all(
        paginatedCourses.map(async (course) => {
          const totalResources = await Video.countDocuments({ courseId: course._id }); 
          // Fetch user's progress for the course
          const userProgress = await VideoProgress.find({ userId, courseId: course._id });
          // Count the number of completed resources
          const completedResources = userProgress.filter(vp => vp.completed).length;
          // Calculate the completion percentage
          const completionPercentage = (completedResources / totalResources) * 100;
          // Determine if the course is completed based on the required percentage
          const hasCompleted = completionPercentage >= course.percentage;
          
          const purchase = await Purchase.findOne({ userId, courseId: course._id });
         const active = purchase ? purchase.active : false;

          return {
            _id: course._id,
            cname: course.cname,
            totalVideo: course.totalVideo,
            courseImage: course.courseImage,
            previewVideofile: course.previewVideofile,
            shortDescription: course.shortDescription,
            hours: course.hours,
            language: course.language,
            author: course.author,
            price: course.price,
            dprice: course.dprice,
            isEnrolled: enrolledCourseIds.includes(course._id.toString()),
            active: active,
            hasCompleted: hasCompleted,
          };
        })
      );

      return res.json({
        courses: coursesWithEnrollmentStatus,
        page: parseInt(page),
        pageCount,
        totalCourses,
      });
    }

    res.json({
      courses: paginatedCourses,
      totalCourses,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({
      message: error.message,
    });
  }
};

const getAllVideos = async (req, res) => {
  try {
    const {
      search,
      page,
      limit,
      sortBy = "order",
      order = "asc",
      courseId,
      author,
      active,
    } = req.query;

    const query = {};

    if (active) {
      query.active = active === "true";
    }

    let courseIds = [];

    if (search) {
      const regex = new RegExp(search, "i");

      query["$or"] = [{ title: regex }];

      const courses = await Course.find({ cname: regex }, "_id");

      if (courses.length) {
        courseIds = courses.map((course) => course._id);
        query["$or"].push({ courseId: { $in: courseIds } });
      }
      if (author) {
        query.author = new RegExp(author, "i");
      }
      if (courseId) {
        query.courseId = courseId;
      }
    }

    const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;

    const totalVideo = await Video.countDocuments(query);

    const videos = await Video.find(query)
      .sort({ courseId: 1, [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("courseId", "cname")
      .populate("adminId", "name")
      .populate("updatedBy", "name");

    res.json({
      status: 200,
      videos,
      totalVideo,
    });
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.json({
      status: 500,
      error: "Failed to fetch videos",
    });
  }
};

module.exports = {
  getAllCourses,
  getAllVideos,
};
