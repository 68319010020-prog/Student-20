const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const port = Number(process.env.PORT || 3000);
const dataDirectory = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dataDirectory, { recursive: true });

const database = new Database(path.join(dataDirectory, 'student-work-log.db'));
database.pragma('journal_mode = WAL');
database.exec(`
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'doing', 'done')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const statements = {
  list: database.prepare('SELECT * FROM assignments ORDER BY CASE WHEN status = \'done\' THEN 1 ELSE 0 END, due_date IS NULL, due_date ASC, id DESC'),
  get: database.prepare('SELECT * FROM assignments WHERE id = ?'),
  insert: database.prepare('INSERT INTO assignments (title, subject, due_date, status, notes) VALUES (@title, @subject, @due_date, @status, @notes)'),
  update: database.prepare('UPDATE assignments SET title=@title, subject=@subject, due_date=@due_date, status=@status, notes=@notes WHERE id=@id'),
  remove: database.prepare('DELETE FROM assignments WHERE id = ?')
};

function validateAssignment(input) {
  const title = String(input.title || '').trim();
  const subject = String(input.subject || '').trim();
  const status = input.status || 'todo';
  if (!title || !subject) return { error: 'กรุณากรอกชื่องานและวิชา' };
  if (!['todo', 'doing', 'done'].includes(status)) return { error: 'สถานะไม่ถูกต้อง' };
  return {
    title: title.slice(0, 120),
    subject: subject.slice(0, 80),
    due_date: input.due_date ? String(input.due_date).slice(0, 10) : null,
    status,
    notes: String(input.notes || '').trim().slice(0, 500)
  };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/assignments', (req, res) => {
  res.json(statements.list.all());
});

app.post('/api/assignments', (req, res) => {
  const assignment = validateAssignment(req.body);
  if (assignment.error) return res.status(400).json({ error: assignment.error });
  const result = statements.insert.run(assignment);
  res.status(201).json(statements.get.get(result.lastInsertRowid));
});

app.put('/api/assignments/:id', (req, res) => {
  const assignment = validateAssignment(req.body);
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'รหัสงานไม่ถูกต้อง' });
  if (assignment.error) return res.status(400).json({ error: assignment.error });
  if (!statements.get.get(id)) return res.status(404).json({ error: 'ไม่พบงานนี้' });
  statements.update.run({ ...assignment, id });
  res.json(statements.get.get(id));
});

app.delete('/api/assignments/:id', (req, res) => {
  const result = statements.remove.run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'ไม่พบงานนี้' });
  res.status(204).end();
});

app.get('*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Student Work Log listening on port ${port}`);
});
