# Loan Agreement Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Generate agreement" button to each Finance raised entry that produces a print-ready loan agreement, reproducing the wording of the owners' existing template verbatim with the loan-specific fields substituted in.

**Architecture:** Single-file no-build app (`app.js` + `styles.css`, no new files). Extends the existing `purchase.finance[i]` shape with an `address` field, extends `DATA.assumptions` with three new fixed-party-detail fields (reusing the existing Settings/assumptions storage), adds one new routing state variable and one new render function (`renderLoanAgreement`) that follows the exact same printable-view pattern already established by `renderSummary` (`.sheet` / `.no-print` toolbar / `window.print()`).

**Tech Stack:** Plain vanilla JS, no build step, no test framework — verification is manual, in a real browser via `npx serve .`.

**Source of truth:** `/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property/app.js` and `styles.css`, and the approved spec at `docs/superpowers/specs/2026-06-29-loan-agreement-generation-design.md`. Line numbers below were re-verified against the current file immediately before writing this plan (current as of commit `2cb5066`) — re-check with `grep -n` before editing in case anything has shifted.

**Legal text source:** every clause of the agreement reproduced in Task 5 is transcribed verbatim from the owners' reviewed example document (`Poco Loan Agreement Document_LH_Owen.pdf`, already read into this conversation in full). Do not paraphrase, summarize, reorder, or "improve" any clause wording — copy it exactly, substituting only the explicitly variable fields (party names/addresses, amount, dates, rate, calculated interest, today's date).

---

### Task 1: Data model — `address` field on finance entries, fixed party details in Settings

**Files:**
- Modify: `app.js:53-56` (`DEFAULT_ASSUMPTIONS`)
- Modify: `app.js:107-115` (`ensurePurchase()`)
- Modify: `app.js:912` (the `#addFin` button's click handler, inside `renderPurchasing(d)`)

- [ ] **Step 1: Re-verify all three locations**

Run: `grep -n "^const DEFAULT_ASSUMPTIONS\|^function ensurePurchase\|addFin.*onclick" app.js`
Expected: matches at lines 53, 107, and 912 respectively (adjust below if shifted — find by content if so).

- [ ] **Step 2: Add the three new fields to `DEFAULT_ASSUMPTIONS`**

Current:
```js
const DEFAULT_ASSUMPTIONS = {
  ltvPct:75, mortgageRate:5.5, stressRate:8, mgmtPct:10, moePct:15,
  solicitor:1500, broker:1000, costOfMoney:2500, corpTaxPct:19
};
```
Change to:
```js
const DEFAULT_ASSUMPTIONS = {
  ltvPct:75, mortgageRate:5.5, stressRate:8, mgmtPct:10, moePct:15,
  solicitor:1500, broker:1000, costOfMoney:2500, corpTaxPct:19,
  companyName:"Poco Property Limited",
  companyAddress:"2 Morris Park, Hartford, Northwich, Cheshire CW8 1SB",
  directorNames:"Peter Owen & Caroline Owen"
};
```

- [ ] **Step 3: Backfill `address` on existing finance entries in `ensurePurchase()`**

Current:
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
Change to:
```js
function ensurePurchase(d){
  if(!d.purchase) d.purchase={};
  const p=d.purchase;
  ["agreedPrice","solicitor","solicitorRef","targetExchange","targetCompletion"].forEach(k=>{ if(p[k]==null) p[k]=""; });
  if(!Array.isArray(p.finance)) p.finance=[];
  p.finance.forEach(x=>{ if(x.address==null) x.address=""; });
  if(!p.checklist) p.checklist={};
  PURCHASE_CHECKLIST.forEach(([k])=>{ if(p.checklist[k]==null) p.checklist[k]=false; });
  return p;
}
```
This is per-existing-entry backfill (a `forEach` over the array), distinct from the array-level `if(!Array.isArray(p.finance)) p.finance=[];` check immediately above it — both are needed; don't merge or remove either.

- [ ] **Step 4: Add `address` to the `#addFin` button's new-entry default**

Current:
```js
  wrap.querySelector("#addFin").onclick=()=>{ p.finance.push({name:"",amount:"",rate:"",dateLoaned:"",paybackDate:""}); saveData(); renderPurchasing(d); };
```
Change to:
```js
  wrap.querySelector("#addFin").onclick=()=>{ p.finance.push({name:"",amount:"",rate:"",dateLoaned:"",paybackDate:"",address:""}); saveData(); renderPurchasing(d); };
```

- [ ] **Step 5: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5580 .
```
Open `http://localhost:5580/index.html`, open DevTools console, and run:
```js
DATA.assumptions.companyName   // expect "Poco Property Limited"
DATA.assumptions.companyAddress // expect "2 Morris Park, Hartford, Northwich, Cheshire CW8 1SB"
DATA.assumptions.directorNames  // expect "Peter Owen & Caroline Owen"
```
Then click into a deal, move it to Purchasing, click "+ Add finance", and run:
```js
DATA.deals[0].purchase.finance[0].address  // expect ""
```
No console errors. Stop the server once confirmed.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: add lender address and fixed party details to data model"
```

---

### Task 2: Add the routing state and router dispatch for the new agreement view

**Files:**
- Modify: `app.js:128` (state declaration)
- Modify: `app.js:1178-1184` (router `render()` function)

- [ ] **Step 1: Re-verify both locations**

Run: `grep -n "^let view\|^function render(){" app.js`
Expected: matches at lines 128 and ~1179.

- [ ] **Step 2: Add `currentFinanceIndex` to the state declaration**

Current:
```js
let view = "list", currentId = null, tab = "deal", homeMode = "list", section = "owned", analysisSub = "numbers", sectionTab = "items";
```
Change to:
```js
let view = "list", currentId = null, tab = "deal", homeMode = "list", section = "owned", analysisSub = "numbers", sectionTab = "items", currentFinanceIndex = null;
```

- [ ] **Step 3: Add the router dispatch branch**

Current:
```js
function render(){
  if(view==="list") renderList();
  else if(view==="property") renderProperty();
  else if(view==="settings") renderSettings();
  else if(view==="summary") renderSummary(curDeal());
}
```
Change to:
```js
function render(){
  if(view==="list") renderList();
  else if(view==="property") renderProperty();
  else if(view==="settings") renderSettings();
  else if(view==="summary") renderSummary(curDeal());
  else if(view==="agreement") renderLoanAgreement(curDeal(), currentFinanceIndex);
}
```
Note: `renderLoanAgreement` doesn't exist yet — it's added in Task 5. This means after this task and before Task 5, the app would throw a `ReferenceError` if `view` were ever actually set to `"agreement"` — but nothing sets it to that value until Task 3's button is wired up, and Task 3 isn't wired until Task 5 exists. To keep every task's commit in a working, non-broken state, complete Tasks 2 and 5 as a logical pair before testing navigation to the agreement view — Task 2's own verification step below only checks the state variable exists and the router's `else if` doesn't error on the OTHER existing views, not that `view==="agreement"` itself works yet.

- [ ] **Step 4: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5580 .
```
Open `http://localhost:5580/index.html`. Confirm the app loads normally (Owned tab, as established by a prior feature), and that switching between Analysis/Purchasing/Refurbishing/Owned and into a property's detail view still works with no console errors — this confirms the new `else if` branch didn't break the router for the views that already work. Do NOT attempt to trigger `view==="agreement"` yet (nothing calls it until Task 3). Stop the server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: add routing state and dispatch for loan agreement view"
```

---

### Task 3: Add the address field and "Generate agreement" button to each Finance raised entry

**Files:**
- Modify: `app.js:845-918` (`renderPurchasing(d)` — the `financeRows` computation and its bindings)

- [ ] **Step 1: Re-verify the current finance-row markup and bindings**

Run: `grep -n "const financeRows=\|wrap.querySelector(\"#addFin\")" app.js` and read the full surrounding block with `sed -n` to confirm it matches what's quoted below (Task 1 already changed the `#addFin` line's pushed object — confirm that change is in place before proceeding).

- [ ] **Step 2: Update the `financeRows` markup — add the address row and Generate button**

Current:
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
```
Change to:
```js
  const financeCanGenerate=x=>x.name && x.address && num(x.amount)>0 && num(x.rate)>0 && x.dateLoaned && x.paybackDate;
  const financeRows=p.finance.map((x,i)=>{
    const interest=loanInterest(x.amount,x.rate,x.dateLoaned,x.paybackDate);
    const canGenerate=financeCanGenerate(x);
    return `<div class="frow">
      <input data-ff="name" data-i="${i}" value="${esc(x.name||"")}" placeholder="Name">
      <div class="prefix"><span>£</span><input data-ff="amount" data-i="${i}" inputmode="decimal" value="${esc(x.amount||"")}" placeholder="Amount" style="padding-left:22px"></div>
      <div class="prefix"><input data-ff="rate" data-i="${i}" inputmode="decimal" value="${esc(x.rate||"")}" placeholder="Rate" style="padding-left:10px;padding-right:22px"><span style="left:auto;right:10px">%</span></div>
      <input type="date" data-ff="dateLoaned" data-i="${i}" value="${esc(x.dateLoaned||"")}">
      <input type="date" data-ff="paybackDate" data-i="${i}" value="${esc(x.paybackDate||"")}">
      <span class="interest">${interest==null?"—":money(interest)}</span>
      <button class="comp-del" data-fdel="${i}" title="Remove">✕</button>
    </div>
    <div class="frow-addr">
      <input data-ff="address" data-i="${i}" value="${esc(x.address||"")}" placeholder="Lender's address">
      <button class="btn ghost sm" data-fgen="${i}" ${canGenerate?"":'disabled title="Fill in name, address, amount, rate, and both dates first"'}>Generate agreement</button>
    </div>`;
  }).join("");
```
`financeCanGenerate` is declared once, outside the `.map()` callback's per-iteration scope but still inside `renderPurchasing(d)`, since it's reused in Step 3 below (`updateFinRow`) — don't redefine the same logic twice.

- [ ] **Step 3: Update `updateFinRow` to also keep the Generate button's enabled state live**

Current:
```js
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
```
Change to:
```js
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
    const genBtn=wrap.querySelector(`[data-fgen="${i}"]`);
    if(genBtn){
      const canGenerate=financeCanGenerate(x);
      genBtn.disabled=!canGenerate;
      genBtn.title=canGenerate?"":"Fill in name, address, amount, rate, and both dates first";
    }
  };
```
This is important: without this, typing the lender's address (the last field usually needed to satisfy `financeCanGenerate`) wouldn't enable the button until the next full re-render (e.g. add/delete another row) — the button would appear stuck disabled even once all fields are actually filled in. `updateFinRow` already runs on every keystroke (per the existing `[data-ff]` binding below), so this fix is "free" — no new event listeners needed, just extending the existing live-update function.

- [ ] **Step 4: Add the `[data-fgen]` click binding**

Find the existing binding block (after the `[data-fdel]` binding and before/after the `#addFin` binding — exact current order: `[data-ff]` forEach, then `[data-fdel]` forEach, then `#addFin`). Add the new binding directly after the `[data-fdel]` binding:

Current:
```js
  wrap.querySelectorAll("[data-fdel]").forEach(b=>b.onclick=()=>{ p.finance.splice(+b.dataset.fdel,1); saveData(); renderPurchasing(d); });
  wrap.querySelector("#addFin").onclick=()=>{ p.finance.push({name:"",amount:"",rate:"",dateLoaned:"",paybackDate:"",address:""}); saveData(); renderPurchasing(d); };
```
Change to:
```js
  wrap.querySelectorAll("[data-fdel]").forEach(b=>b.onclick=()=>{ p.finance.splice(+b.dataset.fdel,1); saveData(); renderPurchasing(d); });
  wrap.querySelectorAll("[data-fgen]").forEach(b=>{ b.onclick=()=>{ if(b.disabled) return; currentFinanceIndex=+b.dataset.fgen; go("agreement", d.id); }; });
  wrap.querySelector("#addFin").onclick=()=>{ p.finance.push({name:"",amount:"",rate:"",dateLoaned:"",paybackDate:"",address:""}); saveData(); renderPurchasing(d); };
```
The `if(b.disabled) return;` guard inside the handler (rather than only checking disabled state at bind time) matters because `updateFinRow` can flip a button's `disabled` attribute after the bindings were first attached — checking inside the handler at click time is always correct, checking only at bind time could let a stale enabled/disabled assumption slip through.

- [ ] **Step 5: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5580 .
```
Open `http://localhost:5580/index.html`, open a deal, move it to Purchasing, click "+ Add finance":
- Confirm an address input appears below the existing row, with a "Generate agreement" button next to it, initially disabled (greyed out) with a tooltip explaining why.
- Fill in Name, Amount, Rate, both dates — confirm the button is STILL disabled (address not yet filled).
- Fill in the address — confirm the button becomes enabled immediately (no need to click away/re-render), since `updateFinRow` now handles this live.
- Click the now-enabled button. **This will currently throw a JavaScript error in the console** (`renderLoanAgreement is not defined`) since Task 5 hasn't been done yet — this is expected at this point in the plan; do not treat it as a regression to fix now. Confirm specifically that the error is exactly that `ReferenceError` and nothing else (e.g. not a syntax error elsewhere, not a crash unrelated to the missing function).
- Confirm deleting a finance entry still works and removes both its `.frow` and `.frow-addr` rows together.

Stop the server once confirmed.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: add address field and Generate agreement button to finance entries"
```

---

### Task 4: Add CSS for the new address row

**Files:**
- Modify: `styles.css:259-264` (near the existing `.crow`/`.frow` rules)
- Modify: `styles.css:299-302` (the mobile responsive block containing `.crow{grid-template-columns:1fr 1fr}` / `.frow{grid-template-columns:1fr 1fr}`)

- [ ] **Step 1: Re-verify both locations**

Run: `grep -n "\.frow \.interest{\|\.frow{grid-template-columns:1fr 1fr}" styles.css`
Expected: two matches (adjust below if shifted).

- [ ] **Step 2: Add the `.frow-addr` rule directly after `.frow .interest{...}`**

Current:
```css
  .frow .interest{font-size:13px;font-weight:700;color:var(--ink2);text-align:right;padding-right:4px}
```
Add immediately after (don't replace, insert a new line):
```css
  .frow-addr{display:flex;gap:8px;margin-bottom:14px}
  .frow-addr input{flex:1;border:1px solid var(--line);border-radius:9px;padding:9px 10px;font-size:13px;font-weight:600;font-family:inherit;background:var(--paper)}
```
The input styling here is a direct copy of `.frow input`'s box style (border/radius/padding/font-size/weight/background) — it can't simply reuse the `.frow input` selector since this input is a sibling of `.frow`, not a descendant of it.

- [ ] **Step 3: Add the mobile responsive override**

Current:
```css
    .frow{grid-template-columns:1fr 1fr}
```
Add immediately after:
```css
    .frow-addr{flex-direction:column}
```

- [ ] **Step 4: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5580 .
```
Open `http://localhost:5580/index.html`, navigate to a Finance raised entry. Confirm the address input and Generate button sit on their own row below the main `.frow` grid, with sensible spacing (not cramped against the row above or the next entry below), and that the address input visually matches the style of the other inputs in the panel. Resize the browser window narrow (or use DevTools device emulation) and confirm the address row stacks vertically rather than squeezing the button into an unreadably narrow space. Stop the server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "feat: add .frow-addr CSS for lender address row"
```

---

### Task 5: Build `renderLoanAgreement(d, financeIndex)`

**Files:**
- Modify: `app.js` — add a new function, placed directly after `renderSummary(d)` (find with `grep -n "^function renderSummary\b"`) and before the `/* ---------- router ---------- */` comment.

- [ ] **Step 1: Re-verify the insertion point**

Run: `grep -n "^function renderSummary\b\|/\* ---------- router ---------- \*/" app.js` to confirm `renderSummary` ends and the router comment begins where expected.

- [ ] **Step 2: Add the function**

Insert this complete function between `renderSummary`'s closing `}` and the router comment:

```js
/* ============================================================ LOAN AGREEMENT */
function renderLoanAgreement(d, financeIndex){
  if(!d){ go("list"); return; }
  const p=ensurePurchase(d);
  const x=p.finance[financeIndex];
  if(!x){ go("property", d.id); return; }
  const a=DATA.assumptions;
  const interest=loanInterest(x.amount,x.rate,x.dateLoaned,x.paybackDate);
  const todayISO=new Date().toISOString().slice(0,10);
  const lenderLine=`${esc(x.name)} of ${esc(x.address)} (the 'Lender')`;
  const borrowerLine=`${esc(a.companyName)} of ${esc(a.companyAddress)} ('the Borrower')`;
  const guarantorLine=`${esc(a.directorNames)} of ${esc(a.companyAddress)} ('the Guarantor')`;
  const loanAmt=money(num(x.amount));
  const loanDate=fmtDate(x.dateLoaned);
  const repayDate=fmtDate(x.paybackDate);
  const dated=fmtDate(todayISO);
  const rateTxt=`${esc(x.rate)}%`;
  const interestTxt=interest==null?"—":money(interest);
  app.innerHTML=`
    <div class="toolbar no-print">
      <button class="btn ghost sm" id="back">← Back</button>
      <button class="btn sm" id="print">Print / Save as PDF</button>
    </div>
    <div class="sheet">
      <h2 style="margin-top:60px">Loan agreement</h2>
      <p class="sh-sub">Dated: ${dated}</p>

      <div class="sh-section" style="page-break-before:always">
        <h4>1. Definitions</h4>
        <p>These are the definitions that apply to this agreement unless the context requires a different interpretation:</p>
        <div class="bd"><span class="k">"Interest Payment"</span><span class="v">${rateTxt} GROSS (pro rata) on the principle amount (based on 12 month loan)</span></div>
        <div class="bd"><span class="k">"Loan"</span><span class="v">means the sum of ${loanAmt} or such greater sum as shall in fact have been lent by the Lender to the Borrower at any time this agreement subsists. Where the context admits, it includes interest.</span></div>
        <div class="bd"><span class="k">Loan Date</span><span class="v">${loanDate}</span></div>
        <div class="bd"><span class="k">Repayment Date</span><span class="v">${repayDate}</span></div>
        <p style="margin-top:16px">This agreement is dated: ${dated}</p>
        <p>It is made between</p>
        <p style="margin-left:20px">(1.) ${lenderLine}</p>
        <p style="margin-left:20px">AND</p>
        <p style="margin-left:20px">(2.) ${borrowerLine}</p>
        <p style="margin-left:20px">(3.) AND</p>
        <p style="margin-left:20px">${guarantorLine}</p>
        <p style="margin-top:16px"><b>The terms of this Agreement are:</b></p>
      </div>

      <div class="sh-section">
        <h4>2. Purpose of Loan and Security</h4>
        <p>The Loan shall be used to:</p>
        <p style="margin-left:20px">2.1. Fund property investment</p>
        <p style="margin-left:20px">2.2. The Borrower will secure the loan with a Personal Guarantee from ${esc(a.directorNames)} of ${esc(a.companyAddress)}</p>
      </div>

      <div class="sh-section">
        <h4>3. Sum of Loan and advances</h4>
        <p style="margin-left:20px">3.1. The total sum offered by the Lender is ${loanAmt}.</p>
        <p style="margin-left:20px">3.2. The Lender shall transfer the sum of ${loanAmt} to the Borrower's specified bank account to be cleared by the Loan Date.</p>
      </div>

      <div class="sh-section">
        <h4>4. Repayment conditions</h4>
        <p style="margin-left:20px">4.1. Subject to clause 4.2 the Loan shall be repaid in full no later than 12 months after the Loan Date unless otherwise agreed.</p>
        <p style="margin-left:20px">4.2. In the event that at the Repayment Date both parties wish to continue, the Loan will continue at the agreed rate of ${rateTxt} per annum (pro rata) until the Loan is repaid in full subject always to the right of the Lender to demand repayment of the Loan in full on 60 days prior written notice once the Repayment Date has expired.</p>
      </div>

      <div class="sh-section">
        <h4>5. Interest payable</h4>
        <p>The Interest Payment shall be paid into the Lender's chosen bank account on the Repayment Date</p>
      </div>

      <div class="sh-section">
        <h4>6. Early repayment of loan</h4>
        <p>The Borrower will repay the Loan in full, along with all interest due, no sooner than 12 months from the Loan Date and no later than the Repayment Date (if different) unless otherwise agreed by both parties</p>
      </div>

      <div class="sh-section" style="page-break-before:always">
        <h4>7. Method of payment</h4>
        <p>All payments due to the Lender of both capital and interest shall be paid in pounds sterling by bank transfer into such account and bank within the United Kingdom.</p>
      </div>

      <div class="sh-section">
        <h4>8. Default in payment of interest or repayment of capital</h4>
        <p style="margin-left:20px">8.1. An "event of default" occurs when:</p>
        <p style="margin-left:40px">8.1.1. the Borrower fails to pay in full and on the due date for payment any sum due; or</p>
        <p style="margin-left:40px">8.1.2. any step is taken in connection with any voluntary arrangement or any other compromise or arrangement for the benefit of any creditors of ${esc(a.companyName)}; or</p>
        <p style="margin-left:40px">8.1.3. a petition is presented for an order for the bankruptcy of ${esc(a.companyName)}</p>
        <p style="margin-left:20px">8.2. Where an event of default has occurred the Lender may issue a notice of default. When the Lender does so, the whole amount of the Loan then outstanding and any unpaid interest immediately fall due for payment.</p>
        <p style="margin-left:40px">8.2.1. In the event that no interest payments have yet been made, the Borrower will pay the Lender a minimum of 3 months interest OR the current accrued interest (whichever is higher).</p>
        <p style="margin-left:40px">8.2.2. In the event that some interest payments have been made but amount to less than 3 months interest on the principle amount, the Borrower will pay the Lender an amount to bring total interest paid up to the equivalent of 3 months interest OR the current accrued interest (whichever is higher)</p>
        <p style="margin-left:40px">8.2.3. In any other event, the Borrower will pay the Lender the remaining accrued interest on the principle amount.</p>
      </div>

      <div class="sh-section">
        <h4>9. Borrower's warranties</h4>
        <p>The Borrower represents and warrants:</p>
        <p style="margin-left:20px">9.1. that the borrower is authorised to enter into this agreement;</p>
        <p style="margin-left:20px">9.2. that the financial information submitted to the Lender fairly represents the financial state of the Borrower at the date of this agreement knowing that the Lender has relied on it in granting the Loan;</p>
        <p style="margin-left:20px">9.3. that the Borrower has no undisclosed contingent obligations;</p>
        <p style="margin-left:20px">9.4. that there are no material, unrealised or anticipated losses from any present commitment of the Borrower;</p>
        <p style="margin-left:20px">9.5. that the Borrower will advise the Lender of material adverse changes which occur at any time prior to the date of final repayment of the Loan.</p>
      </div>

      <div class="sh-section" style="page-break-before:always">
        <h4>10. Miscellaneous matters</h4>
        <p style="margin-left:20px">10.1. No amendment or variation to this agreement is valid unless in writing, signed by each of the parties or by an authorised representative.</p>
        <p style="margin-left:20px">10.2. So far as any time, date or period is mentioned in this agreement, time shall be of the essence.</p>
        <p style="margin-left:20px">10.3. If any term or provision of this agreement is at any time held by any jurisdiction to be void, invalid or unenforceable, then it shall be treated as changed or reduced, only to the extent minimally necessary to bring it within the laws of that jurisdiction and to prevent it from being void and it shall be binding in that changed or reduced form. Subject to that, each provision shall be interpreted as severable and shall not in any way affect any other of these terms.</p>
        <p style="margin-left:20px">10.4. The rights and obligations of the parties set out in this agreement shall pass to any permitted successor in title.</p>
        <p style="margin-left:20px">10.5. If the Borrower is in breach of any term of this agreement, the Lender may:</p>
        <p style="margin-left:40px">10.5.1. issue a claim in any court. All reasonable costs of the lender due to any breach are to be paid by the borrower</p>
        <p style="margin-left:20px">10.6. No failure or delay by any party to exercise any right, power or remedy will operate as a waiver of it nor indicate any intention to reduce that or any other right in the future.</p>
        <p style="margin-left:20px">10.7. Any communication to be served on either of the parties by the other shall be delivered by hand or sent by first class post or recorded delivery or by fax or by e-mail.</p>
        <p style="margin-left:40px">It shall be deemed to have been delivered:</p>
        <p style="margin-left:40px">if delivered by hand: on the day of delivery;</p>
        <p style="margin-left:40px">if sent by post to the correct address: within 72 hours of posting;</p>
        <p style="margin-left:40px">If sent by fax to the correct number: within 24 hours;</p>
        <p style="margin-left:40px">If sent by e-mail to the address from which the receiving party has last sent e-mail: within 24 hours if no notice of non-receipt has been received by the sender.</p>
        <p style="margin-left:20px">10.8. The validity, construction and performance of this agreement shall be governed by the laws of England and Wales and you agree that any dispute arising from it shall be litigated only in England and Wales.</p>
      </div>

      <div class="sh-section">
        <h4>Loan Schedule</h4>
        <div class="bd"><span class="k">Loan Amount</span><span class="v">${loanAmt}</span></div>
        <div class="bd"><span class="k">Loan Date</span><span class="v">${loanDate}</span></div>
        <div class="bd"><span class="k">Repayment Date</span><span class="v">${repayDate}</span></div>
        <div class="bd"><span class="k">Interest rate</span><span class="v">${rateTxt} (based on 12 month loan)</span></div>
        <div class="bd"><span class="k">Interest over full term (12 months)</span><span class="v">${interestTxt}</span></div>
      </div>

      <div class="sh-section">
        <h4>Guarantee</h4>
        <p>The Guarantor guarantees to the Lender that the Borrower shall comply with the provisions of this agreement and shall pay the Loan Sum, Interest and any other sums due in accordance with this agreement and in the event that the Borrower fails to pay the same on demand (including interest up to the actual date of payment), within 5 working days of any such demand.</p>
        <p>The Guarantor shall indemnify the Lender for any and all reasonable costs arising out of the enforcement and/or preservation of this clause 12.</p>
      </div>

      <div class="sh-section" style="page-break-before:always">
        <p><b>Signed as a deed on behalf of the Lender:</b></p>
        <p style="margin-top:50px">.............................................................. ..............................................................</p>
        <p><b>${lenderLine}</b></p>

        <p style="margin-top:30px"><b>Signed as a deed on behalf of the Borrower:</b></p>
        <p style="margin-top:50px">.............................................................. ..............................................................</p>
        <p><b>${esc(a.directorNames)}, Director, ${esc(a.companyName)} of ${esc(a.companyAddress)} (the 'Lender')</b></p>

        <p style="margin-top:30px"><b>Signed as a deed on behalf of the Guarantor:</b></p>
        <p style="margin-top:50px">.............................................................. ..............................................................</p>
        <p><b>${esc(a.directorNames)} of ${esc(a.companyAddress)}</b></p>
      </div>

      <p class="footnote" style="text-align:left;margin-top:22px">Generated ${dated} · POCO Property · This is a template loan agreement, not legal advice — review it yourself or with your solicitor before use.</p>
    </div>`;
  app.querySelector("#back").onclick=()=>go("property", d.id);
  app.querySelector("#print").onclick=()=>window.print();
}
```

Notes for the implementer:
- The Borrower signature block's label says "(the 'Lender')" — this looks like a typo in the *original source document itself* (page 7 of the PDF: "Peter Owen, Director & Caroline Owen, Director, Poco Property Limited of 2 Morris Park, Hartford, Cheshire CW8 1SB (the 'Lender')" — under a heading that says "Signed as a deed on behalf of the **Borrower**"). Per this plan's instruction to reproduce the source verbatim rather than silently "fixing" it, this is intentionally reproduced exactly as in the source. Do not change it to "(the 'Borrower')" without checking with the user first — flag it in your task report, but implement it as transcribed above.
- The Guarantee section's second paragraph refers to "this clause 12" — the source document has no clause 12 (clauses only run 1–10; this is presumably a leftover reference from an earlier draft of the source template that had more clauses). This is reproduced verbatim, exactly as written above, per the same "flag, don't silently fix" policy as the signature-block typo above. Do not renumber it or guess what it should say — flag it in your task report, implement it as transcribed.
- The source PDF itself is internally inconsistent about the Lender's address: the opening parties section (page 2) gives it as "145 Cromwell Rd, Northwich, Cheshire CW8 4BX", while the Lender's own signature block (page 7) gives it as "145 Cromwell Rd, Winnington, Northwich, Cheshire CW8 4BX" (note the extra "Winnington"). Since this plan's data model has only one `address` field per finance entry (not two), `lenderLine` is reused identically in both the opening parties section and the Lender's signature block — this is an intentional simplification, not a bug, and means the generated document will be internally consistent (using whatever single address the user typed in) even though the specific source document reviewed for this plan was not. No code change needed to "fix" this — just don't be surprised that the generated output doesn't reproduce that particular inconsistency, and don't try to add a second address field to capture it.
- `fmtDate()` and `loanInterest()` are existing functions already used elsewhere in this file — don't redefine them.
- `ensurePurchase(d)` is called again here (it's idempotent — safe to call multiple times on the same deal across different render functions, exactly as the rest of the file already does, e.g. `renderPurchasingListHTML` and `renderPurchasing` both call it independently).

- [ ] **Step 3: Verify with `node --check`**

Run: `node --check app.js`
Expected: no output (syntax OK).

- [ ] **Step 4: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5580 .
```
Open `http://localhost:5580/index.html`, open a deal, move it to Purchasing, add a finance entry with realistic test data (e.g. Name="Linda Owen & Howard Owen", Address="145 Cromwell Rd, Northwich, Cheshire CW8 4BX", Amount=10000, Rate=6, Date loaned and Payback date one year apart), and click "Generate agreement" once it's enabled. Confirm:
- The agreement view opens, showing the title, dated today, all ten numbered clauses with the correct loan figures substituted in, the Loan Schedule, the Guarantee section, and three signature blocks.
- The Lender's name/address in the document matches what you typed into the Finance raised entry.
- The Borrower/Guarantor details match Settings' defaults (Poco Property Limited / 2 Morris Park... / Peter Owen & Caroline Owen) unless you've changed them in Task 6.
- "Interest over full term" matches what the Finance raised panel itself shows for that entry's interest figure (same `loanInterest()` call, so these must agree exactly).
- The "← Back" button returns to the property's Purchasing tab.
- The "Print / Save as PDF" button opens the browser's print dialog (use your browser's print preview, don't need to actually print/save a file, just confirm the dialog opens and the preview shows the formatted document without the toolbar visible).
- No console errors.

