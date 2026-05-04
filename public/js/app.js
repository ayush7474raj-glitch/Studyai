// ============================================
// StudyNovaAI — App SPA JavaScript
// ============================================

const token = localStorage.getItem('sn_token');
const user = JSON.parse(localStorage.getItem('sn_user') || 'null');

// Auth guard
if (!token || !user) {
  window.location.href = '/';
}

// Init user info
document.getElementById('userAvatar').textContent = (user?.username || 'U')[0].toUpperCase();
document.getElementById('topbarAvatar').textContent = (user?.username || 'U')[0].toUpperCase();
document.getElementById('userName').textContent = user?.username || '';
document.getElementById('userEmail').textContent = user?.email || '';
document.getElementById('dashUser').textContent = user?.username || 'there';

// Mermaid init
mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'Inter, sans-serif', fontSize: 14 });

// ===== ROUTING =====
const pages = {
  dashboard: 'Dashboard',
  flashcards: 'Flashcards',
  notes: 'Smart Notes',
  flowcharts: 'Flowcharts',
  chatbot: 'AI Tutor'
};

function navigate(page, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  if (navEl) navEl.classList.add('active');
  else {
    const el = document.querySelector(`[data-page="${page}"]`);
    if (el) el.classList.add('active');
  }

  document.getElementById('topbarTitle').textContent = pages[page] || page;

  // Close sidebar on mobile
  if (window.innerWidth <= 900) closeSidebar();

  // Load saved data when navigating to pages
  if (page === 'flashcards') loadSavedFlashcards();
  if (page === 'notes') loadSavedNotes();
}

// Sidebar toggle
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
  let overlay = document.getElementById('sidebarOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    overlay.className = 'sidebar-overlay';
    overlay.onclick = closeSidebar;
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle('show', sidebar.classList.contains('open'));
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const o = document.getElementById('sidebarOverlay');
  if (o) o.classList.remove('show');
}

function logout() {
  localStorage.removeItem('sn_token');
  localStorage.removeItem('sn_user');
  window.location.href = '/';
}

const authHeader = () => ({ 'Authorization': `Bearer ${token}` });

// ============================================
// FLASHCARDS
// ============================================
let fcCards = [];
let fcIndex = 0;
let fcCurrentId = null;

async function handleFcUpload() {
  const file = document.getElementById('fcFile').files[0];
  if (!file) return;

  document.getElementById('fcUploadZone').classList.add('hidden');
  document.getElementById('fcGenerating').classList.remove('hidden');

  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/ai/flashcards', {
      method: 'POST',
      headers: authHeader(),
      body: fd
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to generate flashcards');
    renderFlashcards(data.cards, data.title);
  } catch (err) {
    alert('Error: ' + err.message);
    resetFc();
  }
}

function renderFlashcards(cards, title) {
  fcCards = cards;
  fcIndex = 0;

  document.getElementById('fcGenerating').classList.add('hidden');
  document.getElementById('fcResult').classList.remove('hidden');
  document.getElementById('fcTitle').textContent = title;

  updateCard();
  buildDots();
  buildAllGrid();
  loadSavedFlashcards();
}

function updateCard() {
  const card = fcCards[fcIndex];
  document.getElementById('fcQuestion').textContent = card.question;
  document.getElementById('fcAnswer').textContent = card.answer;
  document.getElementById('fcProgress').textContent = `Card ${fcIndex + 1} of ${fcCards.length}`;
  document.getElementById('progressFill').style.width = `${((fcIndex + 1) / fcCards.length) * 100}%`;

  // Reset flip
  document.getElementById('flashcardInner').classList.remove('flipped');

  // Dots
  document.querySelectorAll('.fc-dot').forEach((d, i) => d.classList.toggle('active', i === fcIndex));
}

function flipCard() {
  document.getElementById('flashcardInner').classList.toggle('flipped');
}

function nextCard() {
  if (fcIndex < fcCards.length - 1) { fcIndex++; updateCard(); }
}
function prevCard() {
  if (fcIndex > 0) { fcIndex--; updateCard(); }
}

