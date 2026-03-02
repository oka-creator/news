const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash';

async function fetchNews() {
  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tokyo'
  });

  const prompt = `あなたはテック系ニュースキュレーターです。今日（${today}）時点での最新テックニュースを調べて、以下の3ジャンルごとに3本ずつ、合計9本のニュースをまとめてください。

ジャンル：
1. 生成AI・LLM
2. 個人開発・インディーハッカー
3. テック全般

各ニュースについて必ず情報ソースのURLも含めてください。
できるだけ具体的で実用的な情報を含めてください。`;

  // Step 1: Google検索でニュースを取得
  const searchRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192
        },
        tools: [{ google_search: {} }]
      })
    }
  );

  const searchData = await searchRes.json();
  if (searchData.error) {
    throw new Error(`Gemini API Error: ${searchData.error.message}`);
  }

  const searchText = searchData.candidates?.[0]?.content?.parts
    ?.filter(p => p.text)
    ?.map(p => p.text)
    ?.join('\n') || '';

  if (!searchText) throw new Error('Empty response from search step');
  console.log('Search step done, got text length:', searchText.length);

  // Step 2: 構造化JSONに変換
  const structurePrompt = `以下のテックニュース情報を、指定のJSON形式に変換してください。

--- ニュース情報 ---
${searchText}
--- ここまで ---

以下のJSON形式で出力してください:
{
  "date": "${today}",
  "categories": [
    {
      "name": "生成AI・LLM",
      "icon": "robot",
      "articles": [
        {
          "title": "ニュースのタイトル",
          "summary": "4-5文での詳しい要約。何が起きたか、なぜ重要か、開発者への影響を含める",
          "source": "情報源の名前",
          "url": "情報源のURL（https://から始まる完全なURL）",
          "impact": "high or medium or low",
          "tags": ["関連タグ1", "関連タグ2"]
        }
      ]
    },
    {
      "name": "個人開発・インディーハッカー",
      "icon": "rocket",
      "articles": [...]
    },
    {
      "name": "テック全般",
      "icon": "laptop",
      "articles": [...]
    }
  ]
}

重要ルール:
- カテゴリは必ず3つ、各3記事
- タイトルや要約の中にダブルクォートは使わず「」や『』を使ってください
- URLは必ず実在するURLを入れてください。不明な場合はGoogle検索URLでも可
- summaryは4-5文で詳しく書いてください
- tagsは各記事に2-3個つけてください`;

  const structureRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: structurePrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      })
    }
  );

  const structureData = await structureRes.json();
  if (structureData.error) {
    throw new Error(`Gemini Structure API Error: ${structureData.error.message}`);
  }

  const jsonText = structureData.candidates?.[0]?.content?.parts
    ?.filter(p => p.text)
    ?.map(p => p.text)
    ?.join('') || '';

  if (!jsonText) throw new Error('Empty response from structure step');

  try {
    return JSON.parse(jsonText);
  } catch (e) {
    console.error('JSON parse failed:', e.message);
    console.error('Raw response (first 1000):', jsonText.substring(0, 1000));
    throw e;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function generateHTML(newsData) {
  // Escape all data for safe embedding in JS
  const safeCats = newsData.categories.map(cat => ({
    name: escapeHtml(cat.name),
    icon: cat.icon,
    articles: cat.articles.map(a => ({
      title: escapeHtml(a.title),
      summary: escapeHtml(a.summary),
      source: escapeHtml(a.source),
      url: a.url || '#',
      impact: a.impact || 'medium',
      tags: (a.tags || []).map(t => escapeHtml(t))
    }))
  }));

  const categoriesJSON = JSON.stringify(safeCats);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>今日のテックニュース | ${escapeHtml(newsData.date)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #f5f5f8;
    --surface: #ffffff;
    --text: #1a1a2e;
    --text-sub: #555568;
    --text-light: #8888a0;
    --border: #e4e4ec;
    --accent: #ff6b35;
    --accent-hover: #e85d2c;
    --tag-bg: #f0f0f5;
    --shadow: 0 1px 8px rgba(0,0,0,0.05);
    --shadow-hover: 0 4px 20px rgba(0,0,0,0.09);
    --radius: 14px;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    line-height: 1.8;
    -webkit-font-smoothing: antialiased;
  }

  .container {
    max-width: 760px;
    margin: 0 auto;
    padding: 32px 20px 60px;
  }

  /* ---- Header ---- */
  header {
    text-align: center;
    margin-bottom: 8px;
  }
  .header-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  h1 {
    font-size: 24px;
    font-weight: 900;
    letter-spacing: -0.02em;
  }
  .date-display {
    color: var(--text-light);
    font-size: 13px;
    font-weight: 500;
    margin-top: 2px;
  }

  /* ---- Date nav ---- */
  .date-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin: 18px 0 24px;
  }
  .date-nav input[type="date"] {
    font-family: inherit;
    font-size: 13px;
    padding: 7px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    outline: none;
  }
  .date-nav input[type="date"]:focus { border-color: var(--accent); }
  .date-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 7px 14px;
    font-family: inherit;
    font-size: 12px;
    color: var(--text-sub);
    cursor: pointer;
    transition: all 0.2s;
  }
  .date-btn:hover { border-color: var(--accent); color: var(--accent); }

  /* ---- Tabs ---- */
  .tabs {
    display: flex;
    gap: 0;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 4px;
    margin-bottom: 22px;
    box-shadow: var(--shadow);
  }
  .tab {
    flex: 1;
    padding: 10px 6px;
    border: none;
    background: none;
    font-family: inherit;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-light);
    cursor: pointer;
    border-radius: 9px;
    transition: all 0.2s ease;
    text-align: center;
    line-height: 1.4;
    white-space: nowrap;
  }
  .tab:hover { color: var(--text-sub); background: var(--tag-bg); }
  .tab.active {
    background: var(--accent);
    color: #fff;
    box-shadow: 0 2px 8px rgba(255,107,53,0.25);
  }
  .tab-icon { display: block; font-size: 18px; margin-bottom: 3px; }

  /* ---- Article card ---- */
  .tab-content { display: none; }
  .tab-content.active { display: block; }

  .article {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 22px 24px;
    margin-bottom: 12px;
    box-shadow: var(--shadow);
    transition: box-shadow 0.3s, transform 0.15s;
    animation: fadeIn 0.35s ease both;
  }
  .article:hover { box-shadow: var(--shadow-hover); transform: translateY(-1px); }
  .article:nth-child(2) { animation-delay: 0.07s; }
  .article:nth-child(3) { animation-delay: 0.14s; }

  .article-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .impact-badge {
    padding: 2px 9px;
    border-radius: 5px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
  }
  .impact-high   { background: #fff0ed; color: #d94432; }
  .impact-medium { background: #fff8ed; color: #c96d10; }
  .impact-low    { background: #edf4ff; color: #3578c5; }

  .article-source { font-size: 12px; color: var(--text-light); }

  .article-title {
    font-size: 16px;
    font-weight: 800;
    line-height: 1.55;
    margin-bottom: 8px;
  }

  .article-summary {
    font-size: 13.5px;
    color: var(--text-sub);
    line-height: 1.9;
    margin-bottom: 14px;
  }

  .article-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }

  .article-tags { display: flex; gap: 5px; flex-wrap: wrap; }
  .tag {
    background: var(--tag-bg);
    color: var(--text-sub);
    font-size: 11px;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 5px;
  }

  .source-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--accent);
    text-decoration: none;
  }
  .source-link:hover { color: var(--accent-hover); }

  /* ---- Footer ---- */
  footer {
    text-align: center;
    margin-top: 36px;
    padding-top: 18px;
    border-top: 1px solid var(--border);
  }
  .footer-tags { font-size: 13px; color: var(--accent); font-weight: 700; }
  .footer-info { font-size: 11.5px; color: var(--text-light); margin-top: 4px; }

  .empty-state { text-align: center; padding: 60px 20px; color: var(--text-light); }
  .empty-state p { font-size: 14px; margin-top: 10px; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 520px) {
    .container { padding: 20px 14px 40px; }
    .article { padding: 18px; }
    h1 { font-size: 20px; }
    .tab { font-size: 11px; padding: 9px 4px; }
    .tab-icon { font-size: 16px; }
  }
