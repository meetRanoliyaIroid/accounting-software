# FAS → Prototype Gap Analysis & Implementation Plan

**Document purpose:** Catalog every page, section, module and feature that exists in the client's live ERP (**FAS / ERPGSSTFAS** — the Regan Fashion .NET system) but is **not yet present** in our prototype (**"GoldBooks"** Laravel accounting app), with descriptions, the supporting evidence from FAS, why each gap matters, and a phased plan to implement them.

- **Prototype reviewed:** `c:\xampp\htdocs\meet\accounting-software` (Laravel + static HTML prototype in `/prototype`)
- **Client system reviewed:** `d:\Meet\Regan Fashion\FAS` (compiled .NET EXE `ERPGSSTFAS.exe`, SQL Server scripts, 1,190 Crystal Reports, XML/HTML report templates)
- **Date:** 2026-06-24
- **Method:** The FAS executable is compiled (no source), so its feature surface was reverse-engineered from its **SQL Server schema** (~230 tables in `SCRIPTS\TAB`, plus views & stored procedures), its **1,190 `.rpt` Crystal Reports** (each report name reveals a feature), and report/config templates. The prototype was reviewed page-by-page from `/prototype/pages` and its JSON data model.

---

## 1. Executive Summary

| | **Prototype (GoldBooks)** | **FAS (live client ERP)** |
|---|---|---|
| Type | General-purpose double-entry **accounting** app | Full **manufacturing + trading ERP** for textile/yarn |
| Pages / screens | 16 pages + dashboard | Hundreds of forms/screens |
| Database tables | ~12 (demo JSON) | ~230 SQL Server tables + views + procedures |
| Reports | 4 statements (TB, P&L, BS, Ageing) | **1,190** Crystal Reports |
| Company structure | Single company | **Multi-company, multi-unit, multi-division, multi-department** |
| Tax | GST tax rates at master level (demo) | GST + legacy Excise/CENVAT + VAT + TDS/TCS + C-Form, full statutory filing |
| Workflow | None | Multi-level approval (VP / Finance / AP) on orders, POs, bills |

**Bottom line:** The prototype today covers the *financial-accounting core* of what FAS does (chart of accounts, journals, ledger, AR/AP, invoices, payments, tax masters, financial statements). FAS additionally contains entire **operational ERP domains** the prototype has nothing for: **sales-order-to-dispatch cycle, purchase-order-to-GRN procurement cycle, inventory & stock ledger, manufacturing/jobwork/BOM/costing, statutory compliance (GST/Excise/TDS), commission/brokerage, multi-company architecture, approval workflows, a configurable reporting engine, and granular user-rights**.

This document lists those gaps so they can be planned and built into the prototype design.

---

## 2. What the Prototype Already Has (baseline)

These exist and are **in scope already** — listed so we don't re-build them, and to mark where FAS adds depth.

| # | Page | Sections / Features present | FAS adds (depth gap) |
|---|------|------------------------------|----------------------|
| 1 | Dashboard | KPI cards, summary | Role/unit-specific dashboards, daily statistics |
| 2 | Chart of Accounts | Account tree, code, parent, root type, account type, opening balance | Multi-level groups, sub-ledger dimensions (broker/area/group/cost-centre), statutory master fields |
| 3 | Journal Entry | Voucher, multi-line Dr/Cr, party, reference, status | Voucher **types** (JV/Payment/Receipt/Contra/DN/CN), narration master, auto-numbering per type |
| 4 | General Ledger | Date, voucher, Dr/Cr, running balance | Date-range, division/cost-centre filters, drill-down |
| 5 | Customers | Name, GSTIN, email, phone, city, terms, receivable a/c, credit limit, opening balance, statement | Full party master (statutory PAN/LST/CST, broker/agent/area/group links, multiple addresses, transport) |
| 6 | Sales Invoices | Header, line items, tax, GL posting preview, print/PDF/share, cancel, record-payment | Linked to **sales order → delivery order/dispatch**, lot/grade, excise/GST split, billing terms |
| 7 | Suppliers | Name, GSTIN, terms, payable a/c, opening balance, statement | Same as Customers depth gap |
| 8 | Purchase Invoices | Header, lines, tax, GL preview | Linked to **PO → GRN → bill passing**, retention, advance adjustment |
| 9 | Payments | Receipt/payment, mode, party, **allocate against outstanding invoices** | Cheque printing, payment advice, bank position, TDS deduction, on-account/advance |
| 10 | Bank Reconciliation | Statement import, match | Multi-bank, cheque register, bank position report |
| 11 | Items | Code, group, UoM, sales/purchase rate, tax, income/expense a/c, opening stock | Full item master (grade/sub-grade, colour, denier/lot, bins/godown, multi-UoM, HSN) |
| 12 | Taxes | Tax rates, templates, scope, computation, posting account | GST slabs + Excise heads + VAT + TDS/TCS, tax-group master |
| 13 | Trial Balance | Statement | Division/cost-centre/unit-wise, detail vs summary formats |
| 14 | Profit & Loss | Statement | Schedule-wise, division-group, cost-centre P&L |
| 15 | Balance Sheet | Statement | Schedule-VI format, division-group consolidated |
| 16 | Ageing | Receivable/payable ageing | Party/agent/broker/area-group ageing, bill-wise, many variants |
| 17 | Settings | Company profile, fiscal years, currencies, document numbering series, period closing, users & roles | Multi-company/unit config, granular per-form user-rights, audit trail, report designer |

