(function() {
  'use strict';

  /*
   * Lumen v4 — 信号档案
   *
   * The visual layer is rebuilt around a liquid-glass composition, but the
   * data contracts below are unchanged on purpose: the Supabase RPC names,
   * the per-device visitor id key and the URL used as a post identifier are
   * the same ones the existing rows were written with. A new skin must never
   * orphan existing views, likes or comments.
   */

  var CLOUD_CONFIG = {
    url: 'https://qjtwjkylnzgsbmovnweo.supabase.co',
    publishableKey: 'sb_publishable_zEWw-_oMnu7HARuu8vqqkA_n8J8uo05'
  };

  // Short fragments only: the ticker shows one line at a time under the
  // headline, so anything longer would wrap and unbalance the hero.
  var VERSE_LIBRARY = [
    '长风破浪',
    '明月松间',
    '坐看云起',
    '一蓑烟雨',
    '星河欲转',
    '千帆过尽',
    '山止川行',
    '心向远方'
  ];

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  function localPreview() {
    return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname);
  }

  function countDistinct(selector) {
    var seen = Object.create(null);
    var total = 0;
    Array.prototype.forEach.call(document.querySelectorAll(selector), function(item) {
      var value = (item.textContent || '').trim();
      if (value && !seen[value]) {
        seen[value] = true;
        total += 1;
      }
    });
    return total;
  }

  function seedFrom(value) {
    var seed = 0;
    for (var i = 0; i < value.length; i += 1) seed = (seed * 31 + value.charCodeAt(i)) >>> 0;
    return seed;
  }

  function pickVerses(count) {
    var picked = [];
    var offset = seedFrom((window.location.pathname || '/') + ':verse') % VERSE_LIBRARY.length;
    for (var i = 0; picked.length < count && i < VERSE_LIBRARY.length * 2; i += 1) {
      var verse = VERSE_LIBRARY[(offset + i * 3) % VERSE_LIBRARY.length];
      if (picked.indexOf(verse) === -1) picked.push(verse);
    }
    return picked;
  }

  function springPop(node, className) {
    if (!node || reduceMotion.matches) return;
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
    window.setTimeout(function() { node.classList.remove(className); }, 700);
  }

  /* ---------------------------------------------------------------- state */

  function setPageState() {
    var body = document.body;
    var path = window.location.pathname;
    var isPost = Boolean(document.querySelector('article.post-content'));
    // Match on the route, not on card presence: an empty future home page is
    // still the home page and must not be styled as a collection.
    var isHome = /^\/(?:index\.html)?$/.test(path) && !isPost;
    var isAbout = /^\/about\/?$/.test(path);
    var page = isPost ? 'post' : isHome ? 'home' : isAbout ? 'about' : 'collection';

    body.classList.add('is-' + page);
    document.documentElement.dataset.lumenPage = page;
    return page;
  }

  /* ------------------------------------------------------------ dark mode */

  // A colour-scheme swap repaints the canvas, every glass card and the aurora
  // at once. On browsers with View Transitions, commit it inside a single
  // document snapshot so those surfaces cannot repaint one after another.
  function bindThemeSwitch() {
    var releaseTimer = 0;
    var busy = false;

    function refreshChrome(schema) {
      var root = document.documentElement;
      var inverse = schema === 'dark' ? 'light' : 'dark';

      var icon = document.getElementById('color-toggle-icon');
      if (icon) {
        icon.className = 'iconfont icon-' + schema;
        icon.setAttribute('data', inverse);
      }

      var mobileIcon = document.getElementById('mobile-color-toggle-icon');
      if (mobileIcon) mobileIcon.className = 'iconfont icon-' + schema;

      var mobileButton = document.getElementById('mobile-color-toggle-btn');
      var mobileLabel = document.getElementById('mobile-color-toggle-label');
      if (mobileButton && mobileLabel) {
        mobileLabel.textContent = schema === 'dark'
          ? (mobileButton.getAttribute('data-label-light') || '')
          : (mobileButton.getAttribute('data-label-dark') || '');
      }

      var lightCss = document.getElementById('highlight-css');
      var darkCss = document.getElementById('highlight-css-dark');
      if (schema === 'dark') {
        if (darkCss) darkCss.removeAttribute('disabled');
        if (lightCss) lightCss.setAttribute('disabled', '');
      } else {
        if (lightCss) lightCss.removeAttribute('disabled');
        if (darkCss) darkCss.setAttribute('disabled', '');
      }

      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', schema === 'dark' ? '#080a10' : '#f2f4f8');
    }

    function commit(schema) {
      var root = document.documentElement;
      root.classList.add('theme-switching');
      root.setAttribute('data-user-color-scheme', schema);
      try { window.localStorage.setItem('Fluid_Color_Scheme', schema); } catch (error) {}
      refreshChrome(schema);
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(function() {
        root.classList.remove('theme-switching');
      }, 420);
    }

    document.addEventListener('click', function(event) {
      var target = event.target && event.target.closest
        ? event.target.closest('#color-toggle-btn, #mobile-color-toggle-btn')
        : null;
      if (!target) return;

      if (!document.startViewTransition || reduceMotion.matches) {
        // Let the theme's own handler flip the attribute; just shield the
        // intermediate frames.
        document.documentElement.classList.add('theme-switching');
        window.clearTimeout(releaseTimer);
        releaseTimer = window.setTimeout(function() {
          document.documentElement.classList.remove('theme-switching');
        }, 420);
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      if (busy) return;

      busy = true;
      var current = document.documentElement.getAttribute('data-user-color-scheme') || 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      var transition = document.startViewTransition(function() { commit(next); });
      transition.finished.catch(function() {}).then(function() { busy = false; });
    }, true);

    refreshChrome(document.documentElement.getAttribute('data-user-color-scheme') || 'light');
  }

  /* ----------------------------------------------------------------- hero */

  function mountAurora(mask) {
    if (mask.querySelector('.lm-aurora')) return;
    var aurora = el('div', 'lm-aurora');
    aurora.setAttribute('aria-hidden', 'true');
    aurora.innerHTML =
      '<span class="lm-aurora__blob lm-aurora__blob--1"></span>' +
      '<span class="lm-aurora__blob lm-aurora__blob--2"></span>' +
      '<span class="lm-aurora__blob lm-aurora__blob--3"></span>' +
      '<span class="lm-aurora__ring"></span>';
    mask.insertBefore(aurora, mask.firstChild);
  }

  function heroEyebrow(page) {
    if (page === 'home') return 'Signal Archive · 持续记录';
    if (page === 'post') return 'Article';
    if (page === 'about') return 'Profile';
    return 'Index';
  }

  function mountHero(page) {
    var banner = document.getElementById('banner');
    var mask = banner && banner.querySelector('.mask');
    if (!mask || mask.querySelector('.lm-hero')) return;

    mountAurora(mask);

    var hero = el('section', 'lm-hero');
    var eyebrow = el('p', 'lm-hero__eyebrow');
    eyebrow.appendChild(el('i'));
    eyebrow.appendChild(document.createTextNode(heroEyebrow(page)));
    hero.appendChild(eyebrow);

    if (page === 'home') {
      var siteTitle = (document.querySelector('.navbar-brand') || {}).textContent || '';
      var title = el('h1', 'lm-hero__title', (siteTitle.split('/').pop() || '信号档案').trim());
      hero.appendChild(title);
    }

    // The theme owns .banner-text: on an article it carries the real title and
    // metadata, and the typing plugin binds to #subtitle inside it. Move the
    // node instead of re-rendering so both keep working.
    var bannerText = mask.querySelector('.banner-text');
    if (bannerText) hero.appendChild(bannerText);

    if (page === 'home') {
      hero.appendChild(buildVerseTicker());
      hero.appendChild(buildStats());
    }

    mask.appendChild(hero);

    if (page === 'home') {
      var cue = el('span', 'lm-cue');
      cue.setAttribute('aria-hidden', 'true');
      mask.appendChild(cue);
    }
  }

  function buildVerseTicker() {
    var field = el('div', 'lm-verse');
    field.setAttribute('aria-hidden', 'true');

    var verses = pickVerses(4);
    var nodes = verses.map(function(verse, index) {
      var span = el('span', index === 0 ? 'is-on' : '', verse);
      field.appendChild(span);
      return span;
    });

    if (nodes.length > 1 && !reduceMotion.matches) {
      var current = 0;
      window.setInterval(function() {
        if (document.hidden) return;
        nodes[current].classList.remove('is-on');
        current = (current + 1) % nodes.length;
        nodes[current].classList.add('is-on');
      }, 5200);
    }

    return field;
  }

  function buildStats() {
    var posts = document.querySelectorAll('#board .index-card').length;
    var categories = countDistinct('#board .post-metas a[href*="/categories/"]');
    var tags = countDistinct('#board .post-metas a[href*="/tags/"]');

    var wrap = el('div', 'lm-stats');
    wrap.setAttribute('aria-label', '站点统计');

    [
      [posts, 'Entries'],
      [categories, 'Routes'],
      [tags, 'Signals']
    ].forEach(function(pair) {
      var stat = el('div', 'lm-stat');
      stat.appendChild(el('strong', '', String(pair[0])));
      stat.appendChild(el('span', '', pair[1]));
      wrap.appendChild(stat);
    });

    return wrap;
  }

  /* ------------------------------------------------------------- home deck */

  function mountHomeDeck() {
    if (!document.body.classList.contains('is-home')) return;

    var cards = Array.prototype.slice.call(document.querySelectorAll('#board .index-card'));
    if (!cards.length || document.querySelector('.lm-deck')) return;

    var parent = cards[0].parentNode;

    var section = el('section', 'lm-section');
    var head = el('div');
    head.appendChild(el('p', 'lm-section__kicker', 'Recent signals'));
    head.appendChild(el('h2', 'lm-section__title', '最近的记录'));
    head.appendChild(el('p', 'lm-section__copy', '每一篇都是一枚已经发生、值得留存的信号。慢一点读，也没关系。'));
    section.appendChild(head);

    var link = el('a', 'lm-link');
    link.href = '/archives/';
    link.appendChild(document.createTextNode('全部归档'));
    link.appendChild(el('span', '', '→'));
    section.appendChild(link);

    var deck = el('section', 'lm-deck');
    deck.setAttribute('aria-label', '文章列表');

    parent.insertBefore(section, cards[0]);
    parent.insertBefore(deck, cards[0]);

    cards.forEach(function(card, index) {
      if (index === 0) {
        card.classList.add('is-featured');
        var badge = el('span', 'lm-badge', 'Latest');
        card.insertBefore(badge, card.firstChild);
      }
      deck.appendChild(card);
    });
  }

  /* -------------------------------------------------------------- pointer */

  // Cards carry a radial highlight that follows the cursor. Coarse pointers
  // get nothing: a touch device would leave a stale hotspot behind.
  function mountCardSpotlight() {
    if (reduceMotion.matches || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var cards = document.querySelectorAll('.index-card');
    if (!cards.length) return;

    Array.prototype.forEach.call(cards, function(card) {
      var queued = false;
      var lastEvent = null;

      card.addEventListener('pointermove', function(event) {
        lastEvent = event;
        if (queued) return;
        queued = true;
        window.requestAnimationFrame(function() {
          queued = false;
          var rect = card.getBoundingClientRect();
          card.style.setProperty('--lm-x', ((lastEvent.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
          card.style.setProperty('--lm-y', ((lastEvent.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
        });
      }, { passive: true });
    });
  }

  /* --------------------------------------------------------------- reveal */

  function mountReveal() {
    var targets = Array.prototype.slice.call(document.querySelectorAll(
      '.lm-section, .lm-deck .index-card, article.post-content, .post-pulse, ' +
      '#board .list-group, .about-info, .about-content, .about-manifest__facts li'
    ));
    if (!targets.length) return;

    if (reduceMotion.matches || typeof window.IntersectionObserver !== 'function') return;

    targets.forEach(function(target, index) {
      target.classList.add('lm-reveal');
      target.style.setProperty('--lm-delay', Math.min(index, 6) * 70 + 'ms');
    });

    var observer = new window.IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    targets.forEach(function(target) { observer.observe(target); });

    // Anything already on screen at load should settle immediately rather
    // than waiting for the first scroll.
    window.requestAnimationFrame(function() {
      targets.forEach(function(target) {
        var rect = target.getBoundingClientRect();
        if (rect.top < window.innerHeight) target.classList.add('is-in');
      });
    });
  }

  /* ------------------------------------------------------- reading chrome */

  function mountReadingProgress() {
    if (!document.body.classList.contains('is-post') || document.querySelector('.reading-progress')) return;

    var bar = el('div', 'reading-progress');
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    var queued = false;

    function update() {
      queued = false;
      var root = document.documentElement;
      var height = Math.max(root.scrollHeight, document.body.scrollHeight);
      var available = Math.max(height - window.innerHeight, 1);
      var ratio = Math.max(0, Math.min(1, window.scrollY / available));
      bar.style.setProperty('--reading-progress', (ratio * 100).toFixed(2) + '%');
    }

    function schedule() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    update();
  }

  /* ------------------------------------------------------------ post pulse */

  function visitorId() {
    var key = 'hpkp-cloud-visitor-id';
    var existing = null;
    try {
      existing = window.localStorage.getItem(key);
    } catch (error) {
      // Private browsing can deny storage; the current visit still works.
    }
    if (existing) return existing;

    var value = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(character) {
        var random = Math.floor(Math.random() * 16);
        return (character === 'x' ? random : (random & 3) | 8).toString(16);
      });

    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      // Keep the ephemeral value when persistence is unavailable.
    }
    return value;
  }

  async function cloudRpc(name, payload) {
    var response = await fetch(CLOUD_CONFIG.url + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: {
        apikey: CLOUD_CONFIG.publishableKey,
        Authorization: 'Bearer ' + CLOUD_CONFIG.publishableKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  function mountPostPulse() {
    var article = document.querySelector('article.post-content');
    if (!article || article.querySelector('.post-pulse')) return;

    var path = window.location.pathname;
    var state = { views: 0, likes: 0, liked: false, comments: [] };

    var box = el('section', 'post-pulse');
    box.setAttribute('aria-label', '文章互动');
    box.innerHTML =
      '<div class="pulse-header"><strong>回应这篇</strong><span class="pulse-status">正在连接互动区…</span></div>' +
      '<div class="pulse-actions">' +
        '<button class="pulse-button" type="button" data-action="like" aria-pressed="false">♡ <span>喜欢 0</span></button>' +
        '<span class="pulse-button" aria-label="浏览量">◉ <span>浏览 0</span></span>' +
      '</div>' +
      '<form class="pulse-comment-form">' +
        '<p class="pulse-identity">会以本设备的匿名代号发布，评论提交后即时公开。</p>' +
        '<textarea name="comment" maxlength="500" required placeholder="想对这篇说点什么…" aria-label="评论内容"></textarea>' +
        '<button class="pulse-submit" type="submit">发布回应</button>' +
      '</form>' +
      '<div class="pulse-comments"></div>';

    // Last in the article: read the piece, see its tags and licence, then
    // respond. The previous skin placed this above the metadata divider,
    // which pushed the tags below the comment thread.
    article.appendChild(box);

    var likeButton = box.querySelector('[data-action="like"]');
    var likeCount = likeButton.querySelector('span');
    var viewCount = box.querySelector('[aria-label="浏览量"] span');
    var comments = box.querySelector('.pulse-comments');
    var status = box.querySelector('.pulse-status');
    var form = box.querySelector('form');
    var textarea = form.querySelector('textarea');
    var submit = form.querySelector('button');

    function setStatus(value) { status.textContent = value; }

    function render() {
      likeCount.textContent = '喜欢 ' + state.likes;
      viewCount.textContent = '浏览 ' + state.views;
      likeButton.classList.toggle('is-liked', state.liked);
      likeButton.setAttribute('aria-pressed', String(state.liked));
      likeButton.firstChild.textContent = state.liked ? '♥ ' : '♡ ';
      comments.innerHTML = '';

      if (!state.comments.length) {
        comments.appendChild(el('p', 'pulse-empty', '还没有回应，写下第一句也很好。'));
        return;
      }

      state.comments.forEach(function(comment) {
        var item = el('div', 'pulse-comment');
        var createdAt = comment.created_at
          ? new Date(comment.created_at).toLocaleString('zh-CN', { hour12: false })
          : '';
        item.appendChild(el('div', 'pulse-comment-meta', (comment.nickname || '匿名访客') + (createdAt ? ' · ' + createdAt : '')));
        item.appendChild(el('div', '', comment.content || ''));
        comments.appendChild(item);
      });
    }

    if (localPreview()) {
      likeButton.disabled = true;
      textarea.disabled = true;
      submit.disabled = true;
      setStatus('本地预览 · 不写入线上互动数据');
      render();
      return;
    }

    var id = visitorId();
    Promise.all([
      cloudRpc('record_blog_view', { p_post_path: path, p_visitor_id: id }),
      cloudRpc('get_blog_comments', { p_post_path: path })
    ]).then(function(results) {
      var stats = results[0][0] || {};
      state.views = Number(stats.view_count || 0);
      state.likes = Number(stats.like_count || 0);
      state.liked = Boolean(stats.liked);
      state.comments = Array.isArray(results[1]) ? results[1] : [];
      setStatus('互动区已连接');
      render();
    }).catch(function() {
      setStatus('互动区暂不可用，稍后再试');
      render();
    });

    likeButton.addEventListener('click', async function() {
      likeButton.disabled = true;
      try {
        var result = await cloudRpc('toggle_blog_like', { p_post_path: path, p_visitor_id: id });
        var data = result[0] || {};
        state.liked = Boolean(data.liked);
        state.likes = Number(data.like_count || 0);
        setStatus('已同步');
        render();
        springPop(likeButton, 'pulse-pop');
      } catch (error) {
        setStatus('喜欢未能同步，请稍后重试');
      } finally {
        likeButton.disabled = false;
      }
    });

    form.addEventListener('submit', async function(event) {
      event.preventDefault();
      var content = textarea.value.trim();
      if (!content) return;

      submit.disabled = true;
      try {
        await cloudRpc('submit_blog_comment', {
          p_post_path: path,
          p_visitor_id: id,
          p_nickname: null,
          p_content: content
        });
        textarea.value = '';
        state.comments = await cloudRpc('get_blog_comments', { p_post_path: path });
        setStatus('回应已公开');
        render();
        springPop(submit, 'pulse-submit-pop');
      } catch (error) {
        setStatus(/blocked content/i.test(String(error)) ? '内容未能发布，请调整后再试' : '回应提交失败，请稍后重试');
      } finally {
        submit.disabled = false;
      }
    });
  }

  /* ------------------------------------------------------------------ init */

  function init() {
    var page = setPageState();
    bindThemeSwitch();
    mountHero(page);
    mountHomeDeck();
    mountCardSpotlight();
    mountReadingProgress();
    mountPostPulse();
    mountReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