function buildDots() {
  const dots = document.getElementById('fcDots');
  dots.innerHTML = '';
  const max = Math.min(fcCards.length, 15);
  for (let i = 0; i < max; i++) {
    const d = document.createElement('div');
    d.className = 'fc-dot' + (i === 0 ? ' active' : '');
    d.onclick = () => { fcIndex = i; updateCard(); };
    dots.appendChild(d);
  }
}

function buildAllGrid() {
  const grid = document.getElementById('fcAllGrid');
  grid.innerHTML = '';
  fcCards.forEach((card, i) => {
    const el = document.createElement('div');
    el.className = 'fc-mini';
    el.innerHTML = `<div class="fc-mini-q">Q${i+1}: ${card.question}</div><div class="fc-mini-a">A: ${card.answer}</div>`;
    el.onclick = () => el.classList.toggle('revealed');
    grid.appendChild(el);
  });
}

function shuffleCards() {
  fcCards = fcCards.sort(() => Math.random() - 0.5);
  fcIndex = 0;
  updateCard();
  buildDots();
  buildAllGrid();
}

function resetFc() {
  fcCards = [];
  fcIndex = 0;
  document.getElementById('fcFile').value = '';
  document.getElementById('fcUploadZone').classList.remove('hidden');
  document.getElementById('fcGenerating').classList.add('hidden');
  document.getElementById('fcResult').classList.add('hidden');
}

async function loadSavedFlashcards() {
  try {
    const res = await fetch('/api/ai/flashcards', { headers: authHeader() });
    const sets = await res.json();
    const list = document.getElementById('fcSavedList');
    if (!sets.length) {
      list.innerHTML = '<p style="font-size:0.85rem;color:var(--text-muted)">No saved sets yet. Upload a file to generate your first flashcard set.</p>';
      return;
    }
    list.innerHTML = sets.map(s => `
      <div class="saved-item">
        <div>
          <div class="saved-item-title">${s.title}</div>
          <div class="saved-item-meta">${s.cards.length} cards · ${new Date(s.created_at).toLocaleDateString()}</div>
        </div>
        <div class="saved-item-actions">
          <button class="btn-sm btn-primary-sm" onclick="loadSavedSet(${s.id})">Study</button>
          <button class="btn-sm" onclick="deleteFcSet(${s.id})">🗑</button>
        </div>
      </div>
    `).join('');
  } catch {}
}

async function loadSavedSet(id) {
  try {
    const res = await fetch('/api/ai/flashcards', { headers: authHeader() });
    const sets = await res.json();
    const set = sets.find(s => s.id === id);
    if (set) renderFlashcards(set.cards, set.title);
  } catch {}
}

async function deleteFcSet(id) {
  if (!confirm('Delete this flashcard set?')) return;
  await fetch(`/api/ai/flashcards/${id}`, { method: 'DELETE', headers: authHeader() });
  loadSavedFlashcards();
}

// ============================================
// NOTES
// ============================================
let currentNoteId = null;
let notesContent = '';

async function handleNotesUpload() {
  const file = document.getElementById('notesFile').files[0];
  if (!file) return;

  document.getElementById('notesUploadZone').classList.add('hidden');
  document.getElementById('notesGenerating').classList.remove('hidden');

  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/ai/notes', {
      method: 'POST',
      headers: authHeader(),
      body: fd
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to generate notes');
    renderNotes(data.content, data.title, data.id);
    loadSavedNotes();
  } catch (err) {
    alert('Error: ' + err.message);
    resetNotes();
  }
}

function renderNotes(content, title, id) {
  notesContent = content;
  currentNoteId = id;

  document.getElementById('notesGenerating').classList.add('hidden');
  document.getElementById('notesResult').classList.remove('hidden');
  document.getElementById('notesTitleInput').value = title;
  document.getElementById('notesView').innerHTML = marked.parse(content);
  document.getElementById('notesEditor').value = content;
}

function toggleEdit() {
  const view = document.getElementById('notesView');
  const editor = document.getElementById('notesEditor');
  const isEditing = !editor.classList.contains('hidden');

  if (isEditing) {
    // Save edit and show preview
    notesContent = editor.value;
    view.innerHTML = marked.parse(notesContent);
    view.classList.remove('hidden');
    editor.classList.add('hidden');
  } else {
    view.classList.add('hidden');
    editor.classList.remove('hidden');
    editor.focus();
  }
}

