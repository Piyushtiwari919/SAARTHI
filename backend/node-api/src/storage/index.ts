import { env } from '../config/env.js';
import { StorageProvider } from './storage.interface.js';
import { LocalPrivateStorageProvider } from './local-storage.provider.js';
import { S3StorageProvider } from './s3-storage.provider.js';

let storageInstance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (storageInstance) {
    return storageInstance;
  }

  if (env.STORAGE_DRIVER === 's3') {
    if (!env.AWS_S3_BUCKET) {
      throw new Error('STORAGE_DRIVER is s3 but AWS_S3_BUCKET is not set');
    }
    storageInstance = new S3StorageProvider({
      region: env.AWS_REGION || 'ap-south-1',
      bucket: env.AWS_S3_BUCKET,
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    });
  } else {
    storageInstance = new LocalPrivateStorageProvider(env.RESOLVED_LOCAL_STORAGE_DIR);
  }

  return storageInstance;
}

