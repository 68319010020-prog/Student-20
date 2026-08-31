const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');

const app = express();
const port = Number(process.env.PORT || 3000);
const dataDirectory = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

const dataFile = path.join(dataDirectory, 'student-work-log.json');
const sessionSecretPath = path.join(dataDirectory, 'session-secret');

if (!fs.existsSync(sessionSecretPath)) {
  fs.writeFileSync(sessionSecretPath, crypto.randomBytes(32), { mode: 0o600 });
}
const sessionSecret = fs.readFileSync(sessionSecretPath);

function defaultState() {
  return { users: [], assignments: [] };
}

function ensureDemoAccount() {
  const demoUsername = 'admin';
  const demoPassword = 'admin123';

  if (!getUserByName(demoUsername)) {
    state.users.push({
      id: nextId(state.users),
      username: demoUsername,
      password_hash: passwordHash(demoPassword),
      created_at: new Date().toISOString(),
      is_demo: true,
    });
    saveState();
  }
}

function loadState() {
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
    };
  } catch {
    const fresh = defaultState();
    fs.writeFileSync(dataFile, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}

let state = loadState();
ensureDemoAccount();

function saveState() {
  fs.writeFileSync(dataFile, JSON.stringify(state, null, 2));
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function sortAssignments(list) {
  const order = { high: 0, normal: 1, low: 2 };
  return [...list].sort((a, b) => {
    if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
    const aPriority = order[a.priority] ?? 1;
    const bPriority = order[b.priority] ?? 1;
    if (aPriority !== bPriority) return aPriority - bPriority;

    const aDue = a.due_date
      ? new Date(`${a.due_date}T00:00:00`).getTime()
      : Number.MAX_SAFE_INTEGER;
    const bDue = b.due_date
      ? new Date(`${b.due_date}T00:00:00`).getTime()
      : Number.MAX_SAFE_INTEGER;
    if (aDue !== bDue) return aDue - bDue;
    return Number(b.id) - Number(a.id);
  });
}

function getUserByName(username) {
  const target = String(username || '').trim();
  return state.users.find(user => user.username.toLowerCase() === target.toLowerCase());
}

function getUserById(id) {
  return state.users.find(user => Number(user.id) === Number(id));
}

function getAssignmentsForUser(userId) {
  return sortAssignments(state.assignments.filter(item => Number(item.user_id) === Number(userId)));
}

function getAssignmentById(id, userId) {
  return state.assignments.find(
    item => Number(item.id) === Number(id) && Number(item.user_id) === Number(userId)
  );
}

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function createSession(user) {
  const payload = encode(
    JSON.stringify({
      id: user.id,
      username: user.username,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })
  );
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function readCookie(header, name) {
  const cookie = (header || '')
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function userFromRequest(req) {
  const token = readCookie(req.headers.cookie, 'student_session');
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session.exp > Date.now() ? getUserById(session.id) : null;
  } catch {
    return null;
  }
}

function requireUser(req, res, next) {
  req.user = userFromRequest(req);
  if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
  next();
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `student_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`
  );
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
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  );
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
    notes: String(input.notes || '')
      .trim()
      .slice(0, 500),
  };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    ok: true,
    name: 'student-work-log',
    users: state.users.length,
    assignments: state.assignments.length,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/me', (req, res) => {
  const user = userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'ยังไม่ได้เข้าสู่ระบบ' });

  const { password_hash: _passwordHash, ...safeUser } = user;
  res.json(safeUser);
});

app.get('/api/dashboard', requireUser, (req, res) => {
  const tasks = getAssignmentsForUser(req.user.id);
  res.json({
    total: tasks.length,
    todo: tasks.filter(item => item.status === 'todo').length,
    doing: tasks.filter(item => item.status === 'doing').length,
    done: tasks.filter(item => item.status === 'done').length,
    overdue: tasks.filter(
      item =>
        item.status !== 'done' &&
        item.due_date &&
        item.due_date < new Date().toISOString().slice(0, 10)
    ).length,
  });
});

app.post('/api/register', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirm_password || '');

  if (!/^[a-zA-Z0-9_ก-๙-]{3,30}$/.test(username))
    return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องยาว 3-30 ตัวอักษร' });
  if (password.length < 6)
    return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  if (password !== confirmPassword) return res.status(400).json({ error: 'รหัสผ่านไม่ตรงกัน' });
  if (getUserByName(username)) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });

  const user = {
    id: nextId(state.users),
    username,
    password_hash: passwordHash(password),
    created_at: new Date().toISOString(),
  };

  state.users.push(user);
  saveState();
  setSessionCookie(res, createSession(user));

  const { password_hash: _passwordHash, ...safeUser } = user;
  res.status(201).json(safeUser);
});

app.post('/api/login', (req, res) => {
  const user = getUserByName(String(req.body.username || '').trim());
  if (!user || !passwordMatches(String(req.body.password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }

  setSessionCookie(res, createSession(user));
  const { password_hash: _passwordHash, ...safeUser } = user;
  res.json(safeUser);
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'student_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.status(204).end();
});

app.get('/api/assignments', requireUser, (req, res) => {
  res.json(getAssignmentsForUser(req.user.id));
});

app.post('/api/assignments', requireUser, (req, res) => {
  const assignment = validateAssignment(req.body);
  if (assignment.error) return res.status(400).json({ error: assignment.error });

  const newAssignment = {
    id: nextId(state.assignments),
    user_id: req.user.id,
    created_at: new Date().toISOString(),
    ...assignment,
  };

  state.assignments.push(newAssignment);
  saveState();
  res.status(201).json(newAssignment);
});

app.put('/api/assignments/:id', requireUser, (req, res) => {
  const assignment = validateAssignment(req.body);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'รหัสงานไม่ถูกต้อง' });
  if (assignment.error) return res.status(400).json({ error: assignment.error });

  const target = getAssignmentById(id, req.user.id);
  if (!target) return res.status(404).json({ error: 'ไม่พบงานนี้' });

  state.assignments = state.assignments.map(item =>
    Number(item.id) === Number(id) && Number(item.user_id) === Number(req.user.id)
      ? { ...item, ...assignment }
      : item
  );

  saveState();
  res.json(getAssignmentById(id, req.user.id));
});

app.delete('/api/assignments/:id', requireUser, (req, res) => {
  const id = Number(req.params.id);
  const existed = getAssignmentById(id, req.user.id);
  if (!existed) return res.status(404).json({ error: 'ไม่พบงานนี้' });

  state.assignments = state.assignments.filter(
    item => !(Number(item.id) === Number(id) && Number(item.user_id) === Number(req.user.id))
  );
  saveState();
  res.status(204).end();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Student Work Log listening on port ${port}`);
});
