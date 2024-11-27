const multer = require("multer");
const path = require("path");
const fs = require("fs");

const VIDEO_SIZE_LIMIT = 1000 * 1024 * 1024; // 1 GB
const THUMBNAIL_SIZE_LIMIT = 500 * 1024 * 1024; // 500 MB

const PDF_SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB
const PPT_SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB
const DOC_SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB

const PROFILE_IMAGE_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB
const COURSE_IMAGE_SIZE_LIMIT = 500 * 1024 * 1024; // 500 MB
const PREVIEW_VIDEO_SIZE_LIMIT = 1000 * 1024 * 1024; // 1 GB

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/videos");
  },
  filename: (req, file, cb) => {
    cb(null, "video_" + Date.now() + path.extname(file.originalname));
  },
});

const thumbnailStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/thumbnails");
  },
  filename: (req, file, cb) => {
    cb(null, "thumbnail_" + Date.now() + path.extname(file.originalname));
  },
});

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/pdf");
  },
  filename: (req, file, cb) => {
    cb(null, "pdf_" + Date.now() + path.extname(file.originalname));
  },
});

const pptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/ppt");
  },
  filename: (req, file, cb) => {
    cb(null, "ppt_" + Date.now() + path.extname(file.originalname));
  },
});

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/document");
  },
  filename: (req, file, cb) => {
    cb(null, "doc_" + Date.now() + path.extname(file.originalname));
  },
});

const profileImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/profile_images");
  },
  filename: (req, file, cb) => {
    cb(null, "profileImage_" + Date.now() + path.extname(file.originalname));
  },
});

const courseImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/course_images");
  },
  filename: (req, file, cb) => {
    cb(null, "courseImage_" + Date.now() + path.extname(file.originalname));
  },
});

const previewVideoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/previewVideos");
  },
  filename: (req, file, cb) => {
    cb(null, "previewVideos_" + Date.now() + path.extname(file.originalname));
  },
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { type, courseId, chapter } = req.body;

    if (file.fieldname === "profileImage") {
      const folderPath = path.join("public/profile_images");
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      return cb(null, folderPath);
    } else if (file.fieldname === "courseImage") {
      const folderPath = path.join("public/course_images");
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      return cb(null, folderPath);
    } else if (file.fieldname === "previewVideofile") {
      const folderPath = path.join("public/previewVideos");
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      return cb(null, folderPath);
    }

    if (!courseId || !chapter) {
      return cb(new Error("Course ID and Chapter are required"), false);
    }

    let folderPath = "";

    if (type === "video") {
      if (file.fieldname === "videofile") {
        folderPath = path.join("public/videos", courseId, chapter);
      } else if (file.fieldname === "thumbnail") {
        folderPath = path.join("public/thumbnails", courseId, chapter);
      } else if (file.fieldname === "previewVideofile") {
        folderPath = path.join("public/previewVideos", courseId, chapter);
      } else {
        return cb(new Error("Invalid field name for video"), false);
      }
    } else if (type === "document") {
      if (file.fieldname === "pdf") {
        folderPath = path.join("public/pdf", courseId, chapter);
      } else if (file.fieldname === "doc") {
        folderPath = path.join("public/document", courseId, chapter);
      } else if (file.fieldname === "ppt") {
        folderPath = path.join("public/ppt", courseId, chapter);
      } else {
        return cb(new Error("Invalid field name for document"), false);
      }
    } else {
      return cb(new Error("Invalid field name"), false);
    }

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.originalname}`);
  },
});

const limits = {
  fileSize: (req, file, cb) => {
    const type = req.body;

    if (type === "video") {
      if (file.fieldname === "videofile") {
        cb(null, VIDEO_SIZE_LIMIT);
      } else if (file.fieldname === "thumbnail") {
        cb(null, THUMBNAIL_SIZE_LIMIT);
      } else if (file.fieldname === "previewVideofile") {
        cb(null, PREVIEW_VIDEO_SIZE_LIMIT);
      } else {
        cb(new Error("Invalid file field for video"), false);
      }
    } else if (type === "document") {
      if (file.fieldname === "pdf") {
        cb(null, PDF_SIZE_LIMIT);
      } else if (file.fieldname === "doc") {
        cb(null, DOC_SIZE_LIMIT);
      } else if (file.fieldname === "ppt") {
        cb(null, PPT_SIZE_LIMIT);
      } else {
        cb(new Error("Invalid file field for document"), false);
      }
    } else if (file.fieldname === "profileImage") {
      cb(null, PROFILE_IMAGE_SIZE_LIMIT);
    } else if (file.fieldname === "courseImage") {
      cb(null, COURSE_IMAGE_SIZE_LIMIT);
    } else if (file.fieldname === "previewVideofile") {
      cb(null, PREVIEW_VIDEO_SIZE_LIMIT);
    } else {
      cb(new Error("Invalid field name"), false);
    }
  },
};

const fileFilter = (req, file, cb) => {
  console.log("start");
  const type = req.body.type;
  console.log("type: ", type);
  console.log("video file field name: ", file.fieldname);
  if (type === "video") {
    console.log("1");
    if (file.fieldname === "videofile" && file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else if (
      (console.log("2"),
      file.fieldname === "thumbnail" && file.mimetype.startsWith("image/"))
    ) {
      cb(null, true);
    } else if (
      // console.log("2"),
      file.fieldname === "previewVideofile" &&
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type for video"), false);
    }
  } else if (type === "document") {
    console.log("3");
    if (file.fieldname === "pdf" && file.mimetype === "application/pdf") {
      cb(null, true);
    } else if (
      (console.log("4"),
      file.fieldname === "doc" && file.mimetype === "application/msword")
    ) {
      cb(null, true);
    } else if (
      (console.log("5"),
      file.fieldname === "ppt" &&
        file.mimetype ===
          "application/vnd.openxmlformats-officedocument.presentationml.presentation")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type for document"), false);
    }
  } else if (
    (console.log("6"),
    file.fieldname === "profileImage" && file.mimetype.startsWith("image/"))
  ) {
    cb(null, true);
  } else if (
    (console.log("7"),
    file.fieldname === "courseImage" && file.mimetype.startsWith("image/"))
  ) {
    cb(null, true);
  } else if (
    (console.log("8"),
    file.fieldname === "previewVideofile" && file.mimetype.startsWith("video/"))
  ) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};

const upload = multer({ storage, limits, fileFilter }).fields([
  { name: "videofile", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
  { name: "pdf", maxCount: 1 },
  { name: "ppt", maxCount: 1 },
  { name: "doc", maxCount: 1 },
  { name: "profileImage", maxCount: 1 },
  { name: "courseImage", maxCount: 1 },
  { name: "previewVideofile", maxCount: 1 },
]);

module.exports = upload;
