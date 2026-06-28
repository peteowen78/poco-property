# Finance Raised Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Purchasing tab's "Mortgage application" panel (Lender + Status) with a "Finance raised" list — multiple entries (investors, friends/family, bridging loans), each with name, amount, rate, date loaned, payback date, and a read-only auto-calculated total interest figure, plus a running total of amount raised.

**Architecture:** Single-file no-build app (`app.js` + `styles.css`, no new files). Follows the existing Contractors-list pattern (Refurbishing tab) for the list UI, and adds one new small pure-function helper for the simple-interest calculation. One new CSS grid class (`.frow`) is needed because this row has a different field count than the existing `.crow`/`.mrow` rows.

**Tech Stack:** Plain vanilla JS, no build step, no test framework — verification is manual, in a real browser via `npx serve .`, the same way the prior Owned-Mortgage feature was verified.

**Source of truth:** `/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property/app.js` and `styles.css`, and the approved spec at `docs/superpowers/specs/2026-06-28-finance-raised-section-design.md`. Re-verify every line number below with `grep -n` before editing — confirmed accurate as of commit `7d18e9b`, but re-check in case anything has shifted.

---

### Task 1: Data model — replace `lender`/`mortgageStatus` with `finance` list in `purchase`

**Files:**
- Modify: `app.js:98-105` (`ensurePurchase()`)
- Modify: `app.js:227` (the `purchase` default literal inside the new-deal object)

- [ ] **Step 1: Re-verify the line numbers**

Run: `grep -n "^function ensurePurchase\|purchase:{ agreedPrice" app.js`
Expected: matches at lines 98 and 227 (adjust below if shifted — find the equivalent code by content if so).

- [ ] **Step 2: Update `ensurePurchase()`**

Current:
```js
function ensurePurchase(d){
  if(!d.purchase) d.purchase={};
  const p=d.purchase;
  ["agreedPrice","solicitor","solicitorRef","lender","targetExchange","targetCompletion"].forEach(k=>{ if(p[k]==null) p[k]=""; });
  if(p.mortgageStatus==null) p.mortgageStatus="Not started";
  if(!p.checklist) p.checklist={};
  PURCHASE_CHECKLIST.forEach(([k])=>{ if(p.checklist[k]==null) p.checklist[k]=false; });
  return p;
}
```
Change to:
```js
function ensurePurchase(d){
  if(!d.purchase) d.purchase={};
  const p=d.purchase;
  ["agreedPrice","solicitor","solicitorRef","targetExchange","targetCompletion"].forEach(k=>{ if(p[k]==null) p[k]=""; });
  if(!Array.isArray(p.finance)) p.finance=[];
  if(!p.checklist) p.checklist={};
  PURCHASE_CHECKLIST.forEach(([k])=>{ if(p.checklist[k]==null) p.checklist[k]=false; });
  return p;
}
```
Note: `lender` is dropped from the backfill list, `mortgageStatus`'s backfill line is removed entirely, and `finance` is backfilled as an array (same pattern as `r.contractors`/`m.maintenance` elsewhere in this file). Any deal that already has old `lender`/`mortgageStatus` values keeps them in storage untouched (this app never strips unknown keys) — they're simply no longer read or displayed anywhere after this plan completes.

- [ ] **Step 3: Update the `purchase` default literal**

Current:
```js
           purchase:{ agreedPrice:"", solicitor:"", solicitorRef:"", lender:"", mortgageStatus:"Not started", targetExchange:"", targetCompletion:"", checklist:{instructed:false,searches:false,enquiries:false,offer:false,exchanged:false,completed:false} },
```
Change to:
```js
           purchase:{ agreedPrice:"", solicitor:"", solicitorRef:"", finance:[], targetExchange:"", targetCompletion:"", checklist:{instructed:false,searches:false,enquiries:false,offer:false,exchanged:false,completed:false} },
```

