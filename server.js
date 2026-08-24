const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const port = Number(process.env.PORT || 3000);
const dataDirectory = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

const database = new Database(path.join(dataDirectory, 'student-work-log.db'));
database.pragma('journal_mode = WAL');
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'doing', 'done')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const assignmentColumns = database.prepare('PRAGMA table_info(assignments)').all().map((column) => column.name);
if (!assignmentColumns.includes('user_id')) database.exec('ALTER TABLE assignments ADD COLUMN user_id INTEGER REFERENCES users(id)');
if (!assignmentColumns.includes('priority')) database.exec("ALTER TABLE assignments ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'");

const sessionSecretPath = path.join(dataDirectory, 'session-secret');
if (!fs.existsSync(sessionSecretPath)) fs.writeFileSync(sessionSecretPath, crypto.randomBytes(32), { mode: 0o600 });
const sessionSecret = fs.readFileSync(sessionSecretPath);

const statements = {
  list: database.prepare('SELECT * FROM assignments WHERE user_id = ? ORDER BY CASE WHEN status = \'done\' THEN 1 ELSE 0 END, CASE priority WHEN \'high\' THEN 0 WHEN \'normal\' THEN 1 ELSE 2 END, due_date IS NULL, due_date ASC, id DESC'),
  get: database.prepare('SELECT * FROM assignments WHERE id = ? AND user_id = ?'),
  insert: database.prepare('INSERT INTO assignments (user_id, title, subject, due_date, status, priority, notes) VALUES (@user_id, @title, @subject, @due_date, @status, @priority, @notes)'),
  update: database.prepare('UPDATE assignments SET title=@title, subject=@subject, due_date=@due_date, status=@status, priority=@priority, notes=@notes WHERE id=@id AND user_id=@user_id'),
  remove: database.prepare('DELETE FROM assignments WHERE id = ? AND user_id = ?'),
  userByName: database.prepare('SELECT * FROM users WHERE username = ?'),
  userById: database.prepare('SELECT id, username FROM users WHERE id = ?'),
  createUser: database.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)'),
  claimLegacyAssignments: database.prepare('UPDATE assignments SET user_id = ? WHERE user_id IS NULL')
};

function encode(value) { return Buffer.from(value).toString('base64url'); }
function createSession(user) {
  const payload = encode(JSON.stringify({ id: user.id, username: user.username, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readCookie(header, name) {
  const cookie = (header || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function userFromRequest(req) {
  const token = readCookie(req.headers.cookie, 'student_session');
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session.exp > Date.now() ? statements.userById.get(session.id) : null;
  } catch { return null; }
}

function requireUser(req, res, next) {
  req.user = userFromRequest(req);
  if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
  next();
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `student_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
}

function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function passwordMatches(password, stored) {
  const [, salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function validateAssignment(input) {
  const title = String(input.title || '').trim();
  const subject = String(input.subject || '').trim();
  const status = input.status || 'todo';
  const priority = input.priority || 'normal';
  if (!title || !subject) return { error: 'กรุณากรอกชื่องานและวิชา' };
  if (!['todo', 'doing', 'done'].includes(status)) return { error: 'สถานะไม่ถูกต้อง' };
  if (!['low', 'normal', 'high'].includes(priority)) return { error: 'ระดับความสำคัญไม่ถูกต้อง' };
  return {
    title: title.slice(0, 120),
    subject: subject.slice(0, 80),
    due_date: input.due_date ? String(input.due_date).slice(0, 10) : null,
    status,
    priority,
    notes: String(input.notes || '').trim().slice(0, 500)
  };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/me', (req, res) => {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'ยังไม่ได้เข้าสู่ระบบ' });
  res.json(user);
});

app.post('/api/register', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirm_password || '');
  if (!/^[a-zA-Z0-9_ก-๙-]{3,30}$/.test(username)) return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องยาว 3-30 ตัวอักษร' });
  if (password.length < 6) return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'รหัสผ่านไม่ตรงกัน' });
  if (statements.userByName.get(username)) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
  const result = statements.createUser.run(username, passwordHash(password));
  statements.claimLegacyAssignments.run(result.lastInsertRowid);
  const user = statements.userById.get(result.lastInsertRowid);
  setSessionCookie(res, createSession(user));
  res.status(201).json(user);
});

app.post('/api/login', (req, res) => {
  const user = statements.userByName.get(String(req.body.username || '').trim());
  if (!user || !passwordMatches(String(req.body.password || ''), user.password_hash)) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  setSessionCookie(res, createSession(user));
  res.json({ id: user.id, username: user.username });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'student_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.status(204).end();
});

app.get('/api/assignments', requireUser, (req, res) => {
  res.json(statements.list.all(req.user.id));
});

app.post('/api/assignments', requireUser, (req, res) => {
  const assignment = validateAssignment(req.body);
  if (assignment.error) return res.status(400).json({ error: assignment.error });
  const result = statements.insert.run({ ...assignment, user_id: req.user.id });
  res.status(201).json(statements.get.get(result.lastInsertRowid, req.user.id));
});

app.put('/api/assignments/:id', requireUser, (req, res) => {
  const assignment = validateAssignment(req.body);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'รหัสงานไม่ถูกต้อง' });
  if (assignment.error) return res.status(400).json({ error: assignment.error });
  if (!statements.get.get(id, req.user.id)) return res.status(404).json({ error: 'ไม่พบงานนี้' });
  statements.update.run({ ...assignment, id, user_id: req.user.id });
  res.json(statements.get.get(id, req.user.id));
});

app.delete('/api/assignments/:id', requireUser, (req, res) => {
  const result = statements.remove.run(Number(req.params.id), req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'ไม่พบงานนี้' });
  res.status(204).end();
});

app.get('*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Student Work Log listening on port ${port}`);
});
