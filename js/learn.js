// 学習の規則（純粋な関数だけ。画面にも保存にも触らない）
// 記録（events）から状態を毎回計算する。規則を直しても過去の記録はそのまま使える。
//
// 文についての記録 = { t, sid, mode:'read'|'listen', helped, correct:true|false|null, choice, ms, heard? }
//   helped  : 答える前に分解・単語・英文表示（聴解時）を見た
//   correct : null は「見ただけで答えなかった」
//   ms      : 反応時間。記録するだけで、判定には一切使わない
//   heard   : 聞く入口で、音声が実際に再生できたか（false なら聴解の根拠にしない）
// 地図で解説を読んだ記録 = { t, sid:'', gid, mode:'map', correct:null }

export const DAY = 864e5;
export const INTERVALS = [1, 3, 7, 14, 30]; // 復習までの日数（連続正解の数で進む）
export const REVISIT_DAYS = 30; // これだけ空いた既出の文は「久しぶりの文」として根拠に数える
export const SOLID_MIN = 2; // 「分かる」に必要な、日を空けた自力正解の回数（別の日・別の文）

export function dayOf(t) {
  return Math.floor((t - new Date(t).getTimezoneOffset() * 6e4) / DAY);
}
const modeOf = (e) => (e.mode === 'listen' ? 'listen' : e.mode === 'read' ? 'read' : e.mode);

// 各記録に seen（その文を前に見聞きしたか）と stale（それが十分に昔か）を付ける
export function annotate(events) {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const last = {};
  return sorted.map((e) => {
    if (!e.sid) return { ...e };
    const p = last[e.sid];
    const d = dayOf(e.t);
    let seen = false, stale = false;
    if (p) {
      if (e.mode === 'listen') {
        // 聞く: 同じ日に見聞きした文、前に聞いた文は「初めて」ではない
        const sameDay = dayOf(p.any) === d;
        seen = sameDay || p.listen != null;
        stale = !sameDay && p.listen != null && d - dayOf(p.listen) >= REVISIT_DAYS;
      } else {
        seen = true;
        stale = d - dayOf(p.any) >= REVISIT_DAYS;
      }
    }
    last[e.sid] = { ...p, any: e.t, [modeOf(e)]: e.t };
    return { ...e, seen, stale };
  });
}

// その問いが確かめている文法項目。question.targets があればそれだけ、無ければ文の grammar 全部。
export function targetsOf(s) {
  const t = s.question && s.question.targets;
  return Array.isArray(t) && t.length ? t : s.grammar;
}

// 文法項目ごとの履歴を作る（読む・聞くは別々）
// kind:
//   view     見ただけ
//   assisted 解説後（分解などを見てから答えた）
//   unheard  聞く入口で音声が再生できなかった
//   repeat   最近見た同じ文にもう一度答えた（文を覚えているだけかもしれない）
//   first    その項目に初めて出会った文に、自力で答えた
//   sameday  同じ日にその項目に触れたあと、別の文に自力で答えた
//   delayed  日を空けて、初めて見る別の文に自力で答えた（＝数日後の初見）
//   revisit  REVISIT_DAYS 以上前に見た文に、自力で答えた（＝久しぶりの文）
export function history(events, data) {
  const g = {}; // gid -> { read:[], listen:[] }
  const lastDay = {}; // gid -> { read, listen } 最後にその項目に触れた日
  const bySid = {}; // sid -> 記録の配列
  for (const e of annotate(events)) {
    const d = dayOf(e.t);
    if (!e.sid) {
      if (e.gid) lastDay[e.gid] = { read: d, listen: d }; // 解説を読んだ日は、その項目に触れた日
      continue;
    }
    (bySid[e.sid] ||= []).push(e);
    const s = data.byId[e.sid];
    if (!s) continue; // 教材から消えた文の記録は残すが、計算には使わない
    const m = modeOf(e);
    if (m !== 'read' && m !== 'listen') continue; // 「作る」などは、読解・聴解の判定には数えない（文を見た事実は bySid に残る）
    for (const gid of targetsOf(s)) {
      if (!s.grammar.includes(gid)) continue;
      const ld = (lastDay[gid] || {})[m];
      let kind;
      if (e.correct == null) kind = 'view';
      else if (e.helped) kind = 'assisted';
      else if (m === 'listen' && e.heard === false) kind = 'unheard';
      else if (e.seen && !e.stale) kind = 'repeat';
      else if (e.stale) kind = ld != null && ld < d ? 'revisit' : 'repeat';
      else if (ld == null) kind = 'first';
      else if (ld < d) kind = 'delayed';
      else kind = 'sameday';
      (g[gid] ||= { read: [], listen: [] })[m].push({ ...e, kind, day: d });
    }
    for (const gid of s.grammar) (lastDay[gid] ||= {})[m] = d;
  }
  return { g, bySid };
}

