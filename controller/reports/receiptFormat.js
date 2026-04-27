// ── Shared formatters ─────────────────────────────────────────
const fmtPHP = (v) =>
  '\u20b1 ' +
  parseFloat(v || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (v) => {
  if (!v) return '\u2014';
  const d = new Date(v);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

// ── Design tokens ─────────────────────────────────────────────
const NAVY    = '#0d2b45';
const ACCENT  = '#1a6e3c';
const MUTED   = '#777777';
const BORDER  = '#d0d7de';
const LIGHT   = '#f6f8fa';
const WHITE   = '#ffffff';
const TEXT    = '#1c1c1e';
const SUBTEXT = '#555555';

// ── Shared styles ─────────────────────────────────────────────
const STYLES = {
  companyName:    { fontSize: 11, bold: true, color: NAVY },
  companyTagline: { fontSize: 7.5, color: MUTED, italics: true },
  receiptTitle:   { fontSize: 22, bold: true, color: NAVY, characterSpacing: 8 },
  metaLabel:      { fontSize: 7, bold: true, color: MUTED, characterSpacing: 0.5 },
  metaValue:      { fontSize: 8.5, color: TEXT },
  clientName:     { fontSize: 10, bold: true, color: NAVY },
  clientSub:      { fontSize: 8, color: SUBTEXT, italics: true },
  tableHeader:    { fontSize: 7.5, bold: true, color: WHITE, characterSpacing: 0.3 },
  tableBody:      { fontSize: 8.5, color: TEXT },
  tableBodyMono:  { fontSize: 8.5, color: TEXT },
  summaryLabel:   { fontSize: 8.5, color: SUBTEXT },
  summaryValue:   { fontSize: 8.5, color: TEXT },
  totalLabel:     { fontSize: 11, bold: true, color: NAVY },
  totalValue:     { fontSize: 11, bold: true, color: ACCENT },
  sectionCap:     { fontSize: 7, bold: true, color: MUTED, characterSpacing: 1 },
  paymentHeader:  { fontSize: 7.5, bold: true, color: WHITE, characterSpacing: 0.3 },
  footerText:     { fontSize: 7.5, color: MUTED, italics: true },
  txnLabel:       { fontSize: 8, bold: true, color: NAVY },
};

// ── Table layouts ─────────────────────────────────────────────
const ITEM_LAYOUT = {
  hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 0 : 0.4,
  vLineWidth: () => 0,
  hLineColor: () => BORDER,
  fillColor:  (i) => i === 0 ? NAVY : null,
  paddingLeft:   (i) => i === 0 ? 10 : 8,
  paddingRight:  (i, node) => i === node.table.widths.length - 1 ? 10 : 8,
  paddingTop:    (i) => i === 0 ? 8 : 6,
  paddingBottom: (i) => i === 0 ? 8 : 6,
};

const PAYMENT_LAYOUT = {
  hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 0 : 0.3,
  vLineWidth: () => 0,
  hLineColor: () => BORDER,
  fillColor:  (i) => i === 0 ? ACCENT : (i % 2 === 0 ? '#f0f7f3' : null),
  paddingLeft:   (i) => i === 0 ? 10 : 8,
  paddingRight:  (i, node) => i === node.table.widths.length - 1 ? 10 : 8,
  paddingTop:    (i) => i === 0 ? 7 : 5,
  paddingBottom: (i) => i === 0 ? 7 : 5,
};

// ── Thin rule ─────────────────────────────────────────────────
const rule = (color = BORDER, marginArr = [0, 0, 0, 0]) => ({
  canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 0.5, lineColor: color }],
  margin: marginArr,
});

// ── Section caption ───────────────────────────────────────────
const sectionCap = (label, marginArr = [0, 0, 0, 5]) => ({
  text: label,
  style: 'sectionCap',
  margin: marginArr,
});

// ── Line items table ──────────────────────────────────────────
const buildItemsTable = (dtls) => {
  const header = [
    { text: 'DESCRIPTION',  style: 'tableHeader' },
    { text: 'UNIT PRICE',   style: 'tableHeader', alignment: 'right' },
    { text: 'QTY',          style: 'tableHeader', alignment: 'center' },
    { text: 'AMOUNT',       style: 'tableHeader', alignment: 'right' },
  ];

  if (!dtls || !dtls.length) {
    return [header, [{ text: 'No items.', colSpan: 4, alignment: 'center', fontSize: 8, color: MUTED, italics: true, margin: [0, 6, 0, 6] }, {}, {}, {}]];
  }

  return [
    header,
    ...dtls.map((d) => {
      const rate = parseFloat(d.Rate || d.rate || 0);
      const qty  = parseFloat(d.QTY  || d.qty  || 1);
      const net  = parseFloat(d.Net  || d.net  || rate * qty);
      return [
        { text: d.ServiceName || d.servicename || '\u2014', style: 'tableBody' },
        { text: fmtPHP(rate), style: 'tableBodyMono', alignment: 'right' },
        { text: String(qty),  style: 'tableBody',     alignment: 'center' },
        { text: fmtPHP(net),  style: 'tableBodyMono', alignment: 'right', bold: true },
      ];
    }),
  ];
};

