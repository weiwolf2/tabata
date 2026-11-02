(() => {
  /* ===== 素材設定：在 js/config.js 修改 ===== */
  const CONF = window.TABATA_CONFIG || {};
  const MODES = ['day', 'night'];
  let mode = CONF.defaultMode === 'night' ? 'night' : 'day';
  try { const m = localStorage.getItem('tabata.mode'); if (MODES.includes(m)) mode = m; } catch (e) {}
  const media = () => CONF[mode] || {};

  /* ===== 固定課表：準備 10 秒 + 8 ×（運動 20 秒 / 休息 10 秒），最後一回合不休息 = 4:00 ===== */
  const PREP = 10, WORK = 20, REST = 10, ROUNDS = 8;
  const WARN_SECONDS = 3;

  /* ===== 語音：中文「元氣少女」（裝置內建中文女聲，調高音調、加快語速） ===== */
  const VOICE = { pitch: 1.38, rate: 1.18,
    prefer: ['HsiaoChen', '曉臻', 'Meijia', '美佳', 'Hanhan', '涵涵', 'Yating', 'Google 國語', 'Xiaoyi', 'Tingting'] };
  const MALE = /Zhiwei|志偉|YunJhe|雲哲|Li-?mu|Yunxi|Yunyang|Yunjian|Kangkang|Danny|Male|男/i;
  const LINES = {
    prep: '準備開始！',
    work: '運動 20 秒，加油！',
    last: '最後一回合！運動 20 秒，加油！',
    rest: '休息 10 秒，深呼吸。',
    done: 'Tabata 訓練完成！你超棒的！',
  };

  const TAG = { prep: 'Ready', work: 'Work', rest: 'Rest' };
  const NAME = { prep: '準備', work: '運動', rest: '休息' };
  const $ = (s) => document.querySelector(s);
  const C = 2 * Math.PI * 142;
  let muted = false;

  /* ===== 音效 ===== */
  let ctx = null;
  function ac() {
    if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (A) ctx = new A(); }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, { type = 'sine', gain = 0.22, when = 0 } = {}) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.03);
  }
  const sfx = {
    click() { tone(1500, 0.045, { type: 'triangle', gain: 0.12 }); tone(900, 0.05, { gain: 0.08, when: 0.012 }); },
    tick()  { tone(880, 0.14, { type: 'square', gain: 0.11 }); },
    go()    { tone(1320, 0.42, { type: 'square', gain: 0.12 }); tone(1760, 0.35, { gain: 0.1, when: 0.04 }); },
    rest()  { tone(784, 0.25, { type: 'triangle', gain: 0.18 }); tone(523, 0.4, { type: 'triangle', gain: 0.18, when: 0.16 }); },
    ready() { tone(660, 0.16, { type: 'triangle', gain: 0.16 }); tone(880, 0.22, { type: 'triangle', gain: 0.16, when: 0.14 }); },
    finish(){ [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.7 : 0.2, { type: 'triangle', gain: 0.2, when: i * 0.13 })); },
  };
  document.addEventListener('pointerdown', (e) => { if (e.target.closest('button') && !muted) sfx.click(); });

  /* ===== 語音 ===== */
  const hasSpeech = 'speechSynthesis' in window;
  let voice = null;
  function loadVoices() {
    try {
      const vs = speechSynthesis.getVoices();
      const rank = (v) => /zh[-_]TW/i.test(v.lang) ? 0 : /zh[-_](HK|Hant)/i.test(v.lang) ? 1 : 2;
      let zh = vs.filter(v => /^zh/i.test(v.lang) && !MALE.test(v.name)).sort((x, y) => rank(x) - rank(y));
      if (!zh.length) zh = vs.filter(v => /^zh/i.test(v.lang));
      voice = null;
      for (const key of VOICE.prefer) { voice = zh.find(v => v.name.includes(key)); if (voice) break; }
      voice = voice || zh[0] || null;
    } catch (e) { voice = null; }
  }
  function stopVoice() { if (hasSpeech) try { speechSynthesis.cancel(); } catch (e) {} }
  function speakKey(key) {
    if (muted || !hasSpeech) return;
    stopVoice();
    if (!voice) loadVoices();
    try {
      const u = new SpeechSynthesisUtterance(LINES[key]);
      u.lang = voice ? voice.lang : 'zh-TW'; if (voice) u.voice = voice;
      u.pitch = VOICE.pitch; u.rate = VOICE.rate;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function unlockSpeech() { if (hasSpeech) try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} }
  if (hasSpeech) { loadVoices(); try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {} }

  /* ===== 課表 ===== */
  const PLAN = [{ type: 'prep', dur: PREP, round: 0 }];
  for (let r = 1; r <= ROUNDS; r++) {
    PLAN.push({ type: 'work', dur: WORK, round: r });
    if (r < ROUNDS) PLAN.push({ type: 'rest', dur: REST, round: r });
  }
  const TOTAL = PLAN.reduce((a, p) => a + p.dur, 0);
  const fmt = (t) => { t = Math.max(0, Math.floor(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  const segHTML = PLAN.map(p => `<i class="${p.type}" style="flex:${p.dur} 1 0"></i>`).join('');
  $('#home-bar').innerHTML = segHTML;
  $('#ov-base').innerHTML = segHTML;
  $('#ov-lit').innerHTML = segHTML;

  function show(name) {
    ['home', 'timer', 'done'].forEach(n => { $('#' + n).hidden = n !== name; });
    if (name !== 'timer') { document.body.dataset.phase = ''; document.body.dataset.warn = '0'; }
    window.scrollTo(0, 0);
  }

  /* ===== 螢幕常亮 ===== */
  let wl = null;
  async function requestWake() {
    try { if (navigator.wakeLock) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) { wl = null; }
  }
  function releaseWake() { try { wl && wl.release(); } catch (e) {} wl = null; }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.running && !wl) requestWake(); });

  /* ===== 圓圈中央的影片 / 靜態圖 ===== */
  const vid = $('#vid'), still = $('#still'), ph = $('#ph');
  let videoOk = false, imageOk = false;
  const curType = () => (S.active ? PLAN[S.idx].type : 'work');
  const mediaErr = { video: '', image: '' };
  vid.addEventListener('error', () => { if (!vid.getAttribute('src')) return; videoOk = false; diagnose('video', media().workoutVideo); });
  still.addEventListener('error', () => { if (!still.getAttribute('src')) return; imageOk = false; diagnose('image', media().restImage); });
  // 找出素材載入失敗的原因，顯示在圓圈中央
  async function diagnose(kind, src) {
    let msg = '無法播放';
    try {
      const r = await fetch(src, { cache: 'no-store' });
      if (r.status === 404) msg = '找不到檔案（404），請檢查路徑與大小寫';
      else if (!r.ok) msg = `讀取失敗（${r.status}）`;
      else {
        const head = (await r.clone().text()).slice(0, 60);
        const size = Number(r.headers.get('content-length')) || (await r.blob()).size;
        if (head.startsWith('version https://git-lfs')) msg = '這是 Git LFS 指標檔，不是實際檔案';
        else if (size < 2000) msg = `檔案只有 ${size} bytes，內容不完整`;
        else msg = kind === 'video' ? '影片格式無法播放，請用 H.264 編碼的 mp4' : '圖片格式無法顯示';
      }
    } catch (e) {
      msg = location.protocol === 'file:' ? '請用 http/https 網址開啟，或檢查檔案位置' : '無法讀取檔案';
    }
    if (src !== (kind === 'video' ? media().workoutVideo : media().restImage)) return; // 已切換模式
    mediaErr[kind] = `${msg}\n${src}`;
    console.warn('[Tabata] ' + kind + ' 載入失敗：', msg, src);
    if (S.active) setMedia(curType());
  }
  function loadMedia() {
    const m = media();
    mediaErr.video = mediaErr.image = '';
    videoOk = !!m.workoutVideo; imageOk = !!m.restImage;
    if (m.workoutVideo) vid.src = m.workoutVideo; else { vid.removeAttribute('src'); vid.load(); }
    if (m.restImage) still.src = m.restImage; else still.removeAttribute('src');
    if (S.active) setMedia(curType());
  }

  /* ===== Day / Night 切換 ===== */
  function applyMode() {
    document.documentElement.dataset.mode = mode;
    document.querySelectorAll('.mode-label').forEach(el => { el.textContent = mode === 'day' ? 'DAY' : 'NIGHT'; });
    document.querySelectorAll('[data-mode-btn]').forEach(b => b.setAttribute('aria-label', mode === 'day' ? '目前 Day，切換到 Night' : '目前 Night，切換到 Day'));
    const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = mode === 'day' ? '#d6ff1f' : '#ff36b8';
    loadMedia();
  }
  document.querySelectorAll('[data-mode-btn]').forEach(b => b.addEventListener('click', () => {
    mode = mode === 'day' ? 'night' : 'day';
    try { localStorage.setItem('tabata.mode', mode); } catch (e) {}
    applyMode();
  }));
  const ICON_PLAY = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 4.5v15l12-7.5z"/></svg>';
  const ICON_IMG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M21 16l-5-5-8 8"/></svg>';
  function setMedia(type) {
    if (type === 'work') {
      still.hidden = true;
      if (videoOk) { vid.hidden = false; ph.hidden = true; if (S.running) vid.play().catch(() => {}); }
      else showPh(ICON_PLAY, '運動影片', 'VIDEO · LOOP', mediaErr.video);
    } else {
      vid.pause(); vid.hidden = true;
      if (imageOk) { still.hidden = false; ph.hidden = true; }
      else { still.hidden = true; showPh(ICON_IMG, type === 'prep' ? '準備圖片' : '休息圖片', 'IMAGE', mediaErr.image); }
    }
  }
  function showPh(icon, title, sub, err) {
    ph.hidden = false; $('#ph-icon').innerHTML = icon; $('#ph-title').textContent = title; $('#ph-sub').textContent = sub;
    const e = $('#ph-err'); e.textContent = err || ''; e.hidden = !err;
  }

  /* ===== 計時引擎 ===== */
  const S = { idx: 0, t0: 0, pausedAt: 0, running: false, active: false, lastSec: null, planBefore: 0, actualBefore: 0 };
  const prog = $('#prog');

  function enterPhase(i, t0) {
    S.idx = i; S.t0 = t0; S.lastSec = null;
    const p = PLAN[i], n = PLAN[i + 1];
    document.body.dataset.phase = p.type;
    document.body.dataset.warn = '0';
    $('#phase').innerHTML = `${TAG[p.type]}<small>${NAME[p.type]}${p.type === 'work' && p.round === ROUNDS ? '・最後一回合' : ''}</small>`;
    $('#next').textContent = n ? `${NAME[n.type]} ${n.dur} 秒` : '完成';
    $('#st-round').textContent = `${p.round}/${ROUNDS}`;
    setMedia(p.type);
    if (!muted) (p.type === 'work' ? sfx.go : p.type === 'rest' ? sfx.rest : sfx.ready)();
    const key = p.type === 'work' && p.round === ROUNDS ? 'last' : p.type;
    setTimeout(() => { if (S.active && S.idx === i) speakKey(key); }, 280);
  }

  function onSecond(sec, p) {
    const warn = sec <= WARN_SECONDS && sec > 0;
    document.body.dataset.warn = warn ? '1' : '0';
    if (warn && sec < p.dur && !muted) sfx.tick();
  }

  function draw(frac, planPos, actual) {
    prog.style.strokeDashoffset = String(C * (1 - Math.max(0, Math.min(1, frac))));
    $('#ov-lit').style.clipPath = `inset(0 ${100 - (planPos / TOTAL) * 100}% 0 0)`;
    const e = fmt(actual), l = fmt(Math.ceil(TOTAL - planPos));
    if ($('#st-elapsed').textContent !== e) $('#st-elapsed').textContent = e;
    if ($('#st-left').textContent !== l) $('#st-left').textContent = l;
  }

  function tick() {
    if (!S.running) return;
    const now = performance.now();
    let p = PLAN[S.idx], el = (now - S.t0) / 1000;
    while (el >= p.dur) {
      S.planBefore += p.dur; S.actualBefore += p.dur;
      if (S.idx + 1 >= PLAN.length) { finish(); return; }
      enterPhase(S.idx + 1, S.t0 + p.dur * 1000);
      p = PLAN[S.idx]; el = (now - S.t0) / 1000;
    }
    const rem = p.dur - el, sec = Math.ceil(rem);
    if (sec !== S.lastSec) { S.lastSec = sec; onSecond(sec, p); }
    draw(rem / p.dur, S.planBefore + el, S.actualBefore + el);
  }
  function frame() { if (!S.running) return; tick(); requestAnimationFrame(frame); }
  setInterval(() => { if (document.hidden) tick(); }, 250);

  function setPauseUI(paused) {
    $('#ico-pause').hidden = paused; $('#ico-play').hidden = !paused;
    $('#btn-pause').setAttribute('aria-label', paused ? '繼續' : '暫停');
    $('#paused').hidden = !paused;
  }

  function start() {
    ac(); unlockSpeech();
    S.planBefore = 0; S.actualBefore = 0; S.running = true; S.active = true;
    try { vid.currentTime = 0; } catch (e) {}
    setPauseUI(false);
    show('timer');
    enterPhase(0, performance.now());
    requestWake();
    requestAnimationFrame(frame);
  }
  function pause() {
    if (!S.running) return;
    tick(); if (!S.running) return;
    S.running = false; S.pausedAt = performance.now();
    vid.pause(); stopVoice();
    setPauseUI(true);
  }
  function resume() {
    if (S.running || !S.active) return;
    S.t0 += performance.now() - S.pausedAt; S.running = true;
    if (!vid.hidden) vid.play().catch(() => {});
    setPauseUI(false);
    if (!wl) requestWake();
    requestAnimationFrame(frame);
  }
  function skip() {
    if (!S.active) return;
    const now = S.running ? performance.now() : S.pausedAt;
    const p = PLAN[S.idx], el = Math.min(p.dur, (now - S.t0) / 1000);
    S.planBefore += p.dur; S.actualBefore += el;
    if (S.idx + 1 >= PLAN.length) { finish(); return; }
    enterPhase(S.idx + 1, now);
    if (!S.running) { S.pausedAt = now; draw(1, S.planBefore, S.actualBefore); }
  }
  function finish() {
    S.running = false; S.active = false;
    document.body.dataset.warn = '0';
    vid.pause(); releaseWake();
    draw(0, TOTAL, S.actualBefore);
    if (!muted) sfx.finish();
    setTimeout(() => speakKey('done'), 450);
    $('#dn-time').textContent = fmt(S.actualBefore);
    setTimeout(() => show('done'), 700);
  }
  function stop() {
    S.running = false; S.active = false;
    vid.pause(); releaseWake();
    stopVoice();
    $('#sheet').hidden = true;
    show('home');
  }

  /* ===== 事件 ===== */
  $('#btn-start').addEventListener('click', start);
  $('#btn-again').addEventListener('click', start);
  $('#btn-home').addEventListener('click', () => show('home'));
  $('#btn-pause').addEventListener('click', () => (S.running ? pause() : resume()));
  $('#btn-skip').addEventListener('click', skip);
  $('#btn-close').addEventListener('click', () => { pause(); $('#sheet').hidden = false; $('#btn-resume').focus(); });
  $('#btn-resume').addEventListener('click', () => { $('#sheet').hidden = true; resume(); });
  $('#btn-end').addEventListener('click', stop);
  $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') { $('#sheet').hidden = true; resume(); } });
  $('#btn-mute').addEventListener('click', () => {
    muted = !muted;
    if (muted) stopVoice();
    $('#ico-sound').hidden = muted; $('#ico-mute').hidden = !muted;
    $('#btn-mute').setAttribute('aria-label', muted ? '開啟聲音' : '靜音');
  });
  document.addEventListener('keydown', (e) => {
    if ($('#timer').hidden || !$('#sheet').hidden) return;
    if (e.code === 'Space') { e.preventDefault(); S.running ? pause() : resume(); }
    if (e.code === 'ArrowRight') skip();
  });

  applyMode();
  show('home');
})();
