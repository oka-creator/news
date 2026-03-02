# 📰 今日のテックニュース - めんどい駆動開発 Day 4

毎朝7時（JST）に自動でテックニュースをまとめてくれるサイト。

## セットアップ

### 1. リポジトリ作成
GitHubで新しい **パブリック** リポジトリを作成し、このフォルダの中身をすべてpush。

### 2. Gemini APIキーを設定
リポジトリの Settings → Secrets and variables → Actions → New repository secret
- Name: `GEMINI_API_KEY`
- Value: あなたのGemini APIキー

### 3. GitHub Pages を有効化
Settings → Pages → Source を `gh-pages` ブランチに設定。

### 4. 動作確認
Actions タブ → 「Daily Tech News」 → 「Run workflow」で手動実行。
`https://<ユーザー名>.github.io/<リポジトリ名>/` でページが表示されればOK。

あとは毎朝7時に自動更新されます。

## 構成

```
.github/workflows/daily-news.yml  # GitHub Actions（毎朝7時実行）
generate.js                        # Gemini APIでニュース取得→HTML生成
public/                            # デプロイされるフォルダ
  index.html                       # 最新のニュースページ
  archive/                         # 日付別アーカイブ
```

## カスタマイズ

- ジャンルを変えたい → `generate.js` のプロンプト内のジャンルを編集
- 記事数を変えたい → プロンプト内の「3本ずつ」を変更
- 更新時間を変えたい → `.github/workflows/daily-news.yml` のcronを変更