---

## 3. FAS System Architecture Characteristics (cross-cutting)

These are **structural** properties baked into the FAS schema that the prototype must account for before/while building modules. They affect almost every table.

### 3.1 Multi-Company / Multi-Unit / Multi-Division / Multi-Department
Nearly every FAS table begins with `COMP` (company, 4 char), `UNIT` (6), `DVCD` (division), `DPCD` (department), `DBCD` (sub-book/branch). FAS is a **multi-entity consolidated** system — one install runs many companies and units, and reports can be filtered or consolidated across them.
- **Prototype today:** single company (Settings → Company Profile).
- **Gap:** company/unit/division/department dimensions on every transaction; entity switcher; consolidated vs entity reporting.
- **Why it matters:** the client genuinely operates multiple units/divisions; without this the data model can't hold their books.

### 3.2 Approval Workflows
Order and PO tables carry approval columns: `VP_APRV / VP_USER / VP_APRVDT` (VP approval), `FIN_APRV / FIN_USER` (Finance approval), `POSTAT / APBY / APDATE` (PO line approval), `DOSTAT / DOAPRVBY` (dispatch approval).
- **Gap:** multi-stage document approval (draft → approved by role → posted), with approver, remark, timestamp captured.
- **Why it matters:** controls who can release orders/POs/dispatches; core internal control.

### 3.3 Statutory / Indian Compliance Layer
Schema and reports carry **GST** (`GSTR2`, GST invoice formats, `TAXGRPMST`), **legacy Excise/CENVAT** (`ER1`, `RG23D`, `EXCISEOPENING`, CENVAT/NCCD/Edu-Cess/Hr-Edu-Cess columns on PO & bills), **VAT** (`VATDATA`), **TDS/TCS** (`TDSTRN`, TDS/TCS reports), and **C-Form** tracking.
- **Gap:** statutory tax computation engine, return-ready reports, form tracking.

### 3.4 Configurable Reporting Engine
`REPCNF`, `REPFLD`, `RPTEXPCNFG`, `OSREPCNF` tables + 1,190 `.rpt` files = a **report designer / configurator** where fields, columns and export configs are data-driven, plus per-client report variants (suffixes `_RGN`, `_CIL`, `_MOHIT`, `_SCM`, etc.).
- **Gap:** a reporting framework (parameterized, exportable to PDF/Excel, saved layouts) rather than 4 hard-coded statements.

### 3.5 Granular User Rights & Audit
`USER_MST`, `USERRIGHTS`, `USRCFG`, `OBJMST` (object/form master), `AUDITTRIL`, `ERRORLOG`/`ERRLOG`.
- **Gap:** per-form / per-action permissions (not just roles), audit trail of every change, error logging.

---

## 4. Gap Catalog — Modules Missing From the Prototype

Each module below is **absent from the prototype** and present in FAS. Format: *what it is · FAS evidence · key sub-features/screens · implementation notes*.

---

### MODULE A — Sales Order & Order-to-Dispatch Cycle  🔴 High
FAS sells through a full cycle, not just a standalone invoice: **Enquiry → Quotation → Sales Order → Delivery Order (DO)/Dispatch → Sales Invoice (Bill)**, with order-vs-dispatch tracking and pending-order monitoring.

