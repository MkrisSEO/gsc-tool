import { execSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
config({ path: path.resolve(__dirname, '../.env.local') });

console.log('🔄 Pushing Prisma schema to database...');
console.log('📊 DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 30) + '...');
console.log('📊 DIRECT_URL:', process.env.DIRECT_URL?.substring(0, 30) + '...');

try {
  execSync('npx prisma db push', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
    },
  });
  console.log('✅ Schema pushed successfully!');
} catch (error) {
  console.error('❌ Failed to push schema:', error.message);
  process.exit(1);
}

