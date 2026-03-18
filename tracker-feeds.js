const CACHE_TTL_MS = 60 * 60 * 1000;

const LETTERBOXD_CACHE_KEY = 'letterboxd_movies';
const LETTERBOXD_CACHE_TIMESTAMP_KEY = 'letterboxd_timestamp';

const GOODREADS_RSS_URL = 'https://www.goodreads.com/review/list_rss/93564062?key=gOx5DPyTBqTlYDuldRuqBewGlTF7HUBQ7D7AEz7h8kgxYwTS&shelf=read';
const GOODREADS_CACHE_KEY = 'goodreads_books_v2';
const GOODREADS_CACHE_TIMESTAMP_KEY = 'goodreads_books_timestamp_v2';

const SERIALIZD_CACHE_KEY = 'serializd_diary_v1';
const SERIALIZD_CACHE_TIMESTAMP_KEY = 'serializd_diary_timestamp_v1';
const SERIALIZD_INCLUDE_TARGETS = ['ALL', 'all', 'SHOW', 'show', 'EPISODE', 'episode', 'SEASON', 'season'];
const SERIALIZD_PAGES = [1, 0, 2];

function defineElement(tagName, elementClass) {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, elementClass);
  }
}

function readCachedList(dataKey, timestampKey) {
  const rawData = localStorage.getItem(dataKey);
  if (!rawData) return null;

  return {
    data: JSON.parse(rawData),
    timestamp: parseInt(localStorage.getItem(timestampKey) || '0', 10)
  };
}

function isFreshCache(cache) {
  if (!cache) return false;
  return Date.now() - cache.timestamp < CACHE_TTL_MS;
}

function writeCachedList(dataKey, timestampKey, data) {
  localStorage.setItem(dataKey, JSON.stringify(data));
  localStorage.setItem(timestampKey, Date.now().toString());
}

class LetterboxdFeedClient {
  constructor() {
    this.cache = readCachedList(LETTERBOXD_CACHE_KEY, LETTERBOXD_CACHE_TIMESTAMP_KEY);
  }

  async fetchRecent(username = 'mujiechen', limit = 8) {
    if (isFreshCache(this.cache)) {
      return this.cache.data.slice(0, limit);
    }

    try {
      const rssUrl = `https://letterboxd.com/${username}/rss/`;
      const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`);
      const payload = await response.json();
      const items = Array.isArray(payload.items) ? payload.items : [];

      const movies = items
        .map((item, index) => {
          const titleParts = (item.title || '').split(' - ');
          const title = titleParts[0] || 'Untitled';
          const rating = titleParts[1] || '';
          const imageMatch = (item.content || '').match(/<img src="([^"]+)"/);

          return {
            id: index,
            title,
            subtitle: rating,
            image: imageMatch ? imageMatch[1] : '',
            link: item.link || '#'
          };
        })
        .filter((movie) => movie.title && movie.image)
        .slice(0, limit);

      writeCachedList(LETTERBOXD_CACHE_KEY, LETTERBOXD_CACHE_TIMESTAMP_KEY, movies);
      return movies;
    } catch (error) {
      console.error('Error fetching Letterboxd movies:', error);
      return [];
    }
  }
}

function upscaleGoodreadsImage(imageUrl) {
  if (!imageUrl) return '';

  return imageUrl
    .replace(/\._SX\d+_\./, '._SY475_.')
    .replace(/\._SY\d+_\./, '._SY475_.')
    .replace(/\._SX\d+_SY\d+_\./, '._SY475_.');
}

function extractGoodreadsAuthor(description = '') {
  const match = description.match(/author:\s*([^<\n]+)/i);
  return match ? match[1].trim() : 'Unknown';
}

function extractGoodreadsImage(item) {
  const sources = [item.thumbnail, item.enclosure?.link, item.description, item.content];

  for (const source of sources) {
    if (!source || typeof source !== 'string') continue;

    const imageMatch =
      source.match(/<img[^>]+src="([^"]+)"/i) ||
      source.match(/https:\/\/i\.gr-assets\.com\/images\/[^\s<"]+/i);

    if (imageMatch) {
      return upscaleGoodreadsImage(imageMatch[1] || imageMatch[0]);
    }
  }

  return '';
}

class GoodreadsFeedClient {
  constructor() {
    localStorage.removeItem('goodreads_books');
    localStorage.removeItem('goodreads_books_timestamp');
    this.cache = readCachedList(GOODREADS_CACHE_KEY, GOODREADS_CACHE_TIMESTAMP_KEY);
  }

  async fetchRecent(rssUrl = GOODREADS_RSS_URL, limit = 8) {
    if (isFreshCache(this.cache)) {
      return this.cache.data.slice(0, limit);
    }

    try {
      const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`);
      const payload = await response.json();

      if (!response.ok || payload.status !== 'ok' || !Array.isArray(payload.items)) {
        throw new Error(payload.message || 'Invalid Goodreads RSS response');
      }

      const books = payload.items
        .map((item, index) => ({
          id: index,
          title: item.title?.trim() || 'Untitled',
          subtitle: extractGoodreadsAuthor(item.description || item.content || ''),
          image: extractGoodreadsImage(item),
          link: item.link || '#'
        }))
        .filter((book) => book.title && book.image)
        .slice(0, limit);

      if (books.length > 0) {
        writeCachedList(GOODREADS_CACHE_KEY, GOODREADS_CACHE_TIMESTAMP_KEY, books);
      }

      return books;
    } catch (error) {
      console.error('Error fetching Goodreads books:', error);
      return this.cache?.data?.slice(0, limit) || [];
    }
  }
}

