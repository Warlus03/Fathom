# Fathom 教材レビュー（独立レビュー）

- 実施日: 2026-11-10
- 対象: `data/grammar.json`（31項目とグループ説明）と `data/sentences/*.json`（87本）
- 確認範囲: **87本すべて、最後まで確認しました（途中で止めていません）。** 各文の `en` / `ja` / `aim` / `pitfall` / `chunks`（`why` とラベル）/ `words` / `question` を読みました。`aim`・`pitfall`・`why`・`explain` は画面に出る文なので（`js/app.js` 133〜182行）、すべて学習者が読む説明として扱いました。
- 今回は指摘だけで、教材とコードは変更していません。

## 重要度の基準

| 重要度 | 基準 |
|---|---|
| **高** | 書いてある規則どおりに読むと、このアプリ自身の文で誤読が起きる。または、説明として意味が通らない（実際に理解できなかったという報告がある） |
| **中** | 必要な条件や例外が抜けていて、よく出会う英文で誤解しやすい。問いが狙った理解を確かめていない。訳が英文の意味とずれている |
| **低** | 言い回し、用語、細部。直すと分かりやすくなる |

## 全体の所見

- **英文**: 87本すべて、文法的に正しく自然です。英文そのものの誤りは見つかりませんでした。
- **和訳**: ほぼすべて英文と対応しています。意味のずれは1件です（t-0031）。
- **問題の答え**: 87問すべてで、正解は1つに決まります。ただし、狙った文法を確かめられていない問いが1件（t-0005）、選択肢の1つが文の形になっていない問いが1件（r-0032）あります。
- **主な問題は `grammar.json` の「短くまとめた規則」です。** 初学者向けに一文で言い切ったために条件が抜け、アプリ自身の文と食い違っている箇所があります。ご指摘の「三単現の s」の一文がその典型です。

## 先に直したいもの（一覧）

| 番号 | 場所 | 内容 | 重要度 |
|---|---|---|---|
| G-1 | grammar.json `s3` | 「動詞に s が付いていたら、主語はひとり・ひとつで、今の話」が不正確で、意味も伝わらない | **高** |
| G-2 | grammar.json `infinitive` | to＋動詞の「位置で見分ける」規則が、r-0026・r-0027 と食い違う | **高** |
| G-3 | grammar.json `progressive` | 「今まさに」に限定しすぎ。「現在形は今のことを言わない」も言い過ぎ | 中 |
| G-4 | grammar.json `conjunction` | 「接続詞の後ろには主語＋動詞」と「if の中は未来でも現在形」に条件が抜けている | 中 |
| G-5 | grammar.json `indirect` | ここでの if が「〜かどうか」だと書かれていない | 中 |
| G-6 | grammar.json `pronoun` ほか3文 | 「動詞の後ろなら me」は位置の規則で、I wish I had 〜 と合わない | 中 |
| G-7 | grammar.json `obligation` / t-0021 | have to を助動詞として扱っているが、助動詞の決まりが当てはまらない | 中 |
| G-8 | grammar.json `obligation` | must「〜に違いない」、should「〜のはず」の意味が抜けている | 中 |
| G-9 | grammar.json `gerund` / t-0024 | 「ing を取るのは現に行っていることだから」を理由として言い切っている | 中 |
| G-10 | grammar.json `adjective` | 「副詞は外しても文が成り立つ」に、not や well（t-0013）の例外がない | 中 |
| G-11 | grammar.json 全体 | 「原形」「過去分詞」「一般動詞」が一度も説明されていない | 中 |
| S-1 | r-0007 | 「するつもりがないなら I don't log in.」は誤り | 中 |
| S-2 | t-0005 | 問いが this morning だけで答えられ、was の理解を確かめていない。解説の理由付けもずれている | 中 |
| S-3 | t-0018 | 「Let us の短い形。us なので相手も含む」だと Let us know を誤読する | 中 |
| S-4 | t-0031 | doesn't speak Japanese を「話しません」と訳している（「話せません」が近い） | 中 |

その他の **低** は、下の各節に書いています。

---

## 1. ご質問の「三単現の s」について（G-1・高）

場所: [grammar.json:64-66](data/grammar.json:64)（`s3` の `what` と `why`）

### 現在の記述

> what: 現在の文で、主語が「私・あなた以外の、ひとり・ひとつ」（he, she, it, 人の名前, this app など）のとき、動詞に s を付けます。意味は変わりません。
> why（最後）: 読むときの実用としては、「動詞に s が付いていたら、主語はひとり・ひとつで、今の話」という手がかりになります。

### 本来言いたかったこと

「`works` のように主語の直後の動詞が s で終わっていたら、そこから2つのことが分かる。①主語は he / she / it の仲間、②文は現在形」という読み方のコツです。言いたいこと自体は正しいのですが、一文に縮めたために次の問題が出ています。

### 問題の理由

1. **「ひとり・ひとつ」が条件として不正確です。**
   - I（私）と you（あなた）もひとりですが、s は付きません（I work）。`what` では「私・あなた以外の」と断っていますが、`why` の一文ではその条件が落ちています。そのため「ひとりなら s」と逆向きに覚える危険があります。
   - 反対に、多くの人を指すのに s が付く主語があります。`everyone`（全員）は意味では大勢ですが、Everyone knows it. のように s が付きます（r-0015 に everyone が出てきます）。数えない物（Water is 〜, Information helps 〜）や「〜すること」（Learning English takes time.）も同じです。
   - 決めているのは、意味の上の人数ではなく、文法上の「he / she / it の仲間か」です。

