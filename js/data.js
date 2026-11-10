// 教材（文・文法の地図）の読み込み
// ・一度読んだ教材は端末に保存し、オフラインでもそこから開く
// ・オンラインのときは裏で最新を取りに行き、変わっていれば差し替える
// 学習記録（store.js）とは別物。教材を更新しても記録は消えない。

const CACHE = 'fathom-data';
export const FORMAT = 1; // 教材の形式バージョン（data/index.json の formatVersion）

export const ROLES = {
  S: { plain: '誰が・何が', term: '主語' },
  V: { plain: 'どうする', term: '動詞' },
  O: { plain: '何を', term: '目的語' },
  C: { plain: 'どういう状態', term: '補語' },
  M: { plain: '説明を足す', term: '修飾語' },
  aux: { plain: '動詞に意味を足す', term: '助動詞' },
  neg: { plain: '打ち消す', term: '否定' },
  q: { plain: 'たずねる', term: '疑問詞' },
  conj: { plain: 'つなぐ', term: '接続詞' },
  x: { plain: 'そのほか', term: 'そのほか' },
};

const norm = (t) => t.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

// 文1つの検査。問題があれば文字列の配列を返す（空なら合格）
export function validate(s, grammarIds) {
  const p = [];
  const str = (v) => typeof v === 'string' && v.trim() !== '';
  if (!s || typeof s !== 'object') return ['オブジェクトではない'];
  if (!str(s.id)) p.push('id がない');
  if (s.shelf !== 'read' && s.shelf !== 'talk') p.push('shelf は read か talk');
  for (const k of ['en', 'ja', 'aim', 'pitfall']) if (!str(s[k])) p.push(k + ' がない');
  if (!Array.isArray(s.grammar) || !s.grammar.length) p.push('grammar がない');
  else for (const g of s.grammar) if (grammarIds && !grammarIds.has(g)) p.push('文法ID「' + g + '」が grammar.json にない');
  if (!Array.isArray(s.chunks) || !s.chunks.length) p.push('chunks がない');
  else {
    for (const c of s.chunks) {
      if (!str(c.text)) p.push('chunk に text がない');
      if (!ROLES[c.role]) p.push('chunk の role が不正: ' + c.role);
      if (c.role === 'x' && !str(c.plain)) p.push('role x の chunk には plain が必要');
    }
    if (str(s.en) && norm(s.chunks.map((c) => c.text || '').join(' ')) !== norm(s.en)) p.push('chunks をつなげても en と一致しない');
  }
  if (!Array.isArray(s.words)) p.push('words は配列（空でもよい）');
  else for (const w of s.words) {
    if (!str(w.w) || !str(w.lemma) || !str(w.ja)) p.push('words の要素には w, lemma, ja が必要');
    else if (!(s.chunks || []).some((c) => (' ' + norm(c.text || '') + ' ').includes(' ' + norm(w.w) + ' '))) p.push('単語「' + w.w + '」がどの chunk にも入っていない');
  }
  const q = s.question;
  if (!q || !str(q.ask) || !str(q.explain)) p.push('question.ask / explain がない');
  else if (!Array.isArray(q.choices) || q.choices.length < 2) p.push('question.choices は2つ以上');
  else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) p.push('question.answer が範囲外');
  return p;
}

function build(index, grammar, list) {
  const gids = new Set(grammar.items.map((g) => g.id));
  const problems = [];
  const sentences = [];
  const byId = {};
  for (const { id, json, error } of list) {
    const ps = error ? [error] : validate(json, gids);
    if (!error && json && json.id !== id) ps.push('ファイル名と id が違う');
    if (ps.length) { problems.push({ id, problems: ps }); continue; }
    if (!json.audioId) json.audioId = json.id;
    sentences.push(json);
    byId[id] = json;
  }
  const byGrammar = {}, byLemma = {};
  for (const s of sentences) {
    for (const g of s.grammar) (byGrammar[g] ||= []).push(s);
    for (const l of new Set(s.words.map((w) => w.lemma))) (byLemma[l] ||= []).push(s);
  }
  if (problems.length) console.warn('読み込めなかった文', problems);
  return { index, grammar, sentences, byId, byGrammar, byLemma, problems, audio: new Set(index.audio || []) };
}

async function openCache() {
  try { return 'caches' in self ? await caches.open(CACHE) : null; } catch { return null; }
}

async function fromNet(url, cache) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: ctl.signal });
    if (!res.ok) throw new Error(url + ' → ' + res.status);
    const text = await res.text();
    JSON.parse(text); // 壊れたJSONは保存しない
    if (cache) await cache.put(url, new Response(text, { headers: { 'Content-Type': 'application/json' } }));
    return text;
  } finally { clearTimeout(timer); }
}

async function fromCache(url, cache) {
  if (!cache) return null;
  const res = await cache.match(url);
  return res ? res.text() : null;
}

const sUrl = (id) => 'data/sentences/' + id + '.json';

// source: 'cache'（保存済みを優先。無いものだけ取りに行く） | 'net'（全部取り直す。失敗分は保存済みで補う）
async function loadAll(source) {
  const cache = await openCache();
  const texts = {};
  const get = async (url) => {
    let t = null;
    if (source === 'cache') t = await fromCache(url, cache);
    if (t == null) {
      try { t = await fromNet(url, cache); } catch (err) { if (source === 'net') t = await fromCache(url, cache); if (t == null) throw err; }
    }
    texts[url] = t;
    return JSON.parse(t);
  };
  const [index, grammar] = await Promise.all([get('data/index.json'), get('data/grammar.json')]);
  if (index.formatVersion > FORMAT) throw new Error('教材が新しい形式です。アプリを更新してください。');
  const list = await Promise.all(index.sentences.map(async (id) => {
    try { return { id, json: await get(sUrl(id)) }; } catch (err) { return { id, error: '読み込めない（' + err.message + '）' }; }
  }));
  const data = build(index, grammar, list);
  data.signature = Object.keys(texts).sort().map((u) => u + '\n' + texts[u]).join('\n');
  return data;
}

// 起動時: 保存済みがあれば即それで開く（オフラインでも可）
export function loadData() { return loadAll('cache'); }

// 裏での更新確認。変わっていれば新しい data、同じなら null、オフラインなら例外
export async function refreshData(current) {
  const fresh = await loadAll('net');
  return fresh.signature === current.signature ? null : fresh;
}
