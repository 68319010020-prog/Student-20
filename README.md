# ระบบบันทึกงานนักเรียน | Tanetpon

เว็บบันทึกงานนักเรียนแบบ full-stack ใช้ Express + JSON file storage และ deploy ด้วยเส้นทาง GitHub Actions -> Docker Hub -> VPS `vps01`

ฟีเจอร์: สมัคร/เข้าสู่ระบบ, เพิ่ม/แก้ไข/ลบงาน, ค้นหา, กรองสถานะ, วันกำหนดส่ง, ระดับความสำคัญ, โน้ต และสรุปความคืบหน้า ข้อมูลถูกเก็บใน JSON file และ Docker volume จึงอยู่ต่อหลัง redeploy และงานของแต่ละบัญชีแยกจากกัน งานสำคัญจะแสดงก่อนงานปกติ

## เริ่มใช้งานแบบเร็ว

1. ติดตั้ง dependencies: `npm install`
2. เริ่มแอปแบบ local: `npm run dev` หรือ `npm start`
3. เปิด `http://localhost:4001` (หลีกเลี่ยง port 3000 ที่ถูก Docker/WSL ใช้งานอยู่)
4. สำหรับใช้งานเดโม่ ให้เข้าสู่ระบบด้วยบัญชี `admin` / `admin123`
5. หรือกด `สร้างบัญชีใหม่` แล้วตั้งชื่อผู้ใช้ 3-30 ตัวอักษรและรหัสผ่านอย่างน้อย 6 ตัวอักษร
6. เพิ่มงานได้ทันทีและข้อมูลจะถูกเก็บไว้ในไฟล์ JSON ในโฟลเดอร์ `data/`

> บัญชีนี้ใช้สำหรับโปรเจกต์สาธิตบนเซิร์ฟเวอร์เท่านั้น ไม่ควรใช้รหัสผ่านเดียวกับบัญชีสำคัญอื่น

## การเข้าสู่ระบบแบบเร็ว

- ผู้ใช้เดโม่: `admin` / `admin123`
- ถ้าเจอ session ค้างหรือ login ไม่เปลี่ยนหน้า ให้ล้าง cookie ของเว็บไซต์แล้ว refresh
- หากต้องการรันบนเครื่องใหม่ ให้รัน `npm install` ก่อน `npm start`

## วิธีใช้งานภายในแอป (Walkthrough)

### ขั้นตอนที่ 1: สมัครสมาชิก

1. เปิดแอปที่ `http://localhost:4001` (หรือ port ตามที่ตั้ง)
2. หากเป็นครั้งแรก ให้คลิก **"สร้างบัญชีใหม่"** 
3. กรอก:
   - **ชื่อผู้ใช้** (username): 3-30 ตัวอักษร อักษรและตัวเลขเท่านั้น
   - **รหัสผ่าน** (password): อย่างน้อย 6 ตัวอักษร
4. คลิก **"สมัคร"** 
5. ระบบจะ redirect ไปยังหน้าเข้าสู่ระบบ ให้ล็อกอินด้วยบัญชีที่เพิ่งสร้าง
6. session จะถูกบันทึกใน cookie ของเบราว์เซอร์ ดังนั้นครั้งถัดไปที่เปิดแอปจะรักษา session ไว้ได้

> **เคล็ดลับ**: ใช้บัญชีเดโม่ `admin` / `admin123` เพื่อลองใช้ฟีเจอร์ทั้งหมดก่อน

### ขั้นตอนที่ 2: แดชบอร์ด (Dashboard)

เมื่อเข้าสู่ระบบสำเร็จ จะเห็น:

- **ส่วนหัว**: วันที่ปัจจุบัน ชื่อผู้ใช้ สถิติสรุป (รวม, ยังไม่ดำเนิน, กำลังดำเนิน, เสร็จแล้ว)
- **แผงสถิติ**: 
  - จำนวนงานทั้งหมด
  - ร้อยละความสำเร็จ (progress bar)
  - จำนวนงาน overdue (เกินกำหนด)
  - เวลาอัปเดตครั้งสุดท้าย
- **ปุ่มทำงาน**: 
  - **"+ เพิ่มงานใหม่"**: เพื่อสร้างงานใหม่
  - **Export CSV**: ดาวน์โหลดข้อมูลเป็นไฟล์ CSV
  - **View Switcher** (List / Calendar): เปลี่ยนมุมมอง
