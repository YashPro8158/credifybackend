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

dotenv.config();
const app = express();
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

// ---- Career API (without resume) ----
app.post(
  "/api/career",
  [
    body("fullName").trim().isLength({ min: 2 }),
    body("email").isEmail(),
    body("phone").isLength({ min: 7 }),
    body("role").notEmpty(),
    body("experience").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    // Turant response
    res.json({ success: true, msg: "Career form received ✅" });

    // Background email
    try {
      await transporter.sendMail({
        from: `"Credify Careers" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_TO || process.env.EMAIL_USER,
        subject: `New Career Application [${req.body.role}]`,
        html: `
          <h2>Career Application</h2>
          <p><b>Name:</b> ${escapeHtml(req.body.fullName)}</p>
          <p><b>Email:</b> ${escapeHtml(req.body.email)}</p>
          <p><b>Phone:</b> ${escapeHtml(req.body.phone)}</p>
          <p><b>Role:</b> ${escapeHtml(req.body.role)}</p>
          <p><b>Experience:</b> ${escapeHtml(req.body.experience)}</p>
          ${req.body.message ? `<p><b>Message:</b> ${escapeHtml(req.body.message)}</p>` : ""}
        `,
      });
      console.log("📩 Career mail sent");
    } catch (err) {
      console.error("❌ Career mail error:", err.message);
    }
  }
);

// ---- Loan Application API ----
app.post("/api/apply", async (req, res) => {
  const { referenceId, loanType, fullName, mobile, email } = req.body;

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
