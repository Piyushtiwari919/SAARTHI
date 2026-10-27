export type SupportedMimeType = 'application/pdf' | 'image/png' | 'image/jpeg';

export function detectFileSignature(buffer: Buffer): {
  isValid: boolean;
  detectedMime?: SupportedMimeType;
  extension?: string;
} {
  if (!buffer || buffer.length < 4) {
    return { isValid: false };
  }

  // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { isValid: true, detectedMime: 'application/pdf', extension: 'pdf' };
  }

  // PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, detectedMime: 'image/png', extension: 'png' };
  }

  // JPEG magic bytes: 0xFF 0xD8 0xFF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { isValid: true, detectedMime: 'image/jpeg', extension: 'jpg' };
  }

  return { isValid: false };
}

export function detectMimeTypeFromMagicBytes(buffer: Buffer): SupportedMimeType | null {
  const result = detectFileSignature(buffer);
  return result.isValid && result.detectedMime ? result.detectedMime : null;
}

export function isMagicByteValid(buffer: Buffer, claimedMime: string): boolean {
  const result = detectFileSignature(buffer);
  if (!result.isValid || !result.detectedMime) return false;
  return result.detectedMime === claimedMime;
}
