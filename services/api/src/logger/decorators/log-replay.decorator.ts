import 'reflect-metadata';
import { LOG_REPLAY_METADATA } from '../trace.metadata';

export { LOG_REPLAY_METADATA };

export interface LogReplayOptions {
  captureResult?: boolean;
}

export function LogReplay(options: LogReplayOptions = {}): MethodDecorator {
  const normalized: Required<LogReplayOptions> = {
    captureResult: options.captureResult ?? false,
  };
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(LOG_REPLAY_METADATA, normalized, target, propertyKey);
  };
}
