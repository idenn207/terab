import { type Request } from 'express';

interface AuthUser {
  userId: string;
  username: string;
  permissions: string[];
}

type RequestWithAuthUser = Request & { user?: AuthUser };

export type { AuthUser, RequestWithAuthUser };
