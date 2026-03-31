# Casowa Highlight

[English](README.md) | [日本語](README.ja.md)

単語検索や文字列検索をハイライトするVS Code拡張です。ハイライト一覧表示と保存/読込にも対応しています。

## コマンド

- `Casowa Highlight: Add Word Highlight`<br>
  カーソル位置の単語または選択中の文字列をハイライトします。

- `Casowa Highlight: Add Search Highlight`<br>
  入力ボックスから検索方法(テキスト/単語/正規表現)と大文字小文字の区別を選んでハイライトします。パネルの値を既定値として使います。

- `Casowa Highlight: Toggle Highlight`<br>
  カーソル位置にハイライトがなければ単語を追加し、あればその位置のハイライトを解除します。

- `Casowa Highlight: Remove Highlight`<br>
  カーソル位置のハイライトを解除します。

- `Casowa Highlight: Clear All Highlights`<br>
  すべてのハイライトを解除します。

- `Casowa Highlight: Toggle Display`<br>
  ハイライトの表示/非表示を切り替えます。

- `Casowa Highlight: Select Highlighted Word`<br>
  一覧からハイライトを選択します。

- `Casowa Highlight: Open Highlighted Panel`<br>
  ハイライト一覧パネルを開きます。

- `Casowa Highlight: Next Highlighted Match`<br>
  選択中のハイライトの次の一致箇所へ移動します。

- `Casowa Highlight: Previous Highlighted Match`<br>
  選択中のハイライトの前の一致箇所へ移動します。

- `Casowa Highlight: Save Highlights`<br>
  現在のハイライトを保存します。

- `Casowa Highlight: Load Highlights`<br>
  保存済みのハイライト状態を読み込みます。

## パネル

- 現在のハイライト一覧を表示します。各ハイライトの一致件数も確認できます。
- ハイライトをクリック/Shift+クリックすると、前後の一致箇所へ移動できます。
- ハイライトの横にある矢印ボタンで、前後の一致箇所へ移動できます。設定で表示/非表示を切り替えられます。
- `Save`ボタンで現在のハイライト状態を保存できます。最新5件分を保持します。`Save`を右クリックすると5件の保存先から選べます。
- `Load`ボタンで最新の保存済みハイライト状態を読み込めます。`Load`を右クリックすると読込元を選べます。

## その他の特徴

- エディタの右クリックメニューから`Casowa Highlight`の各操作を実行可能
- 16個までハイライトできます。最初の8個は塗りつぶし表示、次の8個は枠表示になります

## 設定

- `casowaHighlight.colorMode`<br>
  ハイライトの配色モードを`auto`/`light`/`dark`で切り替えます。`auto`モードでは現在のVS Codeテーマに追従します。

- `casowaHighlight.showPanelJumpButtons`<br>
  パネルのハイライトチップにある前後移動用の矢印ボタンの表示/非表示を`true`/`false`で切り替えます。既定値は`true`です。

- `casowaHighlight.light.patternN.backgroundColor`<br>
  lightテーマのハイライトパターン`N`の背景色を設定します。

- `casowaHighlight.light.patternN.foregroundColor`<br>
  lightテーマのハイライトパターン`N`の文字色を設定します。

- `casowaHighlight.dark.patternN.backgroundColor`<br>
  darkテーマのハイライトパターン`N`の背景色を設定します。

- `casowaHighlight.dark.patternN.foregroundColor`<br>
  darkテーマのハイライトパターン`N`の文字色を設定します。

`N`は`1`から`8`です。設定した8色は、塗りつぶし表示と枠表示の両方で使います。

## デフォルト値: lightテーマ

```json
{
  "casowaHighlight.light.pattern1.backgroundColor": "#FFE066",
  "casowaHighlight.light.pattern1.foregroundColor": "#2B2200",
  "casowaHighlight.light.pattern2.backgroundColor": "#FFB86B",
  "casowaHighlight.light.pattern2.foregroundColor": "#3A1F00",
  "casowaHighlight.light.pattern3.backgroundColor": "#7EE787",
  "casowaHighlight.light.pattern3.foregroundColor": "#12311A",
  "casowaHighlight.light.pattern4.backgroundColor": "#56D4DD",
  "casowaHighlight.light.pattern4.foregroundColor": "#0F2E33",
  "casowaHighlight.light.pattern5.backgroundColor": "#7CC7FF",
  "casowaHighlight.light.pattern5.foregroundColor": "#0E2A40",
  "casowaHighlight.light.pattern6.backgroundColor": "#8FA8FF",
  "casowaHighlight.light.pattern6.foregroundColor": "#14264A",
  "casowaHighlight.light.pattern7.backgroundColor": "#C7A6FF",
  "casowaHighlight.light.pattern7.foregroundColor": "#261A52",
  "casowaHighlight.light.pattern8.backgroundColor": "#FF8CC6",
  "casowaHighlight.light.pattern8.foregroundColor": "#4A1830"
}
```

## デフォルト値: darkテーマ

```json
{
  "casowaHighlight.dark.pattern1.backgroundColor": "#8A6A00",
  "casowaHighlight.dark.pattern1.foregroundColor": "#FFF8D6",
  "casowaHighlight.dark.pattern2.backgroundColor": "#A04F00",
  "casowaHighlight.dark.pattern2.foregroundColor": "#FFF1DF",
  "casowaHighlight.dark.pattern3.backgroundColor": "#1F7A32",
  "casowaHighlight.dark.pattern3.foregroundColor": "#E6FFEC",
  "casowaHighlight.dark.pattern4.backgroundColor": "#007A7A",
  "casowaHighlight.dark.pattern4.foregroundColor": "#E2FFFB",
  "casowaHighlight.dark.pattern5.backgroundColor": "#005FA3",
  "casowaHighlight.dark.pattern5.foregroundColor": "#E7F6FF",
  "casowaHighlight.dark.pattern6.backgroundColor": "#2E4FB8",
  "casowaHighlight.dark.pattern6.foregroundColor": "#ECF2FF",
  "casowaHighlight.dark.pattern7.backgroundColor": "#6B3FC9",
  "casowaHighlight.dark.pattern7.foregroundColor": "#F0EBFF",
  "casowaHighlight.dark.pattern8.backgroundColor": "#B03072",
  "casowaHighlight.dark.pattern8.foregroundColor": "#FBEFFF"
}
```

## 開発

### PowerShell

```powershell
npm.cmd install
npm.cmd run compile
npx.cmd @vscode/vsce package
```

### コマンド プロンプト

```cmd
npm install
npm run compile
npx @vscode/vsce package
```

VS Codeで`F5`を押すと、Extension Development Hostで拡張を起動できます。

## 補足

この拡張はOpenAI Codex (GPT-5 based)の支援を受けて作成しました。

## ライセンス

MIT
