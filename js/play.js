// いじれる例文: 主語・時・形（肯定／否定／疑問）を切り替えたときの文を作る。純粋な関数だけ。
// 動詞の表は data/playground.json。

export const SUBJECTS = [
  { id: 'I', en: 'I', ja: '私', be: 'am', was: 'was', s3: false },
  { id: 'you', en: 'you', ja: 'あなた', be: 'are', was: 'were', s3: false },
  { id: 'he', en: 'he', ja: '彼', be: 'is', was: 'was', s3: true },
  { id: 'she', en: 'she', ja: '彼女', be: 'is', was: 'was', s3: true },
  { id: 'we', en: 'we', ja: '私たち', be: 'are', was: 'were', s3: false },
  { id: 'they', en: 'they', ja: '彼ら', be: 'are', was: 'were', s3: false },
];
export const TENSES = [['present', '現在'], ['past', '過去'], ['future', '未来']];
export const FORMS = [['aff', '肯定'], ['neg', '否定'], ['q', '疑問']];

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// 返り値 { parts:[{ t, role, lab }], en, ja, notes:[文字列], links:[文法ID] }
// role は骨組みの色分けと同じ（S / aux / neg / V / x）
export function build(v, subj, tense, form) {
  const S = subj.en;
  const parts = [];
  const notes = [];
  const links = new Set();
  const add = (t, role, lab) => parts.push({ t, role, lab });
  const isBe = v.kind === 'be';

  if (isBe) {
    links.add('be');
    if (tense === 'future') {
      links.add('future');
      notes.push('will の後ろは原形なので、am / is / are ではなく be。主語が何でも will be で同じ。');
      if (form === 'aff') { add(S, 'S', '主語'); add('will', 'aux', '助動詞'); add('be', 'V', 'be動詞（原形）'); }
      if (form === 'neg') { add(S, 'S', '主語'); add("won't", 'neg', '否定（will＋not）'); add('be', 'V', 'be動詞（原形）'); notes.push("will not は、縮めて won't と言う。"); }
      if (form === 'q') { add('will', 'aux', '助動詞'); add(S, 'S', '主語'); add('be', 'V', 'be動詞（原形）'); notes.push('will を主語の前に出すと質問になる。'); }
    } else {
      const b = tense === 'past' ? subj.was : subj.be;
      if (tense === 'past') { links.add('past'); notes.push(`過去なので ${b}（I / he / she / it は was、you / we / they は were）。`); }
      else notes.push(`主語が ${S} なので、be動詞は ${b}。`);
      if (form === 'aff') { add(S, 'S', '主語'); add(b, 'V', 'be動詞'); }
      if (form === 'neg') {
        links.add('negative');
        notes.push('be動詞は、すぐ後ろに not を付ける（do は使わない）。');
        if (b === 'am') { add("I'm", 'S', '主語＋be動詞'); add('not', 'neg', '否定'); notes.push("縮めるときは I'm not（amn't という形はない）。I am not のままでもよい。"); }
        else { add(S, 'S', '主語'); add(b + "n't", 'neg', '否定（be動詞＋not）'); }
      }
      if (form === 'q') { links.add('question'); add(b, 'V', 'be動詞'); add(S, 'S', '主語'); notes.push('be動詞を主語の前に出すと質問になる。'); }
    }
  } else {
    links.add('verb');
    const irregular = v.kind === 'irregular';
    if (tense === 'present') {
      if (form === 'aff') {
        add(S, 'S', '主語'); add(subj.s3 ? v.s : v.base, 'V', '動詞');
        if (subj.s3) { links.add('s3'); notes.push(`主語が ${S}（he / she / it の仲間）なので、動詞に s が付く（${v.base} → ${v.s}）。`); }
        else notes.push(`主語が ${S} なので、動詞は原形のまま。`);
      } else {
        const d = subj.s3 ? 'does' : 'do';
        if (form === 'neg') { links.add('negative'); add(S, 'S', '主語'); add(d + "n't", 'neg', `否定（${d}＋not）`); add(v.base, 'V', '動詞（原形）'); notes.push('一般動詞には直接 not を付けられないので、do を呼ぶ。'); }
        else { links.add('question'); add(d, 'aux', '質問の合図'); add(S, 'S', '主語'); add(v.base, 'V', '動詞（原形）'); notes.push('一般動詞の質問は、do を主語の前に置く。'); }
        if (subj.s3) { links.add('s3'); notes.push(`主語が ${S} なので does。s は does が引き受けたので、動詞は原形の ${v.base} に戻る（${v.s} にしない）。`); }
        else notes.push(`主語が ${S} なので do のまま。`);
      }
    } else if (tense === 'past') {
      links.add('past');
      if (form === 'aff') {
        add(S, 'S', '主語'); add(v.past, 'V', '動詞（過去形）');
        notes.push(irregular ? `${v.base} の過去形は ${v.past}（不規則動詞）。主語が何でも同じ形。` : v.pastNote || `過去形は -ed を付ける（${v.base} → ${v.past}）。主語が何でも同じ形。`);
      } else if (form === 'neg') {
        links.add('negative');
        add(S, 'S', '主語'); add("didn't", 'neg', '否定（did＋not）'); add(v.base, 'V', '動詞（原形）');
        notes.push(`過去の否定は didn't。did が「過去」を引き受けるので、動詞は原形の ${v.base} に戻る（${v.past} にしない）。`);
      } else {
        links.add('question');
        add('did', 'aux', '質問の合図（過去）'); add(S, 'S', '主語'); add(v.base, 'V', '動詞（原形）');
        notes.push(`過去の質問は did を主語の前に置く。did が「過去」を引き受けるので、動詞は原形の ${v.base} に戻る（${v.past} にしない）。`);
      }
    } else {
      links.add('future');
      notes.push('will ＋動詞の原形。主語が何でも形は変わらない（s も付かない）。');
      if (form === 'aff') { add(S, 'S', '主語'); add('will', 'aux', '助動詞'); add(v.base, 'V', '動詞（原形）'); }
      if (form === 'neg') { links.add('negative'); add(S, 'S', '主語'); add("won't", 'neg', '否定（will＋not）'); add(v.base, 'V', '動詞（原形）'); notes.push("will not は、縮めて won't と言う。"); }
      if (form === 'q') { links.add('question'); add('will', 'aux', '助動詞'); add(S, 'S', '主語'); add(v.base, 'V', '動詞（原形）'); notes.push('will を主語の前に出すと質問になる。'); }
    }
  }
  if (isBe && form !== 'aff' && tense === 'future') links.add(form === 'neg' ? 'negative' : 'question');
  add(v.rest, 'x', '');
  parts[0].t = cap(parts[0].t);
  const en = parts.map((p) => p.t).join(' ') + (form === 'q' ? '?' : '.');

  // 訳: ます形の4つ（〜ます / 〜ません / 〜ました / 〜ませんでした）から作る
  const four = isBe ? v.ja : ['ます', 'ません', 'ました', 'ませんでした'].map((e) => v.jaObj + v.jaStem + e);
  let pred = four[(tense === 'past' ? 2 : 0) + (form === 'neg' ? 1 : 0)];
  let lead = '';
  if (tense === 'future') {
    // 状態（be、have time など）は「〜でしょう」の訳を別に持つ。動作は「（これから）〜ます」
    if (v.jaFuture) pred = v.jaFuture[form === 'neg' ? 1 : 0];
    else lead = '（これから）';
  } else if (tense === 'present' && !isBe && !v.state) {
    // 動作を表す動詞の現在形は「ふだんそうしている」。日本語の「〜ます」だけだと、これからの話に聞こえるため
    lead = '（ふだん）';
  }
  const ja = subj.ja + 'は' + lead + pred + (form === 'q' ? 'か。' : '。');
  // I を主語にした質問は、形は正しいが、使う場面が限られる
  if (subj.id === 'I' && form === 'q') notes.push('形は正しい文ですが、自分のことを相手にたずねる形なので、使う場面は限られます。');
  return { parts, en, ja, notes, links: [...links] };
}
