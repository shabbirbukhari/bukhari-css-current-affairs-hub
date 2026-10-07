/**
 * BUKHARI CSS - Auto News Updater
 * Fetches real RSS from Al Jazeera, BBC, Dawn, Reuters
 * Keeps design 100% same, only updates news-data.json
 * Run via GitHub Action daily
 */

const fs = require('fs');
const https = require('https');

const RSS_FEEDS = [
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC' },
  { url: 'https://www.dawn.com/arcio/rss', source: 'Dawn' },
  { url: 'https://www.reutersagency.com/feed/?best-topics=world', source: 'Reuters' }
];

// Your existing 15 news as fallback if fetch fails
const FALLBACK_NEWS = [
  {id:"n1",date:"Sep 20, 2026",headline:"UN Climate Summit 2026: Loss & Damage Fund Operationalized with $100B Pledge",source:"Reuters",url:"https://www.reuters.com/climate",keywords:["climate","un","loss","damage","fund","cop","finance"]},
  {id:"n11",date:"May 20, 2025",headline:"WHO Members Adopt Landmark Pandemic Agreement in US Absence",source:"Al Jazeera",url:"https://www.aljazeera.com/news/2025/5/20/who-members-adopt-landmark-pandemic-agreement-in-us-absence",keywords:["who","health","pandemic","global","governance"]}
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseRSS(xml, sourceName) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  let id = 0;
  while ((match = itemRegex.exec(xml)) !== null && id < 10) {
    const block = match[1];
    const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const linkMatch = block.match(/<link>(.*?)<\/link>/);
    const dateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/);
    const title = (titleMatch ? (titleMatch[1] || titleMatch[2]) : '').trim();
    const link = (linkMatch ? linkMatch[1] : '').trim();
    const pubDate = (dateMatch ? dateMatch[1] : '');
    
    if (title && link) {
      // Convert pubDate to "Oct 07, 2026" format
      let formattedDate = new Date(pubDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      if (formattedDate === 'Invalid Date') formattedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      
      // Generate keywords from title
      const keywords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0,6);
      
      items.push({
        id: `live-${sourceName.toLowerCase()}-${Date.now()}-${id}`,
        date: formattedDate,
        realPubDate: pubDate,
        headline: title,
        source: sourceName,
        url: link, // REAL story link, not homepage
        keywords: keywords
      });
      id++;
    }
  }
  return items;
}

async function main() {
  console.log('Fetching live news...');
  let allNews = [];
  
  for (const feed of RSS_FEEDS) {
    try {
      console.log(`Fetching ${feed.source}...`);
      const xml = await fetchUrl(feed.url);
      const parsed = parseRSS(xml, feed.source);
      console.log(`Got ${parsed.length} from ${feed.source}`);
      allNews = allNews.concat(parsed);
    } catch (e) {
      console.error(`Failed ${feed.source}: ${e.message}`);
    }
  }

  if (allNews.length < 5) {
    console.log('Using fallback news');
    allNews = FALLBACK_NEWS.map(n => ({...n, realPubDate: n.date}));
  }

  // Sort by date newest first, keep 30 max
  allNews.sort((a,b) => new Date(b.realPubDate) - new Date(a.realPubDate));
  allNews = allNews.slice(0, 30);

  // Save to news-data.json - this file will be loaded by index.html
  const output = {
    lastUpdated: new Date().toISOString(),
    lastUpdatedDisplay: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    news: allNews
  };

  fs.writeFileSync('news-data.json', JSON.stringify(output, null, 2));
  console.log(`Saved ${allNews.length} live news to news-data.json`);
  
  // Also update a timestamp file for Netlify
  fs.writeFileSync('last-update.txt', `Last auto-update: ${output.lastUpdatedDisplay}`);
}

main();
