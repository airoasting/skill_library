// ========= State =========
const state = {
  data: { categories: [], skills: [] },
  activeCat: 'all',
  query: '',
  sort: 'stars',   // 'stars' | 'name' | 'new'
  catMap: {}
};

// ========= Category auto-rules (for adder) =========
const CAT_RULES = [
  { cat: 'korea',      kws: ['korea', 'korean', '한국', 'hangul', 'hwp', 'kakao', 'toss', 'srt', 'ktx', 'naver', 'kbo', 'kr-', 'k-skill', 'legalize'] },
  { cat: 'finance',    kws: ['finance', 'trading', 'quant', 'stock', 'invest', 'bank', 'equity', 'portfolio', 'crypto', 'forex'] },
  { cat: 'research',   kws: ['research', 'paper', 'academic', 'notebooklm', 'knowledge', 'graph', 'scientific', 'deep-research'] },
  { cat: 'design',     kws: ['design', ' ui', 'ux', 'slide', 'presentation', 'novel', 'writing', 'humaniz', 'creative'] },
  { cat: 'automation', kws: ['playwright', 'browser', 'automation', 'ccpm', 'spec', 'harness', 'jira', 'slack', 'lark'] },
  { cat: 'business',   kws: ['business', 'marketing', 'seo', 'geo', 'ceo', 'career', 'legal', 'sales', 'cro', 'exec', 'startup'] },
  { cat: 'workflow',   kws: ['workflow', 'superpower', 'planning', 'memory', 'mem', 'agent', 'skill', 'plugin', 'tdd'] }
];
function classify(meta) {
  const hay = [meta.name, meta.full_name, meta.description, (meta.topics || []).join(' ')]
    .filter(Boolean).join(' ').toLowerCase();
  for (const rule of CAT_RULES) {
    if (rule.kws.some(k => hay.includes(k))) return rule.cat;
  }
  return 'workflow';
}

// ========= Theme =========
const THEME_KEY = 'airoasting.theme';
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('iconSun').style.display  = theme === 'light' ? '' : 'none';
  document.getElementById('iconMoon').style.display = theme === 'dark'  ? '' : 'none';
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
}
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch(e) {}
  applyTheme(saved === 'dark' ? 'dark' : 'light');
  document.getElementById('themeBtn').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
  });
}

// ========= Load =========
async function load() {
  initTheme();
  let loaded = false;
  try {
    const res = await fetch('skills.json?v=' + Date.now(), { cache: 'no-store' });
    if (res.ok) { state.data = await res.json(); loaded = true; }
  } catch (e) { /* fall through to inline fallback */ }
  if (!loaded) {
    const inline = document.getElementById('skills-data');
    if (inline) {
      try { state.data = JSON.parse(inline.textContent); loaded = true; } catch (e) {}
    }
  }
  if (!loaded) {
    document.getElementById('feed').innerHTML =
      `<div class="empty">skills.json을 불러올 수 없습니다.<br/>로컬에서 열 때는 <code>python3 -m http.server</code>로 실행해 주세요.</div>`;
    return;
  }
  state.catMap = Object.fromEntries(state.data.categories.map(c => [c.id, c]));
  renderCats();
  renderAll();
  wireTabs();
}

// ========= Nav =========
function renderCats() {
  const host = document.getElementById('nav-cats');
  const counts = { all: state.data.skills.length, pick: 0 };
  for (const c of state.data.categories) counts[c.id] = 0;
  for (const s of state.data.skills) {
    counts[s.category] = (counts[s.category] || 0) + 1;
    if (s.editors_pick) counts.pick++;
  }
  host.innerHTML = state.data.categories.map(c =>
    `<a data-cat="${c.id}" tabindex="0" role="button">
       <span>${c.emoji} ${escapeHtml(c.name)}</span>
       <span class="count">${counts[c.id] || 0}</span>
     </a>`).join('');
  host.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setCat(a.dataset.cat)));

  document.querySelectorAll('.sidebar-left [data-cat="all"], .sidebar-left [data-cat="pick"]').forEach(a => {
    a.addEventListener('click', () => setCat(a.dataset.cat));
  });

  document.getElementById('count-all').textContent = counts.all;
  document.getElementById('count-pick').textContent = counts.pick;
  document.getElementById('totalNum').textContent = counts.all;
  renderMobileCats(counts);
  highlightActiveCat();
}

