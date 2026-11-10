// 学習の規則と保存の動作確認。tests.html を開くと走る。
// 実際の記録（localStorage）には触らない。教材は本物を読み、検査結果も表示する。
import * as L from './learn.js';
import * as store from './store.js';
import { loadData, refreshData } from './data.js';

const out = document.getElementById('out');
const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond });
  const li = document.createElement('li');
  li.className = cond ? 'ok' : 'ng';
  li.textContent = (cond ? '○ ' : '× ') + name + (cond || detail == null ? '' : '　→ ' + JSON.stringify(detail));
  out.appendChild(li);
}

const T0 = new Date(2026, 0, 10, 12).getTime();
const at = (day, min = 0) => T0 + day * L.DAY + min * 6e4;
const ev = (day, sid, o = {}) => ({ t: at(day, o.min || 0), sid, mode: o.mode || 'read', helped: !!o.helped, correct: o.correct === undefined ? true : o.correct, choice: 0, ms: o.ms ?? 3000 });
const st = (events) => ({ ...store.blank(), events });

let D = await loadData();
try { D = (await refreshData(D)) || D; } catch {} // 保存済みではなく、最新の教材で確かめる
check('教材: すべての文が検査に通る（' + D.sentences.length + '文）', D.problems.length === 0, D.problems);
const noSentence = D.grammar.items.filter((g) => !(D.byGrammar[g.id] || []).length).map((g) => g.id);
const few = D.grammar.items.filter((g) => { const n = (D.byGrammar[g.id] || []).length; return n > 0 && n < 3; }).map((g) => g.id);
check('教材: どの文法項目にも文が3本以上ある（「分かる」に届くのに必要）', !noSentence.length && !few.length, { 文なし: noSentence, '3本未満': few });

