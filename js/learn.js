// 学習の規則（純粋な関数だけ。画面にも保存にも触らない）
// 記録（events）から状態を毎回計算する。規則を直しても過去の記録はそのまま使える。
//
// 1つの記録 = { t, sid, mode:'read'|'listen', helped, correct:true|false|null, choice, ms }
//   helped  : 答える前に分解・単語・英文表示（聴解時）を見た
//   correct : null は「見ただけで答えなかった」
//   ms      : 反応時間。記録するだけで、判定には一切使わない

export const DAY = 864e5;
export const INTERVALS = [1, 3, 7, 14, 30]; // 復習までの日数（連続正解の数で進む）
export const FRESH_DAYS = 14; // これだけ空けば、同じ文でも「初見扱い」に戻す
export const SOLID_MIN = 2; // 「分かる」に必要な、数日後の初見正解の回数（別の日・別の文）

export function dayOf(t) {
  return Math.floor((t - new Date(t).getTimezoneOffset() * 6e4) / DAY);
}

// 各記録に fresh（その文をその場で初めて見たと言えるか）を付ける
export function annotate(events) {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const last = {};
  return sorted.map((e) => {
    const p = last[e.sid];
    let fresh = true;
    if (p) {
      if (e.mode === 'listen') {
        // 聞く: 同じ日に見聞きしていない、かつ最近聞いていない
        fresh = dayOf(p.any) !== dayOf(e.t) && (p.listen == null || dayOf(e.t) - dayOf(p.listen) >= FRESH_DAYS);
      } else {
        fresh = dayOf(e.t) - dayOf(p.any) >= FRESH_DAYS;
      }
    }
    last[e.sid] = { ...p, any: e.t, [e.mode]: e.t };
    return { ...e, fresh };
  });
}

// 文法項目ごと・単語ごとの履歴を作る
// kind:
//   view     見ただけ
//   assisted 解説後（分解などを見てから答えた）
//   repeat   最近見た同じ文にもう一度答えた（文を覚えているだけかもしれない）
//   first    その項目に初めて出会った文に、自力で答えた
//   sameday  同じ日にその項目を見たあと、別の文に自力で答えた
//   delayed  日を空けて、別の文に自力で答えた（＝数日後の初見）
export function history(events, data) {
  const g = {}; // gid -> { read:[], listen:[] }
  const lastDay = {}; // gid -> 最後にその項目に触れた日（読む・聞く共通）
  const bySid = {}; // sid -> 記録の配列
  for (const e of annotate(events)) {
    (bySid[e.sid] ||= []).push(e);
    const s = data.byId[e.sid];
    if (!s) continue; // 教材から消えた文の記録は残すが、計算には使わない
    const d = dayOf(e.t);
    for (const gid of s.grammar) {
      let kind;
      if (e.correct == null) kind = 'view';
      else if (e.helped) kind = 'assisted';
      else if (!e.fresh) kind = 'repeat';
      else if (lastDay[gid] == null) kind = 'first';
      else if (lastDay[gid] < d) kind = 'delayed';
      else kind = 'sameday';
      const rec = (g[gid] ||= { read: [], listen: [] });
      rec[e.mode === 'listen' ? 'listen' : 'read'].push({ ...e, kind, day: d });
    }
    for (const gid of s.grammar) lastDay[gid] = d;
  }
  return { g, bySid };
}

// 状態: 'none'（未探索／未測定） | 'learning'（勉強中） | 'solid'（分かる）
// 一度の正解や偶然の正解では solid にしない:
//   数日後の初見正解が、別々の日・別々の文で SOLID_MIN 回以上あり、
//   かつ直近の「数日後の初見」が正解であること。
export function status(list) {
  if (!list || !list.length) return 'none';
  const delayed = list.filter((e) => e.kind === 'delayed');
  const ok = delayed.filter((e) => e.correct);
  const days = new Set(ok.map((e) => e.day));
  const sids = new Set(ok.map((e) => e.sid));
  if (days.size >= SOLID_MIN && sids.size >= SOLID_MIN && delayed[delayed.length - 1].correct) return 'solid';
  return 'learning';
}

export function counts(list) {
  const c = { first: [0, 0], assisted: [0, 0], delayed: [0, 0], other: [0, 0], views: 0 };
  for (const e of list || []) {
    if (e.kind === 'view') { c.views++; continue; }
    const k = c[e.kind] ? e.kind : 'other';
    c[k][1]++;
    if (e.correct) c[k][0]++;
  }
  return c;
}

// 次に復習する日。まだ触れていなければ null
export function dueDay(list) {
  if (!list || !list.length) return null;
  const last = list[list.length - 1];
  const delayed = list.filter((e) => e.kind === 'delayed');
  let streak = 0;
  for (let i = delayed.length - 1; i >= 0 && delayed[i].correct; i--) streak++;
  const answered = [...list].reverse().find((e) => e.correct != null);
  const interval = answered && answered.correct === false ? 1 : INTERVALS[Math.min(streak, INTERVALS.length - 1)];
  return last.day + interval;
}

// 単語帳の単語: 入れた文とは別の文で出会った回数と、次の再会日
export function wordInfo(lemma, entry, data, bySid) {
  const met = new Set(entry.metIn || []);
  const reunions = [];
  const candidates = [];
  for (const s of data.byLemma[lemma] || []) {
    if (met.has(s.id)) continue;
    const evs = (bySid[s.id] || []).filter((e) => e.t > entry.addedAt);
    if (evs.length) reunions.push({ sid: s.id, t: evs[0].t });
    else candidates.push(s);
  }
  reunions.sort((a, b) => a.t - b.t);
  const lastT = reunions.length ? reunions[reunions.length - 1].t : entry.addedAt;
  const due = dayOf(lastT) + INTERVALS[Math.min(reunions.length, INTERVALS.length - 1)];
  return { reunions, candidates, due };
}

// 1回分の文を選ぶ
// opts: { mode, shelf:'read'|'talk'|'both', size, now, focus: 文法ID（地図から入ったとき） }
export function buildSession(data, state, opts) {
  const { mode = 'read', shelf = 'both', size = 5, now = Date.now(), focus = null } = opts;
  const today = dayOf(now);
  const H = history(state.events, data);
  const seen = {}; // sid -> { any, listen }
  for (const sid in H.bySid) {
    const evs = H.bySid[sid];
    const ls = evs.filter((e) => e.mode === 'listen');
    seen[sid] = { any: evs[evs.length - 1].t, listen: ls.length ? ls[ls.length - 1].t : null, read: evs.some((e) => e.mode !== 'listen') };
  }
  let pool = data.sentences.filter((s) => (shelf === 'both' || s.shelf === shelf) && (!focus || s.grammar.includes(focus)));
  const picks = [];
  const info = { review: 0, fresh: 0 };
  const add = (s) => { if (s && !picks.includes(s) && picks.length < size) { picks.push(s); return true; } return false; };

  if (mode === 'listen') {
    // 聞く入口: 読んだことのある文を、耳だけで。最近聞いていないものから。
    const read = pool.filter((s) => seen[s.id] && seen[s.id].read);
    const fresh = (s) => dayOf(seen[s.id].any) !== today && (seen[s.id].listen == null || today - dayOf(seen[s.id].listen) >= FRESH_DAYS);
    read.sort((a, b) => (fresh(b) - fresh(a)) || ((seen[a.id].listen || 0) - (seen[b.id].listen || 0)) || (seen[a.id].any - seen[b.id].any));
    read.forEach(add);
    info.review = picks.length;
    return { list: picks, info };
  }

  const isFresh = (s) => !seen[s.id] || today - dayOf(seen[s.id].any) >= FRESH_DAYS;
  const freshPool = pool.filter(isFresh);

  // 単語帳の再会待ち
  const dueWords = [];
  for (const lemma in state.words || {}) {
    const wi = wordInfo(lemma, state.words[lemma], data, H.bySid);
    if (wi.due <= today) dueWords.push(lemma);
  }
  const hasDueWord = (s) => s.words.some((w) => dueWords.includes(w.lemma) && !(state.words[w.lemma].metIn || []).includes(s.id));

  // 1) 復習日が来た文法項目 → その項目を含む「別の文」
  const dueG = Object.keys(H.g)
    .filter((gid) => !focus || gid === focus)
    .map((gid) => ({ gid, due: dueDay(H.g[gid].read) }))
    .filter((x) => x.due != null && x.due <= today)
    .sort((a, b) => a.due - b.due);
  let n = 0;
  for (const { gid } of dueG) {
    if (n >= Math.max(1, size - 2)) break;
    if (picks.some((s) => s.grammar.includes(gid))) continue; // すでに選んだ文が兼ねている
    const cands = freshPool.filter((s) => s.grammar.includes(gid) && !picks.includes(s));
    if (add(cands.find(hasDueWord) || cands[0])) { n++; info.review++; }
  }
  // 2) 単語との再会
  let wn = 0;
  for (const lemma of dueWords) {
    if (wn >= 2) break;
    if (picks.some((s) => s.words.some((w) => w.lemma === lemma))) continue;
    const met = state.words[lemma].metIn || [];
    if (add(freshPool.find((s) => !met.includes(s.id) && s.words.some((w) => w.lemma === lemma)))) { wn++; info.review++; }
  }
  // 3) まだ見ていない文（index.json の順）
  for (const s of pool) if (!seen[s.id] && add(s)) info.fresh++;
  // 4) 足りなければ、久しぶりの文 → 見た日が古い順
  for (const s of freshPool) add(s);
  [...pool].sort((a, b) => (seen[a.id]?.any || 0) - (seen[b.id]?.any || 0)).forEach(add);
  return { list: picks, info };
}

// ホーム画面用: いま復習待ちの項目数など
export function overview(data, state, now = Date.now()) {
  const today = dayOf(now);
  const H = history(state.events, data);
  let dueCount = 0;
  for (const gid in H.g) { const d = dueDay(H.g[gid].read); if (d != null && d <= today) dueCount++; }
  const seenIds = Object.keys(H.bySid).filter((id) => data.byId[id]);
  const readIds = seenIds.filter((id) => H.bySid[id].some((e) => e.mode !== 'listen'));
  return { H, dueCount, seenCount: seenIds.length, readCount: readIds.length };
}
