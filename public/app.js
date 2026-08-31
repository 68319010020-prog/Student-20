const state = {
  assignments: [],
  filter: 'all',
  search: '',
  lastUpdated: null,
  view: 'list',
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),
  dragTargetId: null,
};
const labels = { todo: 'ยังไม่เริ่ม', doing: 'กำลังทำ', done: 'เสร็จแล้ว' };
const list = document.querySelector('#assignmentList');
const listView = document.querySelector('#listView');
const calendarView = document.querySelector('#calendarView');
const calendarDays = document.querySelector('#calendarDays');
const calendarMonthLabel = document.querySelector('#calendarMonthLabel');
const dialog = document.querySelector('#assignmentDialog');
const form = document.querySelector('#assignmentForm');
const authView = document.querySelector('#authView');
const appShell = document.querySelector('#appShell');
const appVersion = document.querySelector('#appVersion');
const authForm = document.querySelector('#authForm');
const confirmPasswordLabel = document.querySelector('#confirmPasswordLabel');
const authConfirmPassword = document.querySelector('#authConfirmPassword');
const registerButton = document.querySelector('#registerButton');

authForm.dataset.register = 'false';
confirmPasswordLabel.hidden = true;
authConfirmPassword.required = false;

const escapeHtml = value =>
  String(value ?? '').replace(
    /[&<>'"]/g,
    character =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]
  );
const formatDate = value =>
  value
    ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(`${value}T00:00:00`)
      )
    : 'ไม่ระบุวันส่ง';
const formatTime = value =>
  value
    ? new Intl.DateTimeFormat('th-TH', { hour: 'numeric', minute: '2-digit' }).format(
        new Date(value)
      )
    : 'เมื่อสักครู่';

async function request(url, options) {
  const response = await fetch(url, options);
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  return body;
}

function getOrderedAssignments() {
  const order = [...state.assignments].sort((a, b) => Number(a.id) - Number(b.id));
  return order;
}

function getVisibleAssignments() {
  const ordered = getOrderedAssignments();
  return ordered.filter(item => {
    const matchesFilter = state.filter === 'all' || item.status === state.filter;
    const query = state.search.toLowerCase();
    return (
      matchesFilter &&
      (!query || `${item.title} ${item.subject} ${item.notes}`.toLowerCase().includes(query))
    );
  });
}

