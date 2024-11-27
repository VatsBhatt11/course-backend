const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const adminModel = require("./Model/adminModel");
const userModel = require("./Model/userModel");
const CoursePurchase = require("./Model/coursePurchaseModel");
const path = require("path");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY;
const { generateInvoicePDF } = require('./Controller/user/invoiceController');

const adminRoutes = require("./route/adminRoutes");
const userRoutes = require("./route/userRoutes");

const app = express();
const PORT = process.env.PORT;
const dbString = process.env.DB_STRING;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/generate-invoice-pdf', generateInvoicePDF);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(cors());
app.use(cors({
  // origin: "http://192.168.1.11:3000",
  origin: "http://localhost:3000",
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}));

mongoose
  .connect(dbString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`Server started at port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

app.use("/admin", adminRoutes);
app.use("/user", userRoutes);

app.use("/public", express.static(path.join(__dirname, "public")));
app.use('/public', express.static(path.join(__dirname, '../../public')));


app.get("/getAdminById", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.json({
      status: 401,
      error: "Authorization token required",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decodedToken = jwt.verify(token, SECRET_KEY);
    const adminId = decodedToken.id;

    const admin = await adminModel.findById(adminId);
    if (!admin) {
      return res.json({
        status: 404,
        error: "Admin not found",
      });
    }
    const profileImagePath = admin.profileImage
      ? path.join("/public/profile_images", admin.profileImage)
      : null;

    res.json({
      ...admin.toObject(),
      profileImage: profileImagePath,
    });
  } catch (err) {
    console.error("Error finding admin:", err);
    res.json({
      status: 500,
      error: "Server error",
    });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.send(
    {
      status: 500,
    },
    "Something broke!"
  );
});
