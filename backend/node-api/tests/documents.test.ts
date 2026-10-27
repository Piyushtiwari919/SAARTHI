import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  detectMimeTypeFromMagicBytes,
  isMagicByteValid,
} from '../src/utils/file-signature.js';
import { LocalStorageProvider } from '../src/storage/local-storage.provider.js';

describe('Document Upload & Security Unit Tests', () => {
  const testStorageDir = path.resolve(process.cwd(), './tmp-test-storage');

  beforeEach(() => {
    if (!fs.existsSync(testStorageDir)) {
      fs.mkdirSync(testStorageDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  describe('Magic Byte File Signature Validation', () => {
    it('Accurately identifies valid PDF files by header bytes (%PDF-)', () => {
      const pdfHeader = Buffer.from('%PDF-1.7\nSample content');
      const mime = detectMimeTypeFromMagicBytes(pdfHeader);
      expect(mime).toBe('application/pdf');
      expect(isMagicByteValid(pdfHeader, 'application/pdf')).toBe(true);
    });

    it('Accurately identifies valid PNG files by header bytes (\\x89PNG)', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      const mime = detectMimeTypeFromMagicBytes(pngHeader);
      expect(mime).toBe('image/png');
      expect(isMagicByteValid(pngHeader, 'image/png')).toBe(true);
    });

    it('Accurately identifies valid JPEG files by header bytes (\\xFF\\xD8\\xFF)', () => {
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const mime = detectMimeTypeFromMagicBytes(jpegHeader);
      expect(mime).toBe('image/jpeg');
      expect(isMagicByteValid(jpegHeader, 'image/jpeg')).toBe(true);
    });

    it('Detects and rejects disguised malicious files (e.g. executable renamed as .pdf)', () => {
      // Windows PE executable header MZ
      const fakePdf = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
      const mime = detectMimeTypeFromMagicBytes(fakePdf);
      expect(mime).toBeNull();
      expect(isMagicByteValid(fakePdf, 'application/pdf')).toBe(false);
    });

    it('Rejects corrupt or empty buffers below minimum signature length', () => {
      const emptyBuffer = Buffer.alloc(0);
      expect(detectMimeTypeFromMagicBytes(emptyBuffer)).toBeNull();
      expect(isMagicByteValid(emptyBuffer, 'application/pdf')).toBe(false);
    });
  });

  describe('Storage Security & Path Traversal Prevention', () => {
    it('Saves and retrieves a file with opaque UUID key', async () => {
      const provider = new LocalStorageProvider(testStorageDir);
      const testBuffer = Buffer.from('Test document stream contents');
      const key = 'doc_test_12345.pdf';

      await provider.putObject(key, testBuffer, 'application/pdf');

      const exists = await provider.objectExists(key);
      expect(exists).toBe(true);

      const stream = await provider.getObjectStream(key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const readBuffer = Buffer.concat(chunks);
      expect(readBuffer.toString()).toBe('Test document stream contents');

      await provider.deleteObject(key);
      const existsAfterDelete = await provider.objectExists(key);
      expect(existsAfterDelete).toBe(false);
    });

    it('Prevents path traversal attacks with relative path components (../)', async () => {
      const provider = new LocalStorageProvider(testStorageDir);
      const maliciousKey = '../../etc/passwd';
      const testBuffer = Buffer.from('Malicious data');

      await expect(provider.putObject(maliciousKey, testBuffer, 'text/plain')).rejects.toThrow();
      await expect(provider.getObjectStream(maliciousKey)).rejects.toThrow();
      await expect(provider.deleteObject(maliciousKey)).rejects.toThrow();
    });
  });
});

