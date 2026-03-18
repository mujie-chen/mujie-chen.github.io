#!/usr/bin/env node

/**
 * Update books.json from Goodreads widget
 * Run this locally whenever you want to sync your latest reads
 * No npm dependencies needed - uses built-in Node.js modules
 * Usage: node sync-goodreads-read-shelf.js 93564062 8
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const userId = process.argv[2] || '93564062';
const limit = process.argv[3] || 8;

function fetchWidget() {
  return new Promise((resolve, reject) => {
    const url = `https://www.goodreads.com/review/custom_widget/${userId}?num_books=${limit}&shelf=read&sort=date_read&widget_bg_transparent=`;
    
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // Extract widget_code from JavaScript
          const match = data.match(/var widget_code = '(.*?)';/s);
          if (!match) {
            throw new Error('Could not find widget_code in response');
          }
          
          // Decode the escaped HTML
          let htmlContent = match[1]
            .replace(/\\n/g, '\n')
            .replace(/\\'/g, "'")
            .replace(/\\\//g, '/')
            .replace(/\\"/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'");
          
          resolve(htmlContent);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

function parseBooks(htmlContent) {
  const books = [];
  
  // Split into book containers
  const containerRegex = /<div class="gr_custom_each_container_">(.*?)<\/div>\s*<\/div>/gs;
  let match;
  
  while ((match = containerRegex.exec(htmlContent)) !== null) {
    const container = match[1];
    
    // Extract title
    const titleMatch = container.match(/class="gr_custom_title_"[^>]*>\s*<a[^>]*>([^<]+)<\/a>/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();
    
    // Extract author
    const authorMatch = container.match(/class="gr_custom_author_"[^>]*>by\s*<a[^>]*>([^<]+)<\/a>/);
    const author = authorMatch ? authorMatch[1].trim() : 'Unknown';
    
    // Extract image
    const imgMatch = container.match(/class="gr_custom_book_container_"[^>]*>.*?<img[^>]*src="([^"]+)"/s);
    if (!imgMatch) continue;
    const image = imgMatch[1];
    
    // Extract link
    const linkMatch = container.match(/class="gr_custom_title_"[^>]*>\s*<a[^>]*href="([^"]+)"/);
    const link = linkMatch ? linkMatch[1] : '#';
    
    books.push({
      title,
      author,
      image,
      link
    });
  }
  
  return books;
}

async function main() {
  try {
    console.log(`Fetching Goodreads shelf for user ${userId}...`);
    const html = await fetchWidget();
    
    console.log('Parsing books...');
    const books = parseBooks(html);
    
    if (books.length === 0) {
      throw new Error('No books found in widget');
    }
    
    const filePath = path.join(__dirname, 'books.json');
    fs.writeFileSync(filePath, JSON.stringify(books, null, 2));
    
    console.log(`✓ Updated books.json with ${books.length} books:`);
    books.forEach(book => console.log(`  - ${book.title} by ${book.author}`));
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

main();
