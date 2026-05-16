import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema';

type Db = NodePgDatabase<typeof schema>;
export type DrizzleTx = Parameters<Parameters<Db['transaction']>[0]>[0];
