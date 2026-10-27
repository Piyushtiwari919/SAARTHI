import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { StorageProvider, StorageUploadResult } from './storage.interface.js';

export class LocalPrivateStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    // Ensure storage directory exists
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolvePath(key: string): string {
    if (!key || key.includes('..') || path.isAbsolute(key)) {
      throw new Error(`Invalid storage key: path traversal or invalid characters detected in '${key}'`);
    }
    const safeKey = path.basename(key);
    return path.join(this.baseDir, safeKey);
  }

  public async putObject(key: string, buffer: Buffer, mimeType: string): Promise<StorageUploadResult> {
    return this.save(key, buffer, mimeType);
  }

  public async getObjectStream(key: string): Promise<Readable> {
    return this.getStream(key);
  }

  public async deleteObject(key: string): Promise<void> {
    return this.delete(key);
  }

  public async objectExists(key: string): Promise<boolean> {
    return this.exists(key);
  }

  public async save(key: string, buffer: Buffer, _mimeType: string): Promise<StorageUploadResult> {
    const filePath = this.resolvePath(key);
    await fs.promises.writeFile(filePath, buffer);
    const stats = await fs.promises.stat(filePath);
    return {
      key,
      size: stats.size,
    };
  }

  public async getStream(key: string): Promise<Readable> {
    const filePath = this.resolvePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File with key '${key}' does not exist in local storage`);
    }
    return fs.createReadStream(filePath);
  }

  public async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      console.error(`[LocalStorage] Failed to delete file ${filePath}:`, err);
      throw err;
    }
  }

  public async exists(key: string): Promise<boolean> {
    const filePath = this.resolvePath(key);
    return fs.existsSync(filePath);
  }
}

export { LocalPrivateStorageProvider as LocalStorageProvider };
