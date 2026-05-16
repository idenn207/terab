export type TraceOutcome = 'ok' | 'api_exception' | 'unhandled';

export interface ServiceSpan {
  kind: 'service';
  class: string;
  method: string;
  startedAt: number;
  durationMs: number | null;
  replay: boolean;
  args: unknown;
  result: unknown;
  error: { code?: string; message?: string } | null;
}

export interface SqlSpan {
  kind: 'sql';
  sql: string;
  params: unknown[];
  startedAt: number;
  durationMs: number | null;
  rowCount: number | null;
}

export type Span = ServiceSpan | SqlSpan;

export interface TraceContext {
  reqId: string;
  userId: string | null;
  route: string;
  spans: Span[];
  startedAt: number;
  droppedSpans: number;
}

export interface TraceMetaRecord {
  event: 'trace.meta';
  reqId: string;
  service: 'api';
  userId: string | null;
  route: string;
  status: number;
  durationMs: number;
  outcome: TraceOutcome;
  spanCounts: { service: number; sql: number };
  hasDetail: boolean;
  droppedSpans?: number;
}

export interface TraceDetailRecord {
  event: 'trace.detail';
  reqId: string;
  service: 'api';
  error: {
    kind: string;
    code?: string;
    message?: string;
    stack?: string;
  };
  spans: Span[];
  truncated?: true;
}
