// ============================================================
// controller/reportControllers/pendingFilingReportController.js
// GET /reports/pending-filing  →  streams a PDF using pdfmake
// ============================================================
'use strict';

const PdfPrinter = require('pdfmake');
const db         = require('../../config/db');       // adjust path to your DB connection
const fonts      = {
  Roboto: {
    normal:      'node_modules/pdfmake/build/vfs_fonts.js', // pdfmake handles this via vfs
    bold:        'node_modules/pdfmake/build/vfs_fonts.js',
    italics:     'node_modules/pdfmake/build/vfs_fonts.js',
    bolditalics: 'node_modules/pdfmake/build/vfs_fonts.js',
  },
};

// ── Use pdfmake's built-in Roboto via the printer ──────────
// Install:  npm install pdfmake
const printer = new PdfPrinter({
  Roboto: {
    normal:      Buffer.from(require('pdfmake/build/vfs_fonts').pdfMake.vfs['Roboto-Regular.ttf'],      'base64'),
    bold:        Buffer.from(require('pdfmake/build/vfs_fonts').pdfMake.vfs['Roboto-Medium.ttf'],       'base64'),
    italics:     Buffer.from(require('pdfmake/build/vfs_fonts').pdfMake.vfs['Roboto-Italic.ttf'],       'base64'),
    bolditalics: Buffer.from(require('pdfmake/build/vfs_fonts').pdfMake.vfs['Roboto-MediumItalic.ttf'],'base64'),
  },
});

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const NAVY   = '#0D2B45';
const RED    = '#DC2626';
const AMBER  = '#D97706';
const BLUE   = '#2563EB';
const GREEN  = '#16A34A';
const WHITE  = '#FFFFFF';
const LIGHT  = '#F8FAFF';
const BORDER = '#E5E7EB';
const MUTED  = '#64748B';

