const state = { assignments: [], filter: 'all', search: '' };
const labels = { todo: 'ยังไม่เริ่ม', doing: 'กำลังทำ', done: 'เสร็จแล้ว' };
const list = document.querySelector('#assignmentList');
const dialog = document.querySelector('#assignmentDialog');
const form = document.querySelector('#assignmentForm');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const formatDate = (value) => value ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : 'ไม่ระบุวันส่ง';

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

async function loadAssignments() { state.assignments = await fetch('/api/assignments').then((response) => response.json()); render(); }
function openForm(item) {
  form.reset(); document.querySelector('#assignmentId').value = item?.id || ''; document.querySelector('#dialogTitle').textContent = item ? 'แก้ไขงาน' : 'เพิ่มงานใหม่';
  if (item) ['title', 'subject', 'due_date', 'status', 'notes'].forEach((field) => { document.querySelector(`#${field === 'due_date' ? 'dueDate' : field}Input`).value = item[field] || ''; });
  dialog.showModal(); document.querySelector('#titleInput').focus();
}

form.addEventListener('submit', async (event) => { event.preventDefault(); const body = Object.fromEntries(new FormData(form)); const id = document.querySelector('#assignmentId').value; await fetch(`/api/assignments${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); dialog.close(); await loadAssignments(); });
document.querySelector('#addButton').addEventListener('click', () => openForm());
document.querySelector('#closeButton').addEventListener('click', () => dialog.close());
document.querySelector('#cancelButton').addEventListener('click', () => dialog.close());
document.querySelector('#searchInput').addEventListener('input', (event) => { state.search = event.target.value; render(); });
document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => { document.querySelector('.filter.active').classList.remove('active'); button.classList.add('active'); state.filter = button.dataset.filter; render(); }));
list.addEventListener('click', async (event) => { const id = Number(event.target.dataset.id); if (!id) return; const item = state.assignments.find((assignment) => assignment.id === id); if (event.target.classList.contains('edit-button')) openForm(item); if (event.target.classList.contains('delete-button') && confirm(`ลบงาน “${item.title}” ใช่ไหม`)) { await fetch(`/api/assignments/${id}`, { method: 'DELETE' }); await loadAssignments(); } });
const now = new Date(); document.querySelector('#todayDate').textContent = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }).format(now); loadAssignments();