</style>
</head>
<body>

<div class="container">
  <header>
    <div class="header-row">
      <span style="font-size:26px">📰</span>
      <h1>今日のテックニュース</h1>
    </div>
    <div class="date-display">${escapeHtml(newsData.date)}</div>
  </header>

  <nav class="date-nav">
    <button class="date-btn" onclick="navigateDate(-1)">&larr; 前日</button>
    <input type="date" id="datePicker" onchange="loadDate(this.value)" />
    <button class="date-btn" onclick="navigateDate(1)">翌日 &rarr;</button>
  </nav>

  <div class="tabs" id="tabs"></div>
  <div id="content"></div>

  <footer>
    <div class="footer-tags">#個人開発 #生成AI #めんどい駆動開発</div>
    <div class="footer-info">Powered by Gemini API &times; GitHub Actions &#x2502; 毎朝 7:00 自動更新</div>
  </footer>
</div>

<script>
const categories = ${categoriesJSON};
const ARCHIVE_BASE = './archive/';
let activeTab = 0;

const ICONS = { robot: '\\u{1F916}', rocket: '\\u{1F680}', laptop: '\\u{1F4BB}' };

function renderTabs() {
  const el = document.getElementById('tabs');
  el.innerHTML = categories.map((c, i) =>
    '<button class="tab' + (i === activeTab ? ' active' : '') + '" onclick="switchTab(' + i + ')">' +
    '<span class="tab-icon">' + (ICONS[c.icon] || '') + '</span>' + c.name + '</button>'
  ).join('');
}