- **ช่องค้นหา**: ค้นหาชื่องาน วิชา หรือ note
- **ปุ่มกรอง**: 
  - **ทั้งหมด** (All)
  - **ยังไม่เริ่ม** (To-Do)
  - **กำลังทำ** (Doing)
  - **เสร็จแล้ว** (Done)

### ขั้นตอนที่ 3: เพิ่มงานใหม่

1. คลิก **"+ เพิ่มงานใหม่"**
2. หน้าต่าง Dialog จะเปิดขึ้น กรอก:
   - **ชื่องาน** (Title): ชื่อหรือหัวข้องาน เช่น "ทำรายงาน Geology"
   - **วิชา** (Subject): ชื่อวิชา เช่น "Geology"
   - **สถานะ** (Status): 
     - ยังไม่เริ่ม (ค่าเริ่มต้น)
     - กำลังทำ
     - เสร็จแล้ว
   - **วันส่ง** (Due Date): วันกำหนดส่ง (optional)
   - **ความสำคัญ** (Priority): 
     - ปกติ (ค่าเริ่มต้น)
     - สำคัญ (แสดงเป็นสีแดง)
     - ไม่สำคัญ (แสดงเป็นสีเทา)
   - **โน้ต** (Notes): หมายเหตุเพิ่มเติม (optional)
3. คลิก **"บันทึก"** เพื่อสร้างงาน
4. หน้าต่าง Dialog จะปิด และงานจะปรากฏในรายการ

### ขั้นตอนที่ 4: จัดการงาน

#### การแก้ไข
1. คลิกปุ่ม **✎ (ดินสอ)** บนการ์ดงาน
2. หน้าต่าง Dialog จะเปิดพร้อมข้อมูลเดิม
3. แก้ไขข้อมูลตามต้องการ
4. คลิก **"บันทึก"** เพื่อบันทึกการเปลี่ยนแปลง

#### การลบ
1. คลิกปุ่ม **× (ลบ)** บนการ์ดงาน
2. ยืนยันการลบในหน้าต่าง dialog
3. งานจะถูกลบออกทันที

#### การจัดเรียง (Drag & Drop)
1. อยู่ใน **List View** (ไม่ใช่ Calendar View)
2. กดค้างและลากการ์ดงาน
3. ลองกับการ์ดงานอื่นเพื่อเปลี่ยนตำแหน่ง
4. ลำดับใหม่จะถูกบันทึกอัตโนมัติ

### ขั้นตอนที่ 5: ค้นหาและกรอง

- **ค้นหา**: พิมพ์ใน **ช่องค้นหา** เพื่อหางาน (ค้นหาจากชื่อ วิชา หรือ note)
- **กรอง**: คลิกปุ่มกรอง:
  - **ทั้งหมด**: แสดงงานทั้งหมด (ค่าเริ่มต้น)
  - **ยังไม่เริ่ม**: แสดงเฉพาะงานที่ยังไม่เริ่ม
  - **กำลังทำ**: แสดงเฉพาะงานที่กำลังดำเนิน
  - **เสร็จแล้ว**: แสดงเฉพาะงานที่เสร็จสิ้น

### ขั้นตอนที่ 6: Export ข้อมูล

1. คลิก **Export CSV** บนปุ่มทำงาน
2. ไฟล์ CSV จะถูกดาวน์โหลดใน folder "Downloads" ของคุณ
3. ไฟล์จะมีชื่อ `student-work-log.csv`
4. เปิดด้วย Excel, Google Sheets หรือโปรแกรมอื่น
5. ข้อมูลจะมีคอลัมน์: title, subject, status, priority, due_date, notes

### ขั้นตอนที่ 7: Calendar View

1. คลิกปุ่ม **Calendar** (ด้านบนขวา)
2. จะเห็นปฏิทินแสดงเดือนปัจจุบัน
3. งานที่ขาดส่งจะแสดงตัวอักษรบนวันที่มีกำหนด
4. หากมีมากกว่า 2 งาน จะแสดง "+N" ที่บ่งบอกจำนวนเพิ่มเติม
5. ใช้ปุ่ม **< ก่อนหน้า** และ **ถัดไป >** เพื่อเปลี่ยนเดือน
6. สีต่างๆ ของงาน:
   - **น้ำเงิน**: ยังไม่เริ่ม (To-Do)
   - **ส้ม**: กำลังทำ (Doing)
   - **เขียว**: เสร็จแล้ว (Done)

