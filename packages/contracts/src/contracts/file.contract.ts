import { HttpStatus } from '@terab/common';
import {
  EmptySchema,
  FileItemSchema,
  FileSearchQuerySchema,
  FileSearchResponseSchema,
  MoveFileBodySchema,
  RenameFileBodySchema,
} from '@terab/schema';
import { initContract } from '@ts-rest/core';
import z from 'zod';

const c = initContract();

const upload = c.mutation({
  summary: '파일 업로드',
  method: 'POST',
  path: '/files',
  contentType: 'multipart/form-data',
  body: z.object({
    file: z.any(),
    folderId: z.string().uuid().optional(),
  }),
  responses: {
    [HttpStatus.CREATED]: FileItemSchema,
  },
  strictStatusCodes: true,
});

const rename = c.mutation({
  summary: '파일 이름 변경',
  method: 'PATCH',
  path: '/files/:id',
  pathParams: z.object({ id: z.string().uuid() }),
  contentType: 'application/json',
  body: RenameFileBodySchema,
  responses: {
    [HttpStatus.OK]: FileItemSchema,
  },
  strictStatusCodes: true,
});

const move = c.mutation({
  summary: '파일 이동',
  method: 'PATCH',
  path: '/files/:id/move',
  pathParams: z.object({ id: z.string().uuid() }),
  contentType: 'application/json',
  body: MoveFileBodySchema,
  responses: {
    [HttpStatus.OK]: FileItemSchema,
  },
  strictStatusCodes: true,
});

const copy = c.mutation({
  summary: '파일 복사',
  method: 'POST',
  path: '/files/:id/copy',
  pathParams: z.object({ id: z.string().uuid() }),
  body: MoveFileBodySchema,
  responses: {
    [HttpStatus.CREATED]: FileItemSchema,
  },
  strictStatusCodes: true,
});

const remove = c.mutation({
  summary: '파일 소프트 삭제',
  method: 'DELETE',
  path: '/files/:id',
  pathParams: z.object({ id: z.string().uuid() }),
  body: EmptySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

const search = c.query({
  summary: '파일 검색',
  method: 'GET',
  path: '/files/search',
  query: FileSearchQuerySchema,
  responses: {
    [HttpStatus.OK]: FileSearchResponseSchema,
  },
  strictStatusCodes: true,
});

export const fileContract = c.router({ upload, rename, move, copy, remove, search });
