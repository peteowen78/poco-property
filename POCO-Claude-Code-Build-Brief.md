# POCO Property — Build Brief for Claude Code

## How to use this brief
Paste this whole file into Claude Code as your first message, and **attach these three files** from the same project:
1. `poco-deal-tool.html` — the working prototype (the source of truth for everything).
2. `Property-App-Design-Spec.md` — the design/spec document.
3. `POCOLogos01.png` — the horizontal logo.

Then let Claude Code work through the build order at the bottom.

---

## 1. What we're building
**POCO** is a private deal-analysis and property-management web app for a small UK property-investment company (a limited company / SPV doing buy-to-let and BRRR in St Helens, Merseyside). Two people use it. It already exists as a complete single-file prototype — your job is to turn that prototype into a properly structured, version-controlled site hosted on **GitHub Pages**, with the existing **Firebase** backend (Google sign-in + shared database) configured and live.

**This is a refactor-and-deploy, not a rebuild.** Use the attached `poco-deal-tool.html` as the authoritative source for all UI, styling, layout, copy and — critically — all financial calculations. Do **not** redesign the interface or change any of the maths. Restructure and deploy it; don't reinvent it.

## 2. Users & context
- Two non-technical users (the company's owners). One is a designer.
- Used on both mobile (on viewings, on the road) and desktop.
- Brand: "POCO PROPERTY" — heavy italic condensed black type, electric-yellow (`#F8E800`) underline accent, black/white/yellow palette, Archivo font. All of this is already implemented in the prototype; preserve it exactly.

## 3. Tech stack & constraints
- **Recommended (assumed): no-build static site** — plain HTML, CSS and vanilla JavaScript. No framework, no bundler, no build step. This deploys to GitHub Pages with zero configuration and is the easiest for the owners to maintain. *(If the user has instead asked for a React/Vite build, follow that; otherwise stay no-build.)*
- **Backend: Firebase** — Firestore (database) + Firebase Authentication (Google sign-in). The prototype already integrates this via the Firebase compat SDK loaded from CDN. Keep that approach.
- **Hosting: GitHub Pages**, served from a repo.
- Must work fully client-side (GitHub Pages serves static files only — no server code).

## 4. Core concept: the four-phase lifecycle
Every property moves through four phases, which are the app's primary navigation:
1. **Analysis** — sourcing & running the numbers (estate agents).
2. **Purchasing** — offer agreed → conveyancing → completion (solicitors, brokers).
3. **Refurbishing** — managing the works (builders, electricians, trades).
4. **Owned** — tenanted & compliance (letting/management companies).

Each phase has its own **Properties** view and its own **Contacts** address book (shared across all properties, filed by phase). All of this is built in the prototype.

## 5. Data model (already implemented — preserve it)
The whole workspace is one object, `DATA`:
```
DATA = {
  deals:      [ Deal, ... ],
  contacts:   [ Contact, ... ],
  assumptions: { ...defaults: ltvPct, mortgageRate, stressRate, mgmtPct,
                 moePct, solicitor, broker, costOfMoney, corpTaxPct }
}
```
A **Deal** carries shared fields (`id, address, postcode, beds, price, source, stage, phase`) plus one sub-object per phase: `refurb` (cost calculator), `deal` (analysis numbers + comparables), `purchase` (agreed price, mortgage, conveyancing checklist, key dates), `refurbish` (budget-vs-actual, schedule %, contractors, snags), `manage` (tenancy, compliance certs, maintenance log).

A **Contact** is `{ id, section, name, company, role, phone, email, notes }`, where `section` is one of the four phases.

See the prototype's helper functions (`ensurePhase`, `ensurePurchase`, etc.) for exact shapes. Keep them.

## 6. Calculations (source of truth = the prototype's `computeDeal()` / `computeRefurb()`)
Do not alter the maths. For your understanding, the model includes:
- **Refurb cost calculator** — an editable cost library (kitchen, bathroom, external works, etc.) with quantities, a contingency %, and a project-management fee.
- **Max Offer / MIMO** — works backwards from the after-works value (DUV) and a target "money left in" to the maximum purchase price, solving stamp duty iteratively.
- **2026 SPV stamp duty** — limited-company rules: 5% surcharge always applies; banded 5/7/10/15/17%; flat 17% above £500k; deals under £125k = simple 5% of price.
- **Cashflow & ROI ladder** — monthly cashflow, cash-on-cash return, gross yield, annual cashflow, using the per-deal and global assumptions.
- **145% BTL stress test** — the standard lender affordability check.
- **Portfolio view** — totals plus a rough after-corporation-tax estimate.

All figures are guides, not advice; the prototype already shows a disclaimer — keep it.

## 7. Backend: Firebase (already wired in the prototype)
- **Storage model:** the entire `DATA` object is saved as one Firestore document — collection `workspace`, document `shared`, under a `payload` field. A live `onSnapshot` listener syncs changes between the two users in real time. (Single-document, last-write-wins — fine for two occasional editors. A future option is one document per deal for finer-grained concurrent editing; **out of scope for now**.)
- **Auth:** Google sign-in via a full-screen gate. Only emails in an `ALLOWED_EMAILS` list may enter.
- **Demo fallback:** if the Firebase config block still contains its `PASTE_` placeholders, the app runs in local "Demo mode" instead of failing. Keep this behaviour — it's how the site stays usable before config is added.
- **Config block:** at the top of the script there's a clearly-marked `firebaseConfig` object and `ALLOWED_EMAILS` array. In the repo, keep these in one obvious place (e.g. a `firebase-config.js` file) so the owners can edit them without hunting.

**Important — Firebase web config is NOT a secret.** The `apiKey` etc. are public client identifiers and are safe to commit to a public repo. The actual protection is (a) the Firestore **security rules**, (b) the **authorized-domains** list, and (c) the **email allow-list**. Do not treat the config as a credential or try to hide it with environment variables — that doesn't apply to a static client-side app.

**Firestore security rules** (the user pastes these into the Firebase console, with their two real emails):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function allowed() {
      return request.auth != null &&
        request.auth.token.email in ['owner1@gmail.com','owner2@gmail.com'];
    }
    match /workspace/{doc} {
      allow read, write: if allowed();
    }
  }
}
```

## 8. Suggested repo structure (no-build)
```
/ (repo root)
  index.html            # the app shell (renamed from poco-deal-tool.html)
  styles.css            # extracted from the prototype's <style>
  app.js                # extracted from the prototype's <script> (app logic)
  firebase-config.js    # the firebaseConfig object + ALLOWED_EMAILS (easy to edit)
  /assets/
    poco-logo.png       # POCOLogos01.png, referenced normally (replace the base64)
  README.md             # short: what it is, how to edit config, how to deploy
  .gitignore
