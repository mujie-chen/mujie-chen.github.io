const PROFILE_CONFIG = {
  title: "Levi's Assorted Trackers",
  subtitle: ''
};

const TRACKER_CARDS = [
  {
    name: 'Letterboxd',
    url: 'https://letterboxd.com/mujiechen/films/',
    note: 'My Last 8 Movies',
    feedType: 'letterboxd'
  },
  {
    name: 'Serializd',
    url: 'https://www.serializd.com/user/mujiechen/diary',
    note: 'My Last 8 Diary Entries',
    feedType: 'serializd'
  },
  {
    name: 'Goodreads',
    url: 'https://www.goodreads.com/review/list/93564062-mujie-chen?ref=nav_mybooks&shelf=read',
    note: 'My Last 8 Books',
    feedType: 'goodreads'
  },
  {
    name: 'Recipes',
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

const TRACKER_ICONS = {
  Letterboxd: '🎬',
  Serializd: '📺',
  Goodreads: '📖',
  Recipes: '🍳',
  'Coffee Log': '☕'
};

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

function setProfileHeader() {
  qs('#siteTitle').textContent = PROFILE_CONFIG.title;
  qs('#siteSubtitle').textContent = PROFILE_CONFIG.subtitle || '';
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
      if (embedPanel.classList.contains('open')) {
        embedContainer.appendChild(embedPanel);
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
  title.innerHTML = `<span aria-hidden="true">${TRACKER_ICONS[card.name] || '🔗'}</span> ${card.name}`;
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
  for (const card of TRACKER_CARDS) {
    grid.appendChild(createTrackerCard(card));
  }
}

setProfileHeader();
renderCards();
