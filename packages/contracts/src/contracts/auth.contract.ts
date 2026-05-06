import { HttpStatus } from '@terab/common';
import {
  BackupLoginBodySchema,
  EmptySchema,
  LoginBodySchema,
  LoginResponseSchema,
  RegisterBodySchema,
  RegisterResponseSchema,
  UserSchema,
} from '@terab/schema';
import { initContract } from '@ts-rest/core';
import z from 'zod';

const c = initContract();

const me = c.query({
  summary: '현재 사용자 조회',
  method: 'GET',
  path: '/auth/me',
  responses: {
    [HttpStatus.OK]: UserSchema,
  },
  strictStatusCodes: true,
});

const register = c.mutation({
  summary: '초대 기반 회원가입',
  method: 'POST',
  path: '/auth/register',
  contentType: 'application/json',
  body: RegisterBodySchema,
  responses: {
    [HttpStatus.CREATED]: RegisterResponseSchema,
  },
  strictStatusCodes: true,
});

const login = c.mutation({
  summary: '아이디/비밀번호 로그인',
  method: 'POST',
  path: '/auth/login',
  contentType: 'application/json',
  body: LoginBodySchema,
  responses: {
    [HttpStatus.OK]: LoginResponseSchema,
  },
  strictStatusCodes: true,
});

const loginWithBackup = c.mutation({
  summary: '백업 코드 로그인',
  method: 'POST',
  path: '/auth/login/backup',
  contentType: 'application/json',
  body: BackupLoginBodySchema,
  responses: {
    [HttpStatus.OK]: LoginResponseSchema,
  },
  strictStatusCodes: true,
});

const completeTwoFa = c.mutation({
  summary: '2FA 챌린지 완료',
  method: 'POST',
  path: '/auth/2fa/challenge/:id/complete',
  pathParams: z.object({ id: z.string() }),
  body: EmptySchema,
  responses: {
    [HttpStatus.OK]: LoginResponseSchema,
  },
  strictStatusCodes: true,
});

const refresh = c.mutation({
  summary: '토큰 갱신',
  method: 'POST',
  path: '/auth/refresh',
  body: EmptySchema,
  responses: {
    [HttpStatus.OK]: LoginResponseSchema,
  },
  strictStatusCodes: true,
});

const logout = c.mutation({
  summary: '로그아웃',
  method: 'POST',
  path: '/auth/logout',
  body: EmptySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

export const authContract = c.router({
  me,
  register,
  login,
  loginWithBackup,
  completeTwoFa,
  refresh,
  logout,
});
