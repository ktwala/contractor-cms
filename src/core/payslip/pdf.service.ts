import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import { PayslipDetailDto } from '../../modules/self-service/dto/self-service.dto';

/**
 * Service to generate professional A4 PDF payslips from payslip data.
 * Uses pdfkit (no browser/puppeteer dependency).
 */
@Injectable()
export class PayslipPdfService {
    // ── Colour Palette ──────────────────────────────────────────────────
    private readonly C = {
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

    /**
     * Generate a PDF payslip and return it as a Buffer.
     */
    async generate(payslip: PayslipDetailDto): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 40 });
                const chunks: Buffer[] = [];

                doc.on('data', (chunk: Buffer) => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                this.buildDocument(doc, payslip);
                doc.end();
            } catch (err) {
                reject(err);
            }
        });
    }

    // ── Build the PDF document ──────────────────────────────────────────
    private buildDocument(doc: PDFKit.PDFDocument, p: PayslipDetailDto): void {
        const C = this.C;
        const M = 40; // margin
        const W = doc.page.width - M * 2;
        let y = M;

        // ─── Header ───────────────────────────────────────────────────────
        const fs = require('fs');
        const path = require('path');
        const logoPath = path.join(process.cwd(), 'assets', 'hubsec-logo.png');
        const hasLogo = fs.existsSync(logoPath);

        if (hasLogo) {
            doc.image(logoPath, M, y + 10, { fit: [100, 25] });
        }

        doc.fontSize(11).fill(C.text).font('Helvetica-Bold')
            .text('PAYSLIP', M, y + 15, { width: W, align: 'right' });
        
        y += 45;

        // Divider Line
        doc.moveTo(M, y).lineTo(M + W, y).strokeColor(C.border).lineWidth(0.5).stroke();
        y += 8;

        // Company Details & Pay Period Info
        doc.fontSize(9.5).fill(C.text).font('Helvetica-Bold')
            .text('HUBSEC SOLUTIONS PTY LTD', M, y);
        
        doc.font('Helvetica-Bold').text('Pay Period: ', M + 260, y, { continued: true })
            .font('Helvetica').text(`${p.period_start} to ${p.period_end}`);

        doc.fontSize(8.5).fill(C.muted).font('Helvetica')
            .text('Qoatsaneng Near IEMS, Maseru, 100', M, y + 14);

        doc.fontSize(9.5).fill(C.text).font('Helvetica-Bold')
            .text('Pay Date: ', M + 260, y + 14, { continued: true })
            .font('Helvetica').text(p.pay_date);

        doc.font('Helvetica-Bold').text('Pay Frequency: ', M + 260, y + 26, { continued: true })
            .font('Helvetica').text(p.pay_frequency || 'Monthly');

        y += 44;

        // ─── Employee Details ─────────────────────────────────────────────
        y = this.sectionHeader(doc, y, W, M, 'Employee Details');
        y = this.fieldRow(doc, y, W, M, 'Name:', p.employee_name, 'Employee #:', p.employee_number);
        y = this.fieldRow(doc, y, W, M, 'Department:', p.department || 'Consulting', 'Job Title:', p.job_title || '—');
        y = this.fieldRow(doc, y, W, M, 'Tax Reference:', p.tax_reference || '—', 'ID Number:', p.id_number || '—');
        y += 8;

        // ─── Earnings Table ───────────────────────────────────────────────
        y = this.sectionHeader(doc, y, W, M, 'Earnings');

        // Column headers
        doc.rect(M, y, W, 16).fill('#f4f6f9');
        doc.fontSize(7.5).fill(C.muted).font('Helvetica-Bold');
        doc.text('Description', M + 10, y + 4);
        doc.text('Units', M + 230, y + 4, { width: 50, align: 'right' });
        doc.text('Rate', M + 300, y + 4, { width: 80, align: 'right' });
        doc.text('Amount (M)', M + 400, y + 4, { width: 90, align: 'right' });
        doc.font('Helvetica');
        y += 20;

        for (const e of p.earnings) {
            doc.fontSize(9).fill(C.text);
            doc.text(e.name, M + 10, y);
            doc.text(e.units ? String(e.units) : '1', M + 230, y, { width: 50, align: 'right' });
            doc.text(e.rate ? this.fmt(e.rate) : this.fmt(e.amount), M + 300, y, { width: 80, align: 'right' });
            doc.text(this.fmt(e.amount), M + 400, y, { width: 90, align: 'right' });
            y += 16;
        }

        // Totals row
        doc.moveTo(M, y).lineTo(M + W, y).strokeColor(C.border).lineWidth(0.5).stroke();
        y += 4;
        doc.fontSize(9).fill(C.accent).font('Helvetica-Bold');
        doc.text('Total Earnings', M + 10, y);
        doc.text(this.fmt(p.gross), M + 400, y, { width: 90, align: 'right' });
        y += 14;
        doc.moveTo(M, y).lineTo(M + W, y).strokeColor(C.border).lineWidth(0.5).stroke();
        y += 12;

        // ─── Deductions Table ─────────────────────────────────────────────
        y = this.sectionHeader(doc, y, W, M, 'Deductions');

        doc.rect(M, y, W, 16).fill('#f4f6f9');
        doc.fontSize(7.5).fill(C.muted).font('Helvetica-Bold');
        doc.text('Description', M + 10, y + 4);
        doc.text('Amount (M)', M + 400, y + 4, { width: 90, align: 'right' });
        doc.font('Helvetica');
        y += 20;

        for (const d of p.deductions) {
            doc.fontSize(9).fill(C.text);
            doc.text(`${d.name} *`, M + 10, y);
            doc.text(this.fmt(d.amount), M + 400, y, { width: 90, align: 'right' });
            y += 16;
        }

        // Totals row
        doc.moveTo(M, y).lineTo(M + W, y).strokeColor(C.border).lineWidth(0.5).stroke();
        y += 4;
        doc.fontSize(9).fill(C.accent).font('Helvetica-Bold');
        doc.text('Total Deductions', M + 10, y);
        doc.text(this.fmt(p.total_deductions), M + 400, y, { width: 90, align: 'right' });
        y += 14;
        doc.moveTo(M, y).lineTo(M + W, y).strokeColor(C.border).lineWidth(0.5).stroke();
        y += 6;
        doc.fontSize(7).fill(C.muted).font('Helvetica').text('* Statutory deductions', M + 10, y);
        y += 18;

        // ─── Net Pay Summary Band ─────────────────────────────────────────
        doc.rect(M, y, W, 44).fill('#f4f6f9');
        const col = W / 3;

        doc.fontSize(7.5).fill(C.muted).font('Helvetica').text('Gross Pay', M + 16, y + 8);
        doc.fontSize(14).fill(C.text).font('Helvetica-Bold').text(`M ${this.fmt(p.gross)}`, M + 16, y + 20);

        doc.fontSize(7.5).fill(C.muted).font('Helvetica').text('Total Deductions', M + col + 16, y + 8);
        doc.fontSize(14).fill(C.text).font('Helvetica-Bold').text(`M ${this.fmt(p.total_deductions)}`, M + col + 16, y + 20);

        doc.fontSize(7.5).fill(C.muted).font('Helvetica').text('Net Pay', M + col * 2 + 16, y + 8);
        doc.fontSize(16).fill(C.green).font('Helvetica-Bold').text(`M ${this.fmt(p.net)}`, M + col * 2 + 16, y + 18);

        doc.font('Helvetica');
        y += 54;

        // ─── Year-to-Date ─────────────────────────────────────────────────
        y = this.sectionHeader(doc, y, W, M, 'Year-to-Date');

        doc.fontSize(8.5).fill(C.text).font('Helvetica-Bold').text('YTD Gross: ', M + 10, y, { continued: true })
            .font('Helvetica').text(`M ${this.fmt(p.ytd_gross)}`);
        doc.font('Helvetica-Bold').text('YTD PAYE: ', M + 180, y, { continued: true })
            .font('Helvetica').text(`M ${this.fmt(p.ytd_paye)}`);
        doc.font('Helvetica-Bold').text('YTD Net: ', M + 350, y, { continued: true })
            .font('Helvetica').text(`M ${this.fmt(p.ytd_net)}`);
        y += 26;

        // ─── Payment Details ──────────────────────────────────────────────
        y = this.sectionHeader(doc, y, W, M, 'Payment Details');
        y = this.fieldRow(doc, y, W, M, 'Bank:', p.bank_name || '—', 'Account:', p.account_number_masked || '—');
        y = this.fieldRow(doc, y, W, M, 'Branch:', p.branch || '—', 'Branch Code:', p.branch_code || '—');
        y += 4;

        // ─── Footer ───────────────────────────────────────────────────────
        doc.moveTo(M, y).lineTo(M + W, y).strokeColor(C.border).lineWidth(0.5).stroke();
        y += 12;
        doc.fontSize(7.5).fill(C.muted)
            .text('This is a computer-generated payslip. Please retain for your records.', M, y, { width: W, align: 'center' });
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private sectionHeader(doc: PDFKit.PDFDocument, y: number, W: number, M: number, title: string): number {
        doc.rect(M, y, W, 18).fill('#f4f6f9');
        doc.fontSize(8.5).fill(this.C.navy).font('Helvetica-Bold').text(title, M + 8, y + 5);
        doc.font('Helvetica');
        return y + 22;
    }

    private fieldRow(doc: PDFKit.PDFDocument, y: number, W: number, M: number,
        lbl1: string, val1: string, lbl2: string, val2: string): number {
        doc.fontSize(8.5).font('Helvetica');
        const colW = W / 2 - 20;
        const h1 = doc.heightOfString(val1 || '—', { width: colW - 85 });
        const h2 = doc.heightOfString(val2 || '—', { width: colW - 85 });
        const rowHeight = Math.max(h1, h2, 12) + 4;

        doc.fill(this.C.text).font('Helvetica-Bold').text(lbl1, M + 10, y);
        doc.font('Helvetica').text(val1 || '—', M + 95, y, { width: colW - 85 });

        doc.font('Helvetica-Bold').text(lbl2, M + W / 2 + 10, y);
        doc.font('Helvetica').text(val2 || '—', M + W / 2 + 95, y, { width: colW - 85 });

        return y + rowHeight;
    }

    private fmt(n: number): string {
        if (n == null) return '0.00';
        return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}
