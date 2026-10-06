// Ses çalma (önceden üretilmiş doğal sesler, yoksa cihaz TTS'i) ve konuşma tanıma.
const Speech = (() => {
  const synth = window.speechSynthesis;
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let index = null;     // data/audio.json
  let deviceVoices = [];
  let rec = null;

  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const langOf = v => v.lang.replace('_', '-');

  // ---------- Ayarlar ----------
  const voices = lang => index?.voices?.[lang] || [];
  const voice = lang => {
    const list = voices(lang);
    return list.find(v => v.id === get(`ap_voice_${lang}`, null)) || list[0] || null;
  };
  const setVoice = (lang, id) => set(`ap_voice_${lang}`, id);
  const hasChosenVoice = () => get('ap_voice_de', null) != null;
  // Hız: 'slow' = ayrı yavaş kayıt, 1 = normal, 1.2 = hızlı (tarayıcı hafifçe hızlandırır).
  const SPEEDS = ['slow', 1, 1.2];
  const getSpeed = () => { const v = get('ap_speed2', 1); return SPEEDS.includes(v) ? v : 1; };
  const setSpeed = s => set('ap_speed2', s);
  const getVolume = () => get('ap_volume', 1);
  const setVolume = v => { set('ap_volume', v); player.volume = v; };
  const hasNatural = () => voices('de').length > 0;

  // ---------- MP3 çalar ----------
  // Tek bir <audio> öğesi kullanıyoruz: iOS ilk dokunuştan sonra aynı öğeyi çalmaya izin verir.
  const player = new Audio();
  player.preload = 'auto';
  player.volume = get('ap_volume', 1);
  let pending = null;
  let playToken = null;
  const settle = v => { const p = pending; pending = null; if (p) p(v); };
  player.onended = () => settle(true);
  player.onerror = () => settle(null);

  const SILENT = (() => {
    const n = 800, b = new Uint8Array(44 + n), dv = new DataView(b.buffer);
    const s = (o, str) => [...str].forEach((c, i) => { b[o + i] = c.charCodeAt(0); });
    s(0, 'RIFF'); dv.setUint32(4, 36 + n, true); s(8, 'WAVE'); s(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
    s(36, 'data'); dv.setUint32(40, n, true); b.fill(128, 44);
    return 'data:audio/wav;base64,' + btoa(String.fromCharCode(...b));
  })();
  document.addEventListener('pointerdown', () => {
    if (pending) return;
    player.src = SILENT;
    player.play().then(() => { if (player.src === SILENT) player.pause(); }).catch(() => {});
  }, { once: true, capture: true });

  // Dosyayı blob olarak alıp çalıyoruz; Safari'de service worker önbelleğinden ses çalmak böylece sorunsuz.
  const blobs = new Map();
  async function blobUrl(url) {
    if (blobs.has(url)) { const u = blobs.get(url); blobs.delete(url); blobs.set(url, u); return u; }
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    const u = URL.createObjectURL(await r.blob());
    blobs.set(url, u);
    if (blobs.size > 80) { const [k, v] = blobs.entries().next().value; URL.revokeObjectURL(v); blobs.delete(k); }
    return u;
  }

  // true = sonuna kadar çaldı, false = kesildi/izin yok, null = dosya yok (yedeğe geç)
  async function playFile(url, rate) {
    const token = playToken = {};
    let src;
    try { src = await blobUrl(url); } catch { return null; }
    if (playToken !== token) return false;
    return new Promise(res => {
      pending = res;
      player.src = src;
      player.preservesPitch = true;
      player.defaultPlaybackRate = rate;
      player.playbackRate = rate;
      player.play().catch(e => { if (pending === res) settle(e.name === 'NotAllowedError' ? false : null); });
    });
  }

  // ---------- Cihaz TTS'i (yedek) ----------
  function loadDeviceVoices() {
    return new Promise(res => {
      if (!synth) return res([]);
      const pick = () => (deviceVoices = synth.getVoices());
      if (pick().length) return res(deviceVoices);
      const t = setTimeout(() => res(pick()), 2000);
      synth.addEventListener('voiceschanged', () => { clearTimeout(t); res(pick()); }, { once: true });
    });
  }

  function tts(text, lang, rate) {
    return new Promise(res => {
      if (!synth) return res(false);
      const code = lang === 'tr' ? 'tr' : 'de';
      const u = new SpeechSynthesisUtterance(text);
      const v = deviceVoices.find(v => langOf(v) === (code === 'tr' ? 'tr-TR' : 'de-DE'))
        || deviceVoices.find(v => langOf(v).startsWith(code));
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = code === 'tr' ? 'tr-TR' : 'de-DE';
      u.rate = rate * 0.9;
      u.volume = getVolume();
      u.onend = () => res(true);
      u.onerror = () => res(false);
      synth.speak(u);
    });
  }

  // ---------- Dışa açık ----------
  // Çalınacak dosyanın adresi ve hızı. Yavaş kayıt varsa onu kullanır, yoksa normal kaydı yavaş çalar.
  function source(text, { lang = 'de', slow = false, voice: v } = {}) {
    const speed = getSpeed();
    const wantSlow = slow || speed === 'slow';
    const hash = index?.files?.[lang]?.[text];
    const chosen = v || voice(lang);
    if (!hash || !chosen) return { url: null, rate: wantSlow ? 0.8 : speed };
    const q = `?v=${index.version || 0}`;
    if (wantSlow && index.slow?.includes(lang)) return { url: `audio/${chosen.id}-slow/${hash}.mp3${q}`, rate: 1 };
    return { url: `audio/${chosen.id}/${hash}.mp3${q}`, rate: wantSlow ? 0.8 : lang === 'tr' ? 1 : speed };
  }

  async function speak(text, opts = {}) {
    stop();
    const { url, rate } = source(text, opts);
    if (url) {
      const r = await playFile(url, rate);
      if (r !== null) return r;
    }
    return tts(text, opts.lang || 'de', rate);
  }

  // Sıradaki cümlenin sesini önceden indirir, böylece cümleler arasında bekleme olmaz.
  function preload(text, opts = {}) {
    const { url } = source(text, opts);
    if (url) blobUrl(url).catch(() => {});
  }

  // Olası transkript listesini döner (boş liste = ses algılanmadı).
  function listen() {
    return new Promise((resolve, reject) => {
      if (!Rec) return reject(new Error('unsupported'));
      stop();
      const r = rec = new Rec();
      r.lang = 'de-DE';
      r.interimResults = false;
      r.maxAlternatives = 5;
      let done = false;
      const fin = (fn, val) => { if (!done) { done = true; if (rec === r) rec = null; fn(val); } };
      r.onresult = e => fin(resolve, [...e.results[0]].map(a => a.transcript));
      r.onerror = e => e.error === 'no-speech' ? fin(resolve, []) : fin(reject, new Error(e.error));
      r.onend = () => fin(resolve, []);
      try { r.start(); } catch (err) { fin(reject, err); }
    });
  }

  function stop() {
    playToken = null;
    if (pending) { player.pause(); settle(false); }
    if (synth) synth.cancel();
    if (rec) { try { rec.abort(); } catch {} rec = null; }
  }

  // Seçili Almanca ve Türkçe sesin tüm dosyalarını indirir (service worker önbelleğe alır).
  async function download(onProgress) {
    const urls = [];
    for (const lang of ['de', 'tr']) {
      const v = voice(lang);
      if (!v) continue;
      for (const h of Object.values(index.files[lang])) {
        urls.push(`audio/${v.id}/${h}.mp3?v=${index.version || 0}`);
        if (index.slow?.includes(lang)) urls.push(`audio/${v.id}-slow/${h}.mp3?v=${index.version || 0}`);
      }
    }
    let done = 0, failed = 0;
    const worker = async () => {
      while (urls.length) {
        const u = urls.pop();
        try { const r = await fetch(u); if (!r.ok) failed++; } catch { failed++; }
        onProgress(++done, done + urls.length, failed);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    return failed;
  }

  async function init() {
    try { index = await (await fetch('data/audio.json')).json(); } catch { index = null; }
    await loadDeviceVoices();
  }

  return {
    init, voices, voice, setVoice, hasChosenVoice, hasNatural, getSpeed, setSpeed, getVolume, setVolume,
    speak, preload, listen, stop, download,
    canListen: !!Rec,
  };
})();
