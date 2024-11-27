const mongoose = require("mongoose");
const Course = require("../../Model/courseModel");

const payment = async (req, res) => {

    const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
};

module.exports = {
  payment,
};