2. **「今の話」は、アプリ内の別の説明やアプリ自身の文と矛盾します。**
   - `progressive` の `why`（[grammar.json:76](data/grammar.json:76)）には「普通の現在形は…習慣を表し、今この瞬間のことは言いません」とあります。二つの項目で、現在形について反対のことを言っています。
   - t-0032 の If it **rains** tomorrow は明日の話です。t-0012 の When **does** the next bus come? も、これから来るバスの話です。どちらも s が付いていますが、「今の話」ではありません。
   - 現在形の中心は「ふだん・いつも・今の状態」です。She works from home.（`s3` の例文）も「ふだん在宅で働いている」という意味です。

3. **「動詞に s が付いていたら」の、どの語が動詞なのかが分かりません。**
   - s で終わる語は他にもあります。名詞の複数形（tools, ways）、**was（過去形）**、it's / let's の 's などです。特に was は s で終わっていて、しかも過去の形です。t-0005 の It **was** really cold では、この手がかりがそのまま外れます。

4. **「意味は変わりません」が何と比べているのか分かりません。** 「s 自体には意味がない（主語に合わせて付く目印）」と言いたいのだと思われます。

5. **条件と形の変化が抜けています。**
   - can / will の後ろ、does / doesn't の後ろでは s が付きません（She can swim. / Does she work?）。`negative` と `question` の項目には書かれていますが、`s3` の項目だけを読むと分かりません。
   - es / ies / has / is になる形の変化も書かれていません。t-0017 の why には「ch で終わる語は es」と出てきます。

6. **用語とグループ**: 「三単現」が「三人称・単数・現在」の略だという説明がありません。また `s3` は「時を表す」グループ（「いつの話かは、動詞の形に出ます」）に入っています。これも「s＝時（今）の印」という誤解を強めています。

### 修正案

`name`: 「三単現の s（he / she / it の現在形）」

`what`:
> ふだんのことや今の状態を言う形（現在形）で、主語が he / she / it の仲間のときは、動詞の終わりに s を付けます。三単現は「三人称・単数・現在」の略です。
> he / she / it の仲間とは、I（私）と you（あなた）以外で、1つとして数えるもの全部です。人や物の名前（Ken, this app）、数えない物（water）、everyone（みんな）、「〜すること」（Learning English）も入ります。
> I と you には、ひとりでも付けません（I work / You work）。複数（we, they, people）にも付けません。
> s 自体には意味がなく、「主語が he / she / it の仲間だ」という目印です。
> can / will の後ろや、does / doesn't の後ろの動詞には付けません（She can swim. / Does she work?）。s は does のほうに移っています。
> 形: ふつうは s（works）。s, sh, ch, x, o で終わる語は es（teaches, goes）。「子音＋y」で終わる語は y を i に変えて es（study → studies）。have は has、be は is になります。

`why`: 前半（歴史の説明）はそのままでよいです。最後の段落を次に替えます。
> 読むときの手がかり: 主語のすぐ後ろの動詞が s で終わっていたら、主語は he / she / it の仲間で、文は現在形です。
> ただし現在形は「今この瞬間」より、「ふだん・いつも」のことを言うのが中心です（She works from home.＝ふだん在宅で働いている）。if や when の後ろでは、明日のことにも使います（If it rains tomorrow, …）。
> また、s で終わる語がすべてこの s とは限りません。名詞の複数形（tools）、was（過去）、it's の 's は別のものです。

グループ: 「文の骨組み」に移すか、「時を表す」に残すならグループの説明に「主語に合わせた形の変化も含む」と書き足すことを勧めます。

関連箇所（直さなくても誤りではありません。`s3` を直すなら表現をそろえるとよいです）: 「主語が〜（ひとつ）なので s / does」という why が r-0001:24、r-0004:25、r-0005:18、r-0010:23、t-0012:23、t-0033:35 にあります。「（ひとつ）」を「（he / she / it の仲間）」にすると、上の説明とつながります。

---

## 2. grammar.json の指摘

### G-2　to＋動詞の「位置で見分ける」規則（高）

場所: [grammar.json:131](data/grammar.json:131)（`infinitive` の `why` 第2段落）

- **現在の記述**: 「動詞の直後なら『〜すること』、文の骨組みが終わった後なら『〜するために』、名詞の直後なら『〜するための』」
- **問題の理由**:
  - r-0027 I use **AI to save time.** では、to は名詞 AI の直後にあります。この規則だと「時間を節約するためのAI」と読めますが、正しくは「〜するために」（目的）です。「骨組みが終わった後」と「名詞の直後」が同じ位置になることがあり、位置だけでは決まりません。
  - r-0026 I asked **the AI to summarize** the article. も名詞の直後ですが、意味は「AIに要約するよう（頼んだ）」です。この「人＋to〜」の使い方は、3つの使い方のどれにも入っていません。ask / tell / want＋人＋to〜 は非常によく出る形です。
  - 「動詞の直後なら『〜すること』」も、I came to see you.（会いに来た＝目的）のように当てはまらない場合があります。
