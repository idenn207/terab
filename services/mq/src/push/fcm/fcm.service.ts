import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging, Message, Messaging } from 'firebase-admin/messaging';
import { readFileSync } from 'node:fs';
import { PushChallengeJob } from '../types/push-challenge-job.interface';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private messaging!: Messaging;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const credentialPath = this.configService.getOrThrow<string>('FIREBASE_CREDENTIAL_PATH');
    const credential = JSON.parse(readFileSync(credentialPath, 'utf-8')) as Parameters<typeof cert>[0];
    const app = initializeApp({ credential: cert(credential) });
    this.messaging = getMessaging(app);
  }

  async send(job: PushChallengeJob): Promise<void> {
    const message: Message = {
      token: job.pushToken,
      data: {
        type: '2FA_CHALLENGE',
        challengeId: job.challengeId,
        options: job.options,
        expiresAt: job.expiresAt,
        deeplink: `/auth/2fa/${job.challengeId}`,
      },
      notification: {
        title: '로그인 승인 요청',
        body: '모바일 앱에서 숫자를 선택해 로그인을 승인해 주세요.',
      },
    };

    try {
      await this.messaging.send(message);
    } catch (e) {
      throw new Error(`FCM 전송 실패: ${(e as Error).message}`);
    }
  }
}