function renderArticles(ci) {
  const cat = categories[ci];
  if (!cat || !cat.articles || cat.articles.length === 0) {
    document.getElementById('content').innerHTML = '<div class="empty-state"><p>\\u{1F4ED} この日の記事はありません</p></div>';
    return;
  }

  const linkIcon = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

  var html = '<div class="tab-content active">';
  for (var i = 0; i < cat.articles.length; i++) {
    var a = cat.articles[i];
    var ic = 'impact-' + (a.impact || 'medium');
    var il = (a.impact || 'medium').toUpperCase();
    if (il === 'MEDIUM') il = 'MID';
    var tags = '';
    if (a.tags) {
      for (var t = 0; t < a.tags.length; t++) {
        tags += '<span class="tag">' + a.tags[t] + '</span>';
      }
    }
    var link = '';
    if (a.url && a.url !== '#') {
      link = '<a href="' + a.url + '" target="_blank" rel="noopener" class="source-link">' + linkIcon + ' \\u30BD\\u30FC\\u30B9\\u3092\\u8AAD\\u3080</a>';
    }
    html += '<div class="article">' +
      '<div class="article-top"><span class="impact-badge ' + ic + '">' + il + '</span><span class="article-source">' + a.source + '</span></div>' +
      '<h3 class="article-title">' + a.title + '</h3>' +
      '<p class="article-summary">' + a.summary + '</p>' +
      '<div class="article-footer"><div class="article-tags">' + tags + '</div>' + link + '</div>' +
      '</div>';
  }
  html += '</div>';
  document.getElementById('content').innerHTML = html;
}

function switchTab(i) { activeTab = i; renderTabs(); renderArticles(i); }

function getTodayStr() {
  var d = new Date();
  var jst = new Date(d.getTime() + (9 * 3600000) + (d.getTimezoneOffset() * 60000));
  return jst.toISOString().slice(0, 10);
}

function initDatePicker() { document.getElementById('datePicker').value = getTodayStr(); }

function navigateDate(delta) {
  var p = document.getElementById('datePicker');
  var d = new Date(p.value);
  d.setDate(d.getDate() + delta);
  p.value = d.toISOString().slice(0, 10);
  loadDate(p.value);
}

function loadDate(ds) {
  if (ds === getTodayStr()) { window.location.href = './'; return; }
  window.location.href = ARCHIVE_BASE + ds + '.html';
}

renderTabs();
renderArticles(0);
initDatePicker();
</script>
</body>
</html>`;
}

async function main() {
  console.log('Fetching news from Gemini API...');
  try {
    const newsData = await fetchNews();
    console.log('Got ' + newsData.categories.length + ' categories');

    const html = generateHTML(newsData);
    const publicDir = path.join(__dirname, 'public');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

    fs.writeFileSync(path.join(publicDir, 'index.html'), html, 'utf-8');
    console.log('Generated public/index.html');

    const dateStr = new Date().toISOString().slice(0, 10);
    const archiveDir = path.join(publicDir, 'archive');
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
    fs.writeFileSync(path.join(archiveDir, dateStr + '.html'), html, 'utf-8');
    console.log('Archived to public/archive/' + dateStr + '.html');

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