const fmtDate = (s) => {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

const fmtNow = () =>
  new Date().toLocaleString('en-PH', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

const daysLeft = (s) => {
  if (!s) return Infinity;
  const today = new Date(); today.setHours(0,0,0,0);
  const d     = new Date(s + 'T00:00:00'); d.setHours(0,0,0,0);
  return Math.ceil((d - today) / 86400000);
};

const deriveStatus = (dl) =>
  dl === Infinity ? 'Pending' : dl < 0 ? 'Overdue' : dl <= 7 ? 'Urgent' : 'Pending';

const statusColor = (st) =>
  st === 'Overdue' ? RED : st === 'Urgent' ? AMBER : BLUE;

const fmtDl = (dl) =>
  dl === Infinity ? '—'
  : dl < 0        ? `${Math.abs(dl)}d overdue`
  : dl === 0      ? 'Due today!'
  : `${dl}d left`;

// ─────────────────────────────────────────────────────────────
// COMPUTE DEADLINE (mirrors frontend logic)
// ─────────────────────────────────────────────────────────────
function computeDeadline(formCode, periodYear, periodMonth, periodQuarter) {
  const y = Number(periodYear), m = Number(periodMonth)||1, q = Number(periodQuarter)||1;
  const iso = (yr,mo,dy) => `${yr}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
  const lastDay = (yr,mo) => new Date(yr,mo,0).getDate();

  switch (formCode) {
    case '1700': case '1701': case '1701A': return iso(y+1,4,15);
    case '1701Q': return ({1:iso(y,5,15),2:iso(y,8,15),3:iso(y,11,15),4:iso(y+1,4,15)})[q]||iso(y,5,15);
    case '1702-RT': case '1702-EX': return iso(y+1,4,15);
    case '1702Q': {
      const e={1:new Date(y,2,31),2:new Date(y,5,30),3:new Date(y,8,30),4:new Date(y,11,31)};
      const end=e[q]||e[1]; end.setDate(end.getDate()+60);
      return end.toISOString().slice(0,10);
    }
    case '1601-C': { const nm=m===12?1:m+1,ny=m===12?y+1:y; return iso(ny,nm,10); }
    case '1601-EQ': case '1601-FQ': { const a={1:[y,4],2:[y,7],3:[y,10],4:[y+1,1]}; const [ay,am]=a[q]||a[1]; return iso(ay,am,lastDay(ay,am)); }
    case '1604-C': case '1604-E': case '1604-F': case '2316': return iso(y+1,1,31);
    case '2307': case '2306': { const a={1:[y,4],2:[y,7],3:[y,10],4:[y+1,1]}; const [ay,am]=a[q]||a[1]; return iso(ay,am,lastDay(ay,am)); }
    case '2550M': { const nm=m===12?1:m+1,ny=m===12?y+1:y; return iso(ny,nm,25); }
    case '2550Q': case '2551Q': { const a={1:[y,4],2:[y,7],3:[y,10],4:[y+1,1]}; const [ay,am]=a[q]||a[1]; return iso(ay,am,25); }
    case '0605': return iso(y+1,1,31);
    default: return '';
  }
}

const periodLabel = (m) => {
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (m.PeriodType === 'Monthly')   return `${M[(m.PeriodMonth||1)-1]} ${m.PeriodYear}`;
  if (m.PeriodType === 'Quarterly') return `Q${m.PeriodQuarter} ${m.PeriodYear}`;
  return String(m.PeriodYear);
};

// ─────────────────────────────────────────────────────────────
// BUILD PDFMAKE DOC DEFINITION
// ─────────────────────────────────────────────────────────────
function buildDocDef(pendingRows, generatedAt) {
  const overdueCount = pendingRows.filter(r=>r.worstStatus==='Overdue').length;
  const urgentCount  = pendingRows.filter(r=>r.worstStatus==='Urgent').length;
  const totalForms   = pendingRows.reduce((a,r)=>a+r.forms.length, 0);
  const totalClients = pendingRows.length;

  // ── Table body: one row per unfiled form ──────────────────
  const tableHeader = [
    { text:'#',           style:'th', alignment:'center' },
    { text:'Client',      style:'th' },
    { text:'Period',      style:'th' },
    { text:'Form Code',   style:'th', alignment:'center' },
    { text:'Form Name',   style:'th' },
    { text:'Deadline',    style:'th', alignment:'center' },
    { text:'Days Left',   style:'th', alignment:'center' },
    { text:'Status',      style:'th', alignment:'center' },
  ];

  const tableRows = [tableHeader];
  let seq = 1;

  pendingRows.forEach((r, ri) => {
    r.forms.forEach((f, fi) => {
      const dl  = daysLeft(f.DeadlineDate);
      const st  = deriveStatus(dl);
      const sc  = statusColor(st);
      const isFirst = fi === 0;

      tableRows.push([
        // #
        { text: String(seq++), fontSize:7.5, color:'#9CA3AF', alignment:'center', margin:[0,2,0,0] },
        // Client — only show name/ID on first form row of each client block
        {
          stack: [
            { text: isFirst ? r.clientName : '',
              fontSize:8.5, bold:true, color: NAVY },
            isFirst && r.client?.ClientID
              ? { text: r.client.ClientID, fontSize:7, color: MUTED, margin:[0,1,0,0] }
              : {},
          ],
        },
        // Period — only on first form row
        { text: isFirst ? r.periodLabel : '', fontSize:8, color:MUTED, margin:[0,2,0,0] },
        // Form code — bold amber badge feel
        { text: f.FormCode, fontSize:8, bold:true, color:'#B45309', alignment:'center', margin:[0,2,0,0] },
        // Form name
        { text: f.FormName || f.FormCode, fontSize:8, color:'#374151' },
        // Deadline
        { text: fmtDate(f.DeadlineDate), fontSize:8, color: MUTED, alignment:'center', margin:[0,2,0,0] },
        // Days left
        { text: fmtDl(dl), fontSize:8, bold:true, color: sc, alignment:'center', margin:[0,2,0,0] },
        // Status pill (text only — pdfmake has no border-radius chips)
        { text: st === 'Pending' ? 'To Be Filed' : st, fontSize:7.5, bold:true, color: sc, alignment:'center', margin:[0,2,0,0] },
      ]);
    });

    // Thin separator row between each client block (skip last)
    if (ri < pendingRows.length - 1) {
      tableRows.push([
        { text:'', colSpan:8, border:[false,true,false,false],
          borderColor:[BORDER,BORDER,BORDER,BORDER], margin:[0,1,0,1] },
        {},{},{},{},{},{},{},
      ]);
    }
  });

  return {
    pageSize:        'A4',
    pageOrientation: 'landscape',
    pageMargins:     [32, 52, 32, 44],

    // ── Page header ──────────────────────────────────────────
    header: (currentPage, pageCount) => ({
      columns: [
        { text: 'SCL — Pending for Filing Report', fontSize:7.5, bold:true, color:NAVY, margin:[32,18,0,0] },
        { text: `Page ${currentPage} of ${pageCount}`, fontSize:7, color:MUTED, alignment:'right', margin:[0,18,32,0] },
      ],
    }),

    // ── Page footer ──────────────────────────────────────────
    footer: {
      columns: [
        { text:'CONFIDENTIAL — For Internal Use Only', fontSize:7, color:MUTED, italics:true, margin:[32,0,0,0] },
        { text:`Generated: ${generatedAt}`, fontSize:7, color:MUTED, alignment:'right', margin:[0,0,32,0] },
      ],
    },

    content: [
      // ── Letterhead ─────────────────────────────────────────
      {
        columns: [
          {
            stack: [
              { text:'SCL', fontSize:30, bold:true, color:NAVY, characterSpacing:5 },
              { text:'SANTOS · CABELLO · LIZA', fontSize:8, color:'#3B82F6', characterSpacing:2, margin:[2,2,0,0] },
              { text:'Certified Public Accountants', fontSize:7, color:MUTED, italics:true, margin:[2,1,0,0] },
            ],
            width:'*',
          },
          {
            stack: [
              { text:'PENDING FOR FILING', fontSize:18, bold:true, color:NAVY, alignment:'right' },
              { text:`As of ${generatedAt}`, fontSize:8, color:MUTED, alignment:'right', margin:[0,4,0,0] },
            ],
            alignment:'right',
          },
        ],
        margin:[0,0,0,8],
      },

      // ── Double rule ────────────────────────────────────────
      { canvas:[{ type:'rect', x:0, y:0, w:778, h:2.5, color:NAVY }] },
      { canvas:[{ type:'rect', x:0, y:0, w:778, h:1.5, color:'#3B82F6' }], margin:[0,2,0,12] },

      // ── Summary boxes ──────────────────────────────────────
      {
        columns: [
          summaryBox(overdueCount, 'Overdue Clients',  '#FEF2F2', RED),
          summaryBox(urgentCount,  'Urgent (≤7 days)', '#FFFBEB', AMBER),
          summaryBox(totalClients - overdueCount - urgentCount, 'Pending Clients', '#EFF6FF', BLUE),
          summaryBox(totalForms,   'Total Forms Due',  '#F0FDF4', GREEN),
        ],
        columnGap: 8,
        margin: [0,0,0,16],
      },

      // ── Main table ─────────────────────────────────────────
      {
        table: {
          headerRows: 1,
          widths: [16, 130, 48, 44, '*', 62, 52, 52],
          body: tableRows,
        },
        layout: {
          hLineWidth: (i, node) =>
            i===0||i===1||i===node.table.body.length ? 0.5 : 0.25,
          vLineWidth: () => 0,
          hLineColor: (i) => i===1 ? NAVY : BORDER,
          fillColor:  (i, node, col) => {
            if (i === 0) return NAVY;
            // Alternate light tint for every other client block — skip separator rows
            return null;
          },
          paddingLeft:   () => 6,
          paddingRight:  () => 6,
          paddingTop:    (i) => i===0 ? 7 : 4,
          paddingBottom: (i) => i===0 ? 7 : 4,
        },
      },
    ],

    styles: {
      th: { fontSize:8, bold:true, color:WHITE, alignment:'left' },
    },

    defaultStyle: { font:'Roboto', lineHeight:1.3 },
  };
}

// ── Summary box helper ────────────────────────────────────────
function summaryBox(count, label, bgColor, textColor) {
  return {
    stack: [
      { text: String(count), fontSize:22, bold:true, color:textColor, alignment:'center' },
      { text: label, fontSize:7.5, color:textColor, alignment:'center', margin:[0,2,0,0] },
    ],
    fillColor: bgColor,
    margin: [0,0,0,0],
  };
}

// ─────────────────────────────────────────────────────────────
// CONTROLLER
// ─────────────────────────────────────────────────────────────
const getPendingFilingReport = async (req, res) => {
  try {
    // 1. Fetch all monitor records with their details and client info
    //    Adjust this query to match your actual table/column names
    const [monitors] = await db.query(`
      SELECT
        mh.ID,
        mh.ClientID,
        mh.PeriodType,
        mh.PeriodYear,
        mh.PeriodMonth,
        mh.PeriodQuarter,
        c.TradeName,
        c.LNF,
        c.ClientID   AS ClientCode,
        c.Type       AS ClientType,
        md.ID        AS DetailID,
        md.FormCode,
        md.FormName,
        md.Category,
        md.DueSchedule,
        md.StartOfFiling,
        md.DeadlineDate,
        md.IsFiled,
        md.FiledDate,
        md.FiledBy,
        md.Remarks   AS DetailRemarks
      FROM tblmonitorhdr mh
      JOIN tblclients    c  ON c.ID = mh.ClientID
      JOIN tblmonitordtl md ON md.MonitorHdrID = mh.ID
      WHERE md.IsFiled = 0
      ORDER BY mh.ID, md.FormCode
    `);

    // 2. Group into the same shape the frontend uses
    const monitorMap = new Map();
    for (const row of monitors) {
      if (!monitorMap.has(row.ID)) {
        monitorMap.set(row.ID, {
          ID:            row.ID,
          ClientID:      row.ClientID,
          PeriodType:    row.PeriodType,
          PeriodYear:    row.PeriodYear,
          PeriodMonth:   row.PeriodMonth,
          PeriodQuarter: row.PeriodQuarter,
          Client: {
            TradeName: row.TradeName,
            LNF:       row.LNF,
            ClientID:  row.ClientCode,
            Type:      row.ClientType,
          },
          forms: [],
        });
      }
      const m = monitorMap.get(row.ID);
      const deadline = computeDeadline(row.FormCode, row.PeriodYear, row.PeriodMonth, row.PeriodQuarter)
                    || row.DeadlineDate || '';
      const dl = daysLeft(deadline);
      m.forms.push({
        ID:            row.DetailID,
        FormCode:      row.FormCode,
        FormName:      row.FormName   || row.FormCode,
        Category:      row.Category   || 'Other',
        DueSchedule:   row.DueSchedule,
        StartOfFiling: row.StartOfFiling,
        DeadlineDate:  deadline,
        IsFiled:       row.IsFiled,
        status:        deriveStatus(dl),
      });
    }

    // 3. Build sorted pending rows
    const pendingRows = [];
    for (const m of monitorMap.values()) {
      if (!m.forms.length) continue;
      m.forms.sort((a,b) => new Date(a.DeadlineDate)-new Date(b.DeadlineDate));
      const worstStatus = m.forms.some(f=>f.status==='Overdue') ? 'Overdue'
                        : m.forms.some(f=>f.status==='Urgent')  ? 'Urgent' : 'Pending';
      pendingRows.push({
        monitorId:   m.ID,
        client:      m.Client,
        clientName:  m.Client.TradeName || m.Client.LNF || '—',
        periodLabel: periodLabel(m),
        periodType:  m.PeriodType,
        forms:       m.forms,
        worstStatus,
        nearestDl:   daysLeft(m.forms[0].DeadlineDate),
      });
    }

    pendingRows.sort((a,b) => {
      const ord = { Overdue:0, Urgent:1, Pending:2 };
      if (ord[a.worstStatus] !== ord[b.worstStatus]) return ord[a.worstStatus]-ord[b.worstStatus];
      return a.nearestDl - b.nearestDl;
    });

    // 4. Generate PDF
    const docDef  = buildDocDef(pendingRows, fmtNow());
    const pdfDoc  = printer.createPdfKitDocument(docDef);
    const chunks  = [];

    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition',
        `attachment; filename="pending-filing-${new Date().toISOString().slice(0,10)}.pdf"`);
      res.setHeader('Content-Length', result.length);
      res.end(result);
    });
    pdfDoc.on('error', (err) => {
      console.error('pdfmake error:', err);
      res.status(500).json({ message: 'PDF generation failed', error: err.message });
    });

    pdfDoc.end();

  } catch (err) {
    console.error('getPendingFilingReport error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getPendingFilingReport };