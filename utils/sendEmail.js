// utils/sendEmail.js
import nodemailer from "nodemailer";
import { Resend } from "resend";

const {
  RESEND_API_KEY,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  EMAIL_FROM,
} = process.env;

// -------------------------------
// ⭐ Primary Transport: RESEND API
// -------------------------------
let resendClient = null;

if (RESEND_API_KEY) {
  try {
    resendClient = new Resend(RESEND_API_KEY);
    console.log("📧 Email: Using Resend API");
  } catch (err) {
    console.error("❌ Failed to initialize Resend:", err?.message || err);
  }
} else {
  console.log("ℹ️ RESEND_API_KEY not set — skipping Resend");
}

// -------------------------------
// ⭐ Fallback Transport: SMTP
// -------------------------------
let smtpTransporter = null;

if (!resendClient) {
  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    smtpTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 465),
      secure: Number(SMTP_PORT) === 465 || SMTP_SECURE === "true",
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      tls: { rejectUnauthorized: false },
      logger: true,
      debug: true,
    });

    smtpTransporter
      .verify()
      .then(() => console.log("📧 SMTP Ready"))
      .catch((err) =>
        console.error("❌ SMTP verify failed:", err?.message || err)
      );
  } else {
    console.warn("⚠️ SMTP not configured — only Resend will be used");
  }
}

// --------------------------------------
// ⭐ Unified email sender: sendEmail()
// --------------------------------------
const sendEmail = async (to, subject, html) => {
  const fromAddr = EMAIL_FROM || SMTP_USER || "no-reply@example.com";

  // -----------------------
  // 1️⃣ Try RESEND (primary)
  // -----------------------
  if (resendClient) {
    try {
      const resp = await resendClient.emails.send({
        from: fromAddr,
        to,
        subject,
        html,
      });

      console.log(`📧 Resend: email sent to ${to}`, resp);
      return resp;
    } catch (err) {
      console.error("❌ Resend send error:", err?.message || err);
      // continue to SMTP fallback
    }
  }

  // -----------------------
  // 2️⃣ SMTP Fallback
  // -----------------------
  if (smtpTransporter) {
    try {
      const info = await smtpTransporter.sendMail({
        from: fromAddr,
        to,
        subject,
        html,
      });
      console.log(`📧 SMTP: email sent to ${to}`, info?.messageId || "sent");
      return info;
    } catch (err) {
      console.error("❌ SMTP send error:", err?.message || err);
    }
  }

  console.warn("⚠️ No email method available — email not sent.");
  return null;
};

export default sendEmail;
export { sendEmail };
