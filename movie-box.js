const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const GOODREADS_RSS_URL = 'https://www.goodreads.com/review/list_rss/93564062?key=gOx5DPyTBqTlYDuldRuqBewGlTF7HUBQ7D7AEz7h8kgxYwTS&shelf=read';
const GOODREADS_CACHE_KEY = 'goodreads_books_v2';
const GOODREADS_CACHE_TIMESTAMP_KEY = 'goodreads_books_timestamp_v2';
const SERIALIZD_CACHE_KEY = 'serializd_diary_v1';
const SERIALIZD_CACHE_TIMESTAMP_KEY = 'serializd_diary_timestamp_v1';

class MovieFetcher {
  constructor() {
    this.cache = localStorage.getItem('letterboxd_movies') 
      ? { 
          data: JSON.parse(localStorage.getItem('letterboxd_movies')),
          timestamp: parseInt(localStorage.getItem('letterboxd_timestamp') || 0)
        }
      : null;
  }

  isCacheValid() {
    if (!this.cache) return false;
    return Date.now() - this.cache.timestamp < CACHE_TTL;
  }

  async fetchMovies(username = 'mujiechen', limit = 12) {
    if (this.isCacheValid()) {
      return this.cache.data;
    }

    try {
      const rssUrl = `https://letterboxd.com/${username}/rss/`;
      const response = await fetch(
        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`
      );
      const data = await response.json();
      
      const movies = data.items.map((item, index) => {
        const title = item.title.split(' - ')[0];
        const rating = item.title.includes(' - ') ? item.title.split(' - ')[1] : null;
        const link = item.link;
        
        let image = null;
        const imgMatch = item.content.match(/<img src="([^"]+)"/);
        if (imgMatch) {
          image = imgMatch[1];
        }

        return { title, rating, image, link, id: index };
      }).slice(0, limit);

      localStorage.setItem('letterboxd_movies', JSON.stringify(movies));
      localStorage.setItem('letterboxd_timestamp', Date.now().toString());

      return movies;
    } catch (error) {
      console.error('Error fetching movies:', error);
      return [];
    }
  }
}

function upgradeGoodreadsImage(imageUrl) {
  if (!imageUrl) return '';
  return imageUrl
    .replace(/\._SX\d+_\./, '._SY475_.')
    .replace(/\._SY\d+_\./, '._SY475_.')
    .replace(/\._SX\d+_SY\d+_\./, '._SY475_.');
}

function extractAuthor(description = '') {
  const match = description.match(/author:\s*([^<\n]+)/i);
  return match ? match[1].trim() : 'Unknown';
}

function extractImage(item) {
  const sources = [
    item.thumbnail,
    item.enclosure?.link,
    item.description,
    item.content
  ];

  for (const source of sources) {
    if (!source) continue;
    if (typeof source === 'string') {
      const match = source.match(/<img[^>]+src="([^"]+)"/i) || source.match(/https:\/\/i\.gr-assets\.com\/images\/[^\s<"]+/i);
      if (match) {
        return upgradeGoodreadsImage(match[1] || match[0]);
      }
    }
  }

  return '';
}

function serializdPosterUrl(review) {
  let path = review.showBannerImage || '';

  if (!path && Array.isArray(review.showSeasons)) {
    const matchedSeason = review.showSeasons.find(season => season && season.id === review.seasonId);
    path = matchedSeason?.posterPath || '';
  }

  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `https://image.tmdb.org/t/p/w342${path}`;
}

function serializdSeasonName(review) {
  if (!Array.isArray(review.showSeasons)) return '';
  const matchedSeason = review.showSeasons.find(season => season && season.id === review.seasonId);
  return matchedSeason?.name || review.seasonName || '';
}

function serializdRatingLabel(rating) {
  if (!rating || Number.isNaN(Number(rating))) return '';
  return `${(Number(rating) / 2).toFixed(1)}★`;
}

function normalizeSerializdReviews(reviews, limit = 8) {
  const unique = new Set();
  const items = [];

  for (const review of reviews || []) {
    const showId = review.showId || review.show_id || 0;
    const seasonId = review.seasonId || review.season_id || 0;
    const dedupeKey = `${showId}-${seasonId}`;
    if (unique.has(dedupeKey)) continue;
    unique.add(dedupeKey);

    const season = serializdSeasonName(review);
    const showName = review.showName || review.show_name || 'Untitled';
    const title = season ? `${showName}, ${season}` : showName;
    const image = serializdPosterUrl(review);
    const reviewId = review.id || review.reviewId;

    if (!image || !reviewId) continue;

    items.push({
      id: reviewId,
      title,
      rating: serializdRatingLabel(review.rating),
      image,
      link: `https://www.serializd.com/review/${reviewId}`
    });

    if (items.length >= limit) break;
  }

  return items;
}

class SerializdFetcher {
  constructor() {
    this.cache = localStorage.getItem(SERIALIZD_CACHE_KEY)
      ? {
          data: JSON.parse(localStorage.getItem(SERIALIZD_CACHE_KEY)),
          timestamp: parseInt(localStorage.getItem(SERIALIZD_CACHE_TIMESTAMP_KEY) || 0)
        }
      : null;
  }

  isCacheValid() {
    if (!this.cache) return false;
    return Date.now() - this.cache.timestamp < CACHE_TTL;
  }

  async fetchFromLocalJson(limit) {
    try {
      const response = await fetch('/serializd.json');
      if (!response.ok) return [];
      const localItems = await response.json();
      if (!Array.isArray(localItems)) return [];
      return localItems.slice(0, limit);
    } catch {
      return [];
    }
  }

  async fetchDiary(username = 'mujiechen', limit = 8) {
    if (this.isCacheValid()) {
      return this.cache.data.slice(0, limit);
    }

    const localFallback = await this.fetchFromLocalJson(limit);
    if (localFallback.length > 0) {
      localStorage.setItem(SERIALIZD_CACHE_KEY, JSON.stringify(localFallback));
      localStorage.setItem(SERIALIZD_CACHE_TIMESTAMP_KEY, Date.now().toString());
      return localFallback;
    }

    try {
      const targets = ['ALL', 'all', 'SHOW', 'show', 'EPISODE', 'episode', 'SEASON', 'season'];
      const pages = [1, 0, 2];

      for (const page of pages) {
        for (const target of targets) {
          const apiUrl = `https://www.serializd.com/api/user/${username}/diary?page=${page}&include_target=${target}`;
          const response = await fetch(apiUrl, {
            headers: {
              Accept: 'application/json, text/plain, */*',
              Referer: `https://www.serializd.com/user/${username}/diary`,
              'X-Requested-With': 'serializd_vercel'
            }
          });

          if (!response.ok) {
            continue;
          }

          const payload = await response.json();
          const items = normalizeSerializdReviews(payload.reviews, limit);

          if (items.length > 0) {
            localStorage.setItem(SERIALIZD_CACHE_KEY, JSON.stringify(items));
            localStorage.setItem(SERIALIZD_CACHE_TIMESTAMP_KEY, Date.now().toString());
            return items;
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

class MovieBox extends HTMLElement {
  constructor() {
    super();
    this.title = this.getAttribute('title') || '';
    this.rating = this.getAttribute('rating') || '';
    this.image = this.getAttribute('image') || '';
    this.link = this.getAttribute('link') || '#';
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const div = document.createElement('div');
    div.className = 'movie-poster';
    div.style.cursor = 'pointer';
    
    const img = document.createElement('img');
    img.src = this.image;
    img.alt = this.title;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    
    const overlay = document.createElement('div');
    overlay.className = 'poster-overlay';
    
    const titleEl = document.createElement('h3');
    titleEl.className = 'poster-title';
    titleEl.textContent = this.title;
    overlay.appendChild(titleEl);
    
    if (this.rating) {
      const ratingEl = document.createElement('p');
      ratingEl.className = 'poster-rating';
      ratingEl.textContent = this.rating;
      overlay.appendChild(ratingEl);
    }
    
    div.appendChild(img);
    div.appendChild(overlay);
    
    div.addEventListener('click', () => {
      window.open(this.link, '_blank');
    });
    
    this.appendChild(div);
  }
}

customElements.define('movie-box', MovieBox);

class MovieBoxList extends HTMLElement {
  constructor() {
    super();
    this.movies = [];
  }

  async connectedCallback() {
    const limit = this.getAttribute('limit') || 8;
    const fetcher = new MovieFetcher();
    
    this.movies = await fetcher.fetchMovies('mujiechen', limit);
    this.render();
  }

  render() {
    if (this.movies.length === 0) {
      this.innerHTML = '<p style="color: var(--text);">Unable to load movies</p>';
      return;
    }

    this.innerHTML = this.movies
      .map(movie => `
        <movie-box 
          title="${movie.title}"
          rating="${movie.rating || ''}"
          image="${movie.image}"
          link="${movie.link}">
        </movie-box>
      `)
      .join('');
  }
}

customElements.define('movie-box-list', MovieBoxList);

class BookFetcher {
  constructor() {
    localStorage.removeItem('goodreads_books');
    localStorage.removeItem('goodreads_books_timestamp');

    this.cache = localStorage.getItem(GOODREADS_CACHE_KEY) 
      ? { 
          data: JSON.parse(localStorage.getItem(GOODREADS_CACHE_KEY)),
          timestamp: parseInt(localStorage.getItem(GOODREADS_CACHE_TIMESTAMP_KEY) || 0)
        }
      : null;
  }

  isCacheValid() {
    if (!this.cache) return false;
    return Date.now() - this.cache.timestamp < CACHE_TTL;
  }

  async fetchBooks(rssUrl = GOODREADS_RSS_URL, limit = 8) {
    if (this.isCacheValid()) {
      return this.cache.data.slice(0, limit);
    }

    try {
      const response = await fetch(
        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`
      );
      const data = await response.json();

      if (!response.ok || data.status !== 'ok' || !Array.isArray(data.items)) {
        throw new Error(data.message || 'Invalid Goodreads RSS response');
      }

      const books = data.items
        .map((item, index) => ({
          title: item.title?.trim() || 'Untitled',
          author: extractAuthor(item.description || item.content || ''),
          image: extractImage(item),
          link: item.link || '#',
          id: index
        }))
        .filter(book => book.title && book.image)
        .slice(0, limit);

      if (books.length > 0) {
        localStorage.setItem(GOODREADS_CACHE_KEY, JSON.stringify(books));
        localStorage.setItem(GOODREADS_CACHE_TIMESTAMP_KEY, Date.now().toString());
        return books;
      }

      throw new Error('No books found in Goodreads RSS');
    } catch (error) {
      console.error('Error fetching Goodreads books:', error);
      return this.cache?.data?.slice(0, limit) || [];
    }
  }
}

class BookBox extends HTMLElement {
  constructor() {
    super();
    this.title = this.getAttribute('title') || '';
    this.author = this.getAttribute('author') || '';
    this.image = this.getAttribute('image') || '';
    this.link = this.getAttribute('link') || '#';
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const div = document.createElement('div');
    div.className = 'movie-poster';
    div.style.cursor = 'pointer';
    
    const img = document.createElement('img');
    img.src = upgradeGoodreadsImage(this.image);
    img.alt = this.title;
    img.className = 'poster-image';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.addEventListener('load', () => {
      div.classList.add('loaded');
    });
    
    const overlay = document.createElement('div');
    overlay.className = 'poster-overlay';
    
    const titleEl = document.createElement('h3');
    titleEl.className = 'poster-title';
    titleEl.textContent = this.title;
    overlay.appendChild(titleEl);
    
    if (this.author) {
      const authorEl = document.createElement('p');
      authorEl.className = 'poster-rating';
      authorEl.textContent = this.author;
      overlay.appendChild(authorEl);
    }
    
    div.appendChild(img);
    div.appendChild(overlay);
    
    div.addEventListener('click', () => {
      window.open(this.link, '_blank');
    });
    
    this.appendChild(div);
  }
}

customElements.define('book-box', BookBox);

class BookBoxList extends HTMLElement {
  constructor() {
    super();
    this.books = [];
  }

  async connectedCallback() {
    const limit = this.getAttribute('limit') || 8;
    const rssUrl = this.getAttribute('rss-url') || GOODREADS_RSS_URL;
    const fetcher = new BookFetcher();
    
    this.books = await fetcher.fetchBooks(rssUrl, limit);
    this.render();
  }

  render() {
    if (this.books.length === 0) {
      this.innerHTML = '<p style="color: var(--text);">Unable to load books</p>';
      return;
    }

    this.innerHTML = this.books
      .map(book => `
        <book-box 
          title="${book.title}"
          author="${book.author || ''}"
          image="${book.image}"
          link="${book.link}">
        </book-box>
      `)
      .join('');
  }
}

customElements.define('book-box-list', BookBoxList);

class SerialBox extends HTMLElement {
  constructor() {
    super();
    this.title = this.getAttribute('title') || '';
    this.rating = this.getAttribute('rating') || '';
    this.image = this.getAttribute('image') || '';
    this.link = this.getAttribute('link') || '#';
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const div = document.createElement('div');
    div.className = 'movie-poster';
    div.style.cursor = 'pointer';

    const img = document.createElement('img');
    img.src = this.image;
    img.alt = this.title;
    img.className = 'poster-image';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.addEventListener('load', () => {
      div.classList.add('loaded');
    });

    const overlay = document.createElement('div');
    overlay.className = 'poster-overlay';

    const titleEl = document.createElement('h3');
    titleEl.className = 'poster-title';
    titleEl.textContent = this.title;
    overlay.appendChild(titleEl);

    if (this.rating) {
      const ratingEl = document.createElement('p');
      ratingEl.className = 'poster-rating';
      ratingEl.textContent = this.rating;
      overlay.appendChild(ratingEl);
    }

    div.appendChild(img);
    div.appendChild(overlay);

    div.addEventListener('click', () => {
      window.open(this.link, '_blank');
    });

    this.appendChild(div);
  }
}

customElements.define('serial-box', SerialBox);

class SerialBoxList extends HTMLElement {
  constructor() {
    super();
    this.items = [];
  }

  async connectedCallback() {
    const limit = this.getAttribute('limit') || 8;
    const username = this.getAttribute('username') || 'mujiechen';
    const fetcher = new SerializdFetcher();

    this.items = await fetcher.fetchDiary(username, limit);
    this.render();
  }

  render() {
    if (this.items.length === 0) {
      this.innerHTML = '<p style="color: var(--text);">Unable to load diary entries. <a href="https://www.serializd.com/user/mujiechen/diary" target="_blank" rel="noopener noreferrer" style="text-decoration: underline;">Open Serializd diary</a>.</p>';
      return;
    }

    this.innerHTML = this.items
      .map(item => `
        <serial-box
          title="${item.title}"
          rating="${item.rating || ''}"
          image="${item.image}"
          link="${item.link}">
        </serial-box>
      `)
      .join('');
  }
}

customElements.define('serial-box-list', SerialBoxList);
