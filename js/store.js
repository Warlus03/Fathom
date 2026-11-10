// 学習記録の保存・書き出し・読み込み（端末内のみ。サーバーなし）
// 形式を変えるときは VERSION を上げ、MIGRATIONS に「旧→新」の変換を足す。

export const VERSION = 1;
const KEY = 'fathom.progress';

// MIGRATIONS[n] は version n のデータを n+1 に直す関数
const MIGRATIONS = {};

export function blank() {
  return {
    version: VERSION,
    createdAt: Date.now(),
    events: [],
    words: {}, // lemma -> { addedAt, metIn:[sid], ja }
    settings: { shelf: 'both', sound: true, labels: 'plain', rate: 0.9 },
  };
}

export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.version !== 'number') throw new Error('Fathom の記録ではないようです。');
  if (raw.version > VERSION) throw new Error('この記録は新しい版のアプリで作られています。アプリを更新してから読み込んでください。');
  let s = raw;
  while (s.version < VERSION) {
    const f = MIGRATIONS[s.version];
    if (!f) throw new Error('古い形式（version ' + s.version + '）を変換できません。');
    s = f(s);
  }
  const b = blank();
  return {
    version: VERSION,
    createdAt: s.createdAt || b.createdAt,
    events: (Array.isArray(s.events) ? s.events : []).filter((e) => e && typeof e.t === 'number' && typeof e.sid === 'string'),
    words: s.words && typeof s.words === 'object' ? s.words : {},
    settings: { ...b.settings, ...(s.settings || {}) },
  };
}

export function load() {
  let text = null;
  try { text = localStorage.getItem(KEY); } catch { return blank(); }
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

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (err) { console.warn('保存に失敗', err); return false; }
}

export function exportText(state) {
  return JSON.stringify({ app: 'fathom', kind: 'progress', version: VERSION, exportedAt: Date.now(), state }, null, 1);
}

// 読み込みは「合流」。今ある記録は消さず、同じ記録は重ねない。
export function importText(text, current) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('ファイルを読めませんでした（JSONではありません）。'); }
  if (!obj || obj.app !== 'fathom' || !obj.state) throw new Error('Fathom の書き出しファイルではないようです。');
  const inc = migrate(obj.state);
  const key = (e) => e.t + '|' + e.sid + '|' + e.mode;
  const have = new Set(current.events.map(key));
  const events = [...current.events];
  let added = 0;
  for (const e of inc.events) if (!have.has(key(e))) { events.push(e); have.add(key(e)); added++; }
  events.sort((a, b) => a.t - b.t);
  const words = { ...current.words };
  let addedWords = 0;
  for (const lemma in inc.words) {
    const a = words[lemma], b = inc.words[lemma];
    if (!a) { words[lemma] = b; addedWords++; }
    else words[lemma] = { ...a, addedAt: Math.min(a.addedAt, b.addedAt), metIn: [...new Set([...(a.metIn || []), ...(b.metIn || [])])] };
  }
  return {
    state: { ...current, createdAt: Math.min(current.createdAt, inc.createdAt), events, words },
    added, addedWords,
  };
}

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch {}
}
