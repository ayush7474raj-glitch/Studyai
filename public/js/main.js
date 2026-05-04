// Landing Page JS

// Redirect if already logged in
if (localStorage.getItem('sn_token')) {
  window.location.href = '/app';
}

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  nav.classList.toggle('scrolled', window.scrollY > 40);
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth' }); }
  });
});

// ===== MODALS =====
function openModal(type) {
  document.getElementById(`${type}Modal`).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(type) {
  document.getElementById(`${type}Modal`).classList.remove('open');
  document.body.style.overflow = '';
  clearError(type);
}
function switchModal(from, to) {
  closeModal(from);
  setTimeout(() => openModal(to), 50);
}

function clearError(type) {
  const el = document.getElementById(`${type}Error`);
  if (el) { el.textContent = ''; el.classList.remove('visible'); }
}
function showError(type, msg) {
  const el = document.getElementById(`${type}Error`);
  if (el) { el.textContent = msg; el.classList.add('visible'); }
}
function setLoading(btnId, loading, text) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait...' : text;
}

// ===== AUTH =====
async function handleSignup(e) {
  e.preventDefault();
  clearError('signup');
  const username = document.getElementById('signupUsername').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;

  if (!username || !email || !password) return showError('signup', 'All fields are required');

  setLoading('signupBtn', true, 'Create Account');
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (!res.ok) return showError('signup', data.error || 'Signup failed');
    localStorage.setItem('sn_token', data.token);
    localStorage.setItem('sn_user', JSON.stringify(data.user));
    window.location.href = '/app';
  } catch {
    showError('signup', 'Network error. Please try again.');
  } finally {
    setLoading('signupBtn', false, 'Create Account');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  clearError('login');
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) return showError('login', 'All fields are required');

  setLoading('loginBtn', true, 'Sign In');
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) return showError('login', data.error || 'Login failed');
    localStorage.setItem('sn_token', data.token);
    localStorage.setItem('sn_user', JSON.stringify(data.user));
    window.location.href = '/app';
  } catch {
    showError('login', 'Network error. Please try again.');
  } finally {
    setLoading('loginBtn', false, 'Sign In');
  }
}

function toggleMenu() {
  document.getElementById('mobileNav').classList.toggle('open');
}

// Escape key closes modals
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['login', 'signup'].forEach(m => {
      if (document.getElementById(`${m}Modal`).classList.contains('open')) closeModal(m);
    });
  }
});

// Animate elements on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.style.opacity = 1; e.target.style.transform = 'translateY(0)'; }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.step, .feature-card, .dash-card').forEach(el => {
  el.style.opacity = 0;
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});
