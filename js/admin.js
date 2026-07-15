const loginOverlay = document.getElementById('admin-login');
const loginForm = document.getElementById('admin-login-form');
const loginError = document.getElementById('admin-login-error');
const logoutBtn = document.getElementById('admin-logout');

const toursTbody = document.getElementById('tours-tbody');
const galleryTbody = document.getElementById('gallery-tbody');
const blogTbody = document.getElementById('blog-tbody');
const districtsTbody = document.getElementById('districts-tbody');
const videosTbody = document.getElementById('videos-tbody');
const enquiriesTbody = document.getElementById('enquiries-tbody');

const summaryTours = document.getElementById('summary-tours');
const summaryFeatured = document.getElementById('summary-featured');
const summaryBlog = document.getElementById('summary-blog');
const summaryBlogFeatured = document.getElementById('summary-blog-featured');
const summaryGallery = document.getElementById('summary-gallery');
const summaryEnquiries = document.getElementById('summary-enquiries');

const addTourBtn = document.getElementById('add-tour-btn');
const addGalleryBtn = document.getElementById('add-gallery-btn');
const addBlogBtn = document.getElementById('add-blog-btn');
const syncGalleryBtn = document.getElementById('sync-gallery-btn');
const markAllReadBtn = document.getElementById('mark-all-read');

const tourForm = document.getElementById('tour-form');
const tourFormTitle = document.getElementById('tour-form-title');
const tourFormSubmit = document.getElementById('tour-form-submit');
const tourFormClear = document.getElementById('tour-form-clear');

const galleryForm = document.getElementById('gallery-form');
const galleryFormTitle = document.getElementById('gallery-form-title');
const galleryFormSubmit = document.getElementById('gallery-form-submit');
const galleryFormClear = document.getElementById('gallery-form-clear');
const galleryFileInput = document.getElementById('gallery-file');

const blogForm = document.getElementById('blog-form');
const blogFormTitle = document.getElementById('blog-form-title');
const blogFormSubmit = document.getElementById('blog-form-submit');
const blogFormClear = document.getElementById('blog-form-clear');
const blogContentEditor = document.getElementById('blog-content-editor');
const blogContentHtml = document.getElementById('blog-content-html');

const districtForm = document.getElementById('district-form');
const districtSelect = document.getElementById('district-select');
const districtFormSubmit = document.getElementById('district-form-submit');
const districtFormClear = document.getElementById('district-form-clear');
const districtResetDefault = document.getElementById('district-reset-default');
const districtContentEditor = document.getElementById('district-content-editor');
const districtContentHtml = document.getElementById('district-content-html');

const videoForm = document.getElementById('video-form');
const videoFormSubmit = document.getElementById('video-form-submit');
const videoFormClear = document.getElementById('video-form-clear');

let contentState = { tours: [], gallery: [], blog: [], districtGuides: {}, tiktokVideos: [] };
let messagesState = [];

let editingTourId = null;
let editingGalleryId = null;
let editingBlogId = null;
let editingDistrictKey = '';
let editingVideoId = null;

