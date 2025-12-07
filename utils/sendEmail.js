import nodemailer from "nodemailer";

const sendEmail = async (to, subject, html) => {
  try {
    // ✅ Create Transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false, // prevent self-signed cert issues
      },
    });

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
