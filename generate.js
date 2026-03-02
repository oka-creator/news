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

各ニュースについて以下のJSON形式で返してください。JSON以外のテキストは一切含めないでください。

{
  "date": "${today}",
  "categories": [
    {
      "name": "生成AI・LLM",
      "icon": "🤖",
      "articles": [
        {
          "title": "ニュースのタイトル",
          "summary": "3-4文での要約。何が起きたか、なぜ重要かを含める",
          "source": "情報源（メディア名やサービス名）",
          "impact": "high / medium / low（開発者への影響度）"
        }
      ]
    },
    {
      "name": "個人開発・インディーハッカー",
      "icon": "🚀",
      "articles": [...]
    },
    {
      "name": "テック全般",
      "icon": "💻",
      "articles": [...]
    }
  ]
}

重要：
- 必ず直近1-2日以内の最新ニュースを取り上げてください
- 開発者・個人開発者にとって実用的で重要なニュースを優先してください
- 日本語で書いてください
- JSONのみを返してください`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096
        },
        tools: [{ google_search: {} }]
      })
    }
  );

  const data = await res.json();

  if (data.error) {
    throw new Error(`Gemini API Error: ${data.error.message}`);
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.filter(p => p.text)
    ?.map(p => p.text)
    ?.join('') || '';

  if (!text) throw new Error('Empty response from Gemini');

  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

function generateHTML(newsData) {
  const impactBadge = (impact) => {
    const colors = {
      high: { bg: '#ff6b3520', border: '#ff6b35', text: '#ff6b35', label: 'HIGH' },
      medium: { bg: '#ff9f1c20', border: '#ff9f1c', text: '#ff9f1c', label: 'MID' },
      low: { bg: '#4a9eff20', border: '#4a9eff', text: '#4a9eff', label: 'LOW' }
    };
    const c = colors[impact] || colors.medium;
    return `<span style="background:${c.bg};border:1px solid ${c.border};color:${c.text};padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:0.05em">${c.label}</span>`;
  };

  const categoriesHTML = newsData.categories.map(cat => {
    const articlesHTML = cat.articles.map((article, i) => `
      <div class="article">
        <div class="article-header">
          <span class="article-num">${i + 1}</span>
          <div class="article-meta">
            ${impactBadge(article.impact)}
            <span class="source">${escapeHtml(article.source)}</span>
          </div>
        </div>
        <h3 class="article-title">${escapeHtml(article.title)}</h3>
        <p class="article-summary">${escapeHtml(article.summary)}</p>
      </div>
    `).join('');

    return `
      <section class="category">
        <h2 class="category-title">${cat.icon} ${escapeHtml(cat.name)}</h2>
        <div class="articles">${articlesHTML}</div>
      </section>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>今日のテックニュース | ${escapeHtml(newsData.date)}</title>
<link href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;700;900&family=Dela+Gothic+One&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #08080d;
    --surface: #111119;
    --surface2: #1a1a26;
    --accent: #ff6b35;
    --accent2: #ff9f1c;
    --text: #e4e4ed;
    --text-dim: #7c7c95;
    --border: #252538;
    --gradient: linear-gradient(135deg, #ff6b35, #ff9f1c);
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Zen Kaku Gothic New', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    line-height: 1.7;
  }
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
  }
  .glow {
    position: fixed;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    filter: blur(140px);
    opacity: 0.06;
    pointer-events: none;
    z-index: 0;
  }
  .glow-1 { background: var(--accent); top: -150px; right: -150px; }
  .glow-2 { background: var(--accent2); bottom: -150px; left: -150px; }

  .container {
    position: relative;
    z-index: 1;
    max-width: 760px;
    margin: 0 auto;
    padding: 40px 20px 60px;
  }

  header {
    text-align: center;
    margin-bottom: 48px;
    animation: fadeUp 0.6s ease both;
  }
  .badge {
    display: inline-block;
    background: var(--surface2);
    border: 1px solid var(--border);
    padding: 6px 16px;
    border-radius: 100px;
    font-size: 12px;
    color: var(--accent);
    letter-spacing: 0.08em;
    margin-bottom: 16px;
    font-weight: 700;
  }
  h1 {
    font-family: 'Dela Gothic One', cursive;
    font-size: clamp(24px, 6vw, 40px);
    background: var(--gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 8px;
  }
  .date {
    color: var(--text-dim);
    font-size: 15px;
  }

  .category {
    margin-bottom: 36px;
    animation: fadeUp 0.6s ease both;
  }
  .category:nth-child(1) { animation-delay: 0.1s; }
  .category:nth-child(2) { animation-delay: 0.2s; }
  .category:nth-child(3) { animation-delay: 0.3s; }

  .category-title {
    font-family: 'Dela Gothic One', cursive;
    font-size: 20px;
    color: var(--text);
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--border);
  }

  .articles { display: flex; flex-direction: column; gap: 12px; }

  .article {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 22px;
    transition: border-color 0.3s, transform 0.2s;
  }
  .article:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
  }

  .article-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }
  .article-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: var(--gradient);
    border-radius: 8px;
    font-size: 12px;
    font-weight: 900;
    color: #fff;
    flex-shrink: 0;
  }
  .article-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .source {
    font-size: 12px;
    color: var(--text-dim);
  }

  .article-title {
    font-size: 16px;
    font-weight: 900;
    margin-bottom: 8px;
    line-height: 1.5;
  }
  .article-summary {
    font-size: 14px;
    color: var(--text-dim);
    line-height: 1.8;
  }

  footer {
    text-align: center;
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px solid var(--border);
    animation: fadeUp 0.6s ease 0.4s both;
  }
  .footer-tags {
    font-size: 13px;
    color: var(--accent);
    font-weight: 700;
  }
  .footer-credit {
    font-size: 12px;
    color: var(--text-dim);
    margin-top: 8px;
  }
  .update-info {
    font-size: 12px;
    color: var(--text-dim);
    margin-top: 4px;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 520px) {
    .container { padding: 24px 16px 40px; }
    .article { padding: 18px; }
  }
</style>
</head>
<body>
<div class="glow glow-1"></div>
<div class="glow glow-2"></div>
<div class="container">
  <header>
    <div class="badge">📰 DAILY TECH NEWS</div>
    <h1>今日のテックニュース</h1>
    <p class="date">${escapeHtml(newsData.date)}</p>
  </header>
  ${categoriesHTML}
  <footer>
    <div class="footer-tags">#個人開発 #生成AI #めんどい駆動開発</div>
    <div class="footer-credit">Powered by Gemini API × GitHub Actions</div>
    <div class="update-info">毎朝 7:00 自動更新</div>
  </footer>
</div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function main() {
  console.log('Fetching news from Gemini API...');

  try {
    const newsData = await fetchNews();
    console.log(`Got ${newsData.categories.length} categories`);

    const html = generateHTML(newsData);

    const publicDir = path.join(__dirname, 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(path.join(publicDir, 'index.html'), html, 'utf-8');
    console.log('Generated public/index.html');

    // アーカイブも保存（日付別）
    const dateStr = new Date().toISOString().slice(0, 10);
    const archiveDir = path.join(publicDir, 'archive');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    fs.writeFileSync(path.join(archiveDir, `${dateStr}.html`), html, 'utf-8');
    console.log(`Archived to public/archive/${dateStr}.html`);

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