### ขั้นตอนที่ 8: ออกจากระบบ

1. คลิกปุ่ม **ออกจากระบบ** (ในเมนูหรือเนื้อหาด้านบนขวา)
2. Session จะถูกลบ
3. จะกลับไปที่หน้า **เข้าสู่ระบบ**

## ฟีเจอร์เพิ่มเติม

### Export CSV
- ดาวน์โหลดงานทั้งหมดเป็นไฟล์ CSV สำหรับแชร์หรือสำรองข้อมูล
- สามารถเปิดด้วย Excel, Google Sheets หรือโปรแกรมอื่น

### Calendar View
- แสดงงานตามวันกำหนดส่ง
- สะดวกในการเลือกดูงานของเดือนใดๆ
- สีต่างๆ ช่วยให้ระบุสถานะงานได้เร็ว

### Drag & Drop Reorder
- จัดลำดับงานตามลำดับความสำคัญส่วนตัว
- ลำดับจะถูกบันทึกโดยอัตโนมัติ
- ใช้งานได้เฉพาะใน List View เท่านั้น

## Docker

```bash
docker compose up --build -d
curl http://localhost:30022/api/health
```

## Windows / local dev

```powershell
cd D:\ครูบิว\projet
npm install
$env:PORT='4001'; node server.js
```

## จุดเด่น

- จัดการงานตามวิชาและวันส่ง
- เก็บงานแยกตามบัญชีผู้ใช้
- ค้นหาและกรองตามสถานะได้ทันที
- export CSV สำหรับส่งต่อหรืออ้างอิง
- calendar view เพื่อดูงานตามวันกำหนดส่ง
- drag-and-drop ใน list mode สำหรับจัดเรียงงาน
- แสดงสรุปความคืบหน้าและงาน overdue

## Troubleshooting (การแก้ปัญหา)

### ปัญหา: หน้า login ไม่เปลี่ยนไปหน้า dashboard หลังจาก login สำเร็จ

**สาเหตุ**: Cookie session ค้างหรือ session ไม่ได้ถูกเซฟเรียบร้อย

**วิธีแก้ไข**:
1. เปิด DevTools (F12 หรือ Ctrl+Shift+I)
2. ไปที่แท็บ **Application** → **Cookies**
3. ลบ cookie ของเว็บไซต์ทั้งหมด (ค้นหา `student_session`)
4. Refresh หน้า (Ctrl+R หรือ F5)
5. ลองเข้าสู่ระบบใหม่

### ปัญหา: แอปไม่โหลด หรือแสดง error 404

**สาเหตุ**: เซิร์ฟเวอร์ไม่ทำงาน หรือ port ถูกใช้ร่วมกับโปรแกรมอื่น

**วิธีแก้ไข**:
1. ตรวจสอบว่าเซิร์ฟเวอร์ทำงานอยู่:
   ```powershell
   curl http://localhost:3000/api/health
   # หรือ
   Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing
   ```
2. หากไม่ได้รับตอบ ให้เริ่มเซิร์ฟเวอร์:
   ```powershell
   cd D:\ครูบิว\projet
   npm start
   ```
3. หากเกิด error "port already in use" ให้เปลี่ยน port:
   ```powershell
   $env:PORT='4001'; node server.js
   ```

### ปัญหา: บัญชีใหม่ไม่สามารถสร้างได้ หรือ error "username already exists"

**วิธีแก้ไข**:
1. ตรวจสอบว่า username เป็นตัวอักษรและตัวเลขเท่านั้น (ไม่มีช่องว่างหรือสัญลักษณ์พิเศษ)
2. ความยาว username ต้อง 3-30 ตัวอักษร
3. ความยาว password ต้อง 6 ตัวอักษรขึ้นไป
4. ลองใช้ username ที่ไม่ซ้ำกัน (username ที่ใช้จะถูกบันทึกใน `data/state.json`)

### ปัญหา: ข้อมูลหรืองานหายไป

**สาเหตุ**: Folder `data/` ถูกลบ หรือไฟล์ `data/state.json` ถูกลบ

**วิธีแก้ไข**:
1. ตรวจสอบว่า folder `data/` มีอยู่:
   ```powershell
   ls -la D:\ครูบิว\projet\data\
   ```
2. หากไม่มี folder ให้เริ่มเซิร์ฟเวอร์ใหม่ (system จะสร้าง auto):
   ```powershell
   npm start
   ```