- [ ] **Step 4: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5531 .
```
Open `http://localhost:5531/index.html`, open DevTools console, run:
```js
DATA.deals[0].purchase
```
Expected: an object with `finance: []` and no `lender`/`mortgageStatus` keys (for a freshly-created deal). No console errors on page load — note the Purchasing tab will currently show a broken/empty "Mortgage application" panel referencing the now-removed `p.lender`/`p.mortgageStatus` until Task 2 replaces that panel; that's expected at this intermediate step, not a regression to fix now. Stop the server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: replace purchase lender/mortgageStatus with finance list in data model"
```

---

### Task 2: Add the simple-interest calculation helper

**Files:**
- Modify: `app.js` — add a new top-level function near the other small helpers (`daysTo`, `certStatus`; find with `grep -n "^function daysTo\|^function certStatus"`)

- [ ] **Step 1: Add the helper function**

Insert immediately after `certStatus()`:
```js
function loanInterest(amount,rate,dateLoaned,paybackDate){
  const a=num(amount), r=num(rate);
  if(!a || !r || !dateLoaned || !paybackDate) return null;
  const d1=new Date(dateLoaned+"T00:00:00"), d2=new Date(paybackDate+"T00:00:00");
  if(isNaN(d1) || isNaN(d2)) return null;
  const days=(d2-d1)/86400000;
  if(days<=0) return null;
  return a*(r/100)*(days/365.25);
}
```
This returns `null` whenever the inputs can't produce a valid positive-term calculation (missing amount/rate, missing/invalid dates, or payback not strictly after the loan date) — callers must check for `null` and render `—` in that case, never a calculated value.

- [ ] **Step 2: Verify with `node --check`**

Run: `node --check app.js`
Expected: no output (syntax OK).

- [ ] **Step 3: Sanity-check the formula manually**

In the browser console (server from Task 1, or start fresh with `npx --yes serve -l 5531 .`), run:
```js
loanInterest(10000, 10, "2026-01-01", "2027-01-01")
```
Expected: approximately `1000` (£10,000 at 10% for ~1 year ≈ £1000 — exact value will be slightly off 1000 due to the 365.25 divisor and the leap-year-agnostic day count, that's fine, it's a rough guide). Also check the rejection cases:
```js
loanInterest(10000, 10, "2027-01-01", "2026-01-01")  // payback before loan — expect null
loanInterest("", 10, "2026-01-01", "2027-01-01")      // missing amount — expect null
```
Stop the server once confirmed.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add loanInterest() simple-interest helper for finance entries"
```

---

### Task 3: Add the `.frow` CSS grid class

**Files:**
- Modify: `styles.css` — add near the existing `.crow`/`.mrow` rules (find with `grep -n "\.crow{" styles.css`)

- [ ] **Step 1: Re-verify the insertion point**

Run: `grep -n "\.crow{\|\.crow input{" styles.css`
Expected: two lines, the `.crow{display:grid;...}` rule and its `.crow input{...}` companion rule, immediately followed by blank/next-rule content.

- [ ] **Step 2: Add the new rule directly after the `.crow input{...}` line**

A finance row needs 7 grid cells: Name (flexible), Amount, Rate, Date loaned, Payback date, Total interest (read-only text), Delete button. Add:
```css
  .frow{display:grid;grid-template-columns:1fr 110px 90px 125px 125px 100px 34px;gap:8px;align-items:center;margin-bottom:8px}
  .frow input{border:1px solid var(--line);border-radius:9px;padding:9px 10px;font-size:13px;font-weight:600;font-family:inherit;width:100%;background:var(--paper)}
  .frow .interest{font-size:13px;font-weight:700;color:var(--ink2);text-align:right;padding-right:4px}
```

- [ ] **Step 3: Add the mobile responsive override**

Find the existing responsive block containing `.mrow{grid-template-columns:1fr 1fr}` and `.crow{grid-template-columns:1fr 1fr}` (search `grep -n "\.crow{grid-template-columns:1fr 1fr}" styles.css`). Add a matching line immediately after:
```css
    .frow{grid-template-columns:1fr 1fr}
```

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "feat: add .frow CSS grid class for finance-raised rows"
```

---

### Task 4: Replace the Mortgage application panel with Finance raised in `renderPurchasing()`

**Files:**
- Modify: `app.js:825-875` (`renderPurchasing(d)`, ending just before `function renderRefurbishing` at line 877)

- [ ] **Step 1: Re-verify the function boundaries and current panel content**

Run: `grep -n "^function renderPurchasing\b" app.js` then read the full function (it ends just before the `/* ============================================================ REFURBISHING TAB */` comment and `function renderRefurbishing`). Confirm the "Mortgage application" panel and its two bindings (`p_lender`, `p_mstatus`) are still exactly as described below before editing.

- [ ] **Step 2: Replace the panel markup**

Current (the whole "Mortgage application" panel block):
```js
    <div class="panel">
      <h3>Mortgage application</h3>
      <div class="row2">
        <div class="field"><label>Lender</label><input id="p_lender" value="${esc(p.lender)}"></div>
        <div class="field"><label>Status</label><select id="p_mstatus">${MORTGAGE_STATES.map(s=>`<option ${s===p.mortgageStatus?"selected":""}>${s}</option>`).join("")}</select></div>
      </div>
    </div>
