# Property App — Design Spec

A working blueprint to design from. It covers the whole thing you asked for (deal analysis, refurb costing, pipeline, and management), but it's deliberately ordered so you can design the high‑value core first and leave the rest as later phases.

Everything here is reverse‑engineered from your own St Helens workbook and refurb cost sheet, so the logic should feel familiar — just cleaned up and made editable.

---

## 1. The big picture

What you described is really **two products that share one thing in common: the property.**

- **Acquisition** (the part you do daily): find a property → estimate refurb → run the numbers → decide whether to offer → track it through to purchase. This is what your spreadsheet already does.
- **Management** (the part that starts once you own it): tenancy, rent, maintenance, compliance dates. Different screens, different mindset.

The trick that keeps it from becoming two disconnected apps is a single **Property record** that travels through the whole journey:

```
   Lead  →  Viewing  →  Analysed  →  Offer  →  Agreed  →  Bought  →  Managed
   └──────────── Acquisition side ────────────┘        └─ Management side ─┘
```

The same property carries its deal numbers, its refurb estimate, and (later) its tenancy and certificates. Nothing is re‑typed when a deal becomes a real asset.

**Suggested phasing** (you picked all four jobs — this is the order I'd design them in):

| Phase | What it is | Why first |
|---|---|---|
| **1 — Core** | On‑the‑road deal analyser + built‑in refurb checklist + a saved list of deals | Directly replaces the spreadsheet; it's the thing you use most |
| **2 — Pipeline** | Drag deals through stages, comparables notes, a shareable one‑page summary | Turns scattered tabs into a proper pipeline |
| **3 — Management** | Tenancy, rent ledger, maintenance, compliance reminders | Only relevant after you own something; can wait |

---

## 2. The object model (what a designer needs to know before drawing screens)

Five core objects. If these are right, the screens almost design themselves.

**Property / Deal** — one per address. Holds:
- Address, postcode, beds, listing price, source (agent / auction / off‑market), photos, notes
- Stage (Lead → … → Managed)
- A **Deal Analysis** (section 4)
- A **Refurb Estimate** (section 3)
- Later: a **Tenancy** and **Compliance** records (section 6)

**Cost Item (the refurb library)** — the menu from your PDF. Each item has: name, category, *unit type* (see below), and an **editable default rate**. This is the single most important "make it future‑proof" decision: rates live in an editable library, not hard‑coded, so the app never goes out of date the way the PDF did.

**Refurb Estimate** — for one property: a list of chosen cost items, each with a quantity → line totals → subtotal → contingency → PM fee → **grand total**. That grand total is the number that flows into the deal analysis.

**Assumptions (global settings)** — the defaults your maths leans on, all editable in one place: LTV %, mortgage rate, stress‑test rate, management %, maintenance/voids %, solicitor fee, broker fee, cost‑of‑money %, and the stamp‑duty bands. Pulling these out of the calculation and into Settings is what stops the "stamp duty is now wrong" problem from ever happening again.

**Tenancy / Compliance** (Phase 3) — tenant, rent, dates, deposit + scheme, and a set of certificates with expiry dates.

---

## 3. The refurb cost calculator

This is the missing piece — right now it lives in a static PDF and gets added up by hand. The design goal: **tap through a checklist for the property, enter a few quantities, get a total that drops straight into the deal.**

### Unit types

Every cost item behaves as one of these. The input the user sees changes accordingly:

| Unit type | User enters | Line total | Examples from your sheet |
|---|---|---|---|
| Fixed | just tick it | the rate | New roof, new kitchen suite, boiler |
| Per unit | a count | rate × count | Windows, external doors, blown panes |
| Per room | a count of rooms | rate × rooms | Bedroom flooring, skim, paint |
| Per sqm | an area | rate × sqm | Re‑board ceiling, partition wall, carpet |
| Per metre | a length | rate × metres | Damp proof course, underpinning |
| Per day | number of days | rate × days | Garden work |
| Per wall | a count of walls | rate × walls | Pointing |
| Percentage | a % (slider) | % × subtotal | Contingency |

### The library (your PDF, structured — note: rates are *defaults*, all editable)

> Two corrections from the PDF: "Casting" should read **"Casing"** (door casing), and the contingency is a **range (10–20%)** best shown as a slider.

**External Works** — New Roof (terraced) £5,000 · Minor Roof Works £50 · Chimney Pointing £1,000 · Chimney Minor Works £100 · Front Gutters £450 · Rear Gutters £300 · Fascia & Soffits £1,200 · External Door (non‑composite) £450 *(per unit)* · Windows £400 *(per unit)* · Garden Work £120 *(per day)* · Fence £700 · Pointing £1,400 *(per wall)*

**Kitchen** — New Suite £2,500 · Flooring £225 · Strip Wallpaper/Tiles £175 · Skim Throughout £400 · Paint Throughout £175 · Re‑board Ceiling £55 *(per sqm)* · Radiator £175 · Internal Door w/ Casing £100 · Fire Door w/ Casing £350 · Skirting £150 · Smoke Alarm £100 · Blown Window Pane £50 *(per unit)*

**Bathroom** — New Suite £1,750 · Flooring £225 · Strip Wallpaper/Tiles £175 · Skim £400 · Paint £175 · Re‑board Ceiling £55 *(per sqm)* · Radiator £200 · Internal Door w/ Casing £100

**WC** — New Suite £275 · Flooring £100 · Strip £75 · Skim £200 · Paint £100 · Re‑board Ceiling £100 · Radiator £75 · Internal Door w/ Casing £100

**Bedrooms / Reception / Hallway / Landing** — Flooring £225 *(per room)* · Strip Wallpaper £175 *(per room)* · Skim £400 *(per room)* · Paint £175 *(per room)* · Re‑board Ceiling £55 *(per sqm)* · Partition Wall £55 *(per sqm)* · Radiator £175 · Internal Door w/ Casing £100 · Fire Door w/ Casing £350 · Skirting £150 *(per room)* · Smoke Alarm £100 *(per room)* · Blown Window Pane £50 *(per unit)*

**Flooring breakdown** *(all per sqm)* — Carpet £8 · Carpet Underlay £5 · Laminate £12 · Laminate Underlay £2

**Other** — New Boiler £1,500 · Relocate Boiler £1,500 · Full Heating inc. Radiators £2,500 · Full Rewire inc. Consumer Unit £2,500 · Partial Rewire £1,000 · New Consumer Unit £100 · Isolation Switch £50 · Damp Proof Course £120 *(per metre)* · Underpinning £1,000 *(per metre)* · Woodworm Treatment £500 · Replace Lintel £400 · Project Management Fee £1,000 · Contingency 10–20% *(percentage)*

**Extensions** — En‑suite (2sqm internal) £3,000 · En‑suite (2sqm external) £7,000 · Loft Conversion £25,000

### Total formula

```
Subtotal      = Σ (item rate × quantity)
Contingency   = Subtotal × contingency%        (slider, default 15%)
Refurb total  = Subtotal + Contingency + Project Management Fee
```

`Refurb total` → becomes the **Refurb** line in the deal analysis. That's the whole point of the integration.

### Screen sketch
- A property's "Refurb" tab opens on collapsible category sections (External, Kitchen, Bathroom…).
- Tap an item to add it; if it needs a quantity, a small stepper/number field appears inline.
- A **sticky running total** sits at the bottom so the number is always visible as you tick.
- A long‑press / edit affordance lets you change a rate (and "save as my default" updates the library).

---

## 4. The deal analysis (your Excel, translated)

Your model has four blocks. Here they are as plain formulas. I've kept your exact logic so the outputs match your spreadsheet, and only flagged the one figure that's genuinely out of date (stamp duty).

### Block A — Max Offer (the "MIMO" calc)

The idea: you'll refinance at 75% of the *post‑refurb* value and want to pull **all** your cash back out ("Money In, Money Out"). So the most you can pay is the mortgage you'll release, minus everything it has to cover.

```
DUV            = post-refurb value you find from comparables   (you type this in)
Mortgage       = DUV × LTV%                                     (LTV default 75%)
Cost of Money  = Mortgage × costOfMoney%                        (default ~5%)
Stamp Duty     = banded on purchase price  (see note below)
Costs          = Refurb + Solicitor + Broker + Cost of Money + Stamp Duty
MAX OFFER      = Mortgage − Costs
```

*Worked example (your 14 Elizabeth St): DUV £121,000 → Mortgage £90,750 → minus refurb £22,770, solicitor £1,500, broker £500, cost of money £4,537.50, stamp duty £2,722.50 → **Max Offer £58,720.** Matches your sheet exactly.*

### Block B — Cashflow (per month)

```
Mortgage payment = (Mortgage × mortgageRate) / 12
Management       = Rent × management%        (default 10%)
Maintenance/MOE  = Rent × moe%               (default 15%)
CASHFLOW (PCM)   = Rent − Mortgage payment − Management − Maintenance − HMO costs
ANNUAL CASHFLOW  = CASHFLOW (PCM) × 12
```

A **stress‑test toggle** recalculates the mortgage payment at a higher rate (your sheet uses 5%) and shows the stressed cashflow next to the normal one. Worth showing both side by side — it's the quickest "does this still work if rates rise" gut‑check.

> Because you borrow through a company, set the default **mortgage rate** to a *limited-company BTL* figure — these typically price a little higher than personal BTL, so a residential rate would flatter the cashflow.

### Block C — ROI ladder

This answers "how far above max offer can I go, and how long until the cashflow pays that extra back?"

```
Offer at n-year payback = MAX OFFER + (n × ANNUAL CASHFLOW)
```

- +1× annual cashflow → that extra is repaid in **12 months** (100% ROI)
- +2× → 24 months (50%) · +3× → 36 months (33%) · +4× → 48 months (25%) · +5× → 60 months (20%)

And the live feedback once you enter a real offer:

```
MONEY LEFT IN DEAL = Your Offer − MAX OFFER
```

If it's £0 or below, you've pulled all your money out (a true MIMO/BRRR deal). Above £0, that's your stuck capital — and the ROI ladder tells you how fast it comes back.

### Block D — 145% BTL stress test (lender check)

```
Max Borrowing = (Rent × 12) ÷ 5.5% ÷ 145%
```

Then compare **Max Borrowing** with the **Mortgage (75% LTV)** from Block A:
- If Max Borrowing ≥ Mortgage → the rent supports the loan. ✅
- If Max Borrowing < Mortgage → you'll need a bigger deposit; flag it and prompt "do the numbers still stack?"

Your rule of thumb still holds and is worth showing as helper text: *roughly £15k of borrowing per £100/month of rent.*

### The one thing to update: Stamp Duty

Your sheet uses ~3% of the mortgage. Two things changed:
1. The **additional‑property surcharge rose from 3% to 5%** (31 Oct 2024).
2. SDLT is charged in **bands on the purchase price**, not a flat % of the mortgage.

Additional‑property bands (England & NI, in force 2026):

| Portion of price | Rate |
|---|---|
| £0 – £125,000 | 5% |
| £125,001 – £250,000 | 7% |
| £250,001 – £925,000 | 10% |
| £925,001 – £1,500,000 | 15% |
| Over £1,500,000 | 17% |

**You buy through a UK Ltd company (SPV)** — which actually makes this simpler:
- The 5% surcharge **always applies** to a company purchase. There's no "main residence" exemption a company could ever claim, so there's no edge case to design around — it's always additional rates.
- **Handy shortcut for your patch:** almost all your St Helens deals are under £125,000, where the whole price sits in the first band — so stamp duty is simply **5% × purchase price**. Offer that simple version by default and the full banded calc for pricier deals.
- **One company-only wrinkle:** a flat **17% rate on purchases over £500,000**. Terraced houses won't hit it, but leave room for it as a setting in case you ever buy bigger. (There's a relief that lets a genuine property-rental business use the normal banded rates instead of the 17% flat — worth confirming with your accountant, but it's moot below £500k.)
- (Scotland and Wales use different systems — worth a setting if you ever buy outside England/NI.)

> I'm not a tax adviser — treat the above as the factual lay of the land, and let your accountant confirm the specifics for your setup.

> Keep your "this is a rough guide, always do your own due diligence" note. It's good practice and it sets the right expectation — the same honesty the better commercial tools lead with.

---

## 5. Pipeline (Phase 2)

Replaces "one spreadsheet tab per property" with a board or list you move cards through:

`Lead → Viewing booked → Analysed → Offer made → Offer agreed → Legal → Completed` (plus a `Rejected` lane).

Each card shows the four numbers that matter at a glance: **Max Offer**, **Your Offer**, **Money Left In**, **Monthly Cashflow** — colour‑coded so a MIMO deal (money left in ≤ £0) reads green instantly. Add a couple of light extras here: a notes field for **comparables** (the addresses/prices you used to set DUV) and a **shareable one‑page summary** (the numbers + photos) for brokers or JV partners.

---

## 6. Management (Phase 3)

Only kicks in once a property is marked Completed. Four simple areas:

- **Tenancy** — tenant name/contact, rent (PCM), start/end dates, deposit amount + protection scheme.
- **Rent ledger** — month‑by‑month paid / due / arrears; a dashboard tile for total monthly rent across the portfolio.
- **Maintenance log** — issues raised, status, cost (and those costs can feed back into how accurate your MOE % assumption really is).
- **Compliance reminders** — the genuinely useful nag. Certificates with expiry dates (e.g. Gas Safety, electrical/EICR, EPC) that surface a reminder before they lapse. This is the single feature most likely to save you a real headache.

A **portfolio dashboard** ties it together: total monthly rent, total annual cashflow, and rough equity (current value − outstanding mortgage) per property and overall.

> **Company tax matters here, not in the deal calc.** Because you hold through a Ltd company, profit is taxed at corporation tax, and mortgage interest is *fully deductible* against profit (unlike personal ownership, where it's restricted). So when you model "profit" on the dashboard, base it on corporation tax — not personal income tax. None of this changes the Max Offer / cashflow / ROI maths in Section 4; it only affects the after-tax profit view here.

---

## 7. Design principles to hold onto

1. **Speed beats completeness.** Your own note — "for when you're on the road and need to be quick" — is the north star. The core loop (add property → tick refurb → see if it stacks) should take under a minute on a phone.
2. **Show your working.** Keep every assumption visible and editable. The better tools win trust by never hiding the maths; your spreadsheet already does this, so don't lose it.
3. **Defaults in one place.** Every rate and percentage lives in Settings / the cost library — nothing hard‑coded. That's what keeps it from ageing like the PDF.
4. **One property, one record.** The same property flows from lead to managed asset without re‑typing.
5. **Honest, not precise.** It's a rough indicator to decide whether to dig deeper — label it that way.

---

## 8. Open questions for when you start designing

- **Limited company vs personal:** ✅ Confirmed — you buy through a UK Ltd company (SPV). Defaults are set accordingly: 5% stamp duty always applies, a company-BTL mortgage rate, and corporation-tax-based profit on the Phase 3 dashboard.
- **Comparables / DUV:** happy to keep typing DUV in manually, or do you eventually want the app to help find comparable values? (That needs a data source — a later, bigger decision.)
- **HMO:** your sheet has an HMO costs line — is HMO a strategy you want first‑class support for, or is single‑let BTL the main game for now?
```

This determines a couple of the default assumptions, but none of it blocks you starting on the Phase 1 screens.
