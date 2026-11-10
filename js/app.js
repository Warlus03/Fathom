// 画面。状態は S（学習記録）と D（教材）だけ。表示は毎回それらから作り直す。
import * as store from './store.js';
import { loadData, refreshData, ROLES } from './data.js';
import * as L from './learn.js';
import { SUBJECTS, TENSES, FORMS, build as buildPlay } from './play.js';

let S = store.load();
let D = null;
let ses = null; // 進行中の1回分 { mode, list, i, card, count }
let walk = null; // 地図や単語帳から開いた1文 { card }
let exportShown = false;
let slide = null; // 流して読む { list, i, sec, paused, done }
let slideTimer = null;
const play = { v: 'use', s: 'he', t: 'present', f: 'aff' }; // いじれる例文の今の選択

const $view = document.getElementById('view');
const $toast = document.getElementById('toast');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paras = (t) => String(t || '').split('\n').filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
// 保存できたら true。できなかったら、その場で知らせる。
const persist = (ownWords = false) => { const ok = store.save(S, { ownWords }); if (!ok) toast('この端末に保存できませんでした。空き容量を確認してください。'); return ok; };

const READ_LABEL = { none: '未探索', learning: '勉強中', solid: '読めば分かる' };
const LISTEN_LABEL = { none: '未測定', learning: '勉強中', solid: '聞いても分かる' };
const SHELF_LABEL = { read: '読む棚', talk: '話す棚', both: '両方' };

// 見た目（明るい／暗い／端末に合わせる）を当てる。既定は明るい配色
function applyTheme() {
  const t = S.settings.theme || 'light';
  document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.getElementById('themecolor');
  if (meta) meta.content = dark ? '#121428' : '#f3f4fc';
}

// 端末が、この記録を「勝手に消さないもの」として扱っているか（true / false / 分からないときは null）
let persisted = null;
async function checkPersisted(ask) {
  try {
    if (!navigator.storage || !navigator.storage.persisted) return;
    persisted = await navigator.storage.persisted();
    if (!persisted && ask && navigator.storage.persist) persisted = await navigator.storage.persist();
  } catch {}
}

let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('on'), 2600);
}

// ---------- 音 ----------
let ac;
function chime() {
  if (!S.settings.sound) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime;
    for (const [f, d] of [[659.25, 0], [987.77, 0.1]]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.06, t + d + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.1);
      o.connect(g).connect(ac.destination);
      o.start(t + d);
      o.stop(t + d + 1.2);
    }
  } catch {}
}

let playing = null;
const canSpeak = () => 'speechSynthesis' in window;
const englishVoices = () => (canSpeak() ? speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)) : []);
// Android のブラウザでは、声を名前で選んでも反映されず、言語（en-US など）ごとに端末の既定の声が使われる。
// だから Android では、名前の一覧ではなく「発音の地域」を1つずつ並べる（選べるのは実際に変わるものだけにする）。
const IS_ANDROID = /Android/i.test(navigator.userAgent);
const ACCENTS = { 'en-us': 'アメリカの英語', 'en-gb': 'イギリスの英語', 'en-au': 'オーストラリアの英語', 'en-in': 'インドの英語', 'en-ca': 'カナダの英語', 'en-ie': 'アイルランドの英語', 'en-nz': 'ニュージーランドの英語', 'en-za': '南アフリカの英語', 'en-sg': 'シンガポールの英語', 'en-ng': 'ナイジェリアの英語' };
const langKey = (v) => v.lang.replace('_', '-').toLowerCase();
const voiceLabel = (v) => (IS_ANDROID ? ACCENTS[langKey(v)] || v.lang : v.name);
function voiceChoices() {
  const vs = englishVoices();
  if (!IS_ANDROID) return vs;
  const seen = new Set();
  return vs.filter((v) => !seen.has(langKey(v)) && seen.add(langKey(v))).sort((a, b) => (langKey(a) === 'en-us' ? -1 : langKey(b) === 'en-us' ? 1 : 0));
}
// 声の選び方: 設定で選んだ声 → 無ければ、自然な声らしいものを優先しておまかせ
function autoVoice() {
  const score = (v) => (/natural|neural/i.test(v.name) ? 8 : 0) + (/google/i.test(v.name) ? 4 : 0) + (/premium|enhanced/i.test(v.name) ? 3 : 0) + (/^en[-_]US/i.test(v.lang) ? 2 : 0);
  return englishVoices().sort((a, b) => score(b) - score(a))[0] || null;
}
const pickVoice = () => englishVoices().find((v) => v.voiceURI === S.settings.voice) || autoVoice();
const NO_VOICE = 'この画面には英語の声が入っていません。Edge や Chrome で開くと、たいてい英語の声で聞けます。';