```
Change to:
```js
    <div class="panel">
      <h3>Finance raised</h3>
      <p class="hint">Investors, friends or family, bridging loans — whatever funded this purchase. Total interest is calculated for you once an entry has an amount, rate, and both dates.</p>
      ${financeRows||`<p class="hint" style="margin:0 0 10px">No finance sources added yet.</p>`}
      <button class="btn ghost sm" id="addFin">+ Add finance</button>
      <div class="comp-avg" id="finTotWrap" style="${financeTotal?'':'display:none'}"><span><b>Total raised:</b> <span id="finTot">${money(financeTotal)}</span></span></div>
    </div>
```

- [ ] **Step 3: Add the `financeRows`/`financeTotal` computed values, before `wrap.innerHTML=`**

Immediately before the `wrap.innerHTML=`` line in `renderPurchasing(d)` (right after the existing `chkRows` computation), add:
```js
  const financeRows=p.finance.map((x,i)=>{
    const interest=loanInterest(x.amount,x.rate,x.dateLoaned,x.paybackDate);
    return `<div class="frow">
      <input data-ff="name" data-i="${i}" value="${esc(x.name||"")}" placeholder="Name">
      <div class="prefix"><span>£</span><input data-ff="amount" data-i="${i}" inputmode="decimal" value="${esc(x.amount||"")}" placeholder="Amount" style="padding-left:22px"></div>
      <div class="prefix"><input data-ff="rate" data-i="${i}" inputmode="decimal" value="${esc(x.rate||"")}" placeholder="Rate" style="padding-left:10px;padding-right:22px"><span style="left:auto;right:10px">%</span></div>
      <input type="date" data-ff="dateLoaned" data-i="${i}" value="${esc(x.dateLoaned||"")}">
      <input type="date" data-ff="paybackDate" data-i="${i}" value="${esc(x.paybackDate||"")}">
      <span class="interest">${interest==null?"—":money(interest)}</span>
      <button class="comp-del" data-fdel="${i}" title="Remove">✕</button>
    </div>`;
  }).join("");
  const financeTotal=p.finance.reduce((a,x)=>a+num(x.amount),0);
```

- [ ] **Step 4: Update the bindings — remove the old, add the new**

Current:
```js
  lb("#p_price",v=>p.agreedPrice=v); lb("#p_sol",v=>p.solicitor=v); lb("#p_solref",v=>p.solicitorRef=v); lb("#p_lender",v=>p.lender=v);
  wrap.querySelector("#p_price").addEventListener("blur",()=>renderPurchasing(d));   // refresh SDLT
  wrap.querySelector("#p_mstatus").onchange=e=>{ p.mortgageStatus=e.target.value; saveData(); };
```
Change to:
```js
  lb("#p_price",v=>p.agreedPrice=v); lb("#p_sol",v=>p.solicitor=v); lb("#p_solref",v=>p.solicitorRef=v);
  wrap.querySelector("#p_price").addEventListener("blur",()=>renderPurchasing(d));   // refresh SDLT
```
(This removes the two bindings tied to the deleted fields. The `lb()` helper itself, used by `#p_price`/`#p_sol`/`#p_solref`, is untouched.)

Then, immediately after the existing `wrap.querySelector("#p_tco").addEventListener(...)` line (still further down in the same function), add the new finance-list bindings. **Do not re-render the whole panel on every keystroke** — doing so via `wrap.innerHTML=...` would destroy and recreate the input the user is actively typing in, losing focus and cursor position after every character (this is exactly the problem the existing Maintenance-log cost field already avoids — see its comment "no re-render on edit, to keep focus" — follow that same precedent here, not the Tenancy/certs pattern that does re-render). Instead, update the one row's calculated interest and the running total directly in the DOM:

