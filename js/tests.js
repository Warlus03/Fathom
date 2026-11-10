// 学習の規則と保存の動作確認。tests.html を開くと走る。
// 実際の記録（localStorage）には触らない。教材は本物を読み、検査結果も表示する。
import * as L from './learn.js';
import * as store from './store.js';
import { loadData, refreshData, validate } from './data.js';

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
try { D = (await refreshData(D)).data || D; } catch {} // 保存済みではなく、最新の教材で確かめる
check('教材: すべての文が検査に通る（' + D.sentences.length + '文）', D.problems.length === 0, D.problems);
const testing = (gid) => D.sentences.filter((s) => L.targetsOf(s).includes(gid)).length;
const few = D.grammar.items.filter((g) => testing(g.id) < 3).map((g) => g.id + '(' + testing(g.id) + ')');
check('教材: どの文法項目にも、それを確かめる問いが3本以上ある（「分かる」に届くのに必要）', !few.length, few);
const withTargets = D.sentences.filter((s) => s.question.targets).length;
check('教材: 問いが確かめる文法（question.targets）の指定 ' + withTargets + ' / ' + D.sentences.length + ' 文（未指定の文は、付いている文法すべてに正誤が数えられる）', true);

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
  check('読んだことがあっても、初めて聞いた回は聴解の「初見」（読解の日付を借りない）', g(heard, 'listen').map((e) => e.kind).join() === 'first,delayed' && L.status(g(heard, 'listen')) === 'learning', g(heard, 'listen').map((e) => e.kind));
  const heard3 = [...heard, ev(12, c, { mode: 'listen' })];
  check('聞く記録は読む記録と別に数える', L.status(g(heard3, 'listen')) === 'solid' && g(heard3, 'read').length === 3, g(heard3, 'listen').map((e) => e.kind));
  check('同じ日に読んだ文を聞いても、聴解の根拠にしない', g([ev(0, a), ev(1, b), ev(1, b, { mode: 'listen', min: 30 })], 'listen')[0].kind === 'repeat');
  check('音声が再生されなかった回は、聴解の根拠にしない', g([...heard, { ...ev(12, c, { mode: 'listen' }), heard: false }], 'listen')[2].kind === 'unheard' && L.status(g([...heard, { ...ev(12, c, { mode: 'listen' }), heard: false }], 'listen')) === 'learning');
  check('14日後に同じ文へ正解しても、初見には数えない', L.status(g([ev(0, a), ev(1, b), ev(15, a)])) === 'learning' && g([ev(0, a), ev(1, b), ev(15, a)])[2].kind === 'repeat');
  check('30日以上空いた文は「久しぶりの文」として数える（初めて見る文での正解が別に1回必要）', L.status(g([ev(0, a), ev(1, b), ev(40, a)])) === 'solid' && g([ev(0, a), ev(1, b), ev(40, a)])[2].kind === 'revisit' && L.status(g([ev(0, a), ev(40, a), ev(80, a)])) === 'learning');
  const gview = (day) => ({ t: at(day, -5), sid: '', gid: 'be', mode: 'map', helped: false, correct: null, choice: null, ms: null });
  check('地図で解説を読んだその日の正解は、数日後の初見に数えない', g([ev(0, a), gview(1), ev(1, b)])[1].kind === 'sameday' && g([ev(0, a), ev(1, b)])[1].kind === 'delayed');
  check('答えずに見ただけの文は、次に答えても初見に数えない', g([ev(0, a), { ...ev(1, b), correct: null }, ev(3, b)])[2].kind === 'repeat');
  const mini = { byId: { x: { id: 'x', grammar: ['be', 'article'], question: { targets: ['be'] }, words: [] } } };
  const hm = L.history([ev(0, 'x')], mini).g;
  check('問いが確かめていない文法には、正誤を数えない（question.targets）', hm.be && hm.be.read.length === 1 && !hm.article);
  check('targets に、その文の grammar にない項目を書くと検査で落ちる', validate({ ...D.sentences[0], question: { ...D.sentences[0].question, targets: ['zzz'] } }, null).length > 0);
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
  const itto = D.sentences.filter((s) => L.targetsOf(s).includes('it-to'));
  const allRead = st(itto.map((s, i) => ev(0, s.id, { min: i })));
  const p2 = L.buildSession(D, allRead, { now: at(1) });
  check('項目の文をすべて読んだ翌日も、その項目の復習が出る（既出の文で）', p2.list.some((s) => L.targetsOf(s).includes('it-to')), p2.list.map((s) => s.id));
  const peek = st([{ ...ev(0, d), correct: null }]);
  check('読みかけで離れた文は、次の回の先頭に出る', L.buildSession(D, peek, { now: at(0, 10) }).list[0].id === d);
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
  const wrap = (state) => JSON.stringify({ app: 'fathom', state: { version: store.VERSION, ...state } });
  let rejected = 0;
  for (const bad of [wrap({ events: [], words: { use: null } }), wrap({ events: [{ t: at(0), sid: a, mode: 'read', correct: 'false' }], words: {} }), wrap({ events: [{ t: at(0), sid: a, mode: 'sing', correct: true }], words: {} })]) { try { store.importText(bad, store.blank()); } catch { rejected++; } }
  check('形の合わない記録（単語が null、正誤が文字、知らない mode）は読み込まない', rejected === 3);
  const merged = store.mergeEvents([ev(0, a), ev(1, b)], [ev(1, b), ev(2, c)]);
  check('2つの画面の記録を合わせても、消えず、重複しない', merged.length === 3 && merged.map((e) => e.sid).join() === [a, b, c].join());
  check('書き出しに形式のバージョンが入っている', JSON.parse(text).version === store.VERSION && JSON.parse(text).state.version === store.VERSION);
}

const ng = results.filter((r) => !r.ok).length;
document.getElementById('sum').textContent = ng ? `${results.length} 件中 ${ng} 件が失敗` : `${results.length} 件すべて通りました`;
window.testResults = { total: results.length, failed: results.filter((r) => !r.ok).map((r) => r.name) };