3. หากไฟล์ `data/state.json` มีอยู่แต่เสียหาย ให้ลบแล้วเริ่มใหม่:
   ```powershell
   rm D:\ครูบิว\projet\data\state.json
   npm start
   ```

### ปัญหา: Export CSV ไม่ทำงาน

**วิธีแก้ไข**:
1. ตรวจสอบว่ามีงานอยู่ในระบบ (export CSV ต้องมีข้อมูลอย่างน้อย 1 งาน)
2. เปิด browser DevTools ดู error message ใน Console
3. ลองรีเฟรชหน้า (Ctrl+R) แล้วลองใหม่

### ปัญหา: Drag & Drop ไม่ทำงาน

**วิธีแก้ไข**:
1. ตรวจสอบว่า view ถูกตั้งเป็น **List** (ไม่ใช่ Calendar)
2. หลีกเลี่ยงการลากบนปุ่ม edit/delete (ลากบนพื้นที่ว่างของการ์ด)
3. ลองรีเฟรชหน้า

### ปัญหา: Calendar ไม่แสดงงาน

**สาเหตุ**: งานไม่มี due date ที่ตั้งไว้

**วิธีแก้ไข**:
1. ตรวจสอบว่างานมี `due_date` ที่ตั้งไว้
2. ปุ่มแก้ไข (✎) เพื่อเปิด dialog และเพิ่มวันส่ง
3. บันทึก แล้วกลับไป Calendar view เพื่อเห็นงาน

## Architecture & Technical Details

### โครงสร้างโฟลเดอร์

```
projet/
├── server.js              # Express server (port 3000 หรือ PORT env)
├── public/                # Static files & frontend
│   ├── index.html         # Main HTML structure
│   ├── app.js             # Frontend logic (auth, CRUD, views)
│   └── styles.css         # Dark theme styling
├── data/                  # JSON storage (auto-created)
│   └── state.json         # User accounts & assignments
├── tests/                 # Test files
│   └── server.test.js     # Smoke test
├── package.json           # Dependencies & npm scripts
├── docker-compose.yml     # Docker orchestration
├── Dockerfile             # Docker build config
└── README.md              # This file
```

### Database Schema (data/state.json)

```json
{
  "accounts": {
    "admin": {
      "username": "admin",
      "password_hash": "scrypt hash...",
      "created_at": "ISO timestamp"
    }
  },
  "assignments": {
    "admin": [
      {
        "id": 1,
        "title": "ทำรายงาน",
        "subject": "Geology",
        "status": "todo|doing|done",
        "priority": "high|normal|low",
        "due_date": "2026-09-15",
        "notes": "Optional notes",
        "created_at": "ISO timestamp",
        "updated_at": "ISO timestamp"
      }
    ]
  }
}
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | เข้าสู่ระบบ (username, password) |
| POST | `/api/register` | สมัครสมาชิก (username, password) |
| GET | `/api/assignments` | ดึงงานของผู้ใช้ปัจจุบัน |
| POST | `/api/assignments` | สร้างงานใหม่ |
| PUT | `/api/assignments/:id` | แก้ไขงาน |
| DELETE | `/api/assignments/:id` | ลบงาน |
| POST | `/api/logout` | ออกจากระบบ |
| GET | `/api/health` | Health check |

### Authentication Flow

1. User สมัครและล็อกอิน
2. Server สร้าง JWT token แบบ HMAC-signed session cookie
3. Cookie ถูกส่งกลับไปที่ client และจัดเก็บใน browser
4. ทุก request ที่ต่อมาจะมี cookie นี้ให้ server ตรวจสอบ
5. หลัง logout, cookie จะถูกล้างออกจาก browser

### Password Security

- Passwords ถูก hash ด้วย **scrypt** algorithm
- ไม่มีการเก็บ plaintext password
- Salt ถูกรวมไว้ใน hash

### Session Management

- Session token ถูกสร้างจาก `username + timestamp + random` แล้ว sign ด้วย HMAC-SHA256
- ถูกจัดเก็บเป็น HTTP-only cookie
- ครั้งต่อไปที่เปิดแอป cookie จะถูก verify อัตโนมัติ
- หลัง logout cookie จะถูกลบและ session จะสิ้นสุด

## Environment Variables

- `PORT`: Port ที่ต้องการให้เซิร์ฟเวอร์ฟัง (ค่าเริ่มต้น: 3000)
- `NODE_ENV`: Environment mode (`development` หรือ `production`)

ตั้งค่าเพื่อหลีกเลี่ยง port conflict:
```powershell
$env:PORT='4001'
node server.js
```

## Performance & Storage

- ข้อมูลถูกเก็บใน JSON file (ไม่มี database server)
- ข้อมูลของแต่ละผู้ใช้แยกจากกันโดยสินค้า username
- สำหรับผู้ใช้จำนวนมาก (~1000+) ควรอัปเกรด MongoDB หรือ PostgreSQL
- Docker volume จะรักษาข้อมูลไว้หลัง restart/redeploy

## Development Guide

### ติดตั้ง & เริ่มต้น

```bash
# Clone repository
git clone https://github.com/68319010020-prog/Student-20.git
cd Student-20

