// Puanlar, konu seviyeleri (1–10), rozetler, süre sayacı ve ödül bildirimleri.
const Game = (() => {
  const KEY = 'ap_game';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const st = Object.assign({ xp: 0, pts: {}, levels: {}, badges: [], days: {}, total: 0, sessions: 0, courses: [] }, load());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
  const today = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD
  let sizes = {};   // { alanId: cümle sayısı }
  let names = {};   // { alanId: { title, emoji } }

  // Bir alanın 10. seviyeye ulaşması için her cümleyi yaklaşık 3 kez çalışmak gerekir.
  const PER_ITEM = 3;
  const levelFrom = (id, p) => Math.min(10, Math.floor((p / Math.max(1, (sizes[id] || 10) * PER_ITEM)) * 10));
  const level = id => levelFrom(id, st.pts[id] || 0);
  const fill = id => Math.min(1, (st.pts[id] || 0) / Math.max(1, (sizes[id] || 10) * PER_ITEM));

  // ---------- Bildirimler ----------
  let box;
  function toast(icon, title, text = '', { confetti = true } = {}) {
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="t-icon">${icon}</span><span><b></b><small></small></span>`;
    el.querySelector('b').textContent = title;
    el.querySelector('small').textContent = text;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, 3200);
    if (confetti) burst();
    chime();
  }

  function burst() {
    const colors = ['#ff6b35', '#ffc93c', '#2ec4b6', '#7b61ff', '#ff4f8b', '#4cc9f0'];
    const layer = document.createElement('div');
    layer.className = 'confetti';
    for (let i = 0; i < 28; i++) {
      const p = document.createElement('i');
      p.style.left = `${50 + (Math.random() - 0.5) * 60}%`;
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', `${(Math.random() - 0.5) * 260}px`);
      p.style.setProperty('--dy', `${200 + Math.random() * 260}px`);
      p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
      p.style.animationDelay = `${Math.random() * 0.15}s`;
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 1800);
  }

  let actx;
  function chime() {
    if (localStorage.getItem('ap_chime') === 'false') return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime;
      [[880, 0], [1320, 0.09]].forEach(([f, d]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.exponentialRampToValueAtTime(0.12, t + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35);
        o.connect(g).connect(actx.destination);
        o.start(t + d); o.stop(t + d + 0.4);
      });
    } catch {}
  }

  // ---------- Rozetler ----------
  const streak = () => {
    let n = 0;
    const d = new Date();
    if ((st.days[today()] || 0) < 60) d.setDate(d.getDate() - 1); // bugün henüz çalışılmadıysa dünden say
    while ((st.days[d.toLocaleDateString('sv')] || 0) >= 60) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };
  const BADGES = [
    { id: 'first', icon: '🌱', title: 'İlk adım', desc: 'İlk cümleni tekrar ettin', test: () => st.xp >= 1 },
    { id: 'xp100', icon: '⭐', title: '100 puan', desc: '100 puan topla', test: () => st.xp >= 100 },
    { id: 'xp500', icon: '🌟', title: '500 puan', desc: '500 puan topla', test: () => st.xp >= 500 },
    { id: 'xp1000', icon: '💫', title: '1000 puan', desc: '1000 puan topla', test: () => st.xp >= 1000 },
    { id: 'lvl5', icon: '📈', title: 'Yarı yol', desc: 'Bir konuda 5. seviyeye ulaş', test: () => Object.keys(sizes).some(id => level(id) >= 5) },
    { id: 'lvl10', icon: '🏆', title: 'Usta', desc: 'Bir konuyu 10. seviyeye çıkar', test: () => Object.keys(sizes).some(id => level(id) >= 10) },
    { id: 'session', icon: '✅', title: 'Bitirdim!', desc: 'Bir tekrar listesini sonuna kadar bitir', test: () => st.sessions >= 1 },
    { id: 'course', icon: '📘', title: 'Cümle ustası', desc: 'Bir cümle kurma ünitesini bitir', test: () => st.courses.length >= 1 },
    { id: 'time30', icon: '⏱️', title: 'Yarım saat', desc: 'Toplam 30 dakika çalış', test: () => st.total >= 1800 },
    { id: 'time120', icon: '⌛', title: 'İki saat', desc: 'Toplam 2 saat çalış', test: () => st.total >= 7200 },
    { id: 'streak3', icon: '🔥', title: '3 gün seri', desc: '3 gün üst üste çalış', test: () => streak() >= 3 },
    { id: 'streak7', icon: '🚀', title: '7 gün seri', desc: '7 gün üst üste çalış', test: () => streak() >= 7 },
  ];
  function checkBadges() {
    for (const b of BADGES) {
      if (!st.badges.includes(b.id) && b.test()) {
        st.badges.push(b.id);
        setTimeout(() => toast(b.icon, `Yeni rozet: ${b.title}`, b.desc), 600);
      }
    }
  }

  // ---------- Puan ekleme ----------
  function add(id, n = 1) {
    if (!id) return;
    const before = level(id);
    st.pts[id] = (st.pts[id] || 0) + n;
    st.xp += n;
    const after = level(id);
    if (after > before) {
      const nm = names[id] || {};
      toast(nm.emoji || '🎉', `${nm.title || 'Konu'} · Seviye ${after}/10`, after === 10 ? 'Bu konuyu tamamen öğrendin!' : 'Harika gidiyorsun, devam!');
    }
    checkBadges();
    save();
    updateHud();
  }

  function finished(kind, title, courseId) {
    st.sessions++;
    if (courseId && !st.courses.includes(courseId)) st.courses.push(courseId);
    toast('🎉', 'Tebrikler, bitirdin!', title ? `${title} tamamlandı` : '');
    checkBadges();
    save();
  }

  // ---------- Süre sayacı ----------
  let showTotal = false;
  const fmt = s => {
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
    return h ? `${h}sa ${String(m).padStart(2, '0')}dk` : `${m}:${String(sec).padStart(2, '0')}`;
  };
  function updateHud() {
    const td = document.getElementById('todayStat');
    if (td) td.textContent = `⏱️ ${fmt(st.days[today()] || 0)}`;
    const xp = document.getElementById('xpStat');
    if (xp) xp.textContent = `⭐ ${st.xp}`;
    const t = document.getElementById('timer');
    if (t) {
      t.querySelector('span').textContent = showTotal ? fmt(st.total) : fmt(st.days[today()] || 0);
      t.title = showTotal ? 'Toplam süre (bugün için dokun)' : 'Bugün geçirdiğin süre (toplam için dokun)';
      t.classList.toggle('total', showTotal);
    }
  }
  function startTimer() {
    const t = document.getElementById('timer');
    if (t) t.onclick = () => { showTotal = !showTotal; updateHud(); };
    let tick = 0;
    setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const d = today();
      st.days[d] = (st.days[d] || 0) + 1;
      st.total++;
      if (st.days[d] % 600 === 0) toast('⏱️', `Bugün ${st.days[d] / 60} dakika çalıştın!`, 'Mola vermeyi unutma 🙂');
      if (++tick % 10 === 0) { checkBadges(); save(); }
      updateHud();
    }, 1000);
    window.addEventListener('pagehide', save);
    updateHud();
  }

  return {
    setAreas(map) { sizes = {}; names = {}; for (const [id, a] of Object.entries(map)) { sizes[id] = a.size; names[id] = a; } },
    add, finished, level, fill, toast, startTimer,
    get xp() { return st.xp; },
    get streak() { return streak(); },
    get today() { return st.days[today()] || 0; },
    badges: () => BADGES.map(b => ({ ...b, got: st.badges.includes(b.id) })),
    fmt,
  };
})();
