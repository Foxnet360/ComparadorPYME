import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = process.env.NODE_ENV === 'production' 
  ? '/tmp/uploads' 
  : path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB
    files: 10
  },
  fileFilter: (_req, file, cb) => {
    // Check magic numbers for PDF
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
      return;
    }
    
    // Check file extension as fallback
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf') {
      cb(null, true);
      return;
    }
    
    cb(new Error('Only PDF files are allowed'));
  }
});

export const upload = multer({ 
  dest: uploadDir,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
    files: 10
  }
});
