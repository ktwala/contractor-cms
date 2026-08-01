import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const ALLOWED_EXT = new Set(['pdf', 'doc', 'docx']);
const MAX_BYTES = 15 * 1024 * 1024;

@Injectable()
export class RecruitmentFilesService {
  private uploadsRoot(): string {
    return join(process.cwd(), 'uploads', 'recruitment');
  }

  async saveUploadedFile(file: Express.Multer.File): Promise<{
    stored_path: string;
    original_filename: string;
    mime_type: string;
    size_bytes: number;
  }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('File exceeds maximum size (15MB)');
    }
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXT.has(ext)) {
      throw new BadRequestException('Only PDF and Word documents (.pdf, .doc, .docx) are allowed');
    }
    const safeBase = file.originalname
      .replace(/[^\w.\-()+ ]/g, '_')
      .slice(0, 120);
    const unique = `${Date.now()}_${randomBytes(6).toString('hex')}`;
    const filename = `${unique}_${safeBase || `upload.${ext}`}`;

    const dir = this.uploadsRoot();
    await fs.mkdir(dir, { recursive: true });
    const absolutePath = join(dir, filename);
    await fs.writeFile(absolutePath, file.buffer);

    const stored_path = `recruitment/${filename}`;
    return {
      stored_path,
      original_filename: file.originalname,
      mime_type: file.mimetype || 'application/octet-stream',
      size_bytes: file.size,
    };
  }
}
