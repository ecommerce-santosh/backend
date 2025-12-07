import nodemailer from "nodemailer";

const sendEmail = async (to, subject, html) => {
  try {
    // ✅ Create Transporter
    const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_PORT === "465" || process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  tls: { rejectUnauthorized: false },
  logger: true, debug: true,
});

(async () => {
  try {
    await transporter.verify();
    console.log("SMTP verify OK");
  } catch (err) {
    console.error("SMTP verify failed:", err.code, err.message);
    console.error(err);
  }
})();

    // ✅ Verify Connection
    await transporter.verify();
    console.log("📧 SMTP connection verified successfully");

    // ✅ Send Mail
    const mailOptions = {
      from: `"Ecommerce Support" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully to: ${to}`);
  } catch (error) {
    console.error("❌ sendEmail error:", error.message);
    throw new Error("Email delivery failed — check SMTP credentials or config.");
  }
};

export default sendEmail;