// ── Payment method normaliser ─────────────────────────────────
const normMethod = (m) => {
  if (!m) return '\u2014';
  const u = m.trim().toUpperCase();
  if (u === 'GCASH')         return 'GCash';
  if (u === 'MAYA')          return 'Maya';
  if (u === 'CASH')          return 'Cash';
  if (u === 'CHECK')         return 'Check';
  if (u === 'BANK TRANSFER') return 'Bank Transfer';
  return m.trim();
};

// ── Payment history table ─────────────────────────────────────
const buildPaymentsTable = (payments) => {
  if (!payments || !payments.length) return null;

  const header = [
    { text: 'DATE',           style: 'paymentHeader' },
    { text: 'REFERENCE NO.',  style: 'paymentHeader' },
    { text: 'PAYMENT METHOD', style: 'paymentHeader' },
    { text: 'AMOUNT',         style: 'paymentHeader', alignment: 'right' },
    { text: 'STATUS',         style: 'paymentHeader', alignment: 'center' },
  ];

  const rows = payments.map((p) => {
    const method = normMethod(p.PaymentMethod || p.paymentmethod || '');
    const date   = fmtDate(p.Date || p.PaymentDate || null);
    const ref    = p.ReferenceNumber || p.referenceNumber || '\u2014';
    const amt    = parseFloat(p.Amount || p.PaymentAmount || p.amount || 0);
    const status = p.Status || p.PaymentStatus || '\u2014';
    const sColor = status === 'Paid' ? ACCENT : status === 'Posted' ? '#1a5276' : '#7d6608';

    
    return [
      { text: date,      fontSize: 8, color: TEXT },
      { text: ref,       fontSize: 8, color: SUBTEXT },
      { text: method,    fontSize: 8, color: ACCENT, bold: true },
      { text: fmtPHP(amt), fontSize: 8, alignment: 'right', bold: true, color: TEXT },
      { text: status,    fontSize: 8, alignment: 'center', bold: true, color: sColor },
    ];
  });

  return {
    stack: [
      rule(BORDER, [0, 0, 0, 10]),
      sectionCap('PAYMENT HISTORY'),
      {
        table: { headerRows: 1, widths: [68, '*', 88, 78, 52], body: [header, ...rows] },
        layout: PAYMENT_LAYOUT,
      },
    ],
    margin: [0, 0, 0, 12],
  };
};

// ── Page header ───────────────────────────────────────────────
const pageHeader = () => [
  {
    columns: [
      {
        width: '*',
        stack: [
          { text: 'CDJ Accounting and Auditing Office', style: 'companyName' },
          { text: 'Professional Accounting & Auditing Services', style: 'companyTagline', margin: [0, 1, 0, 0] },
        ],
      },
      { text: 'RECEIPT', style: 'receiptTitle', alignment: 'right', width: 'auto' },
    ],
    margin: [0, 0, 0, 10],
  },
  // double rule: thick navy + thin accent
  { canvas: [{ type: 'rect', x: 0, y: 0, w: 495, h: 2, color: NAVY }] },
  { canvas: [{ type: 'rect', x: 0, y: 0, w: 495, h: 1.5, color: ACCENT }], margin: [0, 1.5, 0, 14] },
];

// ── Page footer ───────────────────────────────────────────────
const pageFooter = (currentPage, pageCount) => ({
  columns: [
    { text: 'CDJ Accounting and Auditing Office — Confidential', style: 'footerText', margin: [50, 0, 0, 0] },
    { text: 'Page ' + currentPage + ' of ' + pageCount, style: 'footerText', alignment: 'right', margin: [0, 0, 50, 0] },
  ],
  margin: [0, 10, 0, 0],
});