async function apiFetch(url, options = {}) {
  const tryFetch = (targetUrl) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(options.method || 'GET', targetUrl, true);
      xhr.withCredentials = true;

      const headers = options.headers || {};
      Object.keys(headers).forEach((key) => {
        xhr.setRequestHeader(key, headers[key]);
      });

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;
        const text = xhr.responseText || '';
        let payload = {};
        try {
          payload = text ? JSON.parse(text) : {};
        } catch (error) {
          payload = {};
        }
        resolve({
          response: {
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
          },
          payload,
        });
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(options.body || null);
    });

  const buildFallbackUrl = (targetUrl) => {
    if (typeof targetUrl !== 'string' || !targetUrl.startsWith('/api/')) return '';
    const route = targetUrl.slice('/api'.length) || '/';
    return `/api/index.php?route=${encodeURIComponent(route)}`;
  };

  let { response: res, payload: data } = await tryFetch(url);
  if (!res.ok && res.status === 404) {
    const fallbackUrl = buildFallbackUrl(url);
    if (fallbackUrl) {
      const secondTry = await tryFetch(fallbackUrl);
      res = secondTry.response;
      data = secondTry.payload;
    }
  }

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function showLogin(show) {
  if (!loginOverlay) return;
  loginOverlay.classList.toggle('hidden', !show);
  if (logoutBtn) logoutBtn.classList.toggle('hidden', show);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toBool(value) {
  return value === true || value === 'true' || value === 'on' || value === 1;
}

function normalizeContent() {
  if (!Array.isArray(contentState.tours)) contentState.tours = [];
  if (!Array.isArray(contentState.gallery)) contentState.gallery = [];
  if (!Array.isArray(contentState.blog)) contentState.blog = [];
  if (!Array.isArray(contentState.tiktokVideos)) contentState.tiktokVideos = [];
  if (!contentState.districtGuides || typeof contentState.districtGuides !== 'object') {
    contentState.districtGuides = {};
  }
}

function getBaseDistrictGuides() {
  return window.DISTRICT_GUIDES && typeof window.DISTRICT_GUIDES === 'object'
    ? window.DISTRICT_GUIDES
    : {};
}

const normalizeDistrictKeyExternal =
  typeof window.normalizeDistrictKey === 'function' ? window.normalizeDistrictKey.bind(window) : null;

function normalizeDistrictKeyValue(value) {
  if (normalizeDistrictKeyExternal) {
    return normalizeDistrictKeyExternal(value);
  }
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function districtDisplayName(key, guide) {
  if (guide && guide.name) return String(guide.name);
  return String(key || '')
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
    .join(' ');
}

function getDistrictKeys() {
  const base = Object.keys(getBaseDistrictGuides());
  const custom = Object.keys(contentState.districtGuides || {});
  const keys = Array.from(new Set([...base, ...custom])).filter(Boolean);
  keys.sort((a, b) => districtDisplayName(a, getDistrictGuide(a)).localeCompare(districtDisplayName(b, getDistrictGuide(b))));
  return keys;
}

function getDistrictGuide(key) {
  const normalized = normalizeDistrictKeyValue(key);
  const base = getBaseDistrictGuides()[normalized] || {};
  const custom = (contentState.districtGuides && contentState.districtGuides[normalized]) || {};
  return {
    ...base,
    ...custom,
    name: custom.name || base.name || districtDisplayName(normalized, base),
    highlights: Array.isArray(custom.highlights)
      ? custom.highlights
      : Array.isArray(base.highlights)
        ? base.highlights
        : [],
  };
}

function renderSummary() {
  normalizeContent();
  const featuredTours = contentState.tours.filter((item) => toBool(item.featured)).length;
  const featuredBlog = contentState.blog.filter((item) => toBool(item.featured)).length;
  const newMessages = messagesState.filter((item) => item.status !== 'read').length;

  if (summaryTours) summaryTours.textContent = String(contentState.tours.length);
  if (summaryFeatured) summaryFeatured.textContent = String(featuredTours);
  if (summaryBlog) summaryBlog.textContent = String(contentState.blog.length);
  if (summaryBlogFeatured) summaryBlogFeatured.textContent = String(featuredBlog);
  if (summaryGallery) summaryGallery.textContent = String(contentState.gallery.length);
  if (summaryEnquiries) summaryEnquiries.textContent = String(newMessages);
}

function renderTours() {
  if (!toursTbody) return;
  toursTbody.innerHTML = contentState.tours
    .map(
      (item) => `
      <tr>
        <td class="px-2 py-2">${escapeHtml(item.title)}</td>
        <td class="px-2 py-2">${escapeHtml(item.duration)}</td>
        <td class="px-2 py-2">${escapeHtml(item.type || '-')}</td>
        <td class="px-2 py-2">${toBool(item.featured) ? '<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] text-emerald-700">Homepage</span>' : '<span class="text-slate-400">No</span>'}</td>
        <td class="px-2 py-2">
          <button class="mr-3 text-emerald-700 hover:underline" data-edit-tour="${escapeHtml(item.id)}">Edit</button>
          <button class="text-rose-600 hover:underline" data-remove-tour="${escapeHtml(item.id)}">Remove</button>
        </td>
      </tr>
    `
    )
    .join('');
}

function renderGallery() {
  if (!galleryTbody) return;
  galleryTbody.innerHTML = contentState.gallery
    .map(
      (item) => `
      <tr>
        <td class="px-2 py-2">${escapeHtml(item.label)}</td>
        <td class="px-2 py-2">${escapeHtml(item.category)}</td>
        <td class="px-2 py-2">${escapeHtml(item.src)}</td>
        <td class="px-2 py-2">
          <button class="mr-3 text-emerald-700 hover:underline" data-edit-gallery="${escapeHtml(item.id)}">Edit</button>
          <button class="text-rose-600 hover:underline" data-remove-gallery="${escapeHtml(item.id)}">Remove</button>
        </td>
      </tr>
    `
    )
    .join('');
}

function renderBlog() {
  if (!blogTbody) return;
  blogTbody.innerHTML = contentState.blog
    .map(
      (item) => `
      <tr>
        <td class="px-2 py-2">${escapeHtml(item.title)}</td>
        <td class="px-2 py-2">${escapeHtml(item.category)}</td>
        <td class="px-2 py-2">${toBool(item.published) ? 'Yes' : 'No'}</td>
        <td class="px-2 py-2">${toBool(item.featured) ? 'Yes' : 'No'}</td>
        <td class="px-2 py-2">
          <button class="mr-3 text-emerald-700 hover:underline" data-edit-blog="${escapeHtml(item.id)}">Edit</button>
          <button class="text-rose-600 hover:underline" data-remove-blog="${escapeHtml(item.id)}">Remove</button>
        </td>
      </tr>
    `
    )
    .join('');
}

function renderDistrictSelectOptions() {
  if (!districtSelect) return;
  const keys = getDistrictKeys();
  const current = editingDistrictKey || districtSelect.value || keys[0] || '';
  districtSelect.innerHTML = keys
    .map((key) => {
      const guide = getDistrictGuide(key);
      return `<option value="${escapeHtml(key)}">${escapeHtml(districtDisplayName(key, guide))}</option>`;
    })
    .join('');
  districtSelect.value = keys.includes(current) ? current : keys[0] || '';
}

function renderDistrictGuides() {
  if (!districtsTbody) return;
  const keys = getDistrictKeys();
  districtsTbody.innerHTML = keys
    .map((key) => {
      const guide = getDistrictGuide(key);
      const hasCustom = !!(contentState.districtGuides && contentState.districtGuides[key]);
      const summary = String(guide.summary || '').trim() || '-';
      const article = String(guide.articleHtml || '').trim();
      return `
      <tr>
        <td class="px-2 py-2">${escapeHtml(districtDisplayName(key, guide))}</td>
        <td class="px-2 py-2">${escapeHtml(summary)}</td>
        <td class="px-2 py-2">${article ? '<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] text-emerald-700">Yes</span>' : '<span class="text-slate-400">No</span>'}</td>
        <td class="px-2 py-2">
          ${hasCustom ? '<span class="mr-2 rounded-full bg-sky-50 px-2 py-0.5 text-[0.65rem] text-sky-700">Custom</span>' : '<span class="mr-2 text-slate-400">Default</span>'}
          <button class="text-emerald-700 hover:underline" data-edit-district="${escapeHtml(key)}">Edit</button>
        </td>
      </tr>
    `;
    })
    .join('');
  renderDistrictSelectOptions();
}

function renderVideos() {
  if (!videosTbody) return;
  videosTbody.innerHTML = (contentState.tiktokVideos || [])
    .map(
      (item) => `
      <tr>
        <td class="px-2 py-2">${escapeHtml(item.title || '-')}</td>
        <td class="px-2 py-2">${escapeHtml(item.url || '-')}</td>
        <td class="px-2 py-2">
          <button class="mr-3 text-emerald-700 hover:underline" data-edit-video="${escapeHtml(item.id)}">Edit</button>
          <button class="text-rose-600 hover:underline" data-remove-video="${escapeHtml(item.id)}">Remove</button>
        </td>
      </tr>
    `
    )
    .join('');
}

function renderEnquiries() {
  if (!enquiriesTbody) return;
  enquiriesTbody.innerHTML = messagesState
    .slice()
    .reverse()
    .map(
      (item) => `
      <tr>
        <td class="px-2 py-2">${escapeHtml(item.name || '-')}</td>
        <td class="px-2 py-2">${escapeHtml(item.email || item.phone || '-')}</td>
        <td class="px-2 py-2">${escapeHtml(item.month || '-')} - ${escapeHtml(item.nights || '-')}</td>
        <td class="px-2 py-2">${escapeHtml(item.interests || '-')}</td>
        <td class="px-2 py-2">${item.status === 'read' ? '<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] text-emerald-700">Read</span>' : '<span class="rounded-full bg-amber-50 px-2 py-0.5 text-[0.65rem] text-amber-700">New</span>'}</td>
        <td class="px-2 py-2">
          <button class="mr-3 text-emerald-700 hover:underline" data-read-message="${escapeHtml(item.id)}">Read</button>
          <button class="text-rose-600 hover:underline" data-delete-message="${escapeHtml(item.id)}">Delete</button>
        </td>
      </tr>
    `
    )
    .join('');
}

function resetTourForm() {
  if (!tourForm) return;
  tourForm.reset();
  editingTourId = null;
  if (tourFormTitle) tourFormTitle.textContent = 'Add a new tour';
  if (tourFormSubmit) tourFormSubmit.textContent = 'Save tour';
}

function resetGalleryForm() {
  if (!galleryForm) return;
  galleryForm.reset();
  if (galleryFileInput) galleryFileInput.value = '';
  editingGalleryId = null;
  if (galleryFormTitle) galleryFormTitle.textContent = 'Add a new image';
  if (galleryFormSubmit) galleryFormSubmit.textContent = 'Save image';
}

function resetBlogForm() {
  if (!blogForm) return;
  blogForm.reset();
  editingBlogId = null;
  if (blogContentEditor) blogContentEditor.innerHTML = '';
  if (blogContentHtml) blogContentHtml.value = '';
  if (blogFormTitle) blogFormTitle.textContent = 'Add a new post';
  if (blogFormSubmit) blogFormSubmit.textContent = 'Save post';
}

function fillDistrictForm(key) {
  if (!districtForm) return;
  const normalized = normalizeDistrictKeyValue(key);
  const guide = getDistrictGuide(normalized);
  editingDistrictKey = normalized;
  if (districtSelect) districtSelect.value = normalized;
  districtForm.elements.name.value = guide.name || '';
  districtForm.elements.summary.value = guide.summary || '';
  districtForm.elements.climate.value = guide.climate || '';
  districtForm.elements.weather.value = guide.weather || '';
  districtForm.elements.focus.value = guide.focus || '';
  districtForm.elements.image.value = guide.image || '';
  districtForm.elements.highlights.value = (Array.isArray(guide.highlights) ? guide.highlights : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join('\n');
  if (districtContentEditor) districtContentEditor.innerHTML = guide.articleHtml || '';
  if (districtContentHtml) districtContentHtml.value = guide.articleHtml || '';
  if (districtFormSubmit) districtFormSubmit.textContent = 'Update district article';
}

function resetDistrictForm() {
  if (!districtForm) return;
  renderDistrictSelectOptions();
  const firstKey = districtSelect?.value || getDistrictKeys()[0] || '';
  fillDistrictForm(firstKey);
}

function resetVideoForm() {
  if (!videoForm) return;
  videoForm.reset();
  editingVideoId = null;
  if (videoFormSubmit) videoFormSubmit.textContent = 'Save video';
}

function insertHtmlAtCursor(html, fallbackEditor) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    if (fallbackEditor) fallbackEditor.innerHTML += html;
    return;
  }
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createElement('div');
  node.innerHTML = html;
  const fragment = document.createDocumentFragment();
  let child;
  let lastNode = null;
  while ((child = node.firstChild)) {
    lastNode = fragment.appendChild(child);
  }
  range.insertNode(fragment);
  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function parseBackgroundImageUrl(styleValue) {
  const match = String(styleValue || '').match(/url\((['"]?)(.*?)\1\)/i);
  return match ? String(match[2] || '').trim() : '';
}

function normalizeSrc(src) {
  return String(src || '').trim().replace(/^["']|["']$/g, '').toLowerCase();
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function importGalleryFromPage() {
  const res = await fetch('/gallery.html', { cache: 'no-store' });
  if (!res.ok) return 0;
  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const nodes = Array.from(doc.querySelectorAll('.gallery-item[data-category]'));
  if (!nodes.length) return 0;

  const existingSrc = new Set((contentState.gallery || []).map((item) => normalizeSrc(item.src)));
  let added = 0;

  nodes.forEach((node, index) => {
    const category = String(node.getAttribute('data-category') || '').trim();
    const src =
      parseBackgroundImageUrl(node.getAttribute('style')) ||
      parseBackgroundImageUrl(node.style?.backgroundImage);
    const labelNode = node.querySelector('.font-semibold');
    const label = String(labelNode?.textContent || '').trim() || `Gallery image ${index + 1}`;
    if (!src || !category) return;
    const normalized = normalizeSrc(src);
    if (existingSrc.has(normalized)) return;

    contentState.gallery.push({
      id: `gallery-import-${slugify(label)}-${Date.now().toString(36)}-${index}`,
      label,
      category,
      src,
    });
    existingSrc.add(normalized);
    added += 1;
  });

  return added;
}

async function saveContent() {
  normalizeContent();
  await apiFetch('/api/admin/content', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contentState),
  });
}

async function refreshData() {
  const [contentRes, messagesRes] = await Promise.all([
    apiFetch('/api/admin/content'),
    apiFetch('/api/admin/messages'),
  ]);
  contentState = contentRes.content || { tours: [], gallery: [], blog: [], districtGuides: {}, tiktokVideos: [] };
  messagesState = messagesRes.messages || [];
  normalizeContent();
  renderSummary();
  renderTours();
  renderGallery();
  renderBlog();
  renderDistrictGuides();
  renderVideos();
  if (districtForm) resetDistrictForm();
  renderEnquiries();
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (loginError) loginError.classList.add('hidden');
    const formData = new FormData(loginForm);
    const payload = Object.fromEntries(formData.entries());

    try {
      await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await refreshData();
      showLogin(false);
      loginForm.reset();
    } catch (error) {
      if (loginError) {
        loginError.textContent = error?.message || 'Login failed.';
        loginError.classList.remove('hidden');
      }
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await apiFetch('/api/logout', { method: 'POST' });
    } finally {
      showLogin(true);
    }
  });
}

if (tourForm) {
  tourForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(tourForm);
    const payload = Object.fromEntries(formData.entries());

    const item = {
      id: editingTourId || `tour-${Date.now().toString(36)}`,
      title: String(payload.title || '').trim(),
      duration: String(payload.duration || '').trim(),
      type: String(payload.type || '').trim(),
      description: String(payload.description || '').trim(),
      price: String(payload.price || '').trim(),
      featured: payload.featured === 'on',
      image: String(payload.image || '').trim(),
    };

    if (!item.title || !item.duration || !item.type || !item.description || !item.price || !item.image) {
      return;
    }

    const existingIndex = contentState.tours.findIndex((entry) => entry.id === item.id);
    if (existingIndex >= 0) {
      contentState.tours[existingIndex] = item;
    } else {
      contentState.tours.unshift(item);
    }

    await saveContent();
    renderSummary();
    renderTours();
    resetTourForm();
  });
}

if (galleryForm) {
  galleryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const formData = new FormData(galleryForm);
      const payload = Object.fromEntries(formData.entries());
      let src = String(payload.src || '').trim();
      const file = galleryFileInput?.files?.[0] || null;

      if (file) {
        const toBase64 = (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        const dataUrl = await toBase64(file);
        const uploadRes = await apiFetch('/api/admin/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            dataUrl,
          }),
        });
        src = uploadRes.path || src;
      }

      const item = {
        id: editingGalleryId || `gallery-${Date.now().toString(36)}`,
        label: String(payload.label || '').trim(),
        category: String(payload.category || '').trim(),
        src,
      };

      if (!item.label || !item.category || !item.src) {
        alert('Label, category, and image are required.');
        return;
      }

      const existingIndex = contentState.gallery.findIndex((entry) => entry.id === item.id);
      if (existingIndex >= 0) {
        contentState.gallery[existingIndex] = item;
      } else {
        contentState.gallery.unshift(item);
      }

      await saveContent();
      renderSummary();
      renderGallery();
      resetGalleryForm();
    } catch (error) {
      alert(error?.message || 'Image upload failed.');
    }
  });
}

