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
    gone: {}, // lemma -> 単語帳から外した時刻（別の画面の古い状態と合わせたとき、外した単語が戻らないようにする）
    settings: { shelf: 'both', sound: true, labels: 'plain', rate: 0.9, voice: '', slideSec: 3 },
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const optBool = (v) => v === undefined || typeof v === 'boolean';

// 記録1件を検査して、決まった形に整える。おかしければ null。
// strict（読み込み用）では、あるのに型が違う値も「おかしい」とする。
// strict でなくても、型の違う helped / heard を「自力で解いた」「聞こえた」側に寄せることはしない。
function cleanEvent(e, strict) {
  if (!isObj(e) || !Number.isFinite(e.t) || typeof e.sid !== 'string') return null;
  if (!MODES.includes(e.mode)) return null;
  if (e.sid === '' && typeof e.gid !== 'string') return null;
  const correct = e.correct === undefined ? null : e.correct;
  if (correct !== true && correct !== false && correct !== null) return null;
  if (strict && (!optBool(e.helped) || !optBool(e.heard))) return null;
  if (strict && ((e.gid !== undefined && typeof e.gid !== 'string') || (e.how !== undefined && e.how !== 'order' && e.how !== 'recall'))) return null;
  const o = {
    t: e.t, sid: e.sid, mode: e.mode,
    helped: e.helped !== undefined && e.helped !== false, // 型が違うときは「助けを見た」側に寄せる
    correct, choice: Number.isInteger(e.choice) ? e.choice : null, ms: Number.isFinite(e.ms) ? e.ms : null,
  };
  if (typeof e.gid === 'string') o.gid = e.gid;
  if (e.heard !== undefined && e.heard !== true) o.heard = false; // 型が違うときは「聞こえていない」側に寄せる
  if (e.how === 'order' || e.how === 'recall') o.how = e.how; // 作る入口: 並べ替えか、頭の中で言ったか
  return o;
}

function cleanWord(w, strict) {
  if (!isObj(w) || !Number.isFinite(w.addedAt)) return null;
  if (strict && (!Array.isArray(w.metIn) || !w.metIn.every((x) => typeof x === 'string'))) return null;
  return { addedAt: w.addedAt, metIn: Array.isArray(w.metIn) ? w.metIn.filter((x) => typeof x === 'string') : [], ja: typeof w.ja === 'string' ? w.ja : '' };
}

function cleanSettings(s) {
  const b = blank().settings;
  if (!isObj(s)) return b;
  return {
    shelf: SHELVES.includes(s.shelf) ? s.shelf : b.shelf,
    sound: typeof s.sound === 'boolean' ? s.sound : b.sound,
    labels: s.labels === 'term' ? 'term' : 'plain',
    rate: Number.isFinite(s.rate) && s.rate > 0.3 && s.rate < 2 ? s.rate : b.rate,
    voice: typeof s.voice === 'string' ? s.voice : '',
    slideSec: [2, 3, 5, 8].includes(s.slideSec) ? s.slideSec : 3,
  };
}

// strict: 1件でも形の合わないものがあれば全体を拒否する（読み込み用）。
// strict でなければ、おかしな記録だけ落として残りを使う（端末内の記録を開くとき用）。
export function migrate(raw, strict = false) {
  if (!isObj(raw) || typeof raw.version !== 'number') throw new Error('Fathom の記録ではないようです。');
  if (raw.version > VERSION) throw new Error('この記録は新しい版のアプリで作られています。アプリを更新してから読み込んでください。');
  let s = raw;
  while (s.version < VERSION) {
    const f = MIGRATIONS[s.version];
    if (!f) throw new Error('古い形式（version ' + s.version + '）を変換できません。');
    s = f(s);
  }
  const refuse = (what) => { throw new Error(what + 'の形が合わないため、読み込みをやめました。今の記録はそのままです。'); };
  if (strict && s.events !== undefined && !Array.isArray(s.events)) refuse('記録の一覧');
  if (strict && s.words !== undefined && !isObj(s.words)) refuse('単語帳');
  if (strict && s.gone !== undefined && !isObj(s.gone)) refuse('単語帳');
  const rawEvents = Array.isArray(s.events) ? s.events : [];
  const events = rawEvents.map((e) => cleanEvent(e, strict)).filter(Boolean);
  const rawWords = isObj(s.words) ? s.words : {};
  const words = {};
  let badWords = 0;
  for (const lemma in rawWords) { const w = cleanWord(rawWords[lemma], strict); if (w) words[lemma] = w; else badWords++; }
  const gone = {};
  if (isObj(s.gone)) for (const lemma in s.gone) { if (Number.isFinite(s.gone[lemma])) gone[lemma] = s.gone[lemma]; else badWords++; }
  const bad = rawEvents.length - events.length + badWords;
  if (strict && bad) throw new Error('形の合わない記録が ' + bad + ' 件あるため、読み込みをやめました。今の記録はそのままです。');
  return {
    version: VERSION,
    createdAt: Number.isFinite(s.createdAt) ? s.createdAt : Date.now(),
    events,
    words,
    gone,
    settings: cleanSettings(s.settings),
  };
}

function readStored() {
  try { return localStorage.getItem(KEY); } catch { return null; }
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

// 単語帳を合わせる。外した記録（gone）が、その単語を入れた時刻より新しければ、外したままにする。
export function mergeWords(aWords, aGone, bWords, bGone) {
  const gone = { ...aGone };
  for (const l in bGone) gone[l] = Math.max(gone[l] || 0, bGone[l]);
  const words = {};
  for (const l of new Set([...Object.keys(aWords), ...Object.keys(bWords)])) {
    const a = aWords[l], b = bWords[l];
    let w;
    if (a && b) {
      // 外したあとで入れ直した単語は、新しいほうの時刻を持つ。そうでなければ、最初に入れた時刻を残す
      const addedAt = gone[l] ? Math.max(a.addedAt, b.addedAt) : Math.min(a.addedAt, b.addedAt);
      w = { ...a, addedAt, metIn: [...new Set([...(a.metIn || []), ...(b.metIn || [])])], ja: a.ja || b.ja };
    } else w = a || b;
    if (!(gone[l] >= w.addedAt)) words[l] = w;
  }
  return { words, gone };
}

// 2つの状態を合わせる。mine が手元（設定は手元を優先）、other が端末に保存されている側。
export function merge(mine, other) {
  const { words, gone } = mergeWords(mine.words, mine.gone || {}, other.words, other.gone || {});
  return { ...mine, createdAt: Math.min(mine.createdAt, other.createdAt), events: mergeEvents(mine.events, other.events), words, gone };
}

// 保存。別の画面（別タブ、ホーム画面のアプリ）が足した記録や単語を消さないよう、保存の直前に合わせる。
// 成功したら true。state はその場で書き換える（合わせた結果を、呼び出し側も持つ）。
// 注意: localStorage には排他の仕組みが無いので、2つの画面がまったく同時に保存した場合の取りこぼしまでは防げない。
//       ひとりで使う前提で、起こる見込みはごく小さい。確実にするなら IndexedDB に移す。
// ownWords: 単語帳を手元で減らした直後（外す・取り消す）に使う。単語帳は手元のものを正とし、記録だけ合わせる。
export function save(state, { ownWords = false } = {}) {
  try {
    const text = readStored();
    if (text) {
      try {
        const disk = migrate(JSON.parse(text));
        if (ownWords) {
          state.events = mergeEvents(state.events, disk.events);
          for (const l in disk.gone) state.gone[l] = Math.max(state.gone[l] || 0, disk.gone[l]);
        } else Object.assign(state, merge(state, disk));
      } catch {}
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
  if (!isObj(obj) || obj.app !== 'fathom' || !obj.state) throw new Error('Fathom の書き出しファイルではないようです。');
  const inc = migrate(obj.state, true);
  const state = merge(current, inc);
  return {
    state,
    added: state.events.length - current.events.length,
    addedWords: Object.keys(state.words).filter((l) => !current.words[l]).length,
  };
}

// 全消去は、合わせる保存とは別扱い（storage の通知で、別の画面側も空にする）
export function clearAll() {
  try { localStorage.removeItem(KEY); } catch {}
}
