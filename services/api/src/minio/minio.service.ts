import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Readable } from 'node:stream';

@Injectable()
export class MinioService {
  private readonly client: Client;
  private readonly presignClient: Client;
  private readonly endpoint: string;
  private readonly publicEndpoint: string;
  readonly bucketName: string;

  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(MinioService.name) private readonly logger: PinoLogger,
  ) {
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
    this.logger.debug({ endpoint: this.endpoint, bucket: this.bucketName }, 'MinioService 초기화');
  }

  async putObject(key: string, stream: Readable, mimeType: string): Promise<void> {
    this.logger.debug({ bucket: this.bucketName, key, mimeType }, 'putObject 시작');
    try {
      await this.client.putObject(this.bucketName, key, stream, undefined, {
        'Content-Type': mimeType,
      });
    } catch (err) {
      this.logger.error({ err, bucket: this.bucketName, key, endpoint: this.endpoint }, 'putObject 실패');
      throw err;
    }
  }

  async getObject(key: string): Promise<Readable> {
    return this.client.getObject(this.bucketName, key);
  }

  async statObject(key: string): Promise<{ size: number; mimeType: string }> {
    const stat = await this.client.statObject(this.bucketName, key);
    const mimeType = (stat.metaData?.['content-type'] as string) ?? 'application/octet-stream';
    return { size: stat.size, mimeType };
  }

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

  async removeObject(key: string): Promise<void> {
    await this.client.removeObject(this.bucketName, key);
  }

  async removeObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.removeObjects(this.bucketName, keys);
  }
}
