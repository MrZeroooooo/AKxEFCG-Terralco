/**
 * Terralco Archive — main site script
 * -------------------------------------------------
 * Everything on the page is driven by data/albums.json.
 * Add a new album (or new photos to an existing one) either by:
 *   1. Editing data/albums.json directly, or
 *   2. Using the admin panel (admin.html) if you've wired up
 *      the serverless functions in /netlify/functions or /api.
 * No other code needs to change — the grid, counts, and
 * lightbox all render dynamically from that one file.
 */

(function () {
  "use strict";

  const state = {
    data: null,
    activeAlbum: null,
    activePhotoIndex: 0,
  };

  const els = {
    groupName: document.getElementById("groupName"),
    groupTagline: document.getElementById("groupTagline"),
    footerGroupName: document.getElementById("footerGroupName"),
    fbLink: document.getElementById("fbLink"),
    albumGrid: document.getElementById("albumGrid"),
    albumCount: document.getElementById("albumCount"),
    emptyState: document.getElementById("emptyState"),
    year: document.getElementById("year"),

    albumOverlay: document.getElementById("albumOverlay"),
    overlayEyebrow: document.getElementById("overlayEyebrow"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayMeta: document.getElementById("overlayMeta"),
    overlayDesc: document.getElementById("overlayDesc"),
    overlayGrid: document.getElementById("overlayGrid"),

    lightbox: document.getElementById("lightbox"),
    lightboxImg: document.getElementById("lightboxImg"),
    lightboxCaption: document.getElementById("lightboxCaption"),
    lightboxDownload: document.getElementById("lightboxDownload"),
  };

  els.year.textContent = new Date().getFullYear();

  init();

  async function init() {
    try {
      const res = await fetch("data/albums.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load albums.json (" + res.status + ")");
      state.data = await res.json();
    } catch (err) {
      console.error(err);
      els.albumCount.textContent = "Could not load the archive.";
      els.emptyState.hidden = false;
      els.emptyState.textContent = "The archive could not be loaded right now. Please try again later.";
      return;
    }

    renderHeader();
    renderAlbums();
    bindGlobalEvents();
  }

  function renderHeader() {
    const { groupName, tagline, facebookUrl } = state.data;
    if (groupName) {
      document.title = groupName + " — Photo Archive";
      els.groupName.textContent = groupName;
      els.footerGroupName.textContent = groupName;
    }
    if (tagline) els.groupTagline.textContent = tagline;
    if (facebookUrl) els.fbLink.href = facebookUrl;
  }

  function renderAlbums() {
    const albums = Array.isArray(state.data.albums) ? state.data.albums : [];
    els.albumGrid.innerHTML = "";

    if (albums.length === 0) {
      els.albumCount.textContent = "0 albums";
      els.emptyState.hidden = false;
      return;
    }

    els.emptyState.hidden = true;
    els.albumCount.textContent =
      albums.length + (albums.length === 1 ? " album" : " albums");

    const sorted = [...albums].sort((a, b) =>
      (b.date || "").localeCompare(a.date || "")
    );

    for (const album of sorted) {
      els.albumGrid.appendChild(buildAlbumCard(album));
    }
  }

  function buildAlbumCard(album) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "album-card";
    card.setAttribute("aria-haspopup", "dialog");

    const photoCount = Array.isArray(album.photos) ? album.photos.length : 0;
    const cover = album.cover || (album.photos && album.photos[0] && album.photos[0].url) || "";

    card.innerHTML = `
      <div class="album-cover-wrap">
        ${cover ? `<img src="${escapeAttr(cover)}" alt="" loading="lazy">` : ""}
        <span class="album-card-badge">${photoCount} ${photoCount === 1 ? "photo" : "photos"}</span>
        <div class="album-card-body">
          <h3 class="album-card-title">${escapeHtml(album.title || "Untitled album")}</h3>
          <div class="album-card-meta">
            ${album.date ? `<span>${escapeHtml(formatDate(album.date))}</span>` : ""}
            ${album.location ? `<span>·</span><span>${escapeHtml(album.location)}</span>` : ""}
          </div>
        </div>
      </div>
    `;

    card.addEventListener("click", () => openAlbum(album));
    return card;
  }

  function openAlbum(album) {
    state.activeAlbum = album;
    const photos = Array.isArray(album.photos) ? album.photos : [];

    els.overlayEyebrow.textContent = "ALBUM // " + photos.length + (photos.length === 1 ? " PHOTO" : " PHOTOS");
    els.overlayTitle.textContent = album.title || "Untitled album";
    els.overlayMeta.textContent = [formatDate(album.date), album.location].filter(Boolean).join(" · ");
    els.overlayDesc.textContent = album.description || "";
    els.overlayDesc.hidden = !album.description;

    els.overlayGrid.innerHTML = "";
    photos.forEach((photo, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = `<img src="${escapeAttr(photo.url)}" alt="${escapeAttr(photo.caption || "")}" loading="lazy">`;
      btn.addEventListener("click", () => openLightbox(index));
      els.overlayGrid.appendChild(btn);
    });

    showOverlay(els.albumOverlay);
  }

  function openLightbox(index) {
    const photos = state.activeAlbum && state.activeAlbum.photos ? state.activeAlbum.photos : [];
    if (!photos.length) return;
    state.activePhotoIndex = (index + photos.length) % photos.length;
    renderLightboxPhoto();
    showOverlay(els.lightbox);
  }

  function renderLightboxPhoto() {
    const photos = state.activeAlbum.photos;
    const photo = photos[state.activePhotoIndex];
    els.lightboxImg.src = photo.url;
    els.lightboxImg.alt = photo.caption || state.activeAlbum.title || "";
    els.lightboxCaption.textContent = photo.caption || "";
    els.lightboxCaption.hidden = !photo.caption;
    els.lightboxDownload.href = photo.url;
    const filename = (state.activeAlbum.title || "photo").replace(/\s+/g, "-").toLowerCase();
    els.lightboxDownload.setAttribute("download", `${filename}-${state.activePhotoIndex + 1}.jpg`);
  }

  function navigateLightbox(delta) {
    const photos = state.activeAlbum.photos;
    state.activePhotoIndex = (state.activePhotoIndex + delta + photos.length) % photos.length;
    renderLightboxPhoto();
  }

  function showOverlay(el) {
    el.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function hideOverlay(el) {
    el.hidden = true;
    if (els.albumOverlay.hidden && els.lightbox.hidden) {
      document.body.style.overflow = "";
    }
  }

  function bindGlobalEvents() {
    document.querySelectorAll("[data-close-album]").forEach((btn) =>
      btn.addEventListener("click", () => hideOverlay(els.albumOverlay))
    );
    document.querySelectorAll("[data-close-lightbox]").forEach((btn) =>
      btn.addEventListener("click", () => hideOverlay(els.lightbox))
    );
    document.querySelectorAll("[data-nav]").forEach((btn) =>
      btn.addEventListener("click", () => navigateLightbox(Number(btn.dataset.nav)))
    );

    [els.albumOverlay, els.lightbox].forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) hideOverlay(overlay);
      });
    });

    document.addEventListener("keydown", (e) => {
      if (!els.lightbox.hidden) {
        if (e.key === "Escape") hideOverlay(els.lightbox);
        if (e.key === "ArrowRight") navigateLightbox(1);
        if (e.key === "ArrowLeft") navigateLightbox(-1);
      } else if (!els.albumOverlay.hidden && e.key === "Escape") {
        hideOverlay(els.albumOverlay);
      }
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
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
