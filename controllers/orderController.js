
import Order from "../models/orderModel.js";
import nodemailer from "nodemailer";
import {
  orderCreatedTemplate,
  orderUpdatedTemplate,
  orderDeletedTemplate,
} from "../utils/emailTemp.js";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM, 
} = process.env;

let transporter = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, 
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });


  transporter.verify().then(
    () => console.log("📧 Mailer ready"),
    (err) => console.warn("⚠ Mailer verify failed:", err && err.message ? err.message : err)
  );
} else {
  console.warn("⚠ SMTP env variables not fully set. Email notifications are disabled.");
}


async function sendOrderEmail(to, subject, html) {
  if (!transporter) {
    console.warn("Email not sent — transporter not configured");
    return;
  }
  const fromAddr = EMAIL_FROM || SMTP_USER;
  try {
    const info = await transporter.sendMail({
      from: fromAddr,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId || "sent"}`);
  } catch (err) {
    console.error("📧 Email send error:", err?.message || err);
  }
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
