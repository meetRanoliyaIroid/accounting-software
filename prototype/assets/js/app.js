/* =====================================================================
   GoldBooks Accounting — Core App JS
   Shell loader (AJAX partials), helpers, formatting, toasts, animations
   ===================================================================== */

(function (window, $) {
  'use strict';

  // Detect base path: pages live in /pages/, so they need to reach the root.
  var IN_PAGES = /\/pages\//.test(window.location.pathname);
  var BASE = IN_PAGES ? '../' : '';

  // ---- Role-based access control ----
  var ALL_PAGES = ['dashboard', 'coa', 'journal', 'ledger', 'outstanding', 'adjustments', 'notes', 'customers', 'quotations', 'sales-order', 'dispatch', 'packing', 'sales-invoice',
    'suppliers', 'indents', 'purchase-order', 'grn', 'purchase-invoice', 'payments', 'bank', 'cheque', 'lc', 'items', 'stock', 'taxes',
    'bom', 'work-order', 'agents', 'statutory', 'trial-balance', 'pnl', 'balance-sheet', 'ageing',
    'reports', 'loans', 'complaints', 'masters', 'activity-log', 'user-rights', 'settings'];

  function except(list) { return ALL_PAGES.filter(function (p) { return list.indexOf(p) === -1; }); }

  var ROLES = {
    'Administrator':    { label: 'Administrator',        pages: ALL_PAGES.slice(),               write: true },
    'Accounts Manager': { label: 'Accounts Manager',     pages: except(['settings']),            write: true },
    'Accountant':       { label: 'Accountant',           pages: except(['settings', 'pnl', 'balance-sheet']), write: true },
    'Auditor':          { label: 'Auditor (Read-only)',  pages: except(['settings']),            write: false }
  };

  var App = {
    base: BASE,
    ROLES: ROLES,

    getRole: function () {
      try { return localStorage.getItem('gb_role'); } catch (e) { return null; }
    },
    setRole: function (r) { try { localStorage.setItem('gb_role', r); } catch (e) {} },
    logout: function () { try { localStorage.removeItem('gb_role'); } catch (e) {} window.location.href = BASE + 'login.html'; },
    roleConfig: function () { return ROLES[App.getRole()] || null; },

    /* ---------- Formatting ---------- */
    currency: function (n, symbol) {
      symbol = symbol || '₹';
      n = Number(n) || 0;
      var neg = n < 0;
      var s = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return (neg ? '-' : '') + symbol + s;
    },
    number: function (n) {
      return (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    shortDate: function (d) {
      try {
        var dt = new Date(d);
        return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch (e) { return d; }
    },

    /* ---------- AJAX (resolves relative to prototype root) ---------- */
    data: function (file) {
      return $.getJSON(BASE + 'data/' + file);
    },

    /* ---------- Toast ---------- */
    toast: function (msg, type) {
      type = type || 'success';
      var $host = $('.toast-host');
      if (!$host.length) { $host = $('<div class="toast-host"></div>').appendTo('body'); }
      var icon = type === 'error' ? 'bx-error-circle' : (type === 'success' ? 'bx-check-circle' : 'bx-info-circle');
      var $t = $('<div class="toast-msg ' + type + '"><i class="bx ' + icon + '" style="font-size:1.3rem;color:var(--gold-600)"></i><span>' + msg + '</span></div>');
      $host.append($t);
      setTimeout(function () { $t.fadeOut(250, function () { $(this).remove(); }); }, 3200);
    },

    /* ---------- Animated counter ---------- */
    countUp: function ($el, target, opts) {
      opts = opts || {};
      var dur = opts.duration || 1100;
      var prefix = opts.prefix || '';
      var decimals = opts.decimals != null ? opts.decimals : 2;
      var start = 0, startTime = null;
      function step(ts) {
        if (!startTime) startTime = ts;
        var p = Math.min((ts - startTime) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        var val = start + (target - start) * eased;
        $el.text(prefix + val.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    },

    statusBadge: function (status) {
      var map = {
        'Paid': 'badge-paid', 'Unpaid': 'badge-unpaid', 'Draft': 'badge-draft',
        'Submitted': 'badge-submitted', 'Partly Paid': 'badge-partial',
        'Partial': 'badge-partial', 'Overdue': 'badge-overdue', 'Cancelled': 'badge-draft'
      };
      var cls = map[status] || 'badge-draft';
      return '<span class="badge-soft ' + cls + '">' + status + '</span>';
    },

    /* ---------- Accounting helpers (Phase 1: Ledger + Outstanding) ---------- */
    // Days overdue / ageing bucket for a due date relative to an "as on" date.
    ageBucket: function (dueStr, asOn) {
      var as = asOn ? new Date(asOn) : new Date('2026-06-24');
      var days = Math.floor((as - new Date(dueStr)) / 86400000);
      if (days <= 0) return { idx: -1, days: days, label: 'Not due' };
      if (days <= 30) return { idx: 0, days: days, label: '0-30' };
      if (days <= 60) return { idx: 1, days: days, label: '31-60' };
      if (days <= 90) return { idx: 2, days: days, label: '61-90' };
      return { idx: 3, days: days, label: '90+' };
    },

    // Credit policy defaults (overridable from settings.json by callers).
    creditPolicy: { grace_days: 0, penalty_pct_per_month: 2 },

    // Credit-control status for a customer (Phase 7).
    // overdueAmt = sum of bill balances past the credit period (caller computes from Outstanding).
    creditStatus: function (cust, overdueAmt) {
      overdueAmt = Number(overdueAmt) || 0;
      var limit = Number(cust.credit_limit) || 0, bal = Number(cust.balance) || 0;
      var available = limit - bal;
      var overLimit = limit > 0 && bal > limit;
      var overdue = overdueAmt > 0;
      var blocked = overLimit || overdue;
      var status = overLimit ? 'Over Credit Limit'
                 : overdue ? 'Credit Days Exceeded'
                 : (limit > 0 && available < limit * 0.1 ? 'Near Limit' : 'Within Limit');
      var cls = blocked ? 'badge-overdue' : (status === 'Near Limit' ? 'badge-partial' : 'badge-paid');
      return { status: status, cls: cls, available: available, overLimit: overLimit, overdue: overdue, blocked: blocked, limit: limit, balance: bal, overdueAmt: overdueAmt };
    },

    // Penalty/interest on an overdue amount: pct per month × months overdue.
    penalty: function (amount, daysOverdue, pctPerMonth) {
      pctPerMonth = pctPerMonth != null ? pctPerMonth : App.creditPolicy.penalty_pct_per_month;
      var months = Math.max(1, Math.ceil((Number(daysOverdue) || 0) / 30));
      return +(((Number(amount) || 0) * pctPerMonth / 100) * months).toFixed(2);
    },

    // Single posting → BOTH General Ledger lines and Outstanding (bill-wise) effects.
    // This is the Phase 1 rule: every voucher reflects in Ledger AND Outstanding.
    // voucher: { no, date, type, unit, lines:[{account, party, debit, credit, bill_ref}] }
    postVoucher: function (voucher) {
      var v = voucher || {}, gl = [], outstanding = [];
      (v.lines || []).forEach(function (l) {
        var dr = Number(l.debit) || 0, cr = Number(l.credit) || 0;
        if (!l.account || (!dr && !cr)) return;
        gl.push({ date: v.date, account: l.account, voucher: v.no, type: v.type,
          against: l.party || '—', unit: v.unit || l.unit || '', debit: dr, credit: cr });
        // A line with a party + a receivable/payable account creates/settles outstanding.
        var isParty = !!l.party && /receivable|payable|debtor|creditor/i.test(l.account || '');
        if (isParty) {
          var net = dr - cr;
          var type = /receivable|debtor/i.test(l.account) ? 'Receivable' : 'Payable';
          // For receivable: Dr increases balance, Cr settles. For payable: Cr increases, Dr settles.
          var increases = type === 'Receivable' ? net > 0 : net < 0;
          outstanding.push({
            type: type, party: l.party, account: l.account, voucher: l.bill_ref || v.no,
            voucher_type: v.type, date: v.date, unit: v.unit || l.unit || '',
            amount: Math.abs(net), effect: l.bill_ref ? 'Close / settle' : (increases ? 'New open item' : 'Reduce balance'),
            settles: !!l.bill_ref
          });
        }
      });
      return { gl: gl, outstanding: outstanding };
    },

    /* ---------- Confirm dialog (danger actions) ---------- */
    _ensureConfirm: function () {
      if (document.getElementById('gbConfirm')) return;
      $('body').append(
        '<div class="modal fade" id="gbConfirm" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-sm">' +
        '<div class="modal-content" style="border:none;border-radius:var(--radius)"><div class="modal-body text-center p-4">' +
        '<div id="gbConfirmIcon" class="mx-auto mb-3" style="width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font-size:2.1rem"></div>' +
        '<h5 class="fw-8" id="gbConfirmTitle">Are you sure?</h5>' +
        '<p class="text-muted-2 mb-4" id="gbConfirmMsg"></p>' +
        '<div class="d-flex gap-2"><button class="btn btn-soft flex-fill" data-bs-dismiss="modal">Cancel</button>' +
        '<button class="btn flex-fill" id="gbConfirmOk"></button></div></div></div></div></div>');
    },
    confirm: function (opts) {
      App._ensureConfirm();
      opts = opts || {};
      var danger = opts.danger !== false;
      $('#gbConfirmTitle').text(opts.title || 'Are you sure?');
      $('#gbConfirmMsg').text(opts.message || 'This action cannot be undone.');
      $('#gbConfirmIcon').html('<i class="bx ' + (danger ? 'bx-error' : 'bx-help-circle') + '"></i>')
        .css({ background: danger ? 'var(--danger-soft)' : 'var(--gold-50)', color: danger ? 'var(--danger)' : 'var(--gold-600)' });
      var $ok = $('#gbConfirmOk');
      $ok.attr('class', 'btn flex-fill ' + (danger ? '' : 'btn-gold')).text(opts.confirmText || (danger ? 'Delete' : 'Confirm'))
        .css(danger ? { background: 'var(--danger)', color: '#fff', border: 'none' } : { background: '', color: '', border: '' });
      var m = bootstrap.Modal.getOrCreateInstance(document.getElementById('gbConfirm'));
      $ok.off('click').on('click', function () { m.hide(); if (opts.onConfirm) opts.onConfirm(); });
      m.show();
    },

    /* ---------- Row action menu (kebab) ---------- */
    kebab: function (id, actions) {
      var items = actions.map(function (a) {
        return '<li><a class="dropdown-item' + (a.danger ? ' text-danger' : '') + '" href="javascript:void(0)" data-act="' + a.act + '" data-id="' + id + '"><i class="bx ' + a.icon + ' me-2"></i>' + a.label + '</a></li>';
      }).join('');
      return '<div class="dropdown d-inline-block"><button class="icon-btn" style="width:32px;height:32px;font-size:1.25rem" data-bs-toggle="dropdown" aria-expanded="false"><i class="bx bx-dots-vertical-rounded"></i></button>' +
        '<ul class="dropdown-menu dropdown-menu-end gb-menu">' + items + '</ul></div>';
    },

    /* ---------- Share / Send document ---------- */
    _ensureShare: function () {
      if (document.getElementById('gbShare')) {
        return;
      }
      $('body').append(
        '<div class="modal fade" id="gbShare" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content" style="border:none;border-radius:var(--radius)">' +
        '<div class="modal-header" style="border-bottom:1px solid var(--line)"><h5 class="modal-title fw-8"><i class="bx bx-share-alt text-gold"></i> Send Document</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body">' +
          '<div class="card card-pad bg-soft border-0 mb-3"><div class="card-sub" id="shareSummary"></div></div>' +
          '<label class="form-label">Recipient</label><input class="form-control mb-2" id="shareEmail" placeholder="name@example.com">' +
          '<label class="form-label">Message</label><textarea class="form-control mb-3" id="shareMsg" rows="2"></textarea>' +
          '<div class="row g-2">' +
            '<div class="col-6"><button class="btn btn-gold w-100" id="shareSendEmail"><i class="bx bx-envelope"></i> Send Email</button></div>' +
            '<div class="col-6"><button class="btn w-100" id="shareWhatsapp" style="background:#25D366;color:#fff;border:none"><i class="bx bxl-whatsapp"></i> WhatsApp</button></div>' +
            '<div class="col-6"><button class="btn btn-outline-gold w-100" id="shareDownload"><i class="bx bx-download"></i> Download PDF</button></div>' +
            '<div class="col-6"><button class="btn btn-soft w-100" id="shareCopy"><i class="bx bx-copy"></i> Copy Details</button></div>' +
          '</div>' +
        '</div></div></div></div>');

      $('#shareSendEmail').on('click', function () {
        var to = $('#shareEmail').val().trim();
        var a = document.createElement('a');
        a.href = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(App._share.title || 'Document from GoldBooks') + '&body=' + encodeURIComponent($('#shareMsg').val());
        a.click();
        App.toast('Email drafted' + (to ? ' to ' + to : '') + ' (demo)');
      });
      $('#shareWhatsapp').on('click', function () {
        var n = $('#shareEmail').val().replace(/[^\d]/g, '');
        window.open('https://wa.me/' + n + '?text=' + encodeURIComponent($('#shareMsg').val()), '_blank');
        App.toast('Opening WhatsApp…');
      });
      $('#shareDownload').on('click', function () { App.print.download(App._share.type, App._share.data); });
      $('#shareCopy').on('click', function () {
        var txt = $('#shareMsg').val();
        if (navigator.clipboard) navigator.clipboard.writeText(txt);
        App.toast('Details copied to clipboard');
      });
    },
    shareDoc: function (type, data) {
      App._ensureShare();
      var built = App.print.build(type, data);
      App._share = { type: type, data: data, title: built ? built.title : 'Document' };
      var summary = built ? built.summary : '';
      $('#shareSummary').text(summary);
      $('#shareEmail').val(data.email || '');
      $('#shareMsg').val('Hello,\n\nPlease find the details: ' + summary + '\n\nRegards,\nGoldBooks Demo Pvt Ltd');
      bootstrap.Modal.getOrCreateInstance(document.getElementById('gbShare')).show();
    },

    /* ---------- Shell: load sidebar + topbar, wire interactions ---------- */
    loadShell: function (activeNav) {
      // --- Auth + access guard ---
      var cfg = App.roleConfig();
      if (!cfg) { window.location.href = BASE + 'login.html'; return; }
      if (cfg.pages.indexOf(activeNav) === -1) {
        try { sessionStorage.setItem('gb_denied', '1'); } catch (e) {}
        window.location.href = BASE + 'index.html'; return;
      }
      if (!cfg.write) { $('body').addClass('gb-readonly'); }

      var sidebarUrl = BASE + 'partials/sidebar.html';
      var topbarUrl = BASE + 'partials/topbar.html';

      var p1 = $.get(sidebarUrl).done(function (html) {
        var $sb = $('#sidebar');
        $sb.html(html);
        if (IN_PAGES) {
          $sb.find('a[href]').each(function () {
            var h = $(this).attr('href');
            if (h && !/^https?:|^#/.test(h)) $(this).attr('href', BASE + h);
          });
        }
        // Filter nav by role
        $sb.find('.nav-item-link').each(function () {
          if (cfg.pages.indexOf($(this).data('nav')) === -1) $(this).remove();
        });
        // Drop empty section titles
        $sb.find('.nav-section-title').each(function () {
          var $next = $(this).next();
          if (!$next.length || $next.hasClass('nav-section-title')) $(this).remove();
        });
        $sb.find('[data-nav="' + activeNav + '"]').addClass('active');
      });

      var p2 = $.get(topbarUrl).done(function (html) {
        $('#topbar').html(html);
        if (IN_PAGES) {
          $('#topbar').find('a[href]').each(function () {
            var h = $(this).attr('href');
            if (h && !/^https?:|^#|^mailto:|^javascript:/.test(h)) $(this).attr('href', BASE + h);
          });
        }
        $('#tbRole').text(cfg.label);
        $('.topbar-avatar').text(cfg.label.substring(0, 2).toUpperCase());
        if (!cfg.write) {
          $('#topbar').find('.topbar-actions').prepend('<span class="badge-soft badge-partial me-2" title="Read-only role"><i class="bx bx-lock-alt"></i> Read-only</span>');
        }
      });

      $.when(p1, p2).done(function () {
        App.wireShell();
        try {
          if (sessionStorage.getItem('gb_denied')) { sessionStorage.removeItem('gb_denied'); App.toast('Your role does not have access to that page', 'error'); }
        } catch (e) {}
      });
    },

    wireShell: function () {
      var $sidebar = $('#sidebar');
      var $backdrop = $('#sidebarBackdrop');
      $(document).on('click', '#menuToggle', function () {
        $sidebar.toggleClass('open');
        $backdrop.toggleClass('show');
      });
      $(document).on('click', '#sidebarBackdrop', function () {
        $sidebar.removeClass('open');
        $backdrop.removeClass('show');
      });
      $(document).on('click', '#logoutBtn', function () { App.logout(); });
    }
  };

  window.App = App;
})(window, jQuery);
