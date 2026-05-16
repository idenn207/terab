import { HttpStatus } from '@terab/common';
import {
  EmptySchema,
  FileItemSchema,
  FileSearchQuerySchema,
  FileSearchResponseSchema,
  MoveFileBodySchema,
  RenameFileBodySchema,
  UploadCompleteBodySchema,
  UploadInitBodySchema,
  UploadInitResponseSchema,
} from '@terab/schema';
import { initContract } from '@ts-rest/core';
import z from 'zod';

const c = initContract();

const uploadInit = c.mutation({
  summary: '파일 업로드 세션 생성 (presigned URL 발급)',
  method: 'POST',
  path: '/files/upload-init',
  contentType: 'application/json',
  body: UploadInitBodySchema,
  responses: {
    [HttpStatus.CREATED]: UploadInitResponseSchema,
  },
  strictStatusCodes: true,
});

const uploadComplete = c.mutation({
  summary: '파일 업로드 완료 (DB 반영)',
  method: 'POST',
  path: '/files/:sessionId/upload-complete',
  pathParams: z.object({ sessionId: z.string().uuid() }),
  contentType: 'application/json',
  body: UploadCompleteBodySchema,
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

export const fileContract = c.router({ uploadInit, uploadComplete, rename, move, copy, remove, search });
