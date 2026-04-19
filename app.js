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
  renderAdder();
  renderAll();
  wireTabs();
}

// ========= Nav =========
function renderCats() {
  const host = document.getElementById('nav-cats');
  const counts = { all: state.data.skills.length, new: 0 };
  for (const c of state.data.categories) counts[c.id] = 0;
  for (const s of state.data.skills) {
    counts[s.category] = (counts[s.category] || 0) + 1;
    if (isNew(s)) counts.new++;
  }
  host.innerHTML = state.data.categories.map(c =>
    `<a data-cat="${c.id}" tabindex="0" role="button">
       <span>${c.emoji} ${escapeHtml(c.name)}</span>
       <span class="count">${counts[c.id] || 0}</span>
     </a>`).join('');
  host.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setCat(a.dataset.cat)));

  document.querySelectorAll('.sidebar-left [data-cat="all"], .sidebar-left [data-cat="new"]').forEach(a => {
    a.addEventListener('click', () => setCat(a.dataset.cat));
  });

  document.getElementById('count-all').textContent = counts.all;
  document.getElementById('count-new').textContent = counts.new;
  document.getElementById('totalNum').textContent = counts.all;
  highlightActiveCat();
}
function setCat(id) { state.activeCat = id; highlightActiveCat(); renderAll(); }
function highlightActiveCat() {
  document.querySelectorAll('.sidebar-left .nav a').forEach(a => {
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
      const hint = { stars: '★ 스타순', new: '⏱ 최근 업데이트순', date: '📅 날짜순', name: 'A-Z' };
      document.getElementById('sortHint').textContent = hint[state.sort] || '';
      renderAll();
    });
  });
}

