
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import fileUpload from "express-fileupload";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { cleanupUnverifiedUsers } from "./utils/cleanupUnverified.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import sliderRoutes from "./routes/sliderRoutes.js";
import siteRoutes from "./routes/siteRoutes.js";
import seoRoutes from "./routes/seoRoutes.js";

import healthRoutes from "./routes/healthRoutes.js";
import { startHealthChecks, stopHealthChecks } from "./utils/healthCheck.js"; 
import sitemapRoutes from "./routes/sitemapRoutes.js";
dotenv.config();

connectDB();

const app = express();
const TWELVE_HOURS = 12 * 60 * 60 * 1000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(fileUpload({ useTempFiles: true }));

app.use(
  cors({
    origin: process.env.CLIENT_URL ,
    credentials: true,
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  })
); 

app.get("/", (req, res) => {
  console.log("📡 Health check endpoint hit successfully");
  res.status(200).send("✅ Admin API is running smoothly...");
});

setInterval(async () => {
  console.log(`[${new Date().toISOString()}] 🧹 Running scheduled cleanup...`);
  await cleanupUnverifiedUsers();
}, TWELVE_HOURS);

app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/sliders", sliderRoutes);
app.use('/api/site', siteRoutes);
app.use("/api/seo", seoRoutes);
app.use("/", sitemapRoutes);
app.use("/health", healthRoutes);

app.use((req, res) => {
  console.warn(`⚠️ 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ success: false, message: "❌ Route not found." });
});

app.use((err, req, res, next) => {
  console.error("🔥 Global Error Handler Triggered:");
  console.error(`   • Message: ${err.message}`);
  console.error(`   • Stack: ${err.stack}`);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 5000;


const server = app.listen(PORT, () => {
  console.log("=======================================");
  console.log(`✅ Server started successfully`);
  console.log(`📡 Mode: ${process.env.NODE_ENV || "development"}`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`🧩 Client URL: ${process.env.CLIENT_URL || "localhost"}`);
  console.log("=======================================");


  try {
    const healthUrl = process.env.HEALTH_ROUTE;
    const intervalMs = process.env.HEALTH_INTERVAL_MS ? Number(process.env.HEALTH_INTERVAL_MS) : 100000; // default 3 minutes
    const timeoutMs = process.env.HEALTH_TIMEOUT_MS ? Number(process.env.HEALTH_TIMEOUT_MS) : 20000; // default 15s

    if (healthUrl) {
      // startHealthChecks was imported from utils/healthCheck.js
      startHealthChecks({ url: healthUrl, intervalMs, timeoutMs, logger: console.log });
    } else {
      console.log("HEALTH_ROUTE not set; health checks are disabled.");
    }
  } catch (err) {
    console.error("Failed to start health checks:", err?.message || err);
  }
});

// Handle unhandled rejections and uncaught exceptions: log, stop health checks, then exit.
process.on("unhandledRejection", (err) => {
  console.error("💥 Unhandled Promise Rejection:", err?.message || err);
  try {
    // stop periodic health pings if running
    stopHealthChecks();
  } catch (e) {
    console.error("Error stopping health checks:", e?.message || e);
  }
  // allow logs to flush then exit
  setTimeout(() => process.exit(1), 100);
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err?.message || err);
  console.error(err?.stack || "");
  try {
    stopHealthChecks();
  } catch (e) {
    console.error("Error stopping health checks:", e?.message || e);
  }
  setTimeout(() => process.exit(1), 100);
});

// Graceful shutdown: stop health checks and close server on SIGINT/SIGTERM
const gracefulShutdown = async (signal) => {
  try {
    console.log(`🛑 Received ${signal}. Shutting down gracefully...`);
    // stop health pings
    try {
      stopHealthChecks();
      console.log("🧭 Health checks stopped.");
    } catch (e) {
      console.warn("Could not stop health checks cleanly:", e?.message || e);
    }

    // close server (stop accepting new connections)
    server.close((err) => {
      if (err) {
        console.error("Error closing server:", err);
        process.exit(1);
      }
      console.log("✅ Server closed.");
      process.exit(0);
    });

    // If server doesn't close within a timeout, force exit
    setTimeout(() => {
      console.warn("⚠ Could not close connections in time, forcing shutdown.");
      process.exit(1);
    }, 10_000);
  } catch (err) {
    console.error("Error during graceful shutdown:", err?.message || err);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
