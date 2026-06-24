# Account Module — Client Feedback Implementation Plan (Prototype)

**Scope:** Implement the **account-related feedback only** into the GoldBooks prototype (`/prototype`, static HTML + jQuery + JSON).
**Date:** 2026-06-24
**Build style:** UI-first, JSON-driven, phase by phase. Each phase is independently runnable in the browser via XAMPP (`http://localhost/meet/accounting-software/prototype/`).

---

## 0. Scope Filter — What is IN vs OUT

The raw feedback covered the whole ERP. Below it is split so we build **only the accounting parts** now.

### ✅ IN SCOPE (account-related — this plan)
| Feedback item | Why it's accounting |
|---|---|
| Outstanding amount needs to handle | Receivable/Payable subledger |
| Journal entry must reflect on **Ledger AND Outstanding** (currently only Ledger) | GL + subledger posting integrity |
| All kinds of entries must reflect on Ledger **and** Outstanding | Same — applies to every voucher |
| JE "payment ke saamne close" option | Bill settlement / knock-off |
| Debtors close option / vice-versa creditors | Manual settlement |
| Unit-wise entry | Accounting dimension (unit) |
| Payable/Debitable **adjustment**; **Bill-to-bill adjustment** | Adjustment voucher in account flow |
| Sub-categories for Purchase / Sales / Journal book / Cashbook (list all types) | Voucher classification |
| Make **GRN optional in bill** (Rent = no GRN, Sell = GRN) | Billing config |
| All kinds of **payments + USD exchange** (import, gas, light bill, share & F&O, LC direct, against cheque) | Payment vouchers + forex |
| **LC generator (party-wise)** + invoices | Trade finance / payments |
| Agent = customer % ; royalty **only on full payment** ; **settlement from agent account** | Commission accounting |
| Sales order restriction after **credit-days limit** exceed | Credit control (AR) |
| After limit, **% penalty charge** | Interest/penalty posting |
| **GR (return handling)** + GR limit (the accounting effect = return note) | Credit/Debit note + outstanding effect |
| Reconciliation handled in software | Bank reconciliation depth |
| **Purchase register vs GST portal** (ref Tally/Busy) | GST input reconciliation |
| **Monthly GST return** properly included | Statutory return |
| **TDS by PAN** (PAN letters decide rate) | Statutory deduction |
| **Quarterly TDS return** govt form | Statutory return |
| **Lock feature once GST filed** | Period lock |
| **Activity logs** (accounts + all depts) | Audit trail |

### ❌ OUT OF SCOPE (operational/inventory — not this plan)
- Product **variation** management at inventory side
- **RFID** tracking (QR alternative)
- GR **limit for salesman** as a sales-role workflow (only its accounting effect is in scope)
- **Vendors / contract → approval → order → approval → GRN → inventory** procurement workflow (only the resulting bill booking is in scope)
- Manual Excel report management (covered later by report engine)
- **Product price history** — *borderline*; flagged as optional add-on in Phase 7, not core.

---

## 1. Current Prototype Baseline (relevant account pages)

