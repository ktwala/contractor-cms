#!/usr/bin/env node
/**
 * Generate a professional PDF payslip for Boitumelo Lefaphana – January 2026
 * Data sourced from payslip-Boitumelo-Lefaphana-Jan2026.html
 *
 * Usage: node scripts/generate-payslip-pdf.js
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ── Data (matches the Jan 2026 HTML payslip exactly) ─────────────────
const data = {
    company: {
        name: 'HUBSEC SOLUTIONS PTY LTD',
        address: 'Qoatsaneng Near IEMS, Maseru, 100',
        regNo: '2024/001234/07',
    },
    employee: {
        name: 'Boitumelo Lefaphana',
        number: '482003',
        department: 'Consulting',
        jobTitle: 'Identity & Access Management Analyst (Junior)',
        taxRef: '—',
    },
    period: {
        label: '2026-01-01 to 2026-01-31',
        payDate: '2026-01-30',
        frequency: 'Monthly',
        number: 1,
        taxYear: '2026',
    },
    earnings: [
        { desc: 'Basic Salary', units: 1, rate: 9000.00, amount: 9000.00 },
    ],
    totalEarnings: 9000.00,
    deductions: [
        { desc: 'PAYE (Income Tax) *', amount: 1113.00 },
    ],
    totalDeductions: 1113.00,
    netPay: 7887.00,
    ytd: { gross: 9000.00, paye: 1113.00, net: 7887.00 },
    payment: { bank: 'Standard Lesotho Bank', account: '****7323' },
};

// ── Helpers ──────────────────────────────────────────────────────────
const fmt = (n) =>
    n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Colours ─────────────────────────────────────────────────────────
const C = {
    navy: '#0d1b3e',
    accent: '#1a3060',
    headerBg: '#e8edf5',
    sectionBg: '#f4f6f9',
    border: '#c0c8d4',
    text: '#1a1a1a',
    muted: '#6b7280',
    green: '#16a34a',
    white: '#ffffff',
    softBlue: '#a8bfdf',
};

// ── Logo path ───────────────────────────────────────────────────────
const logoPath = path.join(__dirname, '..', 'assets', 'hubsec-logo.png');
const hasLogo = fs.existsSync(logoPath);

// ── Build PDF ───────────────────────────────────────────────────────
const outFile = path.join(__dirname, '..', 'payslip-Boitumelo-Lefaphana-Jan2026.pdf');
const doc = new PDFDocument({ size: 'A4', margin: 40 });
doc.pipe(fs.createWriteStream(outFile));

const PW = doc.page.width;
const M = 40;            // margin
const W = PW - M * 2;    // usable width
let y = M;

// ═══════════════════════════════════════════════════════════════════
// HEADER  – navy band with logo + title
// ═══════════════════════════════════════════════════════════════════
doc.rect(M, y, W, 64).fill(C.navy);

if (hasLogo) {
    doc.image(logoPath, M + 12, y + 12, { height: 40 });
}

doc.fontSize(18).fill(C.white).font('Helvetica-Bold')
    .text(data.company.name, M + (hasLogo ? 65 : 12), y + 12);
doc.fontSize(8).fill(C.softBlue).font('Helvetica')
    .text(data.company.address, M + (hasLogo ? 65 : 12), y + 34);

doc.fontSize(16).fill(C.white).font('Helvetica-Bold')
    .text('PAYSLIP', M, y + 14, { width: W - 12, align: 'right' });
doc.fontSize(8).fill(C.softBlue).font('Helvetica')
    .text(`Reg. ${data.company.regNo}`, M, y + 36, { width: W - 12, align: 'right' });

y += 74;

// ═══════════════════════════════════════════════════════════════════
// PAY PERIOD BAR
// ═══════════════════════════════════════════════════════════════════
doc.rect(M, y, W, 22).fill(C.headerBg);
doc.fontSize(8).fill(C.accent).font('Helvetica-Bold');
doc.text(`Pay Period:`, M + 10, y + 6);
doc.font('Helvetica').text(data.period.label, M + 72, y + 6);
doc.font('Helvetica-Bold').text(`Pay Date:`, M + 230, y + 6);
doc.font('Helvetica').text(data.period.payDate, M + 280, y + 6);
doc.font('Helvetica-Bold').text(`Frequency:`, M + 380, y + 6);
doc.font('Helvetica').text(data.period.frequency, M + 435, y + 6);
y += 30;

// ═══════════════════════════════════════════════════════════════════
// HELPER: section header
// ═══════════════════════════════════════════════════════════════════
function section(title) {
    doc.rect(M, y, W, 20).fill(C.accent);
    doc.fontSize(9).fill(C.white).font('Helvetica-Bold').text(title, M + 10, y + 5);
    doc.font('Helvetica');
    y += 24;
}

function labelValue(lbl, val, x) {
    doc.fontSize(8).fill(C.muted).text(lbl, x, y);
    doc.fontSize(9).fill(C.text).text(val, x + 95, y);
}

// ═══════════════════════════════════════════════════════════════════
// EMPLOYEE DETAILS
// ═══════════════════════════════════════════════════════════════════
section('EMPLOYEE DETAILS');
labelValue('Name:', data.employee.name, M + 10);
labelValue('Employee #:', data.employee.number, M + W / 2);
y += 16;
labelValue('Department:', data.employee.department, M + 10);
labelValue('Job Title:', data.employee.jobTitle, M + W / 2);
y += 16;
labelValue('Tax Reference:', data.employee.taxRef, M + 10);
y += 20;

// ═══════════════════════════════════════════════════════════════════
// EARNINGS TABLE
// ═══════════════════════════════════════════════════════════════════
section('EARNINGS');

// column header
doc.rect(M, y, W, 16).fill(C.sectionBg);
doc.fontSize(7.5).fill(C.muted).font('Helvetica-Bold');
doc.text('Description', M + 10, y + 4);
doc.text('Units', M + 250, y + 4, { width: 60, align: 'right' });
doc.text('Rate (M)', M + 320, y + 4, { width: 80, align: 'right' });
doc.text('Amount (M)', M + 410, y + 4, { width: 80, align: 'right' });
doc.font('Helvetica');
y += 20;

data.earnings.forEach((e) => {
    doc.fontSize(9).fill(C.text);
    doc.text(e.desc, M + 10, y);
    doc.text(String(e.units), M + 250, y, { width: 60, align: 'right' });
    doc.text(fmt(e.rate), M + 320, y, { width: 80, align: 'right' });
    doc.text(fmt(e.amount), M + 410, y, { width: 80, align: 'right' });
    y += 16;
});

// total earnings
doc.rect(M, y, W, 18).fill(C.headerBg);
doc.fontSize(9).fill(C.accent).font('Helvetica-Bold');
doc.text('Total Earnings', M + 10, y + 4);
doc.text(`M ${fmt(data.totalEarnings)}`, M + 410, y + 4, { width: 80, align: 'right' });
doc.font('Helvetica');
y += 26;

// ═══════════════════════════════════════════════════════════════════
// DEDUCTIONS TABLE
// ═══════════════════════════════════════════════════════════════════
section('DEDUCTIONS');

doc.rect(M, y, W, 16).fill(C.sectionBg);
doc.fontSize(7.5).fill(C.muted).font('Helvetica-Bold');
doc.text('Description', M + 10, y + 4);
doc.text('Amount (M)', M + 410, y + 4, { width: 80, align: 'right' });
doc.font('Helvetica');
y += 20;

data.deductions.forEach((d) => {
    doc.fontSize(9).fill(C.text);
    doc.text(d.desc, M + 10, y);
    doc.text(fmt(d.amount), M + 410, y, { width: 80, align: 'right' });
    y += 16;
});

doc.rect(M, y, W, 18).fill(C.headerBg);
doc.fontSize(9).fill(C.accent).font('Helvetica-Bold');
doc.text('Total Deductions', M + 10, y + 4);
doc.text(`M ${fmt(data.totalDeductions)}`, M + 410, y + 4, { width: 80, align: 'right' });
doc.font('Helvetica');
y += 6;

// statutory note
y += 16;
doc.fontSize(7).fill(C.muted).text('* Statutory deductions', M + 10, y);
y += 18;

// ═══════════════════════════════════════════════════════════════════
// NET PAY SUMMARY BAND
// ═══════════════════════════════════════════════════════════════════
doc.rect(M, y, W, 58).fill(C.navy);
const col = W / 3;

doc.fontSize(8).fill(C.softBlue).font('Helvetica').text('Gross Pay', M + 16, y + 10);
doc.fontSize(18).fill(C.white).font('Helvetica-Bold').text(`M ${fmt(data.totalEarnings)}`, M + 16, y + 26);

doc.fontSize(8).fill(C.softBlue).font('Helvetica').text('Total Deductions', M + col + 16, y + 10);
doc.fontSize(18).fill(C.white).font('Helvetica-Bold').text(`M ${fmt(data.totalDeductions)}`, M + col + 16, y + 26);

doc.fontSize(8).fill(C.softBlue).font('Helvetica').text('Net Pay', M + col * 2 + 16, y + 10);
doc.fontSize(20).fill('#4ade80').font('Helvetica-Bold').text(`M ${fmt(data.netPay)}`, M + col * 2 + 16, y + 24);

doc.font('Helvetica');
y += 68;

// ═══════════════════════════════════════════════════════════════════
// YEAR-TO-DATE
// ═══════════════════════════════════════════════════════════════════
section('YEAR-TO-DATE');

doc.rect(M, y, W, 16).fill(C.sectionBg);
doc.fontSize(7.5).fill(C.muted).font('Helvetica-Bold');
doc.text('YTD Gross', M + 10, y + 4);
doc.text('YTD PAYE', M + 180, y + 4);
doc.text('YTD Net', M + 410, y + 4, { width: 80, align: 'right' });
doc.font('Helvetica');
y += 18;

doc.fontSize(9).fill(C.text);
doc.text(`M ${fmt(data.ytd.gross)}`, M + 10, y);
doc.text(`M ${fmt(data.ytd.paye)}`, M + 180, y);
doc.font('Helvetica-Bold').text(`M ${fmt(data.ytd.net)}`, M + 410, y, { width: 80, align: 'right' });
doc.font('Helvetica');
y += 24;

// ═══════════════════════════════════════════════════════════════════
// PAYMENT DETAILS
// ═══════════════════════════════════════════════════════════════════
section('PAYMENT DETAILS');
labelValue('Bank:', data.payment.bank, M + 10);
labelValue('Account:', data.payment.account, M + W / 2);
y += 24;

// ═══════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════
doc.moveTo(M, y).lineTo(M + W, y).strokeColor(C.border).lineWidth(0.5).stroke();
y += 12;
doc.fontSize(7).fill(C.muted)
    .text('This is a computer-generated payslip. Please retain for your records.', M, y, { width: W, align: 'center' });
y += 12;
doc.text(`Generated: ${new Date().toISOString().split('T')[0]}  |  Period ${data.period.number} of Tax Year ${data.period.taxYear}`, M, y, { width: W, align: 'center' });
y += 12;
doc.text('CONFIDENTIAL — For the named employee only', M, y, { width: W, align: 'center' });

doc.end();
console.log(`✅ PDF payslip generated: ${outFile}`);