Stop the server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: add renderLoanAgreement view for generating loan agreements"
```

---

### Task 6: Add the "Borrower & Guarantor details" panel to Settings

**Files:**
- Modify: `app.js:1089-1115` (`renderSettings()`)

- [ ] **Step 1: Re-verify the current function**

Run: `grep -n "^function renderSettings\b"` and read the full function to confirm it matches what's quoted below.

- [ ] **Step 2: Add a text-field helper, distinct from the existing numeric one**

The existing `f(key,label,suffix)` helper inside `renderSettings()` is built for numeric `£`/`%` fields and its binding coerces every `[data-a]` input through `num()` — that's wrong for plain text fields like a company name. Add a second helper, `ft(key,label)`, for plain text fields, and bind them through a separate `[data-at]` attribute (not `[data-a]`) so the existing numeric binding loop doesn't try to `num()`-coerce these strings.

Current:
```js
function renderSettings(){
  const a=DATA.assumptions;
  const f=(key,label,suffix)=>`<div class="field inline"><label>${label}</label><div class="prefix" style="width:130px">${suffix==='£'?'<span>£</span>':''}<input inputmode="decimal" data-a="${key}" value="${esc(a[key])}" style="${suffix==='£'?'padding-left:24px':''}">${suffix==='%'?'<span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-weight:700">%</span>':''}</div></div>`;
  app.innerHTML=`
    <button class="back" id="back">← All deals</button>
    <div class="page-head"><div><span class="eyebrow">Defaults</span><br><h1 class="page">Settings</h1><div class="ul" style="width:54px"></div></div></div>
    <div class="panel">
      <h3>Deal assumptions</h3>
      <p class="hint">Set once, used on every deal. Tuned for a UK limited company (SPV).</p>
      ${f('ltvPct','Refinance LTV','%')}
      ${f('mortgageRate','Mortgage rate (company BTL)','%')}
      ${f('stressRate','Stress-test rate','%')}
      ${f('mgmtPct','Management','%')}
      ${f('moePct','Maintenance / voids','%')}
      ${f('costOfMoney','Cost of money','£')}
      ${f('solicitor','Solicitor fee','£')}
      ${f('broker','Broker fee','£')}
      ${f('corpTaxPct','Corporation tax (for portfolio)','%')}
    </div>
    <div class="panel">
      <h3>Stamp duty</h3>
      <p class="hint" style="margin:0">Calculated automatically using <b>limited-company (SPV) additional-property rates</b>: 5% on the first £125k, rising in bands, with a flat 17% over £500k. Most St&nbsp;Helens deals sit at a simple 5% of the price.</p>
    </div>
    <button class="btn ghost" id="reset">Reset to defaults</button>`;
  app.querySelector("#back").onclick=()=>go("list");
  app.querySelectorAll("[data-a]").forEach(inp=>{
    inp.addEventListener("input",()=>{ a[inp.dataset.a]=num(inp.value); saveData(); });
  });
  app.querySelector("#reset").onclick=()=>{ DATA.assumptions={...DEFAULT_ASSUMPTIONS}; saveData(); renderSettings(); };
}
```
Change to:
```js
function renderSettings(){
  const a=DATA.assumptions;
  const f=(key,label,suffix)=>`<div class="field inline"><label>${label}</label><div class="prefix" style="width:130px">${suffix==='£'?'<span>£</span>':''}<input inputmode="decimal" data-a="${key}" value="${esc(a[key])}" style="${suffix==='£'?'padding-left:24px':''}">${suffix==='%'?'<span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-weight:700">%</span>':''}</div></div>`;
  const ft=(key,label)=>`<div class="field"><label>${label}</label><input data-at="${key}" value="${esc(a[key])}"></div>`;
  app.innerHTML=`
    <button class="back" id="back">← All deals</button>
    <div class="page-head"><div><span class="eyebrow">Defaults</span><br><h1 class="page">Settings</h1><div class="ul" style="width:54px"></div></div></div>
    <div class="panel">
      <h3>Deal assumptions</h3>
      <p class="hint">Set once, used on every deal. Tuned for a UK limited company (SPV).</p>
      ${f('ltvPct','Refinance LTV','%')}
      ${f('mortgageRate','Mortgage rate (company BTL)','%')}
      ${f('stressRate','Stress-test rate','%')}
      ${f('mgmtPct','Management','%')}
      ${f('moePct','Maintenance / voids','%')}
      ${f('costOfMoney','Cost of money','£')}
      ${f('solicitor','Solicitor fee','£')}
      ${f('broker','Broker fee','£')}
      ${f('corpTaxPct','Corporation tax (for portfolio)','%')}
    </div>
    <div class="panel">
      <h3>Stamp duty</h3>
      <p class="hint" style="margin:0">Calculated automatically using <b>limited-company (SPV) additional-property rates</b>: 5% on the first £125k, rising in bands, with a flat 17% over £500k. Most St&nbsp;Helens deals sit at a simple 5% of the price.</p>
    </div>
    <div class="panel">
      <h3>Borrower &amp; Guarantor details</h3>
      <p class="hint">Used when generating a loan agreement from a Finance raised entry. These don't change often.</p>
      ${ft('companyName','Company name')}
      ${ft('companyAddress','Company / Guarantor address')}
      ${ft('directorNames','Director / Guarantor names')}
    </div>
    <button class="btn ghost" id="reset">Reset to defaults</button>`;
  app.querySelector("#back").onclick=()=>go("list");
  app.querySelectorAll("[data-a]").forEach(inp=>{
    inp.addEventListener("input",()=>{ a[inp.dataset.a]=num(inp.value); saveData(); });
  });
  app.querySelectorAll("[data-at]").forEach(inp=>{
    inp.addEventListener("input",()=>{ a[inp.dataset.at]=inp.value; saveData(); });
  });
  app.querySelector("#reset").onclick=()=>{ DATA.assumptions={...DEFAULT_ASSUMPTIONS}; saveData(); renderSettings(); };
}
```
Note `[data-at]`'s binding assigns `inp.value` directly (a string), NOT `num(inp.value)` — this is the whole reason a separate attribute/loop was needed instead of reusing `[data-a]`. Don't merge these two loops.

"Reset to defaults" resetting `DATA.assumptions` to `{...DEFAULT_ASSUMPTIONS}` will also reset these three new fields back to their hardcoded defaults — this is correct, expected behaviour (consistent with every other assumption field), not a bug to guard against.

- [ ] **Step 3: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5580 .
```
Open `http://localhost:5580/index.html`, navigate to Settings. Confirm:
- A new "Borrower & Guarantor details" panel appears, after "Stamp duty" and before the "Reset to defaults" button, with three text fields pre-filled with "Poco Property Limited", "2 Morris Park, Hartford, Northwich, Cheshire CW8 1SB", and "Peter Owen & Caroline Owen".
- Editing any of the three fields and switching away (e.g. to the Pipeline) and back to Settings preserves the edited value.
- Generate a loan agreement (per Task 5's verification) after editing one of these fields — confirm the generated document reflects the edited value, not the original default.
- Clicking "Reset to defaults" resets these three fields back to their defaults, alongside the existing numeric assumptions resetting too.
- No console errors.

Stop the server once confirmed.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add Borrower and Guarantor details panel to Settings"
```

---

### Task 7: Final end-to-end regression verification and push

**Files:** none — verification and deployment only

- [ ] **Step 1: Full regression pass in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5580 .
```
Open `http://localhost:5580/index.html` and walk through:
- Full end-to-end flow: create a deal, move it to Purchasing, add a Finance raised entry with realistic data, fill in all required fields, click "Generate agreement", review the full document content against the original PDF clause-by-clause (re-read `/Users/peteowen/Documents/•PROPERTY/POCO Loan Agreement Documents/Poco Loan Agreement Document_LH_Owen.pdf` if needed for comparison), print-preview it, and navigate back.
- Settings' new panel works correctly and feeds the generated document.
- The existing "Share summary" feature (`renderSummary`) still works correctly — confirms the new routing state/dispatch branch didn't break the existing `summary` view.
- The Owned tab (Mortgage panel, Tenancy panel with Monthly cashflow, Compliance, Maintenance) and Portfolio dashboard (Monthly cashflow tile) — both from prior features — still work correctly.
- The rest of the Finance raised panel (add/edit/delete entries, running total, live interest calculation) still works correctly alongside the new address field and Generate button.
- No console errors anywhere in the walkthrough.

Stop the server once confirmed.

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Confirm the live GitHub Pages site reflects the change**

Open `https://peteowen78.github.io/poco-property/` (allow a minute or two for GitHub Pages to redeploy after the push) and spot-check the full Generate agreement flow works there too (sign in with Google first, since this is now a live Firebase-backed deployment, not demo mode).
