import mongoose from "mongoose";

const authenticatorSchema = new mongoose.Schema({
  credentialID: {
    type: String,
    required: true,
  },
  publicKey: {
    type: String,
    required: true,
  },
  counter: {
    type: Number,
    required: true,
  },
  label: {
    type: String,
    default: "Passkey",
    maxlength: 60,
  },
  deviceType: {
    type: String,
    default: "unknown",
  },
  backedUp: {
    type: Boolean,
    default: false,
  },
  transports: [String],
  registeredAt: {
    type: Date,
    default: Date.now,
  },
  lastUsedAt: Date,
});

const guardianSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      lowercase: true,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    authenticators: [authenticatorSchema],
    guardians: [guardianSchema],
    guardianThreshold: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
