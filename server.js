// server.js
const multer = require("multer");  // 🔥 multer import
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const express = require("express");
const path = require("path");
const nodemailer = require("nodemailer");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");


dotenv.config();
const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

// ---- Serve static frontend ----
app.use(express.static(path.join(__dirname, "public")));

// ---- Security / Utils ----
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
);
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ---- Rate Limit ----
const limiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30 });
app.use("/api/", limiter);


// ---- Contact API ----
app.post(
  "/api/contact",
  [
    body("name").trim().isLength({ min: 2 }),
    body("email").isEmail(),
    body("loanType").notEmpty(),
    body("message").isLength({ min: 5 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
  await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    "accept": "application/json",
    "api-key": process.env.BREVO_API_KEY,   // Railway pe set karo
    "content-type": "application/json",
  },
  body: JSON.stringify({
    sender: { name: "Credify Contact", email: process.env.EMAIL_USER },
    to: [{ email: process.env.EMAIL_TO || process.env.EMAIL_USER }],
    subject: "New Contact Form Submission [Credify]",
    htmlContent: `
      <h2>Contact Form Submission</h2>
      <p><b>Name:</b> ${escapeHtml(req.body.name)}</p>
      <p><b>Email:</b> ${escapeHtml(req.body.email)}</p>
      <p><b>Loan Type:</b> ${escapeHtml(req.body.loanType)}</p>
      <p><b>Message:</b> ${escapeHtml(req.body.message)}</p>
    `,
  }),
});

      res.json({ success: true, msg: "Contact form submitted ✅" });
    } catch (err) {
      console.error("❌ Contact mail error:", err.message);
      res.status(500).json({ success: false, error: "Email failed" });
    }
  }
);
// ---- File upload (resume)
const upload = multer({
  storage: multer.memoryStorage(), // file memory me store hogi
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF allowed"));
  },
});
// Career form
app.post(
  "/api/career",
  upload.single("resume"),   // 🔥 yaha file upload enable hai
  [
    body("fullName").trim().isLength({ min: 2 }).withMessage("Full name required"),
    body("email").isEmail().withMessage("Valid email required"),
    body("phone").trim().isLength({ min: 7 }).withMessage("Phone required"),
    body("role").trim().notEmpty().withMessage("Role required"),
    body("experience").trim().notEmpty().withMessage("Experience required"),
    body("message").optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    if (!req.file) {
      console.log("Received file:", req.file);
      return res.status(400).json({ success: false, error: "Resume required" });
    }

    const { fullName, email, phone, role, experience, message,} = req.body;

    try {
     await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    "accept": "application/json",
    "api-key": process.env.BREVO_API_KEY,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    sender: { name: "Credify Careers", email: process.env.EMAIL_USER },
    to: [{ email: process.env.EMAIL_TO || process.env.EMAIL_USER }],
    subject: `New Career Application [${role}] - ${fullName}`,
    htmlContent: `
      <h2>Career Application</h2>
      <p><b>Name:</b> ${escapeHtml(fullName)}</p>
      <p><b>Email:</b> ${escapeHtml(email)}</p>
      <p><b>Phone:</b> ${escapeHtml(phone)}</p>
      <p><b>Role:</b> ${escapeHtml(role)}</p>
      <p><b>Experience:</b> ${escapeHtml(experience)}</p>
      ${
        message
          ? `<p><b>Message:</b><br>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`
          : ""
      }
    `,
    attachment: [
      {
     content: req.file.buffer.toString("base64").replace(/(\r\n|\n|\r)/gm, ""), // ✅ buffer → base64
     name: req.file.originalname, // ✅ filename
      contentType: req.file.mimetype
      },
    ],
  }),
});

      // ✅ Success response after mail is sent
      res.json({ success: true, msg: "Career form submitted with resume ✅" });
    } catch (err) {
      console.error("❌ Career mail error:", err.message);
      res.status(500).json({ success: false, error: "Email failed" });
    }
  }
);




// ---- Loan Application API ----
app.post("/api/apply", async (req, res) => {
  const {
    referenceId,
    loanType,
    fullName,
    mobile,
    email,
    dob,
    income,
    employment,
    loanAmount,
    city,
  } = req.body;

  if (!fullName || !mobile || !email || !loanType) {
    return res.status(400).json({ success: false, error: "Missing fields" });
  }

  try {
   await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    "accept": "application/json",
    "api-key": process.env.BREVO_API_KEY,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    sender: { name: `${fullName} via Credify`, email: process.env.EMAIL_USER },
    to: [{ email: process.env.EMAIL_TO || process.env.EMAIL_USER }],
    subject: `New Loan Application - ${referenceId}`,
    htmlContent: `
      <h2>Loan Application</h2>
      <p><b>Name:</b> ${escapeHtml(fullName)}</p>
      <p><b>Email:</b> ${escapeHtml(email)}</p>
      <p><b>Loan Type:</b> ${escapeHtml(loanType)}</p>
      <p><b>Full Name:</b> ${fullName}</p>
      <p><b>Mobile:</b> ${mobile}</p>
      <p><b>Date of Birth:</b> ${dob}</p>
      <p><b>Monthly Income:</b> ${income}</p>
      <p><b>Employment:</b> ${employment}</p>
      <p><b>Loan Amount:</b> ₹${loanAmount}</p>
      <p><b>City:</b> ${city}</p>
    `,
  }),
});

    // ✅ Success response after mail is sent
    res.json({ success: true, msg: "Loan application submitted ✅" });
  } catch (err) {
    console.error("❌ Loan mail error:", err.message);
    res.status(500).json({ success: false, error: "Email failed" });
  }
});


// ---- Default route ----
app.get("/", (_, res) => res.send("Credify backend is live ✅"));

// ---- Start server ----
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));

// ---- Escape utility ----
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
"