- **修正案**（`why` 第2段落の差し替え）:
  > 使い方は、位置だけでは決まりません。次の順に確かめます。
  > ① want, need, try, decide, hope などの「何を」の位置 → 「〜すること」（I want to try it.）
  > ② ask, tell, want などの後ろに「人＋to〜」→ 「人に〜するように（頼む・言う）」。to の動作をするのはその人です（I asked the AI to summarize the article.）
  > ③ 名詞の直後で、その名詞の中身を言っている → 「〜するための・〜する」（many ways to use it）
  > ④ to の手前で文の骨組みができていて、「何のために？」に答えている → 「〜するために」（I use AI to save time.）
  > ③と④はどちらも名詞の直後に来ることがあるので、名詞の中身なのか、動作の目的なのかを意味で確かめます。
- `what` にも ② の例（I asked him to help me.）を1つ足すとよいです。

### G-3　進行形の範囲と、現在形の説明（中）

場所: [grammar.json:75-76](data/grammar.json:75)

- **現在の記述**: 「『今まさに〜している最中』を表します」「普通の現在形（I use it.）は…習慣を表し、今この瞬間のことは言いません」
- **問題の理由**:
  - 進行形は「このところ〜している（一時的に続いている）」も表します。r-0014 A lot of people are talking about this. や r-0008 They are testing a new feature. は、この瞬間ではなく、ここ最近の状況です。
  - 「現在形は今この瞬間のことを言わない」は、動作の動詞にしか当てはまりません。r-0010 This **looks** great.、r-0038 I **think** this is a bug.、t-0030 I'm glad you **like** it. はどれも現在形で、今のことを言っています。同じ項目の第2段落では状態の動詞に触れていますが、第1段落で先に言い切っています。
  - さらに G-1 の「今の話」と矛盾しています。
- **修正案**:
  - what: 「be動詞＋ing で、『今ちょうど〜している』や『このところ〜している（一時的に続いている）』を表します。」
  - why の1文目: 「動作を表す動詞（use, work, walk）の普通の現在形は、『ふだんそうしている』という習慣を表します（I use it.）。今やっている途中を言うには進行形を使います。一方、know, like, think、〜に見える の look など『状態』を表す動詞は、現在形のままで今のことを言えます（I know. / This looks great.）。」

### G-4　接続詞の2つの言い切り（中）

場所: [grammar.json:151](data/grammar.json:151)

- **(a) 現在の記述**: 「接続詞の後ろには『主語＋動詞』がもう一組来ます」
  - **問題の理由**: 同じ項目で and, but, or は「対等なものをつなぐ」とあり、つなぐのは文だけではありません。t-0003 Go straight **and turn** left では、and の後ろに主語がありません。you and me のように名詞どうしもつなぎます。
  - **修正案**: 「because, when, if, although の後ろには『主語＋動詞』がもう一組来ます。and, but, or は、文と文だけでなく、動詞と動詞（Go straight and turn left.）や名詞と名詞（you and me）もつなぎます。」
- **(b) 現在の記述**: 「when や if の中では、未来のことでも現在形を使います」
  - **問題の理由**: これが当てはまるのは、「〜のとき」「もし〜なら」と文に時や条件を足す場合だけです。`indirect` の項目で扱う「〜かどうか」の if や、「いつ〜か」の when では、未来なら will を使います（I don't know **if it will rain** tomorrow.）。今の書き方では、`indirect` の項目と食い違います。
  - **修正案**: 「when や if が『〜のとき』『もし〜なら』の意味で文に時や条件を足すときは、未来のことでも現在形を使います（If it rains tomorrow, …）。ただし know や ask の後ろで『〜かどうか』『いつ〜か』を表すときは、未来なら will を使います（I don't know if it will rain tomorrow.）。」

### G-5　文の中の質問の if（中）

場所: [grammar.json:165](data/grammar.json:165)

- **現在の記述**: 「what, where, how, why, if などで始まるかたまりを…」
- **問題の理由**: 学習者は if を `conjunction` の項目で「もし〜なら」と習います。ここでの if は「〜かどうか」で、意味が違います。その説明がありません。
- **修正案**: what の末尾に足します。「ここでの if は『もし』ではなく『〜かどうか』です（I don't know if it works.＝動くかどうか分からない）。」

### G-6　代名詞の形を「位置」で説明している（中）

場所: [grammar.json:105](data/grammar.json:105)。同じ言い方の why が r-0003.json:29、t-0015.json:28、r-0048.json:28 にあります（「〜ではなく me。動詞の後ろに来たときの形」）。

- **現在の記述**: 「動詞や前置詞の後ろなら me / him / her / us / them」
- **問題の理由**: 形を決めるのは位置ではなく役目です。アプリ内の t-0036 I wish **I** could speak 〜 と r-0050 I wish **I** had more time では、I が動詞 wish のすぐ後ろにありますが、新しい文の主語なので I のままです。規則どおりだと me になってしまいます。I think he is right. なども同じです。また you と it は主語でも目的語でも同じ形だということも、書かれていません。
- **修正案**:
  - grammar.json: 「動詞や前置詞の『〜を・〜に』にあたるなら me / him / her / us / them。決めるのは位置ではなく役目なので、I wish I had more time. のように動詞のすぐ後ろでも、新しい文の主語なら I のままです。you と it は、主語でも『〜を・〜に』でも同じ形です（持ち主を表す形は your / its）。」
  - 3文の why: 「動詞の後ろに来たときの形」→「動詞の『誰に・誰を』にあたるときの形」

