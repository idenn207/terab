import { HttpStatus } from '@terab/common';
import { EmptySchema } from '@terab/schema';
import { initContract } from '@ts-rest/core';
import z from 'zod';
import { DeviceResponseSchema, RegisterDeviceBodySchema } from '../schemas/device.schema';

const c = initContract();

const list = c.query({
  summary: '디바이스 목록 조회',
  method: 'GET',
  path: '/devices',
  responses: {
    [HttpStatus.OK]: z.array(DeviceResponseSchema),
  },
  strictStatusCodes: true,
});

const register = c.mutation({
  summary: '디바이스 등록',
  method: 'POST',
  path: '/devices',
  contentType: 'application/json',
  body: RegisterDeviceBodySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

const remove = c.mutation({
  summary: '디바이스 삭제',
  method: 'DELETE',
  path: '/devices/:id',
  pathParams: z.object({ id: z.string().uuid() }),
  body: EmptySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

export const deviceContract = c.router({
  list,
  register,
  remove,
});
