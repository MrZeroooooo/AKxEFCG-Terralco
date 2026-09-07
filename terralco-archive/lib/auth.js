/**
 * Shared auth helpers for admin / collaborator sign-in.
 *
 * Editors are configured via the ALLOWED_EDITORS environment variable,
 * a JSON object mapping a display name to a password, e.g.:
 *   ALLOWED_EDITORS={"admin":"correct-horse-battery-staple","yuki":"another-password"}
 *
 * This keeps things simple (no database) while still letting you name
 * individual collaborators and revoke one person's access by editing
 * the env var, without giving out a shared login to everyone.
 *
 * Tokens are short-lived, HMAC-signed strings (not a full JWT library,
 * to keep this dependency-free) — good enough for gating a low-stakes
 * internal upload tool, not intended as bank-grade auth.
 */

const crypto = require("crypto");

const SESSION_HOURS = 6;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET environment variable is not set. Set it in your Netlify/Vercel project settings."
    );
  }
  return secret;
}

function getEditors() {
  try {
    return JSON.parse(process.env.ALLOWED_EDITORS || "{}");
  } catch (err) {
    console.error("ALLOWED_EDITORS is not valid JSON:", err.message);
    return {};
  }
}

function checkPassword(name, password) {
  const editors = getEditors();
  if (!name || !password || !editors[name]) return false;
  return timingSafeEqual(editors[name], password);
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createToken(name) {
  const payload = {
    name,
    exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
  };
  const payloadStr = base64url(JSON.stringify(payload));
  const sig = sign(payloadStr);
  return `${payloadStr}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || token.indexOf(".") === -1) return null;
  const [payloadStr, sig] = token.split(".");
  const expectedSig = sign(payloadStr);
  if (!timingSafeEqual(sig, expectedSig)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function sign(str) {
  return crypto.createHmac("sha256", getSecret()).update(str).digest("base64url");
}

function base64url(str) {
  return Buffer.from(str, "utf8").toString("base64url");
}

function extractBearerToken(headerValue) {
  if (!headerValue) return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  return match ? match[1] : null;
}

module.exports = { checkPassword, createToken, verifyToken, extractBearerToken };
