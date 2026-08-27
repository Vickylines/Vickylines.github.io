(function() {
  'use strict';

  var root = document.documentElement;
  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function normalizedText(node) {
    return node ? (node.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function routeFromPath() {
    var path = window.location.pathname;
    if (/^\/(?:index\.html)?$/.test(path) || /^\/page\/[1-9]\d*\/?$/.test(path)) return 'home';
    if (/^\/\d{4}\/\d{2}\/\d{2}\//.test(path) || document.querySelector('article.post-content')) return 'post';
    if (/^\/archives(?:\/|$)/.test(path)) return 'archive';
    if (/^\/categories\/?$/.test(path)) return 'categories';
    if (/^\/categories\//.test(path)) return 'category';
    if (/^\/tags\/?$/.test(path)) return 'tags';
    if (/^\/tags\//.test(path)) return 'tag';
    if (/^\/about\/?$/.test(path)) return 'about';
    if (/^\/404(?:\.html)?$/.test(path)) return '404';
    return 'page';
  }

  function safePath(href) {
    try {
      return new URL(href, window.location.href).pathname;
    } catch (error) {
      return href || '';
    }
  }

  function icon(name) {
    var icons = {
      life: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h9.5A2.5 2.5 0 0 1 18 7v12.5H8.5A2.5 2.5 0 0 1 6 17V4.5Z"/><path d="M8.5 19.5A2.5 2.5 0 0 1 6 17V7a2.5 2.5 0 0 0-2.5 2.5V17A2.5 2.5 0 0 0 6 19.5h2.5ZM10 9h4M10 13h4"/></svg>',
      tech: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2.5"/><path d="m7 9 2.5 2.5L7 14m5.5 0H17M9 21h6"/></svg>',
      notes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5h10A2.5 2.5 0 0 1 19.5 8v8A2.5 2.5 0 0 1 17 18.5h-5L7 21v-2.5A2.5 2.5 0 0 1 4.5 16V8A2.5 2.5 0 0 1 7 5.5Z"/><path d="M8.5 10h7M8.5 14h4"/></svg>',
      archive: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h16v11A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-11Z"/><path d="M3 3h18v4.5H3zM9 12h6"/></svg>',
      arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5"/></svg>'
    };
    return icons[name] || icons.arrow;
  }

  function mountSkipLink() {
    if (document.querySelector('.hpkp-skip-link')) return;
    var link = element('a', 'hpkp-skip-link', '跳到正文');
    link.href = '#hpkp-main-content';
    document.body.insertBefore(link, document.body.firstChild);
    var main = document.querySelector('main');
    if (main) {
      main.id = 'hpkp-main-content';
      main.setAttribute('tabindex', '-1');
    }
  }

  function activeNavRoute(route) {
    if (route === 'category' || route === 'categories') return '/categories/';
    if (route === 'tag' || route === 'tags') return '/tags/';
    if (route === 'archive' || route === 'post') return '/archives/';
    if (route === 'about') return '/about/';
    if (route === 'home') return '/';
    return '';
  }

  // Fluid 默认导航会在每次滚动时读取布局并切换类名；当前固定导航不需要这项工作。
  // 保留移动菜单的必要交互，同时避免常驻滚动监听和 300ms 点击锁。
  function installLightweightNavbarEvents() {
    if (!window.Fluid || !window.Fluid.events) return;
    window.Fluid.events.registerNavbarEvent = function() {
      var navbar = document.querySelector('#navbar');
      var button = document.querySelector('#navbar-toggler-btn');
      var menu = document.querySelector('#mobile-grid-menu');
      if (!navbar || !button || !menu) return;

      var animatedIcon = button.querySelector('.animated-icon');
      button.removeAttribute('data-toggle');
      button.removeAttribute('data-target');

      function setOpen(open) {
        menu.classList.toggle('show', open);
        if (animatedIcon) animatedIcon.classList.toggle('open', open);
        document.body.classList.toggle('mobile-menu-open', open);
        navbar.classList.toggle('top-nav-collapse', open);
        button.setAttribute('aria-expanded', String(open));
      }

      button.addEventListener('click', function(event) {
        event.preventDefault();
        setOpen(!menu.classList.contains('show'));
      });
      menu.addEventListener('click', function(event) {
        if (event.target.closest('a[href]')) setOpen(false);
      });
      window.addEventListener('resize', function() {
        if (window.innerWidth >= 992 && menu.classList.contains('show')) setOpen(false);
      }, { passive: true });
    };
  }

  installLightweightNavbarEvents();

  function enhanceNavbar(route) {
    var navbar = document.querySelector('#navbar');
    if (!navbar) return;
    navbar.classList.add('hpkp-navbar');

    var brand = navbar.querySelector('.navbar-brand');
    if (brand) {
      brand.setAttribute('aria-label', 'HPKP 个人博客，返回首页');
    }

    var activePath = activeNavRoute(route);
    Array.prototype.forEach.call(navbar.querySelectorAll('.navbar-nav > .nav-item > .nav-link'), function(link) {
      var path = safePath(link.href);
      var active = Boolean(activePath && path === activePath);
      link.classList.toggle('is-current', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    Array.prototype.forEach.call(document.querySelectorAll('#mobile-grid-menu a[href]'), function(link) {
      if (safePath(link.href) === activePath) link.setAttribute('aria-current', 'page');
    });
  }

  function originalBannerTitle() {
    var title = document.querySelector('#banner .banner-text .h2');
    return normalizedText(title);
  }

  function originalPostMeta() {
    var values = [];
    Array.prototype.forEach.call(document.querySelectorAll('#banner .banner-text .post-meta'), function(meta) {
      var value = normalizedText(meta).replace(/^更新于\s*/, '更新于 ');
      if (value && values.indexOf(value) === -1) values.push(value);
    });
    return values.join(' · ');
  }

  function heroContent(route) {
    var pageTitle = originalBannerTitle();
    var entries = {
      home: {
        title: '生活与技术'
      },
      archive: {
        title: '文章'
      },
      categories: {
        title: '分类'
      },
      category: {
        title: pageTitle || '分类文章'
      },
      tags: {
        title: '标签'
      },
      tag: {
        title: pageTitle || '标签文章'
      },
      about: {
        title: '关于'
      },
      '404': {
        title: '404',
        lead: '页面不存在。'
      },
      page: {
        title: pageTitle || '页面'
      }
    };

    if (route === 'post') {
      return {
        title: pageTitle || normalizedText(document.querySelector('#seo-header')) || '文章',
        lead: originalPostMeta()
      };
    }
    return entries[route] || entries.page;
  }

  function mountHero(route) {
    var banner = document.querySelector('#banner');
    var mask = banner && banner.querySelector('.mask');
    if (!banner || !mask || mask.querySelector('.hpkp-hero')) return;

    var data = heroContent(route);
    var hero = element('section', 'hpkp-hero hpkp-hero--' + route);
    hero.setAttribute('aria-labelledby', 'hpkp-hero-title');
    var inner = element('div', 'hpkp-hero-inner');

    var title = element('h1', 'hpkp-hero-title', data.title);
    title.id = 'hpkp-hero-title';
    if (normalizedText(title).length > 24) title.classList.add('is-long');
    inner.appendChild(title);

    if (data.lead) inner.appendChild(element('p', 'hpkp-hero-lead', data.lead));

    var actions = element('div', 'hpkp-hero-actions');
    if (route === 'home') {
      var latest = document.querySelector('#board .index-card .index-header a');
      var primary = element('a', 'hpkp-button hpkp-button--primary');
      primary.href = latest ? latest.href : '/archives/';
      primary.innerHTML = '<span>最近文章</span>' + icon('arrow');
      actions.appendChild(primary);

      var secondary = element('a', 'hpkp-button hpkp-button--quiet', '归档');
      secondary.href = '/archives/';
      actions.appendChild(secondary);
    } else if (route === '404') {
      var home = element('a', 'hpkp-button hpkp-button--primary');
      home.href = '/';
      home.innerHTML = '<span>返回首页</span>' + icon('arrow');
      actions.appendChild(home);
    }
    if (actions.childNodes.length) inner.appendChild(actions);

    hero.appendChild(inner);
    mask.insertBefore(hero, mask.firstChild);
  }

  function topicCard(data) {
    var link = element('a', 'hpkp-topic-card');
    link.href = data[2];
    var visual = element('span', 'hpkp-topic-icon');
    visual.innerHTML = icon(data[0]);
    link.appendChild(visual);
    link.appendChild(element('h3', '', data[1]));
    var more = element('span', 'hpkp-topic-more');
    more.innerHTML = icon('arrow');
    more.setAttribute('aria-hidden', 'true');
    link.appendChild(more);
    return link;
  }

  function sectionHeading(title) {
    var head = element('header', 'hpkp-section-head');
    head.appendChild(element('h2', '', title));
    return head;
  }

  function cleanExcerpt(card) {
    var excerpt = card.querySelector('.index-excerpt > div');
    if (!excerpt) return;
    var value = normalizedText(excerpt)
      .replace(/🔒\s*此图片已加密/g, '')
      .replace(/解锁图片\s*密码错误或图片已损坏。?/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    var limit = 150;
    excerpt.textContent = value.length > limit ? value.slice(0, limit).trim() + '…' : value;
  }

  function decoratePostCard(card, index) {
    if (card.querySelector('.hpkp-card-topline')) return;
    card.classList.add('hpkp-post-card');
    card.setAttribute('data-card-index', String(index + 1).padStart(2, '0'));
    card.setAttribute('data-card-tone', ['blue', 'violet', 'orange', 'green'][index % 4]);
    var article = card.querySelector('.index-info');
    if (!article) return;

    var date = normalizedText(card.querySelector('time'));
    var category = normalizedText(card.querySelector('.category-chain-item')) || '未分类';
    var topline = element('div', 'hpkp-card-topline');
    topline.innerHTML = '<span>' + String(index + 1).padStart(2, '0') + ' / ' + category + '</span><span>' + date + '</span>';
    article.insertBefore(topline, article.firstChild);
    cleanExcerpt(card);

    var arrow = element('span', 'hpkp-card-arrow');
    arrow.innerHTML = icon('arrow');
    article.appendChild(arrow);
  }

  function mountHome() {
    var board = document.querySelector('#board');
    if (!board || board.classList.contains('hpkp-home-mounted')) return;
    var cards = Array.prototype.slice.call(board.querySelectorAll('.index-card'));
    board.classList.add('hpkp-home-mounted');

    var rootSection = element('div', 'hpkp-home-root');

    var topics = element('section', 'hpkp-topic-section');
    topics.setAttribute('aria-labelledby', 'hpkp-topic-heading');
    var hiddenTitle = element('h2', 'hpkp-visually-hidden', '内容入口');
    hiddenTitle.id = 'hpkp-topic-heading';
    topics.appendChild(hiddenTitle);
    var topicGrid = element('div', 'hpkp-topic-grid');
    [
      ['life', '生活', '/categories/%E7%94%9F%E6%B4%BB%E8%AE%B0%E5%BD%95/'],
      ['tech', '技术', '/categories/%E6%8A%98%E8%85%BE/'],
      ['notes', '随笔', '/tags/%E9%9A%8F%E7%AC%94/'],
      ['archive', '归档', '/archives/']
    ].forEach(function(data) {
      topicGrid.appendChild(topicCard(data));
    });
    topics.appendChild(topicGrid);
    rootSection.appendChild(topics);

    var feed = element('section', 'hpkp-feed-section');
    feed.setAttribute('aria-labelledby', 'hpkp-feed-heading');
    var feedHead = sectionHeading('最近');
    feedHead.querySelector('h2').id = 'hpkp-feed-heading';
    feed.appendChild(feedHead);
    var grid = element('div', 'hpkp-feed-grid');
    cards.forEach(function(card, index) {
      decoratePostCard(card, index);
      grid.appendChild(card);
    });
    feed.appendChild(grid);

    var allPosts = element('a', 'hpkp-text-link');
    allPosts.href = '/archives/';
    allPosts.innerHTML = '<span>查看全部文章</span>' + icon('arrow');
    feed.appendChild(allPosts);
    rootSection.appendChild(feed);

    board.insertBefore(rootSection, board.firstChild);
  }

  function routeSwitcher(route) {
    var nav = element('nav', 'hpkp-route-switcher');
    nav.setAttribute('aria-label', '内容索引');
    [
      ['archive', '全部文章', '/archives/'],
      ['categories', '分类', '/categories/'],
      ['tags', '标签', '/tags/']
    ].forEach(function(item) {
      var link = element('a', '', item[1]);
      link.href = item[2];
      var active = route === item[0] || (item[0] === 'categories' && route === 'category') || (item[0] === 'tags' && route === 'tag');
      if (active) {
        link.classList.add('is-current');
        link.setAttribute('aria-current', 'page');
      }
      nav.appendChild(link);
    });
    return nav;
  }

  function decorateCollectionItems(route, board) {
    if (route === 'archive' || route === 'category' || route === 'tag') {
      Array.prototype.forEach.call(board.querySelectorAll('.list-group > .list-group-item'), function(item, index) {
        if (!item.querySelector('.hpkp-list-arrow')) {
          var arrow = element('span', 'hpkp-list-arrow');
          arrow.innerHTML = icon('arrow');
          item.appendChild(arrow);
        }
        item.style.setProperty('--hpkp-entry-index', '"' + String(index + 1).padStart(2, '0') + '"');
      });
    }

    if (route === 'categories') {
      Array.prototype.forEach.call(board.querySelectorAll('.category-list .category'), function(category) {
        var count = category.querySelectorAll('.collapse .list-group-item').length;
        var countNode = category.querySelector('.list-group-count');
        if (countNode) countNode.textContent = count + ' 篇';

        var trigger = category.querySelector('.category-item');
        var panel = category.querySelector('.category-collapse');
        if (!trigger || !panel) return;

        trigger.removeAttribute('data-toggle');
        panel.classList.remove('collapsing');

        function setCategoryOpen(open) {
          trigger.classList.toggle('collapsed', !open);
          trigger.setAttribute('aria-expanded', String(open));
          panel.classList.toggle('show', open);
          panel.hidden = !open;
          panel.style.removeProperty('height');
        }

        setCategoryOpen(panel.classList.contains('show'));
        trigger.addEventListener('click', function(event) {
          event.preventDefault();
          event.stopPropagation();
          setCategoryOpen(panel.hidden);
        });
      });
    }

    if (route === 'tags') {
      Array.prototype.forEach.call(board.querySelectorAll('.tagcloud a'), function(tag) {
        tag.removeAttribute('style');
      });
    }
  }

  function mountCollection(route) {
    var board = document.querySelector('#board');
    if (!board || board.classList.contains('hpkp-collection-mounted')) return;
    board.classList.add('hpkp-collection-mounted');
    board.insertBefore(routeSwitcher(route), board.firstChild);
    decorateCollectionItems(route, board);
  }

  function mountMobileToc() {
    var toc = document.querySelector('#toc');
    if (!toc || document.querySelector('.hpkp-toc-button')) return;
    var sideColumn = toc.closest('.side-col');
    if (sideColumn) sideColumn.classList.add('hpkp-toc-column');
    var button = element('button', 'hpkp-toc-button', '目录');
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'toc');
    var backdrop = element('button', 'hpkp-toc-backdrop');
    backdrop.type = 'button';
    backdrop.setAttribute('aria-label', '关闭文章目录');
    document.body.appendChild(backdrop);
    document.body.appendChild(button);

    function setOpen(open) {
      document.body.classList.toggle('hpkp-toc-open', open);
      button.setAttribute('aria-expanded', String(open));
      if (sideColumn) {
        if (open) sideColumn.style.setProperty('display', 'block', 'important');
        else sideColumn.style.removeProperty('display');
      }
      if (open) window.setTimeout(function() {
        var first = toc.querySelector('a');
        if (first) first.focus({ preventScroll: true });
      }, 30);
    }

    button.addEventListener('click', function() {
      setOpen(!document.body.classList.contains('hpkp-toc-open'));
    });
    backdrop.addEventListener('click', function() { setOpen(false); });
    toc.addEventListener('click', function(event) {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') setOpen(false);
    });
  }

  function mountPost() {
    var article = document.querySelector('article.post-content');
    if (!article || article.classList.contains('hpkp-post-mounted')) return;
    article.classList.add('hpkp-post-mounted');

    var markdown = article.querySelector('.markdown-body');
    if (markdown) {
      Array.prototype.forEach.call(markdown.querySelectorAll('img'), function(image) {
        image.decoding = 'async';
      });
      Array.prototype.forEach.call(markdown.querySelectorAll('a[href^="http"]'), function(link) {
        if (new URL(link.href).origin !== window.location.origin) link.rel = 'noopener noreferrer';
      });
    }

    var tocHeader = document.querySelector('#toc .toc-header span');
    if (tocHeader) tocHeader.textContent = '文章目录';
    mountMobileToc();
  }

  function decorateFooter() {
    var footer = document.querySelector('footer .footer-inner');
    if (!footer || footer.querySelector('.hpkp-footer')) return;
    var existing = footer.querySelector('.footer-content');
    if (existing) existing.style.display = 'none';
    var section = element('div', 'hpkp-footer');
    var links = element('nav', 'hpkp-footer-links');
    links.setAttribute('aria-label', '页脚导航');
    [
      ['文章', '/archives/'],
      ['分类', '/categories/'],
      ['标签', '/tags/'],
      ['关于', '/about/']
    ].forEach(function(item) {
      var link = element('a', '', item[0]);
      link.href = item[1];
      links.appendChild(link);
    });
    section.appendChild(links);
    section.appendChild(element('p', 'hpkp-footer-copy', '© ' + new Date().getFullYear() + ' hpkp'));
    footer.insertBefore(section, footer.firstChild);
  }

  function bindThemeColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    function update() {
      var dark = root.getAttribute('data-user-color-scheme') === 'dark';
      meta.content = dark ? '#111318' : '#ffffff';
    }
    update();
    new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ['data-user-color-scheme'] });
  }

  function init() {
    var route = routeFromPath();
    root.setAttribute('data-hpkp-route', route);
    mountSkipLink();
    enhanceNavbar(route);
    mountHero(route);
    if (route === 'home') mountHome();
    if (['archive', 'categories', 'category', 'tags', 'tag'].indexOf(route) !== -1) mountCollection(route);
    if (route === 'post') mountPost();
    decorateFooter();
    bindThemeColor();
    root.classList.add('hpkp-site-ready');
  }

  // 自定义脚本由 Fluid 放在 </body> 前，此时所需节点已经存在；同步完成布局可避免首屏二次重排。
  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
