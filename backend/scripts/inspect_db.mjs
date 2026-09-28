import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'battery_compliance' ORDER BY ordinal_position");
    console.log('battery_compliance columns:');
    cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
