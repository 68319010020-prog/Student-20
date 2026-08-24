const state = { assignments: [], filter: 'all', search: '' };
const labels = { todo: 'ยังไม่เริ่ม', doing: 'กำลังทำ', done: 'เสร็จแล้ว' };
const list = document.querySelector('#assignmentList');
const dialog = document.querySelector('#assignmentDialog');
const form = document.querySelector('#assignmentForm');
const authView = document.querySelector('#authView');
const appShell = document.querySelector('#appShell');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const formatDate = (value) => value ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : 'ไม่ระบุวันส่ง';

async function request(url, options) {
  const response = await fetch(url, options);
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  return body;
}

function render() {
  const visible = state.assignments.filter((item) => {
    const matchesFilter = state.filter === 'all' || item.status === state.filter;
    const query = state.search.toLowerCase();
    return matchesFilter && (!query || `${item.title} ${item.subject} ${item.notes}`.toLowerCase().includes(query));
  });
  list.innerHTML = visible.length ? visible.map((item) => `<article class="assignment ${item.status}">
    <div class="assignment-bar"></div><div class="assignment-main"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.subject)}${item.notes ? ` · ${escapeHtml(item.notes)}` : ''}</p></div>
    <div class="assignment-meta"><span class="badge">${labels[item.status]}</span><span class="due ${item.due_date && item.status !== 'done' && item.due_date < new Date().toISOString().slice(0,10) ? 'overdue' : ''}">${formatDate(item.due_date)}</span><div class="actions"><button class="icon-button edit-button" data-id="${item.id}" aria-label="แก้ไข">✎</button><button class="icon-button delete-button" data-id="${item.id}" aria-label="ลบ">×</button></div></div>
  </article>`).join('') : '<div class="empty"><strong>ยังไม่มีงานในมุมมองนี้</strong><span>เพิ่มงานแรกของคุณ แล้วค่อยๆ ทำให้เสร็จทีละอย่าง</span></div>';
  const done = state.assignments.filter((item) => item.status === 'done').length;
  const doing = state.assignments.filter((item) => item.status === 'doing').length;
  const progress = state.assignments.length ? Math.round(done / state.assignments.length * 100) : 0;
  document.querySelector('#totalCount').textContent = state.assignments.length;
  document.querySelector('#doingCount').textContent = doing;
  document.querySelector('#doneCount').textContent = done;
  document.querySelector('#progressText').textContent = `${progress}%`;
  document.querySelector('#progressBar').style.width = `${progress}%`;
  document.querySelector('#listHint').textContent = `${visible.length} รายการที่แสดง · อัปเดตอัตโนมัติเมื่อบันทึก`;
}

async function loadAssignments() { state.assignments = await request('/api/assignments'); render(); }
function openForm(item) {
  form.reset(); document.querySelector('#assignmentId').value = item?.id || ''; document.querySelector('#dialogTitle').textContent = item ? 'แก้ไขงาน' : 'เพิ่มงานใหม่';
  if (item) ['title', 'subject', 'due_date', 'status', 'notes'].forEach((field) => { document.querySelector(`#${field === 'due_date' ? 'dueDate' : field}Input`).value = item[field] || ''; });
  dialog.showModal(); document.querySelector('#titleInput').focus();
}

function showWorkspace(user) { authView.hidden = true; appShell.hidden = false; document.querySelector('#logoutButton').hidden = false; document.querySelector('#userName').hidden = false; document.querySelector('#userName').textContent = user.username; loadAssignments().catch(showAuthError); }
function showAuthError(error) { document.querySelector('#authError').textContent = error.message; }
async function checkSession() { try { const user = await request('/api/me'); showWorkspace(user); } catch { authView.hidden = false; appShell.hidden = true; document.querySelector('#logoutButton').hidden = true; } }

document.querySelector('#authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const isRegistering = event.target.dataset.register === 'true';
  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true; document.querySelector('#authError').textContent = '';
  try { const user = await request(`/api/${isRegistering ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: document.querySelector('#authUsername').value, password: document.querySelector('#authPassword').value, confirm_password: document.querySelector('#authConfirmPassword').value }) }); showWorkspace(user); } catch (error) { showAuthError(error); } finally { button.disabled = false; }
});
document.querySelector('#registerButton').addEventListener('click', (event) => { const authForm = document.querySelector('#authForm'); const registering = authForm.dataset.register === 'true'; authForm.dataset.register = String(!registering); document.querySelector('#confirmPasswordLabel').hidden = registering; document.querySelector('#authConfirmPassword').required = !registering; authForm.querySelector('button[type="submit"]').innerHTML = registering ? '<span>→</span>เข้าสู่ระบบ' : '<span>+</span>สร้างบัญชี'; event.currentTarget.textContent = registering ? 'ยังไม่มีบัญชี? สร้างบัญชีใหม่' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'; authForm.reset(); document.querySelector('#authError').textContent = ''; });
document.querySelector('#logoutButton').addEventListener('click', async () => { await request('/api/logout', { method: 'POST' }); window.location.reload(); });
form.addEventListener('submit', async (event) => { event.preventDefault(); const body = Object.fromEntries(new FormData(form)); const id = document.querySelector('#assignmentId').value; try { await request(`/api/assignments${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); dialog.close(); await loadAssignments(); } catch (error) { alert(error.message); } });
document.querySelector('#addButton').addEventListener('click', () => openForm());
document.querySelector('#closeButton').addEventListener('click', () => dialog.close());
document.querySelector('#cancelButton').addEventListener('click', () => dialog.close());
document.querySelector('#searchInput').addEventListener('input', (event) => { state.search = event.target.value; render(); });
document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => { document.querySelector('.filter.active').classList.remove('active'); button.classList.add('active'); state.filter = button.dataset.filter; render(); }));
list.addEventListener('click', async (event) => { const id = Number(event.target.dataset.id); if (!id) return; const item = state.assignments.find((assignment) => assignment.id === id); if (event.target.classList.contains('edit-button')) openForm(item); if (event.target.classList.contains('delete-button') && confirm(`ลบงาน “${item.title}” ใช่ไหม`)) { await request(`/api/assignments/${id}`, { method: 'DELETE' }); await loadAssignments(); } });
const now = new Date(); document.querySelector('#todayDate').textContent = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }).format(now); checkSession();