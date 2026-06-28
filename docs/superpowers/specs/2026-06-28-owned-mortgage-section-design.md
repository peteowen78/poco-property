# Owned-Phase Mortgage Section — Design

## Context

POCO Property's app (`app.js`, a single-file no-build static site — see [README.md](../../../README.md)) tracks each deal through four phases: Analysis → Purchasing → Refurbishing → Owned. The Owned tab (`renderManage()` in `app.js`) currently has three panels: Tenancy, Compliance, Maintenance log. There's no way to record the mortgage on an owned property.

Most deals are bought with cash and then refinanced once the property reaches the Owned phase (the BRRR model this app already supports via the Max Offer/MIMO calculation in Analysis). A few properties already have a mortgage in place from when they were purchased. Either way, once a property is Owned, its real financing details need a home — currently the only mortgage fields in the app are the *theoretical* Analysis-phase assumptions (`assumptions.ltvPct`, `assumptions.mortgageRate`) and the Purchasing-phase financing-status tracker (`purchase.mortgageStatus`, `purchase.lender`), neither of which is the actual completed mortgage on the asset.

## Goal

Add a "Mortgage" panel to the Owned tab that records the real mortgage on an owned property (lender, amount, rate, term, type, dates, broker, payment, notes, and a status tracker for while a refinance is in progress). Once a real mortgage amount is entered, the Portfolio dashboard's "Est. equity" figure for that property uses it instead of the theoretical LTV%-based estimate.

## Out of scope

- No change to the Analysis-phase Max Offer/MIMO calculation, cashflow, or ROI ladder — those remain the theoretical/assumption-based model they already are.
- No change to the Purchasing-phase mortgage tracker (`purchase.mortgageStatus`/`purchase.lender`) other than sharing the extended status list (see below).
- No automatic monthly-payment calculation — `monthlyPayment` is a plain entered figure, not derived from amount/rate (the owners may want to record the lender's actual stated payment, which can include fees not captured by a simple interest-only formula).
- No change to portfolio cashflow figures — only the equity figure changes.

## Data model

Extend the per-deal `manage` object (default literal at `app.js:225`, defaults filled in by `ensureManage()` at `app.js:68`) with a new `mortgage` sub-object:

```js
mortgage: {
  status: "Not started",
  lender: "", broker: "",
  amount: "", rate: "", termYears: "", type: "Interest-only",
  startDate: "", productEndDate: "", monthlyPayment: "",
  notes: ""
}
```

`MORTGAGE_STATES` (`app.js:88`, currently `["Not started","Applied","Valuation booked","Offer received"]`) gains a fifth value, `"Completed"`. This constant is already used by the Purchasing-phase mortgage-status select (`app.js:842`) — adding `"Completed"` there too is correct (a purchase-financing mortgage can reach completion) and avoids a second near-duplicate constant.

`ensureManage()` must default `m.mortgage` to the shape above when missing, and backfill any missing keys on existing saved deals (same pattern already used for `m.certs` and `m.maintenance` in that function), so deals saved before this change don't break.

## UI

A new panel titled "Mortgage" in `renderManage()`, rendered first (above the existing Tenancy panel), following the existing `.panel` / `.row2` / `.field` markup conventions already used by the Tenancy panel in the same function:

- **Status** — select, using `MORTGAGE_STATES`.
- **Lender**, **Broker** — text inputs.
- **Mortgage amount**, **Monthly payment** — `£`-prefixed numeric inputs (same `.prefix` pattern as `m_rent`/`m_deposit`).
- **Interest rate** — `%`-suffixed numeric input.
- **Term (years)** — numeric input.
- **Type** — select, `["Interest-only","Repayment"]`.
- **Start date**, **Product/fix ends** — date inputs.
- **Notes** — a free-text field (textarea, or a plain text input if the codebase has no existing textarea pattern to follow — check before adding a new input style).

Wire up live-binding the same way the Tenancy fields do directly below (`lb(...)` calls and a `select.onchange` handler), calling `saveData()` on every change. The status select should follow the same `onchange → saveData()` pattern as the Purchasing-phase status select at `app.js:861`.

## Calculation change

In `renderPortfolioHTML()` (`app.js:434`), equity is currently computed as `DUV − c.mortgage` (the theoretical LTV%-based mortgage from `computeDeal()`), in two places:
- The aggregate `totEquity` accumulator (`app.js:448`)
- The per-property table row's equity cell (`app.js:461`)

Both call sites change to: if the property's `manage.mortgage.amount` is set (non-empty, parses to a number), use that real amount in place of `c.mortgage` for that property's equity; otherwise keep using `c.mortgage` as today. This needs a small helper (e.g. `const realMortgage = m.mortgage && num(m.mortgage.amount) ? num(m.mortgage.amount) : null;`) computed once per owned property and reused at both call sites, since the same per-property equity figure is needed for the row and folded into the total.

The hint text under the Portfolio table (`app.js:484`, "Est. equity is a rough figure...") should be updated to note that properties with a recorded real mortgage use that figure instead of the assumed one.

## Risks / edge cases

- **Existing saved deals** (in Firestore or local demo data) won't have a `manage.mortgage` key yet — `ensureManage()`'s backfill handles this the same way it already handles `certs`/`maintenance` for pre-existing data.
- **Partial mortgage entry** (e.g. lender filled in but amount left blank) must not affect the equity calculation — only a parseable, non-zero `amount` triggers the override, so an in-progress refinance with status "Applied" but no amount yet keeps using the theoretical figure.
- **Shared `MORTGAGE_STATES` constant**: adding `"Completed"` is additive only — existing saved `purchase.mortgageStatus` values remain valid options in that select, nothing is removed or renamed.