### G-7　have to を助動詞として扱っている（中）

場所: [grammar.json:91](data/grammar.json:91)（`can` の「助動詞の3つの決まり」）と [grammar.json:95-96](data/grammar.json:95)（`obligation`）。t-0021.json:21-23 で `have to` が `role: "aux"` になっていて、文法用語表示では「助動詞」と出ます。

- **問題の理由**: `can` の項目では、助動詞の決まりを「主語が何でも形が変わらない」「否定と疑問に do を使わない」と説明しています。have to はどちらにも当てはまりません。主語によって has to になり、否定は don't have to（r-0016 そのもの）、疑問は Do I have to? です。同じ「助動詞」グループに入っているので、学習者は矛盾に戸惑います。
- **修正案**:
  - `obligation` の why に足します。「have to は意味が must に近いのでここに入れていますが、形の上では一般動詞の have です。主語によって has to、過去は had to、否定は don't / doesn't have to、質問は Do I have to? になります。can の項目の『助動詞の3つの決まり』は当てはまりません。」
  - t-0021 の `have to` に `term: "have to（形は一般動詞）"` を付けます。why には「can などと違い、主語が he / she なら has to、否定は don't have to になる」と足します。

### G-8　must と should の「推測」の意味が抜けている（中）

場所: [grammar.json:95](data/grammar.json:95)

- **問題の理由**: must は「〜に違いない」（You must be tired.＝お疲れでしょう）、should は「〜のはず」（It should work now.＝もう動くはず）の意味でもよく使われます。特に「This should fix it.」「It should work now.」はAI・アプリ関連の文でとても多い言い方です。今の説明だけだと「動くべきだ」と読んでしまいます。
- **修正案**: what の末尾に足します。「must には『〜に違いない』、should には『〜のはず』という、話し手の推測の使い方もあります（You must be tired. / It should work now.）。後ろが be や状態を表す動詞のときは、こちらの意味のことが多いです。」

### G-9　ing を取る理由の言い切り（中）

場所: [grammar.json:136](data/grammar.json:136)、t-0024.json:27

- **現在の記述**: 「enjoy, finish, stop, keep の後ろが ing なのは、どれも現に行っていることが相手だからです」。t-0024 の why は「実際にしていることを楽しむので」。
- **問題の理由**: これは覚えるための目安で、規則ではありません。avoid（避ける）、consider（検討する）、mind（気にする）、imagine（想像する）は、まだしていないことでも ing を取ります。理由として言い切ると、学習者は「これからのことだから to」と考えて、× consider to buy のような形を作ります。README の「確かなものだけ書く」にも合いません。
- **修正案**: 「enjoy, finish, stop, keep の後ろが ing になるのは、現に行っていることが相手だから、と考えると覚えやすいです。ただしこれは傾向で、avoid（避ける）や consider（検討する）のように、まだしていないことでも ing を取る動詞があります。どちらを取るかは、最後は動詞ごとに覚えます。」t-0024 の why は「enjoy の後ろは ing 形（to＋動詞は使わない）。」程度で十分です。

### G-10　副詞は外しても文が成り立つ（中）

場所: [grammar.json:121](data/grammar.json:121)

- **問題の理由**: 文の形は崩れませんが、意味が大きく変わる副詞があります。not や never は副詞です。t-0013 I can't speak English **well** から well を外すと、「上手には話せない」が「まったく話せない」に変わります（このアプリ自身がその誤読を問いにしています）。
- **修正案**: 第2段落の末尾に足します。「ただし not, never や、can't speak English well の well のように、外すと意味が大きく変わる副詞もあります。骨組みを取るときは外し、意味を確かめるときは戻して読みます。」

### G-11　「原形」「過去分詞」「一般動詞」が説明されていない（中）

場所: grammar.json 全体（`perfect`・`passive`・`participle`・`negative`・`can` など）

- **問題の理由**: 「動詞の原形」「過去分詞」「一般動詞」は多くの項目と why に出てきますが、どこにも説明がありません。中学英語の途中で止まった大人には、特に「過去分詞」が分からない可能性が高いです。規則動詞では過去形と過去分詞が同じ -ed の形なので、r-0045 のような「過去形か過去分詞か」の見分けが、そもそも何の話か分からなくなります。
- **修正案**: `past` の項目（または各グループのはじめ）に短い説明を足します。
  > 原形: 辞書に載っている形。s も ed も付かない（work, go）。
  > 一般動詞: be動詞（am / is / are など）以外の動詞（use, go, like）。
  > 過去分詞: 動詞の3つ目の形。規則動詞は過去形と同じ -ed（used, fixed）。不規則動詞は別の形のこともある（see – saw – seen）。have と組むと現在完了、be と組むと受け身、名詞の後ろに置くと「〜された」という説明になる。

### G-12　「文頭に Do / Does / Is / Can が見えたら質問」（低）

場所: [grammar.json:51](data/grammar.json:51)

- **問題の理由**: r-0022 **Don't** click the link 〜 のように、Do で始まる命令文もあります（Do it now. / Don't 〜.）。
- **修正案**: 「文頭に Do / Does / Is / Can があり、そのすぐ後ろに主語が来たら質問です。Don't click 〜. のような命令文は、後ろに主語がありません。」

