(function() {
  'use strict';

  /*
   * Organism v5：博客当前启用的视觉增强层。
   *
   * Fluid 主题先生成语义化 HTML，本脚本再在浏览器中补上首屏、导航编号、卡片层级、
   * 阅读工具和 Canvas“活体”动画。它只负责视觉与交互，不接触浏览/点赞/评论数据库。
   * 所有 mount/decorate 函数都先检查目标是否存在或是否已经处理，因此脚本重复执行也
   * 不应生成重复节点。若 Fluid 升级后页面结构变化，优先检查这里使用的 DOM 选择器。
   */

  // 统一读取系统能力与用户偏好，后面的动效和性能策略都以这三个开关为基础。
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)');
  var saveData = Boolean(navigator.connection && navigator.connection.saveData);

  // 创建元素的小工具：只写纯文本，不把传入内容解析成 HTML。
  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  // 把节点中的换行和多余空白压成一个空格，便于复用 Fluid 原有标题和摘要。
  function normalizedText(node) {
    return node ? (node.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  // 用正则判断当前 URL 路径；这里只读 pathname，不包含域名、查询参数和锚点。
  function pathIs(pattern) {
    return pattern.test(window.location.pathname);
  }

  // 根据真实 DOM 和 URL 判定页面类型。文章优先看 DOM，避免中文标题路径误判。
  function pageRoute() {
    if (document.querySelector('article.post-content')) return 'post';
    if (pathIs(/^\/(?:index\.html)?$/) || pathIs(/^\/page\/[1-9]\d*\/?$/)) return 'home';
    if (pathIs(/^\/archives(?:\/|$)/)) return 'archive';
    if (pathIs(/^\/categories\/?$/)) return 'categories';
    if (pathIs(/^\/categories\//)) return 'category';
    if (pathIs(/^\/tags\/?$/)) return 'tags';
    if (pathIs(/^\/tags\//)) return 'tag';
    if (pathIs(/^\/about\/?$/)) return 'about';
    return 'page';
  }

  // 统一维护移动目录的视觉、按钮文字和无障碍状态，避免不同关闭入口各改一半。
  function setMobileTocOpen(open) {
    var button = document.querySelector('.og-toc-toggle');
    var nextOpen = Boolean(open && button);
    document.body.classList.toggle('og-toc-open', nextOpen);
    if (!button) return;
    button.setAttribute('aria-expanded', String(nextOpen));
    var mark = button.querySelector('b');
    if (mark) mark.textContent = nextOpen ? '×' : '+';
  }

  // 把页面类型同时写到 html 的 data 属性和 body 类名，供 CSS 精确选择当前页面。
  function setPageState() {
    var route = pageRoute();
    document.documentElement.dataset.organismRoute = route;
    document.body.classList.add('og-page', 'og-page-' + route);
    return route;
  }

  // 从页面中收集去重后的链接文字与地址，用于统计和首页“读取路径”卡片。
  function uniqueLinkData(selector) {
    var seen = Object.create(null);
    var output = [];
    Array.prototype.forEach.call(document.querySelectorAll(selector), function(link) {
      var label = normalizedText(link).replace(/^#/, '');
      var href = link.getAttribute('href');
      if (!label || !href || seen[href]) return;
      seen[href] = true;
      output.push({ label: label, href: href });
    });
    return output;
  }

  // 增加键盘无障碍“跳至主要内容”链接；鼠标用户平时不会看到它。
  function mountSkipLink() {
    if (document.querySelector('.og-skip-link')) return;
    var target = document.getElementById('board') || document.querySelector('main');
    if (!target) return;
    if (!target.id) target.id = 'main-content';
    var link = element('a', 'og-skip-link', '跳至主要内容');
    link.href = '#' + target.id;
    document.body.insertBefore(link, document.body.firstChild);
  }

  // 在不改 Fluid 模板文件的前提下，给导航补上品牌结构、序号、当前项和系统状态。
  function enhanceNavbar(route) {
    var navbar = document.getElementById('navbar');
    if (!navbar || navbar.dataset.organismReady) return;
    navbar.dataset.organismReady = 'true';

    var brand = navbar.querySelector('.navbar-brand');
    if (brand) {
      brand.setAttribute('aria-label', 'HPKP 活体信号档案 · 返回首页');
      brand.innerHTML =
        '<span class="og-brand-mark"><i aria-hidden="true"></i><b>HPKP</b></span>' +
        '<span class="og-brand-copy"><strong>SIGNAL ARCHIVE</strong><small>PERSONAL SYSTEM</small></span>';
    }

    var routeMap = {
      home: '/',
      archive: '/archives/',
      categories: '/categories/',
      category: '/categories/',
      tags: '/tags/',
      tag: '/tags/',
      about: '/about/'
    };
    var currentRoot = routeMap[route] || '';
    var navLinks = Array.prototype.slice.call(navbar.querySelectorAll('.navbar-nav > .nav-item > .nav-link'))
      .filter(function(link) { return !link.closest('#search-btn, #color-toggle-btn'); });

    navLinks.forEach(function(link, index) {
      var code = String(index + 1).padStart(2, '0');
      link.dataset.seq = code;
      var href = link.getAttribute('href');
      if (href === currentRoot) {
        link.classList.add('is-current');
        link.setAttribute('aria-current', 'page');
      }
    });

    var list = navbar.querySelector('.navbar-nav');
    var searchItem = document.getElementById('search-btn');
    if (list && searchItem && !list.querySelector('.og-nav-status')) {
      var status = element('li', 'og-nav-status');
      status.innerHTML = '<i aria-hidden="true"></i><span>SYSTEM LIVE</span>';
      list.insertBefore(status, searchItem);
    }

    var search = document.querySelector('#search-btn .nav-link');
    var theme = document.querySelector('#color-toggle-btn .nav-link');
    if (search) search.setAttribute('data-label', 'SEARCH');
    if (theme) theme.setAttribute('data-label', 'SCHEME');
  }

  // 内页首屏上方的英文档案标签；未知页面使用通用标签兜底。
  function heroLabel(route) {
    var labels = {
      post: 'RECORD / SINGLE ENTRY',
      archive: 'TIMELINE / COMPLETE LOG',
      categories: 'SYSTEMS / ROUTE MAP',
      category: 'SYSTEM / FILTERED LOG',
      tags: 'DNA INDEX / SIGNAL MARKERS',
      tag: 'MARKER / FILTERED LOG',
      about: 'SPECIMEN / IDENTITY FILE',
      page: 'FILE / STATIC ENTRY'
    };
    return labels[route] || 'HPKP / PERSONAL SIGNAL SYSTEM';
  }

  // 读取首页现有卡片、分类、标签和更新时间，生成首屏底部的实时摘要。
  function buildHeroStats() {
    var cards = document.querySelectorAll('#board .index-card');
    var categories = uniqueLinkData('#board a[href*="/categories/"]');
    var tags = uniqueLinkData('#board a[href*="/tags/"]');
    var latestTime = document.querySelector('#board .index-card time');
    var latest = latestTime ? (latestTime.getAttribute('datetime') || normalizedText(latestTime)).slice(0, 10) : '—';
    var stats = element('div', 'og-hero-stats');
    stats.setAttribute('aria-label', '当前页数据');
    [
      [String(cards.length).padStart(2, '0'), 'RECORDS'],
      [String(categories.length).padStart(2, '0'), 'ROUTES'],
      [String(tags.length).padStart(2, '0'), 'MARKERS'],
      [latest, 'LAST UPDATE']
    ].forEach(function(pair) {
      var item = element('div', 'og-hero-stat');
      item.appendChild(element('strong', '', pair[0]));
      item.appendChild(element('span', '', pair[1]));
      stats.appendChild(item);
    });
    return stats;
  }

  /*
   * 四个色彩阶段各自拥有一组叙事文案。标题场景总在本阶段内部完整进出，
   * 不会跨到下一次换色；卡片仍指向真实文章，只同步阶段标签与说明。
   */
  var sentienceScenes = [
    {
      kicker: 'PHASE 01 / MEMORY BLOOM',
      heading: ['记忆开始萌发。', '微小信号汇成形状。'],
      cards: [['SEED RECORD', '正在萌发的记录'], ['ORIGIN TRACE', '最早留下的信号']]
    },
    {
      kicker: 'PHASE 02 / SYNAPTIC RESONANCE',
      heading: ['记录并非静止。', '它们会重新连接。'],
      cards: [['LATEST IMPULSE', '当前仍在生长的记录'], ['RESONANT MEMORY', '被时间重新激活的回声']]
    },
    {
      kicker: 'PHASE 03 / AFTERGLOW STATE',
      heading: ['信号已经远去。', '余辉仍在缓慢发声。'],
      cards: [['AFTERIMAGE', '尚未熄灭的余辉'], ['RETURNING ECHO', '再次抵达的旧信号']]
    },
    {
      kicker: 'PHASE 04 / GILDED ECHO',
      heading: ['时间覆上一层金。', '旧回声因此被看见。'],
      cards: [['GILDED ENTRY', '被时间保存的记录'], ['PRESERVED ECHO', '仍然清晰的回声']]
    }
  ];

  // 创建首屏中循环出现的阶段叙事场景，并复用前两篇文章作为入口。
  function buildSentiencePanel() {
    var initialScene = sentienceScenes[0];
    var panel = element('section', 'og-sentience-panel');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
    panel.dataset.narrativePhase = '-1';
    panel.innerHTML =
      '<div class="og-sentience-heading">' +
        '<p class="og-kicker">' + initialScene.kicker + '</p>' +
        '<h2>' + initialScene.heading.join('<br>') + '</h2>' +
      '</div>' +
      '<div class="og-sentience-trace" aria-hidden="true"><i></i><i></i><i></i></div>';

    var records = Array.prototype.slice.call(document.querySelectorAll('#board .index-card')).slice(0, 2);
    var cards = element('div', 'og-sentience-cards');
    records.forEach(function(record, index) {
      var source = record.querySelector('.index-header a');
      if (!source) return;
      var card = element('a', 'og-sentience-card');
      var initialCard = initialScene.cards[index] || initialScene.cards[0];
      card.href = source.getAttribute('href') || '/archives/';
      card.innerHTML =
        '<span>0' + (index + 1) + ' / ' + initialCard[0] + '</span>' +
        '<strong>' + normalizedText(source) + '</strong>' +
        '<small>' + initialCard[1] + '</small>' +
        '<b aria-hidden="true">↗</b>';
      cards.appendChild(card);
    });
    if (!cards.children.length) {
      cards.innerHTML =
        '<a class="og-sentience-card" href="/archives/"><span>01 / TIMELINE</span><strong>完整归档</strong><small>沿时间读取全部记录</small><b aria-hidden="true">↗</b></a>' +
        '<a class="og-sentience-card" href="/about/"><span>02 / IDENTITY</span><strong>个体档案</strong><small>读取这个节点的持续变化</small><b aria-hidden="true">↗</b></a>';
    }
    panel.appendChild(cards);
    return panel;
  }

  // 重组 Fluid 原首屏：首页使用完整电影式构图，内页使用安静的紧凑首屏。
  function mountHero(route) {
    var banner = document.getElementById('banner');
    var mask = banner && banner.querySelector('.mask');
    if (!mask || mask.querySelector('.og-hero')) return;

    var original = mask.querySelector('.banner-text');
    var hero = element('section', 'og-hero og-hero--' + route);
    var grid = element('div', 'og-hero-grid');
    grid.setAttribute('aria-hidden', 'true');
    hero.appendChild(grid);

    var topHud = element('div', 'og-hero-hud og-hero-hud--top');
    topHud.innerHTML =
      '<span>HPKP / SENTIENT ARCHIVE</span>' +
      '<span class="og-phase-state"><i aria-hidden="true"></i><b>PHASE 01</b> MEMORY BLOOM</span>' +
      '<span>FIELD 08 / PUBLIC SIGNAL</span>';
    hero.appendChild(topHud);

    if (route === 'home') {
      var copy = element('div', 'og-hero-copy');
      copy.appendChild(element('p', 'og-kicker', 'AN ORGANISM MADE OF MEMORY'));

      var title = element('h1', 'og-display-title');
      title.setAttribute('aria-label', 'Living Archive · 活体信号档案');
      title.innerHTML = '<span data-word="LIVING">LIVING</span><span data-word="ARCHIVE">ARCHIVE<i class="og-title-face" aria-hidden="true">ARCHIVE</i></span>';
      copy.appendChild(title);

      var subtitle = normalizedText(original && original.querySelector('#subtitle')) || '日常有迹，回声可循';
      copy.appendChild(element('p', 'og-hero-intro', subtitle + '。日常、技术和没有消失的回声，在这里继续生长。'));

      var thesis = element('div', 'og-hero-thesis');
      thesis.innerHTML = '<span>MEMORY</span><i></i><span>MACHINE</span><i></i><span>WEATHER</span><i></i><span>ECHO</span>';
      copy.appendChild(thesis);

      var actions = element('div', 'og-hero-actions');
      actions.innerHTML =
        '<a class="og-button og-button--primary" href="#signal-feed"><span>进入活体档案</span><b aria-hidden="true">↘</b></a>' +
        '<a class="og-button og-button--quiet" href="/archives/"><span>查看全部记录</span><b aria-hidden="true">↗</b></a>';
      copy.appendChild(actions);

      var mode = element('div', 'og-mode-line');
      mode.innerHTML = '<i aria-hidden="true"></i><span class="og-phase-index">PHASE 01</span><strong class="og-phase-name">MEMORY BLOOM</strong><span>SCROLL TO OBSERVE</span>';
      copy.appendChild(mode);
      hero.appendChild(copy);

      var stage = element('div', 'og-organism-stage');
      stage.setAttribute('aria-hidden', 'true');
      stage.innerHTML =
        '<canvas class="og-organism-canvas"></canvas>' +
        '<span class="og-organism-axis og-organism-axis--x"></span>' +
        '<span class="og-organism-axis og-organism-axis--y"></span>' +
        '<span class="og-core-label"><b>SYNTHETIC LIFEFORM</b><small>ARCHIVE CORE / 08</small></span>';
      hero.appendChild(stage);

      var sideHud = element('div', 'og-hero-hud og-hero-hud--side');
      sideHud.innerHTML =
        '<span class="og-phase-node is-current" data-phase="0"><b>01</b> MEMORY</span>' +
        '<span class="og-phase-node" data-phase="1"><b>02</b> SYNAPSE</span>' +
        '<span class="og-phase-node" data-phase="2"><b>03</b> AFTERGLOW</span>' +
        '<span class="og-phase-node" data-phase="3"><b>04</b> GILDED</span>';
      hero.appendChild(sideHud);
      hero.appendChild(buildSentiencePanel());
      hero.appendChild(buildHeroStats());
    } else {
      var compact = element('div', 'og-compact-hero');
      compact.appendChild(element('p', 'og-kicker', heroLabel(route)));
      if (original) {
        compact.appendChild(original);
        var compactTitle = original.querySelector('.h2');
        if (normalizedText(compactTitle).length > 16) hero.classList.add('og-title-long');
      }
      compact.appendChild(element('p', 'og-compact-index', ('0' + Math.max(1, Object.keys(document.documentElement.dataset).length)).slice(-2) + ' / HPKP'));
      hero.appendChild(compact);

      var compactStage = element('div', 'og-organism-stage og-organism-stage--compact');
      compactStage.setAttribute('aria-hidden', 'true');
      compactStage.innerHTML =
        '<canvas class="og-organism-canvas"></canvas>' +
        '<span class="og-core-label"><b>ARCHIVE ORGANISM</b><small>FIELD CONTINUITY / ON</small></span>';
      hero.appendChild(compactStage);
    }

    // 首页已经用新标题替代原节点；内页则把原节点移动进 compact 容器以保留真实标题和元信息。
    if (original && route === 'home') original.remove();
    mask.appendChild(hero);

    var canvas = hero.querySelector('.og-organism-canvas');
    if (canvas) mountOrganismField(canvas, hero);
  }

  // 首页摘要不应泄露“加密图片”表单文案，因此只清掉这些界面词，不修改文章正文。
  function cleanExcerpt(card) {
    var excerpt = card.querySelector('.index-excerpt > div');
    if (!excerpt) return;
    var cleaned = normalizedText(excerpt)
      .replace(/🔒\s*此图片已加密/g, '')
      .replace(/解锁图片/g, '')
      .replace(/密码错误或图片已损坏。?/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    excerpt.textContent = cleaned;
  }

  // 给一张首页文章卡补上档案序号、状态和跳转箭头；第一张标记为主记录。
  function decorateCard(card, index) {
    var sequence = String(index + 1).padStart(2, '0');
    card.dataset.record = sequence;
    card.classList.toggle('og-card-lead', index === 0);
    cleanExcerpt(card);

    var article = card.querySelector('.index-info');
    if (!article || article.querySelector('.og-card-topline')) return;
    var topline = element('div', 'og-card-topline');
    topline.innerHTML =
      '<span>REC-' + sequence + '</span>' +
      '<span><i aria-hidden="true"></i>' + (index === 0 ? 'LATEST SIGNAL' : 'ARCHIVED SIGNAL') + '</span>';
    article.insertBefore(topline, article.firstChild);

    var titleLink = card.querySelector('.index-header a');
    if (titleLink) {
      var arrow = element('span', 'og-card-arrow', '↗');
      arrow.setAttribute('aria-hidden', 'true');
      titleLink.appendChild(arrow);
    }
  }

  // 创建首页下方四个主要阅读入口。分类/标签数量来自当前页已经渲染出的链接。
  function buildRouteMap(categories, tags) {
    var section = element('section', 'og-route-map');
    section.setAttribute('aria-labelledby', 'route-map-title');
    section.innerHTML =
      '<div class="og-section-head og-section-head--route">' +
        '<div><p class="og-kicker">ARCHIVE ANATOMY</p><h2 id="route-map-title">沿不同路径读取</h2></div>' +
        '<p>同一组记录，可以按时间、系统或标记重新组织。</p>' +
      '</div>';

    var grid = element('div', 'og-route-grid');
    [
      ['01', '完整归档', '按时间查看所有记录', '/archives/', 'TIMELINE'],
      ['02', '内容系统', categories.length + ' 条现有分类路径', '/categories/', 'CATEGORIES'],
      ['03', '信号标记', tags.length + ' 个内容标签', '/tags/', 'TAG DNA'],
      ['04', '个体档案', '更新方式、主题与联系入口', '/about/', 'PROFILE']
    ].forEach(function(data) {
      var link = element('a', 'og-route-card');
      link.href = data[3];
      link.innerHTML =
        '<span class="og-route-card__seq">' + data[0] + '</span>' +
        '<span class="og-route-card__code">' + data[4] + '</span>' +
        '<strong>' + data[1] + '</strong>' +
        '<p>' + data[2] + '</p>' +
        '<b aria-hidden="true">↗</b>';
      grid.appendChild(link);
    });
    section.appendChild(grid);
    return section;
  }

  // 把 Fluid 平铺的首页卡片重新装入“活跃记录”区，并在其后加入阅读路径地图。
  function mountHomeFeed() {
    if (!document.body.classList.contains('og-page-home')) return;
    var cards = Array.prototype.slice.call(document.querySelectorAll('#board .index-card'));
    if (!cards.length || document.getElementById('signal-feed')) return;

    var parent = cards[0].parentNode;
    var section = element('section', 'og-signal-feed');
    section.id = 'signal-feed';

    var head = element('div', 'og-section-head');
    head.innerHTML =
      '<div><p class="og-kicker">ACTIVE RECORDS / ' + String(cards.length).padStart(2, '0') + '</p><h2>正在生长的记录</h2></div>' +
      '<p>最新一条保持更大的呼吸空间，其余内容按信号序列继续展开。</p>';
    section.appendChild(head);

    var feed = element('div', 'og-feed-grid');
    cards.forEach(function(card, index) {
      decorateCard(card, index);
      feed.appendChild(card);
    });
    section.appendChild(feed);
    parent.insertBefore(section, parent.firstChild);

    var categories = uniqueLinkData('#signal-feed a[href*="/categories/"]');
    var tags = uniqueLinkData('#signal-feed a[href*="/tags/"]');
    parent.insertBefore(buildRouteMap(categories, tags), section.nextSibling);
  }

  // 归档、分类、标签页共用的三段式切换器；当前项可读但不重复刷新页面。
  function routeSwitcher(route) {
    var nav = element('nav', 'og-route-switcher');
    nav.setAttribute('aria-label', '档案索引');
    [
      ['archive', '时间轴', '/archives/'],
      ['categories', '内容系统', '/categories/'],
      ['tags', '信号标记', '/tags/']
    ].forEach(function(item, index) {
      var link = element('a', '', item[1]);
      link.href = item[2];
      link.dataset.seq = String(index + 1).padStart(2, '0');
      if (route === item[0] || (route === 'category' && item[0] === 'categories') || (route === 'tag' && item[0] === 'tags')) {
        link.classList.add('is-current');
        link.setAttribute('aria-current', 'page');
        link.addEventListener('click', function(event) {
          event.preventDefault();
        });
      }
      nav.appendChild(link);
    });
    return nav;
  }

  // 为所有集合页添加统一容器、序号和箭头，让内页沿用首页的视觉语言。
  function decorateCollections(route) {
    if (['archive', 'categories', 'category', 'tags', 'tag'].indexOf(route) === -1) return;
    var board = document.getElementById('board');
    if (!board || board.querySelector('.og-route-switcher')) return;
    board.classList.add('og-collection');
    board.insertBefore(routeSwitcher(route), board.firstChild);

    var listItems = board.querySelectorAll('.list-group > .list-group-item');
    Array.prototype.forEach.call(listItems, function(item, index) {
      item.dataset.log = String(index + 1).padStart(2, '0');
      if (!item.querySelector('.og-log-arrow')) {
        var arrow = element('span', 'og-log-arrow', '↗');
        arrow.setAttribute('aria-hidden', 'true');
        item.appendChild(arrow);
      }
    });

    Array.prototype.forEach.call(board.querySelectorAll('.category-list .category.row'), function(item, index) {
      item.dataset.system = String(index + 1).padStart(2, '0');
    });
    Array.prototype.forEach.call(board.querySelectorAll('.tagcloud a'), function(item, index) {
      item.dataset.marker = String(index + 1).padStart(2, '0');
    });
  }

  // 把文章正文装饰成档案页：增加文件头、章节编号，并启用桌面/移动目录。
  function mountPostDossier() {
    var article = document.querySelector('article.post-content');
    if (!article || article.querySelector('.og-document-head')) return;
    article.classList.add('og-document');

    var markdown = article.querySelector('.markdown-body');
    if (markdown) {
      var docHead = element('header', 'og-document-head');
      var rawSlug = window.location.pathname.split('/').filter(Boolean).pop() || 'entry';
      var slug = rawSlug;
      try {
        slug = decodeURIComponent(rawSlug);
      } catch (error) {
        // 保留浏览器给出的原始路径片段；错误编码不应中断整套页面增强。
      }
      var entryLabel = element('span', '', 'ENTRY / ' + slug.slice(0, 26));
      var recordLabel = element('span');
      var recordDot = element('i');
      recordDot.setAttribute('aria-hidden', 'true');
      recordLabel.appendChild(recordDot);
      recordLabel.appendChild(document.createTextNode(' LIVING RECORD'));
      docHead.appendChild(entryLabel);
      docHead.appendChild(recordLabel);
      docHead.appendChild(element('span', '', 'HPKP / ARCHIVE 08'));
      article.insertBefore(docHead, markdown);

      Array.prototype.forEach.call(markdown.querySelectorAll('h2, h3'), function(heading, index) {
        heading.dataset.section = String(index + 1).padStart(2, '0');
      });
    }

    var toc = document.getElementById('toc');
    if (toc) {
      toc.classList.add('og-toc');
      var header = toc.querySelector('.toc-header');
      if (header) header.innerHTML = '<span>CONTENT MAP</span><small>当前记录</small>';
      if (toc.querySelector('a')) {
        mountMobileToc(toc);
      } else {
        toc.hidden = true;
      }
    }
  }

  // 小屏时把目录移到 body 作为抽屉，大屏时再放回 Fluid 原来的位置。
  function mountMobileToc(toc) {
    if (document.querySelector('.og-toc-toggle')) return;
    var originalParent = toc.parentNode;
    var originalNext = toc.nextSibling;
    var mobileTocMedia = window.matchMedia('(max-width: 991.98px)');

    // 媒体查询变化时移动同一个 toc 节点，而不是复制，避免重复 id 和失效链接。
    function placeToc() {
      if (mobileTocMedia.matches) {
        if (toc.parentNode !== document.body) document.body.appendChild(toc);
      } else if (toc.parentNode !== originalParent) {
        setMobileTocOpen(false);
        if (originalNext && originalNext.parentNode === originalParent) {
          originalParent.insertBefore(toc, originalNext);
        } else {
          originalParent.appendChild(toc);
        }
      }
    }

    placeToc();
    if (mobileTocMedia.addEventListener) mobileTocMedia.addEventListener('change', placeToc);

    var button = element('button', 'og-toc-toggle');
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'toc');
    button.innerHTML = '<span>目录</span><b aria-hidden="true">+</b>';
    document.body.appendChild(button);

    button.addEventListener('click', function() {
      setMobileTocOpen(!document.body.classList.contains('og-toc-open'));
    });
    toc.addEventListener('click', function(event) {
      if (!event.target.closest('a')) return;
      setMobileTocOpen(false);
    });
  }

  // 关于页只调整头像与文字的层级关系，不改用户写在 Markdown 中的内容。
  function mountAboutDossier() {
    if (!document.body.classList.contains('og-page-about')) return;
    var board = document.getElementById('board');
    var info = board && board.querySelector('.about-info');
    if (!board || !info || board.querySelector('.og-profile-header')) return;
    board.classList.add('og-profile');

    var header = element('section', 'og-profile-header');
    header.innerHTML =
      '<div><p class="og-kicker">IDENTITY RECORD / HPKP</p><h2><span>一个低频更新的</span><span>个人档案</span></h2></div>' +
      '<div class="og-profile-status"><span><i></i> OPEN CHANNEL</span><span>TOPICS / LIFE · TECH · NOTES</span></div>';

    var boardContainer = info.closest('.container');
    while (boardContainer && boardContainer.parentElement !== board) boardContainer = boardContainer.parentElement;
    board.insertBefore(header, boardContainer || board.firstChild);

    var avatar = board.querySelector(':scope > .about-avatar');
    var identity = element('div', 'og-about-identity');
    while (info.firstChild) identity.appendChild(info.firstChild);
    if (avatar) info.appendChild(avatar);
    info.appendChild(identity);
  }

  // 文章页顶部阅读进度条；滚动事件只排队一次，实际计算放到下一帧以减少抖动。
  function mountReadingProgress() {
    if (!document.body.classList.contains('og-page-post') || document.querySelector('.og-reading-progress')) return;
    var bar = element('div', 'og-reading-progress');
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<i></i><span>READ PROGRESS</span>';
    document.body.appendChild(bar);
    var queued = false;

    // 把当前滚动距离换算为 0%～100%，通过 CSS 变量驱动进度条宽度。
    function update() {
      queued = false;
      var root = document.documentElement;
      var available = Math.max(root.scrollHeight - window.innerHeight, 1);
      var ratio = Math.max(0, Math.min(1, window.scrollY / available));
      bar.style.setProperty('--og-progress', (ratio * 100).toFixed(2) + '%');
    }
    // 高频 scroll/resize 期间最多保留一个 requestAnimationFrame 回调。
    function schedule() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    update();
  }

  // 桌面鼠标跟随高光：只写两个 CSS 变量，不直接在 JS 中重绘卡片。
  function mountCardSpotlight() {
    if (!finePointer.matches || reduceMotion.matches) return;
    Array.prototype.forEach.call(document.querySelectorAll('.index-card, .og-route-card'), function(card) {
      var queued = false;
      var lastEvent = null;
      card.addEventListener('pointermove', function(event) {
        lastEvent = event;
        if (queued) return;
        queued = true;
        window.requestAnimationFrame(function() {
          queued = false;
          var rect = card.getBoundingClientRect();
          card.style.setProperty('--og-x', ((lastEvent.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
          card.style.setProperty('--og-y', ((lastEvent.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
        });
      }, { passive: true });
    });
  }

  // 内容进入视口时只播放一次克制的揭示；不再在滚动往返时反复回弹。
  function mountReveal() {
    var cardSelector = [
      'body.og-page-home .og-feed-grid .index-card',
      'body.og-page-home .og-route-card',
      '#board .list-group > .list-group-item',
      '#board .tagcloud a',
      '#board .category-list .category.row',
      '#board .category-post-list .list-group-item',
      '.about-info',
      '.about-content',
      '.about-manifest__facts li',
      '.post-pulse',
      '.pulse-comment'
    ].join(', ');
    var targets = Array.prototype.slice.call(document.querySelectorAll(
      cardSelector + ', .og-section-head, .og-collection > *, .og-document'
    ));
    if (!targets.length || reduceMotion.matches || !('IntersectionObserver' in window)) return;

    targets.forEach(function(target, index) {
      target.classList.add('og-reveal');
      target.style.setProperty('--og-delay', Math.min(index, 7) * 55 + 'ms');
    });
    // 普通内容只揭示一次，结束后移除辅助类，避免长期占用合成层。
    function reveal(target) {
      if (target.__ogRevealDone) return;
      target.__ogRevealDone = true;
      target.classList.add('is-visible');
      window.setTimeout(function() {
        target.classList.remove('og-reveal', 'is-visible');
        target.style.removeProperty('--og-delay');
      }, 1450);
    }
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -7% 0px', threshold: 0.04 });
    targets.forEach(function(target) { observer.observe(target); });
    window.requestAnimationFrame(function() {
      targets.forEach(function(target) {
        if (target.getBoundingClientRect().top < window.innerHeight) {
          reveal(target);
          observer.unobserve(target);
        }
      });
    });
  }

  // Q 弹只属于折叠菜单体系：保留右上角按钮与菜单项，其余控件使用普通按压反馈。
  function mountSpringFeedback() {
    if (reduceMotion.matches) return;
    var menuButton = document.getElementById('navbar-toggler-btn');
    if (menuButton) {
      menuButton.addEventListener('click', function() {
        // 等 Bootstrap 更新 aria-expanded 后再启用动画，初次绘制不会误播“关闭”。
        window.setTimeout(function() { menuButton.classList.add('og-menu-interacted'); }, 0);
      }, true);
    }
    var selector = [
      '#mobile-grid-menu .mobile-grid-item'
    ].join(', ');

    Array.prototype.forEach.call(document.querySelectorAll(selector), function(target) {
      target.addEventListener('click', function() {
        if (target.matches(':disabled, [aria-disabled="true"]')) return;

        if (typeof target.animate === 'function') {
          if (target.__ogTapAnimation) target.__ogTapAnimation.cancel();
          target.__ogTapAnimation = target.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(.93)', offset: .3 },
            { transform: 'scale(1.045)', offset: .62 },
            { transform: 'scale(.985)', offset: .82 },
            { transform: 'scale(1)' }
          ], {
            duration: 480,
            easing: 'cubic-bezier(.2, 1.35, .32, 1)'
          });
          return;
        }

        target.classList.remove('og-tap-pop');
        // 没有 Web Animations 的浏览器同步重启动画；后台标签页也不会因 rAF 节流而漏掉反馈。
        void target.offsetWidth;
        if (!target.isConnected) return;
        target.classList.add('og-tap-pop');
        window.clearTimeout(target.__ogSpringTimer);
        target.__ogSpringTimer = window.setTimeout(function() {
          target.classList.remove('og-tap-pop');
        }, 620);
      }, true);
    });
  }

  // 同步浏览器主题色、明暗切换过渡和键盘快捷键，不拦截 Fluid 自己的开关逻辑。
  function bindChrome() {
    var meta = document.querySelector('meta[name="theme-color"]');
    // 主题变化时只短暂加入过渡类，380ms 后清理，避免页面长期保持高开销效果。
    function refresh() {
      var dark = document.documentElement.getAttribute('data-user-color-scheme') !== 'light';
      if (meta) meta.setAttribute('content', dark ? '#02070d' : '#eef7f8');
      document.documentElement.classList.add('og-theme-settling');
      window.setTimeout(function() { document.documentElement.classList.remove('og-theme-settling'); }, 380);
    }
    new MutationObserver(function(mutations) {
      if (mutations.some(function(item) { return item.attributeName === 'data-user-color-scheme'; })) refresh();
    }).observe(document.documentElement, { attributes: true });
    refresh();

    document.addEventListener('keydown', function(event) {
      var tag = (event.target && event.target.tagName || '').toLowerCase();
      if (event.key === '/' && !/input|textarea|select/.test(tag)) {
        var search = document.querySelector('#search-btn .nav-link');
        if (search) {
          event.preventDefault();
          search.click();
        }
      }
      if (event.key === 'Escape') setMobileTocOpen(false);
    });
  }

  // 给页脚补充站点节点信息；原有版权文字仍由 Fluid 负责输出。
  function decorateFooter() {
    var footer = document.querySelector('footer .footer-inner');
    if (!footer || footer.querySelector('.og-footer-meta')) return;
    var meta = element('div', 'og-footer-meta');
    meta.innerHTML = '<span>ARCHIVE NODE / HPKP.ORG</span><span><i></i> END OF TRANSMISSION</span>';
    footer.insertBefore(meta, footer.firstChild);
  }

  // 启动首屏 Canvas：绘制粒子、膜层和色相阶段，并按设备与负载动态限帧。
  function mountOrganismField(canvas, hero) {
    // desynchronized 是浏览器提示：允许更低延迟呈现；不支持时会被安全忽略。
    var context = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!context) return;

    // 除首页外都使用粒子更少、尺寸更小的紧凑版本，正文阅读区不会承担完整首屏开销。
    var compact = hero.classList.contains('og-hero--post') ||
      !hero.classList.contains('og-hero--home');

    // 画布尺寸与设备分类。dpr 会受“像素预算”限制，不会盲目跟随高分屏倍率。
    var width = 0;
    var height = 0;
    var dpr = 1;
    var sourceDpr = 0;
    var handheld = false;
    var tablet = false;
    var shortLandscape = false;
    var renderProfile = 'desktop';

    // 页面是否可见、是否允许动画，以及三组粒子当前的数据。
    var visible = true;
    var running = !reduceMotion.matches && !saveData;
    var ambientParticles = [];
    var shellParticles = [];
    var tissueParticles = [];
    var tissuePositionX = new Float32Array(0);
    var tissuePositionY = new Float32Array(0);
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    // 自适应帧率调度：可见的生命体保持稳定帧率；只有测到真实过载才降速。
    // 不能因为用户停止触摸就把 24/30fps 硬降为 10/2fps，否则会形成明显的“越静越卡”。
    var lastFrame = 0;
    var lastAnimationTick = 0;
    var frameId = 0;
    var activeTargetFps = 30;
    var overloadTargetFps = 22;
    var activeFrameInterval = 1000 / activeTargetFps;
    var frameInterval = activeFrameInterval;
    var overloadUntil = 0;
    var overloadScore = 0;
    var averageRenderCost = 0;
    var adaptiveMode = running ? 'active' : 'static';
    var windowFocused = document.hasFocus();
    var pageActive = true;
    var renderedFrames = 0;
    var phaseStyleAt = 0;
    var resizeFrame = 0;
    var resizeTimer = 0;
    var heroRect = null;
    var lastPhase = -1;
    var lastPhaseCss = '';
    var lastScene = '';
    var startedAt = 0;
    var sceneFrameState = { amount: 0, state: 'hero' };
    var sceneLeadTime = 1850;
    var sceneTransitionDuration = 1300;
    var sceneHoldDuration = 3200;
    var sceneTailTime = 750;
    var sceneAnalysisAt = sceneLeadTime + sceneTransitionDuration;
    var sceneLeaveAt = sceneAnalysisAt + sceneHoldDuration;
    var sceneHeroAt = sceneLeaveAt + sceneTransitionDuration;
    var phaseDuration = sceneHeroAt + sceneTailTime;
    var narrativePhaseSerial = -1;
    var narrativePhaseEnabled = true;
    var narrativeSkippedLast = false;
    var narrativeEntryStreak = 0;
    var narrativeDecisionReason = 'opening';
    var narrativeRandomState = ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0) || 0x6d2b79f5;
    if (window.crypto && window.crypto.getRandomValues) {
      var narrativeSeed = new Uint32Array(1);
      window.crypto.getRandomValues(narrativeSeed);
      narrativeRandomState = narrativeSeed[0] || narrativeRandomState;
    }
    var phaseNames = ['MEMORY BLOOM', 'SYNAPTIC RESONANCE', 'AFTERGLOW STATE', 'GILDED ECHO'];
    var palettes = [
      [[104, 238, 249], [35, 132, 255]],
      [[255, 105, 223], [144, 66, 220]],
      [[88, 239, 169], [31, 190, 205]],
      [[214, 167, 80], [177, 103, 43]]
    ];
    var performanceState = {
      mode: adaptiveMode,
      targetFps: running ? 30 : 0,
      frames: 0,
      averageRenderMs: 0,
      lastFrameAt: 0,
      overloadUntil: 0,
      overloadScore: 0,
      renderProfile: renderProfile,
      particleCount: 0,
      backingPixels: 0,
      visible: visible,
      focused: windowFocused,
      hidden: document.hidden,
      suspended: !running,
      reason: running ? '' : 'static'
    };

    // 暴露只读入口便于在 DevTools 检查实际帧率/粒子数，不参与页面业务逻辑。
    Object.defineProperty(canvas, '__organismPerformance', {
      configurable: true,
      value: performanceState
    });

    // 可复现的伪随机数：同一粒子每次刷新位置一致，画面稳定且无需保存随机种子。
    function seeded(index, salt) {
      var value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
      return value - Math.floor(value);
    }

    // 数值和 RGB 颜色的线性插值，用于不同生命阶段之间平滑过渡。
    function mix(a, b, amount) {
      return Math.round(a + (b - a) * amount);
    }
    function mixColor(a, b, amount) {
      return [mix(a[0], b[0], amount), mix(a[1], b[1], amount), mix(a[2], b[2], amount)];
    }

    // 轻微增强颜色饱和度、对比度和亮度，弥补半透明叠加后的灰暗感。
    function gradeColor(color) {
      var luminance = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
      return color.map(function(channel) {
        var saturated = luminance + (channel - luminance) * 1.22;
        var contrasted = (saturated - 127.5) * 1.08 + 127.5;
        return Math.max(0, Math.min(255, Math.round(contrasted * 1.06)));
      });
    }
    palettes = palettes.map(function(palette) {
      return [gradeColor(palette[0]), gradeColor(palette[1])];
    });
    function rgba(color, alpha) {
      return 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + alpha + ')';
    }

    // 计算当前阶段颜色；每段末尾 10% 才发生溶解式换色，避免持续“彩虹渐变”。
    function phaseColor(time) {
      var progress = (time / phaseDuration) % palettes.length;
      var index = Math.floor(progress);
      var next = (index + 1) % palettes.length;
      var amount = progress - index;
      var dissolved = amount < 0.9 ? 0 : (amount - 0.9) / 0.1;
      dissolved = dissolved * dissolved * (3 - 2 * dissolved);
      return {
        index: index,
        primary: mixColor(palettes[index][0], palettes[next][0], dissolved),
        secondary: mixColor(palettes[index][1], palettes[next][1], dissolved),
        dissolve: dissolved
      };
    }

    // 背景漂浮粒子的固定属性：位置、速度、大小、透明度及少量大光斑。
    function ambientParticle(index) {
      return {
        x: seeded(index, 1),
        y: seeded(index, 2),
        speed: 0.0000015 + seeded(index, 3) * 0.0000035,
        size: 0.25 + seeded(index, 4) * 1.15,
        alpha: 0.08 + seeded(index, 5) * 0.35,
        phase: seeded(index, 6) * Math.PI * 2,
        bloom: seeded(index, 7) > 0.965,
        bloomSize: 28 + seeded(index, 8) * 74
      };
    }

    // 外壳粒子的固定属性：围绕主体运动，少量反向旋转以形成有机湍流。
    function shellParticle(index) {
      return {
        angle: seeded(index, 11) * Math.PI * 2,
        radius: 0.84 + Math.pow(seeded(index, 12), 2.35) * 0.98,
        speed: (0.000018 + seeded(index, 13) * 0.000105) * (seeded(index, 14) > 0.22 ? 1 : -1),
        size: 0.28 + Math.pow(seeded(index, 15), 2) * 2.45,
        alpha: 0.18 + seeded(index, 16) * 0.78,
        drift: 2 + seeded(index, 17) * 24,
        stretch: 0.88 + seeded(index, 18) * 0.16,
        phase: seeded(index, 19) * Math.PI * 2
      };
    }

    // 内部组织粒子的固定属性：使用平方根分布，使粒子不会全部挤在圆心。
    function tissueParticle(index) {
      return {
        angle: seeded(index, 21) * Math.PI * 2,
        radius: Math.sqrt(seeded(index, 22)) * 0.78,
        speed: (0.000008 + seeded(index, 23) * 0.00003) * (seeded(index, 24) > 0.5 ? 1 : -1),
        size: 0.26 + seeded(index, 25) * 1.65,
        alpha: 0.24 + seeded(index, 26) * 0.7,
        phase: seeded(index, 27) * Math.PI * 2
      };
    }

    // 阶段变化发生在叙事场景完全收起之后，此时替换文字不会造成可见跳变。
    function updateSentienceNarrative(index) {
      var panel = hero.querySelector('.og-sentience-panel');
      var narrative = sentienceScenes[index] || sentienceScenes[0];
      if (!panel || panel.dataset.narrativePhase === String(index)) return;
      panel.dataset.narrativePhase = String(index);

      var kicker = panel.querySelector('.og-sentience-heading .og-kicker');
      var heading = panel.querySelector('.og-sentience-heading h2');
      if (kicker) kicker.textContent = narrative.kicker;
      if (heading) {
        heading.textContent = '';
        narrative.heading.forEach(function(line, lineIndex) {
          if (lineIndex) heading.appendChild(document.createElement('br'));
          heading.appendChild(document.createTextNode(line));
        });
      }

      Array.prototype.forEach.call(panel.querySelectorAll('.og-sentience-card'), function(card, cardIndex) {
        var cardCopy = narrative.cards[cardIndex] || narrative.cards[0];
        var label = card.querySelector('span');
        var description = card.querySelector('small');
        if (label) label.textContent = String(cardIndex + 1).padStart(2, '0') + ' / ' + cardCopy[0];
        if (description) description.textContent = cardCopy[1];
      });
    }

    // 仅在颜色确实变化或到达节流间隔时更新 CSS，并同步阶段文字和侧边指示。
    function updatePhase(colors, time) {
      var phaseCss = colors.primary.join(' ');
      var phaseChanged = colors.index !== lastPhase;
      if (phaseCss !== lastPhaseCss && (phaseChanged || time - phaseStyleAt >= 96)) {
        lastPhaseCss = phaseCss;
        phaseStyleAt = time;
        hero.style.setProperty('--og-phase-rgb', phaseCss);
        document.documentElement.style.setProperty('--og-live-phase-rgb', phaseCss);
      }
      if (!phaseChanged) return;
      lastPhase = colors.index;
      hero.dataset.phase = String(colors.index);
      var number = String(colors.index + 1).padStart(2, '0');
      var state = hero.querySelector('.og-phase-state');
      var indexLabel = hero.querySelector('.og-phase-index');
      var nameLabel = hero.querySelector('.og-phase-name');
      if (state) state.innerHTML = '<i aria-hidden="true"></i><b>PHASE ' + number + '</b> ' + phaseNames[colors.index];
      if (indexLabel) indexLabel.textContent = 'PHASE ' + number;
      if (nameLabel) nameLabel.textContent = phaseNames[colors.index];
      Array.prototype.forEach.call(hero.querySelectorAll('.og-phase-node'), function(node) {
        node.classList.toggle('is-current', Number(node.dataset.phase) === colors.index);
      });
      updateSentienceNarrative(colors.index);
    }

    // 平滑阶跃曲线：输入限制到 0～1，两端速度自然减到零。
    function smoothStep(value) {
      var amount = Math.max(0, Math.min(1, value));
      return amount * amount * (3 - 2 * amount);
    }

    // 五次平滑阶跃比普通 ease 在首尾拥有更柔和的加速度，用于整幕形态转换。
    function smootherStep(value) {
      var amount = Math.max(0, Math.min(1, value));
      return amount * amount * amount * (amount * (amount * 6 - 15) + 10);
    }

    // 每轮只取一次随机数。xorshift 状态留在当前页面中，避免每帧调用 Math.random。
    function nextNarrativeRandom() {
      narrativeRandomState ^= narrativeRandomState << 13;
      narrativeRandomState ^= narrativeRandomState >>> 17;
      narrativeRandomState ^= narrativeRandomState << 5;
      return (narrativeRandomState >>> 0) / 4294967296;
    }

    /*
     * 带记忆的半随机节奏：
     * - 首轮固定进入，保证首次打开仍有完整叙事冲击力；
     * - 常规轮次以 62% 权重进入；
     * - 一旦跳过，下一轮必定进入，绝不会连续两轮缺席；
     * - 连续进入三轮后安排一次留白，避免又变成“每轮固定播放”。
     * 结果只在阶段边界写入 dataset，便于调试且不会增加逐帧 DOM 负担。
     */
    function scheduleNarrativePhase(time) {
      var serial = Math.floor(time / phaseDuration);
      if (serial === narrativePhaseSerial) return narrativePhaseEnabled;

      for (var nextSerial = narrativePhaseSerial + 1; nextSerial <= serial; nextSerial += 1) {
        if (nextSerial === 0) {
          narrativePhaseEnabled = true;
          narrativeDecisionReason = 'opening';
        } else if (narrativeSkippedLast) {
          narrativePhaseEnabled = true;
          narrativeDecisionReason = 'guaranteed-after-skip';
        } else if (narrativeEntryStreak >= 3) {
          narrativePhaseEnabled = false;
          narrativeDecisionReason = 'cadence-break';
        } else {
          narrativePhaseEnabled = nextNarrativeRandom() < 0.62;
          narrativeDecisionReason = narrativePhaseEnabled ? 'weighted-enter' : 'weighted-skip';
        }

        if (narrativePhaseEnabled) {
          narrativeSkippedLast = false;
          narrativeEntryStreak += 1;
        } else {
          narrativeSkippedLast = true;
          narrativeEntryStreak = 0;
        }
      }

      narrativePhaseSerial = serial;
      hero.dataset.narrativeSerial = String(serial);
      hero.dataset.narrativeScheduled = narrativePhaseEnabled ? 'enter' : 'skip';
      hero.dataset.narrativeReason = narrativeDecisionReason;
      return narrativePhaseEnabled;
    }

    /*
     * 被调度到叙事的 8.4 秒色彩阶段完整经历：主视觉 -> 1.3 秒进场 -> 3.2 秒叙事 -> 1.3 秒退场 -> 主视觉。
     * 留白阶段全程维持主视觉，但色彩、粒子和阶段文案仍按原顺序自然演进。
     * 退场在本阶段溶解换色前结束，因此下一阶段不会带着上一段面板硬切颜色。
     * 复用同一个状态对象，避免 Canvas 循环每帧产生临时对象。
     */
    function sceneFrame(time) {
      if (compact || shortLandscape) {
        sceneFrameState.amount = 0;
        sceneFrameState.state = 'hero';
        return sceneFrameState;
      }
      if (!scheduleNarrativePhase(time)) {
        sceneFrameState.amount = 0;
        sceneFrameState.state = 'hero';
        return sceneFrameState;
      }
      var localTime = time % phaseDuration;
      if (localTime < sceneLeadTime || localTime >= sceneHeroAt) {
        sceneFrameState.amount = 0;
        sceneFrameState.state = 'hero';
      } else if (localTime < sceneAnalysisAt) {
        sceneFrameState.amount = smootherStep((localTime - sceneLeadTime) / sceneTransitionDuration);
        sceneFrameState.state = 'entering';
      } else if (localTime < sceneLeaveAt) {
        sceneFrameState.amount = 1;
        sceneFrameState.state = 'analysis';
      } else {
        sceneFrameState.amount = 1 - smootherStep((localTime - sceneLeaveAt) / sceneTransitionDuration);
        sceneFrameState.state = 'leaving';
      }
      return sceneFrameState;
    }

    // 只在场景状态跨过阈值时操作 DOM，避免每一帧重复改属性。
    function updateScene(frame) {
      if (compact) return;
      var scene = frame.state;
      if (scene === lastScene) return;
      lastScene = scene;
      hero.dataset.scene = scene;
      var panel = hero.querySelector('.og-sentience-panel');
      if (panel) {
        var hidden = scene !== 'analysis';
        panel.setAttribute('aria-hidden', String(hidden));
        panel.inert = hidden;
      }
    }

    // 重新测量画布、选择设备档位、限制像素数并按档位重建粒子数组。
    function resize() {
      var rect = canvas.getBoundingClientRect();
      var nextWidth = Math.max(1, Math.round(rect.width));
      var nextHeight = Math.max(1, Math.round(rect.height));
      var nextSourceDpr = window.devicePixelRatio || 1;
      heroRect = hero.getBoundingClientRect();
      /*
       * 手机浏览器地址栏伸缩会连续触发 resize。尺寸几乎没变时直接返回，
       * 否则每次都重建全部粒子数组，正是滚动卡顿的常见来源。
       */
      if (width && Math.abs(nextWidth - width) < 2 && Math.abs(nextHeight - height) < 2 && Math.abs(nextSourceDpr - sourceDpr) < 0.05) return;
      width = nextWidth;
      height = nextHeight;
      sourceDpr = nextSourceDpr;
      /*
       * 设备分类看浏览器视口，不看紧凑首屏自身高度。比如横屏平板的文章画布可能
       * 只有 448px 高，若拿画布尺寸判断，会误当桌面并分配过多粒子。
       */
      var viewportWidth = Math.max(1, window.innerWidth || width);
      var viewportHeight = Math.max(1, window.innerHeight || height);
      shortLandscape = viewportWidth > viewportHeight && viewportHeight <= 520 && viewportWidth <= 1024;
      handheld = viewportWidth < 700 || shortLandscape;
      var viewportAspect = Math.max(viewportWidth, viewportHeight) / Math.max(1, Math.min(viewportWidth, viewportHeight));
      tablet = !handheld && (
        (viewportWidth <= 1199 && Math.min(viewportWidth, viewportHeight) >= 600) ||
        (viewportWidth <= 1366 && Math.min(viewportWidth, viewportHeight) >= 600 && (coarsePointer.matches || viewportAspect <= 1.62))
      );
      renderProfile = handheld ? 'handheld' : tablet ? 'tablet' : 'desktop';

      /*
       * Safari 的 Canvas 2D 与页面排版共享主线程。窄屏 24fps 已足够保持膜层连续。
       * 静置不再降低帧率；省电只通过离屏/后台暂停和真实过载保护完成。
       */
      activeTargetFps = handheld ? 24 : tablet ? 27 : 30;
      overloadTargetFps = handheld ? 18 : tablet ? 20 : 22;
      activeFrameInterval = 1000 / activeTargetFps;
      if (adaptiveMode === 'active') frameInterval = activeFrameInterval;
      else if (adaptiveMode === 'overload') frameInterval = 1000 / overloadTargetFps;

      // renderCap 限倍率，pixelBudget 限总像素；两道上限共同保护高分屏 GPU。
      var renderCap = compact
        ? (handheld ? 1.18 : tablet ? 1.15 : 1.17)
        : (handheld ? (shortLandscape ? 1.18 : 1.28) : tablet ? 1.18 : 1.18);
      var pixelBudget = compact
        ? (handheld ? 560000 : tablet ? 1050000 : 1850000)
        : (handheld ? 800000 : tablet ? 1550000 : 2350000);
      var budgetDpr = Math.sqrt(pixelBudget / Math.max(width * height, 1));
      // 大视口允许低于 1x 的渲染倍率，否则“最低 1x”会直接绕过总像素预算。
      dpr = Math.min(sourceDpr, renderCap, budgetDpr);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.dataset.renderScale = dpr.toFixed(2);
      canvas.dataset.renderProfile = renderProfile;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 三类粒子分别按桌面、平板、手机和省流模式分配，保证构图不变但减少无效密度。
      var ambientCount = compact ? 170 : 520;
      var shellCount = compact ? 340 : 920;
      var tissueCount = compact ? 190 : 460;
      if (tablet) {
        ambientCount = compact ? 110 : 360;
        shellCount = compact ? 210 : 700;
        tissueCount = compact ? 120 : 360;
      }
      if (handheld) {
        ambientCount = compact ? 60 : (shortLandscape ? 138 : 160);
        shellCount = compact ? 114 : (shortLandscape ? 270 : 320);
        tissueCount = compact ? 66 : (shortLandscape ? 148 : 170);
      }
      if (saveData) {
        ambientCount = 38;
        shellCount = 92;
        tissueCount = 54;
      }
      ambientParticles = Array.from({ length: ambientCount }, function(_, index) { return ambientParticle(index); });
      shellParticles = Array.from({ length: shellCount }, function(_, index) { return shellParticle(index); });
      tissueParticles = Array.from({ length: tissueCount }, function(_, index) { return tissueParticle(index); });
      tissuePositionX = new Float32Array(tissueCount);
      tissuePositionY = new Float32Array(tissueCount);
      var particleCount = ambientCount + shellCount + tissueCount;
      var backingPixels = canvas.width * canvas.height;
      canvas.dataset.particleCount = String(particleCount);
      performanceState.renderProfile = renderProfile;
      performanceState.particleCount = particleCount;
      performanceState.backingPixels = backingPixels;
      clearScheduledFrame();
      draw(performance.now(), true);
      scheduleFrame();
    }

    // resize 先按帧合并；触屏设备再等待 120ms，避开地址栏动画产生的连环重建。
    function scheduleResize() {
      if (resizeFrame) return;
      resizeFrame = window.requestAnimationFrame(function() {
        resizeFrame = 0;
        if (handheld || tablet) {
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(function() {
            resizeTimer = 0;
            resize();
          }, 120);
        } else {
          resize();
        }
      });
    }

    // 用多组不同频率的正弦波生成不规则闭合轮廓，模拟“呼吸中的膜”。
    function organicPath(cx, cy, radius, time, layer, stretch) {
      var points = compact ? 104 : handheld ? 132 : tablet ? 160 : 176;
      context.beginPath();
      for (var i = 0; i <= points; i += 1) {
        var angle = i / points * Math.PI * 2;
        var wave =
          Math.sin(angle + time * 0.00012 + layer * 2.6) * 0.07 +
          Math.cos(angle * 2 - time * 0.00009 + layer) * 0.055 +
          Math.sin(angle * 3 + time * 0.00036 + layer * 1.7) * 0.12 +
          Math.sin(angle * 5 - time * 0.00022 + layer * 2.1) * 0.075 +
          Math.sin(angle * 9 + time * 0.00017 + layer) * 0.045 +
          Math.sin(angle * 17 - time * 0.00011) * 0.018;
        var pulse = 1 + Math.sin(time * 0.00082 + layer * 1.3) * 0.045;
        var r = radius * pulse * (1 + wave);
        var x = cx + Math.cos(angle) * r;
        var y = cy + Math.sin(angle) * r * stretch;
        if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.closePath();
    }

    // 一次径向渐变完成外膜光晕；比给多条路径分别做高斯阴影便宜得多。
    function drawMembraneBloom(cx, cy, radius, stretch, primary, secondary, ringPulse, transitionBurst) {
      context.save();
      context.translate(cx, cy);
      context.scale(1, stretch);
      var bloom = context.createRadialGradient(0, 0, radius * 0.54, 0, 0, radius * 1.16);
      bloom.addColorStop(0, rgba(primary, 0.018));
      bloom.addColorStop(0.48, rgba(primary, 0.032 + ringPulse * 0.012));
      bloom.addColorStop(0.72, rgba(secondary, 0.056 + transitionBurst * 0.028));
      bloom.addColorStop(0.88, rgba(primary, 0.036 + ringPulse * 0.018));
      bloom.addColorStop(1, rgba(primary, 0));
      context.fillStyle = bloom;
      context.beginPath();
      context.arc(0, 0, radius * 1.16, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    // 把透明度离散成 12 档，同一颜色/透明度的粒子合并成一次 fill，减少绘制调用。
    var particleAlphaSteps = 12;
    var sharedParticleBuckets = [
      Array.from({ length: particleAlphaSteps }, function() { return []; }),
      Array.from({ length: particleAlphaSteps }, function() { return []; })
    ];
    function resetParticleBuckets() {
      sharedParticleBuckets.forEach(function(colorBuckets) {
        colorBuckets.forEach(function(bucket) { bucket.length = 0; });
      });
      return sharedParticleBuckets;
    }

    // 为两种主题色各准备一张离屏光斑贴图；颜色不变时直接复用，不逐帧重建渐变。
    function createGlowCache(size) {
      return [
        { canvas: document.createElement('canvas'), context: null, key: '', size: size },
        { canvas: document.createElement('canvas'), context: null, key: '', size: size }
      ];
    }
    var ambientGlowCache = createGlowCache(256);
    var organelleGlowCache = createGlowCache(160);

    // 获取或更新缓存光斑。key 完全相同就返回上一张离屏 Canvas。
    function glowSprite(cache, colorIndex, color, middleAt, middleAlpha) {
      var entry = cache[colorIndex];
      var key = color.join(',') + ':' + middleAt.toFixed(2) + ':' + middleAlpha.toFixed(3);
      if (entry.key === key) return entry.canvas;
      if (!entry.context) {
        entry.canvas.width = entry.size;
        entry.canvas.height = entry.size;
        entry.context = entry.canvas.getContext('2d', { alpha: true, desynchronized: true });
      }
      var spriteContext = entry.context;
      var half = entry.size * 0.5;
      spriteContext.clearRect(0, 0, entry.size, entry.size);
      var gradient = spriteContext.createRadialGradient(half, half, 0, half, half, half);
      gradient.addColorStop(0, rgba(color, 1));
      gradient.addColorStop(middleAt, rgba(color, middleAlpha));
      gradient.addColorStop(1, rgba(color, 0));
      spriteContext.fillStyle = gradient;
      spriteContext.fillRect(0, 0, entry.size, entry.size);
      entry.key = key;
      return entry.canvas;
    }

    // 把一个粒子按颜色与透明度放进批次；太淡或无尺寸的粒子直接跳过。
    function addParticleToBucket(buckets, colorIndex, alpha, x, y, radius) {
      var safeAlpha = Math.max(0, Math.min(0.999, alpha));
      if (safeAlpha < 0.018 || radius <= 0) return;
      var bucket = Math.min(particleAlphaSteps - 1, Math.floor(safeAlpha * particleAlphaSteps));
      buckets[colorIndex][bucket].push(x, y, radius);
    }

    // 每个透明度批次只构造一次路径并填充，最后恢复 globalAlpha，避免影响后续图层。
    function paintParticleBuckets(buckets, colors) {
      colors.forEach(function(color, colorIndex) {
        context.fillStyle = rgba(color, 1);
        buckets[colorIndex].forEach(function(points, alphaIndex) {
          if (!points.length) return;
          context.beginPath();
          for (var pointIndex = 0; pointIndex < points.length; pointIndex += 3) {
            var x = points[pointIndex];
            var y = points[pointIndex + 1];
            var radius = points[pointIndex + 2];
            context.moveTo(x + radius, y);
            context.arc(x, y, radius, 0, Math.PI * 2);
          }
          context.globalAlpha = (alphaIndex + 0.5) / particleAlphaSteps;
          context.fill();
        });
      });
      context.globalAlpha = 1;
    }

    /*
     * 以页面可见性而不是 window blur 作为暂停依据。某些 Chromium 环境会在页面仍可见时
     * 短暂触发 blur；把焦点当作硬门槛会让 Canvas 停在旧帧，直到一次鼠标/触摸重新聚焦。
     */
    function canAnimate() {
      return running && visible && !document.hidden && pageActive;
    }

    // 给调试状态一个明确暂停原因，方便区分省电静态、离屏、后台标签等情况。
    function suspensionReason() {
      if (!running) return 'static';
      if (!pageActive) return 'pagehide';
      if (document.hidden) return 'hidden';
      if (!visible) return 'offscreen';
      return '';
    }

    // 把运行状态同步到 Canvas dataset 和调试对象，可直接在开发者工具里观察。
    function publishPerformanceState(mode, targetFps, reason) {
      performanceState.mode = mode;
      performanceState.targetFps = targetFps;
      performanceState.visible = visible;
      performanceState.focused = windowFocused;
      performanceState.hidden = document.hidden;
      performanceState.suspended = targetFps === 0;
      performanceState.reason = reason || '';
      if (canvas.dataset.performanceMode !== mode) canvas.dataset.performanceMode = mode;
      if (canvas.dataset.targetFps !== String(targetFps)) canvas.dataset.targetFps = String(targetFps);
      if (reason) canvas.dataset.pauseReason = reason;
      else if (canvas.dataset.pauseReason) delete canvas.dataset.pauseReason;
    }

    // 只在测得真实过载时降档；停止交互本身不应让生命体动画变卡。
    function desiredPerformanceMode(now) {
      if (now < overloadUntil) return 'overload';
      /*
       * 一段画面持续昂贵时继续留在过载档；恢复门槛和降档门槛故意不相同，
       * 否则引擎会在低帧率与 30fps 之间频繁跳动，反而造成顿挫。
       */
      if (adaptiveMode === 'overload' && averageRenderCost > 22.5) {
        overloadUntil = now + 4000;
        return 'overload';
      }
      return 'active';
    }

    // 应用具体帧率档位；显式恢复时会清掉旧任务并重新启动唯一调度链。
    function applyPerformanceMode(mode, reschedule) {
      var targetFps = activeTargetFps;
      var nextInterval = activeFrameInterval;
      if (mode === 'overload') {
        targetFps = overloadTargetFps;
        nextInterval = 1000 / overloadTargetFps;
      }
      /*
       * scheduleFrame 在可见时会收到浏览器的每个动画节拍。不要在这里每 16ms 重复
       * 写 dataset / 调试对象：只有档位或目标间隔真正改变时才同步状态。
       */
      var modeChanged = adaptiveMode !== mode || Math.abs(frameInterval - nextInterval) > 0.01;
      adaptiveMode = mode;
      frameInterval = nextInterval;
      if (modeChanged || canvas.dataset.performanceMode !== mode) {
        publishPerformanceState(mode, targetFps, '');
      }
      /* 暂停恢复后档位名称可能没变，但调度任务已经被清掉，所以显式恢复仍要重新启动。 */
      if (reschedule && canAnimate()) {
        clearScheduledFrame();
        scheduleFrame();
      }
    }

    // 集中处理“暂停还是继续”，确保后台或离屏时不再安排 Canvas 绘制。
    function syncPerformanceMode(now, reschedule) {
      if (!canAnimate()) {
        publishPerformanceState(running ? 'suspended' : 'static', 0, suspensionReason());
        clearScheduledFrame();
        return;
      }
      applyPerformanceMode(desiredPerformanceMode(now), reschedule);
    }

    // 记录指数移动平均渲染耗时；连续昂贵而非偶发尖峰才会触发 8 秒过载保护。
    // 静置状态同样参与检测，真正热起来时才会降档，而不是按时间把动画变成幻灯片。
    function recordFramePerformance(renderStarted, frameGap) {
      var now = performance.now();
      var renderCost = Math.max(0, now - renderStarted);
      averageRenderCost = averageRenderCost
        ? averageRenderCost * 0.88 + renderCost * 0.12
        : renderCost;
      renderedFrames += 1;
      performanceState.frames = renderedFrames;
      performanceState.averageRenderMs = Math.round(averageRenderCost * 10) / 10;
      performanceState.lastFrameAt = now;
      if (renderedFrames % 15 === 0) {
        canvas.dataset.averageRenderMs = performanceState.averageRenderMs.toFixed(1);
        canvas.dataset.renderedFrames = String(renderedFrames);
      }

      if (adaptiveMode !== 'overload' && frameGap) {
        var expensive = averageRenderCost > 21.5 || renderCost > 28;
        var delayed = frameGap > 52;
        if (expensive || delayed) {
          overloadScore += frameGap > 82 || renderCost > 38 ? 2 : 1;
        } else {
          overloadScore = Math.max(0, overloadScore - 0.4);
        }
        if (overloadScore >= 18) {
          overloadScore = 0;
          overloadUntil = now + 8000;
          applyPerformanceMode('overload', false);
        }
      }
      performanceState.overloadUntil = Math.round(overloadUntil);
      performanceState.overloadScore = Math.round(overloadScore * 10) / 10;
    }

    // 清理唯一的 rAF 调度链。
    function clearScheduledFrame() {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
    }

    /*
     * 始终由 requestAnimationFrame 提供时钟，在 draw 内根据 frameInterval 跳过不需要的帧。
     * 先前的 timeout + rAF 串联在 Chrome 静止一段时间后可能被节流；一旦鼠标或触摸事件
     * 抵达又会恢复，看起来就像生命体“必须动一下才续帧”。持续的 rAF 空帧很轻，而真正的
     * Canvas 绘制仍严格保持在 24/27/30fps（或过载保护档），因此不会用 GPU 换流畅度。
     */
    function scheduleFrame() {
      var now = performance.now();
      if (!canAnimate()) {
        syncPerformanceMode(now, false);
        return;
      }
      syncPerformanceMode(now, false);
      if (frameId) return;
      frameId = requestAnimationFrame(draw);
    }

    /*
     * Chrome 偶尔会在页面静止时把一条 rAF 链遗留成“已预约、但不再回调”的状态。
     * 这是纯调度保险：每秒最多运行一次，不绘制 Canvas；只有超过 900ms 没有收到任何
     * rAF 回调时才重挂下一帧，因此不会增加持续 GPU 负载，也不需要用户滑动来唤醒。
     */
    function sustainFrameLoop() {
      if (!canAnimate()) return;
      var now = performance.now();
      if (!lastAnimationTick || now - lastAnimationTick > 900) {
        clearScheduledFrame();
        scheduleFrame();
      }
    }

    // 绘制一帧。force 只用于 resize 后立即给出静态画面，不依赖动画调度状态。
    function draw(time, force) {
      if (!force) {
        frameId = 0;
        lastAnimationTick = performance.now();
      }
      if (!force && !canAnimate()) {
        syncPerformanceMode(time, false);
        return;
      }
      if (!force) syncPerformanceMode(time, false);
      if (!force && time - lastFrame < frameInterval - 0.5) {
        scheduleFrame();
        return;
      }
      // 先计算时间、阶段、环形脉冲和缓动后的指针偏移，所有图层共用同一套时钟。
      var frameGap = lastFrame ? time - lastFrame : 0;
      lastFrame = time;
      var renderStarted = performance.now();
      if (!startedAt) startedAt = time;
      var elapsed = Math.max(0, time - startedAt);
      var sceneFrameInfo = sceneFrame(elapsed);
      var analysisAmount = sceneFrameInfo.amount;
      var ringWave = (Math.sin(elapsed * 0.00435) + 1) * 0.5;
      var ringPulse = smoothStep(Math.pow(ringWave, 1.55));
      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      context.clearRect(0, 0, width, height);

      // 主体位置和半径按设备/页面类型单独调过；分析场景出现时再向上收拢。
      var mobile = handheld;
      var normalX = compact
        ? (shortLandscape ? 0.72 : mobile ? 0.72 : 0.77)
        : (shortLandscape ? 0.7 : mobile ? 0.55 : tablet ? 0.59 : 0.565);
      var normalY = compact
        ? (shortLandscape ? 0.48 : 0.54)
        : (shortLandscape ? 0.47 : mobile ? 0.35 : tablet ? 0.48 : 0.49);
      var analysisX = mobile ? 0.56 : 0.57;
      var analysisY = mobile ? 0.27 : 0.35;
      var cx = width * (normalX + (analysisX - normalX) * analysisAmount) + pointer.x * (compact ? 8 : 24);
      var cy = height * (normalY + (analysisY - normalY) * analysisAmount) + pointer.y * (compact ? 7 : 16);
      var radiusFactor = compact
        ? (shortLandscape ? 0.3 : mobile ? 0.25 : tablet ? 0.29 : 0.31)
        : (shortLandscape ? 0.31 : mobile ? 0.225 : tablet ? 0.275 : 0.285);
      var radius = Math.min(width, height) * radiusFactor;
      radius *= 1 - analysisAmount * 0.2;
      var colors = phaseColor(elapsed);
      var primary = colors.primary;
      var secondary = colors.secondary;
      var transitionBurst = Math.sin(colors.dissolve * Math.PI);
      var stretch = (compact ? 0.88 : 0.92) * (1 + Math.sin(elapsed * 0.0011) * 0.055);
      updatePhase(colors, elapsed);
      updateScene(sceneFrameInfo);

      context.save();
      context.globalCompositeOperation = 'screen';

      // 第一层：铺满视口的环境微粒，靠近“生命场”的粒子会更亮。
      var ambientBuckets = resetParticleBuckets();
      ambientParticles.forEach(function(particle, index) {
        var px = ((particle.x + elapsed * particle.speed) % 1) * width;
        var py = (particle.y + Math.sin(elapsed * 0.00016 + particle.phase) * 0.018) * height;
        var distance = Math.hypot((px - cx) / Math.max(radius, 1), (py - cy) / Math.max(radius, 1));
        var field = Math.max(0.16, Math.min(1, 1.45 - Math.abs(distance - 1.35) * 0.62));
        var flicker = 0.45 + Math.sin(elapsed * 0.0024 + particle.phase) * 0.28;
        if (particle.bloom) {
          var bloomAlpha = (0.025 + ringPulse * 0.045 + transitionBurst * 0.06) * field;
          var bloomColorIndex = index % 3 === 0 ? 1 : 0;
          var bloomColor = bloomColorIndex ? secondary : primary;
          var bloomSprite = glowSprite(ambientGlowCache, bloomColorIndex, bloomColor, 0.18, 1 / 2.3);
          context.globalAlpha = Math.min(1, bloomAlpha * 2.3);
          context.drawImage(
            bloomSprite,
            px - particle.bloomSize,
            py - particle.bloomSize,
            particle.bloomSize * 2,
            particle.bloomSize * 2
          );
          context.globalAlpha = 1;
        }
        addParticleToBucket(
          ambientBuckets,
          index % 7 === 0 ? 1 : 0,
          particle.alpha * field * flicker * (1 + transitionBurst * 0.8),
          px,
          py,
          particle.size
        );
      });
      paintParticleBuckets(ambientBuckets, [primary, secondary]);

      // 第二层：一个大范围低透明度光场，把主体与背景自然接起来。
      var aura = context.createRadialGradient(cx, cy, radius * 0.08, cx, cy, radius * 2.15);
      aura.addColorStop(0, rgba(secondary, compact ? 0.055 : 0.075));
      aura.addColorStop(0.32, rgba(primary, compact ? 0.06 : 0.08));
      aura.addColorStop(0.7, rgba(secondary, compact ? 0.018 : 0.025));
      aura.addColorStop(1, rgba(primary, 0));
      context.fillStyle = aura;
      context.fillRect(cx - radius * 2.2, cy - radius * 2.2, radius * 4.4, radius * 4.4);

      // 第三层：沿外壳运行的轨道粒子，脉冲和换色时向外扩散并带少量尾迹。
      var shellBuckets = resetParticleBuckets();
      shellParticles.forEach(function(particle, index) {
        var angle = particle.angle + elapsed * particle.speed;
        var turbulent = Math.sin(angle * 5 + elapsed * 0.00033 + particle.phase) * particle.drift;
        var burstSpread = transitionBurst * radius * (0.08 + (index % 9) / 90);
        var orbit = radius * (particle.radius + ringPulse * 0.075) + turbulent + Math.sin(elapsed * 0.0007 + particle.phase) * 8 + burstSpread;
        var px = cx + Math.cos(angle) * orbit;
        var py = cy + Math.sin(angle) * orbit * particle.stretch;
        var flicker = 0.26 + Math.sin(elapsed * 0.0037 + particle.phase) * 0.24 + ringPulse * 0.62 + transitionBurst * 0.55;
        var particleColor = index % 8 === 0 ? secondary : primary;
        if (index % 11 === 0 && (ringPulse > 0.25 || transitionBurst > 0.1)) {
          var tailAngle = angle - particle.speed * 1500;
          context.beginPath();
          context.moveTo(px, py);
          context.lineTo(cx + Math.cos(tailAngle) * (orbit - radius * 0.025), cy + Math.sin(tailAngle) * (orbit - radius * 0.025) * particle.stretch);
          context.lineWidth = Math.max(0.35, particle.size * 0.42);
          context.strokeStyle = rgba(particleColor, particle.alpha * (0.1 + ringPulse * 0.22 + transitionBurst * 0.2));
          context.stroke();
        }
        addParticleToBucket(shellBuckets, index % 8 === 0 ? 1 : 0, particle.alpha * flicker, px, py, particle.size);
      });
      paintParticleBuckets(shellBuckets, [primary, secondary]);

      /*
       * 用一层径向光场代替每条膜路径的高斯阴影。过去每帧给 5 条、每条约 170 点的
       * 动态路径重新模糊，会迫使 Chrome 重栅格化整张全屏画布；单次填充保留光晕观感，
       * 但 GPU 压力低得多。
       */
      drawMembraneBloom(cx, cy, radius, stretch, primary, secondary, ringPulse, transitionBurst);

      // 第四层：五张半透明不规则膜由外向内叠加，形成柔软而不是实心球的主体。
      for (var layer = 4; layer >= 0; layer -= 1) {
        var layerRadius = radius * (0.67 + layer * 0.045) * (1 + Math.sin(elapsed * 0.0021 + layer) * 0.025);
        organicPath(cx, cy, layerRadius, elapsed, layer, stretch);
        var fill = context.createRadialGradient(cx - layerRadius * 0.2, cy - layerRadius * 0.22, layerRadius * 0.05, cx, cy, layerRadius * 1.08);
        fill.addColorStop(0, rgba(layer % 2 ? secondary : primary, 0.045 + (4 - layer) * 0.012));
        fill.addColorStop(0.42, rgba(primary, 0.075 + (4 - layer) * 0.018));
        fill.addColorStop(0.82, rgba(secondary, 0.05 + layer * 0.008));
        fill.addColorStop(1, rgba(primary, 0.015));
        context.fillStyle = fill;
        context.fill();
        context.lineWidth = layer === 0 ? 1.12 : 0.5;
        context.strokeStyle = rgba(layer % 2 ? secondary : primary, 0.15 + (4 - layer) * 0.032);
        context.stroke();
      }

      // 第五层：内部组织粒子与稀疏连接线，位置写入 TypedArray 以减少逐帧垃圾回收。
      var tissueBuckets = resetParticleBuckets();
      tissueParticles.forEach(function(particle, index) {
        var angle = particle.angle + elapsed * particle.speed;
        var breathing = 1 + Math.sin(elapsed * 0.00075 + particle.phase) * 0.09 + ringPulse * 0.025;
        var r = radius * particle.radius * breathing;
        var ripple = Math.sin(angle * 6 - elapsed * 0.0003 + particle.phase) * radius * 0.045 * particle.radius;
        var nx = cx + Math.cos(angle) * (r + ripple);
        var ny = cy + Math.sin(angle) * (r + ripple) * stretch;
        tissuePositionX[index] = nx;
        tissuePositionY[index] = ny;
        if (index % 11 === 0 && index > 12) {
          context.beginPath();
          context.moveTo(tissuePositionX[index - 11], tissuePositionY[index - 11]);
          context.lineTo(nx, ny);
          context.lineWidth = 0.42;
          context.strokeStyle = rgba(index % 22 === 0 ? secondary : primary, 0.065);
          context.stroke();
        }
        var flicker = 0.52 + Math.sin(elapsed * 0.003 + particle.phase) * 0.31 + transitionBurst * 0.38;
        addParticleToBucket(tissueBuckets, index % 9 === 0 ? 1 : 0, particle.alpha * flicker, nx, ny, particle.size);
      });
      paintParticleBuckets(tissueBuckets, [primary, secondary]);

      // 第六层：少量“细胞器”光点使用离屏贴图缩放，避免每个光点各建一份渐变。
      var organelleCount = compact ? 4 : (shortLandscape ? 5 : mobile ? 6 : tablet ? 8 : 11);
      for (var glowIndex = 0; glowIndex < organelleCount; glowIndex += 1) {
        var glowAngle = seeded(glowIndex, 41) * Math.PI * 2 + elapsed * (0.000018 + glowIndex * 0.000001);
        var glowDistance = radius * (0.14 + seeded(glowIndex, 42) * 0.43);
        var glowX = cx + Math.cos(glowAngle) * glowDistance;
        var glowY = cy + Math.sin(glowAngle) * glowDistance * stretch;
        var glowRadius = radius * (0.035 + seeded(glowIndex, 43) * 0.07) * (1 + ringPulse * 0.3);
        var organelleColorIndex = glowIndex % 3 === 0 ? 1 : 0;
        var organelleColor = organelleColorIndex ? secondary : primary;
        var organelleAlpha = 0.2 + transitionBurst * 0.14;
        var organelleMiddle = Math.min(0.7, (0.08 + ringPulse * 0.035) / Math.max(organelleAlpha, 0.001));
        var organelleSprite = glowSprite(
          organelleGlowCache,
          organelleColorIndex,
          organelleColor,
          0.28,
          Math.round(organelleMiddle * 20) / 20
        );
        context.globalAlpha = organelleAlpha;
        context.drawImage(
          organelleSprite,
          glowX - glowRadius,
          glowY - glowRadius,
          glowRadius * 2,
          glowRadius * 2
        );
        context.globalAlpha = 1;
      }

      // 最后压暗中心，保留膜的通透层次；恢复 source-over 后再结束本帧上下文状态。
      var centerShade = context.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.64);
      centerShade.addColorStop(0, 'rgba(1,7,12,.16)');
      centerShade.addColorStop(0.48, 'rgba(1,7,12,.045)');
      centerShade.addColorStop(1, 'rgba(1,7,12,0)');
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = centerShade;
      context.beginPath();
      context.arc(cx, cy, radius * 0.68, 0, Math.PI * 2);
      context.fill();
      context.restore();

      recordFramePerformance(renderStarted, frameGap);
      scheduleFrame();
    }

    // 只有精细指针设备启用轻微视差；触屏和减少动效模式不会绑定这组高频事件。
    if (finePointer.matches && !reduceMotion.matches) {
      hero.addEventListener('pointerenter', function() {
        heroRect = hero.getBoundingClientRect();
      }, { passive: true });
      hero.addEventListener('pointermove', function(event) {
        if (!heroRect) heroRect = hero.getBoundingClientRect();
        pointer.tx = (event.clientX - heroRect.left) / heroRect.width - 0.5;
        pointer.ty = (event.clientY - heroRect.top) / heroRect.height - 0.5;
      }, { passive: true });
      hero.addEventListener('pointerleave', function() {
        pointer.tx = 0;
        pointer.ty = 0;
      }, { passive: true });
    }

    // Canvas 离开视口时彻底暂停；只露出几像素不算可见，避免页面下方仍偷偷绘制。
    var observer = new IntersectionObserver(function(entries) {
      var entry = entries[0];
      var minimumRatio = compact ? 0.08 : 0.045;
      visible = Boolean(entry && entry.isIntersecting && entry.intersectionRatio >= minimumRatio);
      syncPerformanceMode(performance.now(), visible);
    }, { threshold: [0, compact ? 0.08 : 0.045, 0.2] });
    observer.observe(canvas);

    // 标签页、窗口焦点和浏览器前进/后退缓存都会改变状态；可见页面不因暂时失焦而停帧。
    document.addEventListener('visibilitychange', function() {
      windowFocused = document.hidden ? false : document.hasFocus();
      syncPerformanceMode(performance.now(), true);
    });
    window.addEventListener('focus', function() {
      windowFocused = true;
      syncPerformanceMode(performance.now(), true);
    }, { passive: true });
    window.addEventListener('blur', function() {
      windowFocused = false;
      syncPerformanceMode(performance.now(), false);
    }, { passive: true });
    window.addEventListener('pagehide', function() {
      pageActive = false;
      syncPerformanceMode(performance.now(), false);
    }, { passive: true });
    window.addEventListener('pageshow', function() {
      pageActive = true;
      windowFocused = document.hasFocus();
      syncPerformanceMode(performance.now(), true);
    }, { passive: true });
    window.addEventListener('resize', scheduleResize, { passive: true });
    publishPerformanceState(adaptiveMode, running ? activeTargetFps : 0, running ? '' : 'static');
    resize();
    scheduleFrame();
    if (running) window.setInterval(sustainFrameLoop, 1000);
  }

  // 总入口严格按“页面状态 -> 结构增强 -> 视觉/动效”顺序执行，避免后一步找不到节点。
  function init() {
    var route = setPageState();
    mountSkipLink();
    enhanceNavbar(route);
    mountHero(route);
    mountHomeFeed();
    decorateCollections(route);
    mountPostDossier();
    mountAboutDossier();
    mountReadingProgress();
    decorateFooter();
    bindChrome();
    mountCardSpotlight();
    mountReveal();
    mountSpringFeedback();
  }

  // 兼容脚本在 head 或 body 中加载的两种情况，确保初始化时 DOM 已经完整。
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
