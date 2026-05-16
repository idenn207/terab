import { HttpStatus } from '@terab/common';
import { EmptySchema, TrustedDeviceResponseSchema } from '@terab/schema';
import { initContract } from '@ts-rest/core';
import z from 'zod';

const c = initContract();

const list = c.query({
  summary: '신뢰 기기 목록 조회',
  method: 'GET',
  path: '/trusted-device',
  responses: {
    [HttpStatus.OK]: z.array(TrustedDeviceResponseSchema),
  },
  strictStatusCodes: true,
});

const register = c.mutation({
  summary: '신뢰 기기 등록',
  method: 'POST',
  path: '/trusted-device',
  body: EmptySchema,
  responses: {
    [HttpStatus.CREATED]: EmptySchema,
  },
  strictStatusCodes: true,
});

const revoke = c.mutation({
  summary: '신뢰 기기 해제',
  method: 'DELETE',
  path: '/trusted-device/:id',
  pathParams: z.object({ id: z.string().uuid() }),
  body: EmptySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

export const trustedDeviceContract = c.router({
  list,
  register,
  revoke,
});
