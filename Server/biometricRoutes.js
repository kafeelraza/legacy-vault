import express from "express";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { isAddress, verifyMessage } from "ethers";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import User from "./models/User.js";
import WebAuthnChallenge from "./models/WebAuthnChallenge.js";
import RecoverySession from "./models/RecoverySession.js";

dotenv.config();

const router = express.Router();
const rpName = "Legacy Vault";
const rpID = process.env.WEBAUTHN_RP_ID || "localhost";
const origins = (
  process.env.FRONTEND_ORIGINS ||
  process.env.FRONTEND_ORIGIN ||
  "http://localhost:5173,http://localhost:5174,http://localhost:5175"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (
  process.env.NODE_ENV === "production" &&
  (rpID === "localhost" ||
    origins.some((origin) => !origin.startsWith("https://") || origin.includes("localhost")))
) {
  throw new Error(
    "Production WebAuthn requires WEBAUTHN_RP_ID and HTTPS FRONTEND_ORIGINS"
  );
}

function buildPasskeyRegistrationMessage(wallet, challenge) {
  return [
    "LegacyVault Passkey Registration",
    `Wallet: ${wallet}`,
    `Challenge: ${challenge}`,
  ].join("\n");
}

function buildPasskeyManagementMessage(wallet, action, passkeyId, label, challenge) {
  return [
    "LegacyVault Passkey Management",
    `Wallet: ${wallet}`,
    `Action: ${action}`,
    `Passkey ID: ${passkeyId}`,
    `Label: ${label || "-"}`,
    `Challenge: ${challenge}`,
  ].join("\n");
}

function getPasskeyDetails(user) {
  return user.authenticators.map((auth) => ({
    id: auth._id.toString(),
    label: auth.label || "Passkey",
    deviceType: auth.deviceType || "unknown",
    backedUp: Boolean(auth.backedUp),
    registeredAt: auth.registeredAt,
    lastUsedAt: auth.lastUsedAt,
  }));
}

async function saveChallenge(walletAddress, purpose, challenge) {
  await WebAuthnChallenge.findOneAndUpdate(
    { walletAddress, purpose },
    {
      $set: {
        walletAddress,
        purpose,
        challenge,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function consumeChallenge(walletAddress, purpose) {
  const saved = await WebAuthnChallenge.findOneAndDelete({
    walletAddress,
    purpose,
    expiresAt: { $gt: new Date() },
  });
  return saved?.challenge;
}

router.post("/register/start", async (req, res) => {
  try {
    const { user } = req.body;
    if (!user) return res.status(400).json({ error: "User required" });

    const wallet = user.toLowerCase();
    const existingUser = await User.findOne({ walletAddress: wallet });
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: wallet,
      userID: new TextEncoder().encode(wallet),
      timeout: 60000,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      excludeCredentials:
        existingUser?.authenticators?.map((auth) => ({
          id: auth.credentialID,
          type: "public-key",
        })) || [],
    });

    await saveChallenge(wallet, "registration", options.challenge);
    return res.json(options);
  } catch (err) {
    console.error("Registration start error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/register/finish", async (req, res) => {
  try {
    const { user, response, ownerSignature, label } = req.body;
    if (!user || !response || !ownerSignature) {
      return res.status(400).json({
        error: "User, response, and owner wallet signature are required",
      });
    }

    const wallet = user.toLowerCase();
    const expectedChallenge = await consumeChallenge(wallet, "registration");
    if (!expectedChallenge) {
      return res.status(400).json({ error: "No active challenge found" });
    }
    const ownerSigner = verifyMessage(
      buildPasskeyRegistrationMessage(wallet, expectedChallenge),
      ownerSignature
    );
    if (ownerSigner.toLowerCase() !== wallet) {
      return res.status(403).json({
        error: "Passkey registration must be approved by the owner wallet",
      });
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return res.json({ success: false });
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;
    const authenticator = {
      credentialID: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64"),
      counter: credential.counter || 0,
      label: String(label || "Passkey").trim().slice(0, 60) || "Passkey",
      deviceType: credentialDeviceType || "unknown",
      backedUp: Boolean(credentialBackedUp),
      transports: response.response?.transports || [],
    };

    let savedUser = await User.findOne({ walletAddress: wallet });
    if (!savedUser) {
      savedUser = await User.create({
        walletAddress: wallet,
        authenticators: [authenticator],
      });
    } else {
      savedUser.authenticators.push(authenticator);
      await savedUser.save();
    }

    return res.json({
      success: true,
      passkey: getPasskeyDetails(savedUser).at(-1),
    });
  } catch (err) {
    console.error("Registration finish error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/verify/start", async (req, res) => {
  try {
    const { user } = req.body;
    if (!user) return res.status(400).json({ error: "User required" });

    const wallet = user.toLowerCase();
    const savedUser = await User.findOne({ walletAddress: wallet });
    if (!savedUser?.authenticators?.length) {
      return res.status(400).json({ error: "No passkey registered" });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: savedUser.authenticators.map((auth) => ({
        id: auth.credentialID,
        type: "public-key",
      })),
      userVerification: "required",
    });

    await saveChallenge(wallet, "authentication", options.challenge);
    return res.json(options);
  } catch (err) {
    console.error("Authentication start error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/verify/finish", async (req, res) => {
  try {
    const { user, response } = req.body;
    if (!user || !response) {
      return res.status(400).json({ error: "Missing user/response" });
    }

    const wallet = user.toLowerCase();
    const savedUser = await User.findOne({ walletAddress: wallet });
    if (!savedUser) {
      return res.status(400).json({ error: "User not found" });
    }

    const expectedChallenge = await consumeChallenge(wallet, "authentication");
    if (!expectedChallenge) {
      return res.status(400).json({ error: "No active challenge found" });
    }

    const dbAuthenticator = savedUser.authenticators.find(
      (auth) => auth.credentialID === response.id
    );
    if (!dbAuthenticator) {
      return res.status(400).json({ error: "Authenticator not found" });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(dbAuthenticator.credentialID, "base64url"),
        credentialPublicKey: Buffer.from(dbAuthenticator.publicKey, "base64"),
        counter: dbAuthenticator.counter ?? 0,
      },
    });
    if (!verification.verified) {
      return res.json({ verified: false });
    }

    const newCounter = verification.authenticationInfo?.newCounter;
    if (typeof newCounter === "number") {
      dbAuthenticator.counter = newCounter;
    }
    dbAuthenticator.lastUsedAt = new Date();
    await savedUser.save();

    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await RecoverySession.create({
      jti,
      wallet,
      method: "passkey",
      expiresAt,
    });
    const token = jwt.sign({ wallet, method: "passkey", jti }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    return res.json({ verified: true, token });
  } catch (err) {
    console.error("Authentication finish error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/passkeys/manage/start", async (req, res) => {
  try {
    const { user, action, passkeyId, label = "" } = req.body;
    if (!isAddress(user) || !["rename", "revoke"].includes(action) || !passkeyId) {
      return res.status(400).json({
        error: "Valid user, action, and passkey ID are required",
      });
    }

    const wallet = user.toLowerCase();
    const savedUser = await User.findOne({ walletAddress: wallet });
    const passkey = savedUser?.authenticators?.id(passkeyId);
    if (!passkey) return res.status(404).json({ error: "Passkey not found" });

    const normalizedLabel = String(label).trim().slice(0, 60);
    if (action === "rename" && !normalizedLabel) {
      return res.status(400).json({ error: "A passkey label is required" });
    }
    if (action === "revoke" && savedUser.authenticators.length <= 1) {
      return res.status(400).json({
        error: "Add a backup passkey before revoking the last recovery passkey",
      });
    }

    const challenge = randomUUID();
    await saveChallenge(wallet, "management", challenge);
    return res.json({
      message: buildPasskeyManagementMessage(
        wallet,
        action,
        passkeyId,
        normalizedLabel,
        challenge
      ),
    });
  } catch (err) {
    console.error("Passkey management start error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/passkeys/manage/finish", async (req, res) => {
  try {
    const { user, action, passkeyId, label = "", ownerSignature } = req.body;
    if (
      !isAddress(user) ||
      !["rename", "revoke"].includes(action) ||
      !passkeyId ||
      !ownerSignature
    ) {
      return res.status(400).json({
        error: "Valid user, action, passkey ID, and owner signature are required",
      });
    }

    const wallet = user.toLowerCase();
    const challenge = await consumeChallenge(wallet, "management");
    if (!challenge) {
      return res.status(400).json({ error: "No active management challenge found" });
    }

    const normalizedLabel = String(label).trim().slice(0, 60);
    const signer = verifyMessage(
      buildPasskeyManagementMessage(
        wallet,
        action,
        passkeyId,
        normalizedLabel,
        challenge
      ),
      ownerSignature
    );
    if (signer.toLowerCase() !== wallet) {
      return res.status(403).json({
        error: "Passkey management must be approved by the owner wallet",
      });
    }

    const savedUser = await User.findOne({ walletAddress: wallet });
    const passkey = savedUser?.authenticators?.id(passkeyId);
    if (!passkey) return res.status(404).json({ error: "Passkey not found" });

    if (action === "rename") {
      if (!normalizedLabel) {
        return res.status(400).json({ error: "A passkey label is required" });
      }
      passkey.label = normalizedLabel;
    } else {
      if (savedUser.authenticators.length <= 1) {
        return res.status(400).json({
          error: "Add a backup passkey before revoking the last recovery passkey",
        });
      }
      savedUser.authenticators.pull(passkeyId);
    }

    await savedUser.save();
    return res.json({
      success: true,
      passkeys: getPasskeyDetails(savedUser),
    });
  } catch (err) {
    console.error("Passkey management finish error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
