// server.js
const express = require("express");
const path = require("path");
const nodemailer = require("nodemailer");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const { body, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const multer = require("multer");  // 🔥 multer import


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
app.use(bodyParser.json());

// ---- Rate Limit ----
const limiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30 });
app.use("/api/", limiter);

// ---- Nodemailer Transport ----
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465,
  secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

transporter
  .verify()
  .then(() => console.log("✅ SMTP ready"))
  .catch((e) => console.error("❌ SMTP error:", e.message));

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
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    // Turant response
    res.json({ success: true, msg: "Contact form received ✅" });

    // Background email
    try {
      await transporter.sendMail({
        from: `"Credify Contact" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_TO || process.env.EMAIL_USER,
        subject: "New Contact Form Submission [Credify]",
        html: `
          <h2>Contact Form Submission</h2>
          <p><b>Name:</b> ${escapeHtml(req.body.name)}</p>
          <p><b>Email:</b> ${escapeHtml(req.body.email)}</p>
          <p><b>Loan Type:</b> ${escapeHtml(req.body.loanType)}</p>
          <p><b>Message:</b> ${escapeHtml(req.body.message)}</p>
        `,
      });
      console.log("📩 Contact mail sent");
    } catch (err) {
      console.error("❌ Contact mail error:", err.message);
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
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PDF/DOC/DOCX allowed"));
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
      return res.status(400).json({ success: false, error: "Resume required" });
    }

    const { fullName, email, phone, role, experience, message } = req.body;

    try {
      await transporter.sendMail({
        from: `"Credify Careers" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_TO || process.env.EMAIL_USER,
        subject: `New Career Application [${role}] - ${fullName}`,
        html: `
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
        attachments: [
          {
            filename: req.file.originalname,  // 🔥 original filename
            content: req.file.buffer,        // 🔥 file ka content
            contentType: req.file.mimetype,  // 🔥 file ka type (pdf/doc)
          },
        ],
      });

      res.json({ success: true, msg: "Career form submitted with resume ✅" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Email failed" });
    }
  }
);


// ---- Loan Application API ----
app.post("/api/apply", async (req, res) => {
  const { referenceId, loanType, fullName, mobile, email,dob,income,employment,loanAmount,city } = req.body;

  if (!fullName || !mobile || !email || !loanType) {
    return res.status(400).json({ success: false, error: "Missing fields" });
  }

  // Turant response
  res.json({ success: true, msg: "Loan application received ✅" });

  // Background email
  try {
    await transporter.sendMail({
      from: `"${req.body.fullName} via Credify" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO || process.env.EMAIL_USER,
      subject: `New Loan Application - ${referenceId}`,
      html: `
        <h2>Loan Application</h2>
        <p><b>Name:</b> ${escapeHtml(fullName)}</p>
        <p><b>Email:</b> ${escapeHtml(email)}</p>
        <p><b>Loan Type:</b> ${escapeHtml(loanType)}</p>
        <p><b>Full Name:</b> ${fullName}</p>
        <p><b>Mobile:</b> ${mobile}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Date of Birth:</b> ${dob}</p>
        <p><b>Monthly Income:</b> ${income}</p>
        <p><b>Employment:</b> ${employment}</p>
        <p><b>Loan Amount:</b> ₹${loanAmount}</p>
        <p><b>City:</b> ${city}</p>
      `,
    });
    console.log("📩 Loan mail sent");
  } catch (err) {
    console.error("❌ Loan mail error:", err.message);
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