async function saveNote() {
  if (!currentNoteId) return;
  const content = document.getElementById('notesEditor').classList.contains('hidden')
    ? notesContent
    : document.getElementById('notesEditor').value;
  const title = document.getElementById('notesTitleInput').value;

  try {
    await fetch(`/api/ai/notes/${currentNoteId}`, {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, title })
    });
    showToast('Note saved!');
    loadSavedNotes();
  } catch {}
}

async function notesToFlashcards() {
  if (!currentNoteId) return;
  const btn = event.target;
  btn.textContent = 'Converting...';
  btn.disabled = true;
  try {
    const res = await fetch(`/api/ai/notes/${currentNoteId}/to-flashcards`, {
      method: 'POST',
      headers: authHeader()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    navigate('flashcards', null);
    setTimeout(() => renderFlashcards(data.cards, data.title), 100);
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.textContent = '⚡ → Flashcards';
    btn.disabled = false;
  }
}

function resetNotes() {
  currentNoteId = null;
  notesContent = '';
  document.getElementById('notesFile').value = '';
  document.getElementById('notesUploadZone').classList.remove('hidden');
  document.getElementById('notesGenerating').classList.add('hidden');
  document.getElementById('notesResult').classList.add('hidden');
}

async function loadSavedNotes() {
  try {
    const res = await fetch('/api/ai/notes', { headers: authHeader() });
    const notes = await res.json();
    const list = document.getElementById('notesSavedList');
    if (!notes.length) {
      list.innerHTML = '<p style="font-size:0.85rem;color:var(--text-muted)">No saved notes yet.</p>';
      return;
    }
    list.innerHTML = notes.map(n => `
      <div class="saved-item">
        <div>
          <div class="saved-item-title">${n.title}</div>
          <div class="saved-item-meta">${new Date(n.updated_at).toLocaleDateString()}</div>
        </div>
        <div class="saved-item-actions">
          <button class="btn-sm btn-primary-sm" onclick="openNote(${n.id})">Open</button>
          <button class="btn-sm" onclick="deleteNote(${n.id})">🗑</button>
        </div>
      </div>
    `).join('');
  } catch {}
}

async function openNote(id) {
  try {
    const res = await fetch('/api/ai/notes', { headers: authHeader() });
    const notes = await res.json();
    const note = notes.find(n => n.id === id);
    if (note) renderNotes(note.content, note.title, note.id);
    document.getElementById('notesUploadZone').classList.add('hidden');
  } catch {}
}

async function deleteNote(id) {
  if (!confirm('Delete this note?')) return;
  await fetch(`/api/ai/notes/${id}`, { method: 'DELETE', headers: authHeader() });
  loadSavedNotes();
  if (currentNoteId === id) resetNotes();
}

// ============================================
// FLOWCHARTS
// ============================================
async function handleFlowchartUpload() {
  const file = document.getElementById('fcwFile').files[0];
  if (!file) return;

  document.getElementById('fcwUploadZone').classList.add('hidden');
  document.getElementById('fcwGenerating').classList.remove('hidden');

  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/ai/flowchart', {
      method: 'POST',
      headers: authHeader(),
      body: fd
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to generate flowchart');

    document.getElementById('fcwGenerating').classList.add('hidden');
    document.getElementById('fcwResult').classList.remove('hidden');
    document.getElementById('fcwSummary').textContent = data.summary || '';

    const chartEl = document.getElementById('mermaidChart');
    chartEl.innerHTML = '';
    chartEl.removeAttribute('data-processed');
    chartEl.textContent = data.mermaid;
    await mermaid.run({ nodes: [chartEl] });
  } catch (err) {
    alert('Error: ' + err.message);
    resetFlowchart();
  }
}

function resetFlowchart() {
  document.getElementById('fcwFile').value = '';
  document.getElementById('fcwUploadZone').classList.remove('hidden');
  document.getElementById('fcwGenerating').classList.add('hidden');
  document.getElementById('fcwResult').classList.add('hidden');
}

// ============================================
// CHATBOT
// ============================================
let chatHistory = [];
let chatFileContext = '';

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

async function handleChatFile() {
  const file = document.getElementById('chatFile').files[0];
  if (!file) return;
  document.getElementById('chatFileName').textContent = `📄 ${file.name}`;

  const fd = new FormData();
  fd.append('file', file);
  fd.append('message', 'Please acknowledge you received this document and briefly describe what it contains.');
  fd.append('history', JSON.stringify([]));

  try {
    addBubble('📎 File attached: ' + file.name, 'user');
    showTyping();
    const res = await fetch('/api/ai/chat', { method: 'POST', headers: authHeader(), body: fd });
    const data = await res.json();
    hideTyping();
    if (data.reply) {
      addBubble(data.reply, 'ai');
      chatHistory.push({ role: 'user', content: 'I uploaded a file: ' + file.name });
      chatHistory.push({ role: 'assistant', content: data.reply });
    }
  } catch {}
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  input.style.height = 'auto';
  document.getElementById('chatSendBtn').disabled = true;

  // Remove welcome screen
  const welcome = document.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  addBubble(message, 'user');
  showTyping();

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: JSON.stringify(chatHistory.slice(-20)), fileContext: chatFileContext })
    });
    const data = await res.json();
    hideTyping();
    if (data.reply) {
      addBubble(data.reply, 'ai');
      chatHistory.push({ role: 'user', content: message });
      chatHistory.push({ role: 'assistant', content: data.reply });
    } else {
      addBubble('Sorry, I encountered an error. Please try again.', 'ai');
    }
  } catch {
    hideTyping();
    addBubble('Network error. Please check your connection.', 'ai');
  } finally {
    document.getElementById('chatSendBtn').disabled = false;
  }
}