### G-13　「物を先に言うときは to」（低）

場所: [grammar.json:31](data/grammar.json:31)

- **問題の理由**: t-0022 My son made me this card. を言い換えると My son made this card **for** me. で、to ではありません。make, buy, get, cook などは for を使います。
- **修正案**: 「物を先に言いたいときは to か for を使います。give, send, show, tell, teach は to（She sent the link to me.）、make, buy, get, cook は for（My son made this card for me.）。」

### G-14　「人に・物を」と「AをBにする」の見分け方の言い回し（低）

場所: [grammar.json:36](data/grammar.json:36)

- **現在の記述**: 「be動詞を入れて文になれば…ならなければ（× I am the link.）」
- **問題の理由**: I am the link. は文としては正しい英文なので、「文にならない」と言うと混乱します。見ているのは意味です。
- **修正案**: 「2つの間に be動詞を入れて、『A は B だ』という関係が実際に成り立てば（me＝happy → I am happy.）この形、成り立たなければ（me は the link ではない）『人に・物を』の形です。」

### G-15　不規則動詞の由来の一般化（低）

場所: [grammar.json:71](data/grammar.json:71)

- **問題の理由**: 「不規則動詞は…古い英語のやり方（母音を変える）の生き残り」と、すべてがそうであるかのように書いています。しかし同じ項目の例の go → went は別の動詞の形を借りたものです。make → made や send → sent も、母音を変える型ではありません。README の「歴史や由来は確かなものだけ書く」に照らすと、言い過ぎです。
- **修正案**: 「不規則動詞の**多く**は、古い英語のやり方の生き残りです。」とし、例を sing → sang、drink → drank、give → gave のような母音が変わる動詞にそろえます。

### G-16　will と be going to の分け方（低）

場所: [grammar.json:80](data/grammar.json:80)

- **問題の理由**: 「will はその場で決めたこと、be going to はすでに決めてある予定」と分けています。しかし r-0013 It **will** be available next week. は、会社がすでに決めている予定を will で言っています。お知らせなどの書き言葉では、これが普通です。
- **修正案**: 末尾に足します。「これは主に話し言葉での傾向です。お知らせなどの書き言葉では、決まっている予定にも will をよく使います（It will be available next week.）。」

### G-17　Please を付けると丁寧（低）

場所: [grammar.json:60](data/grammar.json:60)

- **問題の理由**: Please を付けても命令の形であることは変わりません。目上の人への頼みごとでは、きつく聞こえることがあります。大人の学習者が実際に使う場面で困る点です。
- **修正案**: 「Please を付けるとやわらかくなりますが、命令の形であることは変わりません。頼みごとをより丁寧にするなら Could you 〜?（『頼む・申し出る』の項目）を使います。」

### G-18　can の過去は could（低）

場所: [grammar.json:90](data/grammar.json:90)

- **問題の理由**: could は、昔できたこと（能力）や否定（couldn't）には使えます。しかし「そのとき1回できた」には、ふつう was able to / managed to を使います（I was able to log in.）。また could は依頼や「〜かもしれない」の意味も多く、過去とは限りません。
- **修正案**: 「過去は could（昔〜できた）。ただし『そのとき1回できた』は was able to を使うのが普通です。could は丁寧な依頼（Could you 〜?）にも使い、その場合は過去の意味はありません。」

### G-19　a / the の説明に my・this と数えない名詞がない（低）

場所: [grammar.json:110](data/grammar.json:110)

- **問題の理由**: 「数えられる名詞はそのままでは使えない。a / the / 複数形のどれか」とだけ書いています。アプリの文にとても多い my dog / this tool / their new tool（a も the もない）が、この説明では分かりません。数えない名詞（time, information, advice。r-0027 save time、r-0050 more time）にも触れていません。
- **修正案**: 「my, your, this, that などが付くときは、a / the は付けません（my dog, this tool）。time, information のような数えない名詞には、a も複数形の s も付けません。」

### G-20　関係代名詞の説明（低）

場所: [grammar.json:160](data/grammar.json:160)

- **問題の理由**: 「who / which / that ＋文」とありますが、後ろは完全な文ではなく、説明される名詞の分だけ欠けています（who made this には主語がない）。読むときのいちばんの手がかりなのに、書かれていません。また who は人、which は物、that はどちらにも使える、という使い分けもありません。
- **修正案**: 「後ろの文は、説明される名詞の分だけ欠けています（the person who made this → 作ったのは the person）。who は人、which は物、that はどちらにも使います。」

### G-21　仮定法に過去の話がない（低）

場所: [grammar.json:175](data/grammar.json:175)

- **問題の理由**: 今の現実と違うことは過去形で言います。過去の現実と違うことは had＋過去分詞で言います（If I had known, … / I wish I had known.）。SNSでもよく出会う形ですが、触れていません。I wish I had more time.（had は「持つ」の過去形）と I wish I had known.（had は助動詞）は見た目が似ているので、混同しやすい点です。
- **修正案**: 末尾に足します。「過去のことを『実際とは違うけれど』と言うときは、もう一段さかのぼって had＋過去分詞にします（I wish I had known.＝知っていればよかった）。」

### G-22　比較の「長い語は more」（低）

