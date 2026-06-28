# Finance Raised Section — Design

## Context

POCO Property's app (`app.js`, a single-file no-build static site) tracks each deal through phases (Analysis → Purchasing → Refurbishing → Owned). The Purchasing tab (`renderPurchasing(d)` in `app.js`) currently has a "Mortgage application" panel with two fields: `Lender` (text) and `Status` (select, using `MORTGAGE_STATES`).

In practice, purchases are funded by investors, friends/family, or bridging loans — not a single mortgage application with a lender and a progress status. The current panel doesn't fit. A deal can have more than one finance source at once (e.g. a bridging loan plus a friend's contribution), so this needs to be a list, similar to the existing Contractors list already built for the Refurbishing tab (`r.contractors`).

This is a follow-on to the recently-shipped Owned-phase Mortgage panel (`manage.mortgage`, commits `0119f77`/`ade08d7`/`1ef0d7a`). That feature is untouched by this change — `MORTGAGE_STATES` and its "Completed" state remain in place for the Owned tab's mortgage-status tracker. Only Purchasing's *use* of `MORTGAGE_STATES` (the `mortgageStatus` field) is removed, since a finance-raised entry doesn't have an application-progress concept the way a mortgage does.

## Goal

Replace the "Mortgage application" panel in Purchasing with a "Finance raised" panel: a list of finance entries, each with a name, amount, interest rate, date loaned, payback date, and an auto-calculated (read-only) total interest figure for that entry. Show a running total of amount raised across all entries for the deal.

## Out of scope

- No change to the Owned-phase Mortgage panel or `MORTGAGE_STATES` itself (only Purchasing's consumption of it is removed).
- No change to the conveyancing checklist, agreed price, solicitor fields, or key dates panels in Purchasing — those stay exactly as they are.
- No status tracker for finance entries (no "Applied/Agreed/Received" concept) — this is explicitly a simpler record than the Owned mortgage tracker, matching what the owners asked for.
- The total-interest calculation is informational only — it does not feed into any other calculation (Max Offer, cashflow, ROI ladder, stamp duty). Those remain exactly as they are today.
- No editing/overriding of the calculated total interest — it's always derived live from amount/rate/dates, never stored, never directly editable (this avoids it ever drifting out of sync with its inputs).

## Data model

In `app.js`, the `purchase` object (default literal in the new-deal object, and `ensurePurchase()`'s backfill function):

- **Remove**: `lender` and `mortgageStatus` keys.
- **Add**: `finance: []` — an array of plain objects, each shaped `{ name:"", amount:"", rate:"", dateLoaned:"", paybackDate:"" }`.

`ensurePurchase()` must backfill `p.finance=[]` for any deal that doesn't already have it (the same pattern already used for `r.contractors` in the Refurbishing tab and `m.maintenance` in the Owned tab), and must no longer backfill `lender`/`mortgageStatus`.

No new field is added for "total interest" — it's purely derived at render time from `amount`, `rate`, `dateLoaned`, and `paybackDate`, so there's nothing to backfill or persist for it.

## Calculation: total interest per entry

Simple interest, not compound (this matches the "rough guide" nature of every other figure in this app — no compounding, no daily-accrual nuance):

```
years = (paybackDate − dateLoaned) in days, divided by 365.25
totalInterest = amount × (rate / 100) × years
```

Displayed per row, formatted with the existing `money()` helper, only once `amount`, `rate`, `dateLoaned`, and `paybackDate` are all present and parse to valid numbers/dates (`dateLoaned` must parse to an earlier date than `paybackDate`, using the same date-parsing approach already used elsewhere in the file, e.g. `daysTo()`). If any input is missing, unparseable, or `paybackDate` isn't after `dateLoaned`, show a dash (`—`) instead of a figure — never show a negative, zero-by-coincidence, or `NaN` value.

## UI

The "Mortgage application" panel in `renderPurchasing(d)` is replaced with a "Finance raised" panel, following the established Contractors-list pattern (Refurbishing tab) for markup and interaction:

- One row per `purchase.finance` entry: Name (text), Amount (£-prefixed number), Rate (%-suffixed number), Date loaned (date), Payback date (date), a read-only Total interest figure (or `—`), and a delete button (✕, same `.comp-del` class and pattern as Contractors' row delete).
- A "+ Add finance" button appends a new blank entry, same interaction pattern as Refurbishing's "+ Add contractor".
- Below the list, a running total: "Total raised: £X" summing every entry's `amount` (parsed via the existing `num()` helper) — same visual treatment as the Maintenance log's running total in the Owned tab (`.comp-avg` element, hidden when the sum is zero).
- If there are no entries yet, show the same "nothing yet" placeholder style already used elsewhere (e.g. Refurbishing's "No contractors added." hint), e.g. "No finance sources added yet."

## Knock-on change: Purchasing pipeline card subtitle

`renderPurchasingListHTML()` currently shows, in each deal's pipeline card: `${done}/${PURCHASE_CHECKLIST.length} conveyancing steps · mortgage: ${p.mortgageStatus}`. Since `p.mortgageStatus` no longer exists, this becomes: `${done}/${PURCHASE_CHECKLIST.length} conveyancing steps${total raised summary}`, where the finance-raised summary is appended only if there's at least one entry with a parseable amount > 0, e.g. ` · finance raised: ${money(totalRaised)}`; otherwise the clause is omitted entirely (not shown as "£0" or similar).

## Risks / edge cases

- **Existing saved deals**: any deal that already has `purchase.lender`/`purchase.mortgageStatus` values from before this change will simply stop showing them (those keys become unused, not deleted from storage — no migration/deletion step needed, this app doesn't strip unknown keys elsewhere either). `ensurePurchase()`'s backfill must add `finance:[]` for these deals without erroring on the presence of the old now-unused keys.
- **Date validation**: a payback date before or equal to the date loaned must not produce a calculated interest figure (would otherwise yield a negative or zero-divided-by-zero result) — show `—` instead, per the calculation section above.
- **Existing in-progress Purchasing deals with only a `lender` filled in, no finance entries yet**: this is expected and fine — the panel just starts empty, same as any other newly-added list feature in this app (e.g. Contractors/Maintenance starting empty on first use).
