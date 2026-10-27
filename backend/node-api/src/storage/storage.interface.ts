import { Readable } from 'stream';

export interface StorageUploadResult {
  key: string;
  size: number;
}

export interface StorageProvider {
  /**
   * Save a binary buffer into private object storage under an opaque key.
   */
  save(key: string, buffer: Buffer, mimeType: string): Promise<StorageUploadResult>;

  /**
   * Retrieve a readable stream of stored file content.
   */
  getStream(key: string): Promise<Readable>;

  /**
   * Delete an object by key from private storage.
   */
  delete(key: string): Promise<void>;

  /**
   * Check whether an object exists in private storage.
   */
  exists(key: string): Promise<boolean>;
}

