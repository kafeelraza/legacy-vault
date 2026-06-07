import mongoose from "mongoose";

const webAuthnChallengeSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      lowercase: true,
    },
    purpose: {
      type: String,
      required: true,
      enum: ["registration", "authentication", "management", "activity"],
    },
    challenge: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

webAuthnChallengeSchema.index(
  { walletAddress: 1, purpose: 1 },
  { unique: true }
);

export default mongoose.model("WebAuthnChallenge", webAuthnChallengeSchema);
