# Accounting Software — Requirements & Functional Specification

> **Reference systems:** [ERPNext Accounting](https://docs.frappe.io/erpnext/user/manual/en/accounts) and [Odoo Accounting](https://www.odoo.com/app/accounting). This document distils the accounting model that both products share (double-entry ledger, Chart of Accounts, subsidiary ledgers, tax engine, financial reports) into a phased build plan for a self-contained prototype.

- **Version:** 1.0 (Draft)
- **Last updated:** 2026-06-24
- **Author:** John
- **Stack (prototype):** HTML5, CSS3, Bootstrap 5, jQuery, AJAX, Chart/ApexCharts, AOS animations — Sneat-style admin theme
- **Theme:** Off-white surface palette with golden accent
- **Target backend (future):** Laravel (the surrounding project is a Laravel skeleton; this prototype is UI-first and data-driven via JSON so it can later be wired to Laravel APIs)

---

## 1. Vision & Scope

Build a **high-level, double-entry accounting system** comparable in capability to ERPNext and Odoo Accounting, suitable for small-to-mid businesses. The system must enforce accounting integrity (every transaction balances), support multi-currency and tax, and produce the standard statutory financial reports.

### 1.1 Goals
- True **double-entry bookkeeping** — every posted document creates balanced General Ledger (GL) entries.
- Configurable **Chart of Accounts (CoA)** with account groups and tree structure.
- Full **transaction lifecycle**: Draft → Submitted → Paid/Cancelled, with immutable posted entries.
- **Subledgers** for Receivables (customers) and Payables (suppliers) with ageing.
- **Tax engine** (GST/VAT) with inclusive/exclusive computation and tax accounts.
- **Multi-currency** with exchange-rate capture and gain/loss handling.
- **Bank reconciliation** against statements.
- **Financial statements**: Trial Balance, Profit & Loss, Balance Sheet, Cash Flow, plus GL and ageing reports.
- **Period controls**: fiscal years, period closing, opening balances.

### 1.2 Non-goals (prototype phase)
- No real authentication/authorisation backend (mocked).
- No persistent database — prototype uses JSON fixtures loaded over AJAX. Posting/validation logic is demonstrated client-side.
- No payroll, manufacturing, or full inventory valuation (only the inventory hooks needed for COGS).

---

## 2. Reference Analysis — What we borrow from ERPNext & Odoo

| Concept | ERPNext | Odoo | Our Model |
|---|---|---|---|
| Ledger structure | GL Entry per voucher | account.move + account.move.line | **Journal Entry** header + balanced **GL Lines** |
| Chart of Accounts | Tree, Account types, root types | Tree, account types | Tree CoA with **Root type** (Asset/Liability/Equity/Income/Expense) + **Account type** |
| Customer/Supplier | Party + Party Type | res.partner | **Party** (Customer / Supplier) with default receivable/payable accounts |
| Sales document | Sales Invoice | Customer Invoice | **Sales Invoice** → posts to Debtors + Income + Tax |
| Purchase document | Purchase Invoice | Vendor Bill | **Purchase Invoice** → posts to Creditors + Expense + Tax |
| Payment | Payment Entry | account.payment | **Payment** with allocation against invoices |
| Tax | Tax Templates + Tax Category | Taxes + Fiscal Position | **Tax** records with rate, account, inclusive flag, grouped into **Tax Templates** |
| Numbering | Naming Series | Sequences | **Document numbering series** per doctype |
| Periods | Fiscal Year + Period Closing Voucher | Fiscal Year + Lock dates | **Fiscal Year** + **Period Close** |
| Reports | Financial Statements | Financial Reports | Trial Balance, P&L, Balance Sheet, Cash Flow, GL, Ageing |
| Cost tracking | Cost Center | Analytic Account | **Cost Center** (dimension on GL lines) |

---

## 3. Core Accounting Model

### 3.1 The double-entry rule
Every financial transaction produces **two or more GL lines** whose **total debit = total credit**. A document cannot be *Submitted* unless it balances. Posted GL lines are **immutable**; corrections are made via cancellation (reversing entry) or a new adjusting entry.

### 3.2 Account root types & normal balances
| Root type | Normal balance | Increases with | Statement |
|---|---|---|---|
| Asset | Debit | Debit | Balance Sheet |
| Liability | Credit | Credit | Balance Sheet |
| Equity | Credit | Credit | Balance Sheet |
| Income | Credit | Credit | Profit & Loss |
| Expense | Debit | Debit | Profit & Loss |

### 3.3 Account types (sub-classification, drives report logic & automation)
`Bank`, `Cash`, `Receivable`, `Payable`, `Stock`, `Fixed Asset`, `Tax`, `Cost of Goods Sold`, `Income Account`, `Expense Account`, `Equity`, `Round Off`, `Stock Received But Not Billed`, `Temporary`, `Accumulated Depreciation`.

### 3.4 Key entities (data dictionary — prototype JSON shape)

**Account**
```
{ id, code, name, parent_account, is_group, root_type, account_type, currency, balance, status }
```

**Party (Customer / Supplier)**
```
{ id, type, name, tax_id, email, phone, billing_address, currency,
  default_receivable_account | default_payable_account, payment_terms, balance }
```

**Item** (for invoice lines & COGS)
```
{ id, code, name, uom, sales_rate, purchase_rate, income_account, expense_account, tax_template }
```

**Tax**
```
{ id, name, rate, account, type: "On Net Total"|"Inclusive", is_compound }
```

**Journal Entry** (generic voucher)
```
{ id, no, date, type, reference, status: Draft|Submitted|Cancelled,
  lines: [ { account, debit, credit, party?, cost_center?, against? } ],
  total_debit, total_credit }
```

**Sales Invoice / Purchase Invoice**
```
{ id, no, party, date, due_date, currency, exchange_rate, status,
  lines: [ { item, qty, rate, amount, tax_template, income/expense_account } ],
  taxes: [ { tax, rate, amount } ],
  net_total, tax_total, grand_total, outstanding,
  gl_preview: [ ...balanced lines... ] }
```

**Payment**
```
{ id, no, type: Receive|Pay, party, date, paid_from, paid_to, amount,
  allocations: [ { invoice, allocated } ], unallocated }
```

---

## 4. Functional Modules

### 4.1 Dashboard
KPI cards (Cash & Bank, Receivables, Payables, Net Profit, Revenue MTD), income vs expense chart, cash-flow trend, receivables ageing donut, recent transactions, and quick-action buttons.

### 4.2 Chart of Accounts
Tree view (expand/collapse), create/edit account, mark group vs ledger, set root & account type, opening balance, view ledger drill-down. Validation: ledger accounts only under groups; cannot delete an account with entries.

### 4.3 Parties — Customers & Suppliers
List with balances & ageing, create/edit, default accounts, payment terms, contact & address, transaction history, statement of account.

### 4.4 Items / Products
Sales & purchase rates, default income/expense accounts, default tax, UoM.

### 4.5 Transactions
- **Journal Entry** — manual balanced voucher with debit/credit grid, live balance indicator.
- **Sales Invoice** — customer, item lines, taxes, totals, GL preview, submit & payment.
- **Purchase Invoice** — supplier, item lines, taxes, totals, GL preview.
- **Payment** — receive/pay, allocate against outstanding invoices, advance handling.

### 4.6 Banking
Bank accounts, bank transactions import (mock CSV/JSON), **reconciliation** matching statement lines to vouchers.

### 4.7 Taxes
Tax records and tax templates; inclusive/exclusive; tax accounts; tax summary report (output vs input tax).

### 4.8 Reports
| Report | Purpose |
|---|---|
| **Trial Balance** | All accounts with opening, debit, credit, closing — must balance |
| **General Ledger** | Voucher-level entries per account with running balance |
| **Profit & Loss** | Income − Expense over a period |
| **Balance Sheet** | Assets = Liabilities + Equity at a date |
| **Cash Flow** | Operating/Investing/Financing movements |
| **Accounts Receivable / Payable Ageing** | 0–30 / 31–60 / 61–90 / 90+ buckets |
| **Sales / Purchase Register** | Document-level listing with tax |
| **Tax Summary** | Output vs input tax for filing |

### 4.9 Settings
Company profile, fiscal year, base currency & exchange rates, numbering series, account defaults, tax defaults, period closing/lock dates, users & roles (mock).

---

## 5. Cross-cutting Requirements

- **UI/UX:** Sneat-style admin layout — fixed collapsible sidebar, sticky topbar, card-based content. **Off-white** surfaces (`#FAF8F2` / `#FFFFFF` cards) with **golden** accent (`#C9A227` / `#B8860B`) for primary actions, highlights, active nav. Subtle, professional, finance-grade.
- **Responsive:** Fluid down to mobile; sidebar collapses to off-canvas on small screens; tables become horizontally scrollable / stacked.
- **Animations:** Page/section fade-ins (AOS), animated KPI counters, smooth sidebar transitions, hover lifts on cards, chart draw animation — tasteful, not distracting.
- **Interactivity:** jQuery + AJAX to load data from JSON fixtures, render tables/charts, live form calculations (totals, tax, balance checks), client-side validation.
- **Consistency:** Shared partials (sidebar, topbar) loaded via AJAX so every page is identical; one theme stylesheet; reusable JS helpers (currency format, toast, modal, table render).
- **Accessibility:** Semantic markup, keyboard-navigable, sufficient contrast for the golden-on-offwhite palette.

---

## 6. Phased Delivery Plan

> Each phase is independently runnable in the browser via XAMPP (`http://localhost/meet/accounting-software/prototype/`).

### Phase 1 — Foundation & Shell ✅ (this delivery)
- Project structure, theme stylesheet (off-white + golden), shared sidebar/topbar partials (AJAX-loaded).
- Responsive Sneat-style layout with animations.
- **Dashboard** with KPI cards (animated counters), income/expense chart, ageing donut, cash-flow trend, recent transactions, quick actions — all data via AJAX JSON.

### Phase 2 — Master Data
- Chart of Accounts (tree + CRUD modals), Customers, Suppliers, Items, Taxes & Tax Templates. List/search/filter, create/edit forms, JSON-driven.

### Phase 3 — Transactions
- Journal Entry (balanced grid + live balance), Sales Invoice, Purchase Invoice, Payments with allocation, GL preview panel.

### Phase 4 — Reports
- Trial Balance, General Ledger drill-down, Profit & Loss, Balance Sheet, Cash Flow, AR/AP Ageing, Tax Summary. Filters (period, account), export-to-print.

### Phase 5 — Banking & Reconciliation
- Bank accounts, statement import (mock), reconciliation matcher.

### Phase 6 — Settings & Polish
- Company, fiscal year, currencies & rates, numbering series, period close, roles. Final responsive/animation QA.

---

## 7. Directory Structure (prototype)

```
prototype/
├── REQUIREMENTS.md          ← this file
├── index.html               ← Dashboard
├── pages/                    ← feature pages (phase 2+)
├── partials/
│   ├── sidebar.html
│   └── topbar.html
├── assets/
│   ├── css/theme.css        ← off-white + golden Sneat-style theme
│   ├── js/app.js            ← shell loader, helpers, AJAX utilities
│   └── img/
└── data/                     ← JSON fixtures (AJAX sources)
    ├── dashboard.json
    ├── accounts.json
    ├── parties.json
    └── ...
```

## 8. Acceptance Criteria (per phase)
- Renders correctly on desktop, tablet, mobile.
- All data flows through AJAX from `data/*.json` (no hard-coded tables in markup).
- Trial Balance and Balance Sheet balance to zero difference (Phase 4).
- Documents cannot submit unless debit = credit (Phase 3).
- Consistent theme and navigation across every page.