# ติดตั้ง dependencies
npm install

# เริ่มตัวเซิร์ฟเวอร์
npm start

# หรือเริ่มต้นบน port ที่แตกต่าง
$env:PORT='4001'; node server.js
```

### Scripts ที่มี

```bash
npm start            # เริ่มตัวเซิร์ฟเวอร์ (port 3000)
npm run dev          # เริ่มตัวเซิร์ฟเวอร์แบบ development
npm test             # รันการทดสอบ
npm run lint         # ตรวจสอบ code style
npm run format       # Format code
```

### Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript + HTML + CSS (no frameworks)
- **Database**: JSON file storage (data/state.json)
- **Authentication**: Session cookies + HMAC signing
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions → Docker Hub → VPS

### Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### File Size Limits

- Single assignment title: 500 characters
- Subject: 500 characters
- Notes: 5000 characters
- Username: 3-30 characters
- Password: 6+ characters

## Production Deployment

### ตั้งค่า GitHub

เพิ่ม Actions **Secrets** ใน `Settings -> Secrets and variables -> Actions -> Secrets`:

- `SSH_HOST`: `202.29.231.188`
- `SSH_PORT`: `22210`
- `SSH_USER`: `vps01`
- `SSH_PRIVATE_KEY`: เนื้อหา private key ของตัวเองจาก `~/.ssh/vps01_deploy`
- `DOCKERHUB_USERNAME`: `ponlpon`
- `DOCKERHUB_TOKEN`: Docker Hub access token ของตัวเอง

โปรเจกต์นี้กำหนดค่าประจำตัวไว้แล้ว: โฟลเดอร์ `~/apps/tanetpon/`, พอร์ต `30022`, container `tanetpon-student-work-log`, image `ponlpon/student-work-log:latest`

## Onboarding SSH ครั้งแรก

รันบนเครื่องนักเรียนเอง โดยใช้ password ที่ครูแจกเฉพาะครั้งนี้เท่านั้น:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/vps01_deploy -N ""
ssh-copy-id -p 22210 -i ~/.ssh/vps01_deploy.pub vps01@202.29.231.188
ssh -p 22210 -i ~/.ssh/vps01_deploy vps01@202.29.231.188
```

ห้ามนำ password ไปตั้งเป็น GitHub Secret, commit ลง repo หรือใส่ใน workflow

## Deploy

1. ตั้ง Secrets ให้ครบ
2. ตรวจว่าพอร์ต `30022` ไม่ชนกับคนอื่น โดยดู `docker ps` บน VPS
3. Push ไป branch `main`
4. เปิด `http://202.29.231.188:30022`

Workflow จะสร้างโฟลเดอร์ `~/apps/tanetpon/`, อัปโหลด `docker-compose.yml` และรัน `docker compose pull` กับ `docker compose up -d`

## กติกาเครื่องร่วม

- ใช้และแก้เฉพาะ `~/apps/tanetpon/` ของตัวเอง
- ห้ามใช้ `docker system prune -a`, `docker stop $(docker ps -q)`, reboot หรือคำสั่งที่กระทบผู้ใช้อื่น
- ห้ามใช้ชื่อ container หรือ host port ซ้ำ
- ทุกคนใช้ Linux user และ Docker daemon เดียวกัน ไม่มี isolation หรือ resource quota
- private key ต้องอยู่ใน GitHub Secret เท่านั้น และห้ามแชร์กับเพื่อน
- ควรเปลี่ยน shared onboarding password หลังนักเรียน onboard ครบทุกคน
