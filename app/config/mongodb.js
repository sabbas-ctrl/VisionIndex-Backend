import mongoose from "mongoose";
import { ErrorLogger } from '../utils/errorLogger.js';

export const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    // Log MongoDB connection error
    await ErrorLogger.logDatabaseError(error, null, {
      actionType: 'mongodb_connection',
      details: {
        uri: process.env.MONGO_URI?.replace(/\/\/.*@/, '//***:***@'), // Hide credentials
        errorType: 'connection'
      }
    });
    process.exit(1);
  }
};