const isEvidence = (e) => e.kind === 'delayed' || e.kind === 'revisit';

// 状態: 'none'（未探索／未測定） | 'learning'（勉強中） | 'solid'（分かる）
// 一度の正解や偶然の正解では solid にしない:
//   日を空けた自力正解（delayed / revisit）が、別々の日・別々の文で SOLID_MIN 回以上あり、
//   そのうち少なくとも1回は初めて見る文（delayed）で、
//   かつ直近の「日を空けた自力回答」が正解であること。
export function status(list) {
  if (!list || !list.length) return 'none';
  const ev = list.filter(isEvidence);
  const ok = ev.filter((e) => e.correct);
  const days = new Set(ok.map((e) => e.day));
  const sids = new Set(ok.map((e) => e.sid));
  if (days.size >= SOLID_MIN && sids.size >= SOLID_MIN && ok.some((e) => e.kind === 'delayed') && ev[ev.length - 1].correct) return 'solid';
  return 'learning';
}

export function counts(list) {
  const c = { first: [0, 0], assisted: [0, 0], delayed: [0, 0], revisit: [0, 0], other: [0, 0], views: 0 };
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
  const ev = list.filter(isEvidence);
  let streak = 0;
  for (let i = ev.length - 1; i >= 0 && ev[i].correct; i--) streak++;
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
  const seen = {}; // sid -> { any, listen, read }
  for (const sid in H.bySid) {
    const evs = H.bySid[sid];
    const ls = evs.filter((e) => e.mode === 'listen');
    seen[sid] = { any: evs[evs.length - 1].t, listen: ls.length ? ls[ls.length - 1].t : null, read: evs.some((e) => e.mode === 'read'), made: evs.filter((e) => e.mode === 'make').map((e) => e.t).pop() || 0, answered: evs.some((e) => e.correct != null), helped: evs.some((e) => e.helped) };
  }
  const pool = data.sentences.filter((s) => (shelf === 'both' || s.shelf === shelf) && (!focus || s.grammar.includes(focus)));
  // 地図から入ったときは、その項目を確かめる問いの文を先に（sort は安定なので、ほかの順は index.json のまま）
  if (focus) pool.sort((a, b) => targetsOf(b).includes(focus) - targetsOf(a).includes(focus));
  const picks = [];
  const info = { review: 0, fresh: 0 };
  const add = (s) => { if (s && !picks.includes(s) && picks.length < size) { picks.push(s); return true; } return false; };
  const oldestFirst = (a, b) => (seen[a.id]?.any || 0) - (seen[b.id]?.any || 0);

  if (mode === 'listen') {
    // 聞く入口: 読んだことのある文を、耳だけで。今日は見ていない・まだ聞いていない文から。
    const read = pool.filter((s) => seen[s.id] && seen[s.id].read);
    const rank = (s) => (dayOf(seen[s.id].any) === today ? 2 : seen[s.id].listen == null ? 0 : 1);
    read.sort((a, b) => rank(a) - rank(b) || (seen[a.id].listen || 0) - (seen[b.id].listen || 0) || oldestFirst(a, b));
    read.forEach(add);
    info.review = picks.length;
    return { list: picks, info };
  }

  const unseen = pool.filter((s) => !seen[s.id]);
  const notToday = pool.filter((s) => seen[s.id] && dayOf(seen[s.id].any) !== today).sort(oldestFirst);

  // 単語帳の再会待ち
  const dueWords = [];
  for (const lemma in state.words || {}) {
    if (wordInfo(lemma, state.words[lemma], data, H.bySid).due <= today) dueWords.push(lemma);
  }
  const hasDueWord = (s) => s.words.some((w) => dueWords.includes(w.lemma) && !(state.words[w.lemma].metIn || []).includes(s.id));

  // 1) 復習日が来た文法項目 → その項目を確かめる「別の文」
  //    初めての文が残っていなければ、今日は見ていない既出の文で復習する（項目を落とさない）
  const dueG = Object.keys(H.g)
    .filter((gid) => !focus || gid === focus)
    .map((gid) => ({ gid, due: dueDay(H.g[gid].read) }))
    .filter((x) => x.due != null && x.due <= today)
    .sort((a, b) => a.due - b.due);
  let n = 0;
  for (const { gid } of dueG) {
    if (n >= Math.max(1, size - 2)) break;
    if (picks.some((s) => targetsOf(s).includes(gid))) continue; // すでに選んだ文が兼ねている
    const tests = (s) => targetsOf(s).includes(gid) && !picks.includes(s);
    const cands = unseen.filter(tests);
    if (add(cands.find(hasDueWord) || cands[0] || notToday.find(tests))) { n++; info.review++; }
  }
  // 2) 単語との再会
  let wn = 0;
  for (const lemma of dueWords) {
    if (wn >= 2) break;
    if (picks.some((s) => s.words.some((w) => w.lemma === lemma))) continue;
    const met = state.words[lemma].metIn || [];
    if (add(unseen.find((s) => !met.includes(s.id) && s.words.some((w) => w.lemma === lemma)))) { wn++; info.review++; }
  }
  // 3) 読みかけで離れた文（見ただけで、分解も答えもまだ）→ まだ見ていない文（index.json の順）
  for (const s of pool) if (seen[s.id] && !seen[s.id].answered && !seen[s.id].helped) add(s);
  for (const s of unseen) if (add(s)) info.fresh++;
  // 4) 足りなければ、見た日が古い文から
  notToday.forEach(add);
  [...pool].sort(oldestFirst).forEach(add);
  return { list: picks, info };
}

