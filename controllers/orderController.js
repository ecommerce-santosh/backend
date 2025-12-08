// controllers/orderController.js
import Order from "../models/orderModel.js";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import {
  orderCreatedTemplate,
  orderUpdatedTemplate,
  orderDeletedTemplate,
} from "../utils/emailTemp.js";

const {
  RESEND_API_KEY,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  EMAIL_FROM,
} = process.env;

// --- Initialize primary transport: Resend (API) ---
let resendClient = null;
if (RESEND_API_KEY) {
  try {
    resendClient = new Resend(RESEND_API_KEY);
    console.log("📧 Email: Using Resend as primary transport");
  } catch (err) {
    console.warn("⚠️ Resend initialization failed:", err?.message || err);
    resendClient = null;
  }
} else {
  console.log("ℹ️ RESEND_API_KEY not set — Resend disabled");
}

// --- Initialize SMTP fallback (nodemailer) ---
let smtpTransporter = null;
if (!resendClient) {
  if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    smtpTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
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
      .then(() => console.log("📧 SMTP transporter verified and ready"))
      .catch((err) => console.warn("⚠️ SMTP verify failed:", err?.message || err));
  } else {
    console.warn("⚠️ SMTP env variables not fully set. SMTP fallback disabled.");
  }
} else {
  console.log("ℹ️ SMTP fallback skipped because Resend is configured");
}

/**
 * sendOrderEmail - wrapper used by the controller functions.
 * Uses Resend API if available, otherwise nodemailer SMTP fallback.
 *
 * @param {string} to - recipient email
 * @param {string} subject - email subject
 * @param {string} html - html content
 */
async function sendOrderEmail(to, subject, html) {
  if (!to) {
    console.warn("Email not sent — no recipient provided");
    return;
  }

  const fromAddr = EMAIL_FROM || SMTP_USER || `no-reply@${process.env.DOMAIN || "example.com"}`;

  // Use Resend API if available
  if (resendClient) {
    try {
      // Resend expects `from` and `to` as strings; it supports HTML body
      const resp = await resendClient.emails.send({
        from: fromAddr,
        to,
        subject,
        html,
      });
      console.log(`📧 Resend: email sent/queued to ${to}`, resp?.id ? `id=${resp.id}` : "");
      return resp;
    } catch (err) {
      console.error("📧 Resend send error:", err?.message || err);
      // fallthrough to try SMTP fallback if configured
    }
  }

  // Fallback to nodemailer SMTP transporter
  if (smtpTransporter) {
    try {
      const info = await smtpTransporter.sendMail({
        from: fromAddr,
        to,
        subject,
        html,
      });
      console.log(`📧 SMTP: Email sent to ${to}: ${info.messageId || "sent"}`);
      return info;
    } catch (err) {
      console.error("📧 SMTP send error:", err?.message || err);
      return null;
    }
  }

  console.warn("⚠️ No email transport configured (Resend and SMTP missing). Email not sent.");
  return null;
}

// 🧩 Create Order (USER)
export const createOrder = async (req, res) => {
  try {
    const order = new Order({
      user: req.user._id,
      ...req.body,
    });
    const created = await order.save();
    res.status(201).json(created);

    try {
      const populated = await created.populate("user", "name email");
      const recipient = populated.user?.email;
      if (recipient) {
        sendOrderEmail(
          recipient,
          `Order Confirmation — ${populated._id}`,
          orderCreatedTemplate(populated)
        ).catch((e) => console.error("Email send error (create):", e?.message || e));
      } else {
        console.warn("No recipient email found for order:", created._id);
      }
    } catch (e) {
      console.error("Error populating order user for email:", e?.message || e);
    }
  } catch (error) {
    res.status(500).json({ message: "Order creation failed", error: error.message });
  }
};

// 📋 Get All Orders (ADMIN)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch orders", error: error.message });
  }
};

// 👤 Get User Orders
export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch user orders", error: error.message });
  }
};

// ✏️ Update Order (ADMIN)
export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedOrder = await Order.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
    res.json(updatedOrder);

    try {
      const populated = await updatedOrder.populate("user", "name email");
      const recipient = populated.user?.email;
      if (recipient) {
        sendOrderEmail(
          recipient,
          `Order Update — ${populated._id}`,
          orderUpdatedTemplate(populated)
        ).catch((e) => console.error("Email send error (update):", e?.message || e));
      } else {
        console.warn("No recipient email found for updated order:", id);
      }
    } catch (e) {
      console.error("Error populating order user for update email:", e?.message || e);
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to update order", error: error.message });
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedOrder = await Order.findByIdAndDelete(id);
    if (!deletedOrder) return res.status(404).json({ message: "Order not found" });
    res.json({ message: "Order deleted successfully" });

    try {
      const populated = await deletedOrder.populate("user", "name email");
      const recipient = populated.user?.email;
      if (recipient) {
        sendOrderEmail(
          recipient,
          `Order Deleted — ${populated._id}`,
          orderDeletedTemplate(populated)
        ).catch((e) => console.error("Email send error (delete):", e?.message || e));
      } else {
        console.warn("No recipient email found for deleted order:", id);
      }
    } catch (e) {
      console.error("Error populating order user for delete email:", e?.message || e);
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete order", error: error.message });
  }
};
