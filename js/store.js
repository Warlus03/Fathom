// 学習記録の保存・書き出し・読み込み（端末内のみ。サーバーなし）
// 形式を変えるときは VERSION を上げ、MIGRATIONS に「旧→新」の変換を足す。

export const VERSION = 1;
export const KEY = 'fathom.progress';

// MIGRATIONS[n] は version n のデータを n+1 に直す関数
const MIGRATIONS = {};

const MODES = ['read', 'listen', 'map', 'make'];
const SHELVES = ['both', 'read', 'talk'];

export function blank() {
  return {
    version: VERSION,
    createdAt: Date.now(),
    events: [],
    words: {}, // lemma -> { addedAt, metIn:[sid], ja }
    settings: { shelf: 'both', sound: true, labels: 'plain', rate: 0.9, voice: '', slideSec: 3 },
  };
}

// 記録1件を検査して、決まった形に整える。おかしければ null
function cleanEvent(e) {
  if (!e || typeof e !== 'object' || !Number.isFinite(e.t) || typeof e.sid !== 'string') return null;
  if (!MODES.includes(e.mode)) return null;
  if (e.sid === '' && typeof e.gid !== 'string') return null;
  const correct = e.correct === undefined ? null : e.correct;
  if (correct !== true && correct !== false && correct !== null) return null;
  const o = { t: e.t, sid: e.sid, mode: e.mode, helped: e.helped === true, correct, choice: Number.isInteger(e.choice) ? e.choice : null, ms: Number.isFinite(e.ms) ? e.ms : null };
  if (typeof e.gid === 'string') o.gid = e.gid;
  if (e.heard === false) o.heard = false;
  if (e.how === 'order' || e.how === 'recall') o.how = e.how; // 作る入口: 並べ替えか、頭の中で言ったか
  return o;
}

function cleanWord(w) {
  if (!w || typeof w !== 'object' || !Number.isFinite(w.addedAt)) return null;
  return { addedAt: w.addedAt, metIn: Array.isArray(w.metIn) ? w.metIn.filter((x) => typeof x === 'string') : [], ja: typeof w.ja === 'string' ? w.ja : '' };
}

function cleanSettings(s) {
  const b = blank().settings;
  if (!s || typeof s !== 'object') return b;
  return {
    shelf: SHELVES.includes(s.shelf) ? s.shelf : b.shelf,
    sound: typeof s.sound === 'boolean' ? s.sound : b.sound,
    labels: s.labels === 'term' ? 'term' : 'plain',
    rate: Number.isFinite(s.rate) && s.rate > 0.3 && s.rate < 2 ? s.rate : b.rate,
    voice: typeof s.voice === 'string' ? s.voice : '',
    slideSec: [2, 3, 5, 8].includes(s.slideSec) ? s.slideSec : 3,
  };
}

// strict: 1件でもおかしな記録があれば全体を拒否する（読み込み用）。
// strict でなければ、おかしな記録だけ落として残りを使う（端末内の記録を開くとき用）。
export function migrate(raw, strict = false) {
  if (!raw || typeof raw !== 'object' || typeof raw.version !== 'number') throw new Error('Fathom の記録ではないようです。');
  if (raw.version > VERSION) throw new Error('この記録は新しい版のアプリで作られています。アプリを更新してから読み込んでください。');
  let s = raw;
  while (s.version < VERSION) {
    const f = MIGRATIONS[s.version];
    if (!f) throw new Error('古い形式（version ' + s.version + '）を変換できません。');
    s = f(s);
  }
  const rawEvents = Array.isArray(s.events) ? s.events : [];
  const events = rawEvents.map(cleanEvent).filter(Boolean);
  const rawWords = s.words && typeof s.words === 'object' && !Array.isArray(s.words) ? s.words : {};
  const words = {};
  let badWords = 0;
  for (const lemma in rawWords) { const w = cleanWord(rawWords[lemma]); if (w) words[lemma] = w; else badWords++; }
  const bad = rawEvents.length - events.length + badWords;
  if (strict && bad) throw new Error('形の合わない記録が ' + bad + ' 件あるため、読み込みをやめました。今の記録はそのままです。');
  return {
    version: VERSION,
    createdAt: Number.isFinite(s.createdAt) ? s.createdAt : Date.now(),
    events,
    words,
    settings: cleanSettings(s.settings),
  };
}

function readStored() {
  let text = null;
  try { text = localStorage.getItem(KEY); } catch { return null; }
  return text;
}

export function load() {
  const text = readStored();
  if (!text) return blank();
  try {
    return migrate(JSON.parse(text));
  } catch (err) {
    // 読めない記録は捨てずに退避しておく
    try { localStorage.setItem(KEY + '.broken.' + Date.now(), text); } catch {}
    console.warn('記録を読めなかったので退避しました', err);
    return blank();
  }
}

const eventKey = (e) => e.t + '|' + e.sid + '|' + e.mode + '|' + (e.gid || '');

// 記録は足されるだけなので、2つの一覧は重複を除いて合わせられる
export function mergeEvents(a, b) {
  const have = new Set(a.map(eventKey));
  const out = [...a];
  for (const e of b) if (!have.has(eventKey(e))) { out.push(e); have.add(eventKey(e)); }
  return out.sort((x, y) => x.t - y.t);
}

// 保存。別の画面（別タブ、ホーム画面のアプリ）が足した記録を消さないよう、保存の直前に合わせる。
// 成功したら true。
export function save(state) {
  try {
    const text = readStored();
    if (text) {
      try { state.events = mergeEvents(state.events, migrate(JSON.parse(text)).events); } catch {}
    }
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (err) { console.warn('保存に失敗', err); return false; }
}

export function exportText(state) {
  return JSON.stringify({ app: 'fathom', kind: 'progress', version: VERSION, exportedAt: Date.now(), state }, null, 1);
}

// 読み込みは「合流」。今ある記録は消さず、同じ記録は重ねない。
// 形の合わない記録が混ざっていたら、何も変えずに例外を投げる。
export function importText(text, current) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('ファイルを読めませんでした（JSONではありません）。'); }
  if (!obj || obj.app !== 'fathom' || !obj.state) throw new Error('Fathom の書き出しファイルではないようです。');
  const inc = migrate(obj.state, true);
  const events = mergeEvents(current.events, inc.events);
  const words = { ...current.words };
  let addedWords = 0;
  for (const lemma in inc.words) {
    const a = words[lemma], b = inc.words[lemma];
    if (!a) { words[lemma] = b; addedWords++; }
    else words[lemma] = { ...a, addedAt: Math.min(a.addedAt, b.addedAt), metIn: [...new Set([...(a.metIn || []), ...b.metIn])] };
  }
  return {
    state: { ...current, createdAt: Math.min(current.createdAt, inc.createdAt), events, words },
    added: events.length - current.events.length, addedWords,
  };
}

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch {}
}
