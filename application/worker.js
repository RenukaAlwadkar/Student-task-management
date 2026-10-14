/**
 * Cloudflare Worker: Student Task Management Service
 * Provides REST API (/api/tasks) and serves Web UI
 * Persists data to Cloudflare Workers KV via TASKS_KV binding
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Seed tasks from project scenario
const INITIAL_TASKS = [
  {
    id: 'T101',
    title: 'Complete Cloud Computing Assignment',
    priority: 'High',
    status: 'Pending',
    category: 'Assignment',
    dueDate: '2026-10-25',
    description: 'Implement automated Cloudflare Workers deployment using Terraform IaC scripts.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'T102',
    title: 'Prepare Project Presentation',
    priority: 'High',
    status: 'Pending',
    category: 'Presentation',
    dueDate: '2026-10-30',
    description: 'Prepare slides explaining IaC lifecycle, state locking, and provider architecture.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'T103',
    title: 'Submit Final Year Project Report',
    priority: 'Medium',
    status: 'Completed',
    category: 'Project',
    dueDate: '2026-10-18',
    description: 'Complete chapters 1 to 10 including testing evidence and screenshots.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'T104',
    title: 'Attend Project Viva',
    priority: 'High',
    status: 'Pending',
    category: 'Examination',
    dueDate: '2026-11-02',
    description: 'Demonstrate terraform plan, apply, modify, destroy, and recreation live.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'T105',
    title: 'Upload Laboratory Assignment',
    priority: 'Low',
    status: 'Completed',
    category: 'Lab Work',
    dueDate: '2026-10-15',
    description: 'Verify Git commit history and GitHub Actions pipeline log artifacts.',
    createdAt: new Date().toISOString()
  }
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // Handle CORS Preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }

    // Health check endpoint
    if (path === '/health' || path === '/api/health') {
      return jsonResponse({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || 'production',
        kv_bound: !!env.TASKS_KV
      });
    }

    // REST API Routes: /api/tasks and /api/tasks/:id
    if (path.startsWith('/api/tasks')) {
      return handleApiRequest(path, method, request, env);
    }

    // Serve Frontend Application
    if (path === '/' || path === '/index.html') {
      return new Response(INDEX_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    if (path === '/style.css') {
      return new Response(STYLE_CSS, {
        headers: { 'Content-Type': 'text/css; charset=utf-8' }
      });
    }

    if (path === '/script.js') {
      return new Response(SCRIPT_JS, {
        headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};

/**
 * Handle REST API requests for tasks CRUD
 */
async function handleApiRequest(path, method, request, env) {
  const parts = path.split('/').filter(Boolean);
  // parts[0] is 'api', parts[1] is 'tasks', parts[2] is optional ':id'
  const taskId = parts[2];

  try {
    // 1. GET /api/tasks - Retrieve all tasks
    if (method === 'GET' && !taskId) {
      const allTasks = await listAllTasks(env);
      return jsonResponse(allTasks);
    }

    // 2. GET /api/tasks/:id - Retrieve individual task
    if (method === 'GET' && taskId) {
      const task = await getTaskById(taskId, env);
      if (!task) {
        return jsonResponse({ error: 'Task not found', id: taskId }, 404);
      }
      return jsonResponse(task);
    }

    // 3. POST /api/tasks - Create task
    if (method === 'POST' && !taskId) {
      const payload = await request.json();
      if (!payload.title || !payload.title.trim()) {
        return jsonResponse({ error: 'Task title is required' }, 400);
      }

      const generatedId = `T${Math.floor(100 + Math.random() * 900)}`;
      const newTask = {
        id: payload.id || generatedId,
        title: payload.title.trim(),
        priority: payload.priority || 'Medium',
        status: payload.status || 'Pending',
        category: payload.category || 'General',
        dueDate: payload.dueDate || '',
        description: payload.description || '',
        createdAt: new Date().toISOString()
      };

      if (env.TASKS_KV) {
        await env.TASKS_KV.put(`task:${newTask.id}`, JSON.stringify(newTask));
      }

      return jsonResponse(newTask, 201);
    }

    // 4. PUT /api/tasks/:id - Update task
    if (method === 'PUT' && taskId) {
      const payload = await request.json();
      let existing = await getTaskById(taskId, env);

      const updatedTask = {
        ...(existing || {}),
        ...payload,
        id: taskId,
        updatedAt: new Date().toISOString()
      };

      if (env.TASKS_KV) {
        await env.TASKS_KV.put(`task:${taskId}`, JSON.stringify(updatedTask));
      }

      return jsonResponse(updatedTask, 200);
    }

    // 5. DELETE /api/tasks/:id - Delete task
    if (method === 'DELETE' && taskId) {
      if (env.TASKS_KV) {
        await env.TASKS_KV.delete(`task:${taskId}`);
        await env.TASKS_KV.delete(taskId);
      }
      return jsonResponse({
        success: true,
        message: 'Task removed successfully.',
        id: taskId
      }, 200);
    }

    return jsonResponse({ error: `Method ${method} not allowed on ${path}` }, 405);
  } catch (err) {
    return jsonResponse({ error: 'Internal Server Error', details: err.message }, 500);
  }
}

/**
 * List all tasks from KV
 */