// ホーム画面用: いま復習待ちの項目数など
export function overview(data, state, now = Date.now()) {
  const today = dayOf(now);
  const H = history(state.events, data);
  let dueCount = 0;
  for (const gid in H.g) { const d = dueDay(H.g[gid].read); if (d != null && d <= today) dueCount++; }
  const seenIds = Object.keys(H.bySid).filter((id) => data.byId[id]);
  const readIds = seenIds.filter((id) => H.bySid[id].some((e) => e.mode === 'read'));
  return { H, dueCount, seenCount: seenIds.length, readCount: readIds.length };
}

// 「理解できた文」＝読んで、問いに正解したことのある文。作る入口と、流して読む入口で使う。
export function understood(data, state) {
  const ok = new Set(state.events.filter((e) => e.mode === 'read' && e.correct === true).map((e) => e.sid));
  return data.sentences.filter((s) => ok.has(s.id));
}

// 作る入口の1回分: 理解できた文から、まだ作っていない文 → 作った日が古い文の順に
export function makeSession(data, state, size = 5) {
  const last = {};
  for (const e of state.events) if (e.mode === 'make') last[e.sid] = Math.max(last[e.sid] || 0, e.t);
  return understood(data, state).sort((a, b) => (last[a.id] || 0) - (last[b.id] || 0)).slice(0, size);
}
