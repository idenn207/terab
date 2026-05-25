export type TwoFaStrategyType = 'PUSH' | 'TOTP' | 'PASSKEY' | 'BACKUP_CODE';

export interface TwoFaStrategyInstance {
  id: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

// TSetup/TChallenge/TResponse는 각 strategy가 직접 명시한다.
// Phase 0에서는 push/backup-code 둘 다 setup ceremony가 없으므로
// startSetup/completeSetup은 ApiException('TWOFA_SETUP_NOT_SUPPORTED')를 throw 한다.
export interface TwoFaStrategy<TSetup = unknown, TChallenge = unknown, TResponse = unknown> {
  readonly type: TwoFaStrategyType;

  startSetup(userId: string): Promise<TSetup>;
  completeSetup(userId: string, payload: unknown): Promise<void>;

  createChallenge(userId: string): Promise<TChallenge>;
  verifyResponse(userId: string, challengeId: string, payload: TResponse): Promise<boolean>;

  list(userId: string): Promise<TwoFaStrategyInstance[]>;
  revoke(userId: string, id: string): Promise<void>;
}

export const TWOFA_STRATEGY_TOKEN = Symbol('TwoFaStrategy');
