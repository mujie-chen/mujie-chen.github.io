/*
 * Update serializd.json from Serializd diary API.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const USERNAME = 'mujiechen';
const LIMIT = 8;
const INCLUDE_TARGETS = ['ALL', 'all', 'SHOW', 'show', 'EPISODE', 'episode', 'SEASON', 'season'];
const PAGES = [1, 0, 2];

function requestDiary(page, includeTarget) {
  const apiUrl = `https://www.serializd.com/api/user/${USERNAME}/diary?page=${page}&include_target=${includeTarget}`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      apiUrl,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          DNT: '1',
          Referer: `https://www.serializd.com/user/${USERNAME}/diary`,
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
          'X-Requested-With': 'serializd_vercel'
        }
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Serializd API returned ${res.statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

function posterUrl(review) {
  let imagePath = review.showBannerImage || '';

  if (!imagePath && Array.isArray(review.showSeasons)) {
    const matched = review.showSeasons.find((season) => season && season.id === review.seasonId);
    imagePath = matched?.posterPath || '';
  }

  if (!imagePath) return '';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  return `https://image.tmdb.org/t/p/w342${imagePath}`;
}

function seasonName(review) {
  if (!Array.isArray(review.showSeasons)) return review.seasonName || '';
  const matched = review.showSeasons.find((season) => season && season.id === review.seasonId);
  return matched?.name || review.seasonName || '';
}

function ratingLabel(rating) {
  if (!rating || Number.isNaN(Number(rating))) return '';
  return `${(Number(rating) / 2).toFixed(1)}★`;
}

function normalize(reviews, limit) {
  const list = [];
  const seen = new Set();

  for (const review of reviews || []) {
    const showId = review.showId || 0;
    const seasonId = review.seasonId || 0;
    const key = `${showId}-${seasonId}`;

    if (seen.has(key)) continue;
    seen.add(key);

    const titleBase = review.showName || 'Untitled';
    const season = seasonName(review);
    const title = season ? `${titleBase}, ${season}` : titleBase;
    const image = posterUrl(review);
    const id = review.id;

    if (!image || !id) continue;

    list.push({
      id,
      title,
      rating: ratingLabel(review.rating),
      image,
      link: `https://www.serializd.com/review/${id}`
    });

    if (list.length >= limit) break;
  }

  return list;
}

async function main() {
  let items = [];

  for (const page of PAGES) {
    for (const target of INCLUDE_TARGETS) {
      try {
        const payload = await requestDiary(page, target);
        const reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
        items = normalize(reviews, LIMIT);
        if (items.length > 0) {
          console.log(`Using page=${page}, include_target=${target}`);
          break;
        }
      } catch {
        // Try next variant.
      }
    }

    if (items.length > 0) break;
  }

  const outputPath = path.join(__dirname, 'serializd.json');
  fs.writeFileSync(outputPath, JSON.stringify(items, null, 2) + '\n');

  console.log(`Wrote ${items.length} Serializd entries to serializd.json`);
}

main().catch((error) => {
  console.error('Failed to update Serializd entries:', error.message);
  process.exit(1);
});
