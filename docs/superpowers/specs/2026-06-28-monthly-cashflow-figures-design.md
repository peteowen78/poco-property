# Monthly Cashflow Figures — Design

## Context

POCO Property's app (`app.js`, no-build static site) has a Pipeline view with four phase tabs (Analysis/Purchasing/Refurbishing/Owned). The Owned tab shows a Portfolio dashboard (`renderPortfolioHTML()`) with a stats row — Properties owned, Monthly rent, Annual cashflow, Est. equity — followed by Compliance alerts and an Owned-properties table. Each individual property's Owned tab (`renderManage(d)`) has Mortgage, Tenancy, Compliance, and Maintenance panels.

The owners check the Owned/Portfolio view day-to-day, more than Analysis (the current default tab on app load). They want two small additions surfacing a monthly cashflow figure the app already computes, plus a change to which tab the app opens on.

## Goal

1. Change the app's default tab on load from Analysis to Owned.
2. Add a "Monthly cashflow" stat tile to the Portfolio dashboard, next to "Monthly rent" — the sum of every owned property's monthly cashflow.
3. Add a read-only "Monthly cashflow" figure to each property's Owned tab, next to "Rent (PCM)" in the Tenancy panel — that single property's own monthly cashflow.

## Out of scope

- No new navigation tab, no new screen, no new data entry fields.
- No change to how cashflow itself is calculated (`computeDeal()`'s `cashflow`/`annual` fields, `app.js:286`, are untouched) — this only surfaces the existing figure in two new places.
- No change to the existing "Annual cashflow" tile, the Owned-properties table's existing "Cashflow/mo" column, or any other existing Portfolio/Owned-tab content.
- No change to Analysis, Purchasing, or Refurbishing tabs beyond which one is selected by default on load.

## Change 1: Default tab on load

In `app.js`, the `section` state variable currently initializes to `"analysis"` (`let view = "list", currentId = null, tab = "deal", homeMode = "list", section = "analysis", ...`). Change the initial value to `"owned"`, so the Pipeline view opens on the Owned/Portfolio tab by default. The phase-tab nav itself, and the ability to switch to any other phase, are unaffected — only the initial selection changes.

## Change 2: Portfolio "Monthly cashflow" stat tile

In `renderPortfolioHTML()`, the existing accumulator loop already computes `totRent`, `totAnnual`, and `totEquity` by iterating every owned property once. Add a fourth accumulator, `totCashflow`, summing each property's `c.cashflow` (the existing per-property monthly figure from `computeDeal()`) in that same loop — no new iteration, no new calculation, just one more running total alongside the ones already there.

Insert a new `.pstat` tile in the stats row, directly after "Monthly rent" and before "Annual cashflow":
```
<div class="pstat"><div class="k">Monthly cashflow</div><div class="v" style="...">${money(totCashflow)}</div></div>
```
Colour the figure the same way the existing "Annual cashflow" tile already does — red (`color:var(--bad)`) when negative, default ink colour otherwise. This keeps the same visual treatment already established for cashflow figures elsewhere in the app (e.g. deal cards' `v.good`/`v.bad` classes), applied consistently rather than introducing a new colour convention.

## Change 3: Per-property "Monthly cashflow" figure in the Owned tab

In `renderManage(d)`, the Tenancy panel's `row2` grid currently has: Tenant name, Contact, Rent (PCM) [editable], Deposit, Tenancy start, Tenancy end, Deposit scheme. Add one more `.field` immediately after "Rent (PCM)", showing this property's own computed monthly cashflow as a read-only value (not an input — there's nothing to edit, it's derived) — formatted and colour-coded the same way as the Portfolio tile (red when negative). This requires `computeDeal(d)` to be called in `renderManage(d)` if it isn't already in scope there (check before assuming — `renderManage` currently only calls `ensureManage(d)`).

## Risks / edge cases

- A property freshly moved to Owned with no rent entered yet will show a negative or zero cashflow figure (mortgage/management/maintenance costs with no income) — this is already true of the existing Portfolio table's "Cashflow/mo" column and the Analysis tab's cashflow figure, so no new edge case is introduced, just a new place the same possible negative figure can appear.
- Changing the default `section` value only affects what's shown on first load of a session — it doesn't change saved data or force-navigate a user away from wherever they currently are mid-session.
