import pino, { type Level } from 'pino';

// 운영 콘솔에서 user input·token·request body 가 노출되지 않도록 base 는 service 식별자만 부착한다.
// pino 의 browser 모드는 asObject: true 로 객체 그대로 console 에 출력 — 보강이 필요해지면 그때 transport 도입.
const level: Level = import.meta.env.MODE === 'development' ? 'debug' : 'warn';

export const logger = pino({
  browser: { asObject: true },
  level,
  base: { service: 'admin' },
});
