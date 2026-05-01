import z from 'zod';

const zodHelper = {
  empty: () => z.undefined().nullable(),
  emptyObject: () => z.undefined().nullable().or(z.object({})),
};

export { zodHelper as zh };
