import { TransactionContext } from './transaction-context';
import type { DrizzleTx } from './types/database.type';

describe('TransactionContext', () => {
  let ctx: TransactionContext;

  beforeEach(() => {
    ctx = new TransactionContext();
  });

  it('트랜잭션 컨텍스트 밖에서 current는 undefined를 반환한다', () => {
    expect(ctx.current).toBeUndefined();
  });

  it('run() 내에서 current는 주입된 tx를 반환한다', async () => {
    const fakeTx = {} as DrizzleTx;
    let captured: DrizzleTx | undefined;

    await ctx.run(fakeTx, async () => {
      captured = ctx.current;
    });

    expect(captured).toBe(fakeTx);
  });

  it('run() 종료 후 current는 undefined로 돌아온다', async () => {
    const fakeTx = {} as DrizzleTx;
    await ctx.run(fakeTx, async () => {});
    expect(ctx.current).toBeUndefined();
  });

  it('중첩 run()에서 내부 tx가 외부 tx보다 우선한다', async () => {
    const outerTx = {} as DrizzleTx;
    const innerTx = {} as DrizzleTx;
    let innerCaptured: DrizzleTx | undefined;
    let outerAfterInner: DrizzleTx | undefined;

    await ctx.run(outerTx, async () => {
      await ctx.run(innerTx, async () => {
        innerCaptured = ctx.current;
      });
      outerAfterInner = ctx.current;
    });

    expect(innerCaptured).toBe(innerTx);
    expect(outerAfterInner).toBe(outerTx);
  });
});