// be動詞を含む文を4つ使う
const be = (D.byGrammar.be || []).map((s) => s.id);
if (be.length < 4) check('be動詞の文が4本以上ある（以降の確認に必要）', false, be);
else {
  const [a, b, c, d] = be;
  const g = (events, mode = 'read') => (L.history(events, D).g.be || {})[mode];

  check('記録なし → 未探索', L.status(g([])) === 'none');
  check('一度の正解では「分かる」にならない', L.status(g([ev(0, a)])) === 'learning');
  check('同じ日に別の文へ正解しても「分かる」にならない', L.status(g([ev(0, a), ev(0, b, { min: 5 }), ev(0, c, { min: 9 })])) === 'learning');
  check('翌日に別の文へ1回正解しただけでは「分かる」にならない', L.status(g([ev(0, a), ev(1, b)])) === 'learning');
  const solid = [ev(0, a), ev(1, b), ev(4, c)];
  check('日を空けて、別々の日に別々の文へ自力で2回正解 → 分かる', L.status(g(solid)) === 'solid', g(solid).map((e) => e.kind));
  check('分類: 初見 / 数日後の初見', g(solid).map((e) => e.kind).join() === 'first,delayed,delayed', g(solid).map((e) => e.kind));
  check('解説を見てからの正解は数えない', L.status(g([ev(0, a), ev(1, b), ev(4, c, { helped: true })])) === 'learning');
  check('同じ文をもう一度解いた正解は数えない', L.status(g([ev(0, a), ev(1, b), ev(4, b)])) === 'learning' && g([ev(0, a), ev(1, b), ev(4, b)])[2].kind === 'repeat');
  check('その後、数日後の初見で間違えたら「勉強中」に戻る', L.status(g([...solid, ev(11, d, { correct: false })])) === 'learning');
  check('反応時間は判定に影響しない', L.status(g(solid.map((e) => ({ ...e, ms: 999999 })))) === 'solid' && L.status(g([ev(0, a, { ms: 1 })])) === 'learning');
  check('読む記録だけでは、聴解は「未測定」のまま', L.status(g(solid, 'listen')) === 'none');
  const heard = [...solid, ev(5, a, { mode: 'listen' }), ev(8, b, { mode: 'listen' })];
  check('聞く記録は読む記録と別に数える', L.status(g(heard, 'listen')) === 'solid' && g(heard, 'read').length === 3, g(heard, 'listen').map((e) => e.kind));
  check('教材から消えた文の記録があっても壊れない', L.status(g([ev(0, 'zz-9999'), ev(0, a)])) === 'learning');

  // 復習の出し方
  const s0 = st([ev(0, a)]);
  const same = L.buildSession(D, s0, { now: at(0, 30) });
  const next = L.buildSession(D, s0, { now: at(1) });
  check('同じ日のうちは復習を出さない', same.info.review === 0, same.info);
  check('翌日、同じ文法を含む「別の文」が復習に出る', next.info.review >= 1 && next.list.some((s) => s.id !== a && s.grammar.includes('be')) && !next.list.some((s) => s.id === a), next.list.map((s) => s.id));
  const after = st(solid);
  const dueAfter = L.dueDay(g(solid));
  check('連続して正解すると間隔が伸びる（1→3→7日）', dueAfter === L.dayOf(at(4)) + 7, dueAfter - L.dayOf(at(4)));
  check('間違えたら翌日に戻る', L.dueDay(g([...solid, ev(11, d, { correct: false })])) === L.dayOf(at(11)) + 1);
  check('1回分は5文以内', L.buildSession(D, after, { now: at(20) }).list.length <= 5);
  check('棚をしぼると、その棚の文だけ出る', L.buildSession(D, st([]), { shelf: 'talk', now: at(0) }).list.every((s) => s.shelf === 'talk'));
  check('聞く入口は、読んだことのある文だけ', L.buildSession(D, s0, { mode: 'listen', now: at(1) }).list.map((s) => s.id).join() === a && L.buildSession(D, st([]), { mode: 'listen', now: at(1) }).list.length === 0);
  check('地図から入ると、その項目の文だけ出る', L.buildSession(D, st([]), { focus: 'be', now: at(0) }).list.every((s) => s.grammar.includes('be')));

  // 単語帳の再会
  const lemma = Object.keys(D.byLemma).find((l) => D.byLemma[l].length >= 2);
  if (lemma) {
    const [w1, w2] = D.byLemma[lemma].map((s) => s.id);
    const ws = { ...st([ev(0, w1)]), words: { [lemma]: { addedAt: at(0), metIn: [w1], ja: '' } } };
    const p = L.buildSession(D, ws, { now: at(1) });
    check('単語帳の単語（' + lemma + '）が、翌日に別の文で出る', p.list.some((s) => s.id !== w1 && s.words.some((w) => w.lemma === lemma)), p.list.map((s) => s.id));
    const wi = L.wordInfo(lemma, ws.words[lemma], D, L.history([...ws.events, ev(1, w2)], D).bySid);
    check('別の文で出会うと「再会」として数える', wi.reunions.length === 1 && wi.reunions[0].sid === w2);
  } else check('2つ以上の文に出る単語がある（再会の確認に必要）', false);

  // 保存・書き出し・読み込み
  const full = { ...st(solid), words: { free: { addedAt: at(0), metIn: [a], ja: '無料の' } } };
  const text = store.exportText(full);
  const r1 = store.importText(text, store.blank());
  check('書き出し → 空の端末に読み込みで、記録と単語が戻る', r1.state.events.length === 3 && r1.state.words.free && r1.added === 3 && r1.addedWords === 1);
  const r2 = store.importText(text, r1.state);
  check('同じファイルを2回読み込んでも重複しない', r2.state.events.length === 3 && r2.added === 0);
  const r3 = store.importText(text, st([ev(20, d)]));
  check('読み込みは合流（今ある記録は消えない）', r3.state.events.length === 4);
  check('復元後も状態は同じ', L.status((L.history(r1.state.events, D).g.be || {}).read) === 'solid');
  let threw = 0;
  for (const bad of ['こんにちは', '{}', JSON.stringify({ app: 'fathom', state: { version: store.VERSION + 1, events: [] } })]) { try { store.importText(bad, store.blank()); } catch { threw++; } }
  check('関係ないファイルや、新しすぎる形式は読み込まない', threw === 3);
  check('書き出しに形式のバージョンが入っている', JSON.parse(text).version === store.VERSION && JSON.parse(text).state.version === store.VERSION);
}

const ng = results.filter((r) => !r.ok).length;
document.getElementById('sum').textContent = ng ? `${results.length} 件中 ${ng} 件が失敗` : `${results.length} 件すべて通りました`;
window.testResults = { total: results.length, failed: results.filter((r) => !r.ok).map((r) => r.name) };
