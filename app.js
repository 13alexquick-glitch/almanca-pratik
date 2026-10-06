(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  const MODES = {
    repeat: { title: 'Tekrar', icon: '🔁', desc: 'Dinle, Türkçesini duy, sesli tekrar et. Kendiliğinden ilerler.' },
    shadow: { title: 'Dinle & Söyle (mikrofon)', icon: '🎙️', desc: 'Dinle, tekrar et; telaffuzun kontrol edilsin.' },
    speak: { title: 'Konuşma pratiği', icon: '🗣️', desc: 'Türkçesini gör, Almancasını söyle.' },
    listen: { title: 'Mini test', icon: '🎧', desc: 'Dinle, anlamını seç.' },
  };
  const GAP = { kisa: 0.7, normal: 1, uzun: 1.6 };
  const settings = () => ({
    repeats: store.get('ap_repeats', 2),
    readTr: store.get('ap_readTr', true),
    gap: GAP[store.get('ap_gap', 'normal')] || 1,
  });
  const PASS = 0.8;

  const view = $('#view');
  const titleEl = $('#title');
  const backBtn = $('#back');

  let topics = [];
  let lastTap = 0;
  document.addEventListener('pointerdown', () => { lastTap = Date.now(); }, true);
  document.addEventListener('keydown', () => { lastTap = Date.now(); }, true);
  let course = [];
  let progress = store.get('ap_progress', {}); // { konuId: [doğru yapılan index'ler] }
  let hard = store.get('ap_hard', []);         // ["konuId:index"]
  const session = { key: null, items: [], i: 0 };

  function itemsOf(topicId) {
    if (topicId === 'hard') {
      return hard.map(key => {
        const [tid, idx] = key.split(':');
        const it = topics.find(t => t.id === tid)?.items[+idx];
        return it && { ...it, key };
      }).filter(Boolean);
    }
    const t = topics.find(t => t.id === topicId);
    return t ? t.items.map((it, idx) => ({ ...it, key: `${t.id}:${idx}` })) : [];
  }
  const topicTitle = id => id === 'hard' ? 'Zor olanlar' : (topics.find(t => t.id === id)?.title ?? '');

  function mark(item, ok) {
    const [tid, idx] = item.key.split(':');
    if (ok) {
      Game.add(tid, 2);
      progress[tid] = [...new Set([...(progress[tid] || []), +idx])];
      hard = hard.filter(k => k !== item.key);
    } else if (!hard.includes(item.key)) {
      hard.push(item.key);
    }
    store.set('ap_progress', progress);
    store.set('ap_hard', hard);
  }

  function setHeader(title, backHash) {
    titleEl.textContent = title;
    backBtn.hidden = !backHash;
    backBtn.onclick = () => { location.hash = backHash; };
  }

  function route() {
    pausePlayer();
    Speech.stop();
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'voices') return renderVoices();
    if (parts[0] === 'about') return renderAbout();
    if (parts[0] === 'play') {
      const units = selectedUnits();
      return renderPlayer({ key: `all:${units.join(',')}`, title: `Ünite ${units.join(', ')}`, back: '#/', steps: unitSteps(units) });
    }
    if (parts[0] === 'course' && parts[1]) {
      const u = course.find(u => u.id === parts[1]);
      return renderPlayer({ key: `course:${parts[1]}`, title: u ? u.title : 'Cümle kurma (Ünite 1–4)', back: '#/', steps: courseSteps(parts[1]) });
    }
    if (parts[0] === 'topic' && parts[2]) return renderPractice(parts[1], parts[2]);
    if (parts[0] === 'topic') return renderTopic(parts[1]);
    renderHome();
  }

  // ---------- Ana ekran ----------
  function renderHome() {
    setHeader('Almanca Pratik', null);
    const banner = Speech.hasChosenVoice() ? ''
      : `<a class="banner" href="#/voices">🔊 Önce sesini seç: Almanca sesleri dinle, beğendiğini seç →</a>`;
    const hardCard = hard.length ? `
      <a class="topic hard" href="#/topic/hard">
        <span class="emoji">⚠️</span><span class="name">Zor olanlar</span>
        <span class="meta">${hard.length} cümle</span>
      </a>` : '';
    const card = t => `
        <a class="topic" href="#/topic/${t.id}" style="--h:${hueOf(t.id)}">
          <span class="emoji">${t.emoji || '📘'}</span>
          <span class="name">${esc(t.title)}</span>
          <span class="meta">${t.unit ? `Ünite ${t.unit} · ` : ''}${t.items.length} cümle</span>
          ${meter(t.id)}
        </a>`;
    const groups = [...new Set(topics.map(t => t.group || 'Konular'))];
    const sections = groups.map(g => `
      <h2 class="sub">${esc(g)}</h2>
      <section class="grid">${topics.filter(t => (t.group || 'Konular') === g).map(card).join('')}</section>`).join('');

    const courseCards = course.map(u => `
      <a class="topic" href="#/course/${u.id}" style="--h:${hueOf(u.id)}">
        <span class="emoji">${u.emoji || '📘'}</span>
        <span class="name">${esc(u.title)}</span>
        <span class="meta">${u.steps.filter(s => s.de).length} cümle · anlatımlı</span>
        ${meter(u.id)}
      </a>`).join('');
    const badges = Game.badges();
    const got = badges.filter(b => b.got).length;

    view.innerHTML = `
      ${banner}
      <section class="stats">
        <div><b id="xpStat">⭐ ${Game.xp}</b><small>puan</small></div>
        <div><b>🔥 ${Game.streak}</b><small>gün seri</small></div>
        <div><b>🏅 ${got}/${badges.length}</b><small>rozet</small></div>
        <div><b id="todayStat">⏱️ ${Game.fmt(Game.today)}</b><small>bugün</small></div>
      </section>
      <section class="hero">
        <h2>🔁 Dinle ve tekrar et</h2>
        <p>Seçtiğin ünitelerin tüm cümleleri sırayla çalar: dinle, sen söyle, bir kez daha dinle, sonraki cümle.</p>
        <div class="chips" id="units">
          ${unitList().map(u => `<button data-u="${u}" class="${selectedUnits().includes(u) ? 'on' : ''}">Ünite ${u}</button>`).join('')}
        </div>
        <a class="start" id="start" href="#/play"></a>
      </section>
      ${course.length ? `
        <h2 class="sub">📘 Cümle kurma <small>Türkçe anlatım + tekrar</small></h2>
        <a class="start alt" href="#/course/all">▶ Ünite 1–4 hepsini başlat</a>
        <section class="grid">${courseCards}</section>` : ''}
      ${hardCard ? `<h2 class="sub">Zorlandıkların</h2><section class="grid">${hardCard}</section>` : ''}
      ${sections}
      <h2 class="sub">🏅 Ödüllerim <small>${got} / ${badges.length}</small></h2>
      <section class="badges">
        ${badges.map(b => `<div class="badge ${b.got ? 'got' : ''}" title="${esc(b.desc)}"><span>${b.got ? b.icon : '🔒'}</span><b>${esc(b.title)}</b><small>${esc(b.desc)}</small></div>`).join('')}
      </section>`;

    const updateStart = () => {
      const units = selectedUnits();
      const steps = unitSteps(units).filter(s => s.de).length;
      const pos = posOf(`all:${units.join(',')}`);
      const start = $('#start');
      start.classList.toggle('disabled', !units.length);
      start.innerHTML = !units.length ? 'Önce ünite seç'
        : pos > 0 ? `▶ Devam et <small>${units.length > 1 ? 'Ünite ' + units.join(', ') : 'Ünite ' + units[0]} · ${steps} cümle</small>`
        : `▶ Başlat <small>${steps} cümle</small>`;
    };
    $$('#units button').forEach(b => {
      b.onclick = () => {
        const u = +b.dataset.u;
        const cur = selectedUnits();
        const next = cur.includes(u) ? cur.filter(x => x !== u) : [...cur, u].sort((a, b) => a - b);
        store.set('ap_units', next);
        b.classList.toggle('on', next.includes(u));
        updateStart();
      };
    });
    $('#start').onclick = e => { if (!selectedUnits().length) e.preventDefault(); };
    updateStart();
  }

  // Her alana sabit, canlı bir renk tonu.
  const hueOf = id => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  function meter(id) {
    const lv = Game.level(id), part = Math.round((Game.fill(id) * 10 - lv) * 100);
    return `<span class="meter" aria-label="Seviye ${lv}/10">${Array.from({ length: 10 }, (_, i) =>
      `<i class="${i < lv ? 'on' : ''}"${i === lv && lv < 10 ? ` style="--p:${part}%"` : ''}></i>`).join('')}</span>
      <span class="lv">Seviye ${lv}/10</span>`;
  }

  const selectedUnits = () => store.get('ap_units', [1, 2, 3]).filter(u => unitList().includes(u));

  // ---------- Konu ekranı ----------
  function renderTopic(id) {
    const items = itemsOf(id);
    if (!items.length) { location.hash = '#/'; return; }
    setHeader(topicTitle(id), '#/');
    view.innerHTML = `
      ${id === 'hard' ? '' : `<section class="topic-level" style="--h:${hueOf(id)}">${meter(id)}<small>Kullandıkça dolar: dinlediğin her cümle +1, doğru söylediğin her cümle +2 puan.</small></section>`}
      <section class="modes">
        ${Object.entries(MODES).map(([k, m]) => `
          <a class="mode ${k === 'repeat' ? 'main' : ''}" href="#/topic/${id}/${k}">
            <span class="emoji">${m.icon}</span>
            <span><b>${m.title}</b><small>${m.desc}</small></span>
          </a>`).join('')}
      </section>
      <h2 class="sub">Cümleler <small>(dinlemek için dokun)</small></h2>
      <ul class="items">
        ${items.map((it, i) => `
          <li><button data-i="${i}"><span class="de">${esc(it.de)}</span><span class="tr">${esc(it.tr)}</span></button></li>`).join('')}
      </ul>`;
    $$('.items button', view).forEach(b => { b.onclick = () => Speech.speak(items[b.dataset.i].de); });
  }

  // ---------- Pratik ekranı ----------
  function renderPractice(id, mode) {
    const m = MODES[mode];
    if (!m) return renderTopic(id);
    if (mode === 'repeat') return renderPlayer({ key: `topic:${id}`, title: topicTitle(id), back: `#/topic/${id}`, steps: itemsOf(id) });
    const key = `${id}/${mode}`;
    if (session.key !== key) {
      session.key = key;
      session.items = mode === 'listen' ? shuffle(itemsOf(id)) : itemsOf(id);
      session.i = 0;
    }
    const n = session.items.length;
    if (!n) { location.hash = '#/'; return; }
    setHeader(m.title, `#/topic/${id}`);

    const it = session.items[session.i];
    view.innerHTML = `
      <div class="counter">${session.i + 1} / ${n}<span class="bar"><i style="width:${(session.i + 1) / n * 100}%"></i></span></div>
      <div class="card" id="card"></div>
      <nav class="pager">
        <button id="prev" ${session.i === 0 ? 'disabled' : ''}>← Önceki</button>
        <button id="next" class="primary">${session.i === n - 1 ? 'Bitir ✓' : 'Sonraki →'}</button>
      </nav>`;
    $('#prev').onclick = () => { Speech.stop(); session.i--; renderPractice(id, mode); };
    $('#next').onclick = () => {
      Speech.stop();
      if (session.i < n - 1) { session.i++; renderPractice(id, mode); }
      else { session.key = null; location.hash = id === 'hard' && !hard.length ? '#/' : `#/topic/${id}`; }
    };
    ({ listen: cardListen, shadow: cardShadow, speak: cardSpeak })[mode]($('#card'), it, session.items);
  }

  function cardListen(card, it, all) {
    const others = shuffle(all.filter(x => x.tr !== it.tr)).slice(0, 2);
    const choices = shuffle([it, ...others]);
    card.innerHTML = `
      <button class="play" id="play" aria-label="Dinle">🔊</button>
      <div class="row">
        <button id="slow">🐢 Yavaş</button>
        <button id="show">👁 Göster</button>
      </div>
      <div id="reveal" hidden><p class="de big">${esc(it.de)}</p><p class="tr">${esc(it.tr)}</p></div>
      <p class="q">Ne duydun?</p>
      <div class="choices">${choices.map((c, i) => `<button data-i="${i}">${esc(c.tr)}</button>`).join('')}</div>`;
    const play = slow => Speech.speak(it.de, { slow });
    $('#play', card).onclick = () => play(false);
    $('#slow', card).onclick = () => play(true);
    $('#show', card).onclick = () => { $('#reveal', card).hidden = false; };
    let answered = false;
    const btns = $$('.choices button', card);
    btns.forEach(b => {
      b.onclick = () => {
        if (answered) return;
        answered = true;
        const ok = choices[b.dataset.i] === it;
        b.classList.add(ok ? 'ok' : 'bad');
        if (!ok) btns[choices.indexOf(it)].classList.add('ok');
        $('#reveal', card).hidden = false;
        mark(it, ok);
      };
    });
    play(false);
  }

  function cardShadow(card, it) {
    const hidden = store.get('ap_hideText', false);
    card.innerHTML = `
      <p class="de big ${hidden ? 'blur' : ''}" id="de">${esc(it.de)}</p>
      <p class="tr">${esc(it.tr)}</p>
      <label class="toggle"><input type="checkbox" id="hide" ${hidden ? 'checked' : ''}> Metni gizle</label>
      <button class="primary wide" id="go">🔊 Dinle → 🎤 Tekrar et</button>
      <div class="row">
        <button id="slow">🐢 Yavaş dinle</button>
        <button id="mic">🎤 Sadece konuş</button>
      </div>
      <div class="result" id="result"></div>`;
    const out = $('#result', card);
    const buttons = $$('button', card);
    $('#hide', card).onchange = e => {
      store.set('ap_hideText', e.target.checked);
      $('#de', card).classList.toggle('blur', e.target.checked);
    };
    $('#de', card).onclick = e => e.currentTarget.classList.remove('blur');
    $('#go', card).onclick = async () => {
      out.innerHTML = '';
      if (await Speech.speak(it.de)) check(it, out, buttons);
    };
    $('#slow', card).onclick = () => Speech.speak(it.de, { slow: true });
    $('#mic', card).onclick = () => check(it, out, buttons);
  }

  function cardSpeak(card, it) {
    const first = it.de.split(/\s+/)[0];
    card.innerHTML = `
      <p class="tr big">${esc(it.tr)}</p>
      <p class="q">Almancasını söyle</p>
      <button class="primary wide" id="mic">🎤 Söyle</button>
      <div class="result" id="result"></div>
      <div id="reveal" hidden><p class="de big">${esc(it.de)}</p></div>
      <div class="row">
        <button id="hint">💡 İpucu</button>
        <button id="answer">👁 Cevap</button>
        <button id="hear">🔊 Dinle</button>
      </div>`;
    const out = $('#result', card);
    const reveal = () => { $('#reveal', card).hidden = false; };
    $('#mic', card).onclick = async () => {
      const done = await check(it, out, $$('button', card));
      if (done) { reveal(); Speech.speak(it.de); }
    };
    $('#hint', card).onclick = () => { out.innerHTML = `<p class="hint">İlk kelime: <b>${esc(first)}</b> …</p>`; };
    $('#answer', card).onclick = () => { reveal(); Speech.speak(it.de); };
    $('#hear', card).onclick = () => Speech.speak(it.de);
  }

  // Mikrofonla dinler, sonucu gösterir. Sonuç gösterildiyse true döner.
  async function check(it, out, buttons) {
    if (!Speech.canListen) { selfGrade(it, out); return true; }
    buttons.forEach(b => { b.disabled = true; });
    out.innerHTML = `<p class="listening">🎤 Dinliyorum… şimdi konuş</p>`;
    try {
      const alts = await Speech.listen();
      if (!alts.length) { out.innerHTML = `<p class="hint">Ses algılanamadı, tekrar dene.</p>`; return false; }
      const best = alts.map(a => Compare.diff(it.de, a)).sort((x, y) => y.score - x.score)[0];
      const ok = best.score >= PASS;
      mark(it, ok);
      out.innerHTML = `
        <p class="score ${ok ? 'ok' : 'bad'}">${ok ? '✓ Harika!' : '✗ Tekrar dene'} · %${Math.round(best.score * 100)}</p>
        <p class="diff">${best.words.map(w => `<span class="${w.ok ? 'ok' : 'bad'}">${esc(w.text)}</span>`).join(' ')}</p>
        <p class="heard">Duyulan: “${esc(best.spoken)}”</p>`;
      return true;
    } catch (e) {
      if (e.message !== 'aborted') out.innerHTML = `<p class="hint warn">${esc(micError(e.message))}</p>`;
      return false;
    } finally {
      buttons.forEach(b => { b.disabled = false; });
    }
  }

  // Konuşma tanıma yoksa kullanıcı kendini değerlendirir.
  function selfGrade(it, out) {
    out.innerHTML = `
      <p class="hint">Bu tarayıcı konuşma tanımayı desteklemiyor. Kendin değerlendir:</p>
      <p class="de">${esc(it.de)}</p>
      <div class="row"><button data-ok="1">✓ Doğru söyledim</button><button data-ok="">✗ Zorlandım</button></div>`;
    $$('button', out).forEach(b => {
      b.onclick = () => {
        mark(it, !!b.dataset.ok);
        out.innerHTML = `<p class="score ${b.dataset.ok ? 'ok' : 'bad'}">${b.dataset.ok ? '✓ Kaydedildi' : '✗ Zor olanlara eklendi'}</p>`;
      };
    });
  }

  function micError(code) {
    return ({
      'not-allowed': 'Mikrofon izni verilmedi. Tarayıcı ayarlarından bu siteye mikrofon izni ver.',
      'service-not-allowed': 'Konuşma tanıma bu tarayıcıda kapalı.',
      'network': 'Konuşma tanıma internet bağlantısı gerektiriyor.',
      'audio-capture': 'Mikrofon bulunamadı.',
    })[code] || `Konuşma tanıma hatası: ${code}`;
  }

  // ---------- Oynatıcı (Tekrar) ----------
  // Bir cümle için akış: 🔊 Almanca (× tekrar, ilkinden sonra 🇹🇷 Türkçe) → 🗣️ sen söyle → 🔊 bir kez daha → ⏳ → sonraki
  // Adım türleri: { de, tr, key? } cümle · { explain } Türkçe anlatım · { section } başlık
  const pl = { key: null, steps: [], i: 0, playing: false, run: 0, back: '#/' };
  let wakeLock = null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const PHASE_LABEL = { de: '🔊 Dinle', tr: '🇹🇷 Türkçe', you: '🗣️ Sen söyle', again: '🔊 Bir daha', wait: '⏳ Bekle' };
  const SPEEDS = [['slow', '🐢 Yavaş'], [1, 'Normal'], [1.2, '🐇 Hızlı']];

  async function keepAwake(on) {
    try {
      if (on && !wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
      else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch { wakeLock = null; }
  }

  function seen(step) {
    if (!step.key) return;
    const [tid, idx] = step.key.split(':');
    progress[tid] = [...new Set([...(progress[tid] || []), +idx])];
    store.set('ap_progress', progress);
  }

  const savePos = () => { const pos = store.get('ap_pos', {}); pos[pl.key] = pl.i; store.set('ap_pos', pos); };
  const posOf = key => store.get('ap_pos', {})[key] || 0;

  function phasesFor(s) {
    const ph = [];
    for (let r = 0; r < s.repeats; r++) { ph.push('de'); if (r === 0 && s.readTr) ph.push('tr'); }
    ph.push('you', 'again', 'wait');
    return ph;
  }

  const unitList = () => [...new Set(topics.map(t => t.unit).filter(Boolean))].sort((a, b) => a - b);
  const shortTitle = t => t.title.replace(/^(L|Lektion )\d+:\s*/, '');
  function unitSteps(units) {
    const steps = [];
    for (const u of units) {
      for (const t of topics.filter(t => t.unit === u)) {
        steps.push({ section: `Ünite ${u} · ${shortTitle(t)}` });
        steps.push(...itemsOf(t.id));
      }
    }
    return steps;
  }
  const courseSteps = id => (id === 'all' ? course : course.filter(u => u.id === id))
    .flatMap(u => [{ section: u.title }, ...u.steps.map(s => ({ ...s, cid: u.id })), { end: u.id, title: u.title }]);

  function renderPlayer({ key, title, back, steps }) {
    if (!steps.length) { location.hash = '#/'; return; }
    if (pl.key !== key) { pl.key = key; pl.steps = steps; pl.i = Math.min(posOf(key), steps.length - 1); }
    pl.back = back;
    setHeader(title, back);
    view.innerHTML = `
      <div class="counter"><span id="cnt"></span><span class="bar"><i id="bar"></i></span></div>
      <div class="card player" id="pcard">
        <p class="tag" id="ptag"></p>
        <p class="de big" id="pde"></p>
        <p class="tr" id="ptr"></p>
        <ol class="timeline" id="tl"></ol>
        <div class="countdown" id="cd"><i></i></div>
      </div>
      <div class="controls">
        <button id="pprev" aria-label="Önceki">⏮</button>
        <button id="pplay" class="play" aria-label="Başlat">▶</button>
        <button id="pnext" aria-label="Sonraki">⏭</button>
      </div>
      <div class="row">
        <button id="pslow">Hız: <b id="pslowv"></b></button>
        <button id="pset">⚙️ Ayarlar</button>
        <button id="prestart">↺ Baştan</button>
      </div>
      <section class="panel" id="psettings" hidden>${settingsHtml()}</section>`;
    $('#pplay').onclick = () => (pl.playing ? pausePlayer() : startPlayer());
    $('#pprev').onclick = () => jump(-1);
    $('#pnext').onclick = () => jump(1);
    $('#prestart').onclick = () => { const was = pl.playing; pausePlayer(); pl.i = 0; savePos(); showStep(); if (was) startPlayer(); };
    $('#pset').onclick = () => { $('#psettings').hidden = !$('#psettings').hidden; };
    $('#pslow').onclick = () => {
      const i = SPEEDS.findIndex(([v]) => v === Speech.getSpeed());
      Speech.setSpeed(SPEEDS[(i + 1) % SPEEDS.length][0]);
      updateSpeedLabel();
      $$('.seg[data-name=ap_speed] button').forEach(b => b.classList.toggle('on', JSON.parse(b.dataset.val) === Speech.getSpeed()));
    };
    bindSettings($('#psettings'), () => { updateSpeedLabel(); if (!pl.playing) showStep(); });
    updateSpeedLabel();
    showStep();
    // Sadece kullanıcı az önce dokunduysa kendiliğinden başla (sayfa yenilenince/geri yüklenince başlamasın).
    if (Date.now() - lastTap < 2000) startPlayer(); else updatePlayBtn();
  }

  function updateSpeedLabel() {
    const el = $('#pslowv');
    if (el) el.textContent = (SPEEDS.find(([v]) => v === Speech.getSpeed()) || [0, `${Speech.getSpeed()}×`])[1];
  }

  function showStep() {
    if (!$('#pcard')) return;
    const n = pl.steps.length;
    $('#cnt').textContent = `${Math.min(pl.i + 1, n)} / ${n}`;
    $('#bar').style.width = `${Math.min(pl.i + 1, n) / n * 100}%`;
    $('#pcard').classList.remove('explain', 'section', 'done');
    setCountdown(0);
    if (pl.i >= n) {
      $('#pcard').classList.add('done');
      $('#ptag').textContent = '';
      $('#pde').textContent = '✓ Bitti!';
      $('#ptr').textContent = 'Hepsini tekrar ettin. Baştan başlamak için ▶';
      $('#tl').innerHTML = '';
      return;
    }
    const st = pl.steps[pl.i];
    // En yakın önceki başlık, cümlenin üstünde etiket olarak görünür.
    let tag = '';
    for (let k = pl.i; k >= 0; k--) if (pl.steps[k].section) { tag = pl.steps[k].section; break; }
    $('#ptag').textContent = st.section || st.end ? '' : tag;
    if (st.end) {
      $('#pcard').classList.add('section');
      $('#pde').textContent = `✓ ${st.title}`;
      $('#ptr').textContent = 'Ünite tamamlandı!';
      $('#tl').innerHTML = '';
    } else if (st.section) {
      $('#pcard').classList.add('section');
      $('#pde').textContent = st.section;
      $('#ptr').textContent = '';
      $('#tl').innerHTML = '';
    } else if (st.explain) {
      $('#pcard').classList.add('explain');
      $('#pde').textContent = '📘 Anlatım';
      $('#ptr').textContent = st.explain;
      $('#tl').innerHTML = '';
    } else {
      $('#pde').textContent = st.de;
      $('#ptr').textContent = st.tr;
      $('#tl').innerHTML = phasesFor(settings()).map(p => `<li data-p="${p}">${PHASE_LABEL[p]}</li>`).join('');
    }
    if ('mediaSession' in navigator && st.de) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: st.de, artist: st.tr, album: tag });
    }
  }

  function setPhase(k) {
    $$('#tl li').forEach((li, i) => { li.classList.toggle('on', i === k); li.classList.toggle('past', i < k); });
  }
  function setCountdown(ms) {
    const bar = $('#cd i');
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.width = ms ? '100%' : '0%';
    if (ms) { void bar.offsetWidth; bar.style.transition = `width ${ms}ms linear`; bar.style.width = '0%'; }
  }

  function updatePlayBtn() {
    const b = $('#pplay');
    if (!b) return;
    b.textContent = pl.playing ? '⏸' : '▶';
    b.setAttribute('aria-label', pl.playing ? 'Durdur' : 'Başlat');
  }

  async function playSentence(st, alive) {
    const s = settings();
    const ph = phasesFor(s);
    $('#tl').innerHTML = ph.map(p => `<li data-p="${p}">${PHASE_LABEL[p]}</li>`).join('');
    let dur = 1.5;
    for (let k = 0; k < ph.length; k++) {
      setPhase(k);
      const p = ph[k];
      if (p === 'de' || p === 'again') {
        const t0 = performance.now();
        const ok = await Speech.speak(st.de);
        if (!alive()) return null;
        if (!ok) return false;
        dur = (performance.now() - t0) / 1000;
      } else if (p === 'tr') {
        await Speech.speak(st.tr, { lang: 'tr' });
        if (!alive()) return null;
      } else {
        const ms = (p === 'you' ? dur * 1.2 * s.gap + 0.8 : dur * 0.7 * s.gap + 0.4) * 1000;
        setCountdown(ms);
        await sleep(ms);
        if (!alive()) return null;
        setCountdown(0);
      }
    }
    return true;
  }

  async function startPlayer() {
    if (pl.i >= pl.steps.length) { pl.i = 0; showStep(); }
    const my = ++pl.run;
    pl.playing = true;
    updatePlayBtn();
    keepAwake(true);
    const alive = () => pl.playing && my === pl.run;
    while (alive() && pl.i < pl.steps.length) {
      const st = pl.steps[pl.i];
      showStep();
      for (const nx of pl.steps.slice(pl.i, pl.i + 3)) {
        if (nx.de) { Speech.preload(nx.de); Speech.preload(nx.tr, { lang: 'tr' }); }
        else if (nx.explain) Speech.preload(nx.explain, { lang: 'tr' });
      }
      let ok = true;
      if (st.end) { Game.finished('course', st.title, st.end); }
      else if (st.section) { await sleep(900); ok = alive() ? true : null; }
      else if (st.explain) {
        ok = await Speech.speak(st.explain, { lang: 'tr' });
        if (!alive()) ok = null; else { await sleep(350); ok = alive() ? (ok || true) : null; }
      } else ok = await playSentence(st, alive);
      if (ok === null) return;
      if (ok === false) {
        pausePlayer();
        $('#ptag').textContent = 'Ses çalınamadı. Devam etmek için ▶ dokun.';
        return;
      }
      seen(st);
      if (st.de) Game.add(st.key ? st.key.split(':')[0] : st.cid, 1);
      pl.i++;
      savePos();
    }
    if (my === pl.run) {
      pl.playing = false; updatePlayBtn(); keepAwake(false); showStep();
      if (pl.i >= pl.steps.length && !pl.steps[pl.steps.length - 1].end) Game.finished('player', $('#title').textContent);
    }
  }

  function pausePlayer() {
    if (!pl.playing) return;
    pl.playing = false;
    pl.run++;
    Speech.stop();
    keepAwake(false);
    updatePlayBtn();
    setCountdown(0);
    $$('#tl li').forEach(li => li.classList.remove('on'));
  }

  function jump(d) {
    const was = pl.playing;
    pausePlayer();
    pl.i = Math.max(0, Math.min(pl.steps.length - 1, pl.i + d));
    savePos();
    showStep();
    if (was) startPlayer();
  }

  if ('mediaSession' in navigator) {
    const onPlayer = fn => () => { if ($('#pplay')) fn(); };
    navigator.mediaSession.setActionHandler('play', onPlayer(startPlayer));
    navigator.mediaSession.setActionHandler('pause', onPlayer(pausePlayer));
    navigator.mediaSession.setActionHandler('nexttrack', onPlayer(() => jump(1)));
    navigator.mediaSession.setActionHandler('previoustrack', onPlayer(() => jump(-1)));
  }

  // ---------- Ortak ayar kontrolleri ----------
  function seg(name, options, current) {
    return `<div class="seg" data-name="${name}">${options.map(([val, label]) =>
      `<button data-val='${JSON.stringify(val)}' class="${JSON.stringify(val) === JSON.stringify(current) ? 'on' : ''}">${label}</button>`).join('')}</div>`;
  }

  function settingsHtml() {
    const s = settings();
    return `
      <p class="label">Konuşma hızı</p>
      ${seg('ap_speed', SPEEDS, Speech.getSpeed())}
      <p class="label">Ses seviyesi <output id="volOut">${Math.round(Speech.getVolume() * 100)}%</output></p>
      <input type="range" id="vol" min="0" max="1" step="0.05" value="${Speech.getVolume()}">
      <p class="label">Sen söylemeden önce kaç kez dinlensin?</p>
      ${seg('ap_repeats', [[1, '1×'], [2, '2×'], [3, '3×']], s.repeats)}
      <p class="label">Söylemen için bekleme süresi</p>
      ${seg('ap_gap', [['kisa', 'Kısa'], ['normal', 'Normal'], ['uzun', 'Uzun']], store.get('ap_gap', 'normal'))}
      <label class="check"><input type="checkbox" id="readTr" ${s.readTr ? 'checked' : ''}> Türkçesini de sesli oku</label>`;
  }

  function bindSettings(root, onChange = () => {}) {
    $$('.seg', root).forEach(g => {
      $$('button', g).forEach(b => {
        b.onclick = () => {
          const val = JSON.parse(b.dataset.val);
          if (g.dataset.name === 'ap_speed') Speech.setSpeed(val);
          else store.set(g.dataset.name, val);
          $$('button', g).forEach(x => x.classList.toggle('on', x === b));
          onChange();
        };
      });
    });
    const vol = $('#vol', root);
    vol.oninput = () => { Speech.setVolume(+vol.value); $('#volOut', root).textContent = `${Math.round(vol.value * 100)}%`; };
    $('#readTr', root).onchange = e => { store.set('ap_readTr', e.target.checked); onChange(); };
  }

  // ---------- Hakkında ----------
  function renderAbout() {
    setHeader('Hakkında', '#/');
    const sentences = topics.reduce((n, t) => n + t.items.length, 0) + course.reduce((n, u) => n + u.steps.filter(s => s.de).length, 0);
    view.innerHTML = `
      <section class="about">
        <div class="logo">De</div>
        <h2>Almanca Pratik</h2>
        <p class="tagline">Dinle · Tekrar et · Konuş</p>
        <p>A1 seviyesinde Almanca öğrenmek için kendi ders notlarımdan yaptığım bir uygulama. Kendi kendine çalışırken kulaklıkla dinleyip sesli tekrar etmek için tasarlandı.</p>
        <ul class="facts">
          <li><b>${topics.length + course.length}</b><small>konu</small></li>
          <li><b>${sentences}</b><small>cümle</small></li>
          <li><b>8</b><small>doğal ses</small></li>
        </ul>
        <h3>Neler var?</h3>
        <ul class="features">
          <li>🔁 <b>Tek tuşla tekrar:</b> dinle, Türkçesini duy, sen söyle, bir kez daha dinle.</li>
          <li>📘 <b>Cümle kurma:</b> Türkçe anlatımlı, adım adım cümle kurdurur.</li>
          <li>🎙️ <b>Telaffuz kontrolü:</b> mikrofona söyle, doğru kelimeler yeşil yanar.</li>
          <li>📈 <b>Seviyeler:</b> her konu kullandıkça 1'den 10'a dolar.</li>
          <li>🏅 <b>Ödüller:</b> rozetler, puanlar, gün serisi ve süre sayacı.</li>
          <li>📱 <b>Telefona kurulur</b> ve internetsiz çalışır.</li>
        </ul>
        <button class="start share-btn" id="share">📤 Arkadaşınla paylaş</button>
        <div class="qr" id="qr" aria-label="Uygulamanın QR kodu"></div>
        <p class="hint">Telefon kamerasıyla okut, uygulama açılsın.</p>
        <p class="made-with"><span class="mark">✳</span> Claude ile yapıldı</p>
      </section>`;
    $('#share').onclick = shareApp;
    // QR kodu (internet yoksa sessizce atlanır)
    const draw = () => { try { new QRCode($('#qr'), { text: appUrl(), width: 180, height: 180, colorDark: '#2b2a33', colorLight: '#ffffff' }); } catch {} };
    if (window.QRCode) draw();
    else {
      const sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      sc.onload = draw;
      document.head.appendChild(sc);
    }
  }

  const appUrl = () => location.origin + location.pathname;
  async function shareApp() {
    const data = { title: 'Almanca Pratik', text: 'Almanca öğrenmek için yaptığım uygulamaya bak! 🇩🇪', url: appUrl() };
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(`${data.text} ${data.url}`);
      Game.toast('🔗', 'Link kopyalandı!', 'İstediğin yere yapıştırıp gönderebilirsin.', { confetti: false });
    } catch (e) {
      if (e.name !== 'AbortError') prompt('Bu linki kopyala:', data.url);
    }
  }

  // ---------- Ses ayarları ----------
  function voiceList(lang, sample) {
    const cur = Speech.voice(lang);
    return `<ul class="voices">${Speech.voices(lang).map(v => `
      <li class="${cur && v.id === cur.id ? 'sel' : ''}">
        <button class="pv" data-lang="${lang}" data-id="${v.id}" aria-label="${esc(v.name)} dinle">▶</button>
        <label>
          <input type="radio" name="voice-${lang}" value="${v.id}" ${cur && v.id === cur.id ? 'checked' : ''}>
          <span><b>${esc(v.name)}</b><small>${esc(v.gender)}</small></span>
        </label>
      </li>`).join('')}</ul>`;
  }

  function renderVoices() {
    setHeader('Ses ayarları', '#/');
    const samples = { de: 'Ich komme aus der Türkei.', tr: "Türkiye'denim." };
    view.innerHTML = `
      ${Speech.hasNatural() ? `
        <section class="panel">
          <h2>Almanca ses <small>▶ ile dinle, beğendiğini seç</small></h2>
          ${voiceList('de')}
        </section>
        <section class="panel">
          <h2>Türkçe ses</h2>
          ${voiceList('tr')}
        </section>`
      : `<p class="hint warn">Doğal ses dosyaları bulunamadı; cihazın kendi sesi kullanılıyor. (README: ses üretme)</p>`}
      <section class="panel" id="settings">
        <h2>Tekrar ayarları</h2>
        ${settingsHtml()}
      </section>
      ${Speech.hasNatural() ? `
        <section class="panel">
          <h2>İnternetsiz kullanım</h2>
          <p class="hint">Seçili Almanca ve Türkçe sesin tüm dosyalarını telefona indirir (~20 MB).</p>
          <button id="dl" class="wide">⬇ Seçili sesleri indir</button>
          <p class="hint" id="dlStatus"></p>
        </section>` : ''}
      ${Speech.canListen ? '' : `<p class="hint warn">Bu tarayıcı konuşma tanımayı desteklemiyor. Mikrofonlu modlarda kendini değerlendirebilirsin; tam destek için Android'de Chrome, iPhone'da Safari kullan.</p>`}`;

    $$('.voices .pv').forEach(b => {
      b.onclick = () => {
        const v = Speech.voices(b.dataset.lang).find(v => v.id === b.dataset.id);
        Speech.speak(samples[b.dataset.lang], { lang: b.dataset.lang, voice: v });
      };
    });
    $$('.voices input[type=radio]').forEach(r => {
      r.onchange = () => {
        const lang = r.name.slice(6);
        Speech.setVoice(lang, r.value);
        r.closest('ul').querySelectorAll('li').forEach(li => li.classList.toggle('sel', li.contains(r)));
        Speech.speak(samples[lang], { lang });
      };
    });
    bindSettings($('#settings'));
    const dl = $('#dl');
    if (dl) {
      dl.onclick = async () => {
        dl.disabled = true;
        const out = $('#dlStatus');
        const failed = await Speech.download((done, total) => { out.textContent = `İndiriliyor… ${done} / ${total}`; });
        out.textContent = failed ? `${failed} dosya indirilemedi, tekrar dene.` : '✓ Hazır! Artık internetsiz de çalışır.';
        dl.disabled = false;
      };
    }
  }

  async function init() {
    try {
      const res = await fetch('data/topics.json');
      topics = (await res.json()).topics;
      course = await fetch('data/course.json').then(r => r.json()).then(d => d.units).catch(() => []);
      // Silinmiş konulara ait eski "zor" kayıtlarını temizle.
      hard = hard.filter(k => { const [tid, idx] = k.split(':'); return topics.find(t => t.id === tid)?.items[+idx]; });
      store.set('ap_hard', hard);
    } catch {
      view.innerHTML = `<p class="hint warn">İçerik yüklenemedi. Uygulamayı bir sunucu üzerinden aç (README'ye bak).</p>`;
      return;
    }
    await Speech.init();
    Game.setAreas(Object.fromEntries([
      ...topics.map(t => [t.id, { size: t.items.length, title: t.title, emoji: t.emoji }]),
      ...course.map(u => [u.id, { size: u.steps.filter(s => s.de).length, title: u.title, emoji: u.emoji }]),
    ]));
    Game.startTimer();
    window.addEventListener('hashchange', route);
    route();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  init();
})();
