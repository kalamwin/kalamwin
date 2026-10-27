# LinkHub — เว็บรวมลิงก์ที่แก้เองได้ทั้งหน้า

เว็บ Link-in-bio / Landing Page สไตล์เดียวกับ Beacons หรือ Linktree แต่เป็นของเราเอง
มีทั้ง **หน้าบ้าน** (หน้าเว็บจริงที่คนดูเห็น) และ **หลังบ้าน** (หน้าแก้ไข) อยู่ในตัวเดียวกัน

* ไม่ต้องติดตั้ง dependency ใด ๆ — ใช้ Node.js ล้วน ๆ สั่ง `node server.js` แล้วใช้งานได้เลย
* ข้อมูลทั้งหมดอยู่ในโฟลเดอร์ `data/` (ไฟล์ JSON + รูปที่อัปโหลด) ก๊อปโฟลเดอร์นี้ไปก็คือการสำรองข้อมูล
* หน้าเว็บถูก render จากฝั่งเซิร์ฟเวอร์ ทำให้ Google และตอนแปะลิงก์ลงแชตเห็นรูป/ข้อความครบ

---

## เริ่มใช้งาน

```bash
node server.js
```

| หน้า | ลิงก์ |
| --- | --- |
| หน้าบ้าน | http://localhost:3000/ |
| หลังบ้าน | http://localhost:3000/admin |

รหัสผ่านเริ่มต้นคือ `linkhub1234` (จะพิมพ์บอกตอนเปิดเซิร์ฟเวอร์ครั้งแรก)
**เข้าหลังบ้านแล้วเปลี่ยนรหัสผ่านทันที** ที่แท็บ "ตั้งค่า" หรือกำหนดตั้งแต่แรกด้วย

```bash
ADMIN_PASSWORD='รหัสที่ตั้งเอง' node server.js
```

> รหัสผ่านถูกเก็บเป็น scrypt hash ใน `data/site.json` ไม่ได้เก็บเป็นข้อความธรรมดา

---

## สิ่งที่แก้ได้จากหลังบ้าน

**หัวเว็บ (Header)** — เลือกได้ 4 แบบ
| แบบ | หน้าตา |
| --- | --- |
| `cover` | รูปเต็มจอ + ชื่อทับบนรูป (แบบเดียวกับตัวอย่าง) |
| `banner` | แบนเนอร์กว้าง + รูปโปรไฟล์กลมซ้อน |
| `avatar` | รูปโปรไฟล์กลมอย่างเดียว |
| `minimal` | ข้อความล้วน |

ปรับได้ทั้งรูปปก ความสูงรูป ความเข้มเงา ชื่อ ขนาดตัวอักษร ข้อความรอง คำแนะนำตัว การจัดวาง และแถวไอคอนโซเชียล

**เซคชัน** — เพิ่ม/ลบ/ลากสลับลำดับ/ซ่อนชั่วคราว/ทำซ้ำได้ทุกอัน

| ชนิด | ใช้ทำอะไร |
| --- | --- |
| ปุ่มลิงก์ | ปุ่มลิงก์พร้อมไอคอน คำอธิบาย และป้าย badge (เรียงเต็มกว้างหรือ 2 คอลัมน์) |
| การ์ดสินค้า / ป้ายยา | การ์ดรูป + ข้อความ + ราคา + ปุ่ม สลับรูปซ้าย–ขวาอัตโนมัติ |
| แกลเลอรีรูป | ตารางรูป 1–3 คอลัมน์ กดแล้วไปลิงก์ได้ |
| วิดีโอ YouTube | ฝังคลิป (ใส่ลิงก์ปกติ, Shorts หรือ youtu.be ก็ได้) |
| ข้อความ / หัวข้อ | ย่อหน้าข้อความธรรมดา |
| แถวไอคอนโซเชียล | แถวไอคอนกลม |
| ฝังเนื้อหา (iframe) | ฝังฟอร์ม ปฏิทินจอง Spotify ฯลฯ (เฉพาะ https) |
| เว้นระยะ / เส้นคั่น | จัดช่องไฟระหว่างเซคชัน |

**ธีม** — ชุดสีสำเร็จรูป 6 แบบ หรือปรับเองทุกสี, ฟอนต์ไทย 8 แบบ, สไตล์ปุ่ม (soft / solid / outline), ความมนของมุม, ความกว้างหน้า, เงา และพื้นหลังแบบสีเดียว / ไล่สี / รูปภาพ

**ตั้งค่า** — SEO (title, description, OG image, favicon), ข้อความท้ายหน้า, CSS เพิ่มเติม, Google Analytics / Meta Pixel / TikTok Pixel, คลังรูปที่อัปโหลด, ดาวน์โหลด–นำเข้าไฟล์สำรอง และเปลี่ยนรหัสผ่าน

**สถิติ** — จำนวนผู้เข้าชม จำนวนคลิก อัตราการคลิก กราฟ 14 วันล่าสุด และคลิกแยกรายลิงก์ (นับเฉพาะหน้าเว็บจริง ตัวอย่างในหลังบ้านไม่ถูกนับ)

ทุกการแก้ไขเห็นผลทันทีในกรอบ "ตัวอย่างสด" ด้านขวา และจะมีผลกับหน้าเว็บจริงเมื่อกด **บันทึก** (หรือ `Ctrl/Cmd + S`)

