// // Server/webauthnUtils.js
// import crypto from "crypto";

// /** Random challenge generator */
// export function generateChallenge() {
//   return crypto.randomBytes(32);
// }

// /** Convert base64url string to Buffer */
// function base64urlToBuffer(base64url) {
//   base64url = base64url.replace(/-/g, "+").replace(/_/g, "/");
//   const pad = base64url.length % 4 ? 4 - (base64url.length % 4) : 0;
//   return Buffer.from(base64url + "=".repeat(pad), "base64");
// }

// /** ✅ Verify Attestation (registration verification) */
// export function verifyAttestation(credential, challenge) {
//   try {
//     const { id, rawId, type, response } = credential;
//     if (type !== "public-key") return false;

//     const clientDataJSON = JSON.parse(
//       Buffer.from(response.clientDataJSON, "base64").toString()
//     );

//     if (clientDataJSON.challenge !== challenge.toString("base64")) {
//       console.error("❌ Challenge mismatch during attestation");
//       return false;
//     }

//     // For demo: trust any attestation
//     console.log("✅ Attestation verified");
//     return true;
//   } catch (err) {
//     console.error("verifyAttestation error:", err);
//     return false;
//   }
// }

// /** ✅ Verify Assertion (login/fingerprint verification) */
// export function verifyAssertion(assertion, challenge, credential) {
//   try {
//     const { id, type, response } = assertion;
//     if (type !== "public-key") return false;

//     // 1️⃣ Decode and parse client data
//     const clientDataJSON = JSON.parse(
//       Buffer.from(response.clientDataJSON, "base64").toString()
//     );

//     if (clientDataJSON.challenge !== challenge.toString("base64")) {
//       console.error("❌ Challenge mismatch during assertion");
//       return false;
//     }

//     // 2️⃣ Decode authenticator data
//     const authData = base64urlToBuffer(response.authenticatorData);

//     // 3️⃣ Verify signature (demo — skip real crypto signature check)
//     // For real check: need stored credential.publicKey
//     console.log("✅ Fingerprint verified successfully");
//     return true;
//   } catch (err) {
//     console.error("verifyAssertion error:", err);
//     return false;
//   }
// }

import crypto from "crypto";

export function generateChallenge() {
  return crypto.randomBytes(32);
}

export function verifyAttestation(credential, challenge) {
  // 🧪 For demo purposes, skip real crypto verification
  return !!credential && !!challenge;
}

export function verifyAssertion(assertion, challenge, credential) {
  // 🧪 Again, skip real WebAuthn verification for local testing
  return !!assertion && !!credential && !!challenge;
}
