/**
 * site-image-crawler.js
 * 
 * Usage:
 * 1. npm init -y
 * 2. npm i puppeteer csv-writer
 * 3. node site-image-crawler.js https://zevnix.com output.csv
 *
 * What it does:
 * - Crawls the provided website (same-origin only)
 * - Visits each HTML page (BFS crawl), extracts <img> tags, <picture> sources, and inline CSS background-image urls
 * - Outputs a CSV with columns: page_url, image_url, alt_text, img_tag_html
 *
 * Notes & limits:
 * - This is a client-side renderer crawl (Puppeteer). It tries to wait for network idle on each page but may not discover every dynamic URL (e.g., complex JS routing).
 * - For very large sites, increase concurrency controls or break into sitemap-driven batches.
 * - If your site requires authentication, run the script inside an environment where the session is already logged-in, or add login steps.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');

async function extractImagesFromPage(page) {
  return await page.evaluate(() => {
    const imgs = [];
    // <img> elements
    document.querySelectorAll('img').forEach(img => {
      const src = img.currentSrc || img.getAttribute('src') || '';
      imgs.push({
        image_url: src || '',
        alt_text: img.getAttribute('alt') || '',
        html: img.outerHTML || ''
      });
    });
    // <picture> <source srcset=...>
    document.querySelectorAll('picture source').forEach(s => {
      const srcset = s.getAttribute('srcset') || '';
      const first = srcset.split(',').map(s=>s.trim()).filter(Boolean)[0] || '';
      imgs.push({image_url: first, alt_text: '', html: s.outerHTML});
    });
    // Inline style background-image
    document.querySelectorAll('[style]').forEach(el => {
      const st = el.getAttribute('style') || '';
      const m = st.match(/background-image:\s*url\(['\"]?(.*?)['\"]?\)/i);
      if (m && m[1]) imgs.push({image_url: m[1], alt_text: el.getAttribute('aria-label')||'', html: st});
    });
    // Elements with CSS background images (computed style) - may be slow for large pages
    // Uncomment if you want computed style scanning
    /*
    Array.from(document.querySelectorAll('*')).forEach(el=>{
      try{
        const comp = window.getComputedStyle(el).getPropertyValue('background-image');
        const m = comp && comp.match(/url\(['\"]?(.*?)['\"]?\)/);
        if (m && m[1]) imgs.push({image_url: m[1], alt_text: el.getAttribute('aria-label')||'', html: el.outerHTML});
      }catch(e){}
    });
    */

    return imgs.filter(i=>i.image_url && i.image_url.trim());
  });
}

function normalizeUrl(base, url) {
  try {
    return new URL(url, base).toString();
  } catch (e) {
    return null;
  }
}

(async ()=>{
  const start = process.argv[2];
  const outCsv = process.argv[3] || 'images.csv';
  if (!start) { console.error('Usage: node site-image-crawler.js <start-url> [out.csv]'); process.exit(1); }

  const origin = (new URL(start)).origin;
  const browser = await puppeteer.launch({headless: true, args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);

  const toVisit = [start];
  const visited = new Set();
  const results = [];

  while (toVisit.length) {
    const url = toVisit.shift();
    if (!url) continue;
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      await page.goto(url, {waitUntil: 'networkidle2'});
    } catch(err) {
      console.warn('Failed to load', url, err.message);
      continue;
    }
    // Extract links for BFS
    const links = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a=>a.href));
    for (const l of links) {
      try {
        const n = new URL(l, url);
        if (n.origin === origin) {
          const clean = n.toString().split('#')[0];
          if (!visited.has(clean) && !toVisit.includes(clean)) toVisit.push(clean);
        }
      } catch(e){}
    }

    // Extract images
    const imgs = await extractImagesFromPage(page);
    for (const i of imgs) {
      const full = normalizeUrl(url, i.image_url);
      if (!full) continue;
      results.push({page_url: url, image_url: full, alt_text: i.alt_text || '', img_tag_html: i.html.replace(/\n|\r/g,' ').slice(0,400)});
    }

    console.log(`Crawled: ${url}  (found ${imgs.length} images)`);
    // safety: limit crawling to 200 pages by default to avoid long runs; remove or raise as needed
    if (visited.size >= 1000) break;
  }

  await browser.close();

  // Deduplicate by page_url + image_url
  const unique = [];
  const seen = new Set();
  for (const r of results) {
    const key = r.page_url + '||' + r.image_url;
    if (!seen.has(key)) { seen.add(key); unique.push(r); }
  }

  const csvWriter = createObjectCsvWriter({ path: outCsv, header: [
    {id:'page_url', title:'page_url'},
    {id:'image_url', title:'image_url'},
    {id:'alt_text', title:'alt_text'},
    {id:'img_tag_html', title:'img_tag_html'}
  ]});

  await csvWriter.writeRecords(unique);
  console.log(`Saved ${unique.length} image records to ${outCsv}`);
})();
