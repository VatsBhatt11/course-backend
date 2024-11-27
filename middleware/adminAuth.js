const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY;

const auth = (req, res, next) => {
  try {
    let token = req.headers.authorization;
    if (token) {
      token = token.split(" ")[1];
      let admin = jwt.verify(token, SECRET_KEY);
      req.adminId = admin.id;
      next();
    } else {
      return res.json({
        status: 401,
        message: "Unauthorized Admin",
      });
    }
  } catch (error) {
    console.log(error);
    res.json({
      status: 401,
      message: "Unauthorized Admin",
    });
  }
};

module.exports = auth;