if (blogForm) {
  blogForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      if (blogContentHtml && blogContentEditor) {
        blogContentHtml.value = blogContentEditor.innerHTML.trim();
      }
      const formData = new FormData(blogForm);
      const payload = Object.fromEntries(formData.entries());

      const item = {
        id: editingBlogId || `blog-${Date.now().toString(36)}`,
        title: String(payload.title || '').trim(),
        category: String(payload.category || '').trim(),
        url: String(payload.url || '').trim(),
        image: String(payload.image || '').trim(),
        readTime: String(payload.readTime || '').trim(),
        excerpt: String(payload.excerpt || '').trim(),
        contentHtml: String(payload.contentHtml || '').trim(),
        published: payload.published === 'on',
        featured: payload.featured === 'on',
      };

      if (!item.title || !item.category) {
        alert('Blog title and category are required.');
        return;
      }

      if (item.published) {
        const publishRes = await apiFetch('/api/admin/blog/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.title,
            category: item.category,
            readTime: item.readTime,
            excerpt: item.excerpt,
            image: item.image,
            contentHtml: item.contentHtml,
            existingUrl: item.url,
          }),
        });
        if (publishRes?.url) item.url = publishRes.url;
      }

      const existingIndex = contentState.blog.findIndex((entry) => entry.id === item.id);
      if (existingIndex >= 0) {
        contentState.blog[existingIndex] = item;
      } else {
        contentState.blog.unshift(item);
      }

      await saveContent();
      renderSummary();
      renderBlog();
      resetBlogForm();
    } catch (error) {
      alert(error?.message || 'Failed to save blog post.');
    }
  });
}

