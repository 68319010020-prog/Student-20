# ระบบบันทึกงานนักเรียน | Tanetpon

เว็บบันทึกงานนักเรียนแบบ full-stack ใช้ Express + SQLite และ deploy ด้วยเส้นทาง GitHub Actions -> Docker Hub -> VPS `vps01`

ฟีเจอร์: สมัคร/เข้าสู่ระบบ, เพิ่ม/แก้ไข/ลบงาน, ค้นหา, กรองสถานะ, วันกำหนดส่ง, ระดับความสำคัญ, โน้ต และสรุปความคืบหน้า ข้อมูล SQLite ถูกเก็บใน Docker volume จึงอยู่ต่อหลัง redeploy และงานของแต่ละบัญชีแยกจากกัน งานสำคัญจะแสดงก่อนงานปกติ

## เริ่มใช้งาน

เปิดเว็บแล้วกด `สร้างบัญชีใหม่` กำหนดชื่อผู้ใช้ 3-30 ตัวอักษรและรหัสผ่านอย่างน้อย 6 ตัวอักษร จากนั้นเพิ่มงานได้ทันที บัญชีนี้ใช้สำหรับโปรเจกต์สาธิตบนเซิร์ฟเวอร์เท่านั้น ไม่ควรใช้รหัสผ่านเดียวกับบัญชีสำคัญอื่น

## ตั้งค่า GitHub

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
