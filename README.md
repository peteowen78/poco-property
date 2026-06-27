# POCO Property

A private deal-analysis and property-management app for POCO Property's buy-to-let and BRRR deals in St Helens, Merseyside — built and run by the two company owners.

It's a plain, no-build static site: `index.html`, `styles.css`, `app.js`, and `firebase-config.js`. No bundler, no install step, no server code. The backend is Firebase — a shared database (Firestore) plus Google sign-in — so both owners see the same deals update live.

---

## Running it locally

You don't need anything installed to look at the app. Either:

- Double-click `index.html` to open it directly in a browser, or
- From a terminal in this folder, run `npx serve .` and open the address it prints.

Until Firebase is configured (see below), the app runs in **Demo mode** — a yellow "Demo mode" badge shows top-right, and your data stays only on this device. This is the normal, expected state before you've done any setup.

---

## What you (the owners) need to do in the Firebase console first

Before touching any files, do these three things in [console.firebase.google.com](https://console.firebase.google.com):

1. **Create a Firebase project** (e.g. name it `poco-property`, Analytics off).
2. **Enable Google sign-in** — Build → Authentication → Get started → Sign-in method tab → Google → Enable.
3. **Create the Firestore database** — Build → Firestore Database → Create database → Production mode → pick a UK-ish location (e.g. `europe-west2`).

The full step-by-step with screenshots-in-words is in [`POCO-Firebase-Setup-Guide.md`](POCO-Firebase-Setup-Guide.md). Note: that guide's Step 6–8 describe deploying via Netlify Drop — this repo instead deploys via **GitHub Pages** (see "Deploying an update" below), so skip those Netlify steps and use the GitHub Pages instructions here instead. Steps 1–5 of that guide (project, web app config, emails, sign-in, database + rules) still apply exactly as written.

---

## Adding your Firebase config

Open `firebase-config.js` in any text editor. Replace the six `PASTE_…` placeholder values with the real config Firebase gave you when you registered a web app (Firebase console → project settings → your web app → the `firebaseConfig` object):

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...your real key...",
  authDomain:        "poco-property.firebaseapp.com",
  projectId:         "poco-property",
  storageBucket:     "poco-property.appspot.com",
  messagingSenderId: "...",
  appId:             "..."
};
```

Then replace the two placeholder emails with your real Google accounts — only these two will be allowed to sign in:

```js
const ALLOWED_EMAILS = ["yourname@gmail.com", "yourpartner@gmail.com"];
```

**This file is safe to commit and push publicly.** The `apiKey` and friends are public client identifiers, not secrets — they're meant to be visible in a browser. The actual protection is the Firestore security rules below and the `ALLOWED_EMAILS` list above. Don't try to hide this file or use environment variables for it; that doesn't apply to a static client-side app like this one.

---

## Where the Firestore security rules go

In the Firebase console → Firestore Database → Rules tab, delete what's there and paste this in, swapping in your two real emails:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function allowed() {
      return request.auth != null &&
        request.auth.token.email in ['yourname@gmail.com','yourpartner@gmail.com'];
    }
    match /workspace/{doc} {
      allow read, write: if allowed();
    }
  }
}
```

Click **Publish**. This is what actually keeps everyone else out — only your two Google accounts can read or write the shared workspace document.

---

## Authorizing the GitHub Pages domain

Google only allows sign-in from web addresses you've approved:

1. Firebase console → Authentication → Settings tab → Authorized domains.
2. Click **Add domain** and paste your GitHub Pages address **without** the `https://` — e.g. `yourusername.github.io`.
3. Save.

Without this step, Google sign-in will be blocked on the live site (it'll still work fine when you're testing locally on `localhost`, since that's authorized by default).

---

## Deploying an update

This site is hosted on GitHub Pages, served straight from the `main` branch. To publish a change:

```bash
git add -A
git commit -m "describe what changed"
git push
```

GitHub Pages picks up the new commit and redeploys automatically, usually within a minute or two. No build step, no manual upload.

---

## Project structure

```
index.html            the app shell — markup only, loads everything else
styles.css             all the app's CSS
app.js                 all the app's logic and calculations
firebase-config.js     your Firebase project config + the two allowed emails — edit this one
assets/poco-logo.png   the POCO Property logo
poco-deal-tool.html    the original single-file prototype this app was split from — kept for reference, not loaded by index.html
```
