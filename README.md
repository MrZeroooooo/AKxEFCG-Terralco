# Terralco Archive

A one-page photo archive for **Arknights x Endfield CG: Terralco**. Visitors browse albums and save photos; only people you approve (admin + collaborators) can upload new ones.

- Plain HTML/CSS/JS — no framework, no build step
- One JSON file (`data/albums.json`) drives the whole page — add an album and it just shows up
- Deploys as-is on **Netlify** or **Vercel**
- Uploading is gated: a name+password sign-in, photos go straight to Cloudinary, new albums/photos are committed to `data/albums.json` via the GitHub API, which triggers your host's normal auto-redeploy

If you only want the **viewing site** and don't need in-browser uploading, you can deploy this as-is right now and skip the "Enable uploading" section — you'd just edit `data/albums.json` by hand and push. Everything below is for the optional upload panel.

---

## Project structure

```
index.html            The one-page site visitors see
admin.html             Sign-in + upload panel for admin/collaborators
css/style.css          Main site styling
css/admin.css           Admin panel styling
js/main.js              Renders albums from data/albums.json, lightbox, etc.
js/admin.js              Login, album creation, uploads
data/albums.json        ALL your content lives here — this is the "database"
lib/                     Shared server-side logic (auth, Cloudinary, GitHub)
netlify/functions/       Thin wrappers so the logic in lib/ runs on Netlify
api/                     Thin wrappers so the logic in lib/ runs on Vercel
netlify.toml             Netlify config (also redirects /api/* to functions)
vercel.json               Vercel config
.env.example             List of environment variables you need to set
```

Both `netlify/functions/*.js` and `api/*.js` call into the same `lib/` code, so there's only one place to maintain the actual logic — the front end always calls `/api/...`, and `netlify.toml` quietly redirects that to Netlify's function path when hosted there.

---

## 1. Add your content

Open `data/albums.json`. Set:

- `"groupName"` — already set to "Arknights x Endfield CG: Terralco"
- `"facebookUrl"` — replace with your real Facebook page link
- `"albums"` — replace the sample album, or add more. Each album looks like:

```json
{
  "id": "wave-con-2026",
  "title": "Wave Convention 2026",
  "date": "2026-03-14",
  "location": "SMX Convention Center",
  "description": "Our first crossover shoot as a group.",
  "cover": "https://your-image-url/cover.jpg",
  "photos": [
    { "url": "https://your-image-url/1.jpg", "caption": "" },
    { "url": "https://your-image-url/2.jpg", "caption": "Optional caption" }
  ]
}
```

You can host images anywhere (Cloudinary, Imgur, your own bucket) and just paste URLs here — you don't need the admin panel to add content this way.

---

## 2. Deploy the site (viewing works immediately)

### Netlify
1. Push this folder to a GitHub repo.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Build command: leave blank. Publish directory: `.`
4. Deploy. Viewers can now browse and save photos.

### Vercel
1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project**, pick the repo.
3. Framework preset: **Other**. Build command: none. Output directory: `.`
4. Deploy.

Either way, the FB button already points wherever you set `facebookUrl` and opens in a new tab.

---

## 3. Enable in-browser uploading (optional)

This lets you and collaborators log in at `/admin.html` and upload photos without touching code. It needs two free third-party pieces:

### 3a. Create a Cloudinary account (image hosting)
1. Sign up free at [cloudinary.com](https://cloudinary.com).
2. From your dashboard, copy your **Cloud name**, **API Key**, and **API Secret**.

### 3b. Create a GitHub token (so uploads can publish to your repo)
1. In GitHub: **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Limit it to **only this repository**.
3. Under Permissions, grant **Contents: Read and write**.
4. Copy the token — you won't see it again.

### 3c. Set environment variables
In your Netlify or Vercel project settings (**Site settings → Environment variables** / **Project settings → Environment Variables**), add:

| Variable | Example | Notes |
|---|---|---|
| `AUTH_SECRET` | (long random string) | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ALLOWED_EDITORS` | `{"admin":"pick-a-strong-password","yuki":"another-password"}` | JSON object — one entry per person who can upload |
| `CLOUDINARY_CLOUD_NAME` | `dxxxxxx` | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | `123456789012345` | From Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | `abc123...` | From Cloudinary dashboard — keep secret |
| `GITHUB_TOKEN` | `github_pat_...` | The fine-grained token from step 3b |
| `GITHUB_REPO` | `yourname/terralco-archive` | `owner/repo` of this project |
| `GITHUB_BRANCH` | `main` | Whatever branch your host deploys from |

Redeploy after adding the variables so the functions can read them.

### 3d. Use it
1. Go to `yoursite.com/admin.html`.
2. Sign in with one of the name/password pairs from `ALLOWED_EDITORS`.
3. Create an album, then upload photos to it. Photos upload straight to Cloudinary, and the album data is committed to `data/albums.json` in your repo — which triggers a normal redeploy. New photos usually appear within a minute.

**Adding or removing a collaborator:** just edit the `ALLOWED_EDITORS` value and redeploy — no code changes needed.

**Security note:** this is a lightweight, dependency-free auth scheme suitable for a fan community archive — a shared password per person, checked server-side, with short-lived signed session tokens. It is not intended for anything storing sensitive personal or financial data.

---

## 4. Local testing (optional)

You need Node 18+ (for built-in `fetch`).

```bash
npm install -g netlify-cli   # or: npm install -g vercel
cp .env.example .env         # fill in real values
netlify dev                  # or: vercel dev
```

Either CLI serves the static files and runs the functions locally so you can test login/upload end to end.

---

## Customizing further

- **Theme:** colors and fonts are defined as CSS variables at the top of `css/style.css`.
- **Copy:** the hero text lives directly in `index.html`.
- **More fields per photo/album:** extend the objects in `data/albums.json` and update `js/main.js`'s rendering — the structure is intentionally simple so this stays easy.