- **FAS evidence:** `ORDMAN`/`ORDTRN`/`ORDBOK` (sales orders), `QUOTATION`, `ENQ_MST` (enquiry), `DOTRAN`/`DOFFTRAN` (delivery/dispatch), `ORDER_HISTORY`/`ORDLEDGER` views, `TRAORDSAL` (trading sale orders). Reports: 66 order reports incl. *Sales Order Register (date/party/item/agent wise)*, *Order Vs Dispatch*, *Order Pending*, *Cancelled Sale Order*, *Pending DO*.
- **Sub-features to build:**
  - Quotation entry & print; convert quotation → order.
  - Sales Order with credit-limit check, delivery date, agent/broker, item lines with rate/grade/lot.
  - Delivery Order / Dispatch (challan) generation against order; partial dispatch; dispatch qty vs order qty.
  - Order register, order-vs-dispatch, pending-order, order ledger reports.
  - Order approval (VP/Finance) per §3.2.
- **Why it matters:** Sales invoice in the prototype is currently a leaf with no upstream order/dispatch — the client's whole sales operation runs on the order pipeline.

---

### MODULE B — Procurement: Purchase Order → GRN → Bill Passing  🔴 High
The purchase counterpart cycle: **Indent/Requisition → Purchase Order → Goods Receipt Note (GRN) → Bill Passing → Purchase Invoice**, with PO amendment, advance, retention, and approvals.

- **FAS evidence:** `IDT_MST`/`IDT_TRN`/`REQ_MST`/`REQ_TRN`/`INDENTSRNO` (indent/requisition), `PO_MST`/`PO_TRN`/`POREG`/`PURMAN`/`PURTRAN` (purchase orders), `POAMENDMENT` (PO amendment), `GRN`/`GRNDET`/`GRNTRAN`/`GRREGISTER`/`GRCONFIRMATION` (goods receipt), `PRC_SAVEINDENT_*` procedures. Reports: *PO Register*, *Approved/Pending GRN Register*, *Indent Pending*, *Bill Pass Report*, *PO Amendment*.
- **PO header carries:** quotation link, advance, CENVAT/NCCD/Edu-Cess, freight, P&F, per-line approval status — i.e. real procurement, not a flat bill.
- **Sub-features to build:**
  - Purchase Indent/Requisition with approval and pending tracking.
  - Purchase Order (multi-line, taxes, freight, advance, delivery schedule, amendment history).
  - GRN against PO (receive partial, quality status, retention, advance adjustment, gate-pass link).
  - Bill passing / 3-way match (PO ↔ GRN ↔ invoice) before payable is booked.
  - Registers: PO pending, GRN pending/approved, indent pending.
- **Why it matters:** Purchase invoice in the prototype has no PO/GRN behind it; procurement controls (approval, 3-way match, retention) are entirely absent.

---

### MODULE C — Inventory & Stock Ledger  🔴 High
A real perpetual-inventory subsystem with stock movement ledger, locations/bins, grades, lots, and valuation — far beyond the prototype's single "Opening Stock Qty" field on an item.

- **FAS evidence:** `STOCK_MST`/`STOCKTRAN`/`STORETRAN`/`STORE_MST`/`STOREMAN` (stock), `ITEMLEDGER` (item movement ledger: qty in/out per voucher), `BIN_MST` (bins), `LOC_MST`/`LOCATION`/`LOCMST` (locations/godowns), `GRDMST`/`SUBGRDMST`/`MAINGRD` (grade/sub-grade), `COLORMST`, `DOWNGRAD` (downgrade), `lottrn`/lot tracking, `TAKREG` (stock take/physical), `STK_MSRMNT`. Views: `VW_ITEM_STOCK`, `ONLINEBAL`, `VW_LNG_STK`. Reports: 75 stock reports incl. *Item Ledger*, *Item Stock*, *Stock Balance Qty*, *Age Analysis of Finish Stock*, *Daily Issue*, *Consumption*, *Department & Item-group Stock Summary*.
- **Sub-features to build:**
  - Item ledger / stock card (every in/out movement, running balance per item per location).
  - Multi-location / godown / bin stock.
  - Grade / sub-grade / colour / denier / **lot** attributes on stock.
  - Stock valuation (FIFO/weighted-avg) and stock-vs-GL reconciliation (`STOCKJVCONFIG`).
  - Physical stock take & adjustment; downgrade entries.
  - Material issue / receipt vouchers (`MREC_MST`, `MRTRN_MST`, `ISS_MST`).
  - Reorder / stock ageing reports.