function renderCalendar() {
  if (!calendarDays) return;

  const monthStart = new Date(state.calendarYear, state.calendarMonth, 1);
  const monthEnd = new Date(state.calendarYear, state.calendarMonth + 1, 0);
  const firstWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const monthLabel = new Intl.DateTimeFormat('th-TH', {
    month: 'long',
    year: 'numeric',
  }).format(monthStart);

  calendarMonthLabel.textContent = monthLabel;
  calendarDays.innerHTML = '';

  for (let index = 0; index < firstWeekday; index += 1) {
    const spacer = document.createElement('div');
    spacer.className = 'calendar-cell is-empty';
    calendarDays.appendChild(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cell = document.createElement('div');
    const dateKey = `${state.calendarYear}-${String(state.calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const matches = state.assignments.filter(item => item.due_date === dateKey);

    cell.className = 'calendar-cell';
    cell.dataset.date = dateKey;
    cell.innerHTML = `
      <div class="calendar-day-number">${day}</div>
      <div class="calendar-day-items">
        ${matches
          .slice(0, 2)
          .map(
            item => `<span class="calendar-task ${item.status}">${escapeHtml(item.title)}</span>`
          )
          .join('')}
        ${matches.length > 2 ? `<span class="calendar-more">+${matches.length - 2}</span>` : ''}
      </div>
    `;
    calendarDays.appendChild(cell);
  }
}

function render() {
  const visible = getVisibleAssignments();

  if (appVersion) {
    appVersion.textContent = 'v1.1';
  }

  const done = state.assignments.filter(item => item.status === 'done').length;
  const doing = state.assignments.filter(item => item.status === 'doing').length;
  const todo = state.assignments.filter(item => item.status === 'todo').length;
  const overdue = state.assignments.filter(
    item =>
      item.status !== 'done' &&
      item.due_date &&
      item.due_date < new Date().toISOString().slice(0, 10)
  ).length;
  const progress = state.assignments.length
    ? Math.round((done / state.assignments.length) * 100)
    : 0;

  list.innerHTML = visible.length
    ? visible
        .map(
          item => `<article class="assignment ${item.status}" draggable="true" data-id="${item.id}">
    <div class="assignment-bar"></div><div class="assignment-main"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.subject)}${item.notes ? ` · ${escapeHtml(item.notes)}` : ''}</p></div>
    <div class="assignment-meta"><span class="badge">${labels[item.status]}</span>${item.priority === 'high' ? '<span class="priority-badge">สำคัญมาก</span>' : item.priority === 'low' ? '<span class="priority-badge low">ไว้ทีหลัง</span>' : ''}<span class="due ${item.due_date && item.status !== 'done' && item.due_date < new Date().toISOString().slice(0, 10) ? 'overdue' : ''}">${formatDate(item.due_date)}</span><div class="actions"><button class="icon-button edit-button" data-id="${item.id}" aria-label="แก้ไข">✎</button><button class="icon-button delete-button" data-id="${item.id}" aria-label="ลบ">×</button></div></div>
  </article>`
        )
        .join('')
    : '<div class="empty"><strong>ยังไม่มีงานในมุมมองนี้</strong><span>เพิ่มงานแรกของคุณ แล้วค่อยๆ ทำให้เสร็จทีละอย่าง</span></div>';

  document.querySelector('#totalCount').textContent = state.assignments.length;
  document.querySelector('#todoCount').textContent = todo;
  document.querySelector('#doingCount').textContent = doing;
  document.querySelector('#doneCount').textContent = done;
  document.querySelector('#progressText').textContent = `${progress}%`;
  document.querySelector('#progressBar').style.width = `${progress}%`;
  document.querySelector('#overdueText').textContent = `${overdue} งาน overdue`;
  document.querySelector('#lastUpdatedText').textContent = state.lastUpdated
    ? `อัปเดต ${formatTime(state.lastUpdated)}`
    : 'อัปเดตล่าสุด';
  document.querySelector('#listHint').textContent =
    `${visible.length} รายการที่แสดง · อัปเดตอัตโนมัติเมื่อบันทึก`;

  renderCalendar();
  listView.classList.toggle('hidden', state.view !== 'list');
  calendarView.classList.toggle('hidden', state.view !== 'calendar');
  document.querySelectorAll('.view-button').forEach(button => {
    button.classList.toggle('active', button.dataset.view === state.view);
  });
}

async function loadAssignments() {
  state.assignments = await request('/api/assignments');
  state.lastUpdated = new Date().toISOString();
  render();
}

function exportAssignments() {
  const csvRows = [['title', 'subject', 'status', 'priority', 'due_date', 'notes']];
  state.assignments.forEach(item => {
    csvRows.push([
      item.title,
      item.subject,
      item.status,
      item.priority,
      item.due_date || '',
      item.notes || '',
    ]);
  });

  const csvContent = csvRows
    .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'student-work-log.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function openForm(item) {
  form.reset();
  document.querySelector('#assignmentId').value = item?.id || '';
  document.querySelector('#dialogTitle').textContent = item ? 'แก้ไขงาน' : 'เพิ่มงานใหม่';
  if (item)
    ['title', 'subject', 'due_date', 'status', 'priority', 'notes'].forEach(field => {
      document.querySelector(`#${field === 'due_date' ? 'dueDate' : field}Input`).value =
        item[field] || '';
    });
  dialog.showModal();
  document.querySelector('#titleInput').focus();
}

function showWorkspace(user) {
  authView.classList.remove('is-exiting');
  authView.hidden = true;
  appShell.hidden = false;
  appShell.classList.remove('is-hidden');
  appShell.classList.add('is-visible');
  document.querySelector('#logoutButton').hidden = false;
  document.querySelector('#userName').hidden = false;
  document.querySelector('#userName').textContent = user.username;
  loadAssignments().catch(showAuthError);
}

function showAuthView() {
  appShell.classList.remove('is-visible');
  appShell.hidden = true;
  authView.hidden = false;
  authView.classList.remove('is-exiting');
  requestAnimationFrame(() => {
    authView.classList.add('is-visible');
  });
  document.querySelector('#logoutButton').hidden = true;
  document.querySelector('#userName').hidden = true;
  document.querySelector('#userName').textContent = '';
  document.querySelector('#authError').textContent = '';
}

function finalizeAuthSuccess(user) {
  const authForm = document.querySelector('#authForm');
  authForm.reset();
  authForm.dataset.register = 'false';
  document.querySelector('#confirmPasswordLabel').hidden = true;
  document.querySelector('#authConfirmPassword').required = false;
  authForm.querySelector('button[type="submit"]').innerHTML = '<span>→</span>เข้าสู่ระบบ';
  document.querySelector('#registerButton').textContent = 'ยังไม่มีบัญชี? สร้างบัญชีใหม่';
  authView.classList.add('is-exiting');
  setTimeout(() => showWorkspace(user), 180);
}

function showAuthError(error) {
  document.querySelector('#authError').textContent = error.message;
}
async function checkSession() {
  try {
    const user = await request('/api/me');
    showWorkspace(user);
  } catch {
    showAuthView();
  }
}

