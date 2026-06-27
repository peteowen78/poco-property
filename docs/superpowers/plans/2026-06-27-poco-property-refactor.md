# POCO Property Static-Site Refactor & Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single-file `poco-deal-tool.html` prototype into a properly structured no-build static site (`index.html` / `styles.css` / `app.js` / `firebase-config.js` / `assets/poco-logo.png`), push it to a new public GitHub repo, and enable GitHub Pages — with zero change to UI, copy, or calculations.

**Architecture:** Pure mechanical extraction. The prototype's `<style>` block becomes `styles.css`, the embedded base64 logo becomes a real PNG asset, the Firebase config/allow-list constants become `firebase-config.js`, and the remaining `<script>` body becomes `app.js`. `index.html` keeps the markup and wires the four files together with plain `<link>`/`<script>` tags — no bundler, no build step.

**Tech Stack:** Plain HTML/CSS/vanilla JS, Firebase compat SDK (CDN), GitHub Pages, `gh` CLI.

**Source of truth:** `poco-deal-tool.html` (already in the project root) — line numbers below refer to this file as it currently stands. Do not alter any CSS rule, any string of copy, or any line inside the calculation functions (`computeDeal`, `computeRefurb`, stamp duty, ROI ladder, 145% test, etc.) — copy them verbatim.

**Known exact line boundaries in `poco-deal-tool.html`** (verified by inspection — re-verify with `grep -n` if the file has changed):
- `<style>` block: lines 14–324 (content to extract: 15–323)
- `<body>` opens: line 326; logo `<img>` is on line 328 (the only `data:image/png;base64,...` in the file)
- `<script>` opens: line 339; closes: line 1481
- Firebase config block (comment + `firebaseConfig` + `ALLOWED_EMAILS` + `USE_FIREBASE`): lines 340–356
- Rest of app logic: lines 359–1480

---

### Task 1: Initialize the standalone git repo

**Files:**
- Create: `.gitignore`

**Directory:** `/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property` (this is its own repo, independent of the parent `AI PROJECTS` repo)

- [ ] **Step 1: Confirm this folder isn't already nested inside another repo's tracked area**