- **Why it matters:** the prototype can't tell current stock, movement history, or stock value — essential for a manufacturing/trading client.

---

### MODULE D — Manufacturing: Jobwork, Work Orders, BOM, Production, Costing  🔴 High
FAS supports in-house and outsourced (jobwork) manufacturing with bills of material, formulas, work orders, production capture, machine/process masters and cost sheets.

- **FAS evidence:**
  - Jobwork: `JOBCARD`, `JOBMST`/`JOBTRN`/`JOBTRAN`, `JOBIN`/`JOBOUT`/`JOBGRN`, `JOBTYPMST`, `JOBTRACK` view, `VW_JOB_VALUATION`.
  - Work orders: `WOMST`/`WOTRN`/`WOINDT`, `VW_WOSTATUS`/`VW_WORECFINISH`/`VW_WOINNER`.
  - BOM / formula: `BOMMST`/`BOMTRN`, `FORMULAMST`/`FORMULATRN`.
  - Production: `PRODTRAN`, `DAILYSTAT`/`FASDAILYSTAT` (daily production stat), `VW_DAILYPROD`, `PROCESSMST` (process), `MACMST`/`MACASBL` (machine/assembly), `POWERMAST`/`POWERTRN`/`GASRDNG` (power/gas consumption).
  - Costing: `COSTCENTRE`/`COSTCENTRES`/`CCMST`, `COSTINGHEADS`, `costsheet_temp`, `FIXCOST`/`FIXDTL`.
  - Reports: *Daily Production Register*, *Consumption*, *Cost-head & Department Inward/Consumption Summary*, *Cost-centre Monthly Summary*, *Job Valuation*, *Work Order Status*.
- **Sub-features to build:**
  - BOM / formula master (finished item → raw components & qty).
  - Work order issue → production receipt; WO status & pending.
  - Jobwork: issue to job worker (JOBOUT), receive finished/semi (JOBIN/JOBGRN), job charges, job valuation, jobwork GRN.
  - Production entry & daily production register; consumption against production.
  - Cost centre & costing-head cost sheets; machine/process/power-consumption capture.
- **Why it matters:** this is the operational heart of a textile manufacturer and is **100% absent** from the prototype.

---

### MODULE E — Statutory & Tax Compliance (GST / Excise / VAT / TDS / TCS / C-Form)  🔴 High
Beyond charging a tax rate, FAS produces **filing-ready statutory output** and tracks statutory forms.