---

## ตัวแปรสภาพแวดล้อม

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
| --- | --- | --- |
| `PORT` | `3000` | พอร์ตที่เปิด |
| `HOST` | `0.0.0.0` | ที่อยู่ที่ bind |
| `ADMIN_PASSWORD` | `linkhub1234` | รหัสผ่านตอนสร้างไฟล์ข้อมูลครั้งแรก |
| `DATA_DIR` | `./data` | ที่เก็บ `site.json` และรูปที่อัปโหลด |
| `MAX_UPLOAD_MB` | `8` | ขนาดรูปสูงสุดต่อไฟล์ |
| `SECURE_COOKIE` | ปิด | ตั้งเป็น `1` เมื่อรันหลัง HTTPS (บังคับ cookie แบบ Secure) |
| `NODE_ENV` | — | ตั้งเป็น `production` จะเปิด `SECURE_COOKIE` ให้อัตโนมัติ |

---

## เอาขึ้นเซิร์ฟเวอร์จริง

### systemd (VPS ทั่วไป)

```ini
# /etc/systemd/system/linkhub.service
[Unit]
Description=LinkHub
After=network.target

[Service]
WorkingDirectory=/var/www/linkhub
ExecStart=/usr/bin/node server.js
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=ADMIN_PASSWORD=เปลี่ยนรหัสนี้ด้วย
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now linkhub
```

### Docker

```bash
docker build -t linkhub .
docker run -d --name linkhub -p 3000:3000 \
  -e ADMIN_PASSWORD='เปลี่ยนรหัสนี้ด้วย' -e NODE_ENV=production \
  -v "$PWD/data:/app/data" linkhub
```

### Nginx (reverse proxy + HTTPS)

```nginx
server {
  server_name link.example.com;
  client_max_body_size 10m;          # เผื่อไว้สำหรับอัปโหลดรูป
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

ต่อ HTTPS ด้วย certbot แล้วอย่าลืมตั้ง `NODE_ENV=production` หรือ `SECURE_COOKIE=1`

---

## สำรองและย้ายข้อมูล

ข้อมูลทั้งหมดอยู่ใน `data/`

```
data/site.json      # เนื้อหา ธีม การตั้งค่า สถิติ และรหัสผ่าน (hash)
data/uploads/       # รูปที่อัปโหลดผ่านหลังบ้าน
```

ก๊อปโฟลเดอร์นี้ = สำรองครบ และจากหลังบ้านยังกด "ดาวน์โหลดไฟล์สำรอง" เพื่อเก็บเฉพาะเนื้อหาเป็น JSON ได้ด้วย (ไฟล์นี้ไม่มีรหัสผ่านและสถิติ จึงแชร์หรือใช้ย้ายเครื่องได้ปลอดภัย)

---

## โครงสร้างโปรเจกต์

```
server.js              เซิร์ฟเวอร์ HTTP + REST API ทั้งหมด
lib/render.mjs         ตัวสร้าง HTML ของหน้าเว็บ (ใช้ร่วมกันทั้งเซิร์ฟเวอร์และตัวอย่างสดในหลังบ้าน)
lib/store.js           อ่าน/เขียนไฟล์ JSON แบบ atomic + เก็บสถิติ
lib/auth.js            hash รหัสผ่าน (scrypt) และ session cookie แบบเซ็นชื่อ
lib/defaults.js        เนื้อหาตัวอย่างตอนเปิดใช้ครั้งแรก
public/site.css        หน้าตาของหน้าบ้าน (ทุกสี/ขนาดดึงจากธีมที่ตั้งในหลังบ้าน)
public/site.js         นับวิวและคลิก
public/admin/          หน้าหลังบ้าน (index.html, admin.css, admin.js)
data/                  ข้อมูลจริง — ไม่ถูก commit ขึ้น git
```

อยากเพิ่มเซคชันชนิดใหม่: เพิ่มใน `SECTION_TYPES` + ฟังก์ชัน render ใน `lib/render.mjs`, ใส่ฟิลด์ที่ `ITEM_FIELDS` / `sectionBody()` ใน `public/admin/admin.js` แล้วเขียน CSS ใน `public/site.css`

---

## API (ต้องล็อกอินยกเว้นที่ระบุ)

| Method | Path | ใช้ทำอะไร |
| --- | --- | --- |
| `POST` | `/api/login` | ล็อกอิน (สาธารณะ) |
| `POST` | `/api/logout` | ออกจากระบบ |
| `GET` | `/api/session` | เช็คสถานะล็อกอิน (สาธารณะ) |
| `GET` / `PUT` | `/api/data` | อ่าน / บันทึกเนื้อหาทั้งหมด |
| `POST` | `/api/upload` | อัปโหลดรูป (ส่ง body ดิบพร้อม `Content-Type` ของรูป) |
| `GET` / `DELETE` | `/api/uploads` | ดู / ลบไฟล์ในคลังรูป |
| `GET` / `DELETE` | `/api/stats` | ดู / ล้างสถิติ |
| `POST` | `/api/password` | เปลี่ยนรหัสผ่าน |
| `POST` | `/api/click` | บันทึกวิว/คลิก (สาธารณะ เรียกจากหน้าเว็บ) |