Run: `git -C "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property" rev-parse --show-toplevel 2>&1`
Expected: either an error ("not a git repository") or it prints the parent `AI PROJECTS` path — either way, proceed with `git init` in `Poco Property` itself; the parent repo will simply not track this folder going forward (it's currently untracked there too).

- [ ] **Step 2: Initialize the repo**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
git init
```

- [ ] **Step 3: Create `.gitignore`**

```
.DS_Store
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: initialize repo"
```

---

### Task 2: Extract `styles.css`

**Files:**
- Create: `styles.css`

- [ ] **Step 1: Re-verify the `<style>` block boundaries**

Run: `grep -n "^<style>\|^</style>" poco-deal-tool.html`
Expected: `14:<style>` and `324:</style>` (if different, adjust the line numbers in Step 2 accordingly)

- [ ] **Step 2: Extract the CSS content (lines between the tags, exclusive)**

```bash
sed -n '15,323p' poco-deal-tool.html > styles.css
```

- [ ] **Step 3: Verify nothing was lost or mangled**

Run: `wc -l styles.css` (expect 309 lines) and `head -3 styles.css` (expect the `:root{` block)

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "refactor: extract styles.css from prototype"
```

---

### Task 3: Extract the logo to a real PNG asset

**Files:**
- Create: `assets/poco-logo.png`

- [ ] **Step 1: Confirm there's exactly one embedded image**

Run: `grep -c "data:image" poco-deal-tool.html`
Expected: `1`

- [ ] **Step 2: Create the assets directory**

```bash
mkdir -p assets
```

- [ ] **Step 3: Decode the base64 data URI to a PNG file**

```bash
grep -o 'data:image/png;base64,[A-Za-z0-9+/=]*' poco-deal-tool.html \
  | sed 's/^data:image\/png;base64,//' \
  | base64 -d > assets/poco-logo.png
```

- [ ] **Step 4: Verify the PNG is valid**

Run: `file assets/poco-logo.png`
Expected: output contains `PNG image data`

- [ ] **Step 5: Commit**

```bash
git add assets/poco-logo.png
git commit -m "refactor: extract logo to assets/poco-logo.png"
```

---

### Task 4: Extract `firebase-config.js`

**Files:**
- Create: `firebase-config.js`

- [ ] **Step 1: Re-verify the config block boundaries**

Run: `grep -n "const firebaseConfig\|const ALLOWED_EMAILS\|const USE_FIREBASE" poco-deal-tool.html`
Expected: `345:const firebaseConfig = {`, `354:const ALLOWED_EMAILS = ...`, `356:const USE_FIREBASE = ...` (block starts at the comment on line 340)

- [ ] **Step 2: Extract lines 340–356 verbatim**

```bash
sed -n '340,356p' poco-deal-tool.html > firebase-config.js
```

- [ ] **Step 3: Verify the file's content**

Run: `cat firebase-config.js`
Expected: the `FIREBASE SETUP` comment header, the `firebaseConfig` object with `PASTE_` placeholders, the `ALLOWED_EMAILS` array with the two placeholder emails, and the `USE_FIREBASE` line — nothing else.

- [ ] **Step 4: Commit**

```bash
git add firebase-config.js
git commit -m "refactor: extract firebase-config.js (placeholders, demo mode by default)"
```

---

### Task 5: Extract `app.js`

**Files:**
- Create: `app.js`

- [ ] **Step 1: Re-verify the script block boundaries**

Run: `grep -n "^<script>\|^</script>" poco-deal-tool.html`
Expected: `339:<script>` and `1481:</script>` (the *first* line, opening the inline script after the Firebase CDN `<script src>` tags)

- [ ] **Step 2: Extract everything after the firebase-config block to just before `</script>`**

```bash
sed -n '359,1480p' poco-deal-tool.html > app.js
```

(Lines 357–358 — a `/* ==== */` divider and a blank line closing the firebase-config block — are intentionally dropped here; they're pure decoration with no code, already implicitly closed by the config block ending at 356.)

- [ ] **Step 3: Verify no leftover Firebase-config lines and no truncation**

Run: `head -5 app.js` (expect the `POCO DEAL TOOL — Phase 1 working prototype` comment block) and `tail -5 app.js` (expect this to be genuine end-of-logic, not a cut-off statement)
Run: `grep -n "firebaseConfig\|ALLOWED_EMAILS" app.js`
Expected: no matches (those now live only in `firebase-config.js`)

- [ ] **Step 4: Sanity-check JS validity**

Run: `node --check app.js`
Expected: no output (syntax OK). If Node isn't available, use `node -e "new Function(require('fs').readFileSync('app.js','utf8'))"` or skip and rely on the browser console check in Task 6.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "refactor: extract app.js from prototype"
```

---

### Task 6: Build `index.html` and wire everything together

**Files:**
- Create: `index.html`
- Reference (read-only, not modified): `poco-deal-tool.html`

- [ ] **Step 1: Extract the `<head>` content (everything before `<style>`) and the markup body (everything from `<body>` to `<script>`, exclusive)**

```bash
sed -n '1,13p' poco-deal-tool.html > /tmp/head-top.html
sed -n '326,338p' poco-deal-tool.html > /tmp/body-markup.html
```

- [ ] **Step 2: Inspect both fragments**

Run: `cat /tmp/head-top.html` — expect the `<!doctype html>`, `<title>`, Google Fonts links, and the three Firebase CDN `<script>` tags.
Run: `cat /tmp/body-markup.html` — expect the `.topbar` div (with the `<img src="data:image/png;base64,...">` line), the `#app` div, and the `#authgate` div.

- [ ] **Step 3: Write `index.html`**

Assemble from the fragments, with two changes only:
1. Add `<link rel="stylesheet" href="styles.css">` after the Google Fonts `<link>` tags (in place of the old inline `<style>...</style>` block).
2. Replace the base64 `<img src="data:image/png;base64,...">` with `<img src="assets/poco-logo.png" alt="POCO Property">`.
3. Add `<script src="firebase-config.js"></script>` and `<script src="app.js"></script>` at the very end of `<body>`, in that order, in place of the old inline `<script>...</script>` block.

The resulting file should read, structurally:

```html
<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>POCO Deal Tool</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,700;1,800;1,900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
<!-- Firebase (backend: shared database + Google sign-in). Loaded for everyone; only used once you add your config below. -->
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
</head>
<body>
  <div class="topbar">
    <img src="assets/poco-logo.png" alt="POCO Property">
    <div class="topbar-right">
      <span class="pill" id="demobadge" style="display:none"><span class="dot" style="background:var(--warn)"></span>Demo mode</span>
      <span class="pill" id="who" style="display:none"></span>
      <button class="iconbtn" id="signout" style="display:none">Sign out</button>
      <button class="iconbtn" id="navSettings">Settings</button>
    </div>
  </div>
  <div class="wrap" id="app"></div>
  <div id="authgate" class="authgate"></div>

<script src="firebase-config.js"></script>
<script src="app.js"></script>
</body>
</html>
```

Copy the exact attribute values and ids from `/tmp/body-markup.html` rather than retyping from memory — the snippet above is a guide, not a substitute for checking the real markup (in case the original prototype has more elements between `#app` and `#authgate`, or different ids).

- [ ] **Step 4: Diff against the original for anything missed**

Run: `diff <(sed -n '1,13p' poco-deal-tool.html) <(sed -n '1,13p' index.html)` — expect no diff except the inserted `<link rel="stylesheet">` line and removed inline Firebase comment placement (only the intentional changes from Step 3).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "refactor: assemble index.html from extracted parts"
```

---

### Task 7: Verify the split app runs identically to the prototype

**Files:** none (verification only)

- [ ] **Step 1: Serve the directory locally**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5500 .
```

(Use `npx serve`, not Python's `http.server`, per prior project history of permission issues with the user's environment — see memory `760` if `npx serve` itself fails.)

- [ ] **Step 2: Open both versions side by side in a browser**

Open `http://localhost:5500/index.html` and, separately, `poco-deal-tool.html` directly (`file://` URL) in two tabs.

- [ ] **Step 3: Visually compare**

Confirm: top bar with logo + yellow underline renders identically; "Demo mode" pill shows (since `firebase-config.js` still has `PASTE_` placeholders); deals list / empty state looks the same; fonts (Archivo, italic headings) load correctly.

- [ ] **Step 4: Functionally compare**

In `index.html`: add a test deal, open it, add a refurb item, check the running total updates, check Settings opens and assumptions are editable. Confirm the numbers match what the same actions produce in `poco-deal-tool.html`.

- [ ] **Step 5: Check the browser console**

Open DevTools console on the `index.html` tab. Expected: no red errors. (Firebase will log a harmless config/auth-domain warning in demo mode — confirm this matches what the original prototype also logs, not a new error.)

- [ ] **Step 6: Stop the local server**

Stop the `npx serve` process (Ctrl-C or kill the background task).

---

### Task 8: Write `README.md`

**Files:**
- Create: `README.md`
- Reference: `POCO-Firebase-Setup-Guide.md` (already in the project root — link to it, don't duplicate its content)

- [ ] **Step 1: Write the README**

Content must cover, in plain English (this app is maintained by two non-technical owners):
1. **What this is** — one paragraph: POCO Property deal-analysis and management app for the SPV, built as a no-build static site.
2. **Running it locally** — `npx serve .` (or just opening `index.html` directly) plus a note that it runs in Demo mode (data stays on-device) until Firebase is configured.
3. **What you (the owners) need to do in the Firebase console first** — a clear bulleted list, before any file editing: create a Firebase project; enable Google sign-in under Authentication; create a Firestore database. Link to `POCO-Firebase-Setup-Guide.md` for the full walkthrough of these console steps.
4. **Adding Firebase config** — edit `firebase-config.js`, replace the `PASTE_` values from the Firebase console, add both owners' real Google emails to `ALLOWED_EMAILS`.
5. **Where the Firestore security rules go** — paste them into Firebase console → Firestore → Rules; reproduce the exact rules block from the build brief, with a `<!-- replace with your real emails -->` placeholder.
6. **Authorizing the GitHub Pages domain** — Firebase console → Authentication → Settings → Authorized domains → add `<username>.github.io` (no `https://`).
7. **Deploying an update** — `git add -A && git commit -m "..." && git push`; GitHub Pages redeploys automatically within a minute or two.
8. A short note that the web config (`apiKey` etc.) is safe to commit publicly — it's not a secret; the real protection is the security rules + email allow-list.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README for repo setup, Firebase config, and deployment"
```

---

### Task 9: Push to a new public GitHub repo

**Files:** none

- [ ] **Step 1: Confirm `gh` is authenticated**

Run: `gh auth status`
Expected: shows a logged-in account. If not authenticated, run `gh auth login` and follow prompts (interactive — hand control to the user if needed).

- [ ] **Step 2: Create the repo and push (ask the user for the repo name first if not already agreed — suggest `poco-property`)**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
gh repo create poco-property --public --source=. --remote=origin --push
```

- [ ] **Step 3: Verify the push succeeded**

Run: `git log --oneline -1` and `gh repo view --web` (or just `gh repo view` for terminal output) to confirm the remote has all commits.

---

### Task 10: Enable GitHub Pages

**Files:** none

- [ ] **Step 1: Enable Pages via `gh` or the web UI**

Try via CLI first:
```bash
gh api repos/{owner}/poco-property/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```
If that fails (API shape varies by GitHub Pages settings), tell the user to do it manually: repo → Settings → Pages → Build and deployment → Source: "Deploy from a branch" → Branch: `main`, folder `/ (root)` → Save.

- [ ] **Step 2: Confirm the live URL**

Run: `gh api repos/{owner}/poco-property/pages --jq .html_url` (may take a minute to become available after first enabling)
Expected URL shape: `https://<username>.github.io/poco-property/`

- [ ] **Step 3: Load the live URL and sanity-check**

Confirm the page loads, shows Demo mode (since `firebase-config.js` still has placeholders), and the logo/styles render — i.e. GitHub Pages is serving `assets/poco-logo.png` and `styles.css` correctly as separate static files (this is the main risk point of the whole refactor: relative paths breaking on Pages).

---

### Task 11: Final handoff note to the user

**Files:** none — communication only

- [ ] **Step 1: Tell the user, in the chat, exactly what they still need to do themselves** (per the build brief's "what the human will do" section):
  1. Create the Firebase project, enable Google sign-in, create the Firestore database.
  2. Paste the security rules (from `README.md`) into Firebase console, with their two real emails.
  3. Copy their real web config into `firebase-config.js`, replacing the `PASTE_` values, and add their two real emails to `ALLOWED_EMAILS`.
  4. Add the live GitHub Pages domain to Firebase → Authentication → Settings → Authorized domains.
  5. Commit and push those two file edits — Pages redeploys automatically.

- [ ] **Step 2: Give the user the live URL and the repo URL.**