function sendStarter(msg) {
  document.getElementById('chatInput').value = msg;
  sendMessage();
}

function addBubble(text, role) {
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-bubble ${role}`;
  if (role === 'ai') {
    div.innerHTML = marked.parse(text);
  } else {
    div.textContent = text;
  }
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

let typingEl = null;
function showTyping() {
  const msgs = document.getElementById('chatMessages');
  typingEl = document.createElement('div');
  typingEl.className = 'chat-typing';
  typingEl.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  msgs.appendChild(typingEl);
  msgs.scrollTop = msgs.scrollHeight;
}
function hideTyping() {
  if (typingEl) { typingEl.remove(); typingEl = null; }
}

function clearChat() {
  chatHistory = [];
  chatFileContext = '';
  document.getElementById('chatFileName').textContent = 'No file chosen';
  document.getElementById('chatFile').value = '';
  const msgs = document.getElementById('chatMessages');
  msgs.innerHTML = `
    <div class="chat-welcome">
      <div class="chat-welcome-icon">🤖</div>
      <h3>Hi! I'm your StudyNova AI Tutor</h3>
      <p>I'm powered by Claude AI and can help you understand any subject, explain complex topics, solve problems step-by-step, and analyse your uploaded documents.</p>
      <div class="chat-starters">
        <button class="starter-btn" onclick="sendStarter('Explain photosynthesis in simple terms')">Explain photosynthesis</button>
        <button class="starter-btn" onclick="sendStarter('Help me understand the French Revolution')">French Revolution</button>
        <button class="starter-btn" onclick="sendStarter('How do I solve quadratic equations?')">Quadratic equations</button>
        <button class="starter-btn" onclick="sendStarter('What are Newton\\'s laws of motion?')">Newton's laws</button>
      </div>
    </div>`;
}

// ============================================
// DRAG & DROP for upload zones
// ============================================
function setupDrop(zoneId, inputId, handler) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag');
    const file = e.dataTransfer.files[0];
    if (file) {
      const input = document.getElementById(inputId);
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      handler();
    }
  });
}

setupDrop('fcUploadZone', 'fcFile', handleFcUpload);
setupDrop('notesUploadZone', 'notesFile', handleNotesUpload);
setupDrop('fcwUploadZone', 'fcwFile', handleFlowchartUpload);

// ============================================
// TOAST NOTIFICATION
// ============================================
function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed', bottom: '20px', right: '20px',
    background: '#1e293b', color: 'white',
    padding: '10px 18px', borderRadius: '10px',
    fontSize: '0.85rem', fontWeight: '500',
    zIndex: '9999', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    animation: 'fadeUp 0.2s ease'
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// Load initial data
loadSavedFlashcards();
loadSavedNotes();