async function listAllTasks(env) {
  if (!env.TASKS_KV) {
    return INITIAL_TASKS;
  }

  // Check if the KV namespace has ever been initialized/seeded
  const isSeeded = await env.TASKS_KV.get('_meta:seeded');
  if (!isSeeded) {
    for (const item of INITIAL_TASKS) {
      await env.TASKS_KV.put(`task:${item.id}`, JSON.stringify(item));
    }
    await env.TASKS_KV.put('_meta:seeded', 'true');
  }

  const listResult = await env.TASKS_KV.list({ prefix: 'task:' });
  const tasks = [];
  if (listResult && listResult.keys) {
    for (const key of listResult.keys) {
      const raw = await env.TASKS_KV.get(key.name);
      if (raw) {
        try {
          tasks.push(JSON.parse(raw));
        } catch {
          // Skip unparseable
        }
      }
    }
  }

  // Sort by createdAt descending
  tasks.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return tasks;
}

/**
 * Get single task by ID
 */
async function getTaskById(id, env) {
  if (!env.TASKS_KV) {
    return INITIAL_TASKS.find(t => t.id === id) || null;
  }

  let raw = await env.TASKS_KV.get(`task:${id}`);
  if (!raw) {
    raw = await env.TASKS_KV.get(id);
  }

  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

// Embedded Frontend Assets for standalone Worker deployment
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cloud-Based Student Task Manager</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <div class="bg-glow bg-glow-1"></div>
  <div class="bg-glow bg-glow-2"></div>
  <div class="app-layout">
    <header class="app-header">
      <div class="header-branding">
        <div class="brand-icon"><i class="fa-solid fa-graduation-cap"></i></div>
        <div>
          <h1 id="app-title" class="brand-title">Cloud-Based Student Task Manager</h1>
          <p class="brand-subtitle">Serverless Academic Task Platform powered by Cloudflare Workers &amp; KV via Terraform</p>
        </div>
      </div>
      <div class="header-actions">
        <div class="iac-badge" id="iac-status-badge">
          <span class="status-pulse"></span>
          <span class="badge-text" id="backend-status-text">Cloudflare Workers KV (Live)</span>
        </div>
        <button id="btn-open-create-modal" class="btn btn-primary">
          <i class="fa-solid fa-plus"></i>
          <span>Add New Task</span>
        </button>
      </div>
    </header>
    <main class="main-container">
      <section class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon icon-blue"><i class="fa-solid fa-list-check"></i></div>
          <div class="stat-info"><span class="stat-label">Total Tasks</span><span class="stat-value" id="stat-total-count">0</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-amber"><i class="fa-solid fa-clock"></i></div>
          <div class="stat-info"><span class="stat-label">Pending</span><span class="stat-value" id="stat-pending-count">0</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-indigo"><i class="fa-solid fa-spinner"></i></div>
          <div class="stat-info"><span class="stat-label">In Progress</span><span class="stat-value" id="stat-in-progress-count">0</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-emerald"><i class="fa-solid fa-circle-check"></i></div>
          <div class="stat-info"><span class="stat-label">Completed</span><span class="stat-value" id="stat-completed-count">0</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-rose"><i class="fa-solid fa-fire"></i></div>
          <div class="stat-info"><span class="stat-label">High Priority</span><span class="stat-value" id="stat-high-count">0</span></div>
        </div>
      </section>
      <section class="controls-card">
        <div class="search-box">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="task-search-input" placeholder="Search tasks by title, category, or ID..." />
        </div>
        <div class="filter-group">
          <div class="select-wrapper">
            <i class="fa-solid fa-filter"></i>
            <select id="filter-status">
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div class="select-wrapper">
            <i class="fa-solid fa-layer-group"></i>
            <select id="filter-priority">
              <option value="all">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>
          <div class="select-wrapper">
            <i class="fa-solid fa-arrow-down-wide-short"></i>
            <select id="filter-sort">
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="priority-desc">Priority: High to Low</option>
              <option value="priority-asc">Priority: Low to High</option>
            </select>
          </div>
          <button id="btn-refresh-tasks" class="btn btn-secondary">
            <i class="fa-solid fa-arrows-rotate"></i>
            <span>Refresh</span>
          </button>
        </div>
      </section>
      <section class="tasks-section">
        <div class="section-header">
          <h2 class="section-title"><i class="fa-solid fa-tasks"></i> Academic Tasks</h2>
          <span class="task-count-pill" id="showing-task-count">Showing 0 tasks</span>
        </div>
        <div class="table-container">
          <table class="tasks-table">
            <thead>
              <tr>
                <th style="width: 110px;">Task ID</th>
                <th>Task Title</th>
                <th style="width: 140px;">Category</th>
                <th style="width: 120px;">Priority</th>
                <th style="width: 140px;">Status</th>
                <th style="width: 130px;">Created Date</th>
                <th style="width: 170px; text-align: center;">Actions</th>
              </tr>
            </thead>
            <tbody id="tasks-table-body"></tbody>
          </table>
          <div class="empty-state" id="empty-state" style="display: none;">
            <div class="empty-icon"><i class="fa-regular fa-clipboard"></i></div>
            <h3>No Tasks Found</h3>
            <p>Get started by creating your first academic task using the button above.</p>
            <button id="btn-seed-sample-tasks" class="btn btn-outline"><i class="fa-solid fa-wand-magic-sparkles"></i> Load Sample Tasks</button>
          </div>
          <div class="loading-state" id="loading-state">
            <div class="spinner"></div>
            <p>Communicating with Cloudflare Workers KV...</p>
          </div>
        </div>
      </section>
      <section class="iac-info-card">
        <div class="iac-info-header">
          <div class="iac-title"><i class="fa-solid fa-cubes"></i> <span>Infrastructure as Code Architecture Specification</span></div>
          <span class="iac-tag">Terraform Managed</span>
        </div>
        <div class="iac-spec-grid">
          <div class="iac-spec-item"><span class="spec-label">IaC Orchestrator:</span><span class="spec-value">HashiCorp Terraform</span></div>
          <div class="iac-spec-item"><span class="spec-label">Cloud Platform:</span><span class="spec-value">Cloudflare Serverless</span></div>
          <div class="iac-spec-item"><span class="spec-label">Compute Runtime:</span><span class="spec-value">Cloudflare Workers V8 Engine</span></div>
          <div class="iac-spec-item"><span class="spec-label">Persistence Engine:</span><span class="spec-value">Cloudflare Workers KV (<code>TASKS_KV</code>)</span></div>
          <div class="iac-spec-item"><span class="spec-label">CI/CD Automation:</span><span class="spec-value">GitHub Actions Workflow</span></div>
          <div class="iac-spec-item"><span class="spec-label">REST API Interface:</span><span class="spec-value"><code>/api/tasks</code> (CRUD)</span></div>
        </div>
      </section>
    </main>
    <div class="modal-backdrop" id="task-modal" style="display: none;">
      <div class="modal-card">
        <div class="modal-header">
          <h3 id="modal-title"><i class="fa-solid fa-pen-to-square"></i> Create New Task</h3>
          <button id="btn-close-modal" class="btn-icon"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="task-form">
          <input type="hidden" id="form-task-id" />
          <div class="form-group">
            <label for="form-task-title">Task Title <span class="required">*</span></label>
            <input type="text" id="form-task-title" placeholder="e.g. Complete Cloud Computing Assignment" required />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="form-task-priority">Priority <span class="required">*</span></label>
              <select id="form-task-priority" required>
                <option value="High">High</option>
                <option value="Medium" selected>Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div class="form-group">
              <label for="form-task-status">Status <span class="required">*</span></label>
              <select id="form-task-status" required>
                <option value="Pending" selected>Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="form-task-category">Academic Category</label>
              <select id="form-task-category">
                <option value="Assignment">Assignment</option>
                <option value="Project">Project</option>
                <option value="Presentation">Presentation</option>
                <option value="Lab Work">Lab Work</option>
                <option value="Examination">Examination / Viva</option>
                <option value="General">General</option>
              </select>
            </div>
            <div class="form-group">
              <label for="form-task-due">Due Date</label>
              <input type="date" id="form-task-due" />
            </div>
          </div>
          <div class="form-group">
            <label for="form-task-description">Description &amp; Notes</label>
            <textarea id="form-task-description" rows="3" placeholder="Additional details, submission links, or task instructions..."></textarea>
          </div>
          <div class="modal-footer">
            <button type="button" id="btn-cancel-modal" class="btn btn-secondary">Cancel</button>
            <button type="submit" id="btn-submit-task" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> <span id="btn-submit-text">Save Task</span></button>
          </div>
        </form>
      </div>
    </div>
    <div class="modal-backdrop" id="delete-modal" style="display: none;">
      <div class="modal-card modal-sm">
        <div class="modal-header">
          <h3><i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i> Confirm Deletion</h3>
          <button id="btn-close-delete-modal" class="btn-icon"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete this task from Cloudflare Workers KV?</p>
          <p class="delete-task-preview" id="delete-task-preview"></p>
        </div>
        <div class="modal-footer">
          <button type="button" id="btn-cancel-delete" class="btn btn-secondary">Cancel</button>
          <button type="button" id="btn-confirm-delete" class="btn btn-danger"><i class="fa-solid fa-trash-can"></i> Delete Task</button>
        </div>
      </div>
    </div>
    <div class="toast-container" id="toast-container"></div>
  </div>
  <script src="/script.js"></script>
</body>
</html>`;

const STYLE_CSS = `/* ==========================================================================
   Cloud-Based Student Task Manager - Design System & Modern Styles
   Theme: Sleek Dark / Cybernetic Slate with Glassmorphic Elements
   ========================================================================== */

/* ==========================================================================

   Cloud-Based Student Task Manager - Design System & Modern Styles

   Theme: Light / Sunrise Yellow-Orange with Contrasting Accents

   ========================================================================== */



:root {

  /* Color Palette */

  --bg-primary: #fffaf0;

  --bg-secondary: #fff4d6;

  --bg-card: rgba(255, 255, 255, 0.96);

  --bg-card-hover: #fff6df;

  --bg-input: #ffffff;

  --border-color: rgba(124, 91, 24, 0.16);

  --border-focus: #f4a900;



  /* Typography Colors */

  --text-main: #29251d;

  --text-muted: #716858;

  --text-dim: #948875;



  /* Accent Colors */

  --accent-primary: #f4a900;

  --accent-primary-hover: #c98200;

  --accent-glow: rgba(244, 169, 0, 0.24);



  --color-emerald: #16a34a;

  --color-emerald-bg: rgba(22, 163, 74, 0.10);

  --color-amber: #f4a900;

  --color-amber-bg: rgba(244, 169, 0, 0.16);

  --color-rose: #dc2626;

  --color-rose-bg: rgba(220, 38, 38, 0.09);

  --color-indigo: #6366f1;

  --color-indigo-bg: rgba(99, 102, 241, 0.10);



  /* Elevation & Radius */

  --radius-sm: 8px;

  --radius-md: 12px;

  --radius-lg: 18px;

  --radius-xl: 24px;

  --shadow-card: 0 10px 30px -10px rgba(72, 54, 15, 0.10), 0 0 0 1px var(--border-color);

  --shadow-modal: 0 25px 50px -12px rgba(72, 54, 15, 0.18), 0 0 0 1px rgba(124, 91, 24, 0.18);

  --transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);

}



