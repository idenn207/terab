import 'reflect-metadata';
import { AUTO_TRACE_METADATA } from '../trace.metadata';

export { AUTO_TRACE_METADATA };

export function AutoTrace(): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata(AUTO_TRACE_METADATA, true, target);
  };
}
