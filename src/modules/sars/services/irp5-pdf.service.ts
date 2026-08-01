import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

interface IRP5Certificate {
  id: string;
  tax_period_id: string;
  tax_year: string;
  employee_id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  id_number: string;
  passport_number: string;
  tax_number: string;
  employer_name: string;
  employer_tax_number: string;
  employer_paye_number: string;
  // Income codes (3601-3920)
  income_from_employment: number;
  annual_bonus: number;
  overtime: number;
  allowances: number;
  commission: number;
  // Fringe benefits (3801-3825)
  company_car_fringe_benefit: number;
  other_taxable_benefits: number;
  // Deductions (4001-4149)
  pension_fund_contributions: number;
  retirement_annuity_contributions: number;
  medical_aid_contributions: number;
  // Tax (4101-4118)
  paye_deducted: number;
  uif_deducted: number;
  // Totals
  total_remuneration: number;
  taxable_income: number;
  total_tax: number;
}

@Injectable()
export class IRP5PdfService {
  /**
   * Generate IRP5 certificate as PDF buffer
   */
  async generateIRP5PDF(certificate: IRP5Certificate): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      // Collect PDF data
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Generate PDF content
      this.buildIRP5Document(doc, certificate);

      // Finalize PDF
      doc.end();
    });
  }

  /**
   * Generate multiple IRP5 certificates as a single PDF
   */
  async generateBulkIRP5PDF(certificates: IRP5Certificate[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Generate each certificate
      certificates.forEach((cert, index) => {
        if (index > 0) {
          doc.addPage();
        }
        this.buildIRP5Document(doc, cert);
      });

      doc.end();
    });
  }

  /**
   * Build IRP5 document content
   */
  private buildIRP5Document(doc: PDFKit.PDFDocument, cert: IRP5Certificate) {
    const pageWidth = doc.page.width - 100; // Account for margins

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('IRP5/IT3(a) CERTIFICATE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(`Tax Year: ${cert.tax_year}`, { align: 'center' });
    doc.moveDown(1);

    // Employer Details Section
    this.drawSection(doc, 'EMPLOYER DETAILS');
    this.drawField(doc, 'Employer Name', cert.employer_name);
    this.drawField(doc, 'Tax Reference Number', cert.employer_tax_number);
    this.drawField(doc, 'PAYE Reference Number', cert.employer_paye_number);
    doc.moveDown(1);

    // Employee Details Section
    this.drawSection(doc, 'EMPLOYEE DETAILS');
    this.drawField(doc, 'Employee Number', cert.employee_number);
    this.drawField(doc, 'Name', `${cert.first_name} ${cert.last_name}`);
    this.drawField(doc, 'ID Number', cert.id_number || cert.passport_number);
    this.drawField(doc, 'Tax Number', cert.tax_number);
    doc.moveDown(1);

    // Income Section (3601-3699)
    this.drawSection(doc, 'INCOME FROM EMPLOYMENT (Code 3600 series)');
    this.drawAmountField(doc, '3601', 'Income from Employment', cert.income_from_employment);
    if (cert.annual_bonus > 0) {
      this.drawAmountField(doc, '3605', 'Annual Bonus', cert.annual_bonus);
    }
    if (cert.overtime > 0) {
      this.drawAmountField(doc, '3607', 'Overtime', cert.overtime);
    }
    if (cert.allowances > 0) {
      this.drawAmountField(doc, '3701', 'Allowances', cert.allowances);
    }
    if (cert.commission > 0) {
      this.drawAmountField(doc, '3703', 'Commission', cert.commission);
    }
    doc.moveDown(0.5);

    // Fringe Benefits Section (3801-3825)
    if (cert.company_car_fringe_benefit > 0 || cert.other_taxable_benefits > 0) {
      this.drawSection(doc, 'FRINGE BENEFITS (Code 3800 series)');
      if (cert.company_car_fringe_benefit > 0) {
        this.drawAmountField(doc, '3801', 'Company Car', cert.company_car_fringe_benefit);
      }
      if (cert.other_taxable_benefits > 0) {
        this.drawAmountField(doc, '3810', 'Other Taxable Benefits', cert.other_taxable_benefits);
      }
      doc.moveDown(0.5);
    }

    // Deductions Section (4001-4149)
    this.drawSection(doc, 'DEDUCTIONS (Code 4000 series)');
    if (cert.pension_fund_contributions > 0) {
      this.drawAmountField(doc, '4001', 'Pension Fund Contributions', cert.pension_fund_contributions);
    }
    if (cert.retirement_annuity_contributions > 0) {
      this.drawAmountField(doc, '4002', 'Retirement Annuity Contributions', cert.retirement_annuity_contributions);
    }
    if (cert.medical_aid_contributions > 0) {
      this.drawAmountField(doc, '4005', 'Medical Aid Contributions', cert.medical_aid_contributions);
    }
    doc.moveDown(0.5);

    // Tax Deductions Section (4101-4118)
    this.drawSection(doc, 'TAX DEDUCTIONS (Code 4100 series)');
    this.drawAmountField(doc, '4101', 'PAYE Deducted', cert.paye_deducted);
    if (cert.uif_deducted > 0) {
      this.drawAmountField(doc, '4102', 'UIF Deducted', cert.uif_deducted);
    }
    doc.moveDown(1);

    // Totals Section
    this.drawSection(doc, 'TOTALS', true);
    doc.moveDown(0.3);

    const totalsY = doc.y;
    doc.fontSize(11).font('Helvetica-Bold');

    this.drawTotalField(doc, 'Total Remuneration:', cert.total_remuneration);
    this.drawTotalField(doc, 'Taxable Income:', cert.taxable_income);
    this.drawTotalField(doc, 'Total Tax:', cert.total_tax);

    // Footer
    doc.moveDown(2);
    doc.fontSize(9).font('Helvetica-Oblique')
       .text('This is a computer-generated document. No signature required.', { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica')
       .text(`Generated on: ${new Date().toLocaleDateString('en-ZA')}`, { align: 'center' });

    doc.fontSize(8)
       .text(`Certificate ID: ${cert.id}`, { align: 'center' });
  }

  /**
   * Draw section header
   */
  private drawSection(doc: PDFKit.PDFDocument, title: string, highlighted: boolean = false) {
    const currentY = doc.y;

    if (highlighted) {
      doc.rect(50, currentY - 2, doc.page.width - 100, 20)
         .fillAndStroke('#e3f2fd', '#1976d2')
         .fill('#000000'); // Reset fill color
    } else {
      doc.rect(50, currentY - 2, doc.page.width - 100, 18)
         .fillAndStroke('#f5f5f5', '#cccccc')
         .fill('#000000');
    }

    doc.fontSize(10).font('Helvetica-Bold')
       .fillColor('#000000')
       .text(title, 55, currentY, { continued: false });

    doc.moveDown(0.8);
  }

  /**
   * Draw field with label and value
   */
  private drawField(doc: PDFKit.PDFDocument, label: string, value: string) {
    const currentY = doc.y;
    doc.fontSize(9).font('Helvetica-Bold').text(`${label}:`, 55, currentY, { width: 200, continued: false });
    doc.fontSize(9).font('Helvetica').text(value || 'N/A', 260, currentY, { width: 300 });
    doc.moveDown(0.5);
  }

  /**
   * Draw amount field with code
   */
  private drawAmountField(doc: PDFKit.PDFDocument, code: string, label: string, amount: number) {
    if (amount === 0) return;

    const currentY = doc.y;
    const formattedAmount = this.formatCurrency(amount);

    doc.fontSize(9).font('Helvetica').text(code, 55, currentY, { width: 50 });
    doc.fontSize(9).font('Helvetica').text(label, 110, currentY, { width: 300 });
    doc.fontSize(9).font('Helvetica-Bold').text(formattedAmount, 420, currentY, { width: 140, align: 'right' });

    doc.moveDown(0.4);
  }

  /**
   * Draw total field (larger font, bold)
   */
  private drawTotalField(doc: PDFKit.PDFDocument, label: string, amount: number) {
    const currentY = doc.y;
    const formattedAmount = this.formatCurrency(amount);

    doc.fontSize(11).font('Helvetica-Bold').text(label, 55, currentY, { width: 350 });
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1976d2')
       .text(formattedAmount, 420, currentY, { width: 140, align: 'right' });
    doc.fillColor('#000000'); // Reset color

    doc.moveDown(0.6);
  }

  /**
   * Format currency (South African Rand)
   */
  private formatCurrency(amount: number): string {
    return `R ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
  }

  /**
   * Generate IRP5 as stream (for direct download)
   */
  async generateIRP5Stream(certificate: IRP5Certificate): Promise<Readable> {
    const buffer = await this.generateIRP5PDF(certificate);
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
  }
}
