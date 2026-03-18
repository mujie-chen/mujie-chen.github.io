const PROFILE_CONFIG = {
  title: "Levi's Assorted Trackers",
  subtitle: ''
};

const WEEKLY_PHOTOS = [
  { src: '/weekly-images/A7C00389.jpeg', focalLength: '35mm', exposure: 'f/2.8', shutterSpeed: '1/250s' },
  { src: '/weekly-images/A7C00397.jpeg', focalLength: '50mm', exposure: 'f/1.8', shutterSpeed: '1/500s' },
  { src: '/weekly-images/A7C00657.jpeg', focalLength: '28mm', exposure: 'f/4.0', shutterSpeed: '1/200s' },
  { src: '/weekly-images/A7C02167.jpeg', focalLength: '85mm', exposure: 'f/2.0', shutterSpeed: '1/640s' },
  { src: '/weekly-images/A7C02955.jpeg', focalLength: '24mm', exposure: 'f/5.6', shutterSpeed: '1/125s' },
  { src: '/weekly-images/A7C03399.jpeg', focalLength: '70mm', exposure: 'f/3.2', shutterSpeed: '1/320s' },
  { src: '/weekly-images/A7C03693.jpeg', focalLength: '40mm', exposure: 'f/2.2', shutterSpeed: '1/400s' },
  { src: '/weekly-images/A7C03758.jpeg', focalLength: '32mm', exposure: 'f/2.5', shutterSpeed: '1/200s' },
  { src: '/weekly-images/A7C04345.jpeg', focalLength: '55mm', exposure: 'f/2.8', shutterSpeed: '1/320s' }
];

const TRACKER_CARDS = [
  {
    name: 'Recent Movies',
    url: 'https://letterboxd.com/mujiechen/films/',
    note: '',
    feedType: 'letterboxd'
  },
  {
    name: 'Recent TV',
    url: 'https://www.serializd.com/user/mujiechen/diary',
    note: '',
    feedType: 'serializd'
  },
  {
    name: 'Recent Books',
    url: 'https://www.goodreads.com/review/list/93564062-mujie-chen?ref=nav_mybooks&shelf=read',
    note: '',
    feedType: 'goodreads'
  },
  {
    name: 'Recipe Book',
    url: 'https://levic.notion.site/83b8f95aa47c412da1c31c06ec452ff8?v=2b3053aab0a74e29a85046adfdf1bffd',
    embeddable: true,
    embedUrl: 'https://levic.notion.site/ebd//83b8f95aa47c412da1c31c06ec452ff8?v=1cda2d8ec0384eefbadccc9024ef3e74'
  },
  {
    name: 'Coffee Log',
    url: 'https://levic.notion.site/ee620ac8d4544784b8bc2ad028a62d09?v=933b0db6e28447d284dffe480b3f09e2',
    embeddable: true,
    embedUrl: 'https://levic.notion.site/ebd//ee620ac8d4544784b8bc2ad028a62d09?v=933b0db6e28447d284dffe480b3f09e2'
  }
];

const FEED_RENDERERS = {
  letterboxd: (cardBody) => {
    const element = document.createElement('letterboxd-grid');
    element.setAttribute('limit', '8');
    cardBody.appendChild(element);
  },
  serializd: (cardBody) => {
    const element = document.createElement('serializd-grid');
    element.setAttribute('limit', '8');
    element.setAttribute('username', 'mujiechen');
    cardBody.appendChild(element);
  },
  goodreads: (cardBody) => {
    const element = document.createElement('goodreads-grid');
    element.setAttribute('limit', '8');
    element.setAttribute('rss-url', 'https://www.goodreads.com/review/list_rss/93564062?key=gOx5DPyTBqTlYDuldRuqBewGlTF7HUBQ7D7AEz7h8kgxYwTS&shelf=read');
    cardBody.appendChild(element);
  }
};

const qs = (selector) => document.querySelector(selector);

function preferredTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function initThemeToggle() {
  applyTheme(preferredTheme());

  const pillRow = qs('#pillrow');
  if (!pillRow) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle';

  const syncLabel = () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    button.textContent = isDark ? '☀️' : '🌙';
    button.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
  };

  button.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    syncLabel();
  });

  syncLabel();
  pillRow.appendChild(button);
}

