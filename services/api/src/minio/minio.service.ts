import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'node:stream';

@Injectable()
export class MinioService {
  private readonly client: Client;
  readonly bucketName: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.getOrThrow<string>('MINIO_ENDPOINT');
    const [host, portStr] = endpoint.split(':');
    const port = portStr ? parseInt(portStr, 10) : 9000;

    this.client = new Client({
      endPoint: host,
      port,
      useSSL: false,
      accessKey: config.getOrThrow<string>('MINIO_ROOT_USER'),
      secretKey: config.getOrThrow<string>('MINIO_ROOT_PASSWORD'),
    });

    this.bucketName = config.getOrThrow<string>('MINIO_DEFAULT_BUCKETS');
  }

  async putObject(key: string, stream: Readable, mimeType: string): Promise<void> {
    await this.client.putObject(this.bucketName, key, stream, undefined, {
      'Content-Type': mimeType,
    });
  }

  async getObject(key: string): Promise<Readable> {
    return this.client.getObject(this.bucketName, key);
  }

  async statObject(key: string): Promise<{ size: number }> {
    const stat = await this.client.statObject(this.bucketName, key);
    return { size: stat.size };
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
