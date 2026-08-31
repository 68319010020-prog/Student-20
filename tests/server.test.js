const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

function waitForServer(port) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      const http = require('node:http');
      const req = http.get({ host: '127.0.0.1', port, path: '/api/health' }, (res) => {
        res.resume();
        res.on('end', () => {
          if (res.statusCode === 200) resolve();
          else if (Date.now() - started > 5000) reject(new Error('Server did not become ready'));
          else setTimeout(poll, 100);
        });
      });
      req.on('error', () => {
        if (Date.now() - started > 5000) reject(new Error('Server did not become ready'));
        else setTimeout(poll, 100);
      });
    };
    poll();
  });
}

test('web app serves the homepage and static assets', async () => {
  const port = 4300;
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(port);

    const http = require('node:http');
    const get = (pathName) => new Promise((resolve, reject) => {
      const req = http.get({ host: '127.0.0.1', port, path: pathName }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
    });

    const root = await get('/');
    const css = await get('/styles.css');
    const script = await get('/app.js');

    assert.equal(root.status, 200);
    assert.match(root.body, /สมุดงาน|Student Work/i);
    assert.equal(css.status, 200);
    assert.equal(script.status, 200);
  } finally {
    server.kill('SIGTERM');
  }
});
