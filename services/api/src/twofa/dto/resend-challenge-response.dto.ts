export class ResendChallengeResponseDto {
  challengeId!: string;

  options!: string[];

  expiresAt!: Date;
}