// en: 読み上げる英文。c: 聞く入口のカード（実際に音が出たかを記録する）
function speak(s, slow, c) {
  if (playing) { playing.pause(); playing = null; }
  // heard: 再生が始まり、失敗していない。heardFull: 最後まで再生できたことがある。
  // 始まったあとで失敗した回は、聞けたことにしない（前に最後まで聞けていれば、それは生きる）。
  const heard = () => { if (c) c.heard = true; };
  const ended = () => { if (c) { c.heard = true; c.heardFull = true; } };
  const failed = () => { if (c && !c.heardFull) { c.heard = false; c.audioFailed = true; render(); } toast('音声を再生できませんでした。'); };
  const tts = () => {
    if (!canSpeak()) { failed(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(s.en);
    const v = pickVoice();
    // 英語の声が無いと、日本語の声が英文を読んでしまう。それは聞かせない。
    if (!v) { if (c && !c.heard) { c.audioFailed = true; render(); } toast(NO_VOICE); return; }
    u.lang = v.lang.replace('_', '-');
    u.voice = v;
    u.rate = (S.settings.rate || 0.9) * (slow ? 0.72 : 1);
    u.onstart = heard;
    u.onend = ended;
    u.onerror = (ev) => { if (ev.error !== 'canceled' && ev.error !== 'interrupted') failed(); };
    speechSynthesis.speak(u);
  };
  // 音声ファイルがあればそちらを使う（data/index.json の audio に audioId を載せる）
  if (D.audio.has(s.audioId)) {
    const a = new Audio('audio/' + s.audioId + '.mp3');
    a.playbackRate = slow ? 0.8 : 1;
    a.onplaying = heard;
    a.onended = ended;
    a.onerror = failed;
    playing = a;
    a.play().catch(tts);
  } else tts();
}

// ---------- カード ----------
function newCard(s, mode) {
  const order = s.question.choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { s, mode, order, helped: false, open: false, revealed: mode !== 'listen', answered: false, choice: null, correct: null, word: null, viewLogged: false, heard: false, audioFailed: false, t0: Date.now() };
}
const activeCard = () => (walk ? walk.card : ses && ses.i < ses.list.length ? ses.card : null);

// 「この文を見た」ことを、答えとは別に記録する。
// 呼ぶのは2か所: 分解などを開いた瞬間（helped=true。再読み込みしても消えないよう、その場で保存）と、
// 答えずにカードを離れるとき（英文を読んだ事実を残す。次に出たとき初見として数えないため）。
function logView(c) {
  if (!c || c.answered || c.viewLogged) return;
  S.events.push({ t: Date.now(), sid: c.s.id, mode: c.mode, helped: c.helped, correct: null, choice: null, ms: null });
  c.viewLogged = true;
  persist();
}
const markHelped = (c) => { if (!c.answered && !c.helped) { c.helped = true; c.viewLogged = false; logView(c); } };

// 地図で文法の解説を読んだことを記録する（1項目につき1日1回）。
// その日のうちの正解は「解説を読んだ直後」なので、数日後の初見には数えない。
function noteGrammar(gid) {
  const today = L.dayOf(Date.now());
  if (S.events.some((e) => e.gid === gid && L.dayOf(e.t) === today)) return;
  S.events.push({ t: Date.now(), sid: '', gid, mode: 'map', helped: false, correct: null, choice: null, ms: null });
  persist();
}

function answer(c, choice) {
  if (c.answered) return;
  c.answered = true;
  c.choice = choice;
  c.correct = choice === c.s.question.answer;
  c.open = true;
  c.revealed = true;
  const ev = { t: Date.now(), sid: c.s.id, mode: c.mode, helped: c.helped, correct: c.correct, choice, ms: Date.now() - c.t0 };
  if (c.mode === 'listen' && !c.heard) ev.heard = false; // 音が出ていないなら、聴解の根拠にしない
  S.events.push(ev);
  persist();
  if (ses && ses.card === c) ses.count++;
  if (S.events.length === 1 && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (c.correct) chime();
}

// 進行中のカードを捨てて別のことを始める前に、「見た」ことを残す
const leaveCard = () => { if (ses && ses.i < ses.list.length) logView(ses.card); };

function startSession(opts) {
  leaveCard();
  const mode = opts.mode || 'read';
  const plan = L.buildSession(D, S, { mode, shelf: opts.focus ? 'both' : S.settings.shelf, focus: opts.focus || null });
  if (!plan.list.length) { toast(mode === 'listen' ? 'まず何文か読むと、聞く入口が開きます。' : '文がありません。'); return; }
  slide = null;
  ses = { mode, list: plan.list, i: 0, count: 0, card: newCard(plan.list[0], mode) };
  location.hash = '#today';
  render(true);
  if (mode === 'listen') speak(ses.card.s, false, ses.card);
}

function wordify(text, s) {
  if (!s.words.length) return esc(text);
  const ws = s.words.map((w, i) => ({ w: w.w, i })).sort((a, b) => b.w.length - a.w.length);
  const re = new RegExp('\\b(' + ws.map((x) => x.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');
  let out = '', last = 0, m;
  while ((m = re.exec(text))) {
    out += esc(text.slice(last, m.index));
    const hit = ws.find((x) => x.w.toLowerCase() === m[0].toLowerCase());
    out += `<button class="w" data-act="word" data-i="${hit.i}">${esc(m[0])}</button>`;
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

function viewBreak(c) {
  const s = c.s, lab = S.settings.labels === 'term' ? 'term' : 'plain';
  const chunks = s.chunks.map((ch) => `<div class="chunk role-${ch.role}"><span class="lab">${esc(ch[lab] || ROLES[ch.role][lab])}</span><span class="tx">${wordify(ch.text, s)}</span></div>`).join('');
  const whys = s.chunks.filter((ch) => ch.why).map((ch) => `<li><b class="role-${ch.role}">${esc(ch.text)}</b>${esc(ch.why)}</li>`).join('');
  let word = '';
  if (c.word != null) {
    const w = s.words[c.word];
    word = `<div class="wordinfo"><b>${esc(w.lemma)}</b>${w.lemma.toLowerCase() !== w.w.toLowerCase() ? `<span class="form">（この文では ${esc(w.w)}）</span>` : ''}<span class="mean">${esc(w.ja)}</span>
      <small>単語帳に入れました。<button class="link" data-act="unword">取り消す</button></small></div>`;
  }
  return `<div class="break">
    <div class="seg" role="group" aria-label="ラベルの種類">
      <button data-act="labels" data-v="plain" class="${lab === 'plain' ? 'on' : ''}">ふだんの言葉</button>
      <button data-act="labels" data-v="term" class="${lab === 'term' ? 'on' : ''}">文法用語</button>
    </div>
    <div class="chunks">${chunks}</div>
    ${whys ? `<ul class="whys">${whys}</ul>` : ''}
    ${word || (s.words.length ? '<p class="tip">下線のある単語をタップすると意味が出て、単語帳に入ります。</p>' : '')}
  </div>`;
}

function viewCard(c, isWalk) {
  const s = c.s, q = s.question;
  const head = isWalk
    ? `<div class="prog"><button class="link" data-act="back">← 戻る</button><span>${SHELF_LABEL[s.shelf]}</span></div>`
    : `<div class="prog"><span><span class="dots" aria-label="${ses.i + 1} / ${ses.list.length}">${ses.list.map((_, i) => `<i class="${i < ses.i ? 'done' : i === ses.i ? 'now' : ''}"></i>`).join('')}</span>${c.mode === 'listen' ? '聞く' : SHELF_LABEL[s.shelf]}</span><button class="link" data-act="end">ここでやめる</button></div>`;
  let sentence;
  if (c.revealed) {
    sentence = `<div class="enrow"><button class="en" data-act="break" aria-expanded="${c.open}">${esc(s.en)}</button>
      <button class="icon" data-act="speak" aria-label="読み上げる" title="読み上げる">♪</button></div>
      ${!c.open ? '<p class="tip">文をタップすると骨組みに分かれます。見てから答えても大丈夫です。</p>' : ''}
      ${c.open ? viewBreak(c) : ''}`;
  } else {
    sentence = `<div class="listen">
      <button class="play" data-act="speak">▶　もう一度聞く</button>
      <button class="ghost" data-act="speak-slow">ゆっくり</button>
      <button class="ghost" data-act="reveal">英文を見る</button>
      <p class="tip">${c.audioFailed ? '音声を再生できませんでした。この回は聴解の記録には数えません。英文を見て進めても大丈夫です。' : '英文を見てから答えると「解説後」として記録されます。それで構いません。'}</p></div>`;
  }
  const choices = c.order.map((i) => {
    const cls = c.answered ? (i === q.answer ? ' right' : i === c.choice ? ' picked' : ' rest') : '';
    return `<button class="choice${cls}" data-act="choose" data-i="${i}" ${c.answered ? 'disabled' : ''}>${esc(q.choices[i])}</button>`;
  }).join('');
  let after = '';
  if (c.answered) {
    const verdict = c.correct ? '合っています。' : c.choice < 0 ? 'ここで分かれば十分です。' : `答えは「${esc(q.choices[q.answer])}」でした。`;
    const tags = s.grammar.map((g) => { const it = D.grammar.items.find((x) => x.id === g); return it ? `<a class="tag" href="#map/${g}">${esc(it.name)}</a>` : ''; }).join('');
    after = `<div class="after ${c.correct ? 'ok' : ''}">
      <p class="verdict">${verdict}</p>
      <p>${esc(q.explain)}</p>
      <dl><dt>訳</dt><dd>${esc(s.ja)}</dd>
      <dt>この文で分かること</dt><dd>${esc(s.aim)}</dd>
      <dt>誤解しやすい点</dt><dd>${esc(s.pitfall)}</dd></dl>
      <div class="tags">${tags}</div>
      <p class="tip">記録：${c.mode === 'listen' ? '聞く' : '読む'}・${c.helped ? '解説を見てから回答' : c.mode === 'listen' && !c.heard ? '音声が出なかったので、聴解には数えません' : '自力で回答'}</p>
      <button class="primary" data-act="next">${isWalk ? '戻る' : ses.i + 1 < ses.list.length ? '次の文へ' : '終わる'}</button>
    </div>`;
  }
  return `<article class="card">${head}
    ${s.scene ? `<p class="scene">${esc(s.scene)}</p>` : ''}
    ${sentence}
    <div class="qa"><p class="ask">${esc(q.ask)}</p>
      <div class="choices">${choices}</div>
      ${c.answered ? '' : '<button class="idk" data-act="idk">まだ分からない</button>'}
    </div>${after}</article>`;
}

// ---------- 今日 ----------
function viewHome() {
  const shelf = S.settings.shelf;
  const plan = L.buildSession(D, S, { mode: 'read', shelf });
  const lplan = L.buildSession(D, S, { mode: 'listen', shelf });
  const o = L.overview(D, S);
  const today = L.dayOf(Date.now());
  const doneToday = S.events.filter((e) => e.correct != null && L.dayOf(e.t) === today).length;
  const chips = ['both', 'read', 'talk'].map((v) => `<button data-act="shelf" data-v="${v}" class="${shelf === v ? 'on' : ''}">${SHELF_LABEL[v]}</button>`).join('');
  const hasAudio = englishVoices().length > 0 || D.audio.size > 0;
  const und = L.understood(D, S).length;
  // 入口のタイル。off のときは理由を出す（押せない）
  const entry = (act, emoji, title, desc, note, off) => {
    const inner = `<i>${emoji}</i><b>${title}</b><span>${desc}</span><small>${note}</small>`;
    return off ? `<div class="entry off">${inner}</div>` : act[0] === '#' ? `<a class="entry" href="${act}">${inner}</a>` : `<button class="entry" data-act="${act}">${inner}</button>`;
  };
  const entries = entry('start-listen', '🎧', '聞く', '読んだ文を、耳だけで', !hasAudio ? '英語の声が必要です' : lplan.list.length ? `${lplan.list.length} 文` : '何文か読むと開きます', !hasAudio || !lplan.list.length)
    + entry('start-make', '🧩', '作る', '日本語から英語を組み立てる', und ? `${und} 文から` : '読んで正解すると開きます', !und)
    + entry('start-slide', '🌊', '流す', '分かった文をテンポよく眺める', und ? `${und} 文から` : '読んで正解すると開きます', !und)
    + entry('#play', '🎛️', 'いじる', '主語や時を替えて、形の変化を見る', 'いつでも', false);
  return `<section class="hero">
      <p class="kicker">${doneToday ? `今日は ${doneToday} 文に答えました` : '今日の分'}</p>
      <h2>${plan.list.length} つの文を読む</h2>
      <p class="sub">復習 ${plan.info.review}　・　新しい文 ${plan.info.fresh}<br>答えるだけなら2〜3分。解説は好きなだけ読めます。</p>
      <button class="primary" data-act="start-read">読みはじめる</button>
      <div class="seg shelf" role="group" aria-label="棚">${chips}</div>
    </section>
    <h3 class="lh">ほかの入口</h3>
    <p class="tip">どれも、やってもやらなくても大丈夫です。${hasAudio ? '' : NO_VOICE}</p>
    <div class="entries">${entries}</div>
    <section class="panel quiet"><p>これまでに出会った文　${o.seenCount} / ${D.sentences.length}　　単語帳　${Object.keys(S.words).length} 語</p>
      <p><a href="#map">文法の地図を歩く →</a></p></section>`;
}

function viewDone() {
  return `<section class="hero">
      <p class="kicker">おつかれさまでした ✨</p>
      <h2>${ses.count} 文${ses.mode === 'make' ? 'を組み立てました' : 'に答えました'}</h2>
      <p class="sub">ここで終わって大丈夫です。<br>続けたいときは、好きなところへどうぞ。</p>
      <button class="primary" data-act="start-read">もう少し読む</button>
      <div class="row"><a class="ghost" href="#map">地図を歩く</a><a class="ghost" href="#words">単語帳</a><button class="ghost" data-act="home">ホームへ</button></div>
    </section>`;
}

// ---------- 作る入口 ----------
// 理解できた文を、日本語の場面から英語に組み立てる。判定は読解・聴解には数えない。
function newMake(s) {
  const texts = s.chunks.map((c) => c.text);
  // 文頭の大文字で先頭が分かってしまわないよう、小文字にする（I は除く）
  if (!/^I\b/.test(texts[0])) texts[0] = texts[0].charAt(0).toLowerCase() + texts[0].slice(1);
  const tiles = texts.map((text, key) => ({ text, key }));
  const same = () => tiles.every((t, i) => t.text === texts[i]);
  for (let n = 0; n < 8 && (n === 0 || (same() && tiles.length > 1)); n++) {
    for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
  }
  // answered / viewLogged は、読むカード用の記録処理（logView など）が働かないようにするため
  return { s, mode: 'make', texts, tiles, placed: [], tries: 0, wrong: false, how: 'order', revealed: false, recorded: false, gaveUp: false, answered: true, viewLogged: true, word: null, open: true, t0: Date.now() };
}

function recordMake(c, correct) {
  if (c.recorded) return;
  c.recorded = true;
  S.events.push({ t: Date.now(), sid: c.s.id, mode: 'make', helped: false, correct, choice: null, ms: Date.now() - c.t0, how: c.how });
  persist();
  if (ses && ses.card === c) ses.count++;
}

function startMake() {
  leaveCard();
  const list = L.makeSession(D, S);
  if (!list.length) { toast('まず何文か読んで正解すると、作る入口が開きます。'); return; }
  slide = null;
  ses = { mode: 'make', list, i: 0, count: 0, card: newMake(list[0]) };
  location.hash = '#today';
  render(true);
}

function viewMake(c) {
  const s = c.s;
  const dots = ses.list.map((_, i) => `<i class="${i < ses.i ? 'done' : i === ses.i ? 'now' : ''}"></i>`).join('');
  let body;
  if (!c.revealed && c.how === 'order') {
    const placed = c.placed.map((k, i) => {
      const t = c.tiles.find((x) => x.key === k);
      const bad = c.wrong && t.text !== c.texts[i];
      return `<button class="tile2${bad ? ' bad' : ''}" data-act="untile" data-k="${k}">${esc(t.text)}</button>`;
    }).join('');
    const bank = c.tiles.filter((t) => !c.placed.includes(t.key)).map((t) => `<button class="tile2" data-act="tile" data-k="${t.key}">${esc(t.text)}</button>`).join('');
    body = `<div class="slots">${placed || '<span class="tip">下のかたまりを、言う順にタップして並べます。</span>'}</div>
      <div class="bank">${bank}</div>
      ${c.wrong ? `<p class="tip">お手本の順と違うところが、点線になっています。「いつ・どこで」のようなかたまりは、別の位置でも正しい英語になることがあります。お手本の順を試すなら、タップで外して入れ替えるか、最初から並べ直せます。</p>
        <div class="row"><button class="ghost" data-act="make-retry">最初から並べる</button><button class="ghost" data-act="make-reveal">正解を見る</button></div>` : ''}
      <button class="idk" data-act="make-how" data-v="recall">並べ替えずに、頭の中で言ってから正解を見る</button>`;
  } else if (!c.revealed) {
    body = `<p>頭の中で（声に出しても）、英語にしてみてください。言えなくても大丈夫です。</p>
      <button class="primary" data-act="make-reveal">正解を見る</button>
      <button class="idk" data-act="make-how" data-v="order">やっぱり、並べ替えで作る</button>`;
  } else {
    const ask = c.how === 'recall' && !c.recorded;
    const verdict = c.how === 'recall' ? (ask ? '' : '記録しました。') : c.gaveUp ? 'ここで形を見ておけば十分です。' : c.tries === 0 ? '一度で組み立てられました。' : 'お手本の順に組み立てられました。';
    body = `<div class="enrow"><p class="en">${esc(s.en)}</p><button class="icon" data-act="speak" aria-label="読み上げる" title="読み上げる">♪</button></div>
      ${viewBreak(c)}
      <div class="after ${!c.gaveUp && c.how === 'order' ? 'ok' : ''}">
        ${ask ? `<p class="ask">言えましたか？</p>
          <div class="row"><button class="ghost" data-act="self" data-v="yes">言えた</button><button class="ghost" data-act="self" data-v="almost">だいたい</button><button class="ghost" data-act="self" data-v="no">まだ</button></div>
          <p class="tip">判定はしません。自分のための記録です。</p>`
        : `<p class="verdict">${verdict}</p><button class="primary" data-act="next">${ses.i + 1 < ses.list.length ? '次の文へ' : '終わる'}</button>`}
      </div>`;
  }
  return `<article class="card"><div class="prog"><span><span class="dots">${dots}</span>作る</span><button class="link" data-act="end">ここでやめる</button></div>
    ${s.scene ? `<p class="scene">${esc(s.scene)}</p>` : ''}
    <p class="jabig">${esc(s.ja)}</p>${body}</article>`;
}

// ---------- 流して読む ----------
// 理解できた文だけを、自分で選んだテンポで流す。判定も記録もしない。
function startSlide() {
  leaveCard();
  const pool = L.understood(D, S);
  if (!pool.length) { toast('まず何文か読んで正解すると、流して読めるようになります。'); return; }
  const list = [...pool].sort(() => Math.random() - 0.5).slice(0, 20);
  ses = null;
  slide = { list, i: 0, sec: S.settings.slideSec || 3, paused: false, done: false };
  location.hash = '#today';
  render(true);
  slideTick();
}

function slideTick() {
  clearTimeout(slideTimer);
  if (!slide || slide.paused || slide.done) return;
  slideTimer = setTimeout(() => {
    if (!slide) return;
    if (slide.i + 1 >= slide.list.length) slide.done = true; else slide.i++;
    render();
    slideTick();
  }, slide.sec * 1000);
}

function viewSlide() {
  if (slide.done) return `<section class="hero"><p class="kicker">ひとまわりしました ✨</p><h2>${slide.list.length} 文を眺めました</h2>
    <button class="primary" data-act="start-slide">もう一度流す</button>
    <div class="row"><button class="ghost" data-act="slide-end">ホームへ</button></div></section>`;
  const s = slide.list[slide.i];
  const secs = [2, 3, 5, 8].map((n) => `<button data-act="slide-sec" data-v="${n}" class="${slide.sec === n ? 'on' : ''}">${n}秒</button>`).join('');
  return `<article class="slide" style="--sec:${slide.sec}">
    <div class="prog"><span>流して読む　${slide.i + 1} / ${slide.list.length}</span><button class="link" data-act="slide-end">終わる</button></div>
    <div class="stage"><p class="en">${esc(s.en)}</p><p class="ja">${esc(s.ja)}</p></div>
    <div class="row center"><button class="ghost" data-act="slide-step" data-v="-1">← 前</button>
      <button class="ghost" data-act="slide-pause">${slide.paused ? '▶ 再開' : '⏸ 止める'}</button>
      <button class="ghost" data-act="slide-step" data-v="1">次 →</button></div>
    <div class="row center"><div class="seg">${secs}</div></div>
    ${slide.paused ? `<p class="center"><a href="#s/${s.id}">この文を分解して見る →</a></p>` : ''}
    <p class="tip center">判定も記録もありません。眺めるだけで大丈夫です。訳は少し遅れて出ます。</p></article>`;
}

// ---------- いじれる例文 ----------
function viewPlay() {
  if (!D.play) return '<p><a href="#map">← 地図</a></p><p>いじれる例文のデータを読み込めませんでした。</p>';
  const v = D.play.verbs.find((x) => x.id === play.v) || D.play.verbs[0];
  const subj = SUBJECTS.find((x) => x.id === play.s) || SUBJECTS[0];
  const r = buildPlay(v, subj, play.t, play.f);
  const seg = (list, k) => `<div class="seg">${list.map(([id, name]) => `<button data-act="play" data-k="${k}" data-v="${id}" class="${play[k] === id ? 'on' : ''}">${name}</button>`).join('')}</div>`;
  const chips = (list, k) => `<div class="chips">${list.map(([id, name]) => `<button data-act="play" data-k="${k}" data-v="${id}" class="${play[k] === id ? 'on' : ''}">${esc(name)}</button>`).join('')}</div>`;
  const verbs = (kind) => chips(D.play.verbs.filter((x) => x.kind === kind).map((x) => [x.id, x.label]), 'v');
  const parts = r.parts.map((p) => `<div class="chunk role-${p.role}"><span class="lab">${esc(p.lab) || '&nbsp;'}</span><span class="tx">${esc(p.t)}</span></div>`).join('');
  const links = r.links.map((g) => { const it = D.grammar.items.find((x) => x.id === g); return it ? `<a class="tag" href="#map/${g}">${esc(it.name)}</a>` : ''; }).join('');
  return `<p><a href="#map">← 地図</a></p>
    <header class="vh"><h2>いじれる例文</h2><p>主語・時・形を切り替えると、文が変わります。どの部品が動いたかを見てください。</p></header>
    <div class="break playbox">
      <div class="enrow"><p class="en">${esc(r.en)}</p><button class="icon" data-act="play-speak" aria-label="読み上げる" title="読み上げる">♪</button></div>
      <div class="chunks">${parts}</div>
      <p class="playja">${esc(r.ja)}</p>
      <ul class="whys">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    </div>
    <p class="lab2">形</p>${seg(FORMS, 'f')}
    <p class="lab2">時</p>${seg(TENSES, 't')}
    <p class="lab2">主語</p>${chips(SUBJECTS.map((x) => [x.id, x.en]), 's')}
    <p class="lab2">be動詞</p>${verbs('be')}
    <p class="lab2">ふつうの動詞（規則どおりに変わる）</p>${verbs('regular')}
    <p class="lab2">不規則動詞（過去形が特別な形）</p>${verbs('irregular')}
    <p class="lab2">くわしい説明</p><div class="tags">${links}</div>
    <p class="tip">おすすめの見方：「過去」にして、「肯定」と「否定」を行き来してみてください。went が didn't go に変わるように、過去の印が動詞から did へ移るのが見えます。</p>`;
}

// ---------- 地図 ----------
function viewMap() {
  const { H } = L.overview(D, S);
  const mark = (st, ch) => `<i class="mk ${st}">${ch}</i>`;
  const groups = D.grammar.groups.map((g) => {
    const tiles = D.grammar.items.filter((it) => it.group === g.id).map((it) => {
      const h = H.g[it.id] || {};
      const r = L.status(h.read), l = L.status(h.listen);
      return `<a class="tile" href="#map/${it.id}"><span class="tn">${esc(it.name)}</span><span class="tp">${esc(it.pattern)}</span>
        <span class="marks" aria-label="読解：${READ_LABEL[r]}、聴解：${LISTEN_LABEL[l]}">${mark(r, '読')}${mark(l, '聴')}</span></a>`;
    }).join('');
    return `<section class="grp"><h3>${esc(g.name)}</h3><p class="gnote">${esc(g.note)}</p><div class="tiles">${tiles}</div></section>`;
  }).join('');
  return `<header class="vh"><h2>文法の地図</h2>
      <p>中学で習う文法の全体です。順番はありません。気になったところから入ってください。</p>
      <p><a class="ghost" href="#play">🎛️ いじれる例文</a></p>
      <p class="legend"><i class="mk none">読</i>未探索・未測定　<i class="mk learning">読</i>勉強中　<i class="mk solid">読</i>分かる　（読解と聴解は別々に記録）</p>
    </header>${groups}`;
}

function viewGrammar(id) {
  const it = D.grammar.items.find((x) => x.id === id);
  if (!it) return '<p>この項目は見つかりません。</p><p><a href="#map">← 地図へ</a></p>';
  const { H } = L.overview(D, S);
  const h = H.g[id] || {};
  const line = (list) => {
    const c = L.counts(list);
    const f = (k, name) => (c[k][1] ? `${name} ${c[k][0]}/${c[k][1]}` : null);
    return [f('first', '初見'), f('assisted', '解説後'), f('delayed', '数日後の初見'), f('revisit', '久しぶりの文'), f('other', 'そのほか')].filter(Boolean).join('　・　');
  };
  const r = L.status(h.read), l = L.status(h.listen);
  // まだ出会っていない文の英文は、ここには並べない（先に見てしまうと、初見として確かめられなくなるため）
  const all = D.byGrammar[id] || [];
  const met = all.filter((s) => H.bySid[s.id]);
  const n = all.length;
  const list = met.map((s) => `<li><a href="#s/${s.id}">${esc(s.en)}</a><small>${SHELF_LABEL[s.shelf]}</small></li>`).join('')
    + (n > met.length ? `<li><small>まだ出会っていない文が ${n - met.length} 本あります。上の「この項目の文を読む」から読めます。残りが少ない項目は、1日に全部は出さず、日を空けて出します（初めて見る文で確かめるためです）。</small></li>` : '');
  return `<p><a href="#map">← 地図</a></p>
    <header class="vh"><h2>${esc(it.name)}</h2><p class="pattern">${esc(it.pattern)}</p></header>
    ${D.play && ['be', 'verb', 's3', 'past', 'future', 'negative', 'question'].includes(id) ? '<p><a href="#play">🎛️ いじれる例文で、形の変化を確かめる →</a></p>' : ''}
    <div class="status2">
      <div><b>読解</b><span class="st ${r}">${READ_LABEL[r]}</span><small>${line(h.read) || 'まだ記録がありません'}</small></div>
      <div><b>聴解</b><span class="st ${l}">${LISTEN_LABEL[l]}</span><small>${line(h.listen) || '音声で確かめた記録がまだありません（読解からは推測しません）'}</small></div>
    </div>
    <section class="prose"><h3>どういう意味で、いつ使うか</h3>${paras(it.what)}
      <h3>なぜこの形なのか</h3>${paras(it.why)}</section>
    ${n ? `<button class="primary" data-act="start-focus" data-g="${id}">この項目の文を読む</button>
      <h3 class="lh">この項目を含む文（${n}）</h3><ul class="slist">${list}</ul>` : '<p class="tip">この項目の文はまだ準備中です。</p>'}
    <p class="tip">「分かる」は、日を空けて別の文に自力で正解したことが、別々の日に${L.SOLID_MIN}回あって初めて付きます（うち1回以上は、初めて見る文）。一度の正解では付きません。解説を読んだその日の正解や、解説を見てからの正解は数えません。反応時間は判定に使いません。</p>`;
}

// ---------- 単語帳 ----------
function viewWords() {
  const lemmas = Object.keys(S.words).sort((a, b) => S.words[b].addedAt - S.words[a].addedAt);
  if (!lemmas.length) return `<header class="vh"><h2>単語帳</h2></header>
    <p>まだ空です。文を分解して、下線のある単語をタップすると、出会った文と一緒にここにたまります。</p>
    <p>たまった単語には、数日後に別の文の中でもう一度出会います。</p>`;
  const { H } = L.overview(D, S);
  const today = L.dayOf(Date.now());
  const items = lemmas.map((lemma) => {
    const e = S.words[lemma];
    const wi = L.wordInfo(lemma, e, D, H.bySid);
    const means = new Set();
    const met = (e.metIn || []).map((sid) => {
      const s = D.byId[sid];
      if (!s) return '';
      s.words.filter((w) => w.lemma === lemma).forEach((w) => means.add(w.ja));
      return `<li><a href="#s/${sid}">${esc(s.en)}</a><small>${esc(s.ja)}</small></li>`;
    }).join('');
    const re = wi.reunions.map((r) => D.byId[r.sid]).filter(Boolean).map((s) => `<li><a href="#s/${s.id}">${esc(s.en)}</a><small>別の文で再会</small></li>`).join('');
    if (!means.size && e.ja) means.add(e.ja);
    const next = wi.candidates.length ? (wi.due <= today ? '次の「読む」で、別の文の中に出てきます。' : `あと ${wi.due - today} 日ほどで、別の文の中に出てきます。`) : 'この単語を含む別の文は、今のところありません。';
    return `<li class="word"><div class="wh"><b>${esc(lemma)}</b><span>${esc([...means].join(' ／ '))}</span>
      <button class="link" data-act="rm-word" data-l="${esc(lemma)}">外す</button></div>
      <ul class="slist">${met}${re}</ul><p class="tip">${next}</p></li>`;
  }).join('');
  return `<header class="vh"><h2>単語帳</h2><p>${lemmas.length} 語。出会った文と一緒に残っています。</p></header><ul class="words">${items}</ul>`;
}

// ---------- 記録 ----------
function viewMe() {
  const o = L.overview(D, S);
  const answered = S.events.filter((e) => e.correct != null);
  const chips = ['both', 'read', 'talk'].map((v) => `<button data-act="shelf" data-v="${v}" class="${S.settings.shelf === v ? 'on' : ''}">${SHELF_LABEL[v]}</button>`).join('');
  const rates = [[0.75, 'ゆっくり'], [0.9, 'ふつう'], [1.05, '速め']].map(([v, n]) => `<button data-act="rate" data-v="${v}" class="${S.settings.rate === v ? 'on' : ''}">${n}</button>`).join('');
  const voices = voiceChoices(), auto = autoVoice();
  const probs = D.problems.length ? `<p class="tip">読み込めなかった文が ${D.problems.length} 件あります：${D.problems.map((p) => esc(p.id + '（' + p.problems[0] + '）')).join('、')}</p>` : '';
  return `<header class="vh"><h2>記録</h2></header>
    <section class="panel"><p>出会った文　${o.seenCount} / ${D.sentences.length}<br>答えた回数　${answered.filter((e) => e.mode === 'read' || e.mode === 'listen').length}（読む ${answered.filter((e) => e.mode === 'read').length}・聞く ${answered.filter((e) => e.mode === 'listen').length}）　　組み立てた回数　${S.events.filter((e) => e.mode === 'make').length}<br>単語帳　${Object.keys(S.words).length} 語</p></section>
    <section class="panel"><h3>設定</h3>
      <p class="lab2">見た目</p><div class="seg">${[['light', '明るい'], ['dark', '暗い'], ['auto', '端末に合わせる']].map(([v, n]) => `<button data-act="theme" data-v="${v}" class="${(S.settings.theme || 'light') === v ? 'on' : ''}">${n}</button>`).join('')}</div>
      <p class="lab2">今日の分に出す棚</p><div class="seg">${chips}</div>
      <p class="lab2">読み上げの速さ</p><div class="seg">${rates}</div>
      <p class="lab2">読み上げの声</p>
      ${voices.length ? `<select id="voice" aria-label="読み上げの声"><option value="">おまかせ${auto ? '（' + esc(voiceLabel(auto)) + '）' : ''}</option>${voices.map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === S.settings.voice ? 'selected' : ''}>${esc(voiceLabel(v))}</option>`).join('')}</select>
      <div class="row"><button class="ghost" data-act="voice-test">この声を聞いてみる</button></div>
      <p class="tip">${IS_ANDROID ? 'この端末（Android）では、声そのものは端末の設定で決まり、ここで選べるのは発音の地域です。声を替えたいときは、端末の「設定」で「テキスト読み上げ」を探し、音声エンジン（Google の音声サービスなど）の設定から、英語の声を選びます。場所は機種によって少し違います。' : '声の種類と自然さは、ブラウザと端末で変わります。名前に Natural や Google と付く声は、比較的なめらかです。'}</p>` : `<p class="tip">${NO_VOICE}</p>`}
      <p class="lab2">正解のときの音</p><div class="seg"><button data-act="sound" data-v="1" class="${S.settings.sound ? 'on' : ''}">鳴らす</button><button data-act="sound" data-v="0" class="${S.settings.sound ? '' : 'on'}">鳴らさない</button></div>
    </section>
    <section class="panel"><h3>記録の引き継ぎ</h3>
      <p>記録はこの端末の中だけにあります。別の端末へ移すとき、または控えを取るときに使います。</p>
      <p class="tip">${persisted === true ? 'この端末は、この記録を「自動では消さないもの」として扱っています。' : persisted === false ? 'この端末は、空き容量がひどく足りなくなったときに、この記録を消すことがあります。ホーム画面に追加して使うと、消されにくくなります。' : ''}
        しばらく使わないだけで消えることはありません。消えるのは、ブラウザの「サイトのデータを削除」をしたときや、アプリを消したときです。ときどき控えを取っておくと安心です。</p>
      <p class="tip">${S.settings.exportedAt ? '最後に控えを取った日：' + new Date(S.settings.exportedAt).toLocaleDateString('ja-JP') + '（そのあとの記録 ' + S.events.filter((e) => e.t > S.settings.exportedAt).length + ' 件）' : S.events.length ? 'まだ控えを取っていません。' : ''}</p>
      ${persisted === false ? '<div class="row"><button class="ghost" data-act="keep">消さないよう、端末に頼む</button></div>' : ''}
      <div class="row"><button class="ghost" data-act="export">ファイルに書き出す</button><button class="ghost" data-act="export-show">文字で表示</button></div>
      ${exportShown ? `<textarea id="exp" readonly rows="5">${esc(store.exportText(S))}</textarea>` : ''}
      <p class="lab2">読み込む（今ある記録は消えず、合流します）</p>
      <div class="row"><label class="ghost filebtn">ファイルを選ぶ<input type="file" id="imp" accept=".json,application/json"></label></div>
      <textarea id="imptext" rows="3" placeholder="または、書き出した文字をここに貼る"></textarea>
      <div class="row"><button class="ghost" data-act="import-text">貼った文字を読み込む</button></div>
    </section>
    <section class="panel"><h3>教材</h3>
      <p>文 ${D.sentences.length} 本・文法 ${D.grammar.items.length} 項目。一度開いた教材は端末に保存され、オフラインでも読めます。</p>${probs}
      <div class="row"><button class="ghost" data-act="refresh">教材の更新を確認</button></div></section>
    <section class="panel quiet"><div class="row"><button class="link danger" data-act="reset">この端末の記録をすべて消す</button></div>
      <p class="tip">記録の形式 v${store.VERSION}</p></section>`;
}

// ---------- 表示の切り替え ----------
function render(top) {
  const [name, arg] = (location.hash.slice(1) || 'today').split('/');
  if (name !== 's' && walk) { logView(walk.card); walk = null; }
  let html;
  if (name === 'map') {
    if (arg && D.grammar.items.some((x) => x.id === arg)) noteGrammar(arg);
    html = arg ? viewGrammar(arg) : viewMap();
  }
  else if (name === 'words') html = viewWords();
  else if (name === 'me') html = viewMe();
  else if (name === 's') {
    const s = D.byId[arg];
    if (!s) html = '<p>この文は見つかりません。</p><p><a href="#map">← 地図へ</a></p>';
    else {
      if (!walk || walk.card.s.id !== arg) { if (walk) logView(walk.card); walk = { card: newCard(s, 'read') }; }
      html = viewCard(walk.card, true);
    }
  } else if (name === 'play') html = viewPlay();
  else if (slide) html = viewSlide();
  else html = ses ? (ses.i < ses.list.length ? (ses.mode === 'make' ? viewMake(ses.card) : viewCard(ses.card, false)) : viewDone()) : viewHome();
  // 流して読む途中で別の画面へ行ったら、止めておく
  if (slide && ['map', 'words', 'me', 's', 'play'].includes(name) && !slide.paused) { slide.paused = true; clearTimeout(slideTimer); }
  $view.innerHTML = html;
  const tab = name === 's' || name === 'play' ? 'map' : ['map', 'words', 'me'].includes(name) ? name : 'today';
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  if (top) window.scrollTo(0, 0);
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function doImport(text) {
  let r;
  try { r = store.importText(text, S); } catch (err) { toast(err.message); return; }
  const before = S;
  S = r.state;
  if (!store.save(S)) {
    S = before; // 保存できなかったら、取り込んだことにしない
    toast('読み込んだ記録を、この端末に保存できませんでした。空き容量を確認して、もう一度試してください。');
    return;
  }
  toast(`読み込みました（記録 ${r.added} 件・単語 ${r.addedWords} 語を追加）`);
  render();
}

async function checkUpdate(manual) {
  try {
    if (manual && !navigator.onLine) { toast('オフラインのため確認できません。保存済みの教材で動いています。'); return; }
    const r = await refreshData(D);
    if (r.data) {
      D = r.data; // 進行中のカードは手元の文をそのまま使い続ける
      toast(r.saved ? '教材を更新しました。' : '教材を更新しました（端末には保存できなかったので、オフラインでは前の版が開きます）。');
      if (!activeCard()) render();
    } else if (manual) toast(r.verified ? '教材は最新です。' : '最新かどうか確認できませんでした。保存済みの教材で使えます。');
  } catch { if (manual) toast('確認できませんでした。保存済みの教材で使えます。'); }
}

const ACTIONS = {
  'start-read': () => startSession({ mode: 'read' }),
  'start-listen': () => startSession({ mode: 'listen' }),
  'start-focus': (el) => startSession({ mode: 'read', focus: el.dataset.g }),
  home: () => { leaveCard(); ses = null; render(true); },
  end: () => { logView(ses.card); ses = ses.count ? { ...ses, i: ses.list.length } : null; render(true); },
  'start-make': () => startMake(),
  tile: (el, c) => {
    c.placed.push(+el.dataset.k);
    if (c.placed.length === c.tiles.length) {
      const ok = c.placed.every((k, i) => c.tiles.find((t) => t.key === k).text === c.texts[i]);
      if (ok) { c.revealed = true; c.wrong = false; recordMake(c, c.tries === 0 ? true : null); chime(); } // お手本と違う順を経た回は、正誤を付けない
      else { c.wrong = true; c.tries++; }
    }
    render();
  },
  untile: (el, c) => { c.placed = c.placed.filter((k) => k !== +el.dataset.k); c.wrong = false; render(); },
  'make-retry': (el, c) => { c.placed = []; c.wrong = false; render(); },
  'make-how': (el, c) => { c.how = el.dataset.v; c.placed = []; c.wrong = false; render(); },
  'make-reveal': (el, c) => { c.revealed = true; if (c.how === 'order') { c.gaveUp = true; recordMake(c, false); } render(); },
  self: (el, c) => { recordMake(c, el.dataset.v === 'yes' ? true : el.dataset.v === 'no' ? false : null); if (el.dataset.v === 'yes') chime(); render(); },
  'start-slide': () => startSlide(),
  'slide-end': () => { clearTimeout(slideTimer); slide = null; render(true); },
  'slide-pause': () => { slide.paused = !slide.paused; render(); slideTick(); },
  'slide-step': (el) => { slide.i = Math.max(0, Math.min(slide.list.length - 1, slide.i + +el.dataset.v)); render(); slideTick(); },
  'slide-sec': (el) => { slide.sec = +el.dataset.v; S.settings.slideSec = slide.sec; persist(); render(); slideTick(); },
  play: (el) => { play[el.dataset.k] = el.dataset.v; render(); },
  'play-speak': () => {
    const v = D.play.verbs.find((x) => x.id === play.v) || D.play.verbs[0];
    speak({ en: buildPlay(v, SUBJECTS.find((x) => x.id === play.s) || SUBJECTS[0], play.t, play.f).en, audioId: '' }, false, null);
  },
  back: () => { history.length > 1 ? history.back() : (location.hash = '#map'); },
  break: (el, c) => { c.open = !c.open; if (c.open) markHelped(c); render(); },
  labels: (el) => { S.settings.labels = el.dataset.v; persist(); render(); },
  word: (el, c) => {
    const w = c.s.words[+el.dataset.i];
    c.word = +el.dataset.i;
    markHelped(c);
    const e = (S.words[w.lemma] ||= { addedAt: Date.now(), metIn: [], ja: w.ja });
    if (!e.metIn.includes(c.s.id)) e.metIn.push(c.s.id);
    persist();
    render();
  },
  unword: (el, c) => {
    const w = c.s.words[c.word], e = S.words[w.lemma];
    if (e) { e.metIn = e.metIn.filter((x) => x !== c.s.id); if (!e.metIn.length) { delete S.words[w.lemma]; S.gone[w.lemma] = Date.now(); } }
    c.word = null;
    persist(true);
    render();
  },
  'rm-word': (el) => { delete S.words[el.dataset.l]; S.gone[el.dataset.l] = Date.now(); persist(true); render(); },
  choose: (el, c) => { answer(c, +el.dataset.i); render(); },
  idk: (el, c) => { answer(c, -1); render(); },
  reveal: (el, c) => { c.revealed = true; markHelped(c); render(); },
  speak: (el, c) => speak(c.s, false, c),
  'speak-slow': (el, c) => speak(c.s, true, c),
  'voice-test': () => speak({ en: 'Nice to meet you. This is how I sound.', audioId: '' }, false, null),
  next: (el, c) => {
    if (walk) { ACTIONS.back(); return; }
    ses.i++;
    if (ses.i < ses.list.length) { ses.card = ses.mode === 'make' ? newMake(ses.list[ses.i]) : newCard(ses.list[ses.i], ses.mode); render(true); if (ses.mode === 'listen') speak(ses.card.s, false, ses.card); }
    else render(true);
  },
  shelf: (el) => { S.settings.shelf = el.dataset.v; persist(); render(); },
  rate: (el) => { S.settings.rate = +el.dataset.v; persist(); render(); },
  sound: (el) => { S.settings.sound = el.dataset.v === '1'; persist(); render(); if (S.settings.sound) chime(); },
  export: () => { download('fathom-progress-' + new Date().toISOString().slice(0, 10) + '.json', store.exportText(S)); S.settings.exportedAt = Date.now(); persist(); render(); },
  theme: (el) => { S.settings.theme = el.dataset.v; persist(); applyTheme(); render(); },
  keep: async () => { await checkPersisted(true); toast(persisted ? '端末が、この記録を自動では消さない扱いにしました。' : '今は受け付けてもらえませんでした。ホーム画面に追加して何日か使うと、通りやすくなります。'); render(); },
  'export-show': () => { exportShown = !exportShown; render(); },
  'import-text': () => { const t = document.getElementById('imptext').value.trim(); if (t) doImport(t); else toast('貼り付け欄が空です。'); },
  refresh: () => checkUpdate(true),
  reset: () => {
    if (!confirm('この端末の記録（答えた履歴と単語帳）をすべて消します。元に戻せません。先に書き出しておくことをおすすめします。消しますか？')) return;
    store.clearAll();
    S = store.load();
    applyTheme();
    ses = null;
    render(true);
    toast('記録を消しました。');
  },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || !D) return;
  const f = ACTIONS[el.dataset.act];
  if (f) f(el, activeCard());
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'voice') { S.settings.voice = ev.target.value; persist(); render(); ACTIONS['voice-test'](); return; }
  if (ev.target.id !== 'imp' || !ev.target.files[0]) return;
  ev.target.files[0].text().then(doImport);
});
window.addEventListener('hashchange', () => render(true));
// 画面を閉じる・切り替えるとき、読みかけのカードを「見た」として残す
window.addEventListener('pagehide', () => logView(activeCard()));
// 別のタブやアプリへ移ったら、流して読むのを止める（見ていない間に進めない）。戻ったら「再開」から
const pauseSlide = () => { if (slide && !slide.paused && !slide.done) { slide.paused = true; clearTimeout(slideTimer); if (D) render(); } };
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseSlide(); });
window.addEventListener('pagehide', pauseSlide);
// 別の画面（別タブ、ホーム画面のアプリ）で記録が変わったら、こちらも読み直す
window.addEventListener('storage', (ev) => {
  if (ev.key !== store.KEY || !D) return;
  // 全消去（newValue が無い）はそのまま従う。それ以外は、こちらでまだ保存できていない記録を落とさないよう、合わせる
  S = ev.newValue == null ? store.load() : store.merge(store.load(), S);
  applyTheme();
  if (!activeCard()) render();
});
// 声の一覧は遅れて届くことがある。届いたら、声に関わる画面を描き直す
if (canSpeak()) speechSynthesis.addEventListener('voiceschanged', () => { if (D && !activeCard()) render(); });

(async function boot() {
  try {
    D = await loadData();
  } catch (err) {
    $view.innerHTML = `<section class="hero"><h2>教材を読み込めませんでした</h2><p class="sub">最初の一度だけ、ネットにつながった状態で開く必要があります。<br><small>${esc(err.message)}</small></p><button class="primary" onclick="location.reload()">もう一度試す</button></section>`;
    return;
  }
  applyTheme();
  render(true);
  checkUpdate(false);
  checkPersisted(S.events.length > 0).then(() => { if (location.hash === '#me') render(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

// 動作確認用（tests.html やコンソールから使う）
window.fathom = { get state() { return S; }, get data() { return D; }, L, store };