/* Base Reset */

\*, \*::before, \*::after {

  box-sizing: border-box;

  margin: 0;

  padding: 0;

}



body {

  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  background-color: var(--bg-primary);

  color: var(--text-main);

  min-height: 100vh;

  line-height: 1.6;

  overflow-x: hidden;

  position: relative;

}



/* Ambient Background Glow */

.bg-glow {

  position: fixed;

  border-radius: 50%;

  filter: blur(120px);

  pointer-events: none;

  z-index: 0;

  opacity: 0.45;

}



.bg-glow-1 {

  width: 450px;

  height: 450px;

  background: radial-gradient(circle, rgba(244, 169, 0, 0.22), transparent 70%);

  top: -100px;

  right: -50px;

}



.bg-glow-2 {

  width: 500px;

  height: 500px;

  background: radial-gradient(circle, rgba(99, 102, 241, 0.22), transparent 70%);

  bottom: 50px;

  left: -100px;

}



/* Layout */

.app-layout {

  position: relative;

  z-index: 1;

  max-width: 1280px;

  margin: 0 auto;

  padding: 24px 20px 48px;

}



/* Header */

.app-header {

  display: flex;

  justify-content: space-between;

  align-items: center;

  gap: 20px;

  flex-wrap: wrap;

  padding: 24px 28px;

  background: var(--bg-card);

  backdrop-filter: blur(16px);

  border: 1px solid var(--border-color);

  border-radius: var(--radius-xl);

  box-shadow: var(--shadow-card);

  margin-bottom: 24px;

}



