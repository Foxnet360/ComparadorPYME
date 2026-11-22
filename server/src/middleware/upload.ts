import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir =
  process.env.NODE_ENV === 'production' ? '/tmp/uploads' : path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export function sanitizeUploadFieldname(fieldname: string): string {
  const sanitized = (fieldname || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return sanitized || 'file';
}

export function validatePdfMagicBytes(filePath: string): boolean {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(5);
    const bytesRead = fs.readSync(fd, header, 0, 5, 0);
    return bytesRead === 5 && header.toString('ascii') === '%PDF-';
  } catch {
    return false;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Ignore close errors
      }
    }
  }
}

const pdfFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (file.mimetype === 'application/pdf' && ext === '.pdf') {
    cb(null, true);
    return;
  }
  cb(new Error('Only PDF files are allowed'));
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeField = sanitizeUploadFieldname(file.fieldname);
    const ext = path.extname(file.originalname || '').toLowerCase() === '.pdf' ? '.pdf' : '';
    cb(null, `${safeField}-${uniqueSuffix}${ext}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB
    files: 25,
  },
  fileFilter: pdfFileFilter,
});

export const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
    files: 25,
  },
  fileFilter: pdfFileFilter,
});