```
Splitting the single file into `index.html` + `styles.css` + `app.js` + `firebase-config.js` is the main refactor. Keep it loadable directly by a browser with no build step (plain `<link>` and `<script>` tags, Firebase SDK from CDN as now). Verify the JS still parses and the app runs identically after splitting.

## 9. Deployment: GitHub Pages
1. Initialise git, commit, and push to a **GitHub repo** (the user may need to authenticate GitHub / `gh` when prompted).
2. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. The site goes live at `https://<username>.github.io/<repo>/`.
4. Tell the user to add that domain to **Firebase → Authentication → Settings → Authorized domains** (without `https://`), or Google sign-in will be blocked.
- **Public vs private repo:** a public repo is simplest and free, and the Firebase config is safe to expose. GitHub Pages on a *private* repo needs a paid GitHub plan — mention this and let the user choose.

## 10. Definition of done
- [ ] Prototype split into `index.html` / `styles.css` / `app.js` / `firebase-config.js` with **identical** appearance and behaviour to the attached file.
- [ ] Logo referenced as an image file, not base64.
- [ ] App runs locally by opening `index.html` (Demo mode, since config is still placeholders).
- [ ] Firebase config and `ALLOWED_EMAILS` sit in one clearly-commented place.
- [ ] Repo pushed to GitHub; GitHub Pages enabled and the live URL works.
- [ ] `README.md` explains, in plain English: how to add Firebase config, where the security rules go, how to add the Pages domain to Firebase, and how to deploy an update (commit + push).
- [ ] No build step required at any point.

## 11. Out of scope (do not do unless asked)
- No redesign, no restyle, no change to any calculation or wording.
- No framework migration (stay no-build) unless the user explicitly requested React/Vite.
- No per-deal document model, no multi-workspace support, no extra features — refactor and deploy only.
- Do not create the user's Firebase project, enter their credentials, or commit any real email addresses/keys the user hasn't provided. Leave placeholders and let the user fill them in.

## 12. What the human will do themselves (flag these clearly in the README)
- Create the Firebase project; enable Google sign-in; create the Firestore database and paste in the security rules; copy the web config into `firebase-config.js`; add their two emails to `ALLOWED_EMAILS`; add the GitHub Pages domain to Firebase authorized domains.
- (A separate plain-English guide for these Firebase steps already exists: `POCO-Firebase-Setup-Guide.md`.)
