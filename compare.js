// Söylenen metni hedef cümleyle kelime kelime karşılaştırır.
const Compare = (() => {
  const ones = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
    'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
  const tens = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
  // Konuşma tanıma sayıları rakamla döndürebilir ("25"), bu yüzden kelimeye çeviriyoruz.
  const NUM = {};
  for (let n = 0; n <= 100; n++) {
    if (n < 20) NUM[n] = ones[n];
    else if (n === 100) NUM[n] = 'hundert';
    else {
      const u = n % 10;
      NUM[n] = (u ? (u === 1 ? 'ein' : ones[u]) + 'und' : '') + tens[Math.floor(n / 10)];
    }
  }

  function normWord(w) {
    w = w.toLowerCase();
    if (/^\d+$/.test(w) && +w <= 100) w = NUM[+w];
    return w.replace(/ß/g, 'ss');
  }

  function tokens(s) {
    return s.normalize('NFC')
      .replace(/€/g, ' euro ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .split(' ')
      .filter(Boolean)
      .map(normWord);
  }

  function lev(a, b) {
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let diag = prev[0];
      prev[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = prev[j];
        prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
        diag = tmp;
      }
    }
    return prev[b.length];
  }

  // Küçük yazım farklarına (tschüs/tschüss) tolerans.
  const same = (x, y) => x === y || (Math.min(x.length, y.length) >= 4 && lev(x, y) <= 1);

  function diff(target, spoken) {
    const orig = target.split(/\s+/).filter(Boolean).map(text => ({ text, keys: tokens(text) }));
    const a = [], owner = [];
    orig.forEach((o, i) => o.keys.forEach(k => { a.push(k); owner.push(i); }));
    const b = tokens(spoken);

    // En uzun ortak alt dizi (LCS) ile hizalama.
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--)
        dp[i][j] = same(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

    const matched = new Set();
    for (let i = 0, j = 0; i < a.length && j < b.length;) {
      if (same(a[i], b[j])) { matched.add(i); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }

    const words = orig.map((o, i) => ({
      text: o.text,
      ok: a.every((_, k) => owner[k] !== i || matched.has(k)),
    }));
    return { words, score: a.length ? matched.size / a.length : 0, spoken };
  }

  return { diff };
})();
