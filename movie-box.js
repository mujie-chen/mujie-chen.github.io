const CACHE_TTL = 60 * 60 * 1000; // 1 hour

class Cache {
  constructor(prefix = "cache_") {
    this.prefix = prefix;
    this.ttlPrefix = "ttl_";
  }

  set(key, value, ttl = null) {
    const fullKey = this.prefix + key;
    const data = {
      value: value,
      timestamp: Date.now(),
      ttl: ttl,
    };
    localStorage.setItem(fullKey, JSON.stringify(data));
    if (ttl) {
      const ttlKey = this.ttlPrefix + key;
      const expirationTime = Date.now() + ttl;
      localStorage.setItem(ttlKey, expirationTime.toString());
    }
  }

  get(key) {
    const fullKey = this.prefix + key;
    const ttlKey = this.ttlPrefix + key;
    const item = localStorage.getItem(fullKey);
    if (!item) return null;
    const ttlValue = localStorage.getItem(ttlKey);
    if (ttlValue) {
      const expirationTime = parseInt(ttlValue);
      if (Date.now() > expirationTime) {
        this.remove(key);
        return null;
      }
    }
    try {
      const data = JSON.parse(item);
      return data.value;
    } catch (e) {
      return null;
    }
  }

  remove(key) {
    const fullKey = this.prefix + key;
    const ttlKey = this.ttlPrefix + key;
    localStorage.removeItem(fullKey);
    localStorage.removeItem(ttlKey);
  }

  clear() {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(this.prefix) || key.startsWith(this.ttlPrefix)) {
        localStorage.removeItem(key);
      }
    });
  }
}

var Utils = (function () {
  return {
    hoverFx(object, move = () => {}, leave = () => {}) {
      var frameId = null;
      let active = false;

      const mouseMove = (e) => {
        active = true;
        cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(() => {
          var data = {
            rect: object.getBoundingClientRect(),
            mouseX: e.clientX,
            mouseY: e.clientY,
          };
          data.xPercent = (Math.abs(data.rect.x - data.mouseX) / data.rect.width) * 100;
          data.yPercent = (Math.abs(data.rect.y - data.mouseY) / data.rect.height) * 100;
          if (active) {
            move(object, data, e);
          }
        });
      };

      const mouseLeave = (e) => {
        active = false;
        leave(object);
      };

      object.addEventListener("mousemove", mouseMove);
      object.addEventListener("mouseleave", mouseLeave);
    },
  };
})();

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
    this.innerHTML = `
      <div class="cover box" style="--cover: url('${this.image}')">
        <div class="front"></div>
        <div class="back"></div>
        <div class="left"><div>${this.title}</div></div>
        <div class="right"></div>
        <div class="top"></div>
        <div class="bottom"></div>
        
        <div class="tape box">
          <div class="front"></div>
          <div class="back"></div>
          <div class="left"></div>
          <div class="right"></div>
          <div class="top"></div>
          <div class="bottom"></div>
        </div>
      </div>
    `;

    const cover = this.querySelector('.cover.box');
    cover.style.cursor = 'pointer';
    cover.addEventListener('click', () => {
      window.open(this.link, '_blank');
    });
  }

  applyTransform(xPercent, yPercent) {
    const cover = this.querySelector('.cover.box');
    if (!cover) return;

    const angleX = (yPercent - 50) * 0.08;
    const angleY = (xPercent - 50) * -0.08;
    
    cover.style.transform = `perspective(1200px) rotateX(${angleX}deg) rotateY(${angleY}deg)`;
  }

  resetTransform() {
    const cover = this.querySelector('.cover.box');
    if (!cover) return;
    cover.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
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
    
    // Apply container-level hover effect (like Rogie's implementation)
    this.setupHoverEffect();
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

  setupHoverEffect() {
    Utils.hoverFx(
      this,
      (containerElement, data) => {
        // Apply transform to all movie boxes based on container's mouse position
        const boxes = this.querySelectorAll('movie-box');
        boxes.forEach((box) => {
          box.applyTransform(data.xPercent, data.yPercent);
        });
      },
      (containerElement) => {
        // Reset all boxes
        const boxes = this.querySelectorAll('movie-box');
        boxes.forEach((box) => {
          box.resetTransform();
        });
      }
    );
  }
}

customElements.define('movie-box-list', MovieBoxList);
