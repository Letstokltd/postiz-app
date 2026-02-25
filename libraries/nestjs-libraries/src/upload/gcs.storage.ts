import { Storage } from '@google-cloud/storage';
import 'multer';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import mime from 'mime-types';
// @ts-ignore
import { getExtension } from 'mime';
import { IUploadProvider } from './upload.interface';
import axios from 'axios';

/**
 * Google Cloud Storage provider for Postiz.
 * Uses the same letstok-media bucket as studio-tools.
 * Uploads go under letstok-social/ prefix to avoid conflicts.
 * Requires GCS_BUCKET_NAME and GCS_CREDENTIALS_JSON (or FIREBASE_SERVICE_ACCOUNT_JSON for shared auth).
 */
class GcsStorage implements IUploadProvider {
  private bucket;
  private bucketName: string;
  private baseUrl: string;

  constructor(
    bucketName: string,
    credentialsJson: string,
    private basePath = 'letstok-social'
  ) {
    const credentials = JSON.parse(credentialsJson);
    const storage = new Storage({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
    });
    this.bucket = storage.bucket(bucketName);
    this.bucketName = bucketName;
    this.baseUrl = `https://storage.googleapis.com/${bucketName}`;
  }

  private getObjectPath(filename: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${this.basePath}/${year}/${month}/${day}/${filename}`;
  }

  async uploadSimple(path: string): Promise<string> {
    const loadImage = await axios.get(path, { responseType: 'arraybuffer' });
    const contentType =
      loadImage?.headers?.['content-type'] ||
      loadImage?.headers?.['Content-Type'];
    const extension = getExtension(contentType) || 'png';
    const id = makeId(10);
    const filename = `${id}.${extension}`;
    const objectPath = this.getObjectPath(filename);

    await this.bucket.file(objectPath).save(Buffer.from(loadImage.data), {
      metadata: {
        contentType: contentType || 'application/octet-stream',
      },
    });

    return `${this.baseUrl}/${objectPath}`;
  }

  async uploadFile(file: Express.Multer.File): Promise<any> {
    try {
      const id = makeId(10);
      const extension = mime.extension(file.mimetype) || '';
      const filename = `${id}.${extension}`;
      const objectPath = this.getObjectPath(filename);

      await this.bucket.file(objectPath).save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
      });

      const publicUrl = `${this.baseUrl}/${objectPath}`;

      return {
        filename,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
        originalname: filename,
        fieldname: 'file',
        path: publicUrl,
        destination: publicUrl,
        encoding: '7bit',
        stream: file.buffer as any,
      };
    } catch (err) {
      console.error('Error uploading file to GCS:', err);
      throw err;
    }
  }

  async removeFile(filePath: string): Promise<void> {
    try {
      let objectPath: string;
      if (filePath.startsWith('http')) {
        const url = new URL(filePath);
        const pathMatch = url.pathname.match(new RegExp(`/${this.bucketName}/(.+)`));
        if (!pathMatch) return;
        objectPath = decodeURIComponent(pathMatch[1]);
      } else {
        objectPath = filePath.replace(/^\//, '');
      }
      await this.bucket.file(objectPath).delete();
    } catch (err) {
      console.error(`Failed to delete GCS file ${filePath}:`, err);
    }
  }
}

export { GcsStorage };
export default GcsStorage;