場所: [grammar.json:125](data/grammar.json:125)、t-0023.json:41

- **問題の理由**: 「長い語」の基準がありません。slowly は2音節ですが more slowly です。t-0023 の why「-ly で終わる副詞は more で比べる」は正しい目安ですが、early → earlier の例外があります。
- **修正案**: grammar.json は「3音節以上の語、多くの2音節の語、-ly で終わる副詞（slowly）は more / most を使います」。t-0023 の why には「（early → earlier は例外）」を足します。

---

## 3. 各文の指摘

### S-1　r-0007 I can't log in.（中）

場所: [r-0007.json:47](data/sentences/r-0007.json:47)（`explain`）

- **現在の記述**: 「『するつもりがない』なら I don't log in. や I won't log in. になります。」
- **問題の理由**: I don't log in. は「（ふだん）ログインしない」という習慣の言い方で、「するつもりがない」ではありません。G-3 で見たとおり、一般動詞の現在形は習慣を表すからです。
- **修正案**: 「can't は『（しようとしても）できない』。『ログインしないつもり』なら I'm not going to log in. や I won't log in. です。I don't log in. は『（ふだん）ログインしない』という習慣の言い方になります。」

### S-2　t-0005 It was really cold this morning.（中）

場所: [t-0005.json:52](data/sentences/t-0005.json:52)（`question`）、[t-0005.json:59](data/sentences/t-0005.json:59)（`explain`）

- **問題の理由**:
  - 問い「寒かったのはいつのこと？」は、this morning（今朝）という単語を知っていれば、was を見なくても答えられます。正解の選択肢に「（もう過ぎた時間）」と答えのヒントも入っています。README の「構造が分からないと答えられない問いにする」に合っていません。
  - 解説の「this morning は、もう過ぎた今朝のこと」は理由がずれています。朝のうちなら It's really cold this morning. と言えるので、this morning だけでは「過ぎた」とは決まりません。「過ぎた」と分かるのは was だからです。「今のことなら It is cold.」も、this morning を付けたままでも言える、という点が抜けています。
- **修正案**:
  - 問い「この人は、今も寒いと言っている？」
  - 選択肢「寒かったのは今朝のこと。今のことは言っていない」（正解）／「今まさに寒い、と言っている」／「明日の朝は寒くなる、と言っている」
  - 解説「was は過去の形なので、すでに過ぎた今朝を振り返っています。朝のうちに今の寒さを言うなら It's really cold this morning. です。」

### S-3　t-0018 Let's have coffee sometime.（中）

場所: [t-0018.json:18](data/sentences/t-0018.json:18)（`Let's` の why）

- **現在の記述**: 「Let us の短い形。us なので、話し手と相手の両方が含まれる。」
- **問題の理由**: 相手を含むのは短い形の Let's です。省略しない Let us は「私たちに〜させて」の意味のことが多いです。SNSでとても多い **Let us know**（私たちに知らせてください）を、この説明どおりに「一緒に知ろう」と誤読するおそれがあります。r-0041 の let me know と並べると、違いが分かりやすくなります。
- **修正案**: 「Let us から来た形だが、Let's は必ず『（私たちで）一緒に〜しよう』。省略しない Let us は、Let us know.（私たちに知らせて）のように『私たちに〜させて』の意味のことが多いので、別の言い方と考える。」

### S-4　t-0031 He doesn't speak Japanese, but he understands a little.（中）

場所: [t-0031.json:5](data/sentences/t-0031.json:5)（`ja`）

- **問題の理由**: 言語について doesn't speak と言うときは、ふつう「話す能力がない＝話せない」の意味です。「話しません」と訳すと、「話せるのに話さない」と読めます。また r-0007 の pitfall「don't（しない）と can't（できない）を混同する」は一般には正しいのですが、この文はその区別だけでは読めない例です。
- **修正案**: ja「彼は日本語は話せませんが、少しは分かります。」。`doesn't` の chunk に why「speak＋言語の否定は、ふつう『話せない』の意味」を足します。

### S-5　r-0019 Can you see the image?（低）

場所: [r-0019.json:56](data/sentences/r-0019.json:56)（`explain`）

- **問題の理由**: 「許可なら You can see the image.」とありますが、この英文はふつう「画像が見えます／見られます」（可能）と読まれ、許可の例としては分かりにくいです。
- **修正案**: 許可との対比をやめます。選択肢2を「画像を見たかどうか、過去のことを聞いている」に替え、解説で「見たかどうかなら Did you see the image? です」と can と did を比べます。

### S-6　r-0032 This video was made with AI.（低）

場所: [r-0032.json:50](data/sentences/r-0032.json:50)（選択肢）

- **問題の理由**: 問いは「この文から分かることは？」ですが、選択肢「誰がこの動画を作ったか」は文の形になっていません。「作った人が分かる」という意味なのか読み取りにくいです。また、pitfall の誤読（AIが自分で作った）が選択肢にありません。
- **修正案**: 「AIが、人の手を借りずに自分でこの動画を作った」に替えます。pitfall と対応するので、with（道具）と by（した人）の違いを確かめる問いになります。

### S-7　r-0027 I use AI to save time.（低）

場所: [r-0027.json:48](data/sentences/r-0027.json:48)（`question.ask`）

