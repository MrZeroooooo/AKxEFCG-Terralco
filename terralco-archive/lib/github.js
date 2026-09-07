/**
 * Shared GitHub helper.
 *
 * The site's album data lives in data/albums.json inside your git repo.
 * To let the admin panel "publish" new albums/photos without you
 * manually editing files, these functions read and write that file via
 * GitHub's Contents API using a personal access token. Committing to
 * the repo triggers Netlify/Vercel's normal auto-deploy — no extra
 * infrastructure needed.
 *
 * Required env vars:
 *   GITHUB_TOKEN   — a fine-grained PAT with Contents: read & write
 *                    access on this one repo
 *   GITHUB_REPO    — "your-username/your-repo"
 *   GITHUB_BRANCH  — defaults to "main"
 *   ALBUMS_PATH    — defaults to "data/albums.json"
 */

function getConfig() {
  const { GITHUB_TOKEN, GITHUB_REPO } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    throw new Error("Missing GITHUB_TOKEN or GITHUB_REPO environment variables.");
  }
  return {
    GITHUB_TOKEN,
    GITHUB_REPO,
    GITHUB_BRANCH: process.env.GITHUB_BRANCH || "main",
    ALBUMS_PATH: process.env.ALBUMS_PATH || "data/albums.json",
  };
}

async function readAlbumsFile() {
  const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, ALBUMS_PATH } = getConfig();
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${ALBUMS_PATH}?ref=${GITHUB_BRANCH}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub read failed (${res.status}): ${await res.text()}`);
  }

  const file = await res.json();
  const content = Buffer.from(file.content, "base64").toString("utf8");
  return { data: JSON.parse(content), sha: file.sha };
}

async function writeAlbumsFile(newData, sha, commitMessage) {
  const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, ALBUMS_PATH } = getConfig();
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${ALBUMS_PATH}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: commitMessage || "Update albums.json via admin panel",
      content: Buffer.from(JSON.stringify(newData, null, 2), "utf8").toString("base64"),
      sha,
      branch: GITHUB_BRANCH,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub write failed (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

module.exports = { readAlbumsFile, writeAlbumsFile };
