import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '@terab/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

const SECRET_FILE_MODE = 0o600;
const SECRET_DIR_MODE = 0o700;
const DEV_FALLBACK_SUBDIR = 'terab-secrets';

export interface SecretStore {
  write(name: string, value: string): Promise<string>;
  remove(name: string): Promise<void>;
}

export const SECRET_STORE = Symbol('SECRET_STORE');

export interface FileSecretStoreOptions {
  baseDir: string;
}

export class FileSecretStore implements SecretStore {
  constructor(
    private readonly opts: FileSecretStoreOptions,
    private readonly logger: PinoLogger,
  ) {}

  async write(name: string, value: string): Promise<string> {
    const filePath = this.resolvePath(name);
    try {
      await mkdir(this.opts.baseDir, { recursive: true, mode: SECRET_DIR_MODE });
      await writeFile(filePath, value, { mode: SECRET_FILE_MODE });
      return name;
    } catch (err) {
      this.logger.error({ err, name, baseDir: this.opts.baseDir }, 'secret-store write failed');
      throw new ApiException('MOUNT_CREDENTIAL_SECRET_WRITE_FAILED');
    }
  }

  async remove(name: string): Promise<void> {
    const filePath = this.resolvePath(name);
    try {
      await rm(filePath, { force: true });
    } catch (err) {
      this.logger.warn({ err, name }, 'secret-store remove failed (continuing)');
    }
  }

  private resolvePath(name: string): string {
    if (name.includes('/') || name.includes('\\') || name.includes('..')) {
      throw new ApiException('MOUNT_CREDENTIAL_SECRET_WRITE_FAILED');
    }
    return path.join(this.opts.baseDir, name);
  }
}

@Injectable()
export class SecretStoreFactory implements OnModuleInit {
  private store: FileSecretStore | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(SecretStoreFactory.name) private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    const baseDir = this.config.get<string>('STORAGE_SECRET_DIR') ?? path.join(os.tmpdir(), DEV_FALLBACK_SUBDIR);
    this.store = new FileSecretStore({ baseDir }, this.logger);
  }

  get(): SecretStore {
    if (!this.store) throw new Error('SecretStoreFactory not initialized');
    return this.store;
  }
}
