import { HttpStatus } from '@terab/common';
import {
  CreateFolderBodySchema,
  EmptySchema,
  FolderChildrenResponseSchema,
  FolderItemSchema,
  MoveFolderBodySchema,
  RenameFolderBodySchema,
} from '@terab/schema';
import { initContract } from '@ts-rest/core';
import z from 'zod';

const c = initContract();

const getRoot = c.query({
  summary: '루트 폴더 목록 조회',
  method: 'GET',
  path: '/folders/root',
  responses: {
    [HttpStatus.OK]: FolderChildrenResponseSchema,
  },
  strictStatusCodes: true,
});

const getChildren = c.query({
  summary: '서브폴더 목록 조회',
  method: 'GET',
  path: '/folders/:id/children',
  pathParams: z.object({ id: z.string().uuid() }),
  responses: {
    [HttpStatus.OK]: FolderChildrenResponseSchema,
  },
  strictStatusCodes: true,
});

const create = c.mutation({
  summary: '폴더 생성',
  method: 'POST',
  path: '/folders',
  contentType: 'application/json',
  body: CreateFolderBodySchema,
  responses: {
    [HttpStatus.CREATED]: FolderItemSchema,
  },
  strictStatusCodes: true,
});

const rename = c.mutation({
  summary: '폴더 이름 변경',
  method: 'PATCH',
  path: '/folders/:id',
  pathParams: z.object({ id: z.string().uuid() }),
  contentType: 'application/json',
  body: RenameFolderBodySchema,
  responses: {
    [HttpStatus.OK]: FolderItemSchema,
  },
  strictStatusCodes: true,
});

const move = c.mutation({
  summary: '폴더 이동',
  method: 'PATCH',
  path: '/folders/:id/move',
  pathParams: z.object({ id: z.string().uuid() }),
  contentType: 'application/json',
  body: MoveFolderBodySchema,
  responses: {
    [HttpStatus.OK]: FolderItemSchema,
  },
  strictStatusCodes: true,
});

const remove = c.mutation({
  summary: '폴더 소프트 삭제',
  method: 'DELETE',
  path: '/folders/:id',
  pathParams: z.object({ id: z.string().uuid() }),
  body: EmptySchema,
  responses: {
    [HttpStatus.NO_CONTENT]: EmptySchema,
  },
  strictStatusCodes: true,
});

export const folderContract = c.router({ getRoot, getChildren, create, rename, move, remove });