- **問題の理由**: 問いの文「『時間を節約すること』は…」が、「〜すること」（名詞の使い方）の訳し方になっています。正解は「目的」なので、問いの言葉が学習者を逆に誘導しています。
- **修正案**: 「to save time（時間を節約する）は、この文でどんな役目？」

### S-8　r-0039 She told me that it was free.（低）

場所: [r-0039.json:36](data/sentences/r-0039.json:36)

- **問題の理由**: 「told が過去なので、中の is も was に合わせている」は正しいのですが、必ずそうなるわけではありません。今も無料なら is のままのこともあります。アプリ内でも r-0048 He showed us how it **works** は現在形のままなので、並べて見ると混乱します。
- **修正案**: 「told が過去なので、中の is も was に合わせている。ただし今も無料のままなら、is のまま言うこともある（r-0048 の showed us how it works も現在形のまま）。」

### S-9　r-0002 I use this tool every day.（低）

場所: [r-0002.json:29](data/sentences/r-0002.json:29)（every day の plain）と `explain`

- **問題の理由**: every day に付いた「どのくらい」は、量や程度をたずねる言葉に聞こえます。every day は頻度（どれくらいの回数で）またはいつかを表します。
- **修正案**: plain を「どのくらいの頻度で」または「いつ」にし、explain の「『どのくらい』という説明」も同じ言葉に合わせます。

### S-10　There 構文3文のラベルの不統一（低）

場所: [t-0006.json:26](data/sentences/t-0006.json:26)、t-0020（`There's`）、r-0028（`There are`）

- **問題の理由**: t-0006 では there に「形式上の主語」という用語を付け、a convenience store にも「主語」（S）を付けています。文法用語表示では、1つの文に主語が2つ出ます。t-0020 と r-0028 では there を is / are とひとかたまりにしていて、3文で扱いがそろっていません。
- **修正案**: there の term を「形だけの there」にそろえ、why に「is / are は後ろの名詞（意味の上の主語）に合わせる」と書きます。grammar.json の `there` の what にも「is / are は後ろの名詞が1つなら is、複数なら are」と足すとよいです（r-0028 の why にはすでにあります）。

### S-11　r-0020 It makes my work easier.（低）

場所: [r-0020.json:33](data/sentences/r-0020.json:33)

- **問題の理由**: 「easy＋er」と書いていますが、実際のつづりは easier です。最初の文字で「easyer」と覚える人がいるかもしれません。
- **修正案**: 「easy の y を i に変えて -er（easier）で『より楽な』」

---

## 4. 87本の確認結果一覧

「問題なし」は、英文・和訳・解説・問いのいずれにも指摘がない文です。「関連」は、文自体は正しいものの、上の grammar.json の指摘で例や反例として挙げた文です。

