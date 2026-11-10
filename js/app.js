// 画面。状態は S（学習記録）と D（教材）だけ。表示は毎回それらから作り直す。
import * as store from './store.js';
import { loadData, refreshData, ROLES } from './data.js';
import * as L from './learn.js';

let S = store.load();
let D = null;
let ses = null; // 進行中の1回分 { mode, list, i, card, count }
let walk = null; // 地図や単語帳から開いた1文 { card }
let exportShown = false;

const $view = document.getElementById('view');
const $toast = document.getElementById('toast');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paras = (t) => String(t || '').split('\n').filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
const persist = () => { if (!store.save(S)) toast('保存できませんでした。端末の空き容量を確認してください。'); };

const READ_LABEL = { none: '未探索', learning: '勉強中', solid: '読めば分かる' };
const LISTEN_LABEL = { none: '未測定', learning: '勉強中', solid: '聞いても分かる' };
const SHELF_LABEL = { read: '読む棚', talk: '話す棚', both: '両方' };

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
function speak(s, slow) {
  if (playing) { playing.pause(); playing = null; }
  const tts = () => {
    if (!canSpeak()) { toast('この端末では読み上げが使えません。'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(s.en);
    u.lang = 'en-US';
    u.rate = (S.settings.rate || 0.9) * (slow ? 0.72 : 1);
    const vs = speechSynthesis.getVoices();
    const v = vs.find((x) => /^en[-_]US/i.test(x.lang)) || vs.find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  };
  // 音声ファイルがあればそちらを使う（data/index.json の audio に audioId を載せる）
  if (D.audio.has(s.audioId)) {
    const a = new Audio('audio/' + s.audioId + '.mp3');
    a.playbackRate = slow ? 0.8 : 1;
    playing = a;
    a.play().catch(tts);
  } else tts();
}

// ---------- カード ----------
function newCard(s, mode) {
  const order = s.question.choices.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { s, mode, order, helped: false, open: false, revealed: mode !== 'listen', answered: false, choice: null, correct: null, word: null, logged: false, t0: Date.now() };
}
const activeCard = () => (walk ? walk.card : ses && ses.i < ses.list.length ? ses.card : null);

// 分解などを見たが答えずに離れた場合も「見た」ことは記録する
function logView(c) {
  if (!c || c.logged || !c.helped) return;
  S.events.push({ t: Date.now(), sid: c.s.id, mode: c.mode, helped: true, correct: null, choice: null, ms: null });
  c.logged = true;
  persist();
}

function answer(c, choice) {
  if (c.answered) return;
  c.answered = true;
  c.choice = choice;
  c.correct = choice === c.s.question.answer;
  c.open = true;
  c.revealed = true;
  c.logged = true;
  S.events.push({ t: Date.now(), sid: c.s.id, mode: c.mode, helped: c.helped, correct: c.correct, choice, ms: Date.now() - c.t0 });
  persist();
  if (ses && ses.card === c) ses.count++;
  if (S.events.length === 1 && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (c.correct) chime();
}

function startSession(opts) {
  const mode = opts.mode || 'read';
  const plan = L.buildSession(D, S, { mode, shelf: opts.focus ? 'both' : S.settings.shelf, focus: opts.focus || null });
  if (!plan.list.length) { toast(mode === 'listen' ? 'まず何文か読むと、聞く入口が開きます。' : '文がありません。'); return; }
  ses = { mode, list: plan.list, i: 0, count: 0, card: newCard(plan.list[0], mode) };
  location.hash = '#today';
  render(true);
  if (mode === 'listen') speak(ses.card.s);
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
    : `<div class="prog"><span>${ses.i + 1} / ${ses.list.length}　${c.mode === 'listen' ? '聞く' : SHELF_LABEL[s.shelf]}</span><button class="link" data-act="end">ここでやめる</button></div>`;
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
      <p class="tip">英文を見てから答えると「解説後」として記録されます。それで構いません。</p></div>`;
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
      <p class="tip">記録：${c.mode === 'listen' ? '聞く' : '読む'}・${c.helped ? '解説を見てから回答' : '自力で回答'}</p>
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
  const listen = !canSpeak() ? '<p class="tip">この端末では読み上げが使えないため、聞く入口は開けません。</p>'
    : lplan.list.length ? `<button class="ghost wide" data-act="start-listen">聞いてみる（${lplan.list.length}文）</button>`
    : '<p class="tip">まず何文か読むと開きます。</p>';
  return `<section class="hero">
      <p class="kicker">${doneToday ? `今日は ${doneToday} 文に答えました` : '今日の分'}</p>
      <h2>${plan.list.length} つの文を読む</h2>
      <p class="sub">復習 ${plan.info.review}　・　新しい文 ${plan.info.fresh}<br>2〜3分で終わります。時間制限はありません。</p>
      <button class="primary" data-act="start-read">読みはじめる</button>
      <div class="seg shelf" role="group" aria-label="棚">${chips}</div>
    </section>
    <section class="panel"><h3>聞く入口</h3>
      <p>読んだことのある文を、英文を見ずに耳だけで確かめます。読む記録とは別に残ります。</p>${listen}</section>
    <section class="panel quiet"><p>これまでに出会った文　${o.seenCount} / ${D.sentences.length}　　単語帳　${Object.keys(S.words).length} 語</p>
      <p><a href="#map">文法の地図を歩く →</a></p></section>`;
}

function viewDone() {
  return `<section class="hero">
      <p class="kicker">おつかれさまでした</p>
      <h2>${ses.count} 文に答えました</h2>
      <p class="sub">ここで終わって大丈夫です。<br>続けたいときは、好きなところへどうぞ。</p>
      <button class="primary" data-act="start-read">もう少し読む</button>
      <div class="row"><a class="ghost" href="#map">地図を歩く</a><a class="ghost" href="#words">単語帳</a><button class="ghost" data-act="home">ホームへ</button></div>
    </section>`;
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
    return [f('first', '初見'), f('assisted', '解説後'), f('delayed', '数日後の初見'), f('other', 'そのほか')].filter(Boolean).join('　・　');
  };
  const r = L.status(h.read), l = L.status(h.listen);
  const list = (D.byGrammar[id] || []).map((s) => {
    const seen = H.bySid[s.id];
    return `<li><a href="#s/${s.id}">${esc(s.en)}</a><small>${SHELF_LABEL[s.shelf]}${seen ? '・出会った' : ''}</small></li>`;
  }).join('');
  const n = (D.byGrammar[id] || []).length;
  return `<p><a href="#map">← 地図</a></p>
    <header class="vh"><h2>${esc(it.name)}</h2><p class="pattern">${esc(it.pattern)}</p></header>
    <div class="status2">
      <div><b>読解</b><span class="st ${r}">${READ_LABEL[r]}</span><small>${line(h.read) || 'まだ記録がありません'}</small></div>
      <div><b>聴解</b><span class="st ${l}">${LISTEN_LABEL[l]}</span><small>${line(h.listen) || '音声で確かめた記録がまだありません（読解からは推測しません）'}</small></div>
    </div>
    <section class="prose"><h3>どういう意味で、いつ使うか</h3>${paras(it.what)}
      <h3>なぜこの形なのか</h3>${paras(it.why)}</section>
    ${n ? `<button class="primary" data-act="start-focus" data-g="${id}">この項目の文を読む</button>
      <h3 class="lh">この項目を含む文（${n}）</h3><ul class="slist">${list}</ul>` : '<p class="tip">この項目の文はまだ準備中です。</p>'}
    <p class="tip">「分かる」は、日を空けて別の文に自力で正解したことが、別々の日に${L.SOLID_MIN}回あって初めて付きます。一度の正解では付きません。反応時間は判定に使いません。</p>`;
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
  const probs = D.problems.length ? `<p class="tip">読み込めなかった文が ${D.problems.length} 件あります：${D.problems.map((p) => esc(p.id + '（' + p.problems[0] + '）')).join('、')}</p>` : '';
  return `<header class="vh"><h2>記録</h2></header>
    <section class="panel"><p>出会った文　${o.seenCount} / ${D.sentences.length}<br>答えた回数　${answered.length}（読む ${answered.filter((e) => e.mode !== 'listen').length}・聞く ${answered.filter((e) => e.mode === 'listen').length}）<br>単語帳　${Object.keys(S.words).length} 語</p></section>
    <section class="panel"><h3>設定</h3>
      <p class="lab2">今日の分に出す棚</p><div class="seg">${chips}</div>
      <p class="lab2">読み上げの速さ</p><div class="seg">${rates}</div>
      <p class="lab2">正解のときの音</p><div class="seg"><button data-act="sound" data-v="1" class="${S.settings.sound ? 'on' : ''}">鳴らす</button><button data-act="sound" data-v="0" class="${S.settings.sound ? '' : 'on'}">鳴らさない</button></div>
    </section>
    <section class="panel"><h3>記録の引き継ぎ</h3>
      <p>記録はこの端末の中だけにあります。別の端末へ移すとき、または控えを取るときに使います。</p>
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
  if (name === 'map') html = arg ? viewGrammar(arg) : viewMap();
  else if (name === 'words') html = viewWords();
  else if (name === 'me') html = viewMe();
  else if (name === 's') {
    const s = D.byId[arg];
    if (!s) html = '<p>この文は見つかりません。</p><p><a href="#map">← 地図へ</a></p>';
    else {
      if (!walk || walk.card.s.id !== arg) { if (walk) logView(walk.card); walk = { card: newCard(s, 'read') }; }
      html = viewCard(walk.card, true);
    }
  } else html = ses ? (ses.i < ses.list.length ? viewCard(ses.card, false) : viewDone()) : viewHome();
  $view.innerHTML = html;
  const tab = name === 's' ? 'map' : ['map', 'words', 'me'].includes(name) ? name : 'today';
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
  try {
    const r = store.importText(text, S);
    S = r.state;
    persist();
    toast(`読み込みました（記録 ${r.added} 件・単語 ${r.addedWords} 語を追加）`);
    render();
  } catch (err) { toast(err.message); }
}

async function checkUpdate(manual) {
  try {
    if (manual && !navigator.onLine) { toast('オフラインのため確認できません。保存済みの教材で動いています。'); return; }
    const fresh = await refreshData(D);
    if (fresh) {
      D = fresh; // 進行中のカードは手元の文をそのまま使い続ける
      toast('教材を更新しました。');
      if (!activeCard()) render();
    } else if (manual) toast('教材は最新です。');
  } catch { if (manual) toast('確認できませんでした。保存済みの教材で動いています。'); }
}

const ACTIONS = {
  'start-read': () => startSession({ mode: 'read' }),
  'start-listen': () => startSession({ mode: 'listen' }),
  'start-focus': (el) => startSession({ mode: 'read', focus: el.dataset.g }),
  home: () => { ses = null; render(true); },
  end: () => { logView(ses.card); ses = ses.count ? { ...ses, i: ses.list.length } : null; render(true); },
  back: () => { history.length > 1 ? history.back() : (location.hash = '#map'); },
  break: (el, c) => { c.open = !c.open; if (c.open && !c.answered) c.helped = true; render(); },
  labels: (el) => { S.settings.labels = el.dataset.v; persist(); render(); },
  word: (el, c) => {
    const w = c.s.words[+el.dataset.i];
    c.word = +el.dataset.i;
    if (!c.answered) c.helped = true;
    const e = (S.words[w.lemma] ||= { addedAt: Date.now(), metIn: [], ja: w.ja });
    if (!e.metIn.includes(c.s.id)) e.metIn.push(c.s.id);
    persist();
    render();
  },
  unword: (el, c) => {
    const w = c.s.words[c.word], e = S.words[w.lemma];
    if (e) { e.metIn = e.metIn.filter((x) => x !== c.s.id); if (!e.metIn.length) delete S.words[w.lemma]; }
    c.word = null;
    persist();
    render();
  },
  'rm-word': (el) => { delete S.words[el.dataset.l]; persist(); render(); },
  choose: (el, c) => { answer(c, +el.dataset.i); render(); },
  idk: (el, c) => { answer(c, -1); render(); },
  reveal: (el, c) => { c.revealed = true; if (!c.answered) c.helped = true; render(); },
  speak: (el, c) => speak(c.s, false),
  'speak-slow': (el, c) => speak(c.s, true),
  next: (el, c) => {
    if (walk) { ACTIONS.back(); return; }
    ses.i++;
    if (ses.i < ses.list.length) { ses.card = newCard(ses.list[ses.i], ses.mode); render(true); if (ses.mode === 'listen') speak(ses.card.s); }
    else render(true);
  },
  shelf: (el) => { S.settings.shelf = el.dataset.v; persist(); render(); },
  rate: (el) => { S.settings.rate = +el.dataset.v; persist(); render(); },
  sound: (el) => { S.settings.sound = el.dataset.v === '1'; persist(); render(); if (S.settings.sound) chime(); },
  export: () => download('fathom-progress-' + new Date().toISOString().slice(0, 10) + '.json', store.exportText(S)),
  'export-show': () => { exportShown = !exportShown; render(); },
  'import-text': () => { const t = document.getElementById('imptext').value.trim(); if (t) doImport(t); else toast('貼り付け欄が空です。'); },
  refresh: () => checkUpdate(true),
  reset: () => {
    if (!confirm('この端末の記録（答えた履歴と単語帳）をすべて消します。元に戻せません。先に書き出しておくことをおすすめします。消しますか？')) return;
    store.clearAll();
    S = store.load();
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
  if (ev.target.id !== 'imp' || !ev.target.files[0]) return;
  ev.target.files[0].text().then(doImport);
});
window.addEventListener('hashchange', () => render(true));

(async function boot() {
  try {
    D = await loadData();
  } catch (err) {
    $view.innerHTML = `<section class="hero"><h2>教材を読み込めませんでした</h2><p class="sub">最初の一度だけ、ネットにつながった状態で開く必要があります。<br><small>${esc(err.message)}</small></p><button class="primary" onclick="location.reload()">もう一度試す</button></section>`;
    return;
  }
  render(true);
  checkUpdate(false);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

// 動作確認用（tests.html やコンソールから使う）
window.fathom = { get state() { return S; }, get data() { return D; }, L, store };