```js
  // finance raised: update the row's interest figure and the running total live, without a full re-render (preserves focus while typing)
  const updateFinRow=(i)=>{
    const x=p.finance[i];
    const interest=loanInterest(x.amount,x.rate,x.dateLoaned,x.paybackDate);
    const inp=wrap.querySelector(`[data-ff][data-i="${i}"]`);
    const row=inp?inp.closest(".frow"):null;
    const span=row?row.querySelector(".interest"):null;
    if(span) span.textContent=interest==null?"—":money(interest);
    const total=p.finance.reduce((a,y)=>a+num(y.amount),0);
    const ft=wrap.querySelector("#finTot"); if(ft) ft.textContent=money(total);
    const ftw=wrap.querySelector("#finTotWrap"); if(ftw) ftw.style.display=total?"":"none";
  };
  wrap.querySelectorAll("[data-ff]").forEach(inp=>{
    const i=+inp.dataset.i, f=inp.dataset.ff, ev=inp.type==="date"?"change":"input";
    inp.addEventListener(ev,()=>{ p.finance[i][f]=inp.value; saveData(); updateFinRow(i); });
  });
  wrap.querySelectorAll("[data-fdel]").forEach(b=>b.onclick=()=>{ p.finance.splice(+b.dataset.fdel,1); saveData(); renderPurchasing(d); });
  wrap.querySelector("#addFin").onclick=()=>{ p.finance.push({name:"",amount:"",rate:"",dateLoaned:"",paybackDate:""}); saveData(); renderPurchasing(d); };
```
Note: adding or deleting a row still calls the full `renderPurchasing(d)` re-render (there's no input focus to preserve at that moment — the user just clicked a button, not mid-typing), matching how the existing Contractors/Maintenance add/delete buttons behave. Only the per-keystroke edits within an existing row avoid the re-render.

- [ ] **Step 5: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5531 .
```
Open `http://localhost:5531/index.html`, click into the sample deal, move it to the Purchasing phase (phase dropdown at the top), open the Purchasing tab, and confirm:
- "Finance raised" panel appears where "Mortgage application" used to be, with the new hint text.
- "No finance sources added yet." shows initially.
- Clicking "+ Add finance" adds a blank row with Name/Amount/Rate/Date loaned/Payback date inputs, a `—` for interest, and a delete button.
- Filling in Name="Test Investor", Amount=`10000`, Rate=`10`, Date loaned=a date, Payback date=one year later shows a calculated interest figure (roughly £1000) immediately after the last field is filled in.
- "Total raised: £10,000" appears below the list.
- Adding a second entry and filling in a different amount updates the total to the sum of both.
- Deleting an entry removes its row and updates the total.
- No console errors at any point.

Stop the server once confirmed.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: replace Mortgage application panel with Finance raised list"
```

---

### Task 5: Update the Purchasing pipeline card subtitle

**Files:**
- Modify: `app.js:328-341` (`renderPurchasingListHTML()`)

- [ ] **Step 1: Re-verify the line**

Run: `grep -n "mortgage: \${p.mortgageStatus}" app.js`
Expected: one match inside `renderPurchasingListHTML()`. If it's gone (e.g. already removed by a prior step), check the function manually with `sed -n '328,341p' app.js` and find the equivalent subtitle line by content.

- [ ] **Step 2: Update the card subtitle**

Current:
```js
      <p class="sub" style="margin:4px 0 0">${done}/${PURCHASE_CHECKLIST.length} conveyancing steps · mortgage: ${p.mortgageStatus}</p>
```
Change to:
```js
      <p class="sub" style="margin:4px 0 0">${done}/${PURCHASE_CHECKLIST.length} conveyancing steps${(()=>{ const t=p.finance.reduce((a,x)=>a+num(x.amount),0); return t>0?` · finance raised: ${money(t)}`:""; })()}</p>
```
This shows the finance-raised total only when there's at least one entry with a positive amount; otherwise the clause is omitted entirely (matches the spec's explicit requirement — never show "£0" or similar).

- [ ] **Step 3: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5531 .
```
Open `http://localhost:5531/index.html`, go to the Purchasing pipeline list view (not inside a single deal):
1. With no finance entries on the sample deal, confirm the card shows just "`X/6 conveyancing steps`" with no trailing clause.
2. Open the deal, add a finance entry with an amount, go back to the Purchasing list.
3. Confirm the card now shows "`X/6 conveyancing steps · finance raised: £...`" with the correct total.
4. No console errors.

Stop the server once confirmed.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: show finance-raised total on Purchasing pipeline card"
```

---

### Task 6: Final end-to-end regression verification and push

**Files:** none — verification and deployment only

- [ ] **Step 1: Full regression pass in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5531 .
```
Open `http://localhost:5531/index.html` and walk through:
- Pipeline/deals list still renders correctly.
- A deal's Analysis tab is unaffected.
- Purchasing tab: Agreed price & purchase costs panel, Finance raised panel (full add/edit/delete/interest-calculation walkthrough from Task 4), Key dates panel, and Conveyancing checklist all work correctly together — in particular confirm editing the agreed price still correctly refreshes the stamp duty figure (the `#p_price` blur-driven re-render must still work after the binding-block edits in Task 4).
- Refurbishing tab (Contractors list, etc.) is unaffected — confirms the new `.frow` CSS class didn't clash with or break the existing `.crow` rows.
- Owned tab: Mortgage panel (from the previous feature), Tenancy, Compliance, Maintenance all still work — confirms `MORTGAGE_STATES` (still used there) is unaffected by this plan's removal of its Purchasing usage.
- Portfolio dashboard still computes equity correctly (from the previous feature) — unaffected by this plan.
- No console errors anywhere in the walkthrough.

Stop the server once confirmed.

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Confirm the live GitHub Pages site reflects the change**

Open `https://peteowen78.github.io/poco-property/` (allow a minute or two for GitHub Pages to redeploy after the push) and spot-check that the Purchasing tab shows the new Finance raised panel instead of Mortgage application.
