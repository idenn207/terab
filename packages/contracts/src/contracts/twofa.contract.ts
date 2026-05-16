import { HttpStatus } from '@terab/common';
import {
  ChallengeStatusResponseSchema,
  EmptySchema,
  ResendChallengeResponseSchema,
  RespondChallengeBodySchema,
} from '@terab/schema';
import { initContract } from '@ts-rest/core';
import z from 'zod';

const c = initContract();

const getStatus = c.query({
  summary: '2FA 챌린지 상태 조회',
  method: 'GET',
  path: '/auth/2fa/challenge/:id/status',
  pathParams: z.object({ id: z.string() }),
  responses: {
    [HttpStatus.OK]: ChallengeStatusResponseSchema,
  },
  strictStatusCodes: true,
});

const respond = c.mutation({
  summary: '2FA 챌린지 응답',
  method: 'POST',
  path: '/auth/2fa/challenge/:id/respond',
  pathParams: z.object({ id: z.string() }),
  contentType: 'application/json',
  body: RespondChallengeBodySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

const resend = c.mutation({
  summary: '2FA 챌린지 재발송',
  method: 'POST',
  path: '/auth/2fa/challenge/:id/resend',
  pathParams: z.object({ id: z.string() }),
  contentType: 'application/json',
  body: EmptySchema,
  responses: {
    [HttpStatus.OK]: ResendChallengeResponseSchema,
  },
  strictStatusCodes: true,
});

export const twofaContract = c.router({
  getStatus,
  respond,
  resend,
});
