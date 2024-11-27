const bcrypt = require("bcrypt");
const userModel = require("../../Model/userModel");
const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY;
const { ObjectId } = require("mongodb");
const { body, validationResult } = require("express-validator");

const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

function generateOtpVerificationToken() {
  const objectId = new ObjectId();
  const hexString = objectId.toHexString();
  const uniqueString = hexString.padEnd(32, "0").substring(0, 32);
  return uniqueString;
}

const generateToken = (userDetail) => {
  const payload = {
    id: userDetail._id,
    phoneNumber: userDetail.phoneNumber,
  };

  const token = jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: "24h" });
  return token;
};

const login = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        status: 400,
        message: "Phone Number is required",
      });
    }

    if (!/^\d+$/.test(phoneNumber)) {
      return res.status(400).json({
        status: 400,
        message: "Please enter digits only.",
      });
    }

    if (phoneNumber.length < 7 || phoneNumber.length > 14) {
      return res.status(400).json({
        status: 400,
        message: "Phone number must be between 7 and 14 digits.",
      });
    }

    let userDetail = await userModel.findOne({ phoneNumber });

    if (!userDetail) {
      userDetail = new userModel({
        phoneNumber,
        login_expire_time: new Date(),
        otp: null,
        otp_expire_time: null,
        verification_token: null,
        last_Browser_finger_print: null,
      });

      await userDetail.save();
    }

    const currentDate = new Date();
    const browserFingerPrint =
      req.headers["user-agent"] + req.connection.remoteAddress;

    if (
      currentDate > userDetail.login_expire_time ||
      browserFingerPrint !== userDetail.last_Browser_finger_print ||
      userDetail.isVerified === false
    ) {
      userDetail.otp = generateOTP();
      userDetail.otp_expire_time = new Date(currentDate.getTime() + 5 * 60000);
      userDetail.verification_token = generateOtpVerificationToken();
      userDetail.login_expire_time = new Date(
        currentDate.getTime() + 24 * 60 * 60 * 1000
      );
      userDetail.last_Browser_finger_print = browserFingerPrint;
      userDetail.isVerified = false;
      // Send OTP to user via SMS
      /*var otpParams = {
        phoneNumber: userDetail.phoneNumber,
        project_name: "course",
        message_type: "send_opt",
        variable: {
          "#var1": userDetail.otp,
        },
      };
      var otpResponse = await sendOTPObj.sendMobileOTP(otpParams);
      if (otpResponse.data.status !== 200) {
        return res.json({
          status: 401,
          message: 'Send OTP issue. Please try again later.'
        });
      }*/

      await userDetail.save();

      return res.status(200).json({
        status: 200,
        message: "OTP has been sent to your phone number",
        data: {
          verification_token: userDetail.verification_token,
          is_otp_required: true,
        },
      });
    } else {
      console.log("userDetailLogin: ", userDetail);
      const token = generateToken(userDetail);
      console.log("tokenLogin: ", token);
      userDetail.token = token;
      userDetail.login_expire_time = new Date(
        currentDate.getTime() + 24 * 60 * 60 * 1000
      );

      await userDetail.save();

      return res.status(200).json({
        status: 201,
        message: "Login successful",
        data: {
          id: userDetail._id,
          phoneNumber: userDetail.phoneNumber,
          token: token,
        },
      });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      status: 500,
      message: "Something went wrong. Please try again later.",
    });
  }
};

const verifyOTP = async (req, res) => {
  try {
    await Promise.all([
      body("otp").notEmpty().withMessage("OTP is required").run(req),
      body("verification_token")
        .notEmpty()
        .withMessage("Verification token is required")
        .run(req),
    ]);

    const validationErrorObj = validationResult(req);
    if (!validationErrorObj.isEmpty()) {
      return res.status(400).json({
        status: 400,
        message: validationErrorObj.errors[0].msg,
      });
    }

    const { otp, verification_token } = req.body;

    const userDetail = await userModel.findOne({ verification_token });

    if (!userDetail) {
      return res.status(400).json({
        status: 400,
        message: "Invalid verification token",
      });
    }

    const currentDate = new Date();

    if (userDetail.otp !== otp) {
      return res.status(400).json({
        status: 400,
        message: "Invalid OTP",
      });
    }

    if (
      userDetail.otp_expire_time &&
      currentDate > userDetail.otp_expire_time
    ) {
      return res.status(400).json({
        status: 400,
        message: "OTP has expired",
      });
    }
    console.log("userDetailOtp: ", userDetail);
    const token = generateToken(userDetail);
    console.log("Otptoken: ", token);
    userDetail.token = token;
    userDetail.otp = null;
    userDetail.verification_token = null;
    userDetail.otp_expire_time = null;
    userDetail.last_Browser_finger_print =
      req.headers["user-agent"] + req.connection.remoteAddress;
    userDetail.login_expire_time = new Date(
      currentDate.getTime() + 24 * 60 * 60 * 1000
    );
    userDetail.isVerified = true;

    await userDetail.save();

    return res.status(200).json({
      status: 200,
      message: "OTP verified successfully",
      data: {
        id: userDetail._id,
        token: token,
      },
    });
  } catch (error) {
    console.error("OTP Verification error:", error);
    return res.status(500).json({
      status: 500,
      message: "Something went wrong. Please try again later.",
    });
  }
};

const getAllUser = async (req, res) => {
  try {
    const {
      search,
      page,
      limit,
      sortBy = "createdAt",
      order = "desc",
      active,
    } = req.query;

    const query = {};

    if (active) {
      query.active = active === "true";
    }

    if (search) {
      const regex = new RegExp(search, "i");

      const searchNumber = !isNaN(search) ? Number(search) : null;

      query["$or"] = [
        { name: regex },
        { email: regex },
        ...(searchNumber !== null ? [{ phoneNumber: searchNumber }] : []),
      ];
    }

    const totalUser = await userModel.countDocuments(query);

    const users = await userModel
      .find(query)
      .sort({ [sortBy]: order === "asc" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      users,
      totalUser,
    });
  } catch (error) {
    res.json({
      status: 500,
      message: error.message,
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decodedToken.id;

    const userDetail = await userModel.findById(userId);
    if (!userDetail) {
      return res.json({
        status: 404,
        message: "User not found",
      });
    }

    res.json({
      status: 200,
      data: {
        id: userDetail._id,
        phoneNumber: userDetail.phoneNumber,
        token: token,
      },
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.json({
      status: 500,
      message: "An error occurred while fetching user details.",
    });
  }
};

module.exports = {
  login,
  verifyOTP,
  getAllUser,
  getUserById,
};
