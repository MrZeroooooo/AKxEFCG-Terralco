const { handleSaveAlbum } = require("../lib/handlers");
const { extractBearerToken } = require("../lib/auth");
const { readJsonBody, send } = require("./_util");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const token = extractBearerToken(req.headers.authorization);
    const body = await readJsonBody(req);
    const result = await handleSaveAlbum(token, body.action, body.payload || {});
    send(res, result.status, result.body);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message });
  }
};
