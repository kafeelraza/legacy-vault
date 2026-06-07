// oracle-server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { VAULT_ABI } from "./legacy-vault-ui/src/config/contract.js";
import { connectDB } from "./db.js";
import { authMiddleware } from "./Server/authMiddleware.js";

import {
  JsonRpcProvider,
  Wallet,
  getBytes,
  isAddress,
  verifyMessage,
  solidityPackedKeccak256,
  Contract,
} from "ethers";
import biometricRoutes from "./Server/biometricRoutes.js";
import User from "./Server/models/User.js";
import GuardianRecoveryRequest from "./Server/models/GuardianRecoveryRequest.js";
import Activity from "./Server/models/Activity.js";
import RecoverySession from "./Server/models/RecoverySession.js";

dotenv.config();

const requiredEnvironment = [
  "MONGO_URI",
  "JWT_SECRET",
  "ORACLE_PRIVATE_KEY",
  "PROXY_ADDRESS",
];
const missingEnvironment = requiredEnvironment.filter(
  (key) => !process.env[key]
);
if (missingEnvironment.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvironment.join(", ")}`
  );
}
if (process.env.JWT_SECRET.length < 32) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }
  console.warn("Warning: JWT_SECRET should contain at least 32 characters");
}

await connectDB();

const ORACLE_PORT = Number(process.env.PORT || process.env.ORACLE_PORT || 5000);
const FRONTEND_ORIGINS = (
  process.env.FRONTEND_ORIGINS ||
  process.env.FRONTEND_ORIGIN ||
  "http://localhost:5173,http://localhost:5174,http://localhost:5175"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const RPC = process.env.RPC_URL || process.env.SEPOLIA_RPC_URL;
const CONTRACT_ADDRESS = process.env.PROXY_ADDRESS;
const CHAIN_ID = Number(process.env.CHAIN_ID || 11155111);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
if (!RPC) {
  throw new Error("Missing required environment variable: RPC_URL or SEPOLIA_RPC_URL");
}
if (
  IS_PRODUCTION &&
  (FRONTEND_ORIGINS.length === 0 ||
    FRONTEND_ORIGINS.some((origin) => origin.includes("localhost")))
) {
  throw new Error("Production FRONTEND_ORIGINS must contain only deployed HTTPS origins");
}

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "64kb" }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || FRONTEND_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
  })
);

const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const sensitiveLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sensitive requests. Try again later." },
});
const activityWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many activity updates. Try again later." },
});
app.use(standardLimiter);
app.use(
  [
    "/register/start",
    "/register/finish",
    "/verify/start",
    "/verify/finish",
    "/passkeys/manage/start",
    "/passkeys/manage/finish",
    "/guardian-recovery",
    "/sign-recovery",
  ],
  sensitiveLimiter
);

// ✅ Mount biometric routes
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "legacy-vault-oracle",
    chainId: CHAIN_ID,
  });
});

app.use("/", biometricRoutes);

// ✅ Blockchain setup
const provider = new JsonRpcProvider(RPC);
const oracleWallet = new Wallet(process.env.ORACLE_PRIVATE_KEY, provider);
// const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const vaultContract = new Contract(CONTRACT_ADDRESS, VAULT_ABI, oracleWallet);
// const vaultContract = new Contract(CONTRACT_ADDRESS, VAULT_ABI, provider);

// // (async () => {
// //   try {
// //     const version = await vaultContract.version();
// //     console.log("✅ Connected to Vault Contract Version:", version);
// //   } catch (err) {
// //     console.error(
// //       "❌ Could not fetch contract version — likely wrong address or ABI.\n",
// //       err.message
// //     );
// //   }
// // })();

// // ✅ Diagnostic check to see which address responds
// const impl = "0xB3c6f8721acB2059Bd2eF08702bac62f8236024A"; // implementation
// const proxy = "0xBd940B854C5f761b8c0844A3bF7B205564E5B798"; // proxy

// const implContract = new Contract(impl, VAULT_ABI, provider);
// const proxyContract = new Contract(proxy, VAULT_ABI, provider);

// (async () => {
//   try {
//     const implVersion = await implContract.version();
//     console.log("✅ Implementation version:", implVersion);
//   } catch (e) {
//     console.log("❌ Implementation version call failed:", e.message);
//   }

//   try {
//     const proxyVersion = await proxyContract.version();
//     console.log("✅ Proxy version:", proxyVersion);
//   } catch (e) {
//     console.log("❌ Proxy version call failed:", e.message);
//   }
// })();

// ✅ Compute hash (matches contract logic)
function computeHash(user, caller, nonce, expiry) {
  return solidityPackedKeccak256(
    ["address", "address", "uint256", "address", "uint256", "uint256"],
    [user, caller, CHAIN_ID, CONTRACT_ADDRESS, nonce, expiry]
  );
}

function normalizeAddress(address) {
  return address.toLowerCase();
}

function buildGuardianSetupMessage(user, guardians, threshold) {
  return [
    "LegacyVault Guardian Setup",
    `Wallet: ${normalizeAddress(user)}`,
    `Guardians: ${guardians.map(normalizeAddress).sort().join(",")}`,
    `Threshold: ${threshold}`,
  ].join("\n");
}

function buildGuardianApprovalMessage(user, caller, requestId, expiresAt) {
  return [
    "LegacyVault Guardian Recovery Approval",
    `Lost wallet: ${normalizeAddress(user)}`,
    `New wallet: ${normalizeAddress(caller)}`,
    `Contract: ${normalizeAddress(CONTRACT_ADDRESS)}`,
    `Chain ID: ${CHAIN_ID}`,
    `Request ID: ${requestId}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
  ].join("\n");
}

