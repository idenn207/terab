export interface PushChallengeJob {
  userId: string;
  pushToken: string;
  challengeId: string;
  options: string; // "47,82,13"
  expiresAt: string; // ISO 8601
}
