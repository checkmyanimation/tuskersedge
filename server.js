import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const __dirname = path.resolve();
const dataPath = path.join(__dirname, 'data', 'messages.json');
const contentPath = path.join(__dirname, 'data', 'content.json');

const sessions = new Set();

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(__dirname));

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [k, ...v] = part.trim().split('=');
    if (!k) return acc;
    acc[k] = decodeURIComponent(v.join('='));
    return acc;
  }, {});
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || '');
  if (cookies.admin_token && sessions.has(cookies.admin_token)) {
    return next();
  }
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}

function sanitize(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'blog-post';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function readMessages() {
  try {
    const raw = await fs.readFile(dataPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { messages: [] };
  }
}

async function writeMessages(payload) {
  await fs.writeFile(dataPath, JSON.stringify(payload, null, 2));
}

async function readContent() {
  try {
    const raw = await fs.readFile(contentPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { tours: [], gallery: [], blog: [], districtGuides: {} };
  }
}

async function writeContent(payload) {
  await fs.writeFile(contentPath, JSON.stringify(payload, null, 2));
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

app.post('/api/contact', async (req, res) => {
  try {
    const body = req.body || {};
    const message = {
      id: Date.now().toString(36),
      name: sanitize(body.name || `${sanitize(body.firstName)} ${sanitize(body.lastName)}`),
      email: sanitize(body.email || body.contact),
      phone: sanitize(body.phone || body.whatsapp),
      month: sanitize(body.month || body.preferredMonth),
      nights: sanitize(body.nights || body.tripLength),
      travelers: sanitize(body.travelers),
      budget: sanitize(body.budget),
      interests: sanitize(body.interests || body.message),
      details: sanitize(body.details || body.notes),
      source: sanitize(body.source || 'website'),
      status: 'new',
      createdAt: new Date().toISOString(),
    };

    const data = await readMessages();
    data.messages.push(message);
    await writeMessages(data);

    const toEmail = process.env.EMAIL_TO || process.env.GMAIL_USER;
    const subject = `New enquiry from ${message.name || 'Website'}`;
    const text = `New enquiry received:\n\n` +
      `Name: ${message.name}\n` +
      `Email: ${message.email}\n` +
      `Phone/WhatsApp: ${message.phone}\n` +
      `Preferred month: ${message.month}\n` +
      `Nights: ${message.nights}\n` +
      `Travelers: ${message.travelers}\n` +
      `Budget: ${message.budget}\n` +
      `Interests: ${message.interests}\n` +
      `Details: ${message.details}\n` +
      `Source: ${message.source}\n` +
      `Timestamp: ${message.createdAt}\n`;

    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      await transporter.sendMail({
        from: `TuskersEdge <${process.env.GMAIL_USER}>`,
        to: toEmail,
        subject,
        text,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to save message.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin';
  if (username === adminUser && password === adminPass) {
    const token = Math.random().toString(36).slice(2);
    sessions.add(token);
    res.setHeader(
      'Set-Cookie',
      `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax`
    );
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Invalid credentials' });
});

app.post('/api/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  if (cookies.admin_token) {
    sessions.delete(cookies.admin_token);
  }
  res.setHeader('Set-Cookie', 'admin_token=; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/admin/content', requireAuth, async (req, res) => {
  const content = await readContent();
  res.json({ ok: true, content });
});

app.put('/api/admin/content', requireAuth, async (req, res) => {
  const payload = req.body || {};
  await writeContent(payload);
  res.json({ ok: true });
});

app.get('/api/admin/messages', requireAuth, async (req, res) => {
  const data = await readMessages();
  res.json({ ok: true, messages: data.messages || [] });
});

app.post('/api/admin/messages/mark-read', requireAuth, async (req, res) => {
  const data = await readMessages();
  data.messages = (data.messages || []).map((m) => ({ ...m, status: 'read' }));
  await writeMessages(data);
  res.json({ ok: true });
});

app.post('/api/admin/messages/:id/read', requireAuth, async (req, res) => {
  const data = await readMessages();
  data.messages = (data.messages || []).map((m) =>
    m.id === req.params.id ? { ...m, status: 'read' } : m
  );
  await writeMessages(data);
  res.json({ ok: true });
});

app.post('/api/admin/blog/publish', requireAuth, async (req, res) => {
  const body = req.body || {};
  const title = sanitize(body.title);
  const category = sanitize(body.category) || 'General';
  const readTime = sanitize(body.readTime) || '5 min read';
  const excerpt = sanitize(body.excerpt) || 'Read the full article for travel notes and practical tips.';
  const image = sanitize(body.image) || 'images/1.jpeg';
  const contentHtmlRaw = String(body.contentHtml || '').trim();
  const existingUrl = sanitize(body.existingUrl);

  if (!title) {
    return res.status(400).json({ ok: false, error: 'Title is required.' });
  }

  const safeContent = contentHtmlRaw
    ? contentHtmlRaw.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    : `<p>${escapeHtml(excerpt)}</p>`;

  let fileName = existingUrl.endsWith('.html') ? existingUrl : `${slugify(title)}.html`;
  let filePath = path.join(__dirname, fileName);

  if (!existingUrl) {
    let counter = 2;
    while (true) {
      try {
        await fs.access(filePath);
        fileName = `${slugify(title)}-${counter}.html`;
        filePath = path.join(__dirname, fileName);
        counter += 1;
      } catch (err) {
        break;
      }
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TuskersEdge | ${escapeHtml(title)}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: { jungle: '#064E3B', jungleLight: '#0F766E', sunset: '#F59E0B' },
            fontFamily: {
              heading: ['"Playfair Display"', 'serif'],
              body: ['"Inter"', 'system-ui', 'sans-serif'],
            },
          },
        },
      };
    </script>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body class="bg-slate-50 font-body text-slate-800">
    <main class="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12">
      <a href="blog.html" class="inline-flex rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Back to Blog</a>
      <article class="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        <div class="h-56 bg-cover bg-center md:h-72" style="background-image:url('${escapeHtml(image)}')"></div>
        <div class="p-6 md:p-8">
          <p class="text-[0.7rem] uppercase tracking-wide text-slate-500">${escapeHtml(category)} · ${escapeHtml(readTime)}</p>
          <h1 class="mt-2 font-heading text-3xl text-jungle md:text-4xl">${escapeHtml(title)}</h1>
          <p class="mt-3 text-sm text-slate-600">${escapeHtml(excerpt)}</p>
          <div class="prose prose-slate mt-6 max-w-none">${safeContent}</div>
        </div>
      </article>
    </main>
  </body>
</html>`;

  await fs.writeFile(filePath, html, 'utf8');
  res.json({ ok: true, url: fileName });
});

app.post('/api/admin/upload-image', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const fileName = sanitize(body.fileName) || 'upload';
    const dataUrl = String(body.dataUrl || '');
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ ok: false, error: 'Invalid image payload.' });
    }

    const mime = match[1].toLowerCase();
    const base64 = match[2];
    const extByMime = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
    };
    const ext = extByMime[mime];
    if (!ext) {
      return res.status(400).json({ ok: false, error: 'Unsupported image type.' });
    }

    const safeBase = slugify(path.basename(fileName, path.extname(fileName)));
    const unique = `${safeBase}-${Date.now().toString(36)}${ext}`;
    const outputDir = path.join(__dirname, 'images');
    const outputPath = path.join(outputDir, unique);
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, Buffer.from(base64, 'base64'));

    res.json({ ok: true, path: `images/${unique}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to upload image.' });
  }
});

app.delete('/api/admin/messages/:id', requireAuth, async (req, res) => {
  const data = await readMessages();
  data.messages = (data.messages || []).filter((m) => m.id !== req.params.id);
  await writeMessages(data);
  res.json({ ok: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