function buildActivityClearMessage(wallet) {
  return [
    "LegacyVault Activity Timeline",
    `Wallet: ${normalizeAddress(wallet)}`,
    "Action: Clear activity history",
  ].join("\n");
}

app.get("/health", async (_req, res) => {
  try {
    const version = await vaultContract.version();
    res.json({
      success: true,
      service: "legacy-vault-oracle",
      chainId: CHAIN_ID,
      contract: CONTRACT_ADDRESS,
      contractVersion: version,
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      service: "legacy-vault-oracle",
      error: err.message,
    });
  }
});

app.get("/recovery/profile/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;
    if (!isAddress(wallet)) return res.status(400).json({ error: "invalid wallet" });

    const user = await User.findOne({ walletAddress: normalizeAddress(wallet) });
    return res.json({
      wallet: normalizeAddress(wallet),
      passkeys: user?.authenticators?.length || 0,
      passkeyDetails:
        user?.authenticators?.map((auth) => ({
          id: auth._id?.toString(),
          label: auth.label || "Passkey",
          deviceType: auth.deviceType || "unknown",
          backedUp: Boolean(auth.backedUp),
          registeredAt: auth.registeredAt,
          lastUsedAt: auth.lastUsedAt,
        })) || [],
      guardians: user?.guardians?.map((guardian) => guardian.address) || [],
      guardianThreshold: user?.guardianThreshold || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/activity/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;
    if (!isAddress(wallet)) return res.status(400).json({ error: "invalid wallet" });

    const items = await Activity.find({
      walletAddress: normalizeAddress(wallet),
    })
      .sort({ occurredAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      activities: items.map((item) => ({
        id: item.clientId,
        title: item.title,
        detail: item.detail,
        type: item.type,
        createdAt: item.occurredAt.getTime(),
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/activity", activityWriteLimiter, async (req, res) => {
  try {
    const { wallet, activity } = req.body;
    if (!isAddress(wallet) || !activity?.id || !activity?.title) {
      return res.status(400).json({ error: "valid wallet and activity are required" });
    }

    await Activity.findOneAndUpdate(
      {
        walletAddress: normalizeAddress(wallet),
        clientId: String(activity.id),
      },
      {
        $setOnInsert: {
          walletAddress: normalizeAddress(wallet),
          clientId: String(activity.id),
          title: String(activity.title).slice(0, 120),
          detail: String(activity.detail || "").slice(0, 500),
          type: ["info", "success", "warning", "error"].includes(activity.type)
            ? activity.type
            : "info",
          occurredAt: new Date(Number(activity.createdAt) || Date.now()),
        },
      },
      { upsert: true }
    );

    const walletAddress = normalizeAddress(wallet);
    const overflow = await Activity.find({ walletAddress })
      .sort({ occurredAt: -1 })
      .skip(100)
      .select("_id")
      .lean();
    if (overflow.length > 0) {
      await Activity.deleteMany({ _id: { $in: overflow.map((item) => item._id) } });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/activity/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;
    const { signature } = req.body;
    if (!isAddress(wallet)) return res.status(400).json({ error: "invalid wallet" });
    if (!signature) {
      return res.status(401).json({ error: "owner wallet signature is required" });
    }
    const signer = verifyMessage(buildActivityClearMessage(wallet), signature);
    if (normalizeAddress(signer) !== normalizeAddress(wallet)) {
      return res.status(403).json({ error: "activity clear signature must come from the owner wallet" });
    }
    await Activity.deleteMany({ walletAddress: normalizeAddress(wallet) });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/guardians/save", async (req, res) => {
  try {
    const { user, guardians, threshold, signature } = req.body;
    if (!user || !Array.isArray(guardians) || !threshold || !signature) {
      return res.status(400).json({ error: "user, guardians, threshold, and signature are required" });
    }
    if (!isAddress(user)) return res.status(400).json({ error: "invalid user address" });

    const normalizedUser = normalizeAddress(user);
    const uniqueGuardians = [...new Set(guardians.map(normalizeAddress))];
    const numericThreshold = Number(threshold);
    if (uniqueGuardians.length < 2) {
      return res.status(400).json({ error: "at least two guardians are required" });
    }
    if (uniqueGuardians.length > 10) {
      return res.status(400).json({ error: "a maximum of ten guardians is allowed" });
    }
    if (uniqueGuardians.some((guardian) => !isAddress(guardian))) {
      return res.status(400).json({ error: "invalid guardian address" });
    }
    if (uniqueGuardians.includes(normalizedUser)) {
      return res.status(400).json({ error: "owner wallet cannot also be a guardian" });
    }
    if (
      !Number.isInteger(numericThreshold) ||
      numericThreshold < 2 ||
      numericThreshold > uniqueGuardians.length
    ) {
      return res.status(400).json({ error: "threshold must be at least 2 and not exceed guardian count" });
    }

    const message = buildGuardianSetupMessage(user, uniqueGuardians, numericThreshold);
    const signer = verifyMessage(message, signature);
    if (normalizeAddress(signer) !== normalizedUser) {
      return res.status(403).json({ error: "guardian setup signature must come from the owner wallet" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { walletAddress: normalizedUser },
      {
        $set: {
          walletAddress: normalizedUser,
          guardians: uniqueGuardians.map((address) => ({ address })),
          guardianThreshold: numericThreshold,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await GuardianRecoveryRequest.deleteMany({
      user: normalizedUser,
    });

    res.json({
      success: true,
      guardians: updatedUser.guardians.map((guardian) => guardian.address),
      guardianThreshold: updatedUser.guardianThreshold,
    });
  } catch (err) {
    console.error("guardian save error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/guardian-recovery/start", async (req, res) => {
  try {
    const { user, caller } = req.body;
    if (!user || !caller) return res.status(400).json({ error: "user and caller are required" });
    if (!isAddress(user) || !isAddress(caller)) {
      return res.status(400).json({ error: "invalid address format" });
    }

    const savedUser = await User.findOne({ walletAddress: normalizeAddress(user) });
    if (!savedUser || !savedUser.guardians?.length || !savedUser.guardianThreshold) {
      return res.status(400).json({ error: "guardian recovery is not configured for this wallet" });
    }

    const normalizedUser = normalizeAddress(user);
    const normalizedCaller = normalizeAddress(caller);
    let request = await GuardianRecoveryRequest.findOne({
      user: normalizedUser,
      caller: normalizedCaller,
    });
    const isExpired = !request?.expiresAt || request.expiresAt <= new Date();
    if (isExpired || request.consumedAt) {
      request = await GuardianRecoveryRequest.findOneAndUpdate(
        { user: normalizedUser, caller: normalizedCaller },
        {
          $set: {
            user: normalizedUser,
            caller: normalizedCaller,
            requestId: randomUUID(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            approvals: [],
          },
          $unset: { tokenIssuedAt: "", consumedAt: "" },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    res.json({
      success: true,
      message: buildGuardianApprovalMessage(
        user,
        caller,
        request.requestId,
        request.expiresAt
      ),
      requestId: request.requestId,
      expiresAt: request.expiresAt,
      guardians: savedUser.guardians.map((guardian) => guardian.address),
      threshold: savedUser.guardianThreshold,
      approvals: request.approvals.length,
      approvedGuardians: request.approvals.map((approval) => approval.guardian),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/guardian-recovery/approve", async (req, res) => {
  try {
    const { user, caller, guardian, signature, requestId } = req.body;
    if (!user || !caller || !guardian || !signature || !requestId) {
      return res.status(400).json({ error: "user, caller, guardian, signature, and requestId are required" });
    }
    if (![user, caller, guardian].every(isAddress)) {
      return res.status(400).json({ error: "invalid address format" });
    }

    const savedUser = await User.findOne({ walletAddress: normalizeAddress(user) });
    const guardians = savedUser?.guardians?.map((item) => item.address) || [];
    if (!guardians.includes(normalizeAddress(guardian))) {
      return res.status(403).json({ error: "signer is not a configured guardian" });
    }

    const request = await GuardianRecoveryRequest.findOne({
      user: normalizeAddress(user),
      caller: normalizeAddress(caller),
      requestId,
      expiresAt: { $gt: new Date() },
      consumedAt: { $exists: false },
    });
    if (!request) {
      return res.status(400).json({ error: "guardian request is invalid, expired, or already used" });
    }

    const message = buildGuardianApprovalMessage(
      user,
      caller,
      request.requestId,
      request.expiresAt
    );
    const signer = verifyMessage(message, signature);
    if (normalizeAddress(signer) !== normalizeAddress(guardian)) {
      return res.status(403).json({ error: "approval signature does not match guardian wallet" });
    }

    request.approvals = request.approvals.filter(
      (approval) => approval.guardian !== normalizeAddress(guardian)
    );
    request.approvals.push({
      guardian: normalizeAddress(guardian),
      signature,
      approvedAt: new Date(),
    });
    await request.save();

    res.json({
      success: true,
      approvals: request.approvals.length,
      threshold: savedUser.guardianThreshold,
      ready: request.approvals.length >= savedUser.guardianThreshold,
      approvedGuardians: request.approvals.map((approval) => approval.guardian),
    });
  } catch (err) {
    console.error("guardian approval error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/guardian-recovery/token", async (req, res) => {
  try {
    const { user, caller, requestId } = req.body;
    if (!user || !caller || !requestId) {
      return res.status(400).json({ error: "user, caller, and requestId are required" });
    }
    if (!isAddress(user) || !isAddress(caller)) {
      return res.status(400).json({ error: "invalid address format" });
    }

    const savedUser = await User.findOne({ walletAddress: normalizeAddress(user) });
    if (!savedUser?.guardianThreshold) {
      return res.status(400).json({ error: "guardian recovery is not configured" });
    }

    const request = await GuardianRecoveryRequest.findOne({
      user: normalizeAddress(user),
      caller: normalizeAddress(caller),
      requestId,
      expiresAt: { $gt: new Date() },
      consumedAt: { $exists: false },
    });
    const approvalCount = request?.approvals?.length || 0;
    if (approvalCount < savedUser.guardianThreshold) {
      return res.status(403).json({
        error: `guardian threshold not met (${approvalCount}/${savedUser.guardianThreshold})`,
      });
    }

    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await RecoverySession.create({
      jti,
      wallet: normalizeAddress(user),
      caller: normalizeAddress(caller),
      method: "guardian",
      expiresAt,
    });
    const token = jwt.sign(
      {
        wallet: normalizeAddress(user),
        caller: normalizeAddress(caller),
        method: "guardian",
        jti,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    request.tokenIssuedAt = new Date();
    request.consumedAt = new Date();
    await request.save();

    res.json({ success: true, token, approvals: approvalCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Handle recovery signing request
app.post("/sign-recovery", authMiddleware, async (req, res) => {
  try {
    const { user, caller } = req.body;

    if (!user || !caller)
      return res.status(400).json({
        error: "user and caller are required",
      });

    if (!isAddress(user) || !isAddress(caller))
      return res.status(400).json({ error: "invalid address format" });

    if (req.user.wallet !== user.toLowerCase()) {
      return res.status(403).json({ error: "Wallet mismatch" });
    }

    if (req.user.method === "guardian" && req.user.caller !== caller.toLowerCase()) {
      return res.status(403).json({ error: "Recovery caller mismatch" });
    }

    if (!req.user.jti) {
      return res.status(401).json({ error: "Recovery session is invalid" });
    }
    const session = await RecoverySession.findOneAndUpdate(
      {
        jti: req.user.jti,
        wallet: normalizeAddress(user),
        expiresAt: { $gt: new Date() },
        consumedAt: { $exists: false },
        $or: [
          { caller: { $exists: false } },
          { caller: normalizeAddress(caller) },
        ],
      },
      { $set: { consumedAt: new Date() } },
      { new: true }
    );
    if (!session) {
      return res.status(401).json({ error: "Recovery session is expired or already used" });
    }

    // ✅ Fetch on-chain nonce to stay in sync
    const currentNonce = await vaultContract.usedNonces(user);
    const nonce = Number(currentNonce) + 1;

    // ✅ Expiry time: 1 hour
    const expiry = Math.floor(Date.now() / 1000) + 60 * 60;

    // ✅ Compute message hash (same logic as in Solidity)
    const hash = computeHash(user, caller, nonce, expiry);

    // ✅ Sign message using oracle private key
    const signature = await oracleWallet.signMessage(getBytes(hash));

    // ✅ Mark session used
    console.log("Recovery request signed:", {
      user,
      caller,
      nonce,
      expiry,
    });

    res.json({ user, caller, nonce, expiry, signature });
  } catch (err) {
    console.error("❌ sign error:", err);
    res.status(500).json({ error: err.message });
  }
});
// ✅ Start server
app.use((err, _req, res, _next) => {
  console.error("Unhandled request error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = ORACLE_PORT;
app.listen(PORT, () =>
  console.log(`Oracle server running on port ${PORT}`)
);