// ========= Filter & Sort =========
function filtered() {
  const q = state.query.trim().toLowerCase();
  let items = state.data.skills.slice();
  if (state.activeCat === 'new') {
    items = items.filter(isNew);
  } else if (state.activeCat !== 'all') {
    items = items.filter(s => s.category === state.activeCat);
  }
  if (q) items = items.filter(s =>
    (s.name + ' ' + (s.desc||'') + ' ' + (s.tags||[]).join(' ') + ' ' + (s.author||'') + ' ' + (s.repo||''))
      .toLowerCase().includes(q)
  );
  const sorter = {
    stars: (a,b) => (b.stars||0) - (a.stars||0),
    new:   (a,b) => new Date(b.added_at||0) - new Date(a.added_at||0),
    date:  (a,b) => new Date(b.added_at||0) - new Date(a.added_at||0),
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
}

function renderCatIntro() {
  const host = document.getElementById('catIntro');
  if (!host) return;
  const id = state.activeCat;
  const introByBuiltin = {
    all: { emoji: '✨', name: '전체 스킬', desc: '지금까지 등록된 모든 스킬을 한자리에서 둘러볼 수 있어요.' },
    new: { emoji: '🆕', name: '최근 업데이트', desc: '최근 2주 안에 새로 올라오거나 업데이트된 따끈따끈한 스킬만 모아뒀어요.' }
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
    <a class="featured" href="https://github.com/${escapeHtml(s.repo || '')}" target="_blank" rel="noopener" aria-label="${escapeHtml(s.name)} GitHub">
      <div class="avatar">${avatarImg(s)}</div>
      <div>
        <h2>${escapeHtml(s.name)}</h2>
        <div class="author">
          <span>${escapeHtml(s.author || '—')}</span>${fbBadge(s.facebook)}
          ${cat ? `<span class="sep">·</span><span class="cat-pill">${cat.emoji} ${escapeHtml(cat.name)}</span>` : ''}
          ${s.added_at ? `<span class="sep">·</span><span class="date">📅 ${fmtDate(s.added_at)}</span>` : ''}
        </div>
        <p>${escapeHtml(s.desc || '')}</p>
        <div class="tags" style="display:flex; flex-wrap:wrap; gap:6px;">${(s.tags||[]).slice(0,5).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      </div>
      <div class="stars"><strong>${fmt(s.stars)}</strong><span>stars</span></div>
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
  const tags = (s.tags || []).slice(0, 4).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const badge = isNew(s) ? `<span class="badge-new">NEW</span>` : '';
  const repoUrl = s.repo ? `https://github.com/${s.repo}` : '#';
  return `
    <a class="card" href="${repoUrl}" target="_blank" rel="noopener" aria-label="${escapeHtml(s.name)}">
      <div class="rank">${String(rank).padStart(2,'0')}</div>
      <div class="avatar">${avatarImg(s)}</div>
      <div class="body">
        <h3>${escapeHtml(s.name)} ${badge}</h3>
        <div class="meta-row">
          <span>${escapeHtml(s.author || '—')}</span>${fbBadge(s.facebook)}
          ${cat ? `<span class="sep">·</span><span class="cat-pill">${cat.emoji} ${escapeHtml(cat.name)}</span>` : ''}
          ${s.added_at ? `<span class="sep">·</span><span class="date">📅 ${fmtDate(s.added_at)}</span>` : ''}
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
    <div class="rank-row">
      <div class="r-num">${String(i+1).padStart(2,'0')}</div>
      <div class="r-av">${avatarImg(s)}</div>
      <div class="r-info">
        <div class="name">${escapeHtml(s.name)}</div>
        <div class="author">${escapeHtml(s.author || '')}</div>
      </div>
      <div class="star">★${fmt(s.stars)}</div>
    </div>`).join('');
}

// ========= Adder =========
function renderAdder() {
  const sel = document.getElementById('ghCat');
  sel.innerHTML = `<option value="auto">자동 분류</option>` +
    state.data.categories.map(c => `<option value="${c.id}">${c.emoji} ${escapeHtml(c.name)}</option>`).join('');

  document.getElementById('toggleAdder').onclick = () =>
    document.getElementById('adder').classList.toggle('hidden');
  document.getElementById('fetchBtn').onclick = addFromGithub;
  document.getElementById('downloadBtn').onclick = downloadJson;
}

function parseRepo(url) {
  const m = String(url).match(/github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i);
  if (!m) return null;
  return `${m[1]}/${m[2].replace(/\.git$/, '')}`;
}

async function addFromGithub() {
  const url = document.getElementById('ghUrl').value.trim();
  const chosenCat = document.getElementById('ghCat').value;
  const log = document.getElementById('log');
  log.textContent = '';

  const full = parseRepo(url);
  if (!full) { log.textContent = '❌ 올바른 GitHub URL이 아닙니다.'; return; }
  if (state.data.skills.some(s => s.repo === full)) {
    log.textContent = `⚠️ 이미 등록된 저장소: ${full}`; return;
  }

  log.textContent = `→ ${full} 메타데이터를 가져오는 중…`;
  try {
    const [repoRes, topicRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${full}`),
      fetch(`https://api.github.com/repos/${full}/topics`, {
        headers: { 'Accept': 'application/vnd.github.mercy-preview+json' }
      })
    ]);
    if (!repoRes.ok) throw new Error(`GitHub API ${repoRes.status}`);
    const repo = await repoRes.json();
    const topics = topicRes.ok ? ((await topicRes.json()).names || []) : [];

    const meta = { name: repo.name, full_name: repo.full_name, description: repo.description || '', topics };
    const cat = chosenCat === 'auto' ? classify(meta) : chosenCat;
    const skill = {
      category: cat,
      name: repo.name,
      repo: repo.full_name,
      author: (repo.owner && repo.owner.login) || '—',
      stars: repo.stargazers_count || 0,
      desc: repo.description || '(설명이 등록되어 있지 않습니다)',
      tags: topics.slice(0, 4).map(t => '#' + t),
      lang: repo.language || undefined,
      pushed_at: repo.pushed_at
    };
    state.data.skills.push(skill);
    renderCats(); renderAll();
    toast(`추가됨: ${skill.name} (★${fmt(skill.stars)}) → ${state.catMap[cat]?.name || cat}`);
    log.textContent = `✅ 추가됨 → [${cat}] ${skill.name}\n수정 데이터를 저장하려면 "skills.json 내보내기"를 눌러 파일을 교체하세요.`;
    document.getElementById('ghUrl').value = '';
  } catch (e) {
    log.textContent = `❌ 실패: ${e.message}`;
  }
}

function downloadJson() {
  const clean = {
    categories: state.data.categories,
    skills: state.data.skills.map(s => ({ ...s }))
  };
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'skills.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('skills.json 내보내기 완료');
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