function renderMobileCats(counts) {
  const bar = document.getElementById('mobileCatsBar');
  if (!bar) return;
  const cats = [
    { id: 'all', label: '전체' },
    { id: 'pick', label: '✦ Pick' },
    ...state.data.categories.map(c => ({ id: c.id, label: `${c.emoji} ${c.name}` }))
  ];
  bar.innerHTML = cats.map(c =>
    `<button class="mobile-cat-btn${state.activeCat === c.id ? ' active' : ''}" data-cat="${c.id}">${escapeHtml(c.label)}</button>`
  ).join('');
  bar.querySelectorAll('.mobile-cat-btn').forEach(btn =>
    btn.addEventListener('click', () => setCat(btn.dataset.cat))
  );
}

function setCat(id) { state.activeCat = id; highlightActiveCat(); renderAll(); }
function highlightActiveCat() {
  document.querySelectorAll('.sidebar-left .nav a, .mobile-cat-btn').forEach(a => {
    a.classList.toggle('active', a.dataset.cat === state.activeCat);
  });
}

// ========= Tabs / Sort =========
function wireTabs() {
  document.querySelectorAll('.tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.sort = tab.dataset.sort;
      const hint = { stars: '★ 스타순', name: 'A-Z' };
      document.getElementById('sortHint').textContent = hint[state.sort] || '';
      renderAll();
    });
  });
}

// ========= Filter & Sort =========
function filtered() {
  const q = state.query.trim().toLowerCase();
  let items = state.data.skills.slice();
  if (state.activeCat === 'pick') {
    items = items.filter(s => s.editors_pick);
  } else if (state.activeCat !== 'all') {
    items = items.filter(s => s.category === state.activeCat);
  }
  if (q) items = items.filter(s =>
    (s.name + ' ' + (s.desc||'') + ' ' + (s.tags||[]).join(' ') + ' ' + (s.author||'') + ' ' + (s.repo||''))
      .toLowerCase().includes(q)
  );
  const sorter = {
    stars: (a,b) => (b.stars||0) - (a.stars||0),
    name:  (a,b) => a.name.localeCompare(b.name, 'ko')
  }[state.sort] || ((a,b) => (b.stars||0) - (a.stars||0));
  items.sort(sorter);
  return items;
}

// ========= Render =========
function renderAll() {
  const items = filtered();
  renderCatIntro();
  renderFeatured(items[0]);
  renderFeed(items.slice(1));
  renderRank();
  updateTotalNum();
}

function updateTotalNum() {
  const el = document.getElementById('totalNum');
  if (!el) return;
  const id = state.activeCat;
  const skills = state.data.skills;
  const n = id === 'all' ? skills.length
    : id === 'pick' ? skills.filter(s => s.editors_pick).length
    : skills.filter(s => s.category === id).length;
  el.textContent = n;
}

function renderCatIntro() {
  const host = document.getElementById('catIntro');
  if (!host) return;
  const id = state.activeCat;
  const introByBuiltin = {
    all:  { emoji: '✨', name: '전체 스킬', desc: '지금까지 등록된 모든 스킬을 한자리에서 둘러볼 수 있어요.' },
    pick: { emoji: '✦', name: "Editor's Pick", desc: '에디터가 직접 골라낸 특별 추천 스킬이에요.' }
  };
  const cat = introByBuiltin[id] || state.catMap[id];
  if (!cat || !cat.desc) { host.hidden = true; host.innerHTML = ''; return; }
  host.hidden = false;
  host.innerHTML = `<span class="emoji">${cat.emoji || ''}</span><span><strong>${escapeHtml(cat.name)}</strong>${escapeHtml(cat.desc)}</span>`;
}

function renderFeatured(s) {
  const host = document.getElementById('featured');
  if (!s) { host.innerHTML = ''; return; }
  const cat = state.catMap[s.category];
  host.innerHTML = `
    <a class="featured${s.editors_pick ? ' featured-pick' : ' featured-plain'}" href="https://github.com/${escapeHtml(s.repo || '')}" target="_blank" rel="noopener" aria-label="${escapeHtml(s.name)} GitHub">
      <div class="avatar">${avatarImg(s)}</div>
      <div>
        <h2>${escapeHtml(s.name)} ${s.editors_pick ? `<span class="badge-pick">✦ PICK</span>` : ''} <span class="author-pill"><span>${escapeHtml(s.author || '—')}</span>${fbBadge(s.facebook)}${liBadge(s.linkedin)}</span></h2>
        <div class="author">
          ${cat ? `<span class="cat-pill">${cat.emoji} ${escapeHtml(cat.name)}</span>` : ''}
        </div>
        <p>${escapeHtml(s.desc || '')}</p>
        <div class="tags" style="display:flex; flex-wrap:wrap; gap:6px;">${(s.tags||[]).slice(0,3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      </div>
      <div class="stars">
        <strong>${fmt(s.stars)}</strong><span>stars</span>
      </div>
    </a>`;
}