// ── Totals block ──────────────────────────────────────────────
const totalsBlock = (gross, discount, serviceFee, net, payments, status) => {
  const totalPaid = (payments || []).reduce((s, p) => s + parseFloat(p.Amount || p.PaymentAmount || p.amount || 0), 0);
  const balance   = Math.max(0, net - totalPaid);
  const isPosted  = status === 'Posted';

  return {
    columns: [
      { width: '*', text: '' },
      {
        width: 210,
        margin: [0, 4, 0, 12],
        stack: [
          rule(BORDER, [0, 0, 0, 7]),
          ...(gross > 0 ? [{
            columns: [{ text: 'Subtotal', style: 'summaryLabel', width: '*' }, { text: fmtPHP(gross), style: 'summaryValue', alignment: 'right' }],
            margin: [0, 0, 0, 4],
          }] : []),
          ...(discount > 0 ? [{
            columns: [{ text: 'Discount', style: 'summaryLabel', width: '*' }, { text: '\u2212 ' + fmtPHP(discount), style: 'summaryValue', alignment: 'right', color: '#c0392b' }],
            margin: [0, 0, 0, 4],
          }] : []),
          ...(serviceFee > 0 ? [{
            columns: [{ text: 'Service Fee', style: 'summaryLabel', width: '*' }, { text: fmtPHP(serviceFee), style: 'summaryValue', alignment: 'right', color: '#1a5276' }],
            margin: [0, 0, 0, 4],
          }] : []),
          rule(NAVY, [0, 4, 0, 7]),
          {
            columns: [
              { text: 'TOTAL DUE', style: 'totalLabel', width: '*' },
              { text: fmtPHP(net), style: 'totalValue', alignment: 'right' },
            ],
          },
          // ── Balance rows (Posted only) ─────────────────────
          ...(isPosted ? [
            {
              columns: [
                { text: 'Amount Paid', style: 'summaryLabel', width: '*' },
                { text: '\u2212 ' + fmtPHP(totalPaid), style: 'summaryValue', alignment: 'right', color: '#1a6e3c' },
              ],
              margin: [0, 6, 0, 4],
            },
            rule('#ed6c02', [0, 0, 0, 7]),
            {
              columns: [
                { text: 'BALANCE DUE', fontSize: 11, bold: true, color: '#b45309', width: '*' },
                { text: fmtPHP(balance), fontSize: 11, bold: true, color: '#b45309', alignment: 'right' },
              ],
            },
          ] : []),
        ],
      },
    ],
  };
};

// ── Terms & signature block ───────────────────────────────────
const termsBlock = () => ({
  columns: [
    {
      width: '*',
      stack: [
        sectionCap('TERMS & CONDITIONS'),
        { text: 'Payment is due within 14 days of project completion.', fontSize: 7.5, color: SUBTEXT, margin: [0, 0, 0, 2] },
        { text: 'All checks payable to CDJ Accounting and Auditing Office.', fontSize: 7.5, color: SUBTEXT, margin: [0, 0, 0, 2] },
        { text: 'This document serves as an official receipt upon full payment.', fontSize: 7.5, color: SUBTEXT },
      ],
    },
    { width: 20, text: '' },
    {
      width: 180,
      stack: [
        sectionCap('AUTHORISED BY'),
        { canvas: [{ type: 'line', x1: 0, y1: 30, x2: 180, y2: 30, lineWidth: 0.6, lineColor: NAVY }] },
        { text: 'CDJ Accounting and Auditing Office', fontSize: 7.5, color: SUBTEXT, margin: [0, 3, 0, 0], alignment: 'center' },
      ],
    },
  ],
  margin: [0, 0, 0, 0],
});

