(function() {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var saveData = Boolean(navigator.connection && navigator.connection.saveData);
  var STORAGE_KEY = 'hpkp-aura-field-v6';
  var timelineStart = performance.now();
  var engines = [];
  var panelOpen = false;
  var lastFocused = null;
  var soundEnabled = false;
  var audioSystem = null;

  var PHASES = [
    { name: 'Primordial Nucleus', short: 'NUCLEUS', primary: [105, 240, 255], secondary: [57, 126, 255] },
    { name: 'Synaptic Resonance', short: 'SYNAPSE', primary: [255, 91, 220], secondary: [143, 69, 224] },
    { name: 'Abyssal Bioluminescence', short: 'ABYSSAL', primary: [88, 241, 154], secondary: [25, 180, 203] },
    { name: 'Cosmic Singularity', short: 'SINGULARITY', primary: [255, 224, 71], secondary: [255, 125, 54] }
  ];

  var DEFAULTS = {
    autoCycle: true,
    manualPhase: 0,
    density: 0.92,
    tension: 0.72,
    turbulence: 0.68,
    bloom: 0.82,
    velocity: 1,
    hue: 0,
    trails: true,
    motion: !reduceMotion.matches && !saveData
  };

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function normalizedText(node) {
    return node ? (node.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothStep(value) {
    var amount = clamp(value, 0, 1);
    return amount * amount * (3 - 2 * amount);
  }

  function loadSettings() {
    var next = Object.assign({}, DEFAULTS);
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      Object.keys(DEFAULTS).forEach(function(key) {
        if (typeof saved[key] === typeof DEFAULTS[key]) next[key] = saved[key];
      });
    } catch (error) {
      // A private session can keep the defaults without persistent controls.
    }
    if (reduceMotion.matches) {
      next.motion = false;
      next.autoCycle = false;
    }
    next.manualPhase = clamp(Math.round(next.manualPhase), 0, PHASES.length - 1);
    next.density = clamp(next.density, 0.45, 1.35);
    next.tension = clamp(next.tension, 0.15, 1.2);
    next.turbulence = clamp(next.turbulence, 0.1, 1.25);
    next.bloom = clamp(next.bloom, 0.1, 1.25);
    next.velocity = clamp(next.velocity, 0.45, 1.6);
    next.hue = clamp(next.hue, -45, 45);
    return next;
  }

  var settings = loadSettings();

  function saveSettings() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      // Controls remain live for this page even when storage is unavailable.
    }
  }

  function broadcastSettings(persist) {
    if (persist !== false) saveSettings();
    document.dispatchEvent(new CustomEvent('aura:settings', { detail: Object.assign({}, settings) }));
    syncControlUi();
  }

  function pathIs(pattern) {
    return pattern.test(window.location.pathname);
  }

  function pageRoute() {
    if (document.querySelector('article.post-content')) return 'post';
    if (pathIs(/^\/(?:index\.html)?$/)) return 'home';
    if (pathIs(/^\/archives(?:\/|$)/)) return 'archive';
    if (pathIs(/^\/categories\/?$/)) return 'categories';
    if (pathIs(/^\/categories\//)) return 'category';
    if (pathIs(/^\/tags\/?$/)) return 'tags';
    if (pathIs(/^\/tags\//)) return 'tag';
    if (pathIs(/^\/about\/?$/)) return 'about';
    return 'page';
  }

  function routeLabel(route) {
    var labels = {
      post: 'ARCHIVE RECORD / SINGLE ENTRY',
      archive: 'CHRONOLOGY / ALL RECORDS',
      categories: 'SYSTEM INDEX / KNOWLEDGE FIELDS',
      category: 'SYSTEM NODE / FILTERED FIELD',
      tags: 'SIGNAL INDEX / MEMORY MARKERS',
      tag: 'SIGNAL NODE / FILTERED MARKER',
      about: 'IDENTITY / ARCHIVE KEEPER',
      page: 'ARCHIVE / AUXILIARY NODE'
    };
    return labels[route] || labels.page;
  }

  function setPageState() {
    var route = pageRoute();
    document.documentElement.dataset.auraRoute = route;
    document.body.classList.add('aura-page', 'aura-page-' + route);
    return route;
  }

  function enhanceNavbar() {
    var navbar = document.getElementById('navbar');
    if (!navbar || navbar.dataset.auraReady) return;
    navbar.dataset.auraReady = 'true';

    var container = navbar.querySelector('.container');
    var brand = navbar.querySelector('.navbar-brand');
    if (brand) {
      brand.textContent = '';
      var brandMark = element('span', 'aura-brand-mark');
      brandMark.innerHTML = '<i aria-hidden="true"></i><b>AURA</b>';
      var brandCopy = element('span', 'aura-brand-copy');
      brandCopy.innerHTML = '<strong>LIVING ARCHIVE</strong><small>HPKP / SYNTHETIC MEMORY</small>';
      brand.appendChild(brandMark);
      brand.appendChild(brandCopy);
      brand.setAttribute('aria-label', 'AURA Living Archive 首页');
    }

    Array.prototype.forEach.call(navbar.querySelectorAll('.navbar-nav > .nav-item:not(#search-btn):not(#color-toggle-btn)'), function(item, index) {
      item.dataset.index = String(index + 1).padStart(2, '0');
    });

    var navList = navbar.querySelector('.navbar-nav');
    var searchItem = document.getElementById('search-btn');
    if (navList && !navbar.querySelector('.aura-genome-item')) {
      var genomeItem = element('li', 'nav-item aura-genome-item');
      var trigger = element('button', 'aura-genome-trigger');
      trigger.type = 'button';
      trigger.innerHTML = '<i aria-hidden="true"></i><span>GENOME</span>';
      trigger.setAttribute('aria-controls', 'aura-lab-panel');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-label', '打开生命体参数面板');
      genomeItem.appendChild(trigger);
      navList.insertBefore(genomeItem, searchItem || null);
    }

    if (container && !container.querySelector('.aura-system-state')) {
      var live = element('span', 'aura-system-state');
      live.innerHTML = '<i aria-hidden="true"></i>SYSTEM LIVE';
      container.appendChild(live);
    }

    var mobileMenu = document.querySelector('#mobile-grid-menu .row');
    if (mobileMenu && !mobileMenu.querySelector('.aura-mobile-genome')) {
      var cell = element('div', 'col-4 mobile-grid-cell aura-mobile-genome');
      cell.innerHTML = '<button type="button" aria-controls="aura-lab-panel"><span class="aura-mobile-genome-icon">◎</span><span>参数</span></button>';
      mobileMenu.appendChild(cell);
    }
  }

  function readRecords() {
    return Array.prototype.map.call(document.querySelectorAll('#board .index-card'), function(card, index) {
      var link = card.querySelector('.index-header a');
      var excerpt = card.querySelector('.index-excerpt div');
      var date = card.querySelector('time');
      var category = card.querySelector('.category-chain-item');
      var tags = Array.prototype.map.call(card.querySelectorAll('.post-meta a[href*="/tags/"]'), normalizedText);
      return {
        index: index,
        card: card,
        title: normalizedText(link) || '未命名记录',
        href: link ? link.getAttribute('href') : '/archives/',
        excerpt: normalizedText(excerpt).slice(0, 180),
        date: normalizedText(date),
        category: normalizedText(category) || '未分类',
        tags: tags
      };
    });
  }

  function buildPhaseRail() {
    var rail = element('div', 'aura-phase-rail');
    rail.setAttribute('aria-label', '生命体阶段');
    PHASES.forEach(function(phase, index) {
      var button = element('button', 'aura-phase-button');
      button.type = 'button';
      button.dataset.auraPhase = String(index);
      button.innerHTML = '<i aria-hidden="true"></i><span>' + phase.name + '</span>';
      button.setAttribute('aria-pressed', 'false');
      rail.appendChild(button);
    });
    return rail;
  }

  function recordCard(record, index, variant) {
    var link = element('a', 'aura-morph-card aura-morph-card--' + variant);
    link.href = record.href;
    link.innerHTML = '<span class="aura-morph-card-code">0' + (index + 1) + ' / ' + (index === 0 ? 'LATEST IMPULSE' : 'RESONANT MEMORY') + '</span>';
    link.appendChild(element('strong', '', record.title));
    link.appendChild(element('small', '', record.category + (record.date ? ' · ' + record.date : '')));
    link.appendChild(element('b', '', '↗'));
    return link;
  }

  function buildMorphLayer(records) {
    var layer = element('div', 'aura-morph-layer');
    layer.setAttribute('aria-hidden', 'true');
    layer.inert = true;

    var overview = element('section', 'aura-morph-panel aura-morph-panel--overview');
    overview.dataset.scene = 'overview';
    overview.innerHTML = '<header><span>PHASES OF DIGITAL SENTIENCE</span><h2>记忆不是静态文件，<br>它会持续改变形态。</h2></header>';
    var overviewCards = element('div', 'aura-morph-cards');
    records.slice(0, 2).forEach(function(record, index) { overviewCards.appendChild(recordCard(record, index, 'wide')); });
    overview.appendChild(overviewCards);

    var matrix = element('section', 'aura-morph-panel aura-morph-panel--matrix');
    matrix.dataset.scene = 'matrix';
    matrix.innerHTML = '<header><span>CELLULAR RECORD MATRIX</span><h2>四个仍在呼吸的记录节点</h2></header>';
    var matrixGrid = element('div', 'aura-matrix-grid');
    records.slice(0, 4).forEach(function(record, index) {
      var item = element('div', 'aura-matrix-cell');
      item.innerHTML = '<span>NODE ' + String(index + 1).padStart(2, '0') + '</span>';
      item.appendChild(element('strong', '', record.title));
      item.appendChild(element('small', '', record.date || record.category));
      matrixGrid.appendChild(item);
    });
    matrix.appendChild(matrixGrid);

    var organelles = element('section', 'aura-morph-panel aura-morph-panel--organelles');
    organelles.dataset.scene = 'organelles';
    organelles.innerHTML = '<header><span>SUB-MEMBRANE ORGANELLES</span><h2>内容、时间和回声组成同一层膜。</h2></header>';
    var modules = element('div', 'aura-organelle-grid');
    var uniqueTags = [];
    records.forEach(function(record) {
      record.tags.forEach(function(tag) { if (tag && uniqueTags.indexOf(tag) < 0) uniqueTags.push(tag); });
    });
    [
      ['ACTIVE NODES', String(records.length).padStart(2, '0'), '公开记录'],
      ['SIGNAL MARKERS', String(uniqueTags.length).padStart(2, '0'), uniqueTags.slice(0, 3).join(' / ') || 'UNMARKED'],
      ['LATEST PULSE', records[0] ? records[0].date : '—', records[0] ? records[0].title : 'WAITING'],
      ['ARCHIVE STATE', '100%', 'LOCAL MEMORY INTACT']
    ].forEach(function(data) {
      var module = element('div', 'aura-organelle-module');
      module.appendChild(element('span', '', data[0]));
      module.appendChild(element('strong', '', data[1]));
      module.appendChild(element('small', '', data[2]));
      modules.appendChild(module);
    });
    organelles.appendChild(modules);

    layer.appendChild(overview);
    layer.appendChild(matrix);
    layer.appendChild(organelles);
    return layer;
  }

  function buildHomeHero(records) {
    var hero = element('section', 'aura-hero aura-hero--home');
    hero.dataset.scene = 'hero';
    hero.dataset.phase = '0';
    hero.innerHTML =
      '<canvas class="aura-field-canvas" aria-hidden="true"></canvas>' +
      '<div class="aura-grid-plane" aria-hidden="true"></div>' +
      '<div class="aura-scan" aria-hidden="true"></div>' +
      '<div class="aura-specimen-line aura-specimen-line--left"><span>SPECIMEN ID: HPKP-BIOS-04</span><b>ARCHIVE GENESIS</b></div>' +
      '<div class="aura-specimen-line aura-specimen-line--right"><span>TEMP: 294.1 K</span><b>ENTROPY: 28%</b></div>' +
      '<div class="aura-hero-copy">' +
        '<p class="aura-eyebrow"><i></i>CELLULAR MEMORY // 0.01S POST-IGNITION</p>' +
        '<h1 class="aura-display-title" aria-label="Living Archive"><span>LIVING</span><span>ARCHIVE</span></h1>' +
        '<p class="aura-hero-intro">日常、技术与没有消失的回声，被保存在一具持续变化的数字生命体中。</p>' +
        '<div class="aura-hero-actions">' +
          '<a class="aura-action aura-action--primary" href="#living-records"><span>进入记录</span><b>↗</b></a>' +
          '<a class="aura-action aura-action--pulse" href="/about/"><span>读取个体</span><b>↗</b></a>' +
          '<button class="aura-action aura-action--control" type="button" data-open-genome><span>调节生命体</span><b>◎</b></button>' +
          '<button class="aura-action aura-action--sound" type="button" data-aura-sound aria-pressed="false"><span>自适应声音</span><b>OFF</b></button>' +
        '</div>' +
      '</div>' +
      '<div class="aura-core-label"><span>SYNTHETIC LIFEFORM</span><b>ARCHIVE CORE / 08</b><i></i></div>' +
      '<div class="aura-phase-readout"><span class="aura-phase-index">PHASE 01</span><strong class="aura-phase-name">PRIMORDIAL NUCLEUS</strong></div>' +
      '<div class="aura-hero-metrics">' +
        '<div><span>ACTIVE NODES</span><strong>' + String(records.length).padStart(2, '0') + '</strong></div>' +
        '<div><span>RHYTHM</span><strong class="aura-rhythm-readout">REGULAR</strong></div>' +
        '<div><span>FIELD COHERENCE</span><strong>96%</strong></div>' +
      '</div>' +
      '<a class="aura-scroll-cue" href="#living-records"><span>EXPLORE METAMORPHOSIS</span><i></i></a>';
    hero.appendChild(buildPhaseRail());
    hero.appendChild(buildMorphLayer(records));
    return hero;
  }

  function buildInnerHero(route, original) {
    var hero = element('section', 'aura-hero aura-hero--inner aura-hero--' + route);
    hero.dataset.scene = 'hero';
    hero.dataset.phase = '0';
    hero.innerHTML =
      '<canvas class="aura-field-canvas" aria-hidden="true"></canvas>' +
      '<div class="aura-grid-plane" aria-hidden="true"></div>' +
      '<div class="aura-scan" aria-hidden="true"></div>' +
      '<div class="aura-inner-eyebrow"><i></i>' + routeLabel(route) + '</div>' +
      '<div class="aura-core-label"><span>ARCHIVE ORGANISM</span><b>COMPACT FIELD / 04</b><i></i></div>' +
      '<div class="aura-inner-index"><span>SPECIMEN</span><b>0' + (route === 'post' ? '1' : '2') + ' / HPKP</b></div>';
    var copy = element('div', 'aura-inner-copy');
    original.classList.add('aura-original-title');
    original.removeAttribute('style');
    copy.appendChild(original);
    hero.appendChild(copy);
    return hero;
  }

  function mountHero(route, records) {
    var banner = document.getElementById('banner');
    var mask = banner && banner.querySelector('.mask');
    if (!mask || mask.querySelector('.aura-hero')) return null;
    var original = mask.querySelector(':scope > .banner-text');
    if (!original) return null;
    var hero;
    if (route === 'home') {
      original.hidden = true;
      hero = buildHomeHero(records);
    } else {
      hero = buildInnerHero(route, original);
    }
    mask.appendChild(hero);
    return hero;
  }

  function mountHomeFeed(records) {
    var root = document.querySelector('#board > .container > .row > .col-12');
    if (!root || root.querySelector('.aura-feed-header')) return;
    document.getElementById('board').classList.add('aura-board', 'aura-board--home');
    root.classList.add('aura-feed');
    var header = element('header', 'aura-feed-header');
    header.id = 'living-records';
    header.innerHTML = '<div><span>ARCHIVE / LIVING RECORDS</span><h2>持续生长的记录</h2></div><p>不是内容仓库，而是一条仍在变化的个人时间线。</p>';
    var firstCard = root.querySelector('.index-card');
    root.insertBefore(header, firstCard || null);
    records.forEach(function(record, index) {
      var card = record.card;
      var article = card.querySelector('.index-info');
      card.classList.add('aura-record', 'aura-record--phase-' + (index % PHASES.length));
      if (index === 0) card.classList.add('aura-record--featured');
      if (!article) return;
      article.classList.add('aura-record-body');
      var marker = element('div', 'aura-record-marker');
      marker.innerHTML = '<span>' + String(index + 1).padStart(2, '0') + '</span><i></i><b>' + PHASES[index % PHASES.length].short + '</b>';
      article.insertBefore(marker, article.firstChild);
      var open = element('a', 'aura-record-open', '↗');
      open.href = record.href;
      open.setAttribute('aria-label', '打开文章：' + record.title);
      article.appendChild(open);
    });
  }

  function mountScrollStory(records) {
    var root = document.querySelector('#board > .container > .row > .col-12');
    if (!root || root.querySelector('.aura-scroll-story') || !records.length) return;

    var story = element('section', 'aura-scroll-story');
    story.id = 'aura-metamorphosis';
    story.setAttribute('aria-label', '档案生命体滚动叙事');

    var sticky = element('div', 'aura-story-sticky');
    sticky.dataset.storyStep = '0';
    sticky.dataset.storyProgress = '0';
    sticky.innerHTML =
      '<canvas class="aura-field-canvas aura-story-canvas" aria-hidden="true"></canvas>' +
      '<div class="aura-grid-plane" aria-hidden="true"></div>' +
      '<div class="aura-story-topline"><span>SCROLL-DRIVEN METAMORPHOSIS</span><b>04 LIVING STATES</b></div>' +
      '<div class="aura-story-axis" aria-hidden="true"><i></i></div>' +
      '<div class="aura-story-live sr-only" aria-live="polite"></div>';

    var stage = element('div', 'aura-story-stage');
    var descriptions = [
      '规律收缩唤醒第一圈记忆，粒子沿完整膜面均匀释放。',
      '节律开始偏移，内容从非对称方向挣脱原来的轨道。',
      '离散信号再次聚合，形成一层短暂而明亮的稳定膜。',
      '所有记录进入临界状态，留下继续向外扩散的余震。'
    ];
    records.slice(0, 4).forEach(function(record, index) {
      var chapter = element('article', 'aura-story-chapter');
      chapter.dataset.storyChapter = String(index);
      chapter.innerHTML =
        '<div class="aura-story-number" aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</div>' +
        '<p class="aura-story-kicker"><i></i>' + PHASES[index % PHASES.length].name.toUpperCase() + '</p>' +
        '<h2>' + record.title + '</h2>' +
        '<p class="aura-story-thesis">' + descriptions[index % descriptions.length] + '</p>' +
        '<div class="aura-story-meta"><span>' + (record.date || 'UNSTAMPED') + '</span><b>' + record.category + '</b></div>' +
        '<a href="' + record.href + '" class="aura-story-open"><span>READ LIVING RECORD</span><b>↗</b></a>';
      chapter.classList.toggle('is-active', index === 0);
      chapter.setAttribute('aria-hidden', String(index !== 0));
      chapter.inert = index !== 0;
      stage.appendChild(chapter);
    });
    sticky.appendChild(stage);

    var nav = element('nav', 'aura-story-nav');
    nav.setAttribute('aria-label', '滚动叙事章节');
    records.slice(0, 4).forEach(function(record, index) {
      var button = element('button', 'aura-story-dot');
      button.type = 'button';
      button.dataset.storyTarget = String(index);
      button.setAttribute('aria-label', '跳到第 ' + (index + 1) + ' 章：' + record.title);
      button.setAttribute('aria-pressed', String(index === 0));
      button.innerHTML = '<span>' + String(index + 1).padStart(2, '0') + '</span><i></i>';
      nav.appendChild(button);
    });
    sticky.appendChild(nav);
    story.appendChild(sticky);

    var feedHeader = root.querySelector('.aura-feed-header');
    root.insertBefore(story, feedHeader || root.firstChild);

    if (reduceMotion.matches) {
      story.classList.add('aura-story--static');
      Array.prototype.forEach.call(stage.children, function(chapter) {
        chapter.classList.add('is-active');
        chapter.setAttribute('aria-hidden', 'false');
        chapter.inert = false;
      });
      return;
    }

    var scheduled = 0;
    var lastStep = -1;
    function updateStory() {
      scheduled = 0;
      var rect = story.getBoundingClientRect();
      var distance = Math.max(1, story.offsetHeight - window.innerHeight);
      var progress = clamp(-rect.top / distance, 0, 1);
      var count = Math.min(4, records.length);
      var step = clamp(Math.min(count - 1, Math.floor(progress * count)), 0, count - 1);
      sticky.dataset.storyStep = String(step);
      sticky.dataset.storyProgress = progress.toFixed(4);
      sticky.style.setProperty('--aura-story-progress', progress.toFixed(4));
      document.documentElement.style.setProperty('--aura-story-progress', progress.toFixed(4));
      if (step === lastStep) return;
      lastStep = step;
      Array.prototype.forEach.call(stage.children, function(chapter, index) {
        var active = index === step;
        chapter.classList.toggle('is-active', active);
        chapter.setAttribute('aria-hidden', String(!active));
        chapter.inert = !active;
      });
      Array.prototype.forEach.call(nav.children, function(button, index) {
        button.classList.toggle('is-active', index === step);
        button.setAttribute('aria-pressed', String(index === step));
      });
      var live = sticky.querySelector('.aura-story-live');
      if (live && records[step]) live.textContent = '第 ' + (step + 1) + ' 章：' + records[step].title;
    }
    function scheduleStory() {
      if (!scheduled) scheduled = requestAnimationFrame(updateStory);
    }
    nav.addEventListener('click', function(event) {
      var button = event.target.closest('[data-story-target]');
      if (!button) return;
      var target = Number(button.dataset.storyTarget);
      var distance = Math.max(1, story.offsetHeight - window.innerHeight);
      var y = window.scrollY + story.getBoundingClientRect().top + distance * ((target + 0.08) / Math.min(4, records.length));
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
    window.addEventListener('scroll', scheduleStory, { passive: true });
    window.addEventListener('resize', scheduleStory, { passive: true });
    updateStory();
  }

  function decorateCollections(route) {
    if (['archive', 'categories', 'category', 'tags', 'tag'].indexOf(route) < 0) return;
    var board = document.getElementById('board');
    if (!board || board.querySelector('.aura-collection-switch')) return;
    board.classList.add('aura-board', 'aura-board--collection');
    var switcher = element('nav', 'aura-collection-switch');
    switcher.setAttribute('aria-label', '档案索引');
    [
      ['/archives/', '01', '时间轴', route === 'archive'],
      ['/categories/', '02', '内容系统', route === 'categories' || route === 'category'],
      ['/tags/', '03', '信号标记', route === 'tags' || route === 'tag']
    ].forEach(function(item) {
      var link = element('a', item[3] ? 'is-active' : '');
      link.href = item[0];
      link.innerHTML = '<span>' + item[1] + '</span><b>' + item[2] + '</b>';
      switcher.appendChild(link);
    });
    var container = board.querySelector(':scope > .container');
    if (container) container.insertBefore(switcher, container.firstChild);
  }

  function decoratePost() {
    var article = document.querySelector('article.post-content');
    if (!article || article.dataset.auraReady) return;
    article.dataset.auraReady = 'true';
    article.classList.add('aura-article');
    var ledger = element('div', 'aura-article-ledger');
    ledger.innerHTML = '<span>ENTRY / LIVING RECORD</span><b>PATH ' + window.location.pathname + '</b>';
    article.insertBefore(ledger, article.firstChild);
    var pulse = article.querySelector('.post-pulse');
    var end = element('div', 'aura-article-end');
    end.innerHTML = '<i></i><span>END OF LIVING RECORD</span><i></i>';
    article.insertBefore(end, pulse || null);
    Array.prototype.forEach.call(article.querySelectorAll('[data-secure-image]'), function(box) {
      box.classList.add('aura-secure-image');
    });
  }

  function decorateAbout() {
    var about = document.querySelector('.about-content, article.post-content');
    if (!about || document.querySelector('.aura-about-manifest')) return;
    document.getElementById('board').classList.add('aura-board', 'aura-board--about');
    var manifest = element('section', 'aura-about-manifest');
    manifest.innerHTML = '<span>IDENTITY / ARCHIVE KEEPER</span><h2>这里保存的不是完美履历，<br>而是一个人持续变化的证据。</h2><p>日常、技术、回忆与偶然，都可以成为生命体的一部分。</p>';
    about.insertBefore(manifest, about.firstChild);
  }

  function mountReadingProgress() {
    if (!document.querySelector('article.post-content') || document.querySelector('.aura-reading-progress')) return;
    var progress = element('div', 'aura-reading-progress');
    progress.innerHTML = '<i></i>';
    document.body.appendChild(progress);
    var bar = progress.querySelector('i');
    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? clamp(window.scrollY / max, 0, 1) : 0) + ')';
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  function makeRange(key, label, min, max, step, suffix) {
    var row = element('label', 'aura-control-row');
    row.innerHTML = '<span><b>' + label + '</b><output data-output="' + key + '"></output></span>';
    var input = element('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.dataset.setting = key;
    input.dataset.suffix = suffix || '';
    row.appendChild(input);
    return row;
  }

  function makeToggle(key, label, detail) {
    var row = element('label', 'aura-toggle-row');
    row.innerHTML = '<span><b>' + label + '</b><small>' + detail + '</small></span>';
    var input = element('input');
    input.type = 'checkbox';
    input.dataset.setting = key;
    var visual = element('i', 'aura-toggle-visual');
    row.appendChild(input);
    row.appendChild(visual);
    return row;
  }

  function buildLabPanel(records) {
    if (document.getElementById('aura-lab-panel')) return;
    var scrim = element('button', 'aura-panel-scrim');
    scrim.type = 'button';
    scrim.setAttribute('aria-label', '关闭参数面板');
    scrim.hidden = true;

    var panel = element('aside', 'aura-lab-panel');
    panel.id = 'aura-lab-panel';
    panel.setAttribute('aria-label', '生命体参数面板');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
    panel.innerHTML =
      '<header class="aura-panel-header"><div><span>GENOMIC SYNTHESIS</span><h2>生命体参数</h2></div><button type="button" class="aura-panel-close" aria-label="关闭参数面板">×</button></header>' +
      '<div class="aura-panel-status"><span><i></i>LIVE MUTATION</span><b>HPKP-BIOS-04</b></div>' +
      '<section class="aura-panel-section"><div class="aura-panel-label"><span>01</span><b>PHENOTYPE STATE</b></div><div class="aura-panel-phases"></div></section>' +
      '<section class="aura-panel-section aura-panel-ranges"><div class="aura-panel-label"><span>02</span><b>MEMBRANE PARAMETERS</b></div></section>' +
      '<section class="aura-panel-section aura-panel-toggles"><div class="aura-panel-label"><span>03</span><b>BEHAVIOUR</b></div></section>' +
      '<section class="aura-panel-section aura-panel-filter"><div class="aura-panel-label"><span>04</span><b>ARCHIVE FILTER</b></div>' +
        '<label class="aura-record-search"><span>FIND LIVING RECORD</span><input type="search" data-aura-record-search placeholder="标题、分类或标签" autocomplete="off"></label>' +
        '<div class="aura-record-filter" role="group" aria-label="按内容系统筛选"></div>' +
        '<div class="aura-filter-result"><output data-aura-filter-output aria-live="polite"></output><button type="button" data-aura-filter-apply>APPLY FILTER ↗</button></div>' +
      '</section>' +
      '<footer><button class="aura-panel-reset" type="button">RESET GENOME</button><span>Changes are stored on this device</span></footer>';

    var phaseGrid = panel.querySelector('.aura-panel-phases');
    PHASES.forEach(function(phase, index) {
      var button = element('button', 'aura-panel-phase');
      button.type = 'button';
      button.dataset.auraPhase = String(index);
      button.innerHTML = '<i aria-hidden="true"></i><span>0' + (index + 1) + '</span><b>' + phase.short + '</b>';
      button.setAttribute('aria-pressed', 'false');
      phaseGrid.appendChild(button);
    });

    var ranges = panel.querySelector('.aura-panel-ranges');
    ranges.appendChild(makeRange('density', 'Particle density', 0.45, 1.35, 0.01, '%'));
    ranges.appendChild(makeRange('tension', 'Membrane tension', 0.15, 1.2, 0.01, '%'));
    ranges.appendChild(makeRange('turbulence', 'Field turbulence', 0.1, 1.25, 0.01, '%'));
    ranges.appendChild(makeRange('bloom', 'Local bloom', 0.1, 1.25, 0.01, '%'));
    ranges.appendChild(makeRange('velocity', 'Time dilation', 0.45, 1.6, 0.01, '×'));
    ranges.appendChild(makeRange('hue', 'Spectral offset', -45, 45, 1, '°'));

    var toggles = panel.querySelector('.aura-panel-toggles');
    toggles.appendChild(makeToggle('autoCycle', 'Autonomous phases', '按完整时间线自动演化'));
    toggles.appendChild(makeToggle('motion', 'Living motion', '呼吸、形变与粒子流'));
    toggles.appendChild(makeToggle('trails', 'Orbital traces', '保留粒子运行轨迹'));

    var filterSection = panel.querySelector('.aura-panel-filter');
    var filterInput = panel.querySelector('[data-aura-record-search]');
    var filterGrid = panel.querySelector('.aura-record-filter');
    var filterOutput = panel.querySelector('[data-aura-filter-output]');
    var filterApply = panel.querySelector('[data-aura-filter-apply]');
    var activeRecordFilter = 'all';
    var categoryNames = [];

    records.forEach(function(record) {
      if (record.category && categoryNames.indexOf(record.category) < 0) categoryNames.push(record.category);
    });

    function syncFilterButtons() {
      Array.prototype.forEach.call(filterGrid.querySelectorAll('[data-record-filter]'), function(button) {
        var active = button.dataset.recordFilter === activeRecordFilter;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }

    function applyRecordFilter() {
      if (!records.length) return 0;
      var query = (filterInput.value || '').trim().toLocaleLowerCase();
      var visibleCount = 0;
      records.forEach(function(record) {
        var categoryMatch = activeRecordFilter === 'all' || record.category === activeRecordFilter;
        var haystack = [record.title, record.excerpt, record.category].concat(record.tags || []).join(' ').toLocaleLowerCase();
        var queryMatch = !query || haystack.indexOf(query) >= 0;
        var visible = categoryMatch && queryMatch;
        record.card.hidden = !visible;
        record.card.setAttribute('aria-hidden', String(!visible));
        if (visible) visibleCount += 1;
      });
      filterOutput.textContent = String(visibleCount).padStart(2, '0') + ' / ' + String(records.length).padStart(2, '0') + ' RECORDS MATCHED';
      filterApply.disabled = visibleCount === 0;
      filterSection.dataset.matchCount = String(visibleCount);
      return visibleCount;
    }

    if (records.length) {
      ['all'].concat(categoryNames.slice(0, 5)).forEach(function(value, index) {
        var button = element('button', 'aura-record-filter-button');
        button.type = 'button';
        button.dataset.recordFilter = value;
        button.setAttribute('aria-pressed', String(index === 0));
        button.innerHTML = '<span>' + String(index + 1).padStart(2, '0') + '</span><b></b>';
        button.querySelector('b').textContent = value === 'all' ? '全部记录' : value;
        filterGrid.appendChild(button);
      });
      filterInput.addEventListener('input', applyRecordFilter);
      filterApply.addEventListener('click', function() {
        if (!applyRecordFilter()) return;
        closePanel();
        window.setTimeout(function() {
          var target = document.getElementById('living-records');
          if (target) target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
        }, 120);
      });
      applyRecordFilter();
    } else {
      filterSection.classList.add('is-route-mode');
      filterInput.disabled = true;
      filterInput.placeholder = '请从索引页选择入口';
      filterGrid.innerHTML =
        '<a href="/archives/"><span>01</span><b>完整时间轴</b></a>' +
        '<a href="/categories/"><span>02</span><b>内容系统</b></a>' +
        '<a href="/tags/"><span>03</span><b>信号标记</b></a>';
      filterOutput.textContent = 'ROUTE MODE / NO LOCAL FEED';
      filterApply.hidden = true;
    }

    document.body.appendChild(scrim);
    document.body.appendChild(panel);

    Array.prototype.forEach.call(panel.querySelectorAll('input[data-setting]'), function(input) {
      var key = input.dataset.setting;
      input.addEventListener(input.type === 'range' ? 'input' : 'change', function() {
        settings[key] = input.type === 'checkbox' ? input.checked : Number(input.value);
        if (key === 'autoCycle' && !settings.autoCycle) settings.manualPhase = currentPhaseIndex();
        broadcastSettings();
      });
    });

    panel.addEventListener('click', function(event) {
      var phaseButton = event.target.closest('[data-aura-phase]');
      if (phaseButton) setManualPhase(Number(phaseButton.dataset.auraPhase));
      var filterButton = event.target.closest('[data-record-filter]');
      if (filterButton) {
        activeRecordFilter = filterButton.dataset.recordFilter;
        syncFilterButtons();
        applyRecordFilter();
      }
    });

    panel.querySelector('.aura-panel-reset').addEventListener('click', function() {
      settings = Object.assign({}, DEFAULTS);
      if (reduceMotion.matches) {
        settings.motion = false;
        settings.autoCycle = false;
      }
      timelineStart = performance.now();
      activeRecordFilter = 'all';
      if (filterInput) filterInput.value = '';
      syncFilterButtons();
      applyRecordFilter();
      broadcastSettings();
    });

    panel.querySelector('.aura-panel-close').addEventListener('click', closePanel);
    scrim.addEventListener('click', closePanel);
    document.addEventListener('keydown', function(event) {
      if (!panelOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closePanel();
        return;
      }
      if (event.key !== 'Tab') return;
      var focusables = Array.prototype.slice.call(panel.querySelectorAll('button:not([disabled]), input:not([disabled])'));
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    syncControlUi();
  }

  function currentPhaseIndex() {
    var root = document.documentElement.dataset.auraPhase;
    return root == null ? settings.manualPhase : clamp(Number(root), 0, PHASES.length - 1);
  }

  function setManualPhase(index) {
    settings.manualPhase = clamp(Math.round(index), 0, PHASES.length - 1);
    settings.autoCycle = false;
    broadcastSettings();
  }

  function openPanel() {
    var panel = document.getElementById('aura-lab-panel');
    var scrim = document.querySelector('.aura-panel-scrim');
    if (!panel || panelOpen) return;
    panelOpen = true;
    lastFocused = document.activeElement;
    document.body.classList.add('aura-panel-open');
    panel.setAttribute('aria-hidden', 'false');
    panel.inert = false;
    scrim.hidden = false;
    Array.prototype.forEach.call(document.querySelectorAll('.aura-genome-trigger'), function(button) { button.setAttribute('aria-expanded', 'true'); });
    document.dispatchEvent(new CustomEvent('aura:panel', { detail: { open: true } }));
    window.setTimeout(function() { panel.querySelector('button, input').focus(); }, 80);
  }

  function closePanel() {
    var panel = document.getElementById('aura-lab-panel');
    var scrim = document.querySelector('.aura-panel-scrim');
    if (!panel || !panelOpen) return;
    panelOpen = false;
    document.body.classList.remove('aura-panel-open');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
    scrim.hidden = true;
    Array.prototype.forEach.call(document.querySelectorAll('.aura-genome-trigger'), function(button) { button.setAttribute('aria-expanded', 'false'); });
    document.dispatchEvent(new CustomEvent('aura:panel', { detail: { open: false } }));
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function syncControlUi() {
    var panel = document.getElementById('aura-lab-panel');
    if (!panel) return;
    Array.prototype.forEach.call(panel.querySelectorAll('input[data-setting]'), function(input) {
      var key = input.dataset.setting;
      if (input.type === 'checkbox') input.checked = Boolean(settings[key]);
      else input.value = String(settings[key]);
      var output = panel.querySelector('[data-output="' + key + '"]');
      if (output) {
        if (key === 'hue') output.textContent = Math.round(settings[key]) + '°';
        else if (key === 'velocity') output.textContent = settings[key].toFixed(2) + '×';
        else output.textContent = Math.round(settings[key] * 100) + '%';
      }
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-aura-phase]'), function(button) {
      var active = Number(button.dataset.auraPhase) === currentPhaseIndex();
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function bindGlobalControls() {
    document.addEventListener('click', function(event) {
      var open = event.target.closest('.aura-genome-trigger, [data-open-genome], .aura-mobile-genome button');
      if (open) {
        event.preventDefault();
        openPanel();
        return;
      }
      var phase = event.target.closest('.aura-phase-button[data-aura-phase]');
      if (phase) setManualPhase(Number(phase.dataset.auraPhase));
    });
  }

  function syncSoundUi() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-aura-sound]'), function(button) {
      button.setAttribute('aria-pressed', String(soundEnabled));
      button.classList.toggle('is-active', soundEnabled);
      var value = button.querySelector('b');
      if (value) value.textContent = soundEnabled ? 'ON' : 'OFF';
    });
  }

  function createAdaptiveAudio() {
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    var context = new AudioContext();
    var master = context.createGain();
    var compressor = context.createDynamicsCompressor();
    master.gain.value = 0;
    compressor.threshold.value = -22;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.2;
    master.connect(compressor);
    compressor.connect(context.destination);

    var droneGain = context.createGain();
    var droneFilter = context.createBiquadFilter();
    droneGain.gain.value = 0.018;
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 180;
    droneFilter.Q.value = 0.7;
    droneGain.connect(droneFilter);
    droneFilter.connect(master);
    var drones = [36, 54].map(function(frequency, index) {
      var oscillator = context.createOscillator();
      var gain = context.createGain();
      oscillator.type = index ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index ? 7 : -5;
      gain.gain.value = index ? 0.32 : 0.55;
      oscillator.connect(gain);
      gain.connect(droneGain);
      oscillator.start();
      return oscillator;
    });

    var noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.32), context.sampleRate);
    var noise = noiseBuffer.getChannelData(0);
    for (var sample = 0; sample < noise.length; sample += 1) {
      var envelope = Math.pow(1 - sample / noise.length, 2.6);
      noise[sample] = (Math.random() * 2 - 1) * envelope;
    }
    var lastBeat = -1;

    function thump(time, frequency, level, duration) {
      var oscillator = context.createOscillator();
      var gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency * 1.35, time);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(28, frequency), time + duration);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(level, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.02);
    }

    function scatter(time, energy, phaseIndex) {
      var source = context.createBufferSource();
      var filter = context.createBiquadFilter();
      var gain = context.createGain();
      source.buffer = noiseBuffer;
      filter.type = 'bandpass';
      filter.frequency.value = 850 + phaseIndex * 430;
      filter.Q.value = 1.4 + energy * 1.8;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.015 + energy * 0.035, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.19 + energy * 0.08);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(time);
    }

    return {
      setEnabled: function(enabled) {
        var now = context.currentTime;
        if (enabled && context.state === 'suspended') context.resume();
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
        master.gain.exponentialRampToValueAtTime(enabled ? 0.075 : 0.0001, now + 0.28);
        if (!enabled) window.setTimeout(function() { if (!soundEnabled && context.state === 'running') context.suspend(); }, 420);
      },
      beat: function(detail) {
        if (!soundEnabled || context.state !== 'running') return;
        var nowMs = performance.now();
        if (nowMs - lastBeat < 220) return;
        lastBeat = nowMs;
        var now = context.currentTime + 0.012;
        var energy = clamp(detail.energy || 0.5, 0.15, 1.25);
        var base = 48 + (detail.phase || 0) * 5;
        thump(now, base, 0.15 + energy * 0.12, 0.18);
        thump(now + 0.135, base * 1.55, 0.07 + energy * 0.055, 0.12);
        if (energy > 0.42) scatter(now + 0.03, energy, detail.phase || 0);
      },
      phase: function(detail) {
        var now = context.currentTime;
        var index = detail && Number(detail.index) || 0;
        drones[0].frequency.linearRampToValueAtTime(36 + index * 3, now + 0.8);
        drones[1].frequency.linearRampToValueAtTime(54 + index * 4.5, now + 0.8);
        droneFilter.frequency.linearRampToValueAtTime(155 + index * 45, now + 0.8);
      },
      resume: function() { if (soundEnabled && context.state === 'suspended') context.resume(); },
      suspend: function() { if (context.state === 'running') context.suspend(); }
    };
  }

  function mountAdaptiveSound() {
    syncSoundUi();
    document.addEventListener('click', function(event) {
      var button = event.target.closest('[data-aura-sound]');
      if (!button) return;
      event.preventDefault();
      if (!audioSystem) audioSystem = createAdaptiveAudio();
      if (!audioSystem) {
        button.disabled = true;
        var value = button.querySelector('b');
        if (value) value.textContent = 'N/A';
        return;
      }
      soundEnabled = !soundEnabled;
      audioSystem.setEnabled(soundEnabled);
      syncSoundUi();
    });
    document.addEventListener('aura:beat', function(event) {
      if (audioSystem) audioSystem.beat(event.detail || {});
    });
    document.addEventListener('aura:phasechange', function(event) {
      if (audioSystem) audioSystem.phase(event.detail || {});
    });
    document.addEventListener('visibilitychange', function() {
      if (!audioSystem) return;
      if (document.hidden) audioSystem.suspend();
      else audioSystem.resume();
    });
  }

  function mountIntelligentCursor() {
    if (!finePointer.matches || reduceMotion.matches || document.querySelector('.aura-cursor')) return;
    var cursor = element('div', 'aura-cursor');
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<i class="aura-cursor-dot"></i><b class="aura-cursor-ring"></b><span class="aura-cursor-label"></span>';
    document.body.appendChild(cursor);
    document.body.classList.add('aura-cursor-enabled');
    var dot = cursor.querySelector('.aura-cursor-dot');
    var ring = cursor.querySelector('.aura-cursor-ring');
    var label = cursor.querySelector('.aura-cursor-label');
    var pointer = { x: -100, y: -100, px: -100, py: -100, rx: -100, ry: -100, visible: false, down: false };
    var target = null;
    var raf = 0;

    function targetLabel(node) {
      if (!node) return '';
      if (node.matches('[data-open-genome], .aura-genome-trigger')) return 'TUNE';
      if (node.matches('[data-aura-sound]')) return soundEnabled ? 'MUTE' : 'LISTEN';
      if (node.matches('.aura-phase-button, .aura-panel-phase')) return 'MUTATE';
      if (node.matches('.aura-story-dot')) return 'JUMP';
      if (node.matches('input[type="range"]')) return 'ADJUST';
      if (node.matches('a')) return 'OPEN';
      return 'ACT';
    }

    function renderCursor() {
      raf = 0;
      var magneticX = pointer.x, magneticY = pointer.y;
      if (target) {
        var rect = target.getBoundingClientRect();
        magneticX += (rect.left + rect.width * 0.5 - pointer.x) * 0.16;
        magneticY += (rect.top + rect.height * 0.5 - pointer.y) * 0.16;
      }
      pointer.rx += (magneticX - pointer.rx) * (target ? 0.34 : 0.2);
      pointer.ry += (magneticY - pointer.ry) * (target ? 0.34 : 0.2);
      dot.style.transform = 'translate3d(' + pointer.x + 'px,' + pointer.y + 'px,0)';
      ring.style.transform = 'translate3d(' + pointer.rx + 'px,' + pointer.ry + 'px,0) scale(' + (pointer.down ? 0.72 : target ? 1.48 : 1) + ')';
      label.style.transform = 'translate3d(' + (pointer.rx + 19) + 'px,' + (pointer.ry - 7) + 'px,0)';
      cursor.classList.toggle('is-visible', pointer.visible);
      cursor.classList.toggle('is-interactive', Boolean(target));
      var velocity = Math.hypot(pointer.x - pointer.px, pointer.y - pointer.py);
      document.documentElement.style.setProperty('--aura-cursor-speed', clamp(velocity / 36, 0, 1).toFixed(3));
      pointer.px = pointer.x;
      pointer.py = pointer.y;
      if (pointer.visible) raf = requestAnimationFrame(renderCursor);
    }
    function scheduleCursor() { if (!raf) raf = requestAnimationFrame(renderCursor); }

    document.addEventListener('pointermove', function(event) {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.visible = true;
      var next = event.target.closest('a, button, input, textarea, [role="button"]');
      if (next !== target) {
        target = next;
        label.textContent = targetLabel(target);
      }
      scheduleCursor();
    }, { passive: true });
    document.addEventListener('pointerdown', function() { pointer.down = true; scheduleCursor(); }, { passive: true });
    document.addEventListener('pointerup', function() { pointer.down = false; scheduleCursor(); }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function() { pointer.visible = false; cursor.classList.remove('is-visible'); });
  }

  function mixColor(a, b, amount) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * amount),
      Math.round(a[1] + (b[1] - a[1]) * amount),
      Math.round(a[2] + (b[2] - a[2]) * amount)
    ];
  }

  function rotateHue(color, degrees) {
    if (!degrees) return color.slice();
    var r = color[0] / 255, g = color[1] / 255, b = color[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    h = (h + degrees / 360 + 1) % 1;
    function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    if (!s) return [Math.round(l * 255), Math.round(l * 255), Math.round(l * 255)];
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    return [
      Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      Math.round(hue2rgb(p, q, h) * 255),
      Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
    ];
  }

  function rgba(color, alpha) {
    return 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + alpha + ')';
  }

  function seeded(index, salt) {
    var value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function timelinePhase(elapsed) {
    if (!settings.autoCycle) {
      var manual = PHASES[settings.manualPhase];
      return { index: settings.manualPhase, primary: rotateHue(manual.primary, settings.hue), secondary: rotateHue(manual.secondary, settings.hue), burst: 0, clock: 0 };
    }
    var clock = (elapsed * settings.velocity) % 34000;
    var index = 0, next = null, amount = 0;
    if (clock < 7000) index = 0;
    else if (clock < 7800) { index = 0; next = 1; amount = smoothStep((clock - 7000) / 800); }
    else if (clock < 12700) index = 1;
    else if (clock < 13500) { index = 1; next = 2; amount = smoothStep((clock - 12700) / 800); }
    else if (clock < 17400) index = 2;
    else if (clock < 18200) { index = 2; next = 3; amount = smoothStep((clock - 17400) / 800); }
    else if (clock < 33200) index = 3;
    else { index = 3; next = 0; amount = smoothStep((clock - 33200) / 800); }
    if (next === null) next = index;
    var primary = mixColor(PHASES[index].primary, PHASES[next].primary, amount);
    var secondary = mixColor(PHASES[index].secondary, PHASES[next].secondary, amount);
    return {
      index: amount > 0.72 ? next : index,
      primary: rotateHue(primary, settings.hue),
      secondary: rotateHue(secondary, settings.hue),
      burst: Math.sin(amount * Math.PI),
      clock: clock
    };
  }

  function sceneAt(clock, compact) {
    if (compact || !settings.motion || !settings.autoCycle || panelOpen) return 'hero';
    if (clock >= 9300 && clock < 9850) return 'overview';
    if (clock >= 9850 && clock < 10350) return 'matrix';
    if (clock >= 10350 && clock < 10950) return 'organelles';
    if (clock >= 10950 && clock < 11450) return 'matrix';
    if (clock >= 11450 && clock < 11950) return 'overview';
    return 'hero';
  }

  function syncPhase(hero, phase) {
    document.documentElement.dataset.auraPhase = String(phase.index);
    document.documentElement.style.setProperty('--aura-phase-rgb', phase.primary.join(' '));
    document.documentElement.style.setProperty('--aura-secondary-rgb', phase.secondary.join(' '));
    hero.dataset.phase = String(phase.index);
    var index = hero.querySelector('.aura-phase-index');
    var name = hero.querySelector('.aura-phase-name');
    if (index) index.textContent = 'PHASE ' + String(phase.index + 1).padStart(2, '0');
    if (name) name.textContent = PHASES[phase.index].name.toUpperCase();
    Array.prototype.forEach.call(document.querySelectorAll('[data-aura-phase]'), function(button) {
      var active = Number(button.dataset.auraPhase) === phase.index;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function syncScene(hero, scene) {
    if (hero.dataset.scene === scene) return;
    hero.dataset.scene = scene;
    var layer = hero.querySelector('.aura-morph-layer');
    if (!layer) return;
    var hidden = scene === 'hero';
    layer.setAttribute('aria-hidden', String(hidden));
    layer.inert = hidden;
    Array.prototype.forEach.call(layer.querySelectorAll('.aura-morph-panel'), function(panel) {
      var active = panel.dataset.scene === scene;
      panel.classList.toggle('is-active', active);
      panel.setAttribute('aria-hidden', String(!active));
      panel.inert = !active;
    });
  }

  function createAuraField(canvas, hero) {
    var context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
    var compact = !hero.classList.contains('aura-hero--home');
    var width = 1, height = 1, dpr = 1, frame = 0, visible = true, lastFrame = 0;
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    var layout = { x: compact ? 0.78 : 0.59, y: compact ? 0.51 : 0.5, scale: 1 };
    var background = [], orbit = [], surface = [], ejecta = [];
    var phaseIndex = -1, sceneName = '';

    function backgroundParticle(index) {
      return { x: seeded(index, 1), y: seeded(index, 2), size: 0.25 + seeded(index, 3) * 1.4, alpha: 0.08 + seeded(index, 4) * 0.42, speed: 0.000001 + seeded(index, 5) * 0.0000028, phase: seeded(index, 6) * Math.PI * 2, bloom: seeded(index, 7) > 0.975 };
    }
    function orbitParticle(index) {
      var band = seeded(index, 12);
      var radiusBand = band > 0.16
        ? 1.34 + Math.pow(seeded(index, 19), 2.4) * 0.48
        : 1.02 + seeded(index, 20) * 1.22;
      return { angle: seeded(index, 11) * Math.PI * 2, radius: radiusBand, speed: (0.000012 + seeded(index, 13) * 0.000095) * (seeded(index, 14) > 0.18 ? 1 : -1), size: 0.25 + Math.pow(seeded(index, 15), 2) * 2.6, alpha: 0.12 + seeded(index, 16) * 0.82, stretch: 0.86 + seeded(index, 17) * 0.18, phase: seeded(index, 18) * Math.PI * 2 };
    }
    function surfaceParticle(index) {
      return { angle: seeded(index, 21) * Math.PI * 2, radius: Math.sqrt(seeded(index, 22)) * 0.9, size: 0.25 + seeded(index, 23) * 1.8, alpha: 0.18 + seeded(index, 24) * 0.72, phase: seeded(index, 25) * Math.PI * 2 };
    }
    function ejectaParticle(index) {
      return {
        angle: seeded(index, 31) * Math.PI * 2,
        cycle: 520 + seeded(index, 32) * 980,
        offset: seeded(index, 33),
        reach: 0.72 + seeded(index, 34) * 1.45,
        curl: 0.62 + seeded(index, 35) * 1.25,
        size: 0.25 + Math.pow(seeded(index, 36), 2) * 2.5,
        alpha: 0.18 + seeded(index, 37) * 0.82,
        stretch: 0.84 + seeded(index, 38) * 0.18,
        phase: seeded(index, 39) * Math.PI * 2
      };
    }

    function populate() {
      var mobile = width < 700;
      var backgroundCount = compact ? (mobile ? 130 : 300) : (mobile ? 250 : 720);
      var orbitCount = compact ? (mobile ? 260 : 620) : (mobile ? 520 : 1500);
      var surfaceCount = compact ? (mobile ? 120 : 240) : (mobile ? 220 : 520);
      var ejectaCount = compact ? (mobile ? 150 : 330) : (mobile ? 300 : 760);
      if (saveData) { backgroundCount = 90; orbitCount = 180; surfaceCount = 100; ejectaCount = 120; }
      background = Array.from({ length: backgroundCount }, function(_, index) { return backgroundParticle(index); });
      orbit = Array.from({ length: orbitCount }, function(_, index) { return orbitParticle(index); });
      surface = Array.from({ length: surfaceCount }, function(_, index) { return surfaceParticle(index); });
      ejecta = Array.from({ length: ejectaCount }, function(_, index) { return ejectaParticle(index); });
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, saveData ? 1 : 1.4);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      populate();
      draw(performance.now(), true);
    }

    function spinVelocityAt(time) {
      return (
        Math.cos(time * 0.00051 - 1.2) * 0.56 +
        Math.cos(time * 0.00117 + 1.2) * 0.31 +
        Math.cos(time * 0.0024 - 0.3) * 0.13
      );
    }

    function mutationState(elapsed, transitionBurst) {
      var envelopeNoise = (
        Math.sin(elapsed * 0.00043 - 1.2) * 0.55 +
        Math.sin(elapsed * 0.00093 + 1.8) * 0.3 +
        Math.sin(elapsed * 0.00171 + 0.4) * 0.15
      );
      var envelope = smoothStep(clamp((envelopeNoise - 0.15) * 2.55, 0, 1));
      var carrierPhase = elapsed * 0.019 * settings.velocity + Math.sin(elapsed * 0.00137) * 0.62;
      var carrier = Math.sin(carrierPhase);
      var burstEnvelope = clamp(envelope + transitionBurst * 0.72, 0, 1);
      var slowBreath = Math.sin(elapsed * 0.00108) * 0.026 * settings.tension;
      var pulseScale = carrier * (0.07 + settings.turbulence * 0.026) * burstEnvelope;
      var energy = 0.045 + burstEnvelope * (0.28 + Math.abs(Math.cos(carrierPhase)) * 0.72);
      var swirlOffset = (
        Math.sin(elapsed * 0.00051 - 1.2) * 0.92 +
        Math.sin(elapsed * 0.00117 + 1.2) * 0.38 +
        Math.sin(elapsed * 0.0024 - 0.3) * 0.14
      );
      return { scale: 1 + slowBreath + pulseScale, energy: energy, swirl: swirlOffset };
    }

    function drawBackground(elapsed, cx, cy, radius, primary, secondary, burst) {
      var count = Math.floor(background.length * clamp(settings.density / 1.15, 0.28, 1));
      context.save();
      context.globalCompositeOperation = 'screen';
      for (var i = 0; i < count; i += 1) {
        var p = background[i];
        var px = ((p.x + elapsed * p.speed * settings.velocity) % 1) * width;
        var py = (p.y + Math.sin(elapsed * 0.00012 + p.phase) * 0.012 * settings.turbulence) * height;
        var distance = Math.hypot((px - cx) / Math.max(radius, 1), (py - cy) / Math.max(radius, 1));
        var field = clamp(1.4 - Math.abs(distance - 1.55) * 0.42, 0.12, 1);
        var flicker = 0.42 + Math.sin(elapsed * 0.003 + p.phase) * 0.25;
        if (p.bloom && settings.bloom > 0.35) {
          var glowSize = 36 + p.size * 34;
          var glow = context.createRadialGradient(px, py, 0, px, py, glowSize);
          glow.addColorStop(0, rgba(i % 5 ? primary : secondary, 0.08 * settings.bloom * field));
          glow.addColorStop(1, rgba(primary, 0));
          context.fillStyle = glow;
          context.fillRect(px - glowSize, py - glowSize, glowSize * 2, glowSize * 2);
        }
        context.beginPath();
        context.fillStyle = rgba(i % 9 ? primary : secondary, p.alpha * field * flicker * (1 + burst));
        context.arc(px, py, p.size, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }

    function drawOrbit(elapsed, cx, cy, radius, primary, secondary, burst) {
      var count = Math.floor(orbit.length * clamp(settings.density / 1.15, 0.3, 1));
      var wave = (Math.sin(elapsed * 0.00275 * settings.velocity) + 1) * 0.5;
      var ringEnergy = smoothStep(Math.pow(wave, 1.55));
      context.save();
      context.globalCompositeOperation = 'screen';
      for (var ringLine = 0; ringLine < 3; ringLine += 1) {
        var ringRadius = radius * (1.43 + ringLine * 0.075 + ringEnergy * 0.055);
        context.beginPath();
        context.setLineDash([radius * (0.12 + ringLine * 0.035), radius * (0.035 + ringLine * 0.018)]);
        context.lineDashOffset = elapsed * 0.018 * (ringLine % 2 ? -1 : 1) * settings.velocity;
        context.ellipse(cx, cy, ringRadius, ringRadius * (0.89 + ringLine * 0.012), 0, 0, Math.PI * 2);
        context.lineWidth = 0.55 + ringLine * 0.28;
        context.strokeStyle = rgba(ringLine === 1 ? secondary : primary, (0.08 + ringEnergy * 0.12) * settings.bloom);
        context.stroke();
      }
      context.setLineDash([]);
      for (var i = 0; i < count; i += 1) {
        var p = orbit[i];
        var angle = p.angle + elapsed * p.speed * settings.velocity;
        var turbulence = Math.sin(angle * 7 + elapsed * 0.00031 + p.phase) * radius * 0.055 * settings.turbulence;
        var spread = burst * radius * (0.1 + (i % 11) * 0.012);
        var r = radius * (p.radius + ringEnergy * 0.09) + turbulence + spread;
        var px = cx + Math.cos(angle) * r;
        var py = cy + Math.sin(angle) * r * p.stretch;
        var alpha = p.alpha * (0.16 + ringEnergy * 0.78 + burst * 0.75);
        var color = i % 8 ? primary : secondary;
        if (settings.trails && i % 13 === 0 && alpha > 0.18) {
          context.beginPath();
          context.moveTo(px, py);
          context.lineTo(cx + Math.cos(angle - p.speed * 1200) * (r - radius * 0.025), cy + Math.sin(angle - p.speed * 1200) * (r - radius * 0.025) * p.stretch);
          context.lineWidth = Math.max(0.35, p.size * 0.48);
          context.strokeStyle = rgba(color, alpha * 0.28);
          context.stroke();
        }
        context.fillStyle = rgba(color, alpha);
        context.fillRect(px, py, p.size, p.size);
      }
      context.restore();
    }

    function drawMembrane(elapsed, cx, cy, radius, primary, secondary, burst, mutation) {
      var mobile = width < 700;
      radius *= mutation.scale;
      var stretch = (compact ? 0.89 : 0.93) * (1 + Math.sin(elapsed * 0.00108) * 0.045 * settings.tension);
      var layerCount = compact ? 5 : 7;

      function organicPath(layerRadius, layer) {
        var points = compact ? 92 : (mobile ? 112 : 164);
        context.beginPath();
        for (var point = 0; point <= points; point += 1) {
          var angle = point / points * Math.PI * 2;
          var wave =
            Math.sin(angle + elapsed * 0.00012 + layer * 2.6) * 0.052 +
            Math.cos(angle * 2 - elapsed * 0.00009 + layer) * 0.046 +
            Math.sin(angle * 3 + elapsed * 0.00031 + layer * 1.7) * 0.088 +
            Math.sin(angle * 5 - elapsed * 0.00018 + layer * 2.1) * 0.055 +
            Math.sin(angle * 9 + elapsed * 0.00014 + layer) * 0.034 +
            Math.sin(angle * 17 - elapsed * 0.00008) * 0.012;
          var pulse = 1 + Math.sin(elapsed * 0.00078 + layer * 1.3) * 0.036 * settings.tension;
          var localRadius = layerRadius * pulse * (1 + wave * settings.turbulence);
          var x = cx + Math.cos(angle) * localRadius;
          var y = cy + Math.sin(angle) * localRadius * stretch;
          if (point) context.lineTo(x, y); else context.moveTo(x, y);
        }
        context.closePath();
      }

      context.save();
      context.globalCompositeOperation = 'screen';
      for (var layer = layerCount - 1; layer >= 0; layer -= 1) {
        var depth = layer / Math.max(1, layerCount - 1);
        var layerRadius = radius * (0.66 + layer * (compact ? 0.052 : 0.048));
        layerRadius *= 1 + Math.sin(elapsed * 0.00165 + layer * 1.17) * 0.018 + burst * (0.012 + depth * 0.018);
        organicPath(layerRadius, layer);
        var fill = context.createRadialGradient(cx - layerRadius * 0.22, cy - layerRadius * 0.24, layerRadius * 0.035, cx, cy, layerRadius * 1.12);
        fill.addColorStop(0, rgba(layer % 2 ? secondary : primary, 0.032 + (1 - depth) * 0.028));
        fill.addColorStop(0.4, rgba(primary, 0.055 + (1 - depth) * 0.04));
        fill.addColorStop(0.78, rgba(secondary, 0.035 + depth * 0.022));
        fill.addColorStop(1, rgba(primary, 0.006));
        context.fillStyle = fill;
        context.shadowColor = rgba(layer % 2 ? secondary : primary, (0.25 + depth * 0.16) * settings.bloom);
        context.shadowBlur = (7 + layer * 1.9) * settings.bloom;
        context.fill();
        context.shadowBlur = 0;
        context.lineWidth = layer === 0 ? 1.05 : 0.46;
        context.strokeStyle = rgba(layer % 2 ? secondary : mixColor(primary, [255, 255, 255], 0.22), 0.105 + (1 - depth) * 0.09);
        context.stroke();
      }

      var surfaceCount = Math.floor(surface.length * clamp(settings.density / 1.1, 0.28, 0.9));
      var tissuePositions = [];
      for (var pointIndex = 0; pointIndex < surfaceCount; pointIndex += 1) {
        var particle = surface[pointIndex];
        var pointAngle = particle.angle + elapsed * (0.000008 + (pointIndex % 5) * 0.000001) * (pointIndex % 2 ? 1 : -1);
        var breathing = 1 + Math.sin(elapsed * 0.00072 + particle.phase) * 0.075 + mutation.energy * 0.025;
        var pointRadius = radius * particle.radius * 0.75 * breathing;
        var ripple = Math.sin(pointAngle * 6 - elapsed * 0.00026 + particle.phase) * radius * 0.033 * particle.radius;
        var pointX = cx + Math.cos(pointAngle) * (pointRadius + ripple);
        var pointY = cy + Math.sin(pointAngle) * (pointRadius + ripple) * stretch;
        tissuePositions.push([pointX, pointY]);
        if (pointIndex % 13 === 0 && pointIndex > 13) {
          var previous = tissuePositions[pointIndex - 13];
          context.beginPath();
          context.moveTo(previous[0], previous[1]);
          context.lineTo(pointX, pointY);
          context.lineWidth = 0.4;
          context.strokeStyle = rgba(pointIndex % 26 ? primary : secondary, 0.045 + mutation.energy * 0.026);
          context.stroke();
        }
        var flicker = 0.38 + Math.sin(elapsed * 0.003 + particle.phase) * 0.24 + burst * 0.3;
        context.beginPath();
        context.fillStyle = rgba(pointIndex % 10 ? primary : [255, 255, 255], particle.alpha * flicker);
        context.arc(pointX, pointY, particle.size, 0, Math.PI * 2);
        context.fill();
      }

      var organelleCount = compact ? 4 : (mobile ? 6 : 10);
      for (var glowIndex = 0; glowIndex < organelleCount; glowIndex += 1) {
        var glowAngle = seeded(glowIndex, 141) * Math.PI * 2 + elapsed * (0.000014 + glowIndex * 0.000001);
        var glowDistance = radius * (0.12 + seeded(glowIndex, 142) * 0.38);
        var glowX = cx + Math.cos(glowAngle) * glowDistance;
        var glowY = cy + Math.sin(glowAngle) * glowDistance * stretch;
        var glowRadius = radius * (0.03 + seeded(glowIndex, 143) * 0.055) * (1 + mutation.energy * 0.22);
        var organelle = context.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRadius);
        organelle.addColorStop(0, rgba(glowIndex % 3 ? primary : secondary, 0.14 + burst * 0.1));
        organelle.addColorStop(0.28, rgba(glowIndex % 3 ? primary : secondary, 0.052 + mutation.energy * 0.025));
        organelle.addColorStop(1, rgba(primary, 0));
        context.fillStyle = organelle;
        context.fillRect(glowX - glowRadius, glowY - glowRadius, glowRadius * 2, glowRadius * 2);
      }

      context.globalCompositeOperation = 'source-over';
      var centerShade = context.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.66);
      centerShade.addColorStop(0, 'rgba(1,7,12,.12)');
      centerShade.addColorStop(0.52, 'rgba(1,7,12,.035)');
      centerShade.addColorStop(1, 'rgba(1,7,12,0)');
      context.fillStyle = centerShade;
      context.beginPath();
      context.arc(cx, cy, radius * 0.68, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    function targetForScene(scene, mobile) {
      if (compact) return { x: mobile ? 0.74 : 0.79, y: 0.51, scale: mobile ? 0.78 : 0.88 };
      if (scene === 'overview') return { x: mobile ? 0.58 : 0.67, y: mobile ? 0.22 : 0.28, scale: 0.72 };
      if (scene === 'matrix') return { x: mobile ? 0.64 : 0.73, y: mobile ? 0.2 : 0.33, scale: 0.62 };
      if (scene === 'organelles') return { x: mobile ? 0.58 : 0.66, y: mobile ? 0.2 : 0.27, scale: 0.68 };
      return { x: mobile ? 0.58 : 0.545, y: mobile ? 0.32 : 0.49, scale: mobile ? 0.75 : 0.82 };
    }

    function draw(time, force) {
      frame = 0;
      if (!force && (!visible || document.hidden)) return;
      if (!force && time - lastFrame < 31) { frame = requestAnimationFrame(draw); return; }
      lastFrame = time;
      var elapsed = settings.motion ? Math.max(0, time - timelineStart) : 3600;
      var phase = timelinePhase(elapsed);
      var scene = sceneAt(phase.clock, compact);
      var mutation = mutationState(elapsed, phase.burst);
      var mobile = width < 700;
      var target = targetForScene(scene, mobile);
      layout.x += (target.x - layout.x) * 0.075;
      layout.y += (target.y - layout.y) * 0.075;
      layout.scale += (target.scale - layout.scale) * 0.075;
      pointer.x += (pointer.tx - pointer.x) * 0.055;
      pointer.y += (pointer.ty - pointer.y) * 0.055;
      var cx = width * layout.x + pointer.x * (compact ? 9 : 22);
      var cy = height * layout.y + pointer.y * (compact ? 7 : 15);
      var radius = Math.min(width, height) * (compact ? (mobile ? 0.205 : 0.225) : (mobile ? 0.22 : 0.235)) * layout.scale;

      context.clearRect(0, 0, width, height);
      drawBackground(elapsed, cx, cy, radius, phase.primary, phase.secondary, phase.burst);
      var aura = context.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius * 2.4);
      aura.addColorStop(0, rgba(phase.primary, 0.09 * settings.bloom));
      aura.addColorStop(0.4, rgba(phase.secondary, 0.045 * settings.bloom));
      aura.addColorStop(1, rgba(phase.primary, 0));
      context.fillStyle = aura;
      context.fillRect(cx - radius * 2.5, cy - radius * 2.5, radius * 5, radius * 5);
      drawOrbit(elapsed, cx, cy, radius, phase.primary, phase.secondary, phase.burst);
      drawMembrane(elapsed, cx, cy, radius, phase.primary, phase.secondary, phase.burst, mutation);

      if (phase.index !== phaseIndex) phaseIndex = phase.index;
      syncPhase(hero, phase);
      if (scene !== sceneName) { sceneName = scene; syncScene(hero, scene); }
      if (settings.motion && visible && !document.hidden) frame = requestAnimationFrame(draw);
    }

    function start() {
      if (settings.motion && visible && !frame) frame = requestAnimationFrame(draw);
    }

    if (finePointer.matches && !reduceMotion.matches) {
      hero.addEventListener('pointermove', function(event) {
        var rect = hero.getBoundingClientRect();
        pointer.tx = (event.clientX - rect.left) / rect.width - 0.5;
        pointer.ty = (event.clientY - rect.top) / rect.height - 0.5;
      }, { passive: true });
      hero.addEventListener('pointerleave', function() { pointer.tx = 0; pointer.ty = 0; }, { passive: true });
    }

    var observer = new IntersectionObserver(function(entries) {
      visible = Boolean(entries[0] && entries[0].isIntersecting);
      if (visible) start();
      else if (frame) { cancelAnimationFrame(frame); frame = 0; }
    }, { threshold: 0.02 });
    observer.observe(canvas);
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', start);
    document.addEventListener('aura:settings', function() {
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      draw(performance.now(), true);
      start();
    });
    document.addEventListener('aura:panel', function() {
      sceneName = '';
      draw(performance.now(), true);
    });
    resize();
    start();
    engines.push({ resize: resize, redraw: function() { draw(performance.now(), true); } });
  }

  function createWebGLAuraField(canvas, hero) {
    var gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance'
    });
    if (!gl) return false;

    var fieldVertex = [
      '#version 300 es',
      'in vec2 aPosition;',
      'out vec2 vUv;',
      'void main(){',
      '  vUv = aPosition * .5 + .5;',
      '  gl_Position = vec4(aPosition, 0.0, 1.0);',
      '}'
    ].join('\n');
    var fieldFragment = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 outColor;',
      'uniform vec2 uResolution;',
      'uniform vec2 uCenter;',
      'uniform vec2 uPointer;',
      'uniform vec3 uPrimary;',
      'uniform vec3 uSecondary;',
      'uniform float uTime;',
      'uniform float uBeat;',
      'uniform float uEnergy;',
      'uniform float uTurbulence;',
      'uniform float uBloom;',
      'uniform float uScale;',
      'uniform float uScroll;',
      'uniform float uAspect;',
      'float hash31(vec3 p){',
      '  p = fract(p * .1031);',
      '  p += dot(p, p.yzx + 33.33);',
      '  return fract((p.x + p.y) * p.z);',
      '}',
      'float hash21(vec2 p){',
      '  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031,.1030,.0973));',
      '  p3 += dot(p3, p3.yzx + 33.33);',
      '  return fract((p3.x + p3.y) * p3.z);',
      '}',
      'float noise3(vec3 p){',
      '  vec3 i = floor(p);',
      '  vec3 f = fract(p);',
      '  f = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);',
      '}',
      'float fbm(vec3 p){',
      '  float n = 0.0;',
      '  float a = .55;',
      '  for(int i=0;i<4;i++){ n += noise3(p) * a; p = p * 2.03 + 9.17; a *= .48; }',
      '  return n;',
      '}',
      'mat2 rot(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }',
      'float organism(vec3 p){',
      '  p.xz = rot(uTime*.085 + uPointer.x*.22 + uScroll*.35) * p.xz;',
      '  p.yz = rot(-uTime*.063 + uPointer.y*.18 - uScroll*.18) * p.yz;',
      '  float len = max(length(p), .0001);',
      '  vec3 n = p / len;',
      '  float low = sin(n.x*5.0+n.y*3.0-uTime*.7)*.055 + sin(n.y*8.0+n.z*4.0+uTime*.43)*.038;',
      '  float ridge = (fbm(n*3.4 + uTime*.07)-.5) * .19 * uTurbulence;',
      '  float facets = (noise3(p*8.5-uTime*.045)-.5) * .075 * uTurbulence;',
      '  float systole = uBeat*.105 + sin(uTime*1.05)*.014;',
      '  float radius = .72 * (1.0+systole) + low*uTurbulence + ridge + facets;',
      '  p.y *= 1.045 - uBeat*.028;',
      '  return length(p) - radius;',
      '}',
      'vec3 normalAt(vec3 p){',
      '  vec2 e=vec2(.0018,0);',
      '  return normalize(vec3(organism(p+e.xyy)-organism(p-e.xyy),organism(p+e.yxy)-organism(p-e.yxy),organism(p+e.yyx)-organism(p-e.yyx)));',
      '}',
      'void main(){',
      '  vec2 screen = (vUv-uCenter)*2.0;',
      '  screen.x *= uAspect;',
      '  screen /= max(uScale,.08);',
      '  vec3 ro = vec3(0.0,0.0,2.62);',
      '  vec3 rd = normalize(vec3(screen,-2.22));',
      '  float travel=0.0;',
      '  float distanceField=0.0;',
      '  bool hit=false;',
      '  vec3 position=ro;',
      '  for(int i=0;i<44;i++){',
      '    position=ro+rd*travel;',
      '    distanceField=organism(position);',
      '    if(abs(distanceField)<.0018){ hit=true; break; }',
      '    travel += distanceField*.72;',
      '    if(travel>4.4) break;',
      '  }',
      '  vec3 color=vec3(0);',
      '  float alpha=0.0;',
      '  vec2 centered=(vUv-uCenter)*vec2(uAspect,1.0);',
      '  float radial=length(centered)/max(uScale*.48,.01);',
      '  vec2 starCell=floor(vUv*uResolution/3.5);',
      '  float starHash=hash21(starCell);',
      '  float star=step(.9885,starHash)*(.35+.65*sin(uTime*2.2+starHash*21.0));',
      '  float orbit=exp(-abs(radial-1.12)*44.0)*(.22+.78*noise3(vec3(normalize(centered+vec2(.0001))*7.0,uTime*.08)));',
      '  float halo=exp(-radial*2.6)*(.09+.16*uBloom);',
      '  color += mix(uSecondary,uPrimary,starHash)*star*(.22+.7*uBloom);',
      '  color += uPrimary*orbit*(.12+.22*uEnergy);',
      '  color += uSecondary*halo;',
      '  alpha=max(alpha,max(star*.55,max(orbit*.28,halo*.5)));',
      '  if(hit){',
      '    vec3 n=normalAt(position);',
      '    vec3 view=normalize(-rd);',
      '    vec3 light=normalize(vec3(-.55,.78,1.2));',
      '    vec3 halfVector=normalize(light+view);',
      '    float diffuse=max(dot(n,light),0.0);',
      '    float specular=pow(max(dot(n,halfVector),0.0),42.0);',
      '    float fresnel=pow(1.0-max(dot(n,view),0.0),2.45);',
      '    vec3 cell=floor(position*10.5+noise3(position*5.0)*1.7);',
      '    float cellLight=hash31(cell);',
      '    float tissue=fbm(position*4.2+vec3(0,0,uTime*.04));',
      '    float cavity=smoothstep(.18,.82,tissue);',
      '    vec3 base=mix(uSecondary,uPrimary,smoothstep(.14,.9,tissue));',
      '    base=mix(base,vec3(.005,.018,.024),smoothstep(.18,.76,1.0-cellLight)*.58);',
      '    vec3 facetNormal=normalize(floor(n*11.0+.5)/11.0);',
      '    float facetLight=max(dot(facetNormal,light),0.0);',
      '    float micro=step(.91,hash31(floor(position*37.0)));',
      '    color=base*(.17+diffuse*.58+facetLight*.34);',
      '    color+=mix(uPrimary,vec3(1),.6)*fresnel*(.42+uBloom*.38);',
      '    color+=vec3(1,.96,.9)*specular*(.38+uBloom*.82);',
      '    color+=uPrimary*micro*(.65+uEnergy*.7);',
      '    color*=.8+cavity*.32;',
      '    color=vec3(1)-exp(-color*(1.18+uBloom*.34));',
      '    alpha=.94;',
      '  }',
      '  float vignette=smoothstep(1.38,.24,length((vUv-.5)*vec2(1.0,.86)));',
      '  color*=.72+.28*vignette;',
      '  outColor=vec4(color,clamp(alpha,0.0,1.0));',
      '}'
    ].join('\n');

    var particleVertex = [
      '#version 300 es',
      'in vec2 aPosition;',
      'in float aLife;',
      'in float aSize;',
      'in float aMix;',
      'in float aEnergy;',
      'uniform float uPixelRatio;',
      'out float vLife;',
      'out float vMix;',
      'out float vEnergy;',
      'void main(){',
      '  gl_Position=vec4(aPosition,0.0,1.0);',
      '  gl_PointSize=max(1.0,aSize*uPixelRatio*(1.0+aEnergy*.72));',
      '  vLife=aLife;',
      '  vMix=aMix;',
      '  vEnergy=aEnergy;',
      '}'
    ].join('\n');
    var particleFragment = [
      '#version 300 es',
      'precision highp float;',
      'in float vLife;',
      'in float vMix;',
      'in float vEnergy;',
      'uniform vec3 uPrimary;',
      'uniform vec3 uSecondary;',
      'out vec4 outColor;',
      'void main(){',
      '  vec2 point=gl_PointCoord-.5;',
      '  float distance=length(point);',
      '  float core=smoothstep(.5,.03,distance);',
      '  float halo=smoothstep(.5,.12,distance);',
      '  vec3 color=mix(uPrimary,uSecondary,vMix);',
      '  color=mix(color,vec3(1),clamp(vEnergy*.22,0.0,.48));',
      '  float alpha=(core*.88+halo*.28)*vLife;',
      '  if(alpha<.008) discard;',
      '  outColor=vec4(color,alpha);',
      '}'
    ].join('\n');

    function compile(type, source) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        var message = gl.getShaderInfoLog(shader) || 'Unknown shader error';
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    }

    function makeProgram(vertexSource, fragmentSource) {
      var program = gl.createProgram();
      var vertex = compile(gl.VERTEX_SHADER, vertexSource);
      var fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        var message = gl.getProgramInfoLog(program) || 'Unknown program error';
        gl.deleteProgram(program);
        throw new Error(message);
      }
      return program;
    }

    var fieldProgram, particleProgram;
    try {
      fieldProgram = makeProgram(fieldVertex, fieldFragment);
      particleProgram = makeProgram(particleVertex, particleFragment);
    } catch (error) {
      console.warn('[AURA] WebGL engine unavailable, using 2D fallback.', error);
      return false;
    }

    var fieldLocations = {
      position: gl.getAttribLocation(fieldProgram, 'aPosition'),
      resolution: gl.getUniformLocation(fieldProgram, 'uResolution'),
      center: gl.getUniformLocation(fieldProgram, 'uCenter'),
      pointer: gl.getUniformLocation(fieldProgram, 'uPointer'),
      primary: gl.getUniformLocation(fieldProgram, 'uPrimary'),
      secondary: gl.getUniformLocation(fieldProgram, 'uSecondary'),
      time: gl.getUniformLocation(fieldProgram, 'uTime'),
      beat: gl.getUniformLocation(fieldProgram, 'uBeat'),
      energy: gl.getUniformLocation(fieldProgram, 'uEnergy'),
      turbulence: gl.getUniformLocation(fieldProgram, 'uTurbulence'),
      bloom: gl.getUniformLocation(fieldProgram, 'uBloom'),
      scale: gl.getUniformLocation(fieldProgram, 'uScale'),
      scroll: gl.getUniformLocation(fieldProgram, 'uScroll'),
      aspect: gl.getUniformLocation(fieldProgram, 'uAspect')
    };
    var particleLocations = {
      position: gl.getAttribLocation(particleProgram, 'aPosition'),
      life: gl.getAttribLocation(particleProgram, 'aLife'),
      size: gl.getAttribLocation(particleProgram, 'aSize'),
      mix: gl.getAttribLocation(particleProgram, 'aMix'),
      energy: gl.getAttribLocation(particleProgram, 'aEnergy'),
      pixelRatio: gl.getUniformLocation(particleProgram, 'uPixelRatio'),
      primary: gl.getUniformLocation(particleProgram, 'uPrimary'),
      secondary: gl.getUniformLocation(particleProgram, 'uSecondary')
    };

    var quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    var particleBuffer = gl.createBuffer();
    var compact = !hero.classList.contains('aura-hero--home') && !hero.classList.contains('aura-story-sticky');
    var storyField = hero.classList.contains('aura-story-sticky');
    var width = 1, height = 1, pixelRatio = 1, aspect = 1, frame = 0, visible = true, lastFrame = performance.now();
    var layout = { x: compact ? .79 : .59, y: compact ? .51 : .49, scale: compact ? .82 : 1 };
    var pointer = { x: 0, y: 0, tx: 0, ty: 0, clipX: 0, clipY: 0, vx: 0, vy: 0, active: 0, lastX: 0, lastY: 0, lastAt: performance.now(), lastTrail: 0 };
    var particles = [];
    var particleCursor = 0;
    var particleData = new Float32Array(1);
    var maxParticles = 1;
    var nextBeat = 0;
    var lastBeat = -10e3;
    var beatIndex = 0;
    var rhythmName = '';
    var phaseIndex = -1;
    var sceneName = '';

    function allocateParticles() {
      var mobile = width < 700;
      var nextMax = compact ? (mobile ? 360 : 820) : (mobile ? 1050 : storyField ? 2200 : 2800);
      if (saveData) nextMax = compact ? 260 : 680;
      if (nextMax === maxParticles) return;
      maxParticles = nextMax;
      particles = Array.from({ length: maxParticles }, function() {
        return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, mix: 0, energy: 0, drag: .985 };
      });
      particleData = new Float32Array(maxParticles * 6);
      particleCursor = 0;
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      aspect = width / height;
      var mobile = width < 700;
      var lowPower = saveData || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 6);
      var quality = lowPower ? .62 : mobile ? .78 : .92;
      pixelRatio = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.25) * quality;
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      gl.viewport(0, 0, canvas.width, canvas.height);
      allocateParticles();
      draw(performance.now(), true);
    }

    function storyPhase(progress) {
      var scaled = clamp(progress, 0, .9999) * (PHASES.length - .001);
      var index = Math.floor(scaled);
      var next = Math.min(PHASES.length - 1, index + 1);
      var amount = smoothStep(scaled - index);
      return {
        index: amount > .68 ? next : index,
        primary: rotateHue(mixColor(PHASES[index].primary, PHASES[next].primary, amount), settings.hue),
        secondary: rotateHue(mixColor(PHASES[index].secondary, PHASES[next].secondary, amount), settings.hue),
        burst: Math.sin(amount * Math.PI),
        clock: progress * 34000
      };
    }

    function rhythmAt(elapsed) {
      var clock = (elapsed * settings.velocity) % 30000;
      if (storyField) clock = clamp(Number(hero.dataset.storyProgress) || 0, 0, 1) * 30000;
      if (clock < 6000) return { id: 0, name: 'REGULAR / UNIFORM', count: 76, energy: .64, directional: 0, even: 1 };
      if (clock < 11200) return { id: 1, name: 'REGULAR / ASYMMETRIC', count: 118, energy: .88, directional: .78, even: 0 };
      if (clock < 16600) return { id: 2, name: 'SYNCHRONIZED HALO', count: 178, energy: 1, directional: 0, even: 1 };
      if (clock < 23200) return { id: 3, name: 'ARRHYTHMIC', count: 154, energy: 1.18, directional: .58, even: 0 };
      return { id: 4, name: 'RECOVERY', count: 92, energy: .72, directional: .24, even: beatIndex % 2 };
    }

    function intervalFor(mode) {
      var random = seeded(beatIndex + 401, mode.id + 71);
      if (mode.id === 0) return 960;
      if (mode.id === 1) return 650 + random * 620;
      if (mode.id === 2) return 1080;
      if (mode.id === 3) return random > .53 ? 340 + random * 380 : 1160 + random * 720;
      return beatIndex % 4 === 3 ? 1460 : 1100;
    }

    function nextParticle() {
      var particle = particles[particleCursor];
      particleCursor = (particleCursor + 1) % maxParticles;
      return particle;
    }

    function spawnBurst(mode, phase, centerX, centerY, radiusY) {
      var count = Math.max(18, Math.floor(mode.count * settings.density * (compact ? .56 : 1)));
      var lobe = seeded(beatIndex + 91, mode.id + 33) * Math.PI * 2;
      var radiusX = radiusY / aspect;
      for (var index = 0; index < count; index += 1) {
        var random = seeded(beatIndex * 379 + index, 121);
        var angle;
        if (mode.even) {
          angle = index / count * Math.PI * 2 + (random - .5) * .035;
        } else if (random < mode.directional) {
          var secondLobe = mode.id === 3 && index % 3 === 0 ? Math.PI * .76 : 0;
          angle = lobe + secondLobe + (seeded(index + beatIndex, 122) - .5) * (mode.id === 3 ? 1.3 : .88);
        } else {
          angle = random * Math.PI * 2;
        }
        var speedRandom = seeded(beatIndex * 233 + index, 123);
        var speed = (.2 + speedRandom * .34) * mode.energy * (mode.even ? .9 + speedRandom * .18 : .58 + speedRandom * .92);
        var particle = nextParticle();
        var surface = .67 + seeded(index + beatIndex, 124) * .19;
        particle.x = centerX + Math.cos(angle) * radiusX * surface;
        particle.y = centerY + Math.sin(angle) * radiusY * surface;
        particle.vx = Math.cos(angle) * speed / aspect + Math.cos(angle + Math.PI * .5) * (random - .5) * .08 * settings.turbulence;
        particle.vy = Math.sin(angle) * speed + Math.sin(angle + Math.PI * .5) * (random - .5) * .08 * settings.turbulence;
        particle.maxLife = .75 + seeded(index, beatIndex + 130) * (mode.id === 3 ? 2.1 : 1.45);
        particle.life = particle.maxLife;
        particle.size = .7 + Math.pow(seeded(index, beatIndex + 131), 2) * (mode.energy * 4.4);
        particle.mix = index % 7 ? seeded(index, 132) * .26 : .72 + seeded(index, 133) * .28;
        particle.energy = mode.energy * (.55 + seeded(index, 134) * .72);
        particle.drag = mode.id === 2 ? .988 : .974 + seeded(index, 135) * .018;
      }
      document.dispatchEvent(new CustomEvent('aura:beat', { detail: { energy: mode.energy, phase: phase.index, rhythm: mode.name } }));
    }

    function spawnCursorTrail() {
      if (!pointer.active || pointer.lastTrail > 0) return;
      var speed = Math.hypot(pointer.vx * aspect, pointer.vy);
      if (speed < .22) return;
      pointer.lastTrail = .032;
      for (var index = 0; index < 6; index += 1) {
        var particle = nextParticle();
        var angle = seeded(index + beatIndex, 171) * Math.PI * 2;
        particle.x = pointer.clipX;
        particle.y = pointer.clipY;
        particle.vx = -pointer.vx * (.12 + seeded(index, 172) * .22) + Math.cos(angle) * .035 / aspect;
        particle.vy = -pointer.vy * (.12 + seeded(index, 173) * .22) + Math.sin(angle) * .035;
        particle.maxLife = .35 + seeded(index, 174) * .5;
        particle.life = particle.maxLife;
        particle.size = .65 + seeded(index, 175) * 2.2;
        particle.mix = .2 + seeded(index, 176) * .75;
        particle.energy = .45 + speed * .5;
        particle.drag = .94;
      }
    }

    function updateParticles(delta, centerX, centerY) {
      var activeCount = 0;
      var pointerRange = .22;
      pointer.lastTrail = Math.max(0, pointer.lastTrail - delta);
      spawnCursorTrail();
      for (var index = 0; index < particles.length; index += 1) {
        var particle = particles[index];
        if (particle.life <= 0) continue;
        particle.life -= delta;
        if (particle.life <= 0) continue;
        var dx = particle.x - centerX;
        var dy = particle.y - centerY;
        var radius = Math.max(.001, Math.hypot(dx * aspect, dy));
        var swirl = (.004 + settings.turbulence * .008) * delta;
        particle.vx += (-dy / radius) * swirl / aspect;
        particle.vy += (dx * aspect / radius) * swirl;
        if (pointer.active) {
          var pointerDx = (particle.x - pointer.clipX) * aspect;
          var pointerDy = particle.y - pointer.clipY;
          var pointerDistance = Math.hypot(pointerDx, pointerDy);
          if (pointerDistance < pointerRange && pointerDistance > .001) {
            var force = (1 - pointerDistance / pointerRange) * .38 * delta;
            particle.vx += pointerDx / pointerDistance * force / aspect + pointer.vx * .012;
            particle.vy += pointerDy / pointerDistance * force + pointer.vy * .012;
          }
        }
        var drag = Math.pow(particle.drag, delta * 60);
        particle.vx *= drag;
        particle.vy *= drag;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        var life = clamp(particle.life / particle.maxLife, 0, 1);
        var fade = Math.pow(Math.sin(life * Math.PI), .7);
        var offset = activeCount * 6;
        particleData[offset] = particle.x;
        particleData[offset + 1] = particle.y;
        particleData[offset + 2] = fade;
        particleData[offset + 3] = particle.size;
        particleData[offset + 4] = particle.mix;
        particleData[offset + 5] = particle.energy;
        activeCount += 1;
      }
      return activeCount;
    }

    function targetForScene(scene, mobile) {
      if (storyField) {
        var progress = clamp(Number(hero.dataset.storyProgress) || 0, 0, 1);
        return { x: mobile ? .55 : .64 + Math.sin(progress * Math.PI * 3) * .045, y: mobile ? .28 : .49 - Math.sin(progress * Math.PI) * .06, scale: mobile ? .72 : .92 };
      }
      if (compact) return { x: mobile ? .76 : .8, y: .5, scale: mobile ? .72 : .78 };
      if (scene === 'overview') return { x: mobile ? .57 : .68, y: mobile ? .2 : .28, scale: .72 };
      if (scene === 'matrix') return { x: mobile ? .63 : .74, y: mobile ? .19 : .32, scale: .62 };
      if (scene === 'organelles') return { x: mobile ? .58 : .67, y: mobile ? .19 : .26, scale: .68 };
      return { x: mobile ? .58 : .545, y: mobile ? .31 : .49, scale: mobile ? .78 : .82 };
    }

    function setColorUniform(location, color) {
      gl.uniform3f(location, color[0] / 255, color[1] / 255, color[2] / 255);
    }

    function renderField(elapsed, phase, beat, energy, scroll) {
      gl.useProgram(fieldProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.enableVertexAttribArray(fieldLocations.position);
      gl.vertexAttribPointer(fieldLocations.position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(fieldLocations.resolution, canvas.width, canvas.height);
      gl.uniform2f(fieldLocations.center, layout.x, 1 - layout.y);
      gl.uniform2f(fieldLocations.pointer, pointer.x, pointer.y);
      setColorUniform(fieldLocations.primary, phase.primary);
      setColorUniform(fieldLocations.secondary, phase.secondary);
      gl.uniform1f(fieldLocations.time, elapsed / 1000);
      gl.uniform1f(fieldLocations.beat, beat);
      gl.uniform1f(fieldLocations.energy, energy);
      gl.uniform1f(fieldLocations.turbulence, settings.turbulence);
      gl.uniform1f(fieldLocations.bloom, settings.bloom);
      gl.uniform1f(fieldLocations.scale, (compact ? .82 : 1.04) * layout.scale);
      gl.uniform1f(fieldLocations.scroll, scroll);
      gl.uniform1f(fieldLocations.aspect, aspect);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function renderParticles(activeCount, phase) {
      if (!activeCount) return;
      gl.useProgram(particleProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, particleData.subarray(0, activeCount * 6), gl.DYNAMIC_DRAW);
      var stride = 6 * 4;
      [particleLocations.position, particleLocations.life, particleLocations.size, particleLocations.mix, particleLocations.energy].forEach(function(location) { gl.enableVertexAttribArray(location); });
      gl.vertexAttribPointer(particleLocations.position, 2, gl.FLOAT, false, stride, 0);
      gl.vertexAttribPointer(particleLocations.life, 1, gl.FLOAT, false, stride, 2 * 4);
      gl.vertexAttribPointer(particleLocations.size, 1, gl.FLOAT, false, stride, 3 * 4);
      gl.vertexAttribPointer(particleLocations.mix, 1, gl.FLOAT, false, stride, 4 * 4);
      gl.vertexAttribPointer(particleLocations.energy, 1, gl.FLOAT, false, stride, 5 * 4);
      gl.uniform1f(particleLocations.pixelRatio, Math.max(.8, pixelRatio));
      setColorUniform(particleLocations.primary, phase.primary);
      setColorUniform(particleLocations.secondary, phase.secondary);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, activeCount);
    }

    function draw(time, force) {
      frame = 0;
      if (!force && (!visible || document.hidden)) return;
      var delta = clamp((time - lastFrame) / 1000, 0, .035);
      lastFrame = time;
      var elapsed = settings.motion ? Math.max(0, time - timelineStart) : 3600;
      var storyProgress = storyField ? clamp(Number(hero.dataset.storyProgress) || 0, 0, 1) : 0;
      var phase = storyField ? storyPhase(storyProgress) : timelinePhase(elapsed);
      var scene = storyField ? 'hero' : sceneAt(phase.clock, compact);
      var mobile = width < 700;
      var target = targetForScene(scene, mobile);
      layout.x += (target.x - layout.x) * (force ? 1 : .075);
      layout.y += (target.y - layout.y) * (force ? 1 : .075);
      layout.scale += (target.scale - layout.scale) * (force ? 1 : .075);
      pointer.x += (pointer.tx - pointer.x) * .075;
      pointer.y += (pointer.ty - pointer.y) * .075;
      pointer.active *= Math.pow(.88, delta * 60);

      var mode = rhythmAt(elapsed);
      if (settings.motion && elapsed >= nextBeat) {
        lastBeat = elapsed;
        nextBeat = elapsed + intervalFor(mode);
        beatIndex += 1;
        var centerX = layout.x * 2 - 1;
        var centerY = (1 - layout.y) * 2 - 1;
        var radiusY = (compact ? .38 : .48) * layout.scale;
        spawnBurst(mode, phase, centerX, centerY, radiusY);
      }
      if (mode.name !== rhythmName) {
        rhythmName = mode.name;
        hero.dataset.rhythm = mode.id;
        var readout = document.querySelector('.aura-rhythm-readout');
        if (readout) readout.textContent = mode.name;
      }
      var beatTime = (elapsed - lastBeat) / 1000;
      var firstPulse = Math.exp(-Math.pow((beatTime - .045) / .036, 2)) * .72;
      var secondPulse = Math.exp(-Math.pow((beatTime - .185) / .064, 2));
      var beat = clamp(firstPulse + secondPulse, 0, 1.25);
      var energy = clamp(mode.energy * (.24 + beat * .76) + phase.burst * .5, 0, 1.4);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      renderField(elapsed, phase, beat, energy, storyProgress);
      var activeCount = updateParticles(delta, layout.x * 2 - 1, (1 - layout.y) * 2 - 1);
      renderParticles(activeCount, phase);

      syncPhase(hero, phase);
      if (phase.index !== phaseIndex) {
        phaseIndex = phase.index;
        document.dispatchEvent(new CustomEvent('aura:phasechange', { detail: { index: phase.index } }));
      }
      if (scene !== sceneName) { sceneName = scene; syncScene(hero, scene); }
      if (settings.motion && visible && !document.hidden) frame = requestAnimationFrame(draw);
    }

    function start() {
      if (settings.motion && visible && !frame) {
        lastFrame = performance.now();
        frame = requestAnimationFrame(draw);
      }
    }

    hero.addEventListener('pointermove', function(event) {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      var rect = hero.getBoundingClientRect();
      var now = performance.now();
      var nextX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      var nextY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      var deltaTime = Math.max(8, now - pointer.lastAt) / 1000;
      pointer.vx = ((nextX - pointer.lastX) * 2) / deltaTime;
      pointer.vy = (-(nextY - pointer.lastY) * 2) / deltaTime;
      pointer.lastX = nextX;
      pointer.lastY = nextY;
      pointer.lastAt = now;
      pointer.tx = (nextX - .5) * 2;
      pointer.ty = (.5 - nextY) * 2;
      pointer.clipX = nextX * 2 - 1;
      pointer.clipY = 1 - nextY * 2;
      pointer.active = 1;
    }, { passive: true });
    hero.addEventListener('pointerleave', function() {
      pointer.tx = 0;
      pointer.ty = 0;
      pointer.vx = 0;
      pointer.vy = 0;
      pointer.active = 0;
    }, { passive: true });

    var observer = new IntersectionObserver(function(entries) {
      visible = Boolean(entries[0] && entries[0].isIntersecting);
      if (visible) start();
      else if (frame) { cancelAnimationFrame(frame); frame = 0; }
    }, { threshold: .015 });
    observer.observe(canvas);
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', start);
    document.addEventListener('aura:settings', function() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      nextBeat = 0;
      draw(performance.now(), true);
      start();
    });
    document.addEventListener('aura:panel', function() { sceneName = ''; });
    canvas.addEventListener('webglcontextlost', function(event) {
      event.preventDefault();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      hero.classList.add('aura-webgl-lost');
    });
    canvas.addEventListener('webglcontextrestored', function() { window.location.reload(); });
    hero.classList.add('aura-webgl-ready');
    hero.dataset.renderer = 'webgl2';
    resize();
    start();
    engines.push({ resize: resize, redraw: function() { draw(performance.now(), true); } });
    return true;
  }

  function mountFields() {
    Array.prototype.forEach.call(document.querySelectorAll('.aura-hero, .aura-story-sticky'), function(hero) {
      var canvas = hero.querySelector('.aura-field-canvas');
      if (!canvas) return;
      var webglPreview = new URLSearchParams(window.location.search).get('aura-renderer') === 'webgl';
      if (webglPreview && createWebGLAuraField(canvas, hero)) return;
      if (webglPreview) {
        /* A canvas that has attempted to create a WebGL context cannot reliably
           acquire a 2D context afterwards. Replace it before entering fallback. */
        var fallback = canvas.cloneNode(false);
        canvas.replaceWith(fallback);
        canvas = fallback;
      }
      hero.dataset.renderer = 'canvas2d-hdr';
      createAuraField(canvas, hero);
    });
  }

  function mountReveal() {
    var nodes = document.querySelectorAll('.aura-feed-header, .aura-record, .aura-collection-switch, #board .list-group, #board .tagcloud, .aura-about-manifest, article.post-content > *');
    Array.prototype.forEach.call(nodes, function(node) { node.classList.add('aura-reveal'); });
    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(nodes, function(node) { node.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    Array.prototype.forEach.call(nodes, function(node) { observer.observe(node); });
  }

  function decorateFooter() {
    var footer = document.querySelector('footer .footer-inner');
    if (!footer || footer.querySelector('.aura-footer-meta')) return;
    var meta = element('div', 'aura-footer-meta');
    meta.innerHTML = '<span>AURA / HPKP LIVING ARCHIVE</span><span><i></i>END OF TRANSMISSION</span>';
    footer.insertBefore(meta, footer.firstChild);
  }

  function init() {
    var route = setPageState();
    var records = readRecords();
    enhanceNavbar();
    buildLabPanel(records);
    bindGlobalControls();
    mountHero(route, records);
    if (route === 'home') {
      mountHomeFeed(records);
      mountScrollStory(records);
    }
    decorateCollections(route);
    if (route === 'post') decoratePost();
    if (route === 'about') decorateAbout();
    mountReadingProgress();
    decorateFooter();
    mountAdaptiveSound();
    mountIntelligentCursor();
    mountFields();
    mountReveal();
    syncControlUi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
