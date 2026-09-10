
import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!poolInstance) {
    const POSTGRES_URL = process.env.POSTGRES_URL;
    if (!POSTGRES_URL) {
      console.error('[DB] FATAL: POSTGRES_URL environment variable is not set');
      process.exit(1);
    }
    poolInstance = new Pool({
      connectionString: POSTGRES_URL,
    });

    poolInstance.on('error', (err) => {
      console.error('[DB] Unexpected error on idle client:', err.message);
    });
  }
  return poolInstance;
}

async function migrationHasBeenRun(pool: pg.Pool, migrationName: string): Promise<boolean> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const result = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE name = $1',
      [migrationName]
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

async function markMigrationRun(pool: pg.Pool, migrationName: string): Promise<void> {
  await pool.query(
    'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
    [migrationName]
  );
}

function resolveMigrationsDir(): string {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'migrations'),
    path.join(cwd, '..', 'migrations'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

export async function runMigrationsIfNeeded(): Promise<void> {
  const pool = getPool();
  const migrationName = '001_init.sql';
  const migrationsDir = resolveMigrationsDir();
  const migrationPath = path.join(migrationsDir, migrationName);

  if (await migrationHasBeenRun(pool, migrationName)) {
    console.log(`[DB] Migration ${migrationName} already applied, skipping.`);
    return;
  }

  console.log(`[DB] Applying migration ${migrationName}...`);

  if (!fs.existsSync(migrationPath)) {
    console.error(`[DB] Migration file not found: ${migrationPath}`);
    throw new Error(`Migration file not found: ${migrationPath}`);
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  try {
    await pool.query(sql);
    await markMigrationRun(pool, migrationName);
    console.log(`[DB] Migration ${migrationName} applied successfully.`);
  } catch (err) {
    const error = err as Error;
    console.error(`[DB] Failed to apply migration ${migrationName}:`, error.message);
    throw err;
  }
}

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

export async function closePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    console.log('[DB] Connection pool closed.');
  }
}
