import { HttpStatus } from '@terab/common';
import { EmptySchema, TrashActionBodySchema, TrashListResponseSchema } from '@terab/schema';
import { initContract } from '@ts-rest/core';
import z from 'zod';

const c = initContract();

const list = c.query({
  summary: '휴지통 목록 조회',
  method: 'GET',
  path: '/trash',
  responses: {
    [HttpStatus.OK]: TrashListResponseSchema,
  },
  strictStatusCodes: true,
});

const restore = c.mutation({
  summary: '휴지통 항목 복원',
  method: 'POST',
  path: '/trash/:id/restore',
  pathParams: z.object({ id: z.string().uuid() }),
  contentType: 'application/json',
  body: TrashActionBodySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

const permanentDelete = c.mutation({
  summary: '영구 삭제',
  method: 'DELETE',
  path: '/trash/:id',
  pathParams: z.object({ id: z.string().uuid() }),
  contentType: 'application/json',
  body: TrashActionBodySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

export const trashContract = c.router({ list, restore, permanentDelete });
