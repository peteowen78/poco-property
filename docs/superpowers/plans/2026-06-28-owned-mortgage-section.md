# Owned-Phase Mortgage Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Mortgage" panel to the Owned tab that records the real mortgage on an owned property, and make the Portfolio dashboard's equity figure use that real amount instead of the theoretical LTV%-based estimate once it's entered.

**Architecture:** Single-file no-build app (`app.js`) — no new files. Extend the existing `manage` per-deal data shape with a `mortgage` sub-object, add one new UI panel to the existing `renderManage()` function following its established panel/field markup, and adjust two existing equity-calculation expressions in `renderPortfolioHTML()`.

**Tech Stack:** Plain vanilla JS, no build step, no test framework. This codebase has no Jest/Mocha/etc. — verification is done by running the app in a real browser (via the project's `npx serve .` pattern) and checking behavior directly, the same way prior work on this app was verified.

**Source of truth:** `/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property/app.js` (1122 lines) and the approved spec at `docs/superpowers/specs/2026-06-28-owned-mortgage-section-design.md`. Re-verify every line number below with `grep -n` before editing — the file may have shifted slightly since this plan was written.

---

### Task 1: Extend the data model — `MORTGAGE_STATES`, default `manage.mortgage`, and `ensureManage()`

**Files:**
- Modify: `app.js:88` (`MORTGAGE_STATES` constant)
- Modify: `app.js:225` (the `manage` default literal inside the new-deal object)
- Modify: `app.js:68-76` (`ensureManage()` function)

- [ ] **Step 1: Re-verify the three line numbers**

Run: `grep -n "^const MORTGAGE_STATES\|manage:{ status:\"vacant\"\|^function ensureManage" app.js`
Expected: matches at lines 88, 225, and 68 respectively (adjust the steps below if they've shifted).

- [ ] **Step 2: Add `"Completed"` to `MORTGAGE_STATES`**

Current (`app.js:88`):
```js
const MORTGAGE_STATES=["Not started","Applied","Valuation booked","Offer received"];
```
Change to:
```js
const MORTGAGE_STATES=["Not started","Applied","Valuation booked","Offer received","Completed"];
```

- [ ] **Step 3: Add a `mortgage` sub-object to the `manage` default literal**

Current (`app.js:225`):
```js
           manage:{ status:"vacant", tenant:"", contact:"", rent:"", start:"", end:"", deposit:"", scheme:"", certs:{gas:"",eicr:"",epc:"",insurance:""}, maintenance:[] } };
```
Change to:
```js
           manage:{ status:"vacant", tenant:"", contact:"", rent:"", start:"", end:"", deposit:"", scheme:"", certs:{gas:"",eicr:"",epc:"",insurance:""}, maintenance:[],
                    mortgage:{ status:"Not started", lender:"", broker:"", amount:"", rate:"", termYears:"", type:"Interest-only", startDate:"", productEndDate:"", monthlyPayment:"", notes:"" } } };
```

- [ ] **Step 4: Backfill `m.mortgage` in `ensureManage()` for deals saved before this change**

Current (`app.js:68-76`):
```js
function ensureManage(d){
  if(!d.manage) d.manage={};
  const m=d.manage;
  if(m.status==null) m.status="vacant";
  ["tenant","contact","rent","start","end","deposit","scheme"].forEach(k=>{ if(m[k]==null) m[k]=""; });
  if(!m.certs) m.certs={gas:"",eicr:"",epc:"",insurance:""};
  if(!Array.isArray(m.maintenance)) m.maintenance=[];
  return m;
}
```
Change to:
```js
function ensureManage(d){
  if(!d.manage) d.manage={};
  const m=d.manage;
  if(m.status==null) m.status="vacant";
  ["tenant","contact","rent","start","end","deposit","scheme"].forEach(k=>{ if(m[k]==null) m[k]=""; });
  if(!m.certs) m.certs={gas:"",eicr:"",epc:"",insurance:""};
  if(!Array.isArray(m.maintenance)) m.maintenance=[];
  if(!m.mortgage) m.mortgage={};
  if(m.mortgage.status==null) m.mortgage.status="Not started";
  ["lender","broker","amount","rate","termYears","startDate","productEndDate","monthlyPayment","notes"].forEach(k=>{ if(m.mortgage[k]==null) m.mortgage[k]=""; });
  if(m.mortgage.type==null) m.mortgage.type="Interest-only";
  return m;
}
```

- [ ] **Step 5: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5522 .
```
Open `http://localhost:5522/index.html`, open DevTools console, and run:
```js
DATA.deals[0].manage.mortgage
```
Expected: an object with `status:"Not started"`, `type:"Interest-only"`, and all the other keys as empty strings. No console errors on page load. Stop the server (`Ctrl-C` or kill the background process) once confirmed.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: add mortgage data shape to owned-phase manage object"
```

---

### Task 2: Add the "Mortgage" panel to the Owned tab UI

**Files:**
- Modify: `app.js:945` onward (`renderManage()` function)

- [ ] **Step 1: Re-verify the function boundaries**

Run: `grep -n "^function renderManage\|^function renderSettings" app.js`
Expected: `renderManage` starts where the panel HTML and bindings live, ending just before `renderSettings` begins. Read the full current function with `sed -n '945,1010p' app.js` to confirm nothing has shifted before editing.

- [ ] **Step 2: Add the Mortgage panel markup, above the existing Tenancy panel**

Inside `renderManage()`, find the start of `wrap.innerHTML=`` (currently right before the `<div class="panel"><h3>Tenancy</h3>` block). Insert a new panel immediately after the opening backtick and before the Tenancy panel:

```js
    <div class="panel">
      <h3>Mortgage</h3>
      <p class="hint">Record the real mortgage on this property — whether it's the refinance after a cash purchase, or one that was already in place.</p>
      <div class="row2">
        <div class="field"><label>Status</label><select id="mo_status">${MORTGAGE_STATES.map(s=>`<option ${s===m.mortgage.status?"selected":""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label>Lender</label><input id="mo_lender" value="${esc(m.mortgage.lender)}"></div>
        <div class="field"><label>Broker</label><input id="mo_broker" value="${esc(m.mortgage.broker)}"></div>
        <div class="field"><label>Type</label><select id="mo_type">${["Interest-only","Repayment"].map(s=>`<option ${s===m.mortgage.type?"selected":""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label>Mortgage amount</label><div class="prefix"><span>£</span><input inputmode="decimal" id="mo_amount" value="${esc(m.mortgage.amount)}"></div></div>
        <div class="field"><label>Monthly payment</label><div class="prefix"><span>£</span><input inputmode="decimal" id="mo_payment" value="${esc(m.mortgage.monthlyPayment)}"></div></div>
        <div class="field"><label>Interest rate</label><div class="prefix"><input inputmode="decimal" id="mo_rate" value="${esc(m.mortgage.rate)}" style="padding-left:12px;padding-right:24px"><span style="left:auto;right:12px">%</span></div></div>
        <div class="field"><label>Term (years)</label><input inputmode="decimal" id="mo_term" value="${esc(m.mortgage.termYears)}"></div>
        <div class="field"><label>Start date</label><input type="date" id="mo_start" value="${esc(m.mortgage.startDate)}"></div>
        <div class="field"><label>Product/fix ends</label><input type="date" id="mo_pend" value="${esc(m.mortgage.productEndDate)}"></div>
        <div class="field"><label>Notes</label><input id="mo_notes" value="${esc(m.mortgage.notes)}"></div>
      </div>
    </div>
```

This must use the exact same `.panel` / `.row2` / `.field` / `.prefix` classes as the Tenancy panel directly below it — don't invent new CSS classes, this app's `styles.css` is otherwise untouched by this feature.

- [ ] **Step 3: Wire up the bindings**

Find the existing binding block (currently starting at `wrap.querySelectorAll("#tstatus button")...` and the `const lb=(id,setter)=>{...}` line just after it). Add the new bindings using the same `lb()` helper, right after the existing `lb(...)` calls for Tenancy fields:

```js
  lb("#mo_lender",v=>m.mortgage.lender=v); lb("#mo_broker",v=>m.mortgage.broker=v);
  lb("#mo_amount",v=>m.mortgage.amount=v); lb("#mo_payment",v=>m.mortgage.monthlyPayment=v); lb("#mo_rate",v=>m.mortgage.rate=v);
  lb("#mo_term",v=>m.mortgage.termYears=v); lb("#mo_notes",v=>m.mortgage.notes=v);
  wrap.querySelector("#mo_status").onchange=e=>{ m.mortgage.status=e.target.value; saveData(); };
  wrap.querySelector("#mo_type").onchange=e=>{ m.mortgage.type=e.target.value; saveData(); };
  wrap.querySelector("#mo_start").addEventListener("change",e=>{ m.mortgage.startDate=e.target.value; saveData(); });
  wrap.querySelector("#mo_pend").addEventListener("change",e=>{ m.mortgage.productEndDate=e.target.value; saveData(); });
```

Note: `lb()` is the existing helper already defined in this function (`const lb=(id,setter)=>{ const e=wrap.querySelector(id); if(e) e.addEventListener("input",()=>{ setter(e.value); saveData(); }); };`) — reuse it, don't redefine it.

- [ ] **Step 4: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5522 .
```
Open `http://localhost:5522/index.html`, click into the sample deal, move it to the Owned phase if it isn't already (use the phase dropdown at the top of the property page), open the Owned tab, and confirm:
- A "Mortgage" panel appears above "Tenancy", with all 11 fields rendering correctly.
- Typing in "Lender" and reloading the page (without resetting demo data) keeps the value — confirms `saveData()`/persistence works for the new fields.
- Changing "Status" and "Type" selects persists after a re-render (e.g. switch tabs away and back).
- No console errors.

Stop the server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: add Mortgage panel to Owned tab"
```

---

### Task 3: Use the real mortgage amount in the Portfolio equity calculation

**Files:**
- Modify: `app.js:434-490` (`renderPortfolioHTML()`)

- [ ] **Step 1: Re-verify the relevant lines**

Run: `grep -n "totEquity\|Est. equity is a rough figure" app.js`
Expected: matches near lines 447, 448, 461, and 488 (adjust if shifted).

- [ ] **Step 2: Update the `totEquity` accumulator**

Current (`app.js:448`):
```js
  owned.forEach(d=>{ const c=computeDeal(d), m=d.manage||{}; totRent+=(num(m.rent)||c.rent); totAnnual+=c.annual; totEquity+=(num(d.deal.duv)-c.mortgage); });
```
Change to:
```js
  owned.forEach(d=>{ const c=computeDeal(d), m=d.manage||{}; totRent+=(num(m.rent)||c.rent); totAnnual+=c.annual;
    const realMortgage=m.mortgage&&num(m.mortgage.amount)>0?num(m.mortgage.amount):c.mortgage;
    totEquity+=(num(d.deal.duv)-realMortgage); });
```

- [ ] **Step 3: Update the per-property equity cell**

Current (`app.js:452-461`, inside the `rows=owned.map(...)` block):
```js
  const rows=owned.map(d=>{ const c=computeDeal(d), m=d.manage||{};
    let next=null;
    if(m.certs) CERTS.forEach(([key,name])=>{ const st=certStatus(m.certs[key]); if(st.days!=null && (!next||st.days<next.st.days)) next={name,st}; });
    const rentV=num(m.rent)||c.rent;
    return `<tr class="click" data-open="${d.id}">
      <td>${esc(d.address)}</td>
      <td>${m.status==='let'?'Let':'Vacant'}</td>
      <td>${money(rentV)}</td>
      <td style="${c.cashflow<0?'color:var(--bad);':''}font-weight:800">${money(c.cashflow)}</td>
      <td>${money(num(d.deal.duv)-c.mortgage)}</td>
      <td>${next?`<span class="cstat ${next.st.cls}">${next.name.split(' ')[0]} · ${next.st.label}</span>`:'—'}</td>
    </tr>`;
  }).join("");
```
Change to:
```js
  const rows=owned.map(d=>{ const c=computeDeal(d), m=d.manage||{};
    let next=null;
    if(m.certs) CERTS.forEach(([key,name])=>{ const st=certStatus(m.certs[key]); if(st.days!=null && (!next||st.days<next.st.days)) next={name,st}; });
    const rentV=num(m.rent)||c.rent;
    const realMortgage=m.mortgage&&num(m.mortgage.amount)>0?num(m.mortgage.amount):c.mortgage;
    return `<tr class="click" data-open="${d.id}">
      <td>${esc(d.address)}</td>
      <td>${m.status==='let'?'Let':'Vacant'}</td>
      <td>${money(rentV)}</td>
      <td style="${c.cashflow<0?'color:var(--bad);':''}font-weight:800">${money(c.cashflow)}</td>
      <td>${money(num(d.deal.duv)-realMortgage)}</td>
      <td>${next?`<span class="cstat ${next.st.cls}">${next.name.split(' ')[0]} · ${next.st.label}</span>`:'—'}</td>
    </tr>`;
  }).join("");
```

Note these are two separate callbacks (`owned.forEach` in Step 2 and `owned.map` here) — each needs its own `realMortgage` computed from its own local `m`, as written above. Don't try to share one `realMortgage` value across both.

- [ ] **Step 4: Update the hint text below the table**

Current (`app.js:488`):
```js
      <p class="hint" style="margin-top:12px">Est. equity is a rough figure: post-refurb value minus the ${DATA.assumptions.ltvPct}% mortgage. After-tax is cashflow less corporation tax — a guide, not a tax calculation.</p>
```
Change to:
```js
      <p class="hint" style="margin-top:12px">Est. equity is a rough figure: post-refurb value minus the ${DATA.assumptions.ltvPct}% mortgage — or the real mortgage amount, once you've entered one on a property's Owned tab. After-tax is cashflow less corporation tax — a guide, not a tax calculation.</p>
```

- [ ] **Step 5: Manually verify in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5522 .
```
Open `http://localhost:5522/index.html`, go to the Portfolio view (with the sample deal moved to Owned from Task 2's verification):
1. Note the current "Est. equity" total and the property's row equity figure — both should match the theoretical LTV%-based calculation (no mortgage amount entered yet).
2. Go to the property's Owned tab, enter a mortgage amount in the new Mortgage panel (e.g. `40000`), save (just clicking elsewhere triggers the `input` listener's `saveData()`).
3. Return to Portfolio. Both the row's equity and the portfolio total should now reflect `DUV − 40000` instead of the theoretical figure.
4. Clear the mortgage amount field back to empty. Equity should revert to the theoretical figure.
5. No console errors at any point.

Stop the server once confirmed.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: use real mortgage amount in portfolio equity when entered"
```

---

### Task 4: Final end-to-end verification and push

**Files:** none — verification and deployment only

- [ ] **Step 1: Full regression pass in the browser**

```bash
cd "/Users/peteowen/Documents/•WORK/AI PROJECTS/Poco Property"
npx --yes serve -l 5522 .
```
Open `http://localhost:5522/index.html` and walk through:
- Deals list / pipeline view still renders correctly (unaffected by this change).
- A deal's Analysis, Purchasing, and Refurbishing tabs still work as before (unaffected).
- The Purchasing tab's existing "Mortgage application" status select still shows all states including the new `"Completed"` option, and the original four states still work as before.
- The Owned tab shows Mortgage, Tenancy, Compliance, and Maintenance panels in that order, all functional.
- Portfolio view's equity calculation behaves as verified in Task 3.
- No console errors anywhere in the walkthrough.

Stop the server once confirmed.

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Confirm the live GitHub Pages site reflects the change**

Open `https://peteowen78.github.io/poco-property/` (allow a minute or two for GitHub Pages to redeploy after the push) and spot-check that the Owned tab shows the new Mortgage panel.
