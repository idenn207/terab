import { HttpStatus } from '@terab/common';
import {
  CreateInvitationBodySchema,
  EmptySchema,
  InvitationResponseSchema,
  ValidateInvitationResponseSchema,
} from '@terab/schema';
import { initContract } from '@ts-rest/core';
import z from 'zod';

const c = initContract();

const validate = c.query({
  summary: '초대 토큰 유효성 검증',
  method: 'GET',
  path: '/invitations/:token',
  pathParams: z.object({ token: z.string() }),
  responses: {
    [HttpStatus.OK]: ValidateInvitationResponseSchema,
  },
  strictStatusCodes: true,
});

const create = c.mutation({
  summary: '초대장 생성',
  method: 'POST',
  path: '/invitations',
  contentType: 'application/json',
  body: CreateInvitationBodySchema,
  responses: {
    [HttpStatus.CREATED]: InvitationResponseSchema,
  },
  strictStatusCodes: true,
});

const deactivate = c.mutation({
  summary: '초대장 비활성화',
  method: 'DELETE',
  path: '/invitations/:token',
  pathParams: z.object({ token: z.string() }),
  body: EmptySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

export const invitationContract = c.router({
  validate,
  create,
  deactivate,
});
