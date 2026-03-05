import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

