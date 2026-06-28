# Monthly Cashflow Figures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app open on the Owned tab by default, add a "Monthly cashflow" stat tile to the Portfolio dashboard (sum across all owned properties), and add a read-only per-property "Monthly cashflow" figure to each property's Owned-tab Tenancy panel.

**Architecture:** Three small, independent edits in `app.js` — no new files, no new functions beyond one new local variable per change. All three reuse calculations the app already performs (`computeDeal()`'s `cashflow` field) and copy an existing colour-coding pattern already used for "Annual cashflow" elsewhere in the same file.

**Tech Stack:** Plain vanilla JS, no build step, no test framework — verification is manual, in a real browser via `npx serve .`, same as prior features in this app.

**Source of truth:** `/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property/app.js` and the approved spec at `docs/superpowers/specs/2026-06-28-monthly-cashflow-figures-design.md`. Line numbers below were re-verified against the current file immediately before writing this plan — re-check with `grep -n` before editing in case anything has shifted since.

---

### Task 1: Change the default tab to Owned

**Files:**
- Modify: `app.js:128`

- [ ] **Step 1: Re-verify the line**

Run: `grep -n "^let view" app.js`
Expected: one match at line 128.

- [ ] **Step 2: Change `section`'s default value**

Current:
```js
let view = "list", currentId = null, tab = "deal", homeMode = "list", section = "analysis", analysisSub = "numbers", sectionTab = "items";
```
Change to:
```js
let view = "list", currentId = null, tab = "deal", homeMode = "list", section = "owned", analysisSub = "numbers", sectionTab = "items";
```
Only `section`'s value changes (`"analysis"` → `"owned"`) — every other variable on this line is untouched.

- [ ] **Step 3: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5550 .
```
Open `http://localhost:5550/index.html`. Expected: the app opens directly on the "Owned" phase tab (showing the Portfolio dashboard), not "Analysis". Confirm you can still click "Analysis"/"Purchasing"/"Refurbishing" and switch between all four tabs normally — this change only affects which tab is selected on first load, not the tab-switching mechanism itself. No console errors. Stop the server once confirmed.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: open the app on the Owned tab by default"
```

---

### Task 2: Add the "Monthly cashflow" stat tile to the Portfolio dashboard

**Files:**
- Modify: `app.js:449-493` (`renderPortfolioHTML()`)

- [ ] **Step 1: Re-verify the function content**

Run: `grep -n "^function renderPortfolioHTML\b" app.js` and read lines 449-493 with `sed -n` to confirm the accumulator loop and stats row are still exactly as quoted below.

- [ ] **Step 2: Add a `totCashflow` accumulator alongside the existing ones**

Current:
```js
  let totRent=0, totAnnual=0, totEquity=0;
  owned.forEach(d=>{ const c=computeDeal(d), m=d.manage||{}; totRent+=(num(m.rent)||c.rent); totAnnual+=c.annual;
    const realMortgage=m.mortgage&&num(m.mortgage.amount)>0?num(m.mortgage.amount):c.mortgage;
    totEquity+=(num(d.deal.duv)-realMortgage); });
```
Change to:
```js
  let totRent=0, totAnnual=0, totEquity=0, totCashflow=0;
  owned.forEach(d=>{ const c=computeDeal(d), m=d.manage||{}; totRent+=(num(m.rent)||c.rent); totAnnual+=c.annual; totCashflow+=c.cashflow;
    const realMortgage=m.mortgage&&num(m.mortgage.amount)>0?num(m.mortgage.amount):c.mortgage;
    totEquity+=(num(d.deal.duv)-realMortgage); });
```
This adds `totCashflow` to the same loop that already runs once over every owned property — no second iteration, no new function call (`c.cashflow` comes from the `computeDeal(d)` call already on this line).

- [ ] **Step 3: Insert the new stat tile, between "Monthly rent" and "Annual cashflow"**

Current:
```js
    <div class="pstats">
      <div class="pstat"><div class="k">Properties owned</div><div class="v">${owned.length}</div></div>
      <div class="pstat"><div class="k">Monthly rent</div><div class="v">${money(totRent)}</div></div>
      <div class="pstat"><div class="k">Annual cashflow</div><div class="v" style="${totAnnual<0?'color:var(--bad)':''}">${money(totAnnual)}</div></div>
      <div class="pstat"><div class="k">Est. equity</div><div class="v">${money(totEquity)}</div></div>
    </div>
```
Change to:
```js
    <div class="pstats">
      <div class="pstat"><div class="k">Properties owned</div><div class="v">${owned.length}</div></div>
      <div class="pstat"><div class="k">Monthly rent</div><div class="v">${money(totRent)}</div></div>
      <div class="pstat"><div class="k">Monthly cashflow</div><div class="v" style="${totCashflow<0?'color:var(--bad)':''}">${money(totCashflow)}</div></div>
      <div class="pstat"><div class="k">Annual cashflow</div><div class="v" style="${totAnnual<0?'color:var(--bad)':''}">${money(totAnnual)}</div></div>
      <div class="pstat"><div class="k">Est. equity</div><div class="v">${money(totEquity)}</div></div>
    </div>
```
The new tile's colour-coding (`style="${totCashflow<0?'color:var(--bad)':''}"`) is a direct copy of the existing "Annual cashflow" tile's pattern on the line immediately below it — same CSS variable, same ternary shape, just a different variable name.

- [ ] **Step 4: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5550 .
```
Open `http://localhost:5550/index.html`. The app should already be on the Owned tab (per Task 1). Confirm:
- The stats row now shows five tiles in this order: Properties owned, Monthly rent, **Monthly cashflow**, Annual cashflow, Est. equity.
- The Monthly cashflow figure must equal exactly `Annual cashflow ÷ 12` — not approximately, exactly. This is guaranteed by the code itself (`app.js:286`: `annual=cashflow*12`, so summing `cashflow` across properties and summing `annual` across the same properties are related by an exact factor of 12), so if you see any rounding-level mismatch when you divide the displayed Annual cashflow by 12, that indicates a real bug (e.g. an accidental double-count or wrong variable used), not acceptable approximation — investigate before proceeding. (Monthly rent has no required numeric relationship to either cashflow figure — rent is one input among several that produce cashflow, so don't expect or check a ratio there.)
- If there are no owned properties yet, all five tiles show `£0`/`0`, no errors.
- If you have an owned property with a negative cashflow, confirm the new tile renders in red (`var(--bad)`), matching the Annual cashflow tile's colour in that same scenario.
- No console errors.

Stop the server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: add Monthly cashflow stat tile to Portfolio dashboard"
```

---

### Task 3: Add the per-property "Monthly cashflow" figure to the Owned tab

**Files:**
- Modify: `app.js:993-1041` (`renderManage(d)`)

- [ ] **Step 1: Re-verify the function's opening and the Tenancy panel's Rent (PCM) field**

Run: `grep -n "^function renderManage\b" app.js` and read from there through the Tenancy panel (`sed -n '993,1045p' app.js`) to confirm the function currently starts with only `const m=ensureManage(d);` (no `computeDeal` call), and that the Rent (PCM) field is still exactly as quoted below.

- [ ] **Step 2: Call `computeDeal(d)` at the top of the function**

Current:
```js
function renderManage(d){
  const m=ensureManage(d);
  const wrap=document.getElementById("tabwrap");
```
Change to:
```js
function renderManage(d){
  const m=ensureManage(d), c=computeDeal(d);
  const wrap=document.getElementById("tabwrap");
```
`computeDeal` is an existing top-level function already used the same way in several other render functions (e.g. `renderPortfolioHTML`, `renderDeal`, `renderPurchasing`) — this is not a new function, just a new call site.

- [ ] **Step 3: Add the read-only field next to "Rent (PCM)"**

Current:
```js
        <div class="field"><label>Rent (PCM)</label><div class="prefix"><span>£</span><input inputmode="decimal" id="m_rent" value="${esc(m.rent)}" placeholder="${esc(d.deal.rent||'')}"></div></div>
        <div class="field"><label>Deposit</label><div class="prefix"><span>£</span><input inputmode="decimal" id="m_deposit" value="${esc(m.deposit)}"></div></div>
```
Change to:
```js
        <div class="field"><label>Rent (PCM)</label><div class="prefix"><span>£</span><input inputmode="decimal" id="m_rent" value="${esc(m.rent)}" placeholder="${esc(d.deal.rent||'')}"></div></div>
        <div class="field"><label>Monthly cashflow</label><div style="border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:15px;font-weight:600;background:var(--surface);${c.cashflow<0?'color:var(--bad)':''}">${money(c.cashflow)}</div></div>
        <div class="field"><label>Deposit</label><div class="prefix"><span>£</span><input inputmode="decimal" id="m_deposit" value="${esc(m.deposit)}"></div></div>
```
This is a read-only `<div>`, not an `<input>` — there's nothing to edit, it's derived from `computeDeal(d)`. Its inline style is a deliberate, concrete copy of `.field input`'s box (`styles.css:77`: `border:1px solid var(--line);border-radius:10px;padding:11px 12px;font-size:15px;font-weight:600`), so it visually matches the editable boxes around it in border/padding/size/weight — except the background is `var(--surface)` (the page's background colour) instead of `var(--paper)` (the editable-input background), which is the established convention in this file for "informational, non-editable box" treatments (see e.g. `.comp-avg`, `.callout`, `.stagesel` in `styles.css`, all of which use `background:var(--surface)` to read as non-interactive). Do not invent a different style or defer this decision — use exactly the inline style given above.

- [ ] **Step 4: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5550 .
```
Open `http://localhost:5550/index.html`, open a property that's in (or move one to) the Owned phase, and on its Owned tab confirm:
- The Tenancy panel's grid now shows "Monthly cashflow" as a read-only figure directly after "Rent (PCM)", before "Deposit".
- The figure matches what's shown for this same property elsewhere (e.g. the Analysis tab's cashflow figure for this deal, or this property's row in the Portfolio table's "Cashflow/mo" column) — they all derive from the same `computeDeal(d).cashflow`, so they must agree.
- If this property's cashflow is negative, the figure renders in red.
- Editing "Rent (PCM)" and switching tabs away and back updates the Monthly cashflow figure to reflect the new rent (since `renderManage(d)` re-runs `computeDeal(d)` on every render).
- No console errors.

Stop the server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: show per-property Monthly cashflow on the Owned tab"
```

---

### Task 4: Final end-to-end regression verification and push

**Files:** none — verification and deployment only

- [ ] **Step 1: Full regression pass in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5550 .
```
Open `http://localhost:5550/index.html` and walk through:
- App opens on the Owned tab (Task 1).
- Portfolio dashboard shows all five stat tiles correctly, including the new Monthly cashflow tile (Task 2).
- A property's Owned tab shows the new per-property Monthly cashflow figure next to Rent (PCM), and it updates live when Rent (PCM) changes (Task 3).
- Switching to Analysis, Purchasing, and Refurbishing tabs still works normally — confirms the default-tab change in Task 1 didn't break tab-switching itself.
- The Owned tab's other panels (Mortgage, Compliance, Maintenance — from prior features) still render and function correctly, confirming `computeDeal(d)` being newly called in `renderManage(d)` didn't introduce any side effects or errors elsewhere in that function.
- The Purchasing tab's Finance raised panel (from the immediately prior feature) still works correctly — confirms no regression there either.
- No console errors anywhere in the walkthrough.

Stop the server once confirmed.

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Confirm the live GitHub Pages site reflects the change**

Open `https://peteowen78.github.io/poco-property/` (allow a minute or two for GitHub Pages to redeploy after the push) and spot-check that it opens on the Owned tab and shows the new Monthly cashflow figures in both places.
