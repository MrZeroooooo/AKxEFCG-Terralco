/**
 * Platform-agnostic handlers. Both the Netlify Functions wrappers
 * (netlify/functions/*.js) and the Vercel API route wrappers (api/*.js)
 * call into these — they just adapt each platform's request/response
 * shape into a plain { status, body } result.
 */

const auth = require("./auth");
const cloudinary = require("./cloudinary");
const github = require("./github");

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "album";
}

async function handleLogin({ name, password }) {
  if (!auth.checkPassword(name, password)) {
    return { status: 401, body: { error: "Incorrect name or password." } };
  }
  return { status: 200, body: { token: auth.createToken(name), name } };
}

async function handleUploadSignature(token, albumId) {
  const session = auth.verifyToken(token);
  if (!session) return { status: 401, body: { error: "Session expired — please sign in again." } };

  const folder = `terralco/${slugify(albumId || "unsorted")}`;
  const signature = cloudinary.createUploadSignature(folder);
  return { status: 200, body: signature };
}

/**
 * action: "createAlbum" | "addPhotos" | "deletePhoto" | "deleteAlbum"
 * payload shape depends on the action — see admin.js for what's sent.
 */
async function handleSaveAlbum(token, action, payload) {
  const session = auth.verifyToken(token);
  if (!session) return { status: 401, body: { error: "Session expired — please sign in again." } };

  const { data, sha } = await github.readAlbumsFile();
  data.albums = Array.isArray(data.albums) ? data.albums : [];

  if (action === "createAlbum") {
    const { title, description, date, location, cover } = payload;
    if (!title) return { status: 400, body: { error: "Album title is required." } };

    let id = slugify(title);
    let suffix = 2;
    while (data.albums.some((a) => a.id === id)) {
      id = `${slugify(title)}-${suffix++}`;
    }

    data.albums.push({
      id,
      title,
      description: description || "",
      date: date || new Date().toISOString().slice(0, 10),
      location: location || "",
      cover: cover || "",
      photos: [],
    });

    await github.writeAlbumsFile(data, sha, `Add album "${title}" (${session.name})`);
    return { status: 200, body: { ok: true, albumId: id } };
  }

  if (action === "addPhotos") {
    const { albumId, photos } = payload;
    const album = data.albums.find((a) => a.id === albumId);
    if (!album) return { status: 404, body: { error: "Album not found." } };
    if (!Array.isArray(photos) || photos.length === 0) {
      return { status: 400, body: { error: "No photos to add." } };
    }

    album.photos = Array.isArray(album.photos) ? album.photos : [];
    album.photos.push(...photos);
    if (!album.cover) album.cover = photos[0].url;

    await github.writeAlbumsFile(
      data,
      sha,
      `Add ${photos.length} photo(s) to "${album.title}" (${session.name})`
    );
    return { status: 200, body: { ok: true } };
  }

  if (action === "deletePhoto") {
    const { albumId, photoUrl } = payload;
    const album = data.albums.find((a) => a.id === albumId);
    if (!album) return { status: 404, body: { error: "Album not found." } };
    album.photos = (album.photos || []).filter((p) => p.url !== photoUrl);

    await github.writeAlbumsFile(data, sha, `Remove a photo from "${album.title}" (${session.name})`);
    return { status: 200, body: { ok: true } };
  }

  if (action === "deleteAlbum") {
    const { albumId } = payload;
    const before = data.albums.length;
    data.albums = data.albums.filter((a) => a.id !== albumId);
    if (data.albums.length === before) {
      return { status: 404, body: { error: "Album not found." } };
    }

    await github.writeAlbumsFile(data, sha, `Delete album "${albumId}" (${session.name})`);
    return { status: 200, body: { ok: true } };
  }

  return { status: 400, body: { error: "Unknown action." } };
}

module.exports = { handleLogin, handleUploadSignature, handleSaveAlbum };