function serializdPosterUrl(review) {
  let imagePath = review.showBannerImage || '';

  if (!imagePath && Array.isArray(review.showSeasons)) {
    const matchedSeason = review.showSeasons.find((season) => season && season.id === review.seasonId);
    imagePath = matchedSeason?.posterPath || '';
  }

  if (!imagePath) return '';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  return `https://image.tmdb.org/t/p/w342${imagePath}`;
}

function serializdSeasonName(review) {
  if (!Array.isArray(review.showSeasons)) return review.seasonName || '';
  const matchedSeason = review.showSeasons.find((season) => season && season.id === review.seasonId);
  return matchedSeason?.name || review.seasonName || '';
}

function serializdRating(ratingValue) {
  if (!ratingValue || Number.isNaN(Number(ratingValue))) return '';
  return `${(Number(ratingValue) / 2).toFixed(1)}★`;
}

function normalizeSerializdReviews(reviews, limit = 8) {
  const uniqueKeys = new Set();
  const entries = [];

  for (const review of reviews || []) {
    const showId = review.showId || review.show_id || 0;
    const seasonId = review.seasonId || review.season_id || 0;
    const dedupeKey = `${showId}-${seasonId}`;

    if (uniqueKeys.has(dedupeKey)) continue;
    uniqueKeys.add(dedupeKey);

    const showName = review.showName || review.show_name || 'Untitled';
    const season = serializdSeasonName(review);
    const title = season ? `${showName}, ${season}` : showName;
    const image = serializdPosterUrl(review);
    const reviewId = review.id || review.reviewId;

    if (!image || !reviewId) continue;

    entries.push({
      id: reviewId,
      title,
      subtitle: serializdRating(review.rating),
      image,
      link: `https://www.serializd.com/review/${reviewId}`
    });

    if (entries.length >= limit) break;
  }

  return entries;
}

class SerializdDiaryClient {
  constructor() {
    this.cache = readCachedList(SERIALIZD_CACHE_KEY, SERIALIZD_CACHE_TIMESTAMP_KEY);
  }

  async fetchFromLocalJson(limit) {
    try {
      const response = await fetch('/serializd.json');
      if (!response.ok) return [];

      const rows = await response.json();
      if (!Array.isArray(rows)) return [];

      return rows.slice(0, limit).map((row) => ({
        id: row.id,
        title: row.title || 'Untitled',
        subtitle: row.rating || '',
        image: row.image || '',
        link: row.link || '#'
      }));
    } catch {
      return [];
    }
  }

  async fetchRecent(username = 'mujiechen', limit = 8) {
    if (isFreshCache(this.cache)) {
      return this.cache.data.slice(0, limit);
    }

    const localItems = await this.fetchFromLocalJson(limit);
    if (localItems.length > 0) {
      writeCachedList(SERIALIZD_CACHE_KEY, SERIALIZD_CACHE_TIMESTAMP_KEY, localItems);
      return localItems;
    }

    try {
      for (const page of SERIALIZD_PAGES) {
        for (const includeTarget of SERIALIZD_INCLUDE_TARGETS) {
          const endpoint = `https://www.serializd.com/api/user/${username}/diary?page=${page}&include_target=${includeTarget}`;
          const response = await fetch(endpoint, {
            headers: {
              Accept: 'application/json, text/plain, */*',
              Referer: `https://www.serializd.com/user/${username}/diary`,
              'X-Requested-With': 'serializd_vercel'
            }
          });

          if (!response.ok) continue;

          const payload = await response.json();
          const entries = normalizeSerializdReviews(payload.reviews, limit);

          if (entries.length > 0) {
            writeCachedList(SERIALIZD_CACHE_KEY, SERIALIZD_CACHE_TIMESTAMP_KEY, entries);
            return entries;
          }
        }
      }

      return [];
    } catch (error) {
      console.error('Error fetching Serializd diary:', error);
      return this.cache?.data?.slice(0, limit) || [];
    }
  }
}

