import mongoose from "mongoose";

const guardianApprovalSchema = new mongoose.Schema(
  {
    guardian: {
      type: String,
      required: true,
      lowercase: true,
    },
    signature: {
      type: String,
      required: true,
    },
    approvedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const guardianRecoveryRequestSchema = new mongoose.Schema(
  {
    user: {
      type: String,
      required: true,
      lowercase: true,
    },
    caller: {
      type: String,
      required: true,
      lowercase: true,
    },
    requestId: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    approvals: [guardianApprovalSchema],
    tokenIssuedAt: Date,
    consumedAt: Date,
  },
  { timestamps: true }
);

guardianRecoveryRequestSchema.index({ user: 1, caller: 1 }, { unique: true });

export default mongoose.model(
  "GuardianRecoveryRequest",
  guardianRecoveryRequestSchema
);