| # | id | 英文 | 結果 |
|---|---|---|---|
| 1 | r-0001 | This app is free. | 問題なし（why の表現は G-1 関連） |
| 2 | t-0002 | Where is the station? | 問題なし |
| 3 | r-0002 | I use this tool every day. | S-9（低） |
| 4 | t-0005 | It was really cold this morning. | **S-2（中）** |
| 5 | r-0003 | She sent me the link. | G-6 関連（why の表現） |
| 6 | t-0004 | I walk my dog here every morning. | 問題なし |
| 7 | r-0010 | This looks great. | 問題なし（G-1・G-3 関連） |
| 8 | t-0001 | Are you from around here? | 問題なし |
| 9 | r-0005 | Does this work offline? | 問題なし（G-1 関連） |
| 10 | r-0004 | The update doesn't work on my phone. | 問題なし（G-1 関連） |
| 11 | t-0003 | Go straight and turn left at the corner. | 問題なし（G-4 の反例） |
| 12 | r-0007 | I can't log in. | **S-1（中）** |
| 13 | r-0006 | Who made this? | 問題なし |
| 14 | r-0008 | They are testing a new feature. | 問題なし（G-3 関連） |
| 15 | r-0009 | Try it yourself. | 問題なし |
| 16 | r-0011 | The new model is faster than the old one. | 問題なし |
| 17 | t-0006 | Is there a convenience store near here? | S-10（低） |
| 18 | r-0012 | Their new tool is really useful. | 問題なし |
| 19 | t-0007 | Could you take our picture? | 問題なし |
| 20 | r-0013 | It will be available next week. | 問題なし（G-16 関連） |
| 21 | t-0008 | It takes about ten minutes on foot. | 問題なし |
| 22 | r-0014 | A lot of people are talking about this. | 問題なし（G-3 関連） |
| 23 | t-0009 | What are you looking for? | 問題なし |
| 24 | r-0015 | They gave everyone a free trial. | 問題なし |
| 25 | t-0010 | Have a nice day! | 問題なし |
| 26 | r-0016 | You don't have to pay for it. | 問題なし（G-7 関連） |
| 27 | t-0011 | You'll see a post office on your right. | 問題なし |
| 28 | r-0017 | You must not share your password. | 問題なし |
| 29 | t-0012 | When does the next bus come? | 問題なし（G-1 関連） |
| 30 | r-0018 | This doesn't look right. | 問題なし |
| 31 | t-0013 | I'm sorry, I can't speak English well. | 問題なし（G-10 関連） |
| 32 | r-0019 | Can you see the image? | S-5（低） |
| 33 | t-0014 | Shall I show you the way? | 問題なし |
| 34 | r-0020 | It makes my work easier. | S-11（低） |
| 35 | t-0015 | We call him Taro. | G-6 関連（why の表現） |
| 36 | r-0021 | I'm going to try it tonight. | 問題なし |
| 37 | t-0016 | It's going to rain this afternoon. | 問題なし |
| 38 | r-0022 | Don't click the link in that message. | 問題なし（G-12 関連） |
| 39 | t-0017 | She teaches my son English. | 問題なし |
| 40 | r-0023 | It quickly became popular. | 問題なし |
| 41 | t-0018 | Let's have coffee sometime. | **S-3（中）** |
| 42 | t-0019 | The shop next to the bank is closed today. | 問題なし |
| 43 | t-0020 | There's a nice park behind the station. | S-10（低） |
| 44 | r-0024 | People call it a game changer. | 問題なし |
| 45 | r-0025 | You should check the source first. | 問題なし（G-8 関連） |
| 46 | t-0021 | You have to change trains at Shinjuku. | **G-7（中）** |
| 47 | t-0022 | My son made me this card. | 問題なし（G-13 関連） |
| 48 | t-0023 | Could you say that again more slowly? | G-22（低） |
| 49 | r-0026 | I asked the AI to summarize the article. | 問題なし（**G-2 の反例**） |
| 50 | t-0024 | I enjoy talking with my neighbors. | G-9（中、why の表現） |
| 51 | r-0027 | I use AI to save time. | S-7（低）。**G-2 の反例** |
| 52 | t-0025 | This cake was made by my mother. | 問題なし |
| 53 | r-0032 | This video was made with AI. | S-6（低） |
| 54 | t-0026 | I've lived here for ten years. | 問題なし |
| 55 | r-0029 | I stopped using that app. | 問題なし |
| 56 | t-0028 | It's nice to meet you. | 問題なし |
| 57 | r-0034 | I've used it for three months. | 問題なし |
| 58 | r-0030 | Thanks for sharing this. | 問題なし |
| 59 | t-0029 | It's dangerous to cross here. | 問題なし |
| 60 | r-0035 | Have you tried the new version? | 問題なし |
| 61 | r-0028 | There are many ways to use it. | S-10（低） |
| 62 | t-0027 | How long have you been in Japan? | 問題なし |
| 63 | r-0033 | My account was suspended for no reason. | 問題なし |
| 64 | r-0031 | Why does it keep crashing? | 問題なし |
| 65 | r-0037 | It's hard to explain this in English. | 問題なし |
| 66 | t-0030 | I'm glad you like it. | 問題なし |
| 67 | r-0038 | I think this is a bug. | 問題なし |
| 68 | r-0036 | It hasn't been fixed yet. | 問題なし |
| 69 | t-0031 | He doesn't speak Japanese, but he understands a little. | **S-4（中）** |
| 70 | r-0039 | She told me that it was free. | S-8（低） |
| 71 | r-0040 | The answer sounds correct, but it's wrong. | 問題なし |
| 72 | t-0032 | If it rains tomorrow, the festival will be canceled. | 問題なし（G-1・G-4 関連） |
| 73 | r-0041 | If you have any questions, let me know. | 問題なし |
| 74 | t-0033 | This is the bus that goes to the station. | 問題なし（G-1 関連） |
| 75 | r-0042 | The person who made this is a student. | 問題なし |
| 76 | r-0043 | This is the tool I use every day. | 問題なし |
| 77 | t-0034 | The man walking the dog is my neighbor. | 問題なし |
| 78 | r-0045 | The feature announced yesterday is already live. | 問題なし（G-11 関連） |
| 79 | r-0044 | This is the best explanation I've seen. | 問題なし |
| 80 | r-0046 | I saw a post explaining this trick. | 問題なし |
| 81 | t-0035 | Do you know where the city hall is? | 問題なし |
| 82 | r-0047 | I don't know what this means. | 問題なし |
| 83 | r-0048 | He showed us how it works. | G-6 関連（why の表現） |
| 84 | r-0049 | It's not as hard as it looks. | 問題なし |
| 85 | t-0036 | I wish I could speak English better. | 問題なし（**G-6 の反例**） |
| 86 | r-0050 | I wish I had more time. | 問題なし（**G-6 の反例**） |
| 87 | r-0051 | If I were you, I would wait. | 問題なし |

grammar.json のうち、`be`・`verb`・`svc`・`there`・`negative`・`wh`・`perfect`・`request`・`preposition`・`passive`・`participle`・`that`・`it-to` の13項目には、指摘はありません（`there` は S-10 で小さな追記を提案しています）。歴史の説明（be動詞の形、do を使う否定、will の由来、代名詞の格、a / the の由来、仮定法の were）も、確かめた範囲で正確です。

## 5. 直す順番の提案

1. **G-1（三単現の s）と G-3（進行形）を一緒に**直します。現在形について二つの項目が反対のことを言っているので、片方だけ直すと矛盾が残ります。
2. **G-2（to＋動詞）** を直します。アプリ内の2文（r-0026・r-0027）と直接食い違っています。
3. G-11（用語の説明）を足します。ほかの項目の説明が読めるようになる土台です。
4. 残りの「中」（G-4〜G-10、S-1〜S-4）を直し、そのあと「低」を直します。
