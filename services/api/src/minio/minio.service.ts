import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AutoTrace, LogReplay } from '@terab/logger';
import { Client } from 'minio';
import { Readable } from 'node:stream';

@Injectable()
@AutoTrace()
export class MinioService {
  private readonly client: Client;
  private readonly presignClient: Client;
  private readonly endpoint: string;
  private readonly publicEndpoint: string;
  readonly bucketName: string;

  constructor(private readonly config: ConfigService) {
    this.endpoint = this.config.getOrThrow<string>('MINIO_ENDPOINT');
    this.publicEndpoint = this.config.getOrThrow<string>('MINIO_PUBLIC_ENDPOINT');

    const [host, portStr] = this.endpoint.split(':');
    const port = portStr ? parseInt(portStr, 10) : 9000;

    this.client = new Client({
      endPoint: host,
      port,
      useSSL: false,
      accessKey: this.config.getOrThrow<string>('MINIO_ROOT_USER'),
      secretKey: this.config.getOrThrow<string>('MINIO_ROOT_PASSWORD'),
    });

    const publicUrl = new URL(this.publicEndpoint);
    this.presignClient = new Client({
      endPoint: publicUrl.hostname,
      port: publicUrl.port ? parseInt(publicUrl.port, 10) : publicUrl.protocol === 'https:' ? 443 : 80,
      useSSL: publicUrl.protocol === 'https:',
      accessKey: this.config.getOrThrow<string>('MINIO_ROOT_USER'),
      secretKey: this.config.getOrThrow<string>('MINIO_ROOT_PASSWORD'),
    });

    this.bucketName = this.config.getOrThrow<string>('MINIO_DEFAULT_BUCKETS');
  }

  @LogReplay()
  async putObject(key: string, stream: Readable, mimeType: string): Promise<void> {
    await this.client.putObject(this.bucketName, key, stream, undefined, {
      'Content-Type': mimeType,
    });
  }

  async getObject(key: string): Promise<Readable> {
    return this.client.getObject(this.bucketName, key);
  }

  async statObject(key: string): Promise<{ size: number; mimeType: string }> {
    const stat = await this.client.statObject(this.bucketName, key);
    const mimeType = (stat.metaData?.['content-type'] as string) ?? 'application/octet-stream';
    return { size: stat.size, mimeType };
  }

  @LogReplay()
  async copyObject(sourceKey: string, destKey: string): Promise<void> {
    const source = new (await import('minio')).CopySourceOptions({
      Bucket: this.bucketName,
      Object: sourceKey,
    });
    const dest = new (await import('minio')).CopyDestinationOptions({
      Bucket: this.bucketName,
      Object: destKey,
    });
    await this.client.copyObject(source, dest);
  }

  @LogReplay()
  async removeObject(key: string): Promise<void> {
    await this.client.removeObject(this.bucketName, key);
  }

  @LogReplay()
  async removeObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.removeObjects(this.bucketName, keys);
  }

  async presignedPutObject(key: string, expirySec: number): Promise<string> {
    return this.presignClient.presignedPutObject(this.bucketName, key, expirySec);
  }

  @LogReplay()
  async createMultipartUpload(key: string, mimeType: string): Promise<{ uploadId: string }> {
    // minio-js Core API — 공식 클라이언트에는 노출되지 않지만 prototype에 존재
    const uploadId = await this.client.initiateNewMultipartUpload(this.bucketName, key, {
      'Content-Type': mimeType,
    });
    return { uploadId };
  }

  async presignedPutPart(key: string, uploadId: string, partNumber: number, expirySec: number): Promise<string> {
    return this.presignClient.presignedUrl('PUT', this.bucketName, key, expirySec, {
      uploadId,
      partNumber: String(partNumber),
    });
  }

  @LogReplay()
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<void> {
    const list = parts.map((p) => ({ part: p.partNumber, etag: p.etag }));
    await this.client.completeMultipartUpload(this.bucketName, key, uploadId, list);
  }

  @LogReplay()
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.abortMultipartUpload(this.bucketName, key, uploadId);
  }
}
