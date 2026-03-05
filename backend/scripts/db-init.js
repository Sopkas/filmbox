import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
  const schemaSql = await fs.readFile(schemaPath, "utf8");
  await pool.query(schemaSql);
  console.log("Database schema initialized.");
  await pool.end();
}

run().catch((error) => {
  console.error("Failed to initialize schema:", error);
  process.exit(1);
});