.header-branding {

  display: flex;

  align-items: center;

  gap: 16px;

}



.brand-icon {

  width: 54px;

  height: 54px;

  border-radius: var(--radius-md);

  background: linear-gradient(135deg, #f4a900, #6366f1);

  display: flex;

  align-items: center;

  justify-content: center;

  font-size: 24px;

  color: #29251d;

  box-shadow: 0 8px 20px var(--accent-glow);

}



.brand-title {

  font-size: 1.65rem;

  font-weight: 800;

  letter-spacing: -0.02em;

  background: linear-gradient(to right, #29251d, #a86500);

  -webkit-background-clip: text;

  -webkit-text-fill-color: transparent;

}



.brand-subtitle {

  font-size: 0.88rem;

  color: var(--text-muted);

}



.header-actions {

  display: flex;

  align-items: center;

  gap: 16px;

}



.iac-badge {

  display: flex;

  align-items: center;

  gap: 8px;

  padding: 8px 14px;

  background: rgba(22, 163, 74, 0.09);

  border: 1px solid rgba(22, 163, 74, 0.22);

  border-radius: 9999px;

  font-size: 0.82rem;

  font-weight: 600;

  color: #15803d;

}



.status-pulse {

  width: 8px;

  height: 8px;

  border-radius: 50%;

  background: #16a34a;

  box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.55);

  animation: pulse 2s infinite;

}



@keyframes pulse {

  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.55); }

  70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(22, 163, 74, 0); }

  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }

}



/* Buttons */

.btn {

  display: inline-flex;

  align-items: center;

  gap: 8px;

  padding: 10px 18px;

  border-radius: var(--radius-sm);

  font-size: 0.92rem;

  font-weight: 600;

  cursor: pointer;

  border: none;

  outline: none;

  transition: var(--transition);

  font-family: inherit;

}



.btn-primary {

  background: linear-gradient(135deg, #f4a900, #e98d00);

  color: #29251d;

  box-shadow: 0 4px 14px var(--accent-glow);

}



.btn-primary:hover {

  background: linear-gradient(135deg, #d88e00, #b97800);

  transform: translateY(-1px);

  box-shadow: 0 6px 20px var(--accent-glow);

}



.btn-secondary {

  background: rgba(124, 91, 24, 0.06);

  color: var(--text-main);

  border: 1px solid var(--border-color);

}



.btn-secondary:hover {

  background: rgba(124, 91, 24, 0.18);

  border-color: rgba(124, 91, 24, 0.25);

}



.btn-outline {

  background: transparent;

  color: #9a6500;

  border: 1px solid rgba(244, 169, 0, 0.22);

}



.btn-outline:hover {

  background: rgba(59, 130, 246, 0.1);

  border-color: var(--accent-primary);

}



.btn-danger {

  background: #dc2626;

  color: #29251d;

}



.btn-danger:hover {

  background: #991b1b;

}



.btn-icon {

  background: transparent;

  border: none;

  color: var(--text-muted);

  width: 34px;

  height: 34px;

  border-radius: var(--radius-sm);

  display: inline-flex;

  align-items: center;

  justify-content: center;

  font-size: 1rem;

  cursor: pointer;

  transition: var(--transition);

}



.btn-icon:hover {

  background: rgba(124, 91, 24, 0.09);

  color: var(--text-main);

}



/* Stats Cards */

.stats-grid {

  display: grid;

  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));

  gap: 16px;

  margin-bottom: 24px;

}



.stat-card {

  display: flex;

  align-items: center;

  gap: 16px;

  padding: 18px 20px;

  background: var(--bg-card);

  backdrop-filter: blur(12px);

  border: 1px solid var(--border-color);

  border-radius: var(--radius-lg);

  box-shadow: var(--shadow-card);

  transition: var(--transition);

}



