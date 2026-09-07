const { handleLogin } = require("../lib/handlers");
const { readJsonBody, send } = require("./_util");

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  try {
    const body = await readJsonBody(req);
    const result = await handleLogin(body);
    send(res, result.status, result.body);
  } catch (err) {
    console.error(err);
    send(res, 500, { error: err.message });
  }
};
