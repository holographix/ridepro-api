import { FileValidator } from '@nestjs/common';

/**
 * Custom validator for FIT file extensions
 * Checks filename (not MIME type) for .fit or .fit.gz extensions
 */
export class FitFileValidator extends FileValidator {
  buildErrorMessage(): string {
    return 'Only .fit and .fit.gz files are allowed';
  }

  isValid(file?: Express.Multer.File): boolean {
    if (!file) {
      return false;
    }

    const filename = file.originalname.toLowerCase();
    return filename.endsWith('.fit') || filename.endsWith('.fit.gz');
  }
}