Already present (build on these, don't recreate):
- `pages/chart-of-accounts.html`, `pages/journal-entry.html`, `pages/general-ledger.html`, `pages/credit-debit-notes.html`
- `pages/customers.html`, `pages/suppliers.html`, `pages/payments.html`, `pages/bank-reconciliation.html`, `pages/cheque-printing.html`
- `pages/agents.html`, `pages/ageing.html`, `pages/gst-returns.html`, `pages/taxes.html`
- `pages/trial-balance.html`, `pages/profit-loss.html`, `pages/balance-sheet.html`
- Data model in `data/*.json`; shared shell + helpers in `assets/js/app.js`; nav in `partials/sidebar.html`.

**Key known gap (from feedback):** vouchers currently post to `gl-entries.json` (Ledger) only. The party `transactions[]` / outstanding is not driven from the same posting. The central theme of this plan is: **one posting → both GL and Outstanding.**

---

## 2. Conventions for every phase
- New screens follow existing page pattern (load shell via `App.loadShell`, data via `App.data('file.json')`, golden Sneat theme).
- New nav links added under the right section in `partials/sidebar.html` **and** registered in the `ALL_PAGES` array + role maps in `assets/js/app.js`.
- New fixtures live in `data/*.json`. Posting logic demonstrated client-side (no backend).
- Every voucher form gains, where relevant: **Unit** selector, **Outstanding effect preview**, and **sub-category** dropdown.

---

## Phase 1 — Outstanding & Ledger Posting Engine  🔴 foundation
**Goal:** Every voucher posts to **both** the General Ledger **and** an Outstanding (bill-wise) subledger. This is the backbone the rest of the plan depends on.

**Build:**
1. New **Outstanding** page (`pages/outstanding.html` + `data/outstanding.json`): party-wise and **bill-wise** open items (invoice, date, due date, amount, paid, balance, status, unit), for both Debtors and Creditors. Filters: party, type (Receivable/Payable), unit, ageing bucket.
2. New shared helper in `app.js`: `App.postVoucher(voucher)` that produces **GL lines + outstanding lines** from one voucher object (demo of "single posting → two effects").
3. Modify **Journal Entry** (`journal-entry.html`): when a line has a party + against-bill, show it will also create an **Outstanding** effect (not just Ledger). Add an "Outstanding effect" preview panel next to the GL preview.
4. Add **Unit-wise entry**: `unit` field on JE lines / header and on payments; unit master in `data/masters.json`; unit filter on Ledger + Outstanding.
5. **Close / settle options:**
   - JE line: "Close against payment" (knock-off) toggle → marks the matched outstanding row closed.
   - Debtors page: per-bill **Close** action; Creditors: same (vice-versa).

**Files:** new `pages/outstanding.html`, `data/outstanding.json`; edit `journal-entry.html`, `general-ledger.html`, `customers.html`, `suppliers.html`, `app.js`, `sidebar.html`, `masters.json`.

**Acceptance:** Posting a journal entry with a party shows up in **both** General Ledger and Outstanding. A bill can be closed against a payment. Outstanding can be filtered unit-wise.

---

## Phase 2 — Bill-to-Bill & Payable/Debitable Adjustment
**Goal:** Knock off one open item against another inside the account flow.

**Build:**
1. New **Adjustment** voucher page (`pages/adjustments.html` + `data/adjustments.json`): pick a party, list open debit items and open credit items, allocate one against another (advance ↔ invoice, debit note ↔ invoice, payable ↔ debitable).
2. Bill-to-bill allocation grid with running "remaining to adjust".
3. Each adjustment updates Outstanding (Phase 1 engine) and writes a GL contra entry.

**Files:** new `pages/adjustments.html`, `data/adjustments.json`; edit `outstanding.json`, `sidebar.html`, `app.js`.

**Acceptance:** Selecting two opposite open items and adjusting reduces both balances and posts a balanced contra entry.

---

## Phase 3 — Voucher Categorization & GRN-Optional Billing
**Goal:** Classify entries into sub-categories and make GRN optional on a bill.

**Build:**
1. **Sub-category masters** for: Purchase entry, Sales entry, Journal book, Cashbook — each with a configurable list of types (e.g. Cashbook → Cash Sale, Cash Purchase, Petty Expense, Contra; Journal → JV/Depreciation/Provision/Opening, etc.). Stored in `data/masters.json` (or new `data/voucher-types.json`). Managed from Master Data page.
2. Add a **sub-category selector** to Journal Entry, Payments, and Purchase/Sales invoice headers; show it as a column in the Ledger/registers.
3. **GRN-optional toggle** on Purchase Invoice (and bill flow): a "Requires GRN" flag driven by bill type — **Rent = no GRN, Sale/Goods = GRN required**. When off, the bill posts without a GRN link.

**Files:** edit `masters.html`, `journal-entry.html`, `payments.html`, `purchase-invoice.html`, `sales-invoice.html`, relevant JSON; new `data/voucher-types.json`.

**Acceptance:** Each voucher carries a sub-category; a Rent purchase invoice saves with no GRN, a goods invoice enforces GRN.

---

## Phase 4 — Payments Expansion (multi-type + USD exchange)
**Goal:** Handle all payment kinds with forex and cheque/LC linkage.

**Build:**
1. **Payment category** dropdown on `payments.html`: Import Purchase, Gas, Light Bill, Share & F&O, LC Direct Payment, Payment Against Cheque, plus existing party payments.
2. **Multi-currency / USD exchange:** currency + exchange-rate fields; show base-currency (₹) equivalent and exchange gain/loss line in GL preview.
3. **Payment against cheque:** link to cheque register (`cheque-printing.html`); cheque no/date/bank, status (issued/cleared/bounced).
4. Each payment posts to GL + Outstanding (Phase 1) with category-driven expense/asset account defaults.

**Files:** edit `payments.html`, `payments.json`, `cheque-printing.html`, `data/banking.json`; add category list to masters.

**Acceptance:** A USD import payment records exchange rate, shows ₹ equivalent + forex gain/loss; a cheque payment links to the cheque register; each category posts to the correct account.

---

## Phase 5 — Letter of Credit (LC) Module
**Goal:** Party-wise LC generation and linkage to invoices/payments.

**Build:**
1. New **LC** page (`pages/lc.html` + `data/lc.json`): LC register party-wise — LC no, party, bank, amount, currency, issue/expiry, status, linked invoices.
2. **LC generator** form (party-wise) producing a printable LC document (reuse `print.js`).
3. Link LC to import purchase invoices and to **LC Direct Payment** from Phase 4.

**Files:** new `pages/lc.html`, `data/lc.json`; edit `sidebar.html`, `app.js`, `purchase-invoice.html`, `payments.html`.

**Acceptance:** Create a party-wise LC, print it, and link it to an import bill and an LC payment.

---

## Phase 6 — Agent / Commission Accounting
**Goal:** Commission tied to customer payment, settled from agent account.

**Build:**
1. Extend `agents.html` / `data/agents.json`: agent **% per customer**, agent ledger/account, commission accrual rows.
2. **Royalty/commission accrues only when the customer pays in full** — commission row stays "Pending" until the linked invoice outstanding hits zero (driven by Phase 1 Outstanding), then flips to "Earned".
3. **Customer settlement from agent account:** allow settling a customer's outstanding against the agent's payable/commission balance (an adjustment, reuses Phase 2 engine).

**Files:** edit `agents.html`, `agents.json`, `outstanding.json`, `app.js`.

**Acceptance:** Commission shows Pending until the customer's invoice is fully paid; a customer balance can be settled from the agent account and both ledgers update.

---

## Phase 7 — Credit Control, Penalty & Goods Return (account effect)
**Goal:** Enforce credit terms and post penalties; handle returns as notes.

**Build:**
1. **Credit-days / credit-limit check:** on customer + sales order, when overdue days > credit days OR balance > credit limit, show an **order-restriction warning/block** flag (uses Outstanding ageing).
2. **Penalty charge:** auto-calculate **% penalty/interest** on overdue amount beyond the limit and post it as a debit note / interest income entry (GL + Outstanding).
3. **GR / Return handling:** goods-return creates a **Credit Note (sales return)** or **Debit Note (purchase return)** via `credit-debit-notes.html`, reducing the related Outstanding. Add a configurable **GR limit** check.
4. *(Optional)* **Product price history** add-on: price-change log on items — flagged optional.

**Files:** edit `customers.html`, `sales-orders.html`, `credit-debit-notes.html`, `notes.json`, `outstanding.json`, `taxes.json` (penalty rate).

**Acceptance:** An over-limit customer triggers the restriction flag; an overdue bill generates a penalty entry; a return posts a credit/debit note that reduces outstanding.

---

## Phase 8 — Statutory & Compliance
**Goal:** GST monthly return, purchase-register reconciliation, TDS by PAN, period lock.

**Build:**
1. **Monthly GST return** in `gst-returns.html`: GSTR-1 (outward) + GSTR-3B-style summary from invoices/taxes; HSN summary.
2. **Purchase register vs GST portal** reconciliation: side-by-side match of purchase register lines vs an imported "portal" (mock JSON) — matched / missing / mismatch (Tally/Busy-style). New `data/gst-portal.json`.
3. **TDS by PAN:** rate auto-derived from the **4th letter of PAN** (entity-type → rate map); TDS deduction on payments/bills; deductee register.
4. **Quarterly TDS return** government-form-style report (e.g. 26Q layout) printable.
5. **Lock feature:** once a GST period is filed, **lock** that period — vouchers in it become read-only (period-lock flag in `settings.json`, enforced in voucher forms).

**Files:** edit `gst-returns.html`, `taxes.json`, `settings.html`, `settings.json`; new `data/gst-portal.json`, `data/tds.json`.

**Acceptance:** Monthly GST summary generates from data; purchase register reconciles against portal mock; TDS rate auto-fills from PAN; a filed period locks its vouchers; quarterly TDS form prints.

---

## Phase 9 — Activity Logs / Audit Trail
**Goal:** Who changed what, when — for accounts and (placeholder) all departments.

**Build:**
1. New **Activity Log** page (`pages/activity-log.html` + `data/activity-log.json`): timestamp, user, role, module/department, action (create/edit/delete/post/approve/close/lock), document, old→new summary.
2. Filters by user, module/department, action, date.
3. Hook demo log entries from the major account actions built in Phases 1–8.

**Files:** new `pages/activity-log.html`, `data/activity-log.json`; edit `sidebar.html`, `app.js`.

**Acceptance:** Account actions appear in a filterable activity log; department filter present (extensible to other depts).

---

## 3. Suggested Build Order & Dependencies
```
Phase 1 (Outstanding+Ledger engine)  ← foundation, do first
   ├─ Phase 2 (Bill-to-bill adjustment)
   ├─ Phase 3 (Voucher categories / GRN optional)
   ├─ Phase 4 (Payments + forex)  ──► Phase 5 (LC)
   ├─ Phase 6 (Agent commission, needs Outstanding)
   └─ Phase 7 (Credit control / penalty / returns, needs Outstanding)
Phase 8 (Statutory) — mostly independent, can run in parallel after P1
Phase 9 (Activity log) — last, hooks into all above
```

## 4. Per-phase Acceptance (global)
- Runs in the browser, golden Sneat theme, responsive.
- All data via `data/*.json` (no hard-coded tables).
- The defining rule of this plan holds everywhere: **every posted voucher reflects in BOTH General Ledger and Outstanding.**
</content>
</invoke>
