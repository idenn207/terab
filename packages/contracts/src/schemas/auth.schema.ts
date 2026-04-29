import z from 'zod';
import { UserSchema } from './common.schema';

// ───── Login ──────────────────────────────
export const LoginBodySchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(255),
});

export const AuthenticatedResponseSchema = z.object({
  status: z.literal('AUTHENTICATED'),
  accessToken: z.string(),
  user: UserSchema,
});

export const TwoFaRequiredResponseSchema = z.object({
  status: z.literal('2FA_REQUIRED'),
  challengeId: z.string(),
  options: z.array(z.string()),
  expiresAt: z.coerce.date(),
});

export const LoginResponseSchema = z.discriminatedUnion('status', [
  AuthenticatedResponseSchema,
  TwoFaRequiredResponseSchema,
]);

// ───── Register ──────────────────────────────
export const RegisterBodySchema = z.object({
  token: z.string().uuid(),
  username: z.string().min(1).max(50),
  nickname: z.string().min(1).max(50),
  password: z.string().min(8),
});

export const RegisterResponseSchema = z.object({
  accessToken: z.string(),
  user: UserSchema,
  backupCodes: z.array(z.string()),
});

// ───── BackupLogin ──────────────────────────────
export const BackupLoginBodySchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(255),
  backupCode: z.string().min(1).max(10),
});

// ───── Types ──────────────────────────────
export type LoginBody = z.infer<typeof LoginBodySchema>;
export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type BackupLoginBody = z.infer<typeof BackupLoginBodySchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type AuthenticatedResponse = z.infer<typeof AuthenticatedResponseSchema>;
export type TwoFaRequiredResponse = z.infer<typeof TwoFaRequiredResponseSchema>;
