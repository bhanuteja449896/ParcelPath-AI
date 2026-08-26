import { hash } from '@node-rs/argon2';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

async function main() {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(path.join(process.cwd(),'.env'),'utf8').split(/[\r\n]/)) {
    const m = line.match(/^([A-Z0-9_a-z]+)=(.*)/);
    if(m) env[m[1]!] = m[2]!.trim();
  }
  const sql = postgres(env.DIRECT_URL!, {prepare:false});
  const hashed = await hash('Demo1234!');
  await sql`UPDATE users SET password_hash = ${hashed}`;
  console.log('Passwords updated to Demo1234!');
  await sql.end();
}

main().catch(console.error);