function renderFeed(items) {
  const host = document.getElementById('feed');
  if (!items.length) {
    host.innerHTML = `<div class="empty">조건에 맞는 스킬이 없습니다.</div>`;
    return;
  }
  host.innerHTML = items.map((s, i) => card(s, i + 2)).join('');
}

function card(s, rank) {
  const cat = state.catMap[s.category];
  const tags = (s.tags || []).slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const badge = s.editors_pick ? `<span class="badge-pick">✦ PICK</span>` : '';
  const repoUrl = s.repo ? `https://github.com/${s.repo}` : '#';
  return `
    <a class="card${s.editors_pick ? ' card-pick' : ''}" href="${repoUrl}" target="_blank" rel="noopener" aria-label="${escapeHtml(s.name)}">
      <div class="rank">${String(rank).padStart(2,'0')}</div>
      <div class="avatar">${avatarImg(s)}</div>
      <div class="body">
        <h3>${escapeHtml(s.name)} ${badge} <span class="author-pill"><span>${escapeHtml(s.author || '—')}</span>${fbBadge(s.facebook)}${liBadge(s.linkedin)}</span></h3>
        <div class="meta-row">
          ${cat ? `<span class="cat-pill">${cat.emoji} ${escapeHtml(cat.name)}</span>` : ''}
        </div>
        <p class="desc">${escapeHtml(s.desc || '')}</p>
        <div class="tags">${tags}</div>
      </div>
      <div class="stars"><strong>${fmt(s.stars)}</strong>stars</div>
    </a>`;
}

function renderRank() {
  const host = document.getElementById('topRank');
  const top = state.data.skills.slice().sort((a,b) => (b.stars||0) - (a.stars||0)).slice(0, 5);
  host.innerHTML = top.map((s, i) => `
    <a class="rank-row" href="https://github.com/${escapeHtml(s.repo || '')}" target="_blank" rel="noopener" aria-label="${escapeHtml(s.name)} GitHub">
      <div class="r-num">${String(i+1).padStart(2,'0')}</div>
      <div class="r-av">${avatarImg(s)}</div>
      <div class="r-info">
        <div class="name">${escapeHtml(s.name)}</div>
        <div class="author">${escapeHtml(s.author || '')}</div>
      </div>
      <div class="star">★${fmt(s.stars)}</div>
    </a>`).join('');
}


// ========= Helpers =========
function isNew(s) {
  if (!s.pushed_at) return false;
  const days = (Date.now() - new Date(s.pushed_at).getTime()) / 86400000;
  return days <= 14;
}
function fmt(n) {
  if (n == null) return '—';
  if (n >= 100000) return (n / 1000).toFixed(0) + 'k';
  if (n >= 1000)   return (n / 1000).toFixed(1) + 'k';
  return String(n);
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fbBadgeInline(url) {
  if (!url) return '';
  const safe = escapeHtml(url);
  return `<span class="fb-inline" role="link" tabindex="0" title="만든 사람 페이스북" onclick="event.preventDefault(); event.stopPropagation(); window.open('${safe}','_blank','noopener');"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12z"/></svg></span>`;
}
function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d)) return escapeHtml(s);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}
function fbBadge(url) {
  if (!url) return '';
  const safe = escapeHtml(url);
  return `<span class="fb-link" role="link" tabindex="0" title="만든 사람 페이스북" onclick="event.preventDefault(); event.stopPropagation(); window.open('${safe}','_blank','noopener');"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12z"/></svg></span>`;
}
function liBadge(url) {
  if (!url) return '';
  const safe = escapeHtml(url);
  return `<span class="li-link" role="link" tabindex="0" title="만든 사람 링크드인" onclick="event.preventDefault(); event.stopPropagation(); window.open('${safe}','_blank','noopener');"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.28 2.38 4.28 5.47v6.27zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .78 0 1.73v20.54C0 23.22.79 24 1.77 24h20.46c.98 0 1.77-.78 1.77-1.73V1.73C24 .78 23.21 0 22.23 0z"/></svg></span>`;
}
function avatarImg(s) {
  const owner = (s.repo || '').split('/')[0];
  if (!owner) return '';
  const url = `https://github.com/${owner}.png?size=88`;
  return `<img src="${url}" alt="" loading="lazy" onerror="this.style.display='none'" />`;
}
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ========= Search & keys =========
document.getElementById('q').addEventListener('input', e => {
  state.query = e.target.value; renderAll();
});
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault(); document.getElementById('q').focus();
  }
  if (e.key === 'Escape') {
    const q = document.getElementById('q');
    if (document.activeElement === q) { q.value = ''; state.query = ''; renderAll(); }
  }
});

load();
