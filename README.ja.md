# Casowa Highlight

Casowa Highlightは、単語・文字列・正規表現をにマッチするテキストをハイライトできるVS Code拡張機能です。  
パネルでハイライト一覧を確認でき、ハイライトの前後移動、保存と読み込みをまとめて扱えます。

## コマンド
<!-- コマンド行の最後には空白を2ついれること -->

`Casowa Highlight: Add Word Highlight`  
カーソル位置の単語、または選択文字列をハイライトに追加します。

`Casowa Highlight: Add Search Highlight`  
任意の文字列や正規表現を入力してハイライトを追加します。

`Casowa Highlight: Toggle Highlight`  
カーソル位置のハイライトを削除し、未登録ならカーソル位置の単語をハイライトに追加します。

`Casowa Highlight: Remove Highlight`  
カーソル位置にあるハイライトを削除します。

`Casowa Highlight: Clear All Highlights`  
すべてのハイライトを削除します。

`Casowa Highlight: Toggle Display`  
ハイライト表示のON/OFFを切り替えます。

`Casowa Highlight: Select Highlighted Word`  
ハイライト一覧から対象を選び、次の一致箇所へ移動します。

`Casowa Highlight: Next Highlighted Match`  
選択中ハイライトの次の一致箇所へ移動します。

`Casowa Highlight: Previous Highlighted Match`  
選択中ハイライトの前の一致箇所へ移動します。

`Casowa Highlight: Open Highlighted Panel`  
ハイライト一覧パネルへフォーカスします。

`Casowa Highlight: Save Highlights`  
現在のハイライト一覧を保存します。

`Casowa Highlight: Load Highlights`  
保存済みのハイライト一覧を読み込みます。

## 特徴

- 単語、通常文字列、正規表現の3種類でハイライトできます。
- ハイライトセットを保存し、後から復元できます。

## パネル

- パネルに`Casowa Highlight`ビューを追加します。
- パネルにはハイライト語句、件数、前後移動ボタンを表示します。
- パネルから保存、読み込み、対象ハイライトの選択ができます。

## 設定

`casowaHighlight.colorMode`  
ハイライト配色の切り替え方法を設定します。  

| 設定値 | 説明 |
| --- | --- |
| `auto` | 現在のテーマ配色 |
| `light` | 常にlight配色 |
| `dark` | 常にdark配色 |

デフォルト値: `auto`

`casowaHighlight.showPanelJumpButtons`  
パネル上のハイライトに前後移動ボタンを表示するかどうかを切り替え設定  
デフォルト値: `true`

`casowaHighlight.light.patternN.backgroundColor`  
lightテーマ時の1から8番目までのハイライト背景色

`casowaHighlight.light.pattern1.foregroundColor`  
lightテーマ時の1から8番までのハイライト文字色

`casowaHighlight.dark.pattern1.backgroundColor`  
darkテーマ時の1から8番までのハイライト背景色

`casowaHighlight.dark.pattern1.foregroundColor`  
darkテーマ時の1から8番までのハイライト文字色

## デフォルト値

```json
{
  "casowaHighlight.colorMode": "auto",
  "casowaHighlight.showPanelJumpButtons": true,
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
  "casowaHighlight.light.pattern8.foregroundColor": "#4A1830",
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

## 開発用

### PowerShell

```powershell
npm.cmd install
npm.cmd run compile
npm.cmd run package
```

### Command Prompt

```cmd
npm install
npm run compile
npm run package
```

## その他

- この拡張機能の作成にはCodexを利用しています。

## ライセンス

MIT License