// ════════════════════════════════════════════════════════════════
// SINGLE RECEIPT
// ════════════════════════════════════════════════════════════════
const buildSingleReceiptDoc = (hdr, dtls, clientName, payments) => {
  const gross      = parseFloat(hdr.GrossTotal || 0);
  const discount   = parseFloat(hdr.Discount   || 0);
  const serviceFee = parseFloat(hdr.ServiceFee || 0);
  const net        = parseFloat(hdr.NetTotal   || 0);
  const pmtBlock   = buildPaymentsTable(payments);

  return {
    pageSize:    'A4',
    pageMargins: [50, 44, 50, 60],
    styles:      STYLES,
    defaultStyle:{ fontSize: 9, font: 'Roboto' },
    footer:      pageFooter,

    content: [
      ...pageHeader(),

      // ── Billing meta row ──
      {
        columns: [
          // FROM
          {
            width: 160,
            stack: [
              sectionCap('ISSUED BY'),
              { text: 'CDJ Accounting and Auditing Office', style: 'clientName', fontSize: 9 },
              { text: 'Professional Accounting & Auditing Services', style: 'clientSub' },
            ],
          },
          { width: 16, text: '' },
          // BILLED TO
          {
            width: '*',
            stack: [
              sectionCap('BILLED TO'),
              { text: clientName, style: 'clientName' },
              { text: hdr.Particulars || '\u2014', style: 'clientSub' },
            ],
          },
          { width: 16, text: '' },
          // Receipt details box
          {
            width: 155,
            table: {
              widths: ['*', 'auto'],
              body: [
                [{ text: 'Receipt No.', style: 'metaLabel' }, { text: String(hdr.ID).padStart(7, '0'), style: 'metaValue', alignment: 'right', bold: true, color: NAVY }],
                [{ text: 'Date',        style: 'metaLabel' }, { text: fmtDate(hdr.TransactionDate),     style: 'metaValue', alignment: 'right' }],
                [{ text: 'Status',      style: 'metaLabel' }, { text: hdr.Status || '\u2014',            style: 'metaValue', alignment: 'right', bold: true, color: ACCENT }],
                [{ text: 'Prepared By', style: 'metaLabel' }, { text: hdr.PreparedBy || 'CDJ Accounting', style: 'metaValue', alignment: 'right' }],
              ],
            },
            layout: {
              hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.5 : 0.3,
              vLineWidth: () => 0,
              hLineColor: () => BORDER,
              fillColor:  (i) => i % 2 === 0 ? LIGHT : WHITE,
              paddingLeft:   () => 8,
              paddingRight:  () => 8,
              paddingTop:    () => 4,
              paddingBottom: () => 4,
            },
          },
        ],
        margin: [0, 0, 0, 16],
      },

      rule(BORDER, [0, 0, 0, 12]),

      // ── Line items ──
      sectionCap('SERVICES RENDERED', [0, 0, 0, 6]),
      {
        table: { headerRows: 1, widths: ['*', 88, 36, 88], body: buildItemsTable(dtls) },
        layout: ITEM_LAYOUT,
      },

      totalsBlock(gross, discount, serviceFee, net, payments, hdr.Status),

      // ── Payments ──
      ...(pmtBlock ? [pmtBlock] : []),

      rule(BORDER, [0, 4, 0, 12]),
      termsBlock(),
    ],
  };
};

