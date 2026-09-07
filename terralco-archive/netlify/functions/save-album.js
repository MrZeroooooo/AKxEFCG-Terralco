const { handleSaveAlbum } = require("../../lib/handlers");
const { extractBearerToken } = require("../../lib/auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  try {
    const token = extractBearerToken(event.headers.authorization || event.headers.Authorization);
    const body = JSON.parse(event.body || "{}");
    const result = await handleSaveAlbum(token, body.action, body.payload || {});
    return { statusCode: result.status, body: JSON.stringify(result.body) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