document.querySelector('#authForm').addEventListener('submit', async event => {
  event.preventDefault();
  const isRegistering = event.target.dataset.register === 'true';
  const button = event.target.querySelector('button[type="submit"]');
  button.disabled = true;
  document.querySelector('#authError').textContent = '';
  try {
    const user = await request(`/api/${isRegistering ? 'register' : 'login'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.querySelector('#authUsername').value,
        password: document.querySelector('#authPassword').value,
        confirm_password: document.querySelector('#authConfirmPassword').value,
      }),
    });
    finalizeAuthSuccess(user);
  } catch (error) {
    showAuthError(error);
  } finally {
    button.disabled = false;
  }
});
document.querySelector('#registerButton').addEventListener('click', event => {
  const authForm = document.querySelector('#authForm');
  const registering = authForm.dataset.register === 'true';
  authForm.dataset.register = String(!registering);
  document.querySelector('#confirmPasswordLabel').hidden = registering;
  document.querySelector('#authConfirmPassword').required = !registering;
  authForm.querySelector('button[type="submit"]').innerHTML = registering
    ? '<span>→</span>เข้าสู่ระบบ'
    : '<span>+</span>สร้างบัญชี';
  event.currentTarget.textContent = registering
    ? 'ยังไม่มีบัญชี? สร้างบัญชีใหม่'
    : 'มีบัญชีแล้ว? เข้าสู่ระบบ';
  authForm.reset();
  document.querySelector('#authError').textContent = '';
});
document.querySelector('#logoutButton').addEventListener('click', async () => {
  await request('/api/logout', { method: 'POST' });
  window.location.reload();
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(form));
  const id = document.querySelector('#assignmentId').value;
  try {
    await request(`/api/assignments${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    dialog.close();
    await loadAssignments();
  } catch (error) {
    alert(error.message);
  }
});
document.querySelector('#addButton').addEventListener('click', () => openForm());

document.querySelector('#exportButton').addEventListener('click', exportAssignments);

document.querySelector('#calendarPrev').addEventListener('click', () => {
  state.calendarMonth -= 1;
  if (state.calendarMonth < 0) {
    state.calendarMonth = 11;
    state.calendarYear -= 1;
  }
  renderCalendar();
});

document.querySelector('#calendarNext').addEventListener('click', () => {
  state.calendarMonth += 1;
  if (state.calendarMonth > 11) {
    state.calendarMonth = 0;
    state.calendarYear += 1;
  }
  renderCalendar();
});

document.querySelector('.view-button[data-view="list"]').addEventListener('click', () => {
  state.view = 'list';
  render();
});
document.querySelector('.view-button[data-view="calendar"]').addEventListener('click', () => {
  state.view = 'calendar';
  render();
});
document.querySelector('#closeButton').addEventListener('click', () => dialog.close());
document.querySelector('#cancelButton').addEventListener('click', () => dialog.close());
document.querySelector('#searchInput').addEventListener('input', event => {
  state.search = event.target.value;
  render();
});
document.querySelectorAll('.filter').forEach(button =>
  button.addEventListener('click', () => {
    document.querySelector('.filter.active').classList.remove('active');
    button.classList.add('active');
    state.filter = button.dataset.filter;
    render();
  })
);
list.addEventListener('click', async event => {
  const id = Number(event.target.dataset.id);
  if (!id) return;
  const item = state.assignments.find(assignment => assignment.id === id);
  if (event.target.classList.contains('edit-button')) openForm(item);
  if (event.target.classList.contains('delete-button') && confirm(`ลบงาน “${item.title}” ใช่ไหม`)) {
    await request(`/api/assignments/${id}`, { method: 'DELETE' });
    await loadAssignments();
  }
});

list.addEventListener('dragstart', event => {
  const card = event.target.closest('.assignment');
  if (!card) return;
  state.dragTargetId = Number(card.dataset.id);
  event.dataTransfer.effectAllowed = 'move';
});

list.addEventListener('dragover', event => {
  const card = event.target.closest('.assignment');
  if (!card) return;
  event.preventDefault();
  card.classList.add('is-drop-target');
});

list.addEventListener('dragleave', event => {
  const card = event.target.closest('.assignment');
  if (card) card.classList.remove('is-drop-target');
});

list.addEventListener('drop', event => {
  const card = event.target.closest('.assignment');
  if (!card || state.dragTargetId === null) return;
  event.preventDefault();
  const targetId = Number(card.dataset.id);
  if (targetId === state.dragTargetId) return;

  const current = [...state.assignments];
  const sourceIndex = current.findIndex(item => Number(item.id) === state.dragTargetId);
  const targetIndex = current.findIndex(item => Number(item.id) === targetId);

  if (sourceIndex < 0 || targetIndex < 0) return;

  const [moved] = current.splice(sourceIndex, 1);
  current.splice(targetIndex, 0, moved);
  state.assignments = current;
  state.dragTargetId = null;
  list.querySelectorAll('.assignment').forEach(item => item.classList.remove('is-drop-target'));
  render();
});

const now = new Date();
document.querySelector('#todayDate').textContent = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(now);
appShell.hidden = true;
authView.hidden = false;
authView.classList.add('is-visible');
if (document.cookie.includes('student_session=')) {
  checkSession();
} else {
  showAuthView();
}
