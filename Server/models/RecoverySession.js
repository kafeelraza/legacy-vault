import mongoose from "mongoose";

const recoverySessionSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true },
    wallet: { type: String, required: true, lowercase: true, index: true },
    caller: { type: String, lowercase: true },
    method: {
      type: String,
      required: true,
      enum: ["passkey", "guardian"],
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    consumedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model("RecoverySession", recoverySessionSchema);