- **FAS evidence:** GST — `GSTR2`, `TAXGRPMST`, `REPORTS\GSTREPORT`, `GSTINVOICE_TRADING`, `GSTRPT`, `GSTR2` templates. Excise — `ER1`/`ER1DATA`, `RG23D`, `EXCISEOPENING`, `VATDATA`, `ANX5`/`AnnexureII`/`AnnextureforSADrefund`. TDS/TCS — `TDSTRN`, *Commission on Sale with TDS Statement/Summary*, *DBNOTETCS*/*CRNOTETCS*. C-Form — *C-Form Payable Letter*, *C-Form Pending Reminder*. 132 of 1,190 reports are statutory/tax.
- **Sub-features to build:**
  - GST: GSTIN-validated invoices, HSN-wise output, GSTR-1/2/3B-style summaries, RCM.
  - TDS/TCS deduction on payments/sales with statements and challan tracking.
  - C-Form issue/receivable tracking & reminders.
  - (If still relevant to client) excise registers ER-1/RG23D; otherwise mark legacy.
  - Tax-group master (a "tax template" that bundles CGST+SGST/IGST etc.) — partially present in prototype Taxes, needs the statutory output side.
- **Why it matters:** compliance is non-negotiable for the client; the prototype's tax module computes amounts but produces no statutory return/forms.

---

### MODULE F — Commission / Brokerage / Agent Management  🟠 Medium-High
A large part of the business runs through agents/brokers earning commission, with TDS on commission.

- **FAS evidence:** `SALMANMST`/`SALESPERSONMASTER`, agent/broker codes (`BRCD`/`ARCD`) on parties & orders, `AGCMST`/`AGCITMMST` (agency), `SEGMENTMASTER`. 54 commission/agent/broker reports incl. *Commission on Sale Statement*, *Commission with TDS (agent-wise/summary)*, *Agent-wise Sale Register*, *Agent+Party+Item Sale Summary*, *Broker-wise Age Analysis*.
- **Sub-features to build:**
  - Agent/broker/salesperson master; assign to party & order.
  - Commission scheme (rate per agent/item/party); auto-accrual on sale.
  - Commission statement, payable, with TDS deduction.
  - Agent/broker-wise sales, outstanding and ageing analytics.
- **Why it matters:** revenue-sharing and broker outstanding are major business processes with zero prototype coverage.

---

### MODULE G — Dispatch / Logistics: Challan, Transport, Packing, Gate Pass  🟠 Medium
Physical goods movement: delivery challans, transporter/LR, packing (cops/pallet/box for yarn), gate passes and vehicle entry.

- **FAS evidence:** `GATEPASS`/`GPMST`/`GETRN`, `TRANSPORTMST`, packing — `PCKMST`/`PKGMAN`/`PKGNGMST`/`SUBPKGNGMST`/`GRPACKING`/`BOXREGISTER`/`TRDBOXREGISTER`/`COPSMASTER`/`COPSREGISTER`/`COPSSTICKER`/`PADDMST`, `VHCLENTRY`/`VHCLMST` (vehicle), `VW_PALLET_PACKING_SLIP`. 47 dispatch/challan/transport + 39 packing reports incl. *Box-wise Dispatch Register*, *Returnable Cops/Pallet Summary*, *Consignee-wise Daily Lifting*, *Transporter-wise Shipment Summary*.
- **Sub-features to build:**
  - Delivery challan with transporter, LR no., vehicle, freight.
  - Packing slip / box / pallet / cops register (returnable packing tracking).
  - Gate pass (returnable/non-returnable) & vehicle entry log.
  - Consignee/transporter-wise dispatch and lifting reports.
- **Why it matters:** dispatch documentation and returnable-packing tracking are daily operational needs.

---

### MODULE H — Loans, Interest & Budgeting  🟢 Lower
- **FAS evidence:** `LOANMST`/`LOANTRN`, `BUDGET`, reports *Bank and Unsecured Loan Interest*, budget tracking.
- **Sub-features:** loan master & repayment schedule, interest accrual, budget vs actual by cost-centre/account.
- **Why it matters:** finance-team conveniences; lower priority than operational cycles.

---

### MODULE I — CRM-lite: Complaints / Service / Visitor  🟢 Lower
- **FAS evidence:** `COMPLAINMASTER`/`COMPLAINREGISTER`/`COMPLAINATTENDED`, `SERVICEMAST`, `VISITOR`, `DIARY_MST`, `ENQ_MST`.
- **Sub-features:** complaint logging & resolution, service master, visitor register, enquiry/diary follow-up.
- **Why it matters:** peripheral to accounting; include only if client uses it.

---

### MODULE J — Master Data Expansion  🟠 Medium (enabler for everything above)
The prototype has Customers, Suppliers, Items, Taxes, Chart of Accounts. FAS has a far larger master set that the modules above depend on:

| Master | FAS table | Needed by |
|--------|-----------|-----------|
| City / State / Country | `CITYMASTER`/`STATEMASTER`/`COUNTRY` | parties, GST place-of-supply |
| Agent / Broker / Salesperson | `SALMANMST`/`SALESPERSONMASTER` | sales, commission |
| Transporter | `TRANSPORTMST` | dispatch |
| Grade / Sub-grade / Colour | `GRDMST`/`SUBGRDMST`/`COLORMST` | items, stock |
| Unit / UoM config | `UNTMST`/`UNITCFG`/`UNTCFG` | items, multi-UoM |
| Cost centre / Division / Department | `COSTCENTRE`/`DIVMST`/`DEPT_MST` | costing, reporting dimensions |
| Narration master | `NARRMAST` | vouchers |
| Bank master | `BANKMST` | payments, cheque |
| Process / Machine | `PROCESSMST`/`MACMST` | production |
| Tax group | `TAXGRPMST` | statutory tax |
| Rate masters (sale/purchase) | `SALRAT`/`PURRAT`/`RATEMASTER`/`SALRATEMASTER` | price lists |
| HSN / Charges / Terms | `CHRGMST`/`BILLTERMS`/`BILLINGMASTER` | invoicing |

- **Why it matters:** these masters are the dimensions every operational document and report slices by; they must exist before Modules A–G can be meaningful.

---

### MODULE K — Configurable Reporting Engine  🟠 Medium
The prototype has 4 fixed statements; FAS has a **data-driven report framework** + 1,190 report variants.

- **FAS evidence:** `REPCNF`/`REPFLD`/`RPTEXPCNFG`/`OSREPCNF` (report/field/export config), `RPTRAN`/`RPTTRAN` (report transactions), per-client `.rpt` variants, XML report definitions.
- **Sub-features to build:**
  - Parameterized report runner (date range, company/unit/division, party/agent filters).
  - Export to PDF & Excel; saved/named layouts.
  - Report categories matching FAS: **Accounts** (ledger, TB, P&L, BS, cash/bank, daybook), **Outstanding/Ageing** (94 reports), **Sales** (173), **Purchase** (110), **Stock** (75), **Statutory** (132), **Commission** (54), **Dispatch** (47), **Order** (66), **Production** (11).
- **Why it matters:** the client lives in reports; a fixed-statement approach won't replace 1,190 report needs.

---

### MODULE L — System Administration: User Rights, Audit, Multi-Entity Config  🟠 Medium
- **FAS evidence:** `USER_MST`/`USERRIGHTS`/`USRCFG`/`UserMast`, `OBJMST` (form/object registry for permissions), `AUDITTRIL`, `ERRORLOG`/`ERRLOG`, `CMPCFG`/`CONFIG_MST`/`CONFIG` (company config), `INDENTSRNO`/document numbering.
- **Sub-features to build (beyond prototype's basic Users & Roles):**
  - Per-form / per-action permissions (view/add/edit/delete/approve/print) — not just a role label.
  - Audit trail (who changed what, when, old→new value).
  - Multi-company/unit/division/department setup & user-to-entity mapping.
  - Error/exception logging.
- **Why it matters:** internal control and traceability for a multi-user, multi-entity finance system.

---

## 5. Module-by-Module Coverage Matrix

| Domain | Prototype | FAS | Gap severity |
|--------|:---:|:---:|:---:|
| Chart of Accounts / Journal / GL | ✅ | ✅ | depth only |
| AR / AP / Ageing | ✅ basic | ✅ extensive (agent/broker/area/group) | medium |
| Sales **Invoice** | ✅ | ✅ | depth |
| Sales **Order → Dispatch** cycle | ❌ | ✅ | **high (A)** |
| Quotation / Enquiry | ❌ | ✅ | medium |
| Purchase **Invoice** | ✅ | ✅ | depth |
| **PO → GRN → Bill passing** | ❌ | ✅ | **high (B)** |
| Indent / Requisition | ❌ | ✅ | medium |
| **Inventory / Stock ledger** | ❌ (qty field only) | ✅ | **high (C)** |
| **Manufacturing / Jobwork / BOM / Costing** | ❌ | ✅ | **high (D)** |
| **GST / Excise / VAT / TDS / C-Form** | ⚠️ rates only | ✅ filing-ready | **high (E)** |
| Commission / Agent / Broker | ❌ | ✅ | medium-high (F) |
| Dispatch / Transport / Packing / Gate pass | ❌ | ✅ | medium (G) |
| Loans / Interest / Budget | ❌ | ✅ | low (H) |
| Complaints / Service / Visitor | ❌ | ✅ | low (I) |
| Master data (city/grade/agent/transporter/cost-centre…) | ⚠️ partial | ✅ | medium (J) |
| Reporting engine (parameterized, export) | ❌ (4 fixed) | ✅ 1,190 | medium (K) |
| Multi-company / unit / division | ❌ | ✅ | **high (§3.1)** |
| Approval workflows | ❌ | ✅ | **high (§3.2)** |
| User rights (per-form) / Audit trail | ⚠️ roles only | ✅ | medium (L) |
| Payments / Bank recon | ✅ | ✅ + cheque print, advice, TDS | medium |

Legend: ✅ present · ⚠️ partial · ❌ absent

---

## 6. Recommended Implementation Roadmap

Build operational cycles in dependency order. Masters and cross-cutting architecture first, because every later module depends on them.

### Phase 0 — Foundations (architecture, do first)
1. **Multi-company / unit / division / department** dimensions in the data model + entity switcher (§3.1).
2. **Master-data expansion** (Module J): city/state/country, agent/broker, transporter, grade/colour, UoM, cost-centre, bank, narration, tax-group.
3. **Approval-workflow framework** (§3.2) — reusable draft→approve→post engine with approver/remark/timestamp.
4. **Per-form user rights + audit trail** (Module L).

### Phase 1 — Inventory core (unlocks sales/purchase/manufacturing)
5. **Inventory & Stock Ledger** (Module C): item ledger, locations/bins, grade/lot, valuation, material issue/receipt, stock take.

### Phase 2 — Operational cycles
6. **Procurement: PO → GRN → Bill passing** (Module B) incl. indent.
7. **Sales: Quotation → Order → Dispatch/Challan → Invoice** (Module A) incl. Dispatch/Packing/Gate-pass (Module G).

### Phase 3 — Manufacturing
8. **BOM / Work Order / Jobwork / Production / Costing** (Module D).

### Phase 4 — Compliance & commercial
9. **Statutory: GST/TDS/TCS/C-Form** (Module E) — filing-ready outputs.
10. **Commission / Agent / Broker** (Module F).

### Phase 5 — Reporting & finance extras
11. **Configurable reporting engine** (Module K) with export, replacing fixed statements; build out the report catalog by category.
12. **Loans / Interest / Budget** (Module H); **cheque printing, payment advice, bank position** (Payments depth).
13. **Complaints / Service / Visitor** (Module I) — only if client uses.

> **Suggested first deliverable:** Phase 0 + Phase 1 (Inventory) + Module B (Procurement) — this converts the prototype from "accounting demo" to "operational ERP base" and is the minimum to be useful to a manufacturing/trading client.

---

## 7. Appendix

### 7.1 FAS report inventory by category (1,190 reports in `\REPORTS`)
| Category (keyword match) | Approx. count |
|---|---:|
| Sales (register/summary/order) | ~173 |
| Statutory — GST/Excise/VAT/TDS/TCS/C-Form | ~132 |
| Purchase | ~110 |
| Outstanding / Ageing / Receivable / Payable | ~94 |
| Stock / Inventory | ~75 |
| Order (sales & purchase) | ~66 |
| GRN / Gate / Inward | ~56 |
| Commission / Agent / Broker | ~54 |
| Dispatch / Challan / Transport | ~47 |
| Packing / Cops / Pallet / Box | ~39 |
| Bank / Cash / Cheque | ~36 |
| Ledger | ~35 |
| Jobwork | ~25 |
| Trial Balance / P&L / Balance Sheet | ~20 |
| Production / Consumption / BOM / Formula | ~11 |
| Complaint / Service / Warranty | ~11 |
| Indent / Requisition | ~7 |
| Loan / Interest / Budget | ~7 |

*(Counts are keyword overlaps and indicative of module weight, not exact unique totals. Note FAS keeps many per-client variants of the same report — e.g. `_RGN`, `_CIL`, `_MOHIT` suffixes — confirming the need for a configurable report engine rather than one report per variant.)*

### 7.2 Source artifacts examined
- **Schema:** ~230 `CREATE TABLE` scripts in `SCRIPTS\TAB`, plus `SCRIPTS\VIW` (28 views), `SCRIPTS\PRC` (procedures), `SCRIPTS\DTA` (default data).
- **Reports:** `REPORTS\` and `REPRGN\` (1,190 `.rpt`/`.prt` Crystal Reports; sub-folders `GSTREPORT`, `GSTR2`, `GSTRPT`, `GSTINVOICE_TRADING`, `INVOICEFORMAT`, `CHQFORMAT`, `LKNREP`, etc.).
- **Config:** `xml\Account_wise_Ledger_Report.xml`, `html\` report templates, `Server.Dat`, `console\` (PDF merge / itextsharp utilities for report output & digital signing via `PFXFILE`/`DOCSIGN`).
- **Prototype:** `/prototype/pages` (16 pages), `/prototype/partials` (sidebar, topbar), `/prototype/data` (13 JSON models).

### 7.3 Notes & assumptions
- FAS still carries **legacy Excise/CENVAT/VAT** structures (pre-GST era). Confirm with client which statutory modules are still live before building; GST + TDS/TCS are certainly current, excise may be historical-only.
- The prototype is a **front-end/JSON demo**; none of the gaps require throwing it away — they extend its module set and back it with the Laravel data layer.
- This analysis is **feature/module level**. A follow-up field-level spec per module (exact columns, statuses, GL postings, report parameters) should be written from the corresponding FAS `.TAB` schema when each module is scheduled for build.
