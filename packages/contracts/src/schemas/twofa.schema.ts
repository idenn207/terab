import z from 'zod';
import { UserSchema } from './common.schema';

// ───── Challenge Status ──────────────────────────────
export const ChallengeStatusPendingSchema = z.object({
  status: z.literal('PENDING'),
  options: z.array(z.string()),
  correctNum: z.string(),
  remainingSeconds: z.number(),
});

export const ChallengeStatusApprovedSchema = z.object({
  status: z.literal('APPROVED'),
  accessToken: z.string(),
  user: UserSchema,
});

export const ChallengeStatusDeniedSchema = z.object({
  status: z.literal('DENIED'),
});

export const ChallengeStatusExpiredSchema = z.object({
  status: z.literal('EXPIRED'),
});

export const ChallengeStatusResponseSchema = z.discriminatedUnion('status', [
  ChallengeStatusPendingSchema,
  ChallengeStatusApprovedSchema,
  ChallengeStatusDeniedSchema,
  ChallengeStatusExpiredSchema,
]);

// ───── Respond Challenge ──────────────────────────────
export const RespondChallengeBodySchema = z.object({
  selectedNumber: z.string().regex(/^\d{2}$/),
});

// ───── Resend Challenge ──────────────────────────────
export const ResendChallengeResponseSchema = z.object({
  challengeId: z.string(),
  options: z.array(z.string()),
  expiresAt: z.coerce.date(),
});

// ───── Types ──────────────────────────────
export type ChallengeStatusResponse = z.infer<typeof ChallengeStatusResponseSchema>;
export type RespondChallengeBody = z.infer<typeof RespondChallengeBodySchema>;
export type ResendChallengeResponse = z.infer<typeof ResendChallengeResponseSchema>;