// ════════════════════════════════════════════════════════════════
// COMBINED RECEIPT
// ════════════════════════════════════════════════════════════════
const buildCombinedReceiptDoc = (groups, clientName, totals) => {
  const { combinedGross, combinedDiscount, combinedServiceFee, combinedNet } = totals;

  const content = [
    ...pageHeader(),

    // ── Combined header meta ──
    {
      columns: [
        {
          width: 160,
          stack: [
            sectionCap('ISSUED BY'),
            { text: 'CDJ Accounting and Auditing Office', style: 'clientName', fontSize: 9 },
            { text: 'Professional Accounting & Auditing Services', style: 'clientSub' },
          ],
        },
        { width: 16, text: '' },
        {
          width: '*',
          stack: [
            sectionCap('BILLED TO'),
            { text: clientName, style: 'clientName' },
            { text: 'Combined Statement of Account', style: 'clientSub' },
            { text: groups.length + ' transaction' + (groups.length !== 1 ? 's' : ''), fontSize: 7.5, color: MUTED, margin: [0, 2, 0, 0] },
          ],
        },
        { width: 16, text: '' },
        {
          width: 155,
          table: {
            widths: ['*', 'auto'],
            body: [
              [{ text: 'Type',   style: 'metaLabel' }, { text: 'COMBINED SOA', style: 'metaValue', alignment: 'right', bold: true, color: '#1a5276' }],
              [{ text: 'Client', style: 'metaLabel' }, { text: clientName,      style: 'metaValue', alignment: 'right' }],
              [{ text: 'Count',  style: 'metaLabel' }, { text: String(groups.length) + ' txn(s)', style: 'metaValue', alignment: 'right' }],
            ],
          },
          layout: {
            hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.5 : 0.3,
            vLineWidth: () => 0,
            hLineColor: () => BORDER,
            fillColor:  (i) => i % 2 === 0 ? LIGHT : WHITE,
            paddingLeft:   () => 8,
            paddingRight:  () => 8,
            paddingTop:    () => 4,
            paddingBottom: () => 4,
          },
        },
      ],
      margin: [0, 0, 0, 16],
    },

    rule(BORDER, [0, 0, 0, 12]),
  ];

  // ── Per-transaction blocks ──
  groups.forEach((group, gi) => {
    if (gi > 0) {
      content.push(rule('#b0bec5', [0, 14, 0, 0]));
    }

    content.push(
      // Transaction sub-header
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                columns: [
                  { text: 'Transaction #' + String(group.hdr.ID).padStart(7, '0'), style: 'txnLabel', width: '*' },
                  { text: fmtDate(group.hdr.TransactionDate), fontSize: 7.5, color: MUTED, alignment: 'right', width: 'auto' },
                ],
              },
              ...(group.hdr.Particulars ? [{ text: group.hdr.Particulars, style: 'clientSub', margin: [0, 1, 0, 0] }] : []),
            ],
            margin: [0, gi === 0 ? 0 : 12, 0, 7],
          },
          {
            width: 48,
            text: group.hdr.Status || '\u2014',
            fontSize: 7.5, bold: true, color: ACCENT, alignment: 'right',
            margin: [0, gi === 0 ? 2 : 14, 0, 0],
          },
        ],
      },

      // Line items
      {
        table: { headerRows: 1, widths: ['*', 88, 36, 88], body: buildItemsTable(group.dtls) },
        layout: ITEM_LAYOUT,
      },

      // Per-transaction sub-totals inline
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            margin: [0, 5, 0, 0],
            stack: [
              {
                columns: [
                  { text: 'Gross: '        + fmtPHP(group.hdr.GrossTotal),  fontSize: 7.5, color: SUBTEXT,   margin: [0, 0, 12, 0] },
                  { text: 'Discount: \u2212' + fmtPHP(group.hdr.Discount),  fontSize: 7.5, color: '#c0392b', margin: [0, 0, 12, 0] },
                  { text: 'Svc Fee: '      + fmtPHP(group.hdr.ServiceFee),  fontSize: 7.5, color: '#1a5276', margin: [0, 0, 12, 0] },
                  { text: 'Net: '          + fmtPHP(group.hdr.NetTotal),    fontSize: 7.5, bold: true, color: ACCENT },
                ],
              },
              // ── Per-transaction balance (Posted only) ──────
              ...(() => {
                if (group.hdr.Status !== 'Posted') return [];
                const paid    = (group.payments || []).reduce((s, p) => s + parseFloat(p.Amount || p.PaymentAmount || p.amount || 0), 0);
                const balance = Math.max(0, parseFloat(group.hdr.NetTotal || 0) - paid);
                return [{
                  columns: [
                    { text: 'Paid: ' + fmtPHP(paid),       fontSize: 7.5, color: '#1a6e3c', margin: [0, 3, 12, 0] },
                    { text: 'Balance: ' + fmtPHP(balance),  fontSize: 7.5, bold: true, color: '#b45309' },
                  ],
                  margin: [0, 2, 0, 0],
                }];
              })(),
            ],
          },
        ],
      },
    );

    // Per-transaction payments
    const pmtBlock = buildPaymentsTable(group.payments);
    if (pmtBlock) content.push(pmtBlock);
  });

  // ── Grand total ──
  content.push(
    {
      columns: [
        { width: '*', text: '' },
        {
          width: 210,
          margin: [0, 8, 0, 14],
          stack: [
            rule(BORDER, [0, 0, 0, 7]),
            ...(combinedGross > 0 ? [{ columns: [{ text: 'Total Gross',    style: 'summaryLabel', width: '*' }, { text: fmtPHP(combinedGross),      style: 'summaryValue', alignment: 'right' }], margin: [0, 0, 0, 4] }] : []),
            ...(combinedDiscount > 0 ? [{ columns: [{ text: 'Total Discount', style: 'summaryLabel', width: '*' }, { text: '\u2212 ' + fmtPHP(combinedDiscount), style: 'summaryValue', alignment: 'right', color: '#c0392b' }], margin: [0, 0, 0, 4] }] : []),
            ...(combinedServiceFee > 0 ? [{ columns: [{ text: 'Total Service Fee', style: 'summaryLabel', width: '*' }, { text: fmtPHP(combinedServiceFee), style: 'summaryValue', alignment: 'right', color: '#1a5276' }], margin: [0, 0, 0, 4] }] : []),
            rule(NAVY, [0, 4, 0, 7]),
            { columns: [{ text: 'TOTAL DUE', style: 'totalLabel', width: '*' }, { text: fmtPHP(combinedNet), style: 'totalValue', alignment: 'right' }] },
          ],
        },
      ],
    },
    rule(BORDER, [0, 4, 0, 12]),
    termsBlock(),
  );

  return {
    pageSize:    'A4',
    pageMargins: [50, 44, 50, 60],
    styles:      STYLES,
    defaultStyle:{ fontSize: 9, font: 'Roboto' },
    footer:      pageFooter,
    content,
  };
};

module.exports = { buildSingleReceiptDoc, buildCombinedReceiptDoc };