const Course = require("../../Model/courseModel");
const Video = require("../../Model/videoModel");
const Enrollment = require("../../Model/enrollmentModel");
const User = require("../../Model/userModel");
const userModel = require("../../Model/userModel");
const VideoProgress = require("../../Model/VideoProgress");
const CoursePurchase = require("../../Model/coursePurchaseModel");
const Purchase = require("../../Model/coursePurchaseModel");

const getPurchasedCourseDetails = async (req, res) => {
  try {
    const { courseId, userId } = req.params;

    const enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment) {
      return res
        .status(403)
        .json({ message: "You are not enrolled in this course." });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!userId) {
      return res.status(400).json({ message: "User ID are required." });
    }

    if (!courseId) {
      return res.status(400).json({ message: "Course ID are required." });
    }

    const videos = await Video.find({ courseId });

    if (videos.length === 0) {
      return res
        .status(404)
        .json({ message: "No resources available for this course." });
    }

    const videoProgressData = await VideoProgress.find({ userId, courseId });

    const coursePurchase = await CoursePurchase.findOne({ courseId, userId });

    if (userId && userId !== "null") {
      const enrollments = await Enrollment.find({ userId });
      const enrolledCourseIds = enrollments.map((enrollment) =>
        enrollment.courseId.toString()
    );

    const purchase = await Purchase.findOne({ userId, courseId: course._id });
         const active = purchase ? purchase.active : false;

    const courseDetails = {
      courseId: course._id,
      currentTime: new Date().toISOString(),
      cname: course.cname,
      description: course.shortDescription,
      longDescription: course.longDescription,
      courseImage: course.courseImage,
      previewVideofile: course.previewVideofile,
      learn: course.learn,
      hours: course.hours,
      author: course.author,
      totalVideo: course.totalVideo,
      language: course.language,
      price: course.price,
      dprice: course.dprice,
      courseType: course.courseType,
      percentage: course.percentage,
      startTime: course.startTime,
      endTime: course.endTime,
      transactionDate: coursePurchase ? coursePurchase.transactionDate : null,
      isEnrolled: enrolledCourseIds.includes(course._id.toString()),
            active: active,
      chapters: course.chapters.map((chapter) => ({
        chapterName: chapter.name,
        resources: videos
          .filter((video) => video.chapter === chapter.name)
          .map((video) => {
            const videoProgress = videoProgressData.find((progress) =>
              progress.videoId.equals(video._id)
            );
            return {
              videoId: video._id,
              title: video.title,
              description: video.description,
              demo: video.demo,
              demoVideofile: video.demoVideofile,
              thumbnail: video.thumbnail,
              videofile: video.videofile,
              fileType: video.fileType,
              videoURL: video.videoURL,
              pdf: video.pdf,
              ppt: video.ppt,
              doc: video.doc,
              tags: video.tags,
              type: video.type,
              progress: videoProgress ? videoProgress.progress : 0,
              completed: videoProgress ? videoProgress.completed : false,
            };
          }),
      })),
    };

    res.json({
      status: 200,
      courseDetails,
    });
  }
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

const getCourseDetails = async (req, res) => {
  try {
    const { courseId, userId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    if (!courseId) {
      return res.status(400).json({ message: "Course ID are required." });
    }

    const videos = await Video.find({ courseId });

    if (videos.length === 0) {
      return res
        .status(404)
        .json({ message: "No resources available for this course." });
    }

    // const videoProgressData = await VideoProgress.find({ userId, courseId });

    // const coursePurchase = await CoursePurchase.findOne({ courseId, userId });
    let enrolledCourseIds;
    if (userId && userId !== "null") {
      const enrollments = await Enrollment.find({ userId });
      enrolledCourseIds = enrollments.map((enrollment) =>
        enrollment.courseId.toString()
      );
    }

    const courseDetails = {
      courseId: course._id,
      cname: course.cname,
      description: course.shortDescription,
      longDescription: course.longDescription,
      courseImage: course.courseImage,
      previewVideofile: course.previewVideofile,
      learn: course.learn,
      hours: course.hours,
      author: course.author,
      totalVideo: course.totalVideo,
      language: course.language,
      price: course.price,
      dprice: course.dprice,
      courseType: course.courseType,
      percentage: course.percentage,
      startTime: course.startTime,
      endTime: course.endTime,
      isEnrolled:enrolledCourseIds? enrolledCourseIds.includes(course._id.toString()):false,
      // transactionDate: coursePurchase ? coursePurchase.transactionDate : null,
      chapters: course.chapters.map((chapter) => ({
        chapterName: chapter.name,
        resources: videos
          .filter((video) => video.chapter === chapter.name)
          .map((video) => {
            // const videoProgress = videoProgressData.find((progress) =>
            //   progress.videoId.equals(video._id)
            // );
            return {
              videoId: video._id,
              title: video.title,
              description: video.description,
              demo: video.demo,
              demoVideofile: video.demoVideofile,
              thumbnail: video.thumbnail,
              videofile: video.videofile,
              videoURL: video.videoURL,
              pdf: video.pdf,
              ppt: video.ppt,
              doc: video.doc,
              tags: video.tags,
              type: video.type,
              // progress: videoProgress ? videoProgress.progress : 0,
              // completed: videoProgress ? videoProgress.completed : false,
            };
          }),
      })),
      };

    res.json({
      status: 200,
      courseDetails,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

module.exports = {
  getPurchasedCourseDetails,
  getCourseDetails,
};
