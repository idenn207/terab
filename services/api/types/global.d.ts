export {};

declare global {
  type Nullable<T> = T | null | undefined;
  type NullableRecord<T> = {
    [P in keyof T]: T[P] | null | undefined;
  };
  type Combine<T, U> = T & U;
}
