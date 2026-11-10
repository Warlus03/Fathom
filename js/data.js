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
  if (q) {
    // targets は必須。省くと、文に付いた文法すべてに正誤が数えられてしまう
    if (!Array.isArray(q.targets) || !q.targets.length) p.push('question.targets がない（その問いが確かめている文法を、1つ以上書く）');
    else for (const g of q.targets) if (!(s.grammar || []).includes(g)) p.push('question.targets の「' + g + '」が、この文の grammar にない');
  }
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

// ネットから取る。JSON として読めることだけ確かめる。端末への保存はここではしない。
async function fetchText(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: ctl.signal });
    if (!res.ok) throw new Error(url + ' → ' + res.status);
    const text = await res.text();
    JSON.parse(text);
    return text;
  } finally { clearTimeout(timer); }
}

async function fromCache(url, cache) {
  if (!cache) return null;
  try { const res = await cache.match(url); return res ? await res.text() : null; } catch { return null; }
}

const sUrl = (id) => 'data/sentences/' + id + '.json';

// 教材全体が開ける形かどうか。ここで落ちたものは端末に保存しない。
function checkShape(index, grammar) {
  if (!index || !Array.isArray(index.sentences) || !index.sentences.every((x) => typeof x === 'string')) throw new Error('index.json の形が違います。');
  if (index.formatVersion > FORMAT) throw new Error('教材が新しい形式です。アプリを更新してください。');
  const ok = grammar && Array.isArray(grammar.groups) && Array.isArray(grammar.items)
    && grammar.groups.every((g) => g && typeof g.id === 'string' && typeof g.name === 'string')
    && grammar.items.every((g) => g && typeof g.id === 'string' && typeof g.name === 'string' && typeof g.group === 'string');
  if (!ok) throw new Error('grammar.json の形が違います。');
}

// いじれる例文の動詞の表が、変形の関数（js/play.js）でそのまま使える形か
export function validPlay(p) {
  const str = (v) => typeof v === 'string' && v !== '';
  const strs = (a, n) => Array.isArray(a) && a.length === n && a.every(str);
  if (!p || !Array.isArray(p.verbs) || !p.verbs.length) return false;
  return p.verbs.every((v) => v && typeof v === 'object' && str(v.id) && str(v.label) && str(v.rest)
    && (v.jaFuture === undefined || strs(v.jaFuture, 2))
    && (v.kind === 'be' ? strs(v.ja, 4) : (v.kind === 'regular' || v.kind === 'irregular') && str(v.base) && str(v.s) && str(v.past) && str(v.jaObj) && str(v.jaStem)));
}

// source: 'cache'（保存済みを優先。無いものだけ取りに行く） | 'net'（全部取り直す。失敗分は保存済みで補う）
async function gather(source, cache) {
  const texts = {};
  const fromNet = new Set();
  let failed = 0;
  const get = async (url) => {
    let t = null;
    if (source === 'cache') t = await fromCache(url, cache);
    if (t == null) {
      try { t = await fetchText(url); fromNet.add(url); } catch (err) {
        failed++;
        if (source === 'net') t = await fromCache(url, cache);
        if (t == null) throw err;
      }
    }
    texts[url] = t;
    return JSON.parse(t);
  };
  const [index, grammar] = await Promise.all([get('data/index.json'), get('data/grammar.json')]);
  checkShape(index, grammar);
  const list = await Promise.all(index.sentences.map(async (id) => {
    try { return { id, json: await get(sUrl(id)) }; } catch (err) { return { id, error: '読み込めない（' + err.message + '）' }; }
  }));
  // いじれる例文の動詞の表。無くてもアプリは動く
  let play = null;
  const P = 'data/playground.json';
  try {
    play = await get(P);
    if (!validPlay(play)) {
      // 取り直した表が壊れていたら、保存済みの正しい表を使う。保存済みは上書きしない
      const wasNet = fromNet.delete(P);
      play = null;
      delete texts[P];
      if (wasNet) {
        const old = await fromCache(P, cache);
        try { const j = JSON.parse(old); if (validPlay(j)) { play = j; texts[P] = old; } } catch {}
      }
    }
  } catch { failed--; }
  return { index, grammar, list, play, texts, fromNet, failed };
}

async function loadAll(source) {
  const cache = await openCache();
  let r;
  try { r = await gather(source, cache); } catch (err) {
    if (source !== 'cache') throw err; // 更新の失敗。保存済みには手を付けていない
    r = await gather('net', cache); // 保存済みが開けない形だったら、取り直す
  }
  let data = build(r.index, r.grammar, r.list);
  // 取り直した文が検査に落ちたら、保存済みの正しい版があればそれを使う。落ちた版で保存済みを上書きしない
  const skip = new Set();
  if (data.problems.length) {
    const gids = new Set(r.grammar.items.map((g) => g.id));
    let restored = false;
    for (const pr of data.problems) {
      const url = sUrl(pr.id);
      if (!r.fromNet.has(url)) continue;
      skip.add(url);
      const old = await fromCache(url, cache);
      if (old == null) continue;
      try {
        const json = JSON.parse(old);
        if (json.id !== pr.id || validate(json, gids).length) continue;
        const item = r.list.find((x) => x.id === pr.id);
        item.json = json;
        delete item.error;
        r.texts[url] = old;
        restored = true;
      } catch {}
    }
    if (restored) { const problems = data.problems; data = build(r.index, r.grammar, r.list); data.rejected = problems; }
  }
  data.play = r.play;
  // 全体を検査し終えてから、新しく取った分だけ端末に保存する。保存できなくても教材は使う。
  let saved = !!cache;
  if (cache) {
    for (const url of r.fromNet) {
      if (skip.has(url)) continue;
      try { await cache.put(url, new Response(r.texts[url], { headers: { 'Content-Type': 'application/json' } })); } catch { saved = false; }
    }
  }
  data.signature = Object.keys(r.texts).sort().map((u) => u + '\n' + r.texts[u]).join('\n');
  data.net = { fetched: r.fromNet.size, failed: r.failed, saved };
  return data;
}

// 起動時: 保存済みがあれば即それで開く（オフラインでも可）
export function loadData() { return loadAll('cache'); }

// 裏での更新確認。
// 返り値 { data, verified, saved }
//   data     : 変わっていれば新しい教材、同じなら null
//   verified : すべてネットから取り直せた（＝最新だと確かめられた）
//   saved    : 端末に保存できた（false ならオフラインでは古い版が開く）
export async function refreshData(current) {
  const fresh = await loadAll('net');
  return { data: fresh.signature === current.signature ? null : fresh, verified: fresh.net.failed === 0, saved: fresh.net.saved };
}
