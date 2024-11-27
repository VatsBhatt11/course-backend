const { string } = require("joi");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const courseSchema = new Schema(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    cname: {
      type: String,
      valiDate: {
        validator: function (v) {
          return /^[a-zA-Z0-9\s]+$/.test(v);
        },
        message: (props) =>
          `${props.value} contains special characters, which are not allowed!`,
      },
    },
    totalVideo: {
      type: Number,
    },
    courseImage: {
      type: String,
    },
    previewVideofile: {
      type: String,
    },
    learn: {
      type: String,
    },
    hours: {
      type: String,
      required: true, // if the field is mandatory
      validate: {
        validator: function(v) {
          // Regex to validate HH:mm format (24-hour format)
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: props => `${props.value} is not a valid time format!`
      }
    },
    
    author: {
      type: String,
      valiDate: {
        validator: function (v) {
          return /^[a-zA-Z0-9\s]+$/.test(v);
        },
        message: (props) =>
          `${props.value} contains special characters, which are not allowed!`,
      },
    },
    shortDescription: {
      type: String,
    },
    longDescription: {
      type: String,
    },
    language: {
      type: String,
    },
    price: {
      type: String,
    },
    dprice: {
      type: String,
    },
    courseGst: {
      type: Number,
    },
    courseType: {
      type: String,
    },
    percentage: {
      type: Number,
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    active: {
      type: Boolean,
      default: true,
    },
    chapters: [
      {
        number: {
          type: Number,
        },
        name: {
          type: String,
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: String,
      ref: "Admin",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    deleted: {
      type: Boolean,
      default: false, // 0 means course is not deleted, 1 means course is deleted
    },
    deletedAt: {
      type: Date,
      default: null, // If null, course is not deleted
    },
    sequence: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Course = mongoose.model("CourseList", courseSchema);

module.exports = Course;
