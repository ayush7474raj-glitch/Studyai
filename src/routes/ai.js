const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const auth = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.pdf', '.txt', '.png', '.jpg', '.jpeg', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    ok.includes(ext) ? cb(null, true) : cb(new Error('Unsupported file type. Use PDF, TXT, DOCX, JPG, or PNG'));
  }
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

async function extractText(filePath, origName) {
  const ext = path.extname(origName).toLowerCase();
  if (ext === '.txt') return fs.readFileSync(filePath, 'utf-8');
  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    return (await pdfParse(fs.readFileSync(filePath))).text;
  }
  if (['.docx', '.doc'].includes(ext)) {
    const mammoth = require('mammoth');
    return (await mammoth.extractRawText({ path: filePath })).value;
  }
  return null; // image — handled separately
}

async function askClaude(filePath, origName, userPrompt) {
  const ext = path.extname(origName).toLowerCase();
  const isImage = ['.png', '.jpg', '.jpeg'].includes(ext);

  if (isImage) {
    const b64 = fs.readFileSync(filePath).toString('base64');
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    return await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
        { type: 'text', text: userPrompt }
      ]}]
    });
  }

  const text = await extractText(filePath, origName);
  if (!text || !text.trim()) throw new Error('Could not extract text from file. Please check the file is not empty or password-protected.');

  return await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: `${userPrompt}\n\n---CONTENT START---\n${text.slice(0, 15000)}\n---CONTENT END---` }]
  });
}

// ---------- FLASHCARDS ----------
router.post('/flashcards', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const prompt = `You are an expert study assistant. Generate 12 high-quality study flashcards from the content below.
Return ONLY a valid JSON array, nothing else:
[{"question":"...","answer":"..."},...]
Rules:
- Test key concepts, definitions, formulas, important facts
- Answers must be concise but complete (2-4 sentences max)
- Cover the most important topics proportionally`;

    const resp = await askClaude(req.file.path, req.file.originalname, prompt);
    const raw = resp.content[0].text.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    const cards = match ? JSON.parse(match[0]) : [];

    const title = `Flashcards — ${req.file.originalname} (${new Date().toLocaleDateString()})`;
    db.prepare('INSERT INTO flashcard_sets (user_id, title, cards) VALUES (?, ?, ?)').run(req.user.id, title, JSON.stringify(cards));
    res.json({ cards, title });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate flashcards' });
  }
});

// ---------- NOTES ----------
router.post('/notes', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const prompt = `You are an expert tutor. Create clear, well-structured handwritten-style study notes from the content below.

Format:
# [Topic Title]

## [Main Topic]
### [Sub-topic]
- Key point in **bold** for emphasis
- Explanation in plain language
- Examples where needed

## Summary
Brief 3-sentence summary

Make notes educational, student-friendly, and well-organized with proper markdown.`;

    const resp = await askClaude(req.file.path, req.file.originalname, prompt);
    const content = resp.content[0].text;
    const title = `Notes — ${req.file.originalname} (${new Date().toLocaleDateString()})`;
    const id = db.prepare('INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)').run(req.user.id, title, content).lastInsertRowid;
    res.json({ content, title, id });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate notes' });
  }
});

// ---------- FLOWCHART ----------
router.post('/flowchart', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const prompt = `You are an expert at creating educational diagrams. Create a Mermaid.js flowchart showing the key concepts and relationships from the content below.

Return ONLY valid JSON (no markdown, no code blocks):
{"mermaid":"flowchart TD\\n    A[Concept] --> B[Sub-concept]\\n    ...","summary":"2-3 sentence summary of the content."}

Mermaid rules:
- Start with: flowchart TD
- Keep node labels under 25 characters, escape quotes
- 10-15 nodes showing logical flow
- Use subgraph for major topic groups
- Every node ID must be unique alphanumeric`;

    const resp = await askClaude(req.file.path, req.file.originalname, prompt);
    const raw = resp.content[0].text.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    const result = match ? JSON.parse(match[0]) : { mermaid: 'flowchart TD\n    A[Could not generate chart]', summary: '' };
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate flowchart' });
  }
});

// ---------- CHAT ----------
router.post('/chat', auth, upload.single('file'), async (req, res) => {
  const { message, history = '[]', fileContext = '' } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    let system = `You are StudyNova AI — a friendly, expert academic tutor. You help students understand complex topics, solve problems step-by-step, and prepare for exams.

You excel at: Mathematics, Physics, Chemistry, Biology, History, Literature, Computer Science, Economics, all A-Level subjects.

Guidelines:
- Break complex ideas into simple steps
- Use examples and analogies
- Be encouraging but academically rigorous
- Format responses clearly with bullet points or numbered steps when helpful`;

    if (fileContext) system += `\n\nStudent's uploaded document context:\n${fileContext.slice(0, 8000)}`;

    if (req.file) {
      try {
        const text = await extractText(req.file.path, req.file.originalname);
        if (text) system += `\n\nStudent just uploaded this file:\n${text.slice(0, 8000)}`;
      } catch {}
    }

    const history = JSON.parse(req.body.history || '[]');
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system,
      messages: [...history, { role: 'user', content: message }]
    });

    res.json({ reply: resp.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to get response' });
  }
});

// ---------- GET SAVED DATA ----------
router.get('/flashcards', auth, (req, res) => {
  const sets = db.prepare('SELECT * FROM flashcard_sets WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(sets.map(s => ({ ...s, cards: JSON.parse(s.cards) })));
});

router.get('/notes', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id));
});

router.put('/notes/:id', auth, (req, res) => {
  const { content, title } = req.body;
  db.prepare('UPDATE notes SET content=?, title=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run(content, title, req.params.id, req.user.id);
  res.json({ success: true });
});

router.delete('/notes/:id', auth, (req, res) => {
  db.prepare('DELETE FROM notes WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

router.post('/notes/:id/to-flashcards', auth, async (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  try {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: `Convert these notes into 10-12 flashcards. Return ONLY a JSON array:\n[{"question":"...","answer":"..."}]\n\nNotes:\n${note.content.slice(0, 10000)}` }]
    });
    const raw = resp.content[0].text.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    const cards = match ? JSON.parse(match[0]) : [];
    const title = `${note.title} — Flashcards`;
    db.prepare('INSERT INTO flashcard_sets (user_id, title, cards) VALUES (?, ?, ?)').run(req.user.id, title, JSON.stringify(cards));
    res.json({ cards, title });
  } catch (err) {
    res.status(500).json({ error: 'Conversion failed' });
  }
});

router.delete('/flashcards/:id', auth, (req, res) => {
  db.prepare('DELETE FROM flashcard_sets WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

module.exports = router;
