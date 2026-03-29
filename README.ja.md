# Casowa Highlight

[English](README.md) | [日本語](README.ja.md)

エディタ内のテキストを設定した色でハイライトできる VS Code 拡張です。

## 特徴

- 選択中の文字列、またはカーソル位置の単語を `Add Highlight` でハイライト
- 入力ボックスから `Add Highlight...` で検索方法（テキスト / 単語 / 正規表現）と大文字小文字の区別を選んでハイライトし、パネルの値を既定値として使用
- エディタの右クリックメニューから `Casowa Highlight` の各操作を実行可能
- `Select Highlighted Word` でハイライト中のテキストを一覧から選択
- 下部パネルの `Highlighted` ビューでハイライト中のテキストを色付きで表示
- `Next Highlighted Match` で選択中のテキストの次の一致箇所へ移動
- `Remove Highlight` でカーソル位置のハイライトを解除
- `Clear All Highlights` で開いているファイルのハイライトをすべて解除
- light / dark それぞれの配色を設定可能
- `auto` / `light` / `dark` で配色モードを切り替え可能
- 16個までハイライトでき、8個は背景塗りつぶし、残り8個は同じ8色の枠表示

## コマンド

- `Casowa Highlight: Add Highlight`
- `Casowa Highlight: Add Highlight...`
- `Casowa Highlight: Select Highlighted Word`
- `Casowa Highlight: Open Highlighted Panel`
- `Casowa Highlight: Next Highlighted Match`
- `Casowa Highlight: Remove Highlight`
- `Casowa Highlight: Clear All Highlights`

## 設定

各ハイライト色には次の設定があります。

- `casowaHighlight.colorMode`
- `casowaHighlight.light.patternN.backgroundColor`
- `casowaHighlight.light.patternN.foregroundColor`
- `casowaHighlight.dark.patternN.backgroundColor`
- `casowaHighlight.dark.patternN.foregroundColor`

`N` は `1` から `8` です。

この拡張は合計 16 個のハイライトを使えます。

- `1` から `8` は、設定した 8 色を塗りつぶしで使用します。
- `9` から `16` は、同じ 8 色を枠表示で再利用します。

`casowaHighlight.colorMode` が `auto` の場合、ハイライト色は現在の VS Code テーマに追従します。

## 設定例: light テーマ

```json
{
  "casowaHighlight.colorMode": "light",
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

## 設定例: dark テーマ

```json
{
  "casowaHighlight.colorMode": "dark",
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

## 設定例: auto

```json
{
  "casowaHighlight.colorMode": "auto"
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

VS Code で `F5` を押すと、Extension Development Host で拡張を起動できます。

## 補足

この拡張は OpenAI Codex (GPT-5 based) の支援を受けて作成しました。

## ライセンス

MIT
