# Loan Agreement Generation — Design

## Context

POCO Property's app (`app.js`, no-build static site) has a "Finance raised" list in the Purchasing tab (`renderPurchasing(d)`) — entries for investors, friends/family, and bridging loans, each with name, amount, rate, date loaned, payback date, and an auto-calculated interest figure (`loanInterest()`).

The owners have a standard loan agreement template they currently produce by hand for friends-and-family lending (example reviewed: `Poco Loan Agreement Document_LH_Owen.pdf`). It's a fixed-wording legal document — numbered clauses 1–10, a definitions block, a loan schedule, a guarantee clause, and three signature blocks (Lender, Borrower, Guarantor) — where only a handful of fields actually change between agreements: the Lender's name and address, the loan amount, the loan date, the repayment date, and the interest rate. The Borrower (Poco Property Limited) and Guarantor (Peter & Caroline Owen, same address as the company) are always the same.

The app already has an established pattern for exactly this kind of output: `renderSummary(d)` ("Share summary") renders a printable `.sheet`-styled view with a `.no-print` toolbar and a "Print / Save as PDF" button (`window.print()`), using print-specific CSS already in `styles.css` (`@media print{...}`). This feature reuses that pattern rather than introducing a new one.

## Goal

From a Finance raised entry with enough information filled in, generate a print-ready loan agreement matching the existing template's wording exactly, with the loan-specific fields substituted in, viewable and printable to PDF the same way the existing "Share summary" feature works.

## Out of scope

- No PDF library, no new dependency — output is a printable HTML view, same mechanism as the existing Share summary feature. The user prints to PDF via their browser's native print dialog.
- No change to the legal wording of the template. Every clause (1 through 10, the Borrower's warranties, the default provisions, the guarantee, the governing-law clause) is reproduced verbatim from the reviewed example document. This feature does not draft, edit, or interpret legal text — it fills in blanks in an existing document the owners already use. The author is not a lawyer and is not warranting the legal adequacy of this document; that responsibility remains with the owners, exactly as it already does for their existing hand-produced version.
- No support for varying the party structure (e.g. no guarantor, a different borrower entity, multiple lenders on one agreement) — per the brainstorming answer, the Borrower and Guarantor are always fixed.
- No digital signature capture — the printed document has the same blank signature lines as the original template, to be signed physically/by hand exactly as today.
- No editing of a generated agreement after the fact through the UI — if a finance entry's details change, regenerating the agreement (same button) reflects the new values; there's no separate "saved agreement" record distinct from the live finance entry data.

## Data model changes

**1. New field on each finance entry** (`purchase.finance[i]`): `address` (string, the lender's full postal address) — added to the existing default shape (`{name:"", amount:"", rate:"", dateLoaned:"", paybackDate:"", address:""}`) and to `ensurePurchase()`'s backfill list for existing entries.

**2. New Settings fields** (`DATA.assumptions`, alongside the existing `DEFAULT_ASSUMPTIONS` like `ltvPct`/`mortgageRate`): three new string fields — `companyName` (default `"Poco Property Limited"`), `companyAddress` (default `"2 Morris Park, Hartford, Northwich, Cheshire CW8 1SB"`), `directorNames` (default `"Peter Owen & Caroline Owen"`). These back both the Borrower's details (company name + address, directors' names on the signing block) and the Guarantor's details (directors' names + the same company address, matching the reviewed template where the Guarantor's address is identical to the Borrower's trading address).

## UI changes

**1. Finance row gets an address field.** Below each existing `.frow` grid row (Name/Amount/Rate/Date loaned/Payback date/Interest/Delete) in the Finance raised panel, add one full-width text input for the lender's address — doesn't require changing the existing 7-column `.frow` grid, just one more row beneath it per entry.

**2. "Generate agreement" button per finance entry.** Placed next to the existing delete (✕) button on each finance row. Disabled (greyed out, non-clickable) until that entry has `name`, `address`, `amount`, `rate`, `dateLoaned`, and `paybackDate` all filled in — since the document can't be meaningfully produced without them. A short hint (e.g. a `title` tooltip) explains why it's disabled when it is.

**3. Settings gains a "Borrower & Guarantor details" panel**, following the exact visual pattern of the existing "Deal assumptions" panel (`.panel` with `.field` inputs) — three plain text fields for `companyName`, `companyAddress`, `directorNames`.

**4. New printable view: the agreement itself.** A new `renderLoanAgreement(d, financeIndex)` function, routed via the same `view` state mechanism as `renderSummary` (`view==="agreement"` → call with the current deal and which finance entry to render), reachable only via the "Generate agreement" button (no direct URL/nav entry point needed, matching how `summary` is only reached via the "Share summary" button). Structurally mirrors the reviewed template:
- Title page (Loan agreement, dated today)
- Definitions block (Interest Payment, Loan, Loan Date, Repayment Date)
- The three parties (Lender from the finance entry; Borrower and Guarantor from the new Settings fields)
- Numbered clauses 1–10, verbatim from the template, with the loan amount/dates/rate substituted into the same handful of spots the original template fills them in
- Loan Schedule (Amount, Loan Date, Repayment Date, Interest rate, Interest over full term — using `loanInterest()`'s output)
- Guarantee section, verbatim
- Three signature blocks (Lender / Borrower / Guarantor), with names and addresses substituted in, blank signature lines as in the original

Uses the same `.sheet` / `.no-print` / `window.print()` toolbar pattern as `renderSummary`, so no new print CSS is needed — the existing `@media print{...}` rules already handle hiding the toolbar and stripping the `.sheet` border/padding for print.

## Risks / edge cases

- **Existing finance entries** created before this feature won't have an `address` value — `ensurePurchase()`'s backfill defaults it to `""`, and the "Generate agreement" button stays disabled until it's filled in (same as any other missing required field), so there's no broken/incomplete-document risk.
- **Settings defaults are pre-filled** with the real company/director details from the reviewed template, so the feature works correctly the first time it's used without requiring the owners to visit Settings first — but they remain editable there if anything changes (e.g. a future office address change).
- **Interest calculation reuses `loanInterest()` exactly as built for the Finance raised list** — no second calculation path, no risk of the agreement's stated interest figure ever disagreeing with what's shown in the Finance raised panel itself.
