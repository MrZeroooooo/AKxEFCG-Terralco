/**
 * Shared Cloudinary helper.
 *
 * We use Cloudinary's *signed* upload flow: the browser never sees the
 * API secret. Instead, a serverless function (which does have the
 * secret, via env vars) signs a short-lived set of upload parameters,
 * and the browser uploads the actual file bytes straight to Cloudinary
 * using that signature. This keeps large file uploads off our
 * serverless function entirely (avoiding body-size limits) while still
 * requiring a valid admin/collaborator session to get a signature.
 *
 * Required env vars:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */

const crypto = require("crypto");

function getConfig() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      "Missing Cloudinary env vars. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET."
    );
  }
  return { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET };
}

/**
 * Builds a signature for the given params (excluding api_key and file),
 * per Cloudinary's signing rules: sort keys alphabetically, join as
 * key=value pairs with '&', append the api secret, then SHA-1.
 */
function signParams(params) {
  const { CLOUDINARY_API_SECRET } = getConfig();
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(toSign + CLOUDINARY_API_SECRET).digest("hex");
}

function createUploadSignature(folder) {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY } = getConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = { timestamp, folder };
  const signature = signParams(paramsToSign);

  return {
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature,
  };
}

module.exports = { createUploadSignature };
