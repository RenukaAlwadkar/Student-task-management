/**
 * Student Task Management Application - Client-Side Controller
 * Connects with Cloudflare Workers REST API & Workers KV
 */

// Application State
let tasks = [];
let pendingDeleteId = null;
const API_BASE = '/api/tasks';

// DOM Elements
const taskTableBody = document.getElementById('tasks-table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const searchInput = document.getElementById('task-search-input');
const filterStatus = document.getElementById('filter-status');
const filterPriority = document.getElementById('filter-priority');
const filterSort = document.getElementById('filter-sort');
const refreshBtn = document.getElementById('btn-refresh-tasks');
const showingCount = document.getElementById('showing-task-count');
const seedBtn = document.getElementById('btn-seed-sample-tasks');

// Modal Elements
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');
const btnOpenCreateModal = document.getElementById('btn-open-create-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const formTaskId = document.getElementById('form-task-id');
const formTaskTitle = document.getElementById('form-task-title');
const formTaskPriority = document.getElementById('form-task-priority');
const formTaskStatus = document.getElementById('form-task-status');
const formTaskCategory = document.getElementById('form-task-category');
const formTaskDue = document.getElementById('form-task-due');
const formTaskDesc = document.getElementById('form-task-description');
const btnSubmitText = document.getElementById('btn-submit-text');

// Delete Modal Elements
const deleteModal = document.getElementById('delete-modal');
const btnCloseDeleteModal = document.getElementById('btn-close-delete-modal');
const btnCancelDelete = document.getElementById('btn-cancel-delete');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');
const deleteTaskPreview = document.getElementById('delete-task-preview');

// Stat Counters
const statTotal = document.getElementById('stat-total-count');
const statPending = document.getElementById('stat-pending-count');
const statInProgress = document.getElementById('stat-in-progress-count');
const statCompleted = document.getElementById('stat-completed-count');
const statHigh = document.getElementById('stat-high-count');
const backendStatusText = document.getElementById('backend-status-text');

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadTasks();
});

function initEventListeners() {
  btnOpenCreateModal.addEventListener('click', () => openCreateModal());
  btnCloseModal.addEventListener('click', closeModal);
  btnCancelModal.addEventListener('click', closeModal);
  
  taskForm.addEventListener('submit', handleTaskFormSubmit);

  btnCloseDeleteModal.addEventListener('click', closeDeleteModal);
  btnCancelDelete.addEventListener('click', closeDeleteModal);
  btnConfirmDelete.addEventListener('click', confirmDeleteTask);

  searchInput.addEventListener('input', renderTasks);
  filterStatus.addEventListener('change', renderTasks);
  filterPriority.addEventListener('change', renderTasks);
  filterSort.addEventListener('change', renderTasks);
  refreshBtn.addEventListener('click', () => {
    showToast('Refreshing task list...', 'info');
    loadTasks();
  });

  if (seedBtn) {
    seedBtn.addEventListener('click', seedSampleTasks);
  }

  // Close modals on clicking backdrop
  window.addEventListener('click', (e) => {
    if (e.target === taskModal) closeModal();
    if (e.target === deleteModal) closeDeleteModal();
  });
}

/**
 * Fetch tasks from API (or fallback if running locally)
 */
async function loadTasks() {
  showLoading(true);
  try {
    const response = await fetch(API_BASE);
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }
    const data = await response.json();
    tasks = Array.isArray(data) ? data : (data.tasks || []);
    if (backendStatusText) backendStatusText.textContent = 'Live';
    renderTasks();
  } catch (err) {
    console.warn('API unavailable, utilizing local storage:', err.message);
    if (backendStatusText) backendStatusText.textContent = 'Local Mode';
    // Fallback to localStorage so UI is 100% functional during local testing
    const saved = localStorage.getItem('student_tasks_db');
    if (saved) {
      try {
        tasks = JSON.parse(saved);
        if (tasks.some(t => (t.title && (t.title.includes('Terraform') || t.title.includes('Cloud Computing'))) || 
                            (t.description && (t.description.includes('IaC') || t.description.includes('Cloudflare'))))) {
          tasks = getInitialSampleTasks();
          saveToLocalStorage();
        }
      } catch (e) {
        tasks = getInitialSampleTasks();
      }
    } else {
      tasks = getInitialSampleTasks();
      saveToLocalStorage();
    }
    renderTasks();
  } finally {
    showLoading(false);
  }
}

/**
 * Persist task updates (POST or PUT)
 */
async function handleTaskFormSubmit(e) {
  e.preventDefault();

  const id = formTaskId.value.trim();
  const taskPayload = {
    title: formTaskTitle.value.trim(),
    priority: formTaskPriority.value,
    status: formTaskStatus.value,
    category: formTaskCategory.value,
    dueDate: formTaskDue.value,
    description: formTaskDesc.value.trim()
  };

  try {
    if (id) {
      // Update Task (PUT /api/tasks/{id})
      taskPayload.id = id;
      try {
        const res = await fetch(`${API_BASE}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskPayload)
        });
        if (res.ok) {
          const updated = await res.json();
          updateLocalTask(updated);
        } else {
          fallbackUpdateLocalTask(id, taskPayload);
        }
      } catch {
        fallbackUpdateLocalTask(id, taskPayload);
      }
      showToast(`Task ${id} updated successfully!`, 'success');
    } else {
      // Create Task (POST /api/tasks)
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskPayload)
        });
        if (res.ok) {
          const created = await res.json();
          tasks.unshift(created);
        } else {
          fallbackCreateLocalTask(taskPayload);
        }
      } catch {
        fallbackCreateLocalTask(taskPayload);
      }
      showToast('New academic task created successfully!', 'success');
    }

    saveToLocalStorage();
    renderTasks();
    closeModal();
  } catch (err) {
    showToast(`Error saving task: ${err.message}`, 'error');
  }
}

function fallbackCreateLocalTask(payload) {
  const nextNum = tasks.length + 101;
  const newId = `T${nextNum}`;
  const newTask = {
    id: newId,
    ...payload,
    createdAt: new Date().toISOString()
  };
  tasks.unshift(newTask);
}

function fallbackUpdateLocalTask(id, payload) {
  const idx = tasks.findIndex(t => t.id === id);
  if (idx !== -1) {
    tasks[idx] = { ...tasks[idx], ...payload, updatedAt: new Date().toISOString() };
  }
}

function updateLocalTask(updated) {
  const idx = tasks.findIndex(t => t.id === updated.id);
  if (idx !== -1) {
    tasks[idx] = updated;
  } else {
    tasks.unshift(updated);
  }
}

/**
 * Quick Toggle Status (Test Case 3 requirement)
 */
async function toggleTaskStatus(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  let newStatus = 'Pending';
  if (task.status === 'Pending') newStatus = 'In Progress';
  else if (task.status === 'In Progress') newStatus = 'Completed';
  else newStatus = 'Pending';

  const updatedPayload = { ...task, status: newStatus };

  try {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPayload)
    });
    if (res.ok) {
      const data = await res.json();
      updateLocalTask(data);
    } else {
      task.status = newStatus;
    }
  } catch {
    task.status = newStatus;
  }

  saveToLocalStorage();
  renderTasks();
  showToast(`Task ${id} status updated to ${newStatus}`, 'success');
}

/**
 * Delete Task (DELETE /api/tasks/{id})
 */
function requestDeleteTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  pendingDeleteId = id;
  deleteTaskPreview.textContent = `${task.id}: ${task.title}`;
  deleteModal.style.display = 'flex';
}

async function confirmDeleteTask() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;

  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      console.warn('API deletion returned non-OK status');
    }
  } catch (e) {
    console.warn('API DELETE fallback:', e.message);
  }

  tasks = tasks.filter(t => t.id !== id);
  saveToLocalStorage();
  renderTasks();
  closeDeleteModal();
  showToast(`Task ${id} deleted successfully.`, 'info');
}

/**
 * Filter, Sort, and Render Tasks
 */
function renderTasks() {
  const searchQuery = searchInput.value.toLowerCase().trim();
  const statusFilterVal = filterStatus.value;
  const priorityFilterVal = filterPriority.value;
  const sortVal = filterSort.value;

  // Filter
  let filtered = tasks.filter(task => {
    const matchesSearch = !searchQuery || 
      (task.title && task.title.toLowerCase().includes(searchQuery)) ||
      (task.id && task.id.toLowerCase().includes(searchQuery)) ||
      (task.category && task.category.toLowerCase().includes(searchQuery)) ||
      (task.description && task.description.toLowerCase().includes(searchQuery));

    const matchesStatus = statusFilterVal === 'all' || task.status === statusFilterVal;
    const matchesPriority = priorityFilterVal === 'all' || task.priority === priorityFilterVal;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Sort
  const priorityWeight = { High: 3, Medium: 2, Low: 1 };
  filtered.sort((a, b) => {
    if (sortVal === 'date-desc') {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    } else if (sortVal === 'date-asc') {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    } else if (sortVal === 'priority-desc') {
      return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
    } else if (sortVal === 'priority-asc') {
      return (priorityWeight[a.priority] || 0) - (priorityWeight[b.priority] || 0);
    }
    return 0;
  });

  // Render Table
  taskTableBody.innerHTML = '';
  if (filtered.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    filtered.forEach(task => {
      const row = document.createElement('tr');
      row.id = `task-row-${task.id}`;

      const createdDateFormatted = task.createdAt 
        ? new Date(task.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Recent';

      const priorityClass = `badge-priority-${(task.priority || 'medium').toLowerCase()}`;
      const statusClass = `badge-status-${(task.status || 'pending').toLowerCase().replace(' ', '-')}`;

      row.innerHTML = `
        <td>
          <span class="task-id-badge">${escapeHtml(task.id)}</span>
        </td>
        <td>
          <div class="task-title-cell">
            <span class="task-title-text">${escapeHtml(task.title)}</span>
            ${task.description ? `<span class="task-desc-text">${escapeHtml(task.description)}</span>` : ''}
          </div>
        </td>
        <td>
          <span class="badge badge-category">
            <i class="fa-solid fa-tag"></i> ${escapeHtml(task.category || 'General')}
          </span>
        </td>
        <td>
          <span class="badge ${priorityClass}">
            <i class="fa-solid fa-flag"></i> ${escapeHtml(task.priority || 'Medium')}
          </span>
        </td>
        <td>
          <span class="badge ${statusClass}">
            ${getStatusIcon(task.status)} ${escapeHtml(task.status || 'Pending')}
          </span>
        </td>
        <td style="color: var(--text-dim); font-size: 0.85rem;">
          ${createdDateFormatted}
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-table-action btn-toggle-status" onclick="toggleTaskStatus('${task.id}')" title="Advance status">
              <i class="fa-solid fa-check"></i>
              <span>Status</span>
            </button>
            <button class="btn-table-action" onclick="openEditModal('${task.id}')" title="Edit details">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-table-action btn-delete-row" onclick="requestDeleteTask('${task.id}')" title="Delete from KV">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </td>
      `;
      taskTableBody.appendChild(row);
    });
  }

  // Update Counters
  updateStatistics();
  showingCount.textContent = `Showing ${filtered.length} of ${tasks.length} tasks`;
}

function updateStatistics() {
  const total = tasks.length;
  const pending = tasks.filter(t => t.status === 'Pending').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const high = tasks.filter(t => t.priority === 'High').length;

  statTotal.textContent = total;
  statPending.textContent = pending;
  statInProgress.textContent = inProgress;
  statCompleted.textContent = completed;
  statHigh.textContent = high;
}

function getStatusIcon(status) {
  if (status === 'Completed') return '<i class="fa-solid fa-circle-check"></i>';
  if (status === 'In Progress') return '<i class="fa-solid fa-arrows-rotate"></i>';
  return '<i class="fa-solid fa-clock"></i>';
}

function openCreateModal() {
  taskForm.reset();
  formTaskId.value = '';
  modalTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Create New Task';
  btnSubmitText.textContent = 'Save Task';
  taskModal.style.display = 'flex';
  formTaskTitle.focus();
}

function openEditModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  formTaskId.value = task.id;
  formTaskTitle.value = task.title || '';
  formTaskPriority.value = task.priority || 'Medium';
  formTaskStatus.value = task.status || 'Pending';
  formTaskCategory.value = task.category || 'General';
  formTaskDue.value = task.dueDate || '';
  formTaskDesc.value = task.description || '';

  modalTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Task (${escapeHtml(task.id)})`;
  btnSubmitText.textContent = 'Update Task';
  taskModal.style.display = 'flex';
  formTaskTitle.focus();
}

function closeModal() {
  taskModal.style.display = 'none';
}

function closeDeleteModal() {
  deleteModal.style.display = 'none';
  pendingDeleteId = null;
}

function showLoading(show) {
  loadingState.style.display = show ? 'flex' : 'none';
}

function saveToLocalStorage() {
  try {
    localStorage.setItem('student_tasks_db', JSON.stringify(tasks));
  } catch (e) {
    console.error('Local storage quota exceeded', e);
  }
}

function seedSampleTasks() {
  tasks = getInitialSampleTasks();
  saveToLocalStorage();
  renderTasks();
  showToast('Academic sample tasks loaded into system!', 'success');
}

function getInitialSampleTasks() {
  return [
    {
      id: "T101",
      title: "Complete Operating Systems Lab Assignment",
      priority: "High",
      status: "Pending",
      category: "Assignment",
      dueDate: "2026-10-25",
      description: "Implement CPU scheduling algorithms and multithreaded synchronization in C++.",
      createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString()
    },
    {
      id: "T102",
      title: "Prepare Final Year Seminar Presentation",
      priority: "High",
      status: "In Progress",
      category: "Presentation",
      dueDate: "2026-10-30",
      description: "Prepare slides covering project methodology, architecture, and live demonstration.",
      createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString()
    },
    {
      id: "T103",
      title: "Submit Term Project Documentation",
      priority: "Medium",
      status: "Completed",
      category: "Project",
      dueDate: "2026-10-18",
      description: "Format and submit final report document according to department guidelines.",
      createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString()
    },
    {
      id: "T104",
      title: "Database Management Final Exam Prep",
      priority: "High",
      status: "Pending",
      category: "Examination",
      dueDate: "2026-11-02",
      description: "Review normalization, indexing, query optimization, and ACID transaction properties.",
      createdAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString()
    },
    {
      id: "T105",
      title: "Computer Networks Packet Tracer Lab",
      priority: "Low",
      status: "Completed",
      category: "Lab Work",
      dueDate: "2026-10-15",
      description: "Design and verify VLAN routing and subnet topologies using packet analyzer.",
      createdAt: new Date(Date.now() - 3600000 * 24 * 6).toISOString()
    }
  ];
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Make functions accessible from onclick table buttons
window.toggleTaskStatus = toggleTaskStatus;
window.openEditModal = openEditModal;
window.requestDeleteTask = requestDeleteTask;
