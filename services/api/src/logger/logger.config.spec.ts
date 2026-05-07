import { buildLoggerParams } from './logger.config';

describe('buildLoggerParams', () => {
  it('인스턴스가 생성된다', () => {
    expect(buildLoggerParams('dev', 30)).toBeDefined();
  });

  describe('dev 환경', () => {
    let pinoHttp: Record<string, any>;

    beforeEach(() => {
      pinoHttp = buildLoggerParams('dev', 30).pinoHttp as Record<string, any>;
    });

    it('level이 debug이다', () => {
      expect(pinoHttp.level).toBe('debug');
    });

    it('autoLogging이 false이다', () => {
      expect(pinoHttp.autoLogging).toBe(false);
    });

    it('transport target이 pino-pretty이다', () => {
      expect(pinoHttp.transport.target).toBe('pino-pretty');
    });
  });

  describe('prod 환경', () => {
    let pinoHttp: Record<string, any>;

    beforeEach(() => {
      pinoHttp = buildLoggerParams('prod', 30).pinoHttp as Record<string, any>;
    });

    it('level이 warn이다', () => {
      expect(pinoHttp.level).toBe('warn');
    });

    it('autoLogging이 false이다', () => {
      expect(pinoHttp.autoLogging).toBe(false);
    });

    it('transport target이 pino-roll이다', () => {
      expect(pinoHttp.transport.target).toBe('pino-roll');
    });

    it('LOG_MAX_FILES가 limit.count에 반영된다', () => {
      const ph = buildLoggerParams('prod', 14).pinoHttp as Record<string, any>;
      expect(ph.transport.options.limit.count).toBe(14);
    });
  });

  describe('genReqId', () => {
    let genReqId: (req: any) => string;

    beforeEach(() => {
      const pinoHttp = buildLoggerParams('dev', 30).pinoHttp as Record<string, any>;
      genReqId = pinoHttp.genReqId;
    });

    it('X-Request-Id 헤더가 있으면 해당 값을 반환한다', () => {
      expect(genReqId({ headers: { 'x-request-id': 'test-id-123' } })).toBe('test-id-123');
    });

    it('X-Request-Id 헤더가 없으면 UUID 형식 문자열을 반환한다', () => {
      const id = genReqId({ headers: {} });
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });
});