if (districtForm) {
  districtForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (districtContentHtml && districtContentEditor) {
      districtContentHtml.value = districtContentEditor.innerHTML.trim();
    }

    const formData = new FormData(districtForm);
    const payload = Object.fromEntries(formData.entries());
    const districtKey = normalizeDistrictKeyValue(payload.district || editingDistrictKey);
    if (!districtKey) {
      alert('Please select a district.');
      return;
    }

    const highlights = String(payload.highlights || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    contentState.districtGuides[districtKey] = {
      name: String(payload.name || '').trim(),
      summary: String(payload.summary || '').trim(),
      climate: String(payload.climate || '').trim(),
      weather: String(payload.weather || '').trim(),
      focus: String(payload.focus || '').trim(),
      image: String(payload.image || '').trim(),
      highlights,
      articleHtml: String(payload.articleHtml || '').trim(),
      updatedAt: new Date().toISOString(),
    };

    await saveContent();
    renderDistrictGuides();
    fillDistrictForm(districtKey);
  });
}

if (videoForm) {
  videoForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(videoForm);
    const payload = Object.fromEntries(formData.entries());
    const url = String(payload.url || '').trim();
    const idMatch = url.match(/\/video\/(\d+)/);
    const videoId = idMatch ? idMatch[1] : '';

    if (!url || !videoId) {
      alert('Please enter a valid TikTok video URL.');
      return;
    }

    const item = {
      id: editingVideoId || `video-${Date.now().toString(36)}`,
      title: String(payload.title || '').trim() || `TikTok ${videoId}`,
      url,
      videoId,
    };

    const index = contentState.tiktokVideos.findIndex((entry) => entry.id === item.id);
    if (index >= 0) {
      contentState.tiktokVideos[index] = item;
    } else {
      contentState.tiktokVideos.unshift(item);
    }

    await saveContent();
    renderVideos();
    resetVideoForm();
  });
}

