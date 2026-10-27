#!/usr/bin/env node
// Runs LinkHub as a plain Node server (your machine, a VPS, Docker).
// On Vercel, api/index.js serves the same handler instead.

import http from 'node:http';
import { respond, ready, store, DATA_DIR } from './lib/app.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

await ready();

const server = http.createServer(respond);

server.listen(PORT, HOST, () => {
  console.log(`\n  LinkHub พร้อมใช้งานแล้ว`);
  console.log(`  หน้าบ้าน : http://localhost:${PORT}/`);
  console.log(`  หลังบ้าน : http://localhost:${PORT}/admin`);
  console.log(`  ข้อมูล   : ${store.storage.kind === 'file' ? DATA_DIR : 'Vercel Blob'}`);
  if (store.auth.isDefaultPassword) {
    console.log(`\n  รหัสผ่านเริ่มต้น : ${process.env.ADMIN_PASSWORD || 'linkhub1234'}`);
    console.log(`  (เข้าหลังบ้านแล้วเปลี่ยนรหัสผ่านทันที หรือรันด้วย ADMIN_PASSWORD=... node server.js)`);
  }
  console.log('');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    server.close();
    await store.close();
    process.exit(0);
  });
}
