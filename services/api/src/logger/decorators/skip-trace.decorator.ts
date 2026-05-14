import 'reflect-metadata';
import { SKIP_TRACE_METADATA } from '../trace.metadata';

export { SKIP_TRACE_METADATA };

export function SkipTrace(): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(SKIP_TRACE_METADATA, true, target, propertyKey);
  };
}
