const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(projectRoot, 'application', 'index.html');
const cssPath = path.join(projectRoot, 'application', 'style.css');
const jsPath = path.join(projectRoot, 'application', 'script.js');
const workerPath = path.join(projectRoot, 'application', 'worker.js');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');
const jsContent = fs.readFileSync(jsPath, 'utf8');

function toJsStringLiteral(content) {
  return JSON.stringify(content);
}

const workerCode = `/**
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

// Seed tasks from academic scenarios
const INITIAL_TASKS = [
  {
    id: 'T101',
    title: 'Complete Operating Systems Lab Assignment',
    priority: 'High',
    status: 'Pending',
    category: 'Assignment',
    dueDate: '2026-10-25',
    description: 'Implement CPU scheduling algorithms and multithreaded synchronization in C++.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'T102',
    title: 'Prepare Final Year Seminar Presentation',
    priority: 'High',
    status: 'In Progress',
    category: 'Presentation',
    dueDate: '2026-10-30',
    description: 'Prepare slides covering project methodology, architecture, and live demonstration.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'T103',
    title: 'Submit Term Project Documentation',
    priority: 'Medium',
    status: 'Completed',
    category: 'Project',
    dueDate: '2026-10-18',
    description: 'Format and submit final report document according to department guidelines.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'T104',
    title: 'Database Management Final Exam Prep',
    priority: 'High',
    status: 'Pending',
    category: 'Examination',
    dueDate: '2026-11-02',
    description: 'Review normalization, indexing, query optimization, and ACID transaction properties.',
    createdAt: new Date().toISOString()
  },
  {
    id: 'T105',
    title: 'Computer Networks Packet Tracer Lab',
    priority: 'Low',
    status: 'Completed',
    category: 'Lab Work',
    dueDate: '2026-10-15',
    description: 'Design and verify VLAN routing and subnet topologies using packet analyzer.',
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

      const generatedId = \`T\${Math.floor(100 + Math.random() * 900)}\`;
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
        await env.TASKS_KV.put(\`task:\${newTask.id}\`, JSON.stringify(newTask));
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
        await env.TASKS_KV.put(\`task:\${taskId}\`, JSON.stringify(updatedTask));
      }

      return jsonResponse(updatedTask, 200);
    }

    // 5. DELETE /api/tasks/:id - Delete task
    if (method === 'DELETE' && taskId) {
      if (env.TASKS_KV) {
        await env.TASKS_KV.delete(\`task:\${taskId}\`);
        await env.TASKS_KV.delete(taskId);
      }
      return jsonResponse({
        success: true,
        message: 'Task removed successfully.',
        id: taskId
      }, 200);
    }

    return jsonResponse({ error: \`Method \${method} not allowed on \${path}\` }, 405);
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

  const isSeeded = await env.TASKS_KV.get('_meta:seeded');
  if (!isSeeded) {
    for (const item of INITIAL_TASKS) {
      await env.TASKS_KV.put(\`task:\${item.id}\`, JSON.stringify(item));
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
          // ignore invalid
        }
      }
    }
  }

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

  let raw = await env.TASKS_KV.get(\`task:\${id}\`);
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
const INDEX_HTML = ${toJsStringLiteral(htmlContent)};
const STYLE_CSS = ${toJsStringLiteral(cssContent)};
const SCRIPT_JS = ${toJsStringLiteral(jsContent)};
`;

fs.writeFileSync(workerPath, workerCode, 'utf8');
console.log('Successfully generated', workerPath, 'size:', workerCode.length, 'bytes');
