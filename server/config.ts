export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:123456@localhost:5432/postgres',
  poolMax: Number(process.env.PG_POOL_MAX ?? 10),
};
