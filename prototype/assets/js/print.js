/* =====================================================================
   GoldBooks — Print / Download / Share Document Generator
   Builds branded documents (GST Tax Invoice, Purchase Bill, Journal
   Voucher, Payment Receipt, Reports) and renders them as a print
   preview, a downloadable PDF, or a short shareable summary.
   ===================================================================== */

(function (window) {
  'use strict';

  var COMPANY = {
    name: 'GoldBooks Demo Pvt Ltd',
    address: '402, Pinnacle Tower, Andheri East, Mumbai, Maharashtra 400069',
    gstin: '27AABCG1234D1ZP', pan: 'AABCG1234D',
    email: 'accounts@goldbooks.demo', phone: '+91 22 4000 1234', state: 'Maharashtra (27)',
    bank: { name: 'HDFC Bank — Andheri Branch', ac: '50200012345678', ifsc: 'HDFC0000123' }
  };

  function money(n) { n = Number(n) || 0; return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function num(n) { return (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function dt(d) { try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (e) { return d; } }
  function rateOf(t) { return t ? (parseFloat(String(t).replace(/[^\d.]/g, '')) || 0) : 0; }

  function inWords(amount) {
    amount = Math.round(Number(amount) || 0);
    if (amount === 0) return 'Zero Rupees Only';
    var ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    var tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function two(n) { return n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''); }
    function three(n) { return n >= 100 ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : '') : two(n); }
    var out = '', cr = Math.floor(amount / 10000000); amount %= 10000000;
    var l = Math.floor(amount / 100000); amount %= 100000;
    var th = Math.floor(amount / 1000); amount %= 1000;
    if (cr) out += three(cr) + ' Crore ';
    if (l) out += two(l) + ' Lakh ';
    if (th) out += two(th) + ' Thousand ';
    if (amount) out += three(amount);
    return out.trim() + ' Rupees Only';
  }

  function letterhead() {
    return '<div class="lh"><div class="lh-left"><div class="lh-logo">G</div><div>' +
      '<div class="lh-name">' + COMPANY.name + '</div>' +
      '<div class="lh-meta">' + COMPANY.address + '</div>' +
      '<div class="lh-meta">GSTIN: <b>' + COMPANY.gstin + '</b> &nbsp;|&nbsp; PAN: ' + COMPANY.pan + '</div>' +
      '<div class="lh-meta">' + COMPANY.email + ' &nbsp;|&nbsp; ' + COMPANY.phone + '</div></div></div></div>';
  }

  // ===== BUILDERS — return { title, filename, body, summary } =====
  function buildInvoice(inv, isPurchase) {
    var partyLabel = isPurchase ? 'Supplier (Bill From)' : 'Bill To';
    var title = isPurchase ? 'PURCHASE INVOICE' : 'TAX INVOICE';
    var lines = inv.lines || [], hsnSeed = 6109;
    var taxable = inv.net_total, cgstT = inv.tax_total / 2, sgstT = inv.tax_total / 2, grand = inv.grand_total;
    var sumAmt = lines.reduce(function (s, l) { return s + (l.amount != null ? l.amount : l.qty * l.rate); }, 0) || 1;
    var rows = lines.map(function (l, i) {
      var amt = l.amount != null ? l.amount : l.qty * l.rate, share = amt / sumAmt;
      var lt = inv.net_total * share, tx = inv.tax_total * share, r = rateOf(l.tax);
      return '<tr><td class="c">' + (i + 1) + '</td><td>' + (l.item || '') + '</td><td class="c">' + (hsnSeed + i) + '</td>' +
        '<td class="r">' + (l.qty != null ? l.qty : '') + '</td><td class="r">' + num(l.rate || 0) + '</td><td class="r">' + num(lt) + '</td>' +
        '<td class="c">' + (r / 2) + '%</td><td class="r">' + num(tx / 2) + '</td><td class="c">' + (r / 2) + '%</td><td class="r">' + num(tx / 2) + '</td>' +
        '<td class="r b">' + num(lt + tx) + '</td></tr>';
    }).join('');
    if (!lines.length) rows = '<tr><td class="c">1</td><td>As per invoice ' + inv.no + '</td><td class="c">—</td><td class="r">—</td><td class="r">—</td><td class="r">' + num(taxable) + '</td><td class="c">—</td><td class="r">' + num(cgstT) + '</td><td class="c">—</td><td class="r">' + num(sgstT) + '</td><td class="r b">' + num(grand) + '</td></tr>';
    var party = inv.customer || inv.supplier;
    var body = letterhead() + '<div class="doc-title">' + title + '</div>' +
      '<div class="meta-grid"><div class="party"><div class="lbl">' + partyLabel + '</div><div class="pname">' + party + '</div><div class="pmeta">Place of Supply: Maharashtra (27)</div></div>' +
      '<div class="inv-meta"><div><span>Invoice No.</span><b>' + inv.no + '</b></div><div><span>Invoice Date</span><b>' + dt(inv.date) + '</b></div><div><span>Due Date</span><b>' + dt(inv.due_date) + '</b></div><div><span>Status</span><b>' + inv.status + '</b></div></div></div>' +
      '<table class="items"><thead><tr><th rowspan="2" class="c">#</th><th rowspan="2">Item / Description</th><th rowspan="2" class="c">HSN/SAC</th><th rowspan="2" class="r">Qty</th><th rowspan="2" class="r">Rate</th><th rowspan="2" class="r">Taxable</th><th colspan="2" class="c">CGST</th><th colspan="2" class="c">SGST</th><th rowspan="2" class="r">Amount</th></tr><tr><th class="c">%</th><th class="r">Amt</th><th class="c">%</th><th class="r">Amt</th></tr></thead>' +
      '<tbody>' + rows + '</tbody><tfoot><tr><td colspan="5" class="r b">Total</td><td class="r b">' + num(taxable) + '</td><td></td><td class="r b">' + num(cgstT) + '</td><td></td><td class="r b">' + num(sgstT) + '</td><td class="r b">' + num(grand) + '</td></tr></tfoot></table>' +
      '<div class="summary-grid"><div class="words"><div class="lbl">Amount in Words</div><div class="w">' + inWords(grand) + '</div><div class="bank"><div class="lbl">Bank Details</div>' + COMPANY.bank.name + '<br>A/c: ' + COMPANY.bank.ac + ' &nbsp; IFSC: ' + COMPANY.bank.ifsc + '</div></div>' +
      '<div class="totals"><div class="tl"><span>Taxable Value</span><b>' + money(taxable) + '</b></div><div class="tl"><span>CGST</span><b>' + money(cgstT) + '</b></div><div class="tl"><span>SGST</span><b>' + money(sgstT) + '</b></div><div class="tl grand"><span>Grand Total</span><b>' + money(grand) + '</b></div><div class="tl"><span>Amount ' + (isPurchase ? 'Payable' : 'Due') + '</span><b>' + money(inv.outstanding) + '</b></div></div></div>' +
      '<div class="foot-grid"><div class="terms"><div class="lbl">Terms &amp; Conditions</div><ol><li>Payment due within terms stated above.</li><li>Goods once sold will not be taken back.</li><li>Subject to Mumbai jurisdiction.</li></ol></div>' +
      '<div class="sign"><div>For <b>' + COMPANY.name + '</b></div><div class="sign-space"></div><div>Authorised Signatory</div></div></div>' +
      '<div class="cgen">This is a computer-generated ' + title.toLowerCase() + ' and does not require a physical signature.</div>';
    var docLabel = isPurchase ? 'Purchase Invoice' : 'Tax Invoice';
    return { title: inv.no + ' · ' + title, filename: inv.no + '.pdf', body: body,
      summary: docLabel + ' ' + inv.no + ' for ' + money(grand) + ' (' + party + '), due ' + dt(inv.due_date) + '. — ' + COMPANY.name };
  }

  function buildJournal(je) {
    var rows = (je.lines || []).map(function (l) { return '<tr><td>' + l.account + '</td><td>' + (l.party || '—') + '</td><td class="r">' + (l.debit ? num(l.debit) : '') + '</td><td class="r">' + (l.credit ? num(l.credit) : '') + '</td></tr>'; }).join('');
    var body = letterhead() + '<div class="doc-title">JOURNAL VOUCHER</div>' +
      '<div class="meta-grid"><div class="party"><div class="lbl">Narration</div><div class="pname" style="font-size:13px">' + je.reference + '</div></div>' +
      '<div class="inv-meta"><div><span>Voucher No.</span><b>' + je.no + '</b></div><div><span>Date</span><b>' + dt(je.date) + '</b></div><div><span>Type</span><b>' + je.type + '</b></div><div><span>Status</span><b>' + je.status + '</b></div></div></div>' +
      '<table class="items"><thead><tr><th>Account</th><th>Party</th><th class="r">Debit</th><th class="r">Credit</th></tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td colspan="2" class="r b">Total</td><td class="r b">' + num(je.total_debit) + '</td><td class="r b">' + num(je.total_credit) + '</td></tr></tfoot></table>' +
      '<div class="summary-grid"><div class="words"><div class="lbl">Amount in Words</div><div class="w">' + inWords(je.total_debit) + '</div></div><div class="totals"><div class="tl grand"><span>Voucher Total</span><b>' + money(je.total_debit) + '</b></div></div></div>' +
      '<div class="foot-grid"><div class="terms"><div class="lbl">Prepared By</div>Accounts Department</div><div class="sign"><div>For <b>' + COMPANY.name + '</b></div><div class="sign-space"></div><div>Authorised Signatory</div></div></div>' +
      '<div class="cgen">Computer-generated accounting voucher.</div>';
    return { title: je.no + ' · Journal Voucher', filename: je.no + '.pdf', body: body,
      summary: 'Journal Voucher ' + je.no + ' for ' + money(je.total_debit) + ' — ' + je.reference };
  }

  function buildPayment(p) {
    var isRecv = p.type === 'Receive';
    var allocs = (p.allocations || []).map(function (a) { return '<tr><td>' + a.invoice + '</td><td class="r">' + num(a.allocated) + '</td></tr>'; }).join('') || '<tr><td colspan="2" class="c">Advance / unallocated payment</td></tr>';
    var body = letterhead() + '<div class="doc-title">' + (isRecv ? 'PAYMENT RECEIPT' : 'PAYMENT VOUCHER') + '</div>' +
      '<div class="meta-grid"><div class="party"><div class="lbl">' + (isRecv ? 'Received From' : 'Paid To') + '</div><div class="pname">' + p.party + '</div><div class="pmeta">Mode: ' + p.mode + ' &nbsp;|&nbsp; ' + p.account + '</div></div>' +
      '<div class="inv-meta"><div><span>Payment No.</span><b>' + p.no + '</b></div><div><span>Date</span><b>' + dt(p.date) + '</b></div><div><span>Type</span><b>' + p.type + '</b></div></div></div>' +
      '<div class="amt-banner"><span>' + (isRecv ? 'Amount Received' : 'Amount Paid') + '</span><b>' + money(p.amount) + '</b></div>' +
      '<table class="items"><thead><tr><th>Allocated Against Invoice</th><th class="r">Amount</th></tr></thead><tbody>' + allocs + '</tbody><tfoot><tr><td class="r b">Unallocated (Advance)</td><td class="r b">' + num(p.unallocated) + '</td></tr></tfoot></table>' +
      '<div class="summary-grid"><div class="words"><div class="lbl">Amount in Words</div><div class="w">' + inWords(p.amount) + '</div></div><div class="totals"><div class="tl grand"><span>Total</span><b>' + money(p.amount) + '</b></div></div></div>' +
      '<div class="foot-grid"><div class="terms"><div class="lbl">Note</div>Acknowledgement of ' + (isRecv ? 'receipt' : 'payment') + ' as above.</div><div class="sign"><div>For <b>' + COMPANY.name + '</b></div><div class="sign-space"></div><div>Authorised Signatory</div></div></div>' +
      '<div class="cgen">Computer-generated payment ' + (isRecv ? 'receipt' : 'voucher') + '.</div>';
    return { title: p.no + ' · Payment', filename: p.no + '.pdf', body: body,
      summary: 'Payment ' + p.no + ' — ' + money(p.amount) + ' ' + (isRecv ? 'received from ' : 'paid to ') + p.party };
  }

  function buildReport(title, subtitle, bodyHtml) {
    var body = letterhead() + '<div class="doc-title">' + title + '</div><div class="rpt-sub">' + (subtitle || '') + '</div><div class="rpt-body">' + bodyHtml + '</div><div class="cgen">Computer-generated report · ' + COMPANY.name + '</div>';
    return { title: title, filename: title.replace(/[^\w]+/g, '_') + '.pdf', body: body, summary: title + ' — ' + COMPANY.name };
  }

  function build(type, data) {
    switch (type) {
      case 'salesInvoice': return buildInvoice(data, false);
      case 'purchaseInvoice': return buildInvoice(data, true);
      case 'journal': return buildJournal(data);
      case 'payment': return buildPayment(data);
    }
    return null;
  }

  // ===== OUTPUTS =====
  function shell(title, body) {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">' +
      '<style>' + CSS + '</style></head><body>' +
      '<div class="toolbar no-print"><div class="tb-title">' + title + '</div><div class="tb-actions">' +
        '<button onclick="window.print()" class="tbtn primary">🖨 Print</button><button onclick="window.close()" class="tbtn">Close</button></div></div>' +
      '<div class="sheet">' + body + '</div></body></html>';
  }

  function preview(d) {
    if (!d) return;
    var w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) { alert('Please allow pop-ups to view the print preview.'); return; }
    w.document.open(); w.document.write(shell(d.title, d.body)); w.document.close(); w.focus();
  }

  function ensureHtml2pdf(cb) {
    if (window.html2pdf) return cb();
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';
    s.onload = cb; s.onerror = function () { if (window.App) App.toast('Could not load PDF engine', 'error'); };
    document.head.appendChild(s);
  }

  function download(d) {
    if (!d) return;
    if (window.App) App.toast('Preparing PDF…');
    ensureHtml2pdf(function () {
      var holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:820px;background:#fff';
      holder.innerHTML = '<style>' + CSS + '</style><div class="sheet" style="box-shadow:none;margin:0">' + d.body + '</div>';
      document.body.appendChild(holder);
      window.html2pdf().set({ margin: 8, filename: d.filename, image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } })
        .from(holder.querySelector('.sheet')).save().then(function () {
          document.body.removeChild(holder);
          if (window.App) App.toast('PDF downloaded: ' + d.filename);
        });
    });
  }

  var CSS =
    '*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Public Sans",Arial,sans-serif;background:#eee;color:#2b2a26;font-size:12px}' +
    '.toolbar{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;background:#2b2a26;color:#fff;padding:10px 18px;z-index:10}' +
    '.tb-title{font-weight:700;letter-spacing:.3px}.tbtn{border:none;border-radius:6px;padding:8px 16px;font-weight:700;cursor:pointer;margin-left:8px;background:#fff;color:#2b2a26}.tbtn.primary{background:linear-gradient(135deg,#C9A227,#B8860B);color:#fff}' +
    '.sheet{background:#fff;max-width:820px;margin:18px auto;padding:34px 38px;box-shadow:0 6px 24px rgba(0,0,0,.12)}' +
    '.lh{display:flex;justify-content:space-between;border-bottom:3px solid #C9A227;padding-bottom:14px}.lh-left{display:flex;gap:14px;align-items:flex-start}' +
    '.lh-logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#C9A227,#B8860B);color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800}' +
    '.lh-name{font-size:20px;font-weight:800;color:#2b2a26}.lh-meta{font-size:11px;color:#6f6c63;margin-top:2px}' +
    '.doc-title{text-align:center;font-size:16px;font-weight:800;letter-spacing:3px;color:#B8860B;margin:18px 0 4px;text-transform:uppercase}.rpt-sub{text-align:center;color:#6f6c63;margin-bottom:14px;font-size:12px}' +
    '.meta-grid{display:flex;justify-content:space-between;gap:20px;margin:14px 0;border:1px solid #ece7da;border-radius:8px;overflow:hidden}.party{padding:12px 14px;flex:1}.inv-meta{padding:12px 14px;background:#faf8f2;min-width:250px}' +
    '.lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#908c81;font-weight:700;margin-bottom:4px}.pname{font-size:15px;font-weight:800;color:#2b2a26}.pmeta{font-size:11px;color:#6f6c63;margin-top:3px}' +
    '.inv-meta>div{display:flex;justify-content:space-between;padding:2px 0;font-size:12px}.inv-meta span{color:#6f6c63}' +
    '.items{width:100%;border-collapse:collapse;margin-top:6px}.items th{background:#2b2a26;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.03em;padding:7px 6px;font-weight:700;border:1px solid #2b2a26}' +
    '.items td{padding:7px 6px;border:1px solid #ece7da;font-size:11.5px}.items tbody tr:nth-child(even){background:#faf8f2}.items tfoot td{background:#f4e9c8;font-weight:800;border:1px solid #e9d49a}' +
    '.items .c{text-align:center}.items .r{text-align:right}.items .b{font-weight:700}' +
    '.summary-grid{display:flex;gap:18px;margin-top:16px}.words{flex:1}.w{font-size:13px;font-weight:700;color:#2b2a26;font-style:italic;margin-bottom:12px}.bank{font-size:11px;color:#6f6c63;line-height:1.5}.totals{min-width:280px}' +
    '.tl{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f2eee4;font-size:13px}.tl span{color:#6f6c63}.tl.grand{border-top:2px solid #C9A227;border-bottom:2px solid #C9A227;font-size:16px;font-weight:800;color:#B8860B;margin-top:4px}' +
    '.amt-banner{display:flex;justify-content:space-between;align-items:center;background:#faf8f2;border:1px dashed #C9A227;border-radius:8px;padding:14px 18px;margin:14px 0;font-size:14px}.amt-banner b{font-size:22px;color:#B8860B}' +
    '.foot-grid{display:flex;justify-content:space-between;gap:20px;margin-top:24px}.terms{flex:1;font-size:11px;color:#6f6c63}.terms ol{margin-left:16px;margin-top:4px;line-height:1.6}.sign{text-align:center;min-width:220px;font-size:12px}.sign-space{height:46px}' +
    '.cgen{text-align:center;color:#908c81;font-size:10px;margin-top:22px;border-top:1px solid #ece7da;padding-top:10px}' +
    '.rpt-body table{width:100%;border-collapse:collapse}.rpt-body th{background:#2b2a26;color:#fff;font-size:10px;text-transform:uppercase;padding:8px 10px;text-align:left}.rpt-body td{padding:7px 10px;border-bottom:1px solid #f2eee4;font-size:12px}' +
    '.rpt-body tr.grp td{background:#faf8f2;font-weight:800}.rpt-body tr.total td{background:#f4e9c8;font-weight:800;border-top:2px solid #C9A227}.rpt-body .num,.rpt-body td.num,.rpt-body th.num{text-align:right}.rpt-body .badge-soft{display:none}.rpt-h{font-size:14px;font-weight:800;color:#B8860B;margin:16px 0 6px}' +
    '@media print{body{background:#fff}.no-print{display:none!important}.sheet{box-shadow:none;margin:0;max-width:100%;padding:0}}';

  window.App = window.App || {};
  window.App.print = {
    // preview (used by detail Print buttons)
    salesInvoice: function (d) { preview(buildInvoice(d, false)); },
    purchaseInvoice: function (d) { preview(buildInvoice(d, true)); },
    journal: function (d) { preview(buildJournal(d)); },
    payment: function (d) { preview(buildPayment(d)); },
    report: function (t, s, b) { preview(buildReport(t, s, b)); },
    // generic
    build: build,
    preview: function (type, data) { preview(build(type, data)); },
    download: function (type, data) { download(build(type, data)); },
    downloadReport: function (t, s, b) { download(buildReport(t, s, b)); },
    summary: function (type, data) { var d = build(type, data); return d ? d.summary : ''; }
  };
})(window);
