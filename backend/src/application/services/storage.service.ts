import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';

function secureFilename(filename: string): string {
  const base = basename(filename).replace(/[^\w.-]+/g, '_');
  return base || 'file';
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {}

  private buildClient(): S3Client {
    const accessKey = this.config.get<string>('app.supabaseS3AccessKeyId');
    const secretKey = this.config.get<string>('app.supabaseS3SecretAccessKey');
    const endpoint = this.config.get<string>('app.supabaseS3Endpoint');
    const region = this.config.get<string>('app.supabaseS3Region');

    if (!accessKey || !secretKey) {
      throw new InternalServerErrorException({
        message: 'Supabase S3 credentials are missing in environment.',
      });
    }
    if (!endpoint) {
      throw new InternalServerErrorException({
        message: 'SUPABASE_S3_ENDPOINT is required.',
      });
    }

    return new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 60_000,
        // Large training videos need a long request timeout.
        requestTimeout: 10 * 60_000,
      }),
    });
  }

  private publicUrl(objectKey: string): string {
    const bucket = this.config.get<string>('app.supabaseStorageBucket');
    const publicBase = (
      this.config.get<string>('app.supabaseStoragePublicBaseUrl') ?? ''
    ).replace(/\/+$/, '');
    if (!publicBase) {
      throw new InternalServerErrorException({
        message:
          'SUPABASE_STORAGE_PUBLIC_BASE_URL is missing (or SUPABASE_URL for fallback).',
      });
    }
    return `${publicBase}/${bucket}/${objectKey}`;
  }

  async uploadFileStorage(
    file: Express.Multer.File,
    folder = 'uploads',
  ): Promise<{ bucket: string; object_key: string; public_url: string }> {
    return this.uploadFile(file, folder);
  }

  async uploadFile(
    file: Express.Multer.File,
    folder = 'uploads',
  ): Promise<{ bucket: string; object_key: string; public_url: string }> {
    const bucket = this.config.get<string>('app.supabaseStorageBucket');
    if (!bucket) {
      throw new InternalServerErrorException({
        message: 'SUPABASE_STORAGE_BUCKET is required.',
      });
    }

    const safeName = secureFilename(file.originalname || 'file');
    const now = new Date();
    const objectKey = `${folder.replace(/^\/+|\/+$/g, '')}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${randomUUID().replace(/-/g, '')}_${safeName}`;

    // Prefer streaming from disk (training videos) to avoid buffering ~200 MB in RAM.
    const body =
      file.path && file.path.length > 0
        ? createReadStream(file.path)
        : file.buffer;

    if (!body) {
      throw new BadRequestException({ message: 'Upload body is empty' });
    }

    try {
      const client = this.buildClient();
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: body,
          ContentType: file.mimetype || undefined,
          ContentLength: file.size > 0 ? file.size : undefined,
        }),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Storage upload failed';
      this.logger.error(`S3 upload failed for ${objectKey}: ${message}`);
      throw new InternalServerErrorException({
        message: `File upload to storage failed: ${message}`,
      });
    }

    return {
      bucket,
      object_key: objectKey,
      public_url: this.publicUrl(objectKey),
    };
  }

  async tryDeletePublicObject(
    publicUrl: string | null | undefined,
  ): Promise<void> {
    if (!publicUrl || typeof publicUrl !== 'string') {
      return;
    }
    const publicBase = (
      this.config.get<string>('app.supabaseStoragePublicBaseUrl') ?? ''
    ).replace(/\/+$/, '');
    const bucket = this.config.get<string>('app.supabaseStorageBucket');
    if (!publicBase || !bucket) {
      return;
    }
    const prefix = `${publicBase}/${bucket}/`;
    if (!publicUrl.startsWith(prefix)) {
      return;
    }
    const objectKey = publicUrl.slice(prefix.length).replace(/^\/+/, '');
    if (!objectKey) {
      return;
    }
    try {
      const client = this.buildClient();
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      );
    } catch {
      // best-effort
    }
  }
}
