const CACHE_TTL = 60 * 60 * 1000; // 1 hour

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

async function initMovies() {
  const fetcher = new MovieFetcher();
  const container = document.getElementById('movies-scroll');
  
  if (!container) return;

  // Show loading shimmer placeholders
  container.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const shimmer = document.createElement('div');
    shimmer.className = 'movie-poster shimmer-loading';
    container.appendChild(shimmer);
  }
  
  const movies = await fetcher.fetchMovies('mujiechen', 12);
  
  if (movies.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 24px; color: var(--muted);">Unable to load movies</div>';
    return;
  }

  const postersContainer = document.createElement('div');
  postersContainer.className = 'movies-posters';

  movies.forEach((movie, index) => {
    const posterCard = document.createElement('a');
    posterCard.href = movie.link;
    posterCard.target = '_blank';
    posterCard.rel = 'noopener noreferrer';
    posterCard.className = 'movie-poster';
    posterCard.dataset.index = index;
    posterCard.title = movie.title;

    const img = document.createElement('img');
    img.src = movie.image || '';
    img.alt = movie.title;
    img.className = 'poster-image';
    img.loading = 'lazy';
    img.addEventListener('load', () => {
      posterCard.classList.add('loaded');
    });

    const overlay = document.createElement('div');
    overlay.className = 'poster-overlay';
    
    const titleEl = document.createElement('h3');
    titleEl.className = 'poster-title';
    titleEl.textContent = movie.title;
    
    const ratingEl = document.createElement('p');
    ratingEl.className = 'poster-rating';
    ratingEl.textContent = movie.rating || '';

    overlay.appendChild(titleEl);
    if (movie.rating) overlay.appendChild(ratingEl);

    posterCard.appendChild(img);
    posterCard.appendChild(overlay);
    postersContainer.appendChild(posterCard);
  });

  container.innerHTML = '';
  container.appendChild(postersContainer);

  // Add intersection observer for active state
  const posterCards = postersContainer.querySelectorAll('.movie-poster');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      } else {
        entry.target.classList.remove('active');
      }
    });
  }, { threshold: 0.5 });

  posterCards.forEach(el => observer.observe(el));

  // Smooth scroll with wheel event
  postersContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    postersContainer.scrollLeft += e.deltaY;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMovies);
} else {
  initMovies();
}
