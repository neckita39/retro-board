import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL || 'postgresql://retro:retro@localhost:5432/retro'
});

async function migrate() {
	const client = await pool.connect();
	try {
		await client.query(`
			CREATE TABLE IF NOT EXISTS __drizzle_migrations (
				id SERIAL PRIMARY KEY,
				hash TEXT NOT NULL UNIQUE,
				created_at TIMESTAMPTZ DEFAULT NOW()
			)
		`);

		const migrationsDir = join(import.meta.dirname, 'drizzle');
		const files = readdirSync(migrationsDir)
			.filter(f => f.endsWith('.sql'))
			.sort();

		for (const file of files) {
			const hash = file;
			const existing = await client.query(
				'SELECT id FROM __drizzle_migrations WHERE hash = $1',
				[hash]
			);
			if (existing.rows.length > 0) continue;

			const sql = readFileSync(join(migrationsDir, file), 'utf-8');
			const statements = sql.split('--> statement-breakpoint');

			for (const stmt of statements) {
				const trimmed = stmt.trim();
				if (trimmed) await client.query(trimmed);
			}

			await client.query(
				'INSERT INTO __drizzle_migrations (hash) VALUES ($1)',
				[hash]
			);
			console.log(`Applied: ${file}`);
		}
		console.log('Migrations complete.');
	} finally {
		client.release();
		await pool.end();
	}
}

migrate().catch(err => {
	console.error('Migration failed:', err);
	process.exit(1);
});