function setProfileHeader() {
  qs('#siteTitle').textContent = PROFILE_CONFIG.title;
  qs('#siteSubtitle').textContent = PROFILE_CONFIG.subtitle || '';
}

function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initWeeklyPhoto() {
  const imageEl = qs('#weeklyPhotoImage');
  const linkEl = qs('#weeklyPhotoLink');
  const focalEl = qs('#weeklyPhotoFocal');
  const exposureEl = qs('#weeklyPhotoExposure');
  const shutterEl = qs('#weeklyPhotoShutter');

  if (!imageEl || !linkEl || !focalEl || !exposureEl || !shutterEl || WEEKLY_PHOTOS.length === 0) return;

  const week = isoWeekKey();
  const index = hashString(week) % WEEKLY_PHOTOS.length;
  const selectedPhoto = WEEKLY_PHOTOS[index];

  imageEl.classList.remove('ready');
  imageEl.addEventListener('load', () => {
    imageEl.classList.add('ready');
  }, { once: true });

  imageEl.src = selectedPhoto.src;
  linkEl.href = selectedPhoto.src;
  focalEl.textContent = selectedPhoto.focalLength;
  exposureEl.textContent = selectedPhoto.exposure;
  shutterEl.textContent = selectedPhoto.shutterSpeed;
}

function createOpenButton(url) {
  const link = document.createElement('a');
  link.className = 'btn primary';
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Open';
  return link;
}

function createEmbeddableActions(card, body) {
  const actions = document.createElement('div');
  actions.className = 'actions';

  if (card.embeddable && card.embedUrl) {
    const toggleButton = document.createElement('button');
    toggleButton.className = 'btn primary';
    toggleButton.type = 'button';
    toggleButton.textContent = 'Show';
    actions.appendChild(toggleButton);

    const embedPanel = document.createElement('div');
    embedPanel.className = 'embed';

    const iframe = document.createElement('iframe');
    iframe.src = card.embedUrl;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', 'true');

    embedPanel.appendChild(iframe);

    toggleButton.addEventListener('click', () => {
      const embedContainer = qs('#embed-container');
      for (const openEmbed of document.querySelectorAll('.embed.open')) {
        if (openEmbed !== embedPanel) openEmbed.classList.remove('open');
      }

      embedPanel.classList.toggle('open');
      if (embedPanel.classList.contains('open') && embedContainer) {
        embedContainer.appendChild(embedPanel);
        embedContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    body.appendChild(actions);
    return embedPanel;
  }

  actions.appendChild(createOpenButton(card.url));
  body.appendChild(actions);
  return null;
}

function createCardHeader(card) {
  const header = document.createElement('header');
  const title = document.createElement('h2');
  title.textContent = card.name;
  header.appendChild(title);
  return header;
}

function createCardDescription(card) {
  const description = document.createElement('p');
  description.className = 'desc';
  description.textContent = card.note || '';
  return description;
}

function createTrackerCard(card) {
  const article = document.createElement('article');
  article.className = 'card';

  if (card.feedType) {
    article.dataset.feed = card.feedType;
  }

  const body = document.createElement('div');
  body.className = 'body';
  body.appendChild(createCardDescription(card));

  let embedPanel = null;

  if (card.feedType && FEED_RENDERERS[card.feedType]) {
    try {
      FEED_RENDERERS[card.feedType](body);
    } catch (error) {
      console.error(`Error rendering ${card.name}:`, error);
      const actions = document.createElement('div');
      actions.className = 'actions';
      actions.appendChild(createOpenButton(card.url));
      body.appendChild(actions);
    }
  } else {
    embedPanel = createEmbeddableActions(card, body);
  }

  article.appendChild(createCardHeader(card));
  article.appendChild(body);
  if (embedPanel) article.appendChild(embedPanel);

  return article;
}

function renderCards() {
  const grid = qs('#grid');
  const extraGrid = qs('#extra-grid');

  for (const card of TRACKER_CARDS) {
    const cardElement = createTrackerCard(card);

    if (card.feedType) {
      grid?.appendChild(cardElement);
    } else {
      extraGrid?.appendChild(cardElement);
    }
  }
}

setProfileHeader();
initThemeToggle();
initWeeklyPhoto();
renderCards();