.stat-card:hover {

  transform: translateY(-2px);

  border-color: rgba(124, 91, 24, 0.22);

  background: var(--bg-card-hover);

}



.stat-icon {

  width: 46px;

  height: 46px;

  border-radius: var(--radius-md);

  display: flex;

  align-items: center;

  justify-content: center;

  font-size: 1.25rem;

}



.icon-blue { background: rgba(244, 169, 0, 0.12); color: #9a6500; }

.icon-amber { background: var(--color-amber-bg); color: #a86500; }

.icon-indigo { background: var(--color-indigo-bg); color: #6366f1; }

.icon-emerald { background: var(--color-emerald-bg); color: #15803d; }

.icon-rose { background: var(--color-rose-bg); color: #f87171; }



.stat-info {

  display: flex;

  flex-direction: column;

}



.stat-label {

  font-size: 0.8rem;

  color: var(--text-muted);

  text-transform: uppercase;

  letter-spacing: 0.05em;

  font-weight: 600;

}



.stat-value {

  font-size: 1.55rem;

  font-weight: 800;

  color: var(--text-main);

}



/* Filter & Controls Toolbar */

.controls-card {

  display: flex;

  justify-content: space-between;

  align-items: center;

  gap: 16px;

  flex-wrap: wrap;

  padding: 16px 20px;

  background: var(--bg-card);

  backdrop-filter: blur(12px);

  border: 1px solid var(--border-color);

  border-radius: var(--radius-lg);

  box-shadow: var(--shadow-card);

  margin-bottom: 24px;

}



.search-box {

  display: flex;

  align-items: center;

  gap: 10px;

  background: var(--bg-input);

  border: 1px solid var(--border-color);

  border-radius: var(--radius-sm);

  padding: 8px 14px;

  flex: 1;

  min-width: 260px;

  transition: var(--transition);

}



.search-box:focus-within {

  border-color: var(--border-focus);

  box-shadow: 0 0 0 2px var(--accent-glow);

}



.search-box i {

  color: var(--text-dim);

}



.search-box input {

  background: transparent;

  border: none;

  outline: none;

  color: var(--text-main);

  font-family: inherit;

  font-size: 0.92rem;

  width: 100%;

}



.filter-group {

  display: flex;

  align-items: center;

  gap: 12px;

  flex-wrap: wrap;

}



.select-wrapper {

  position: relative;

  display: flex;

  align-items: center;

}



.select-wrapper i {

  position: absolute;

  left: 12px;

  color: var(--text-dim);

  font-size: 0.85rem;

  pointer-events: none;

}



.select-wrapper select {

  appearance: none;

  background: var(--bg-input);

  color: var(--text-main);

  border: 1px solid var(--border-color);

  border-radius: var(--radius-sm);

  padding: 9px 34px 9px 32px;

  font-family: inherit;

  font-size: 0.88rem;

  cursor: pointer;

  transition: var(--transition);

}



.select-wrapper select:focus {

  outline: none;

  border-color: var(--border-focus);

}



/* Tasks Table Container */

.tasks-section {

  background: var(--bg-card);

  backdrop-filter: blur(14px);

  border: 1px solid var(--border-color);

  border-radius: var(--radius-xl);

  box-shadow: var(--shadow-card);

  overflow: hidden;

  margin-bottom: 28px;

}



.section-header {

  display: flex;

  justify-content: space-between;

  align-items: center;

  padding: 20px 24px;

  border-bottom: 1px solid var(--border-color);

}



.section-title {

  display: flex;

  align-items: center;

  gap: 10px;

  font-size: 1.15rem;

  font-weight: 700;

  color: var(--text-main);

}



.section-title i {

  color: var(--accent-primary);

}



.task-count-pill {

  font-size: 0.82rem;

  color: var(--text-muted);

  background: rgba(124, 91, 24, 0.05);

  padding: 4px 12px;

  border-radius: 9999px;

  border: 1px solid var(--border-color);

}



.table-container {

  overflow-x: auto;

  position: relative;

  min-height: 200px;

}



.tasks-table {

  width: 100%;

  border-collapse: collapse;

  text-align: left;

}



.tasks-table th {

  padding: 14px 20px;

  background: rgba(124, 91, 24, 0.045);

  color: var(--text-muted);

  font-size: 0.78rem;

  font-weight: 700;

  text-transform: uppercase;

  letter-spacing: 0.06em;

  border-bottom: 1px solid var(--border-color);

}



.tasks-table td {

  padding: 16px 20px;

  border-bottom: 1px solid var(--border-color);

  font-size: 0.92rem;

  vertical-align: middle;

}



.tasks-table tbody tr {

  transition: var(--transition);

}



.tasks-table tbody tr:hover {

  background: rgba(124, 91, 24, 0.035);

}



.task-id-badge {

  font-family: 'JetBrains Mono', monospace;

  font-size: 0.82rem;

  font-weight: 500;

  background: rgba(124, 91, 24, 0.06);

  color: #9a6500;

  padding: 4px 8px;

  border-radius: 6px;

  border: 1px solid rgba(124, 91, 24, 0.16);

  display: inline-block;

}



.task-title-cell {

  display: flex;

  flex-direction: column;

  gap: 2px;

}



.task-title-text {

  font-weight: 600;

  color: var(--text-main);

}



.task-desc-text {

  font-size: 0.8rem;

  color: var(--text-dim);

  max-width: 380px;

  white-space: nowrap;

  overflow: hidden;

  text-overflow: ellipsis;

}



/* Badges */

.badge {

  display: inline-flex;

  align-items: center;

  gap: 6px;

  padding: 4px 10px;

  border-radius: 9999px;

  font-size: 0.78rem;

  font-weight: 600;

  white-space: nowrap;

}



/* Priority Badges */

.badge-priority-high {

  background: var(--color-rose-bg);

  color: #b91c1c;

  border: 1px solid rgba(220, 38, 38, 0.22);

}



.badge-priority-medium {

  background: var(--color-amber-bg);

  color: #8a5300;

  border: 1px solid rgba(245, 158, 11, 0.3);

}



.badge-priority-low {

  background: rgba(14, 116, 144, 0.10);

  color: #0e7490;

  border: 1px solid rgba(14, 116, 144, 0.22);

}



/* Status Badges */

.badge-status-pending {

  background: rgba(244, 169, 0, 0.16);

  color: #a86500;

  border: 1px solid rgba(245, 158, 11, 0.3);

}



.badge-status-in-progress {

  background: var(--color-indigo-bg);

  color: #4f46e5;

  border: 1px solid rgba(99, 102, 241, 0.22);

}



.badge-status-completed {

  background: var(--color-emerald-bg);

  color: #15803d;

  border: 1px solid rgba(22, 163, 74, 0.22);

}



.badge-category {

  background: rgba(124, 91, 24, 0.06);

  color: var(--text-muted);

  border: 1px solid var(--border-color);

  font-size: 0.76rem;

}



/* Action Buttons in Table */

.action-buttons {

  display: flex;

  align-items: center;

  justify-content: center;

  gap: 6px;

}



.btn-table-action {

  padding: 6px 10px;

  border-radius: 6px;

  font-size: 0.8rem;

  font-weight: 600;

  border: 1px solid var(--border-color);

  background: rgba(124, 91, 24, 0.045);

  color: var(--text-muted);

  cursor: pointer;

  transition: var(--transition);

  display: inline-flex;

  align-items: center;

  gap: 5px;

}



.btn-table-action:hover {

  background: rgba(124, 91, 24, 0.09);

  color: var(--text-main);

}



.btn-toggle-status:hover {

  border-color: #16a34a;

  color: #15803d;

}



.btn-delete-row:hover {

  border-color: #dc2626;

  color: #f87171;

}



/* Empty & Loading States */

.empty-state {

  text-align: center;

  padding: 60px 20px;

}



.empty-icon {

  font-size: 3rem;

  color: var(--text-dim);

  margin-bottom: 16px;

}



.empty-state h3 {

  font-size: 1.2rem;

  font-weight: 700;

  margin-bottom: 6px;

}



.empty-state p {

  color: var(--text-muted);

  margin-bottom: 20px;

}



.loading-state {

  display: flex;

  flex-direction: column;

  align-items: center;

  justify-content: center;

  padding: 60px 20px;

  color: var(--text-muted);

  gap: 14px;

}



.spinner {

  width: 36px;

  height: 36px;

  border: 3px solid rgba(244, 169, 0, 0.18);

  border-top-color: var(--accent-primary);

  border-radius: 50%;

  animation: spin 0.8s linear infinite;

}



@keyframes spin {

  to { transform: rotate(360deg); }

}



/* IaC Architecture Info Footer Card */

.iac-info-card {

  background: var(--bg-card);

  backdrop-filter: blur(12px);

  border: 1px solid var(--border-color);

  border-radius: var(--radius-lg);

  padding: 22px 26px;

  box-shadow: var(--shadow-card);

}



.iac-info-header {

  display: flex;

  justify-content: space-between;

  align-items: center;

  margin-bottom: 18px;

  flex-wrap: wrap;

  gap: 12px;

}



.iac-title {

  display: flex;

  align-items: center;

  gap: 10px;

  font-size: 0.95rem;

  font-weight: 700;

  color: var(--text-main);

}



.iac-title i {

  color: #7c3aed;

}



.iac-tag {

  font-size: 0.75rem;

  font-weight: 700;

  padding: 4px 10px;

  background: rgba(124, 58, 237, 0.09);

  color: #6d28d9;

  border: 1px solid rgba(124, 58, 237, 0.20);

  border-radius: 9999px;

  letter-spacing: 0.05em;

  text-transform: uppercase;

}



.iac-spec-grid {

  display: grid;

  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));

  gap: 14px;

}



.iac-spec-item {

  display: flex;

  align-items: center;

  gap: 8px;

  font-size: 0.86rem;

}



.spec-label {

  color: var(--text-dim);

  font-weight: 500;

}



.spec-value {

  color: var(--text-main);

  font-weight: 600;

}



.spec-value code {

  font-family: 'JetBrains Mono', monospace;

  background: rgba(124, 91, 24, 0.06);

  padding: 2px 6px;

  border-radius: 4px;

  font-size: 0.82rem;

  color: #9a6500;

}



/* Modals */

.modal-backdrop {

  position: fixed;

  inset: 0;

  background: rgba(41, 37, 29, 0.42);

  backdrop-filter: blur(8px);

  z-index: 100;

  display: flex;

  align-items: center;

  justify-content: center;

  padding: 20px;

  animation: fadeIn 0.2s ease-out;

}



@keyframes fadeIn {

  from { opacity: 0; }

  to { opacity: 1; }

}



.modal-card {

  background: #ffffff;

  border: 1px solid rgba(124, 91, 24, 0.18);

  border-radius: var(--radius-xl);

  box-shadow: var(--shadow-modal);

  width: 100%;

  max-width: 540px;

  overflow: hidden;

  animation: slideUp 0.22s ease-out;

}



.modal-sm {

  max-width: 440px;

}



@keyframes slideUp {

  from { transform: translateY(16px); opacity: 0; }

  to { transform: translateY(0); opacity: 1; }

}



.modal-header {

  display: flex;

  justify-content: space-between;

  align-items: center;

  padding: 20px 24px;

  border-bottom: 1px solid var(--border-color);

}



.modal-header h3 {

  display: flex;

  align-items: center;

  gap: 10px;

  font-size: 1.15rem;

  font-weight: 700;

  color: var(--text-main);

}



.modal-body {

  padding: 22px 24px;

  color: var(--text-muted);

}



.delete-task-preview {

  margin-top: 10px;

  padding: 10px 14px;

  background: rgba(220, 38, 38, 0.06);

  border-left: 3px solid #dc2626;

  border-radius: 4px;

  color: #b91c1c;

  font-weight: 600;

}



/* Form Controls */

form {

  padding: 22px 24px;

}



.form-group {

  margin-bottom: 18px;

}



.form-row {

  display: grid;

  grid-template-columns: 1fr 1fr;

  gap: 16px;

}



label {

  display: block;

  font-size: 0.84rem;

  font-weight: 600;

  color: var(--text-muted);

  margin-bottom: 6px;

}



.required {

  color: var(--color-rose);

}



input[type="text"],

input[type="date"],

select,

textarea {

  width: 100%;

  padding: 10px 14px;

  background: var(--bg-input);

  border: 1px solid var(--border-color);

  border-radius: var(--radius-sm);

  color: var(--text-main);

  font-family: inherit;

  font-size: 0.92rem;

  transition: var(--transition);

}



input[type="text"]:focus,

input[type="date"]:focus,

select:focus,

textarea:focus {

  outline: none;

  border-color: var(--border-focus);

  box-shadow: 0 0 0 2px var(--accent-glow);

}



textarea {

  resize: vertical;

}



.modal-footer {

  display: flex;

  justify-content: flex-end;

  gap: 12px;

  padding-top: 10px;

}



/* Toasts */

.toast-container {

  position: fixed;

  bottom: 24px;

  right: 24px;

  z-index: 1000;

  display: flex;

  flex-direction: column;

  gap: 10px;

  pointer-events: none;

}



.toast {

  display: flex;

  align-items: center;

  gap: 12px;

  padding: 14px 18px;

  background: #ffffff;

  border: 1px solid var(--border-color);

  border-radius: var(--radius-md);

  box-shadow: 0 10px 25px rgba(72, 54, 15, 0.10);

  color: var(--text-main);

  font-size: 0.88rem;

  font-weight: 600;

  pointer-events: auto;

  animation: toastSlide 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);

}



@keyframes toastSlide {

  from { transform: translateX(100%); opacity: 0; }

  to { transform: translateX(0); opacity: 1; }

}



.toast-success {

  border-left: 4px solid var(--color-emerald);

}



.toast-success i {

  color: var(--color-emerald);

}



.toast-error {

  border-left: 4px solid var(--color-rose);

}



.toast-error i {

  color: var(--color-rose);

}



.toast-info {

  border-left: 4px solid var(--accent-primary);

}



.toast-info i {

  color: var(--accent-primary);

}



/* Responsive */

@media (max-width: 768px) {

  .app-header {

    flex-direction: column;

    align-items: flex-start;

  }



  .header-actions {

    width: 100%;

    justify-content: space-between;

  }



  .form-row {

    grid-template-columns: 1fr;

  }



  .controls-card {

    flex-direction: column;

    align-items: stretch;

  }



  .filter-group {

    flex-direction: column;

    align-items: stretch;

  }



  .select-wrapper select {

    width: 100%;

  }

}
`;

const SCRIPT_JS = `let tasks = [];
let pendingDeleteId = null;
const API_BASE = '/api/tasks';

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

const deleteModal = document.getElementById('delete-modal');
const btnCloseDeleteModal = document.getElementById('btn-close-delete-modal');
const btnCancelDelete = document.getElementById('btn-cancel-delete');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');
const deleteTaskPreview = document.getElementById('delete-task-preview');

const statTotal = document.getElementById('stat-total-count');
const statPending = document.getElementById('stat-pending-count');
const statInProgress = document.getElementById('stat-in-progress-count');
const statCompleted = document.getElementById('stat-completed-count');
const statHigh = document.getElementById('stat-high-count');

document.addEventListener('DOMContentLoaded', () => {
  btnOpenCreateModal.addEventListener('click', openCreateModal);
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
  refreshBtn.addEventListener('click', () => { showToast('Refreshing...', 'info'); loadTasks(); });
  window.addEventListener('click', (e) => {
    if (e.target === taskModal) closeModal();
    if (e.target === deleteModal) closeDeleteModal();
  });
  loadTasks();
});

async function loadTasks() {
  loadingState.style.display = 'flex';
  try {
    const res = await fetch(API_BASE);
    tasks = await res.json();
    renderTasks();
  } catch (err) {
    showToast('Failed to load tasks: ' + err.message, 'error');
  } finally {
    loadingState.style.display = 'none';
  }
}

async function handleTaskFormSubmit(e) {
  e.preventDefault();
  const id = formTaskId.value.trim();
  const payload = {
    title: formTaskTitle.value.trim(),
    priority: formTaskPriority.value,
    status: formTaskStatus.value,
    category: formTaskCategory.value,
    dueDate: formTaskDue.value,
    description: formTaskDesc.value.trim()
  };

  try {
    if (id) {
      const res = await fetch(\`\${API_BASE}/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const updated = await res.json();
      const idx = tasks.findIndex(t => t.id === id);
      if (idx !== -1) tasks[idx] = updated;
      showToast(\`Task \${id} updated successfully!\`, 'success');
    } else {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const created = await res.json();
      tasks.unshift(created);
      showToast('Task created successfully!', 'success');
    }
    renderTasks();
    closeModal();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function toggleTaskStatus(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  let nextStatus = 'Pending';
  if (task.status === 'Pending') nextStatus = 'In Progress';
  else if (task.status === 'In Progress') nextStatus = 'Completed';
  else nextStatus = 'Pending';

  try {
    const res = await fetch(\`\${API_BASE}/\${id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, status: nextStatus })
    });
    const updated = await res.json();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) tasks[idx] = updated;
    renderTasks();
    showToast(\`Task \${id} status updated to \${nextStatus}\`, 'success');
  } catch (e) {
    showToast('Error updating status: ' + e.message, 'error');
  }
}

function requestDeleteTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  pendingDeleteId = id;
  deleteTaskPreview.textContent = \`\${task.id}: \${task.title}\`;
  deleteModal.style.display = 'flex';
}

async function confirmDeleteTask() {
  if (!pendingDeleteId) return;
  const id = pendingDeleteId;
  try {
    await fetch(\`\${API_BASE}/\${id}\`, { method: 'DELETE' });
    tasks = tasks.filter(t => t.id !== id);
    renderTasks();
    closeDeleteModal();
    showToast(\`Task \${id} removed successfully.\`, 'info');
  } catch (err) {
    showToast('Error deleting task: ' + err.message, 'error');
  }
}

function renderTasks() {
  const q = searchInput.value.toLowerCase().trim();
  const st = filterStatus.value;
  const pr = filterPriority.value;
  const sort = filterSort.value;

  let filtered = tasks.filter(t => {
    const matchQ = !q || (t.title && t.title.toLowerCase().includes(q)) || (t.id && t.id.toLowerCase().includes(q));
    const matchSt = st === 'all' || t.status === st;
    const matchPr = pr === 'all' || t.priority === pr;
    return matchQ && matchSt && matchPr;
  });

  const weight = { High: 3, Medium: 2, Low: 1 };
  filtered.sort((a, b) => {
    if (sort === 'date-desc') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    if (sort === 'date-asc') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    if (sort === 'priority-desc') return (weight[b.priority] || 0) - (weight[a.priority] || 0);
    if (sort === 'priority-asc') return (weight[a.priority] || 0) - (weight[b.priority] || 0);
    return 0;
  });

  taskTableBody.innerHTML = '';
  if (filtered.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    filtered.forEach(task => {
      const tr = document.createElement('tr');
      const prClass = \`badge-priority-\${(task.priority || 'medium').toLowerCase()}\`;
      const stClass = \`badge-status-\${(task.status || 'pending').toLowerCase().replace(' ', '-')}\`;
      const dateStr = task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'N/A';
      tr.innerHTML = \`
        <td><span class="task-id-badge">\${escapeHtml(task.id)}</span></td>
        <td><strong>\${escapeHtml(task.title)}</strong></td>
        <td><span class="badge badge-category">\${escapeHtml(task.category || 'General')}</span></td>
        <td><span class="badge \${prClass}">\${escapeHtml(task.priority || 'Medium')}</span></td>
        <td><span class="badge \${stClass}">\${escapeHtml(task.status || 'Pending')}</span></td>
        <td style="color: var(--text-dim);">\${dateStr}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-table-action btn-toggle-status" onclick="toggleTaskStatus('\${task.id}')">Toggle Status</button>
            <button class="btn-table-action" onclick="openEditModal('\${task.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-table-action btn-delete-row" onclick="requestDeleteTask('\${task.id}')"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </td>
      \`;
      taskTableBody.appendChild(tr);
    });
  }

  statTotal.textContent = tasks.length;
  statPending.textContent = tasks.filter(t => t.status === 'Pending').length;
  statInProgress.textContent = tasks.filter(t => t.status === 'In Progress').length;
  statCompleted.textContent = tasks.filter(t => t.status === 'Completed').length;
  statHigh.textContent = tasks.filter(t => t.priority === 'High').length;
  showingCount.textContent = \`Showing \${filtered.length} of \${tasks.length} tasks\`;
}

function openCreateModal() {
  taskForm.reset();
  formTaskId.value = '';
  modalTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Create New Task';
  btnSubmitText.textContent = 'Save Task';
  taskModal.style.display = 'flex';
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
  modalTitle.innerHTML = \`<i class="fa-solid fa-pen-to-square"></i> Edit Task (\${escapeHtml(task.id)})\`;
  btnSubmitText.textContent = 'Update Task';
  taskModal.style.display = 'flex';
}

function closeModal() { taskModal.style.display = 'none'; }
function closeDeleteModal() { deleteModal.style.display = 'none'; pendingDeleteId = null; }

function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = \`toast toast-\${type}\`;
  t.innerHTML = \`<span>\${escapeHtml(msg)}</span>\`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
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

window.toggleTaskStatus = toggleTaskStatus;
window.openEditModal = openEditModal;
window.requestDeleteTask = requestDeleteTask;
`;
