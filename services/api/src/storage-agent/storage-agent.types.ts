export interface CreateTargetRequest {
  iqn: string;
  name: string;
  osUsername: string;
  osPassword: string;
}

export interface Target {
  iqn: string;
  name: string;
  status: string;
  connected: boolean;
}

export interface CreateTargetResult {
  id: number;
  iqn: string;
}

export interface AgentErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export const AGENT_ERROR_CODES = {
  TARGET_NOT_FOUND: 'TARGET_NOT_FOUND',
  TARGET_CONFLICT: 'TARGET_CONFLICT',
  BAD_REQUEST: 'BAD_REQUEST',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INTERNAL: 'INTERNAL',
} as const;

export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[keyof typeof AGENT_ERROR_CODES];