if (tourFormClear) {
  tourFormClear.addEventListener('click', resetTourForm);
}

if (galleryFormClear) {
  galleryFormClear.addEventListener('click', resetGalleryForm);
}

if (blogFormClear) {
  blogFormClear.addEventListener('click', resetBlogForm);
}

if (districtFormClear) {
  districtFormClear.addEventListener('click', resetDistrictForm);
}

if (videoFormClear) {
  videoFormClear.addEventListener('click', resetVideoForm);
}

if (addTourBtn) {
  addTourBtn.addEventListener('click', () => {
    resetTourForm();
    if (tourForm?.elements?.title) {
      tourForm.elements.title.focus();
      tourForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

if (addGalleryBtn) {
  addGalleryBtn.addEventListener('click', () => {
    resetGalleryForm();
    if (galleryForm?.elements?.label) {
      galleryForm.elements.label.focus();
      galleryForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

if (syncGalleryBtn) {
  syncGalleryBtn.addEventListener('click', async () => {
    const previousLabel = syncGalleryBtn.textContent;
    syncGalleryBtn.disabled = true;
    syncGalleryBtn.textContent = 'Syncing...';
    try {
      const added = await importGalleryFromPage();
      if (added > 0) {
        await saveContent();
        renderSummary();
        renderGallery();
      }
      syncGalleryBtn.textContent = added > 0 ? `Synced ${added} image${added > 1 ? 's' : ''}` : 'Already synced';
    } catch (error) {
      syncGalleryBtn.textContent = 'Sync failed';
    } finally {
      setTimeout(() => {
        syncGalleryBtn.textContent = previousLabel || 'Sync from gallery page';
        syncGalleryBtn.disabled = false;
      }, 1400);
    }
  });
}

if (addBlogBtn) {
  addBlogBtn.addEventListener('click', () => {
    resetBlogForm();
    if (blogForm?.elements?.title) {
      blogForm.elements.title.focus();
      blogForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

if (toursTbody) {
  toursTbody.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const editId = target.getAttribute('data-edit-tour');
    if (editId) {
      const item = contentState.tours.find((entry) => entry.id === editId);
      if (!item || !tourForm) return;
      editingTourId = item.id;
      tourForm.elements.title.value = item.title || '';
      tourForm.elements.duration.value = item.duration || '';
      tourForm.elements.type.value = item.type || '';
      tourForm.elements.description.value = item.description || '';
      tourForm.elements.price.value = item.price || '';
      tourForm.elements.image.value = item.image || '';
      tourForm.elements.featured.checked = toBool(item.featured);
      if (tourFormTitle) tourFormTitle.textContent = 'Edit tour';
      if (tourFormSubmit) tourFormSubmit.textContent = 'Update tour';
      return;
    }

    const removeId = target.getAttribute('data-remove-tour');
    if (removeId) {
      contentState.tours = contentState.tours.filter((entry) => entry.id !== removeId);
      await saveContent();
      renderSummary();
      renderTours();
      if (editingTourId === removeId) resetTourForm();
    }
  });
}

if (galleryTbody) {
  galleryTbody.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const editId = target.getAttribute('data-edit-gallery');
    if (editId) {
      const item = contentState.gallery.find((entry) => entry.id === editId);
      if (!item || !galleryForm) return;
      editingGalleryId = item.id;
      galleryForm.elements.label.value = item.label || '';
      galleryForm.elements.category.value = item.category || '';
      galleryForm.elements.src.value = item.src || '';
      if (galleryFormTitle) galleryFormTitle.textContent = 'Edit image';
      if (galleryFormSubmit) galleryFormSubmit.textContent = 'Update image';
      return;
    }

    const removeId = target.getAttribute('data-remove-gallery');
    if (removeId) {
      contentState.gallery = contentState.gallery.filter((entry) => entry.id !== removeId);
      await saveContent();
      renderSummary();
      renderGallery();
      if (editingGalleryId === removeId) resetGalleryForm();
    }
  });
}

if (blogTbody) {
  blogTbody.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const editId = target.getAttribute('data-edit-blog');
    if (editId) {
      const item = contentState.blog.find((entry) => entry.id === editId);
      if (!item || !blogForm) return;
      editingBlogId = item.id;
      blogForm.elements.title.value = item.title || '';
      blogForm.elements.category.value = item.category || '';
      blogForm.elements.url.value = item.url || '';
      blogForm.elements.image.value = item.image || '';
      blogForm.elements.readTime.value = item.readTime || '';
      blogForm.elements.excerpt.value = item.excerpt || '';
      if (blogContentEditor) blogContentEditor.innerHTML = item.contentHtml || '';
      blogForm.elements.published.checked = toBool(item.published);
      blogForm.elements.featured.checked = toBool(item.featured);
      if (blogFormTitle) blogFormTitle.textContent = 'Edit post';
      if (blogFormSubmit) blogFormSubmit.textContent = 'Update post';
      return;
    }

    const removeId = target.getAttribute('data-remove-blog');
    if (removeId) {
      contentState.blog = contentState.blog.filter((entry) => entry.id !== removeId);
      await saveContent();
      renderSummary();
      renderBlog();
      if (editingBlogId === removeId) resetBlogForm();
    }
  });
}

if (districtSelect) {
  districtSelect.addEventListener('change', () => {
    fillDistrictForm(districtSelect.value);
  });
}

if (districtsTbody) {
  districtsTbody.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const editKey = target.getAttribute('data-edit-district');
    if (!editKey) return;
    fillDistrictForm(editKey);
    districtForm?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

if (districtResetDefault) {
  districtResetDefault.addEventListener('click', async () => {
    const key = normalizeDistrictKeyValue(districtSelect?.value || editingDistrictKey);
    if (!key) return;
    if (contentState.districtGuides && contentState.districtGuides[key]) {
      delete contentState.districtGuides[key];
      await saveContent();
    }
    renderDistrictGuides();
    fillDistrictForm(key);
  });
}

if (videosTbody) {
  videosTbody.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const editId = target.getAttribute('data-edit-video');
    if (editId) {
      const item = contentState.tiktokVideos.find((entry) => entry.id === editId);
      if (!item || !videoForm) return;
      editingVideoId = item.id;
      videoForm.elements.title.value = item.title || '';
      videoForm.elements.url.value = item.url || '';
      if (videoFormSubmit) videoFormSubmit.textContent = 'Update video';
      return;
    }

    const removeId = target.getAttribute('data-remove-video');
    if (removeId) {
      contentState.tiktokVideos = contentState.tiktokVideos.filter((entry) => entry.id !== removeId);
      await saveContent();
      renderVideos();
      if (editingVideoId === removeId) resetVideoForm();
    }
  });
}

function bindPasteImage(editorEl) {
  if (!editorEl) return;
  editorEl.addEventListener('paste', (event) => {
    const items = event.clipboardData?.items || [];
    const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    event.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      if (!src) return;
      editorEl.focus();
      insertHtmlAtCursor(`<p><img src="${src}" alt="Pasted image" style="max-width:100%;height:auto;border-radius:12px;" /></p>`, editorEl);
    };
    reader.readAsDataURL(file);
  });
}

bindPasteImage(blogContentEditor);
bindPasteImage(districtContentEditor);

if (enquiriesTbody) {
  enquiriesTbody.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const readId = target.getAttribute('data-read-message');
    if (readId) {
      messagesState = messagesState.map((entry) =>
        entry.id === readId ? { ...entry, status: 'read' } : entry
      );
      await apiFetch(`/api/admin/messages/${encodeURIComponent(readId)}/read`, { method: 'POST' });
      renderSummary();
      renderEnquiries();
      return;
    }

    const deleteId = target.getAttribute('data-delete-message');
    if (deleteId) {
      await apiFetch(`/api/admin/messages/${encodeURIComponent(deleteId)}`, { method: 'DELETE' });
      messagesState = messagesState.filter((entry) => entry.id !== deleteId);
      renderSummary();
      renderEnquiries();
    }
  });
}

if (markAllReadBtn) {
  markAllReadBtn.addEventListener('click', async () => {
    await apiFetch('/api/admin/messages/mark-read', { method: 'POST' });
    messagesState = messagesState.map((entry) => ({ ...entry, status: 'read' }));
    renderSummary();
    renderEnquiries();
  });
}

async function init() {
  try {
    const session = await apiFetch('/api/session');
    if (session && session.authenticated) {
      await refreshData();
      showLogin(false);
      return;
    }
    showLogin(true);
  } catch (error) {
    showLogin(true);
  }
}

init();



