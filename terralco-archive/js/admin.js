/**
 * Terralco Archive — admin/collaborator panel script.
 *
 * This talks to /api/login, /api/upload-signature, and /api/save-album.
 * Those paths work as-is on Vercel (real serverless routes under /api)
 * and on Netlify too, via the redirect rule in netlify.toml that maps
 * /api/* to /.netlify/functions/*.
 */

(function () {
  "use strict";

  const SESSION_KEY = "terralco_session";

  const els = {
    loginView: document.getElementById("loginView"),
    dashboardView: document.getElementById("dashboardView"),
    loginForm: document.getElementById("loginForm"),
    loginError: document.getElementById("loginError"),
    whoami: document.getElementById("whoami"),
    logoutBtn: document.getElementById("logoutBtn"),

    createAlbumForm: document.getElementById("createAlbumForm"),
    createAlbumStatus: document.getElementById("createAlbumStatus"),

    uploadForm: document.getElementById("uploadForm"),
    albumSelect: document.getElementById("albumSelect"),
    fileInput: document.getElementById("fileInput"),
    uploadBtn: document.getElementById("uploadBtn"),
    uploadProgress: document.getElementById("uploadProgress"),
    uploadStatus: document.getElementById("uploadStatus"),

    manageList: document.getElementById("manageList"),
  };

  let session = loadSession();

  init();

  function init() {
    els.loginForm.addEventListener("submit", onLogin);
    els.logoutBtn.addEventListener("click", onLogout);
    els.createAlbumForm.addEventListener("submit", onCreateAlbum);
    els.uploadForm.addEventListener("submit", onUpload);

    if (session) {
      showDashboard();
    } else {
      showLogin();
    }
  }

  function loadSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSession(data) {
    session = data;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }

  function clearSession() {
    session = null;
    sessionStorage.removeItem(SESSION_KEY);
  }

  function showLogin() {
    els.loginView.hidden = false;
    els.dashboardView.hidden = true;
  }

  function showDashboard() {
    els.loginView.hidden = true;
    els.dashboardView.hidden = false;
    els.whoami.textContent = session.name;
    refreshAlbums();
  }

  async function onLogin(e) {
    e.preventDefault();
    hide(els.loginError);
    const fd = new FormData(els.loginForm);
    const name = fd.get("name").trim();
    const password = fd.get("password");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign in failed.");
      saveSession({ token: data.token, name: data.name });
      els.loginForm.reset();
      showDashboard();
    } catch (err) {
      showText(els.loginError, err.message);
    }
  }

  function onLogout() {
    clearSession();
    showLogin();
  }

  async function authedFetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${session.token}`,
      },
    });
    if (res.status === 401) {
      clearSession();
      showLogin();
      throw new Error("Your session expired. Please sign in again.");
    }
    return res;
  }

  async function onCreateAlbum(e) {
    e.preventDefault();
    hide(els.createAlbumStatus);
    const fd = new FormData(els.createAlbumForm);
    const payload = {
      title: fd.get("title").trim(),
      date: fd.get("date") || undefined,
      location: fd.get("location").trim(),
      description: fd.get("description").trim(),
    };

    const btn = els.createAlbumForm.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const res = await authedFetch("/api/save-album", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createAlbum", payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create album.");
      showText(els.createAlbumStatus, `Album "${payload.title}" created.`, false);
      els.createAlbumForm.reset();
      await refreshAlbums(data.albumId);
    } catch (err) {
      showText(els.createAlbumStatus, err.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  async function fetchAlbumsData() {
    const res = await fetch("data/albums.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load albums.json");
    return res.json();
  }

  async function refreshAlbums(selectId) {
    let data;
    try {
      data = await fetchAlbumsData();
    } catch (err) {
      els.manageList.innerHTML = `<p class="form-status is-error">${escapeHtml(err.message)}</p>`;
      return;
    }

    const albums = Array.isArray(data.albums) ? data.albums : [];

    // populate the upload form's album picker
    els.albumSelect.innerHTML =
      albums.length === 0
        ? `<option value="">No albums yet — create one first</option>`
        : albums
            .map((a) => `<option value="${escapeAttr(a.id)}">${escapeHtml(a.title)}</option>`)
            .join("");
    if (selectId) els.albumSelect.value = selectId;

    // populate the management list
    if (albums.length === 0) {
      els.manageList.innerHTML = `<p class="admin-sub">No albums yet.</p>`;
      return;
    }

    els.manageList.innerHTML = "";
    for (const album of albums) {
      els.manageList.appendChild(buildManageRow(album));
    }
  }

  function buildManageRow(album) {
    const wrap = document.createElement("div");
    wrap.className = "manage-album";

    const photos = Array.isArray(album.photos) ? album.photos : [];

    wrap.innerHTML = `
      <div class="manage-album-head">
        <div>
          <div class="manage-album-title">${escapeHtml(album.title)}</div>
          <div class="manage-album-meta">${photos.length} photo${photos.length === 1 ? "" : "s"}${album.date ? " · " + escapeHtml(album.date) : ""}</div>
        </div>
        <button type="button" class="ghost-btn" data-delete-album="${escapeAttr(album.id)}">Delete album</button>
      </div>
      <div class="manage-photo-grid"></div>
    `;

    const grid = wrap.querySelector(".manage-photo-grid");
    for (const photo of photos) {
      const cell = document.createElement("div");
      cell.className = "manage-photo";
      cell.innerHTML = `<img src="${escapeAttr(photo.url)}" alt=""><button type="button" title="Delete photo">&times;</button>`;
      cell.querySelector("button").addEventListener("click", () => deletePhoto(album.id, photo.url));
      grid.appendChild(cell);
    }

    wrap.querySelector("[data-delete-album]").addEventListener("click", () => deleteAlbum(album.id, album.title));

    return wrap;
  }

  async function deleteAlbum(albumId, title) {
    if (!confirm(`Delete the album "${title}" and all its photos from the archive? This can't be undone here.`)) return;
    try {
      const res = await authedFetch("/api/save-album", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteAlbum", payload: { albumId } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete album.");
      await refreshAlbums();
    } catch (err) {
      alert(err.message);
    }
  }

  async function deletePhoto(albumId, photoUrl) {
    if (!confirm("Remove this photo from the album?")) return;
    try {
      const res = await authedFetch("/api/save-album", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deletePhoto", payload: { albumId, photoUrl } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete photo.");
      await refreshAlbums();
    } catch (err) {
      alert(err.message);
    }
  }

  async function onUpload(e) {
    e.preventDefault();
    hide(els.uploadStatus);
    const albumId = els.albumSelect.value;
    const files = Array.from(els.fileInput.files || []);
    if (!albumId) return showText(els.uploadStatus, "Choose an album first.", true);
    if (files.length === 0) return showText(els.uploadStatus, "Choose at least one photo.", true);

    els.uploadBtn.disabled = true;
    els.uploadProgress.hidden = false;
    els.uploadProgress.innerHTML = "";

    try {
      // 1. Get a signed Cloudinary upload signature scoped to this album.
      const sigRes = await authedFetch("/api/upload-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId }),
      });
      const sig = await sigRes.json();
      if (!sigRes.ok) throw new Error(sig.error || "Could not authorize upload.");

      // 2. Upload each file straight to Cloudinary using that signature.
      const uploaded = [];
      for (const file of files) {
        const line = document.createElement("div");
        line.textContent = `Uploading ${file.name}…`;
        els.uploadProgress.appendChild(line);

        const url = await uploadToCloudinary(file, sig);
        uploaded.push({ url, caption: "" });
        line.textContent = `Uploaded ${file.name}`;
      }

      // 3. Save the new photo URLs into albums.json.
      const saveRes = await authedFetch("/api/save-album", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addPhotos", payload: { albumId, photos: uploaded } }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Upload succeeded but saving to the album failed.");

      showText(els.uploadStatus, `Added ${uploaded.length} photo(s). They'll appear once the site redeploys (usually under a minute).`, false);
      els.uploadForm.reset();
      await refreshAlbums(albumId);
    } catch (err) {
      showText(els.uploadStatus, err.message, true);
    } finally {
      els.uploadBtn.disabled = false;
    }
  }

  function uploadToCloudinary(file, sig) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", sig.apiKey);
    formData.append("timestamp", sig.timestamp);
    formData.append("signature", sig.signature);
    formData.append("folder", sig.folder);

    return fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.secure_url) throw new Error(data.error?.message || "Cloudinary upload failed.");
        return data.secure_url;
      });
  }

  function showText(el, text, isError) {
    el.textContent = text;
    el.hidden = false;
    el.classList.toggle("is-error", !!isError);
  }
  function hide(el) {
    el.hidden = true;
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function escapeAttr(str) {
    return escapeHtml(str);
  }
})();
