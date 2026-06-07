import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, lowercase: true, index: true },
    clientId: { type: String, required: true },
    title: { type: String, required: true, maxlength: 120 },
    detail: { type: String, default: "", maxlength: 500 },
    type: {
      type: String,
      enum: ["info", "success", "warning", "error"],
      default: "info",
    },
    occurredAt: { type: Date, required: true },
  },
  { timestamps: true }
);

activitySchema.index({ walletAddress: 1, occurredAt: -1 });
activitySchema.index({ walletAddress: 1, clientId: 1 }, { unique: true });

export default mongoose.model("Activity", activitySchema);