class PosterTileElement extends HTMLElement {
  connectedCallback() {
    const title = this.getAttribute('title') || '';
    const subtitle = this.getAttribute('subtitle') || '';
    const image = this.getAttribute('image') || '';
    const link = this.getAttribute('link') || '#';

    this.innerHTML = '';

    const poster = document.createElement('div');
    poster.className = 'movie-poster';
    poster.style.cursor = 'pointer';

    const imageEl = document.createElement('img');
    imageEl.src = image;
    imageEl.alt = title;
    imageEl.className = 'poster-image';
    imageEl.addEventListener('load', () => {
      poster.classList.add('loaded');
    });

    const overlay = document.createElement('div');
    overlay.className = 'poster-overlay';

    const titleEl = document.createElement('h3');
    titleEl.className = 'poster-title';
    titleEl.textContent = title;
    overlay.appendChild(titleEl);

    if (subtitle) {
      const subtitleEl = document.createElement('p');
      subtitleEl.className = 'poster-rating';
      subtitleEl.textContent = subtitle;
      overlay.appendChild(subtitleEl);
    }

    poster.appendChild(imageEl);
    poster.appendChild(overlay);
    poster.addEventListener('click', () => {
      window.open(link, '_blank');
    });

    this.appendChild(poster);
  }
}

class LegacyMovieTileElement extends PosterTileElement {
  connectedCallback() {
    if (!this.hasAttribute('subtitle') && this.hasAttribute('rating')) {
      this.setAttribute('subtitle', this.getAttribute('rating') || '');
    }
    super.connectedCallback();
  }
}

class LegacyBookTileElement extends PosterTileElement {
  connectedCallback() {
    if (!this.hasAttribute('subtitle') && this.hasAttribute('author')) {
      this.setAttribute('subtitle', this.getAttribute('author') || '');
    }
    super.connectedCallback();
  }
}

class LegacySerialTileElement extends PosterTileElement {
  connectedCallback() {
    if (!this.hasAttribute('subtitle') && this.hasAttribute('rating')) {
      this.setAttribute('subtitle', this.getAttribute('rating') || '');
    }
    super.connectedCallback();
  }
}

class LetterboxdGridElement extends HTMLElement {
  async connectedCallback() {
    const limit = Number(this.getAttribute('limit') || 8);
    const username = this.getAttribute('username') || 'mujiechen';
    const client = new LetterboxdFeedClient();
    const items = await client.fetchRecent(username, limit);
    this.render(items, 'Unable to load movies');
  }

  render(items, emptyText) {
    this.innerHTML = '';

    if (!items.length) {
      this.innerHTML = `<p style="color: var(--text);">${emptyText}</p>`;
      return;
    }

    for (const item of items) {
      const tile = document.createElement('poster-tile');
      tile.setAttribute('title', item.title || 'Untitled');
      tile.setAttribute('subtitle', item.subtitle || '');
      tile.setAttribute('image', item.image || '');
      tile.setAttribute('link', item.link || '#');
      this.appendChild(tile);
    }
  }
}

class GoodreadsGridElement extends HTMLElement {
  async connectedCallback() {
    const limit = Number(this.getAttribute('limit') || 8);
    const rssUrl = this.getAttribute('rss-url') || GOODREADS_RSS_URL;
    const client = new GoodreadsFeedClient();
    const items = await client.fetchRecent(rssUrl, limit);

    this.innerHTML = '';
    if (!items.length) {
      this.innerHTML = '<p style="color: var(--text);">Unable to load books</p>';
      return;
    }

    for (const item of items) {
      const tile = document.createElement('poster-tile');
      tile.setAttribute('title', item.title || 'Untitled');
      tile.setAttribute('subtitle', item.subtitle || '');
      tile.setAttribute('image', item.image || '');
      tile.setAttribute('link', item.link || '#');
      this.appendChild(tile);
    }
  }
}

class SerializdGridElement extends HTMLElement {
  async connectedCallback() {
    const limit = Number(this.getAttribute('limit') || 8);
    const username = this.getAttribute('username') || 'mujiechen';
    const client = new SerializdDiaryClient();
    const items = await client.fetchRecent(username, limit);

    this.innerHTML = '';
    if (!items.length) {
      this.innerHTML = '<p style="color: var(--text);">Unable to load diary entries. <a href="https://www.serializd.com/user/mujiechen/diary" target="_blank" rel="noopener noreferrer" style="text-decoration: underline;">Open Serializd diary</a>.</p>';
      return;
    }

    for (const item of items) {
      const tile = document.createElement('poster-tile');
      tile.setAttribute('title', item.title || 'Untitled');
      tile.setAttribute('subtitle', item.subtitle || '');
      tile.setAttribute('image', item.image || '');
      tile.setAttribute('link', item.link || '#');
      this.appendChild(tile);
    }
  }
}

defineElement('poster-tile', PosterTileElement);
defineElement('letterboxd-grid', LetterboxdGridElement);
defineElement('goodreads-grid', GoodreadsGridElement);
defineElement('serializd-grid', SerializdGridElement);

// Legacy aliases to avoid breaking existing markup.
defineElement('movie-box', LegacyMovieTileElement);
defineElement('book-box', LegacyBookTileElement);
defineElement('serial-box', LegacySerialTileElement);
defineElement('movie-box-list', class extends LetterboxdGridElement {});
defineElement('book-box-list', class extends GoodreadsGridElement {});
defineElement('serial-box-list', class extends SerializdGridElement {});
