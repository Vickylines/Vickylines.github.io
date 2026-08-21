(function() {
  'use strict';

  /*
   * Signal Archive UI
   * Keep the blog's original Supabase protocol and URL based identifiers.
   * The visual layer is deliberately isolated from the reading and interaction
   * contracts below, so a new skin never splits existing article data.
   */

  var CLOUD_CONFIG = {
    url: 'https://qjtwjkylnzgsbmovnweo.supabase.co',
    publishableKey: 'sb_publishable_zEWw-_oMnu7HARuu8vqqkA_n8J8uo05'
  };

  // Short fragments are intentional here: they can orbit the headline without
  // stealing the headline's reading space, especially on a narrow phone.
  var ORBIT_VERSE_LIBRARY = [
    '长风破浪',
    '明月松间',
    '坐看云起',
    '一蓑烟雨',
    '星河欲转',
    '千帆过尽',
    '山止川行',
    '心向远方'
  ];

  function createElement(tag, className, value) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof value === 'string') element.textContent = value;
    return element;
  }

  function triggerSpring(element, className) {
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    window.setTimeout(function() {
      element.classList.remove(className);
    }, 700);
  }

  function localPreview() {
    return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname);
  }

  function countDistinct(selector) {
    var values = {};
    var count = 0;
    Array.prototype.forEach.call(document.querySelectorAll(selector), function(item) {
      var value = (item.textContent || '').trim();
      if (value && !values[value]) {
        values[value] = true;
        count += 1;
      }
    });
    return count;
  }

  function verseSeed(value) {
    var seed = 0;
    for (var index = 0; index < value.length; index += 1) {
      seed = (seed * 31 + value.charCodeAt(index)) >>> 0;
    }
    return seed;
  }

  function pickOrbitVerses() {
    var selected = [];
    var offset = verseSeed((window.location.pathname || '/') + ':orbit') % ORBIT_VERSE_LIBRARY.length;
    for (var index = 0; selected.length < 4; index += 1) {
      var verse = ORBIT_VERSE_LIBRARY[(offset + index * 2) % ORBIT_VERSE_LIBRARY.length];
      if (selected.indexOf(verse) === -1) selected.push(verse);
    }
    return selected;
  }

  function setPageState() {
    var body = document.body;
    var path = window.location.pathname;
    var isPost = Boolean(document.querySelector('article.post-content'));
    // A path check keeps an empty future home page styled as the home page too.
    // The old card-presence check incorrectly turned it into a collection page.
    var isHome = /^\/(?:index\.html)?$/.test(path) && !isPost;
    var isAbout = /^\/about\/?$/.test(path);

    if (isPost) {
      body.classList.add('is-post');
      document.documentElement.dataset.cockpitPage = 'post';
    } else if (isHome) {
      body.classList.add('is-home');
      document.documentElement.dataset.cockpitPage = 'home';
    } else if (isAbout) {
      body.classList.add('is-about');
      document.documentElement.dataset.cockpitPage = 'about';
    } else {
      body.classList.add('is-collection');
      document.documentElement.dataset.cockpitPage = 'collection';
    }
  }

  // Theme changes touch many large reading surfaces.  On browsers with View
  // Transitions, commit the complete scheme inside one document snapshot so
  // cards, paper and page background never repaint one after another.
  function bindThemeSwitchShield() {
    var releaseTimer = 0;
    var transitionBusy = false;

    function refreshThemeChrome(schema) {
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

      var themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) {
        themeMeta.setAttribute('content', getComputedStyle(root).getPropertyValue('--navbar-bg-color').trim());
      }
    }

    function commitTheme(schema) {
      var root = document.documentElement;
      root.classList.add('theme-switching');
      root.setAttribute('data-user-color-scheme', schema);
      try { window.localStorage.setItem('Fluid_Color_Scheme', schema); } catch (error) {}
      refreshThemeChrome(schema);
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(function() {
        root.classList.remove('theme-switching');
      }, 460);
    }

    document.addEventListener('click', function(event) {
      var target = event.target && event.target.closest
        ? event.target.closest('#color-toggle-btn, #mobile-color-toggle-btn')
        : null;
      if (!target) return;

      if (!document.startViewTransition) {
        document.documentElement.classList.add('theme-switching');
        window.clearTimeout(releaseTimer);
        releaseTimer = window.setTimeout(function() {
          document.documentElement.classList.remove('theme-switching');
        }, 460);
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      if (transitionBusy) return;

      transitionBusy = true;
      var current = document.documentElement.getAttribute('data-user-color-scheme') || 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      var transition = document.startViewTransition(function() {
        commitTheme(next);
      });

      transition.finished.catch(function() {}).then(function() {
        transitionBusy = false;
      });
    }, true);
  }

  function mountAtmosphere() {
    var banner = document.getElementById('banner');
    var mask = banner && banner.querySelector('.mask');
    if (!banner || !mask || mask.querySelector('.cockpit-atmosphere')) return;

    var atmosphere = document.createElement('div');
    atmosphere.className = 'cockpit-atmosphere';
    atmosphere.setAttribute('aria-hidden', 'true');
    atmosphere.innerHTML =
      '<div class="cockpit-grid"></div>' +
      '<span class="cockpit-orbit cockpit-orbit--one"></span>' +
      '<span class="cockpit-orbit cockpit-orbit--two"></span>';
    mask.insertBefore(atmosphere, mask.firstChild);

    if (document.body.classList.contains('is-home')) {
      var postCount = document.querySelectorAll('#board .index-card').length;
      var tagCount = countDistinct('#board .post-metas a[href^="/tags/"]');
      var signal = document.createElement('section');
      signal.className = 'home-signal';
      signal.setAttribute('aria-label', '站点状态');
      signal.innerHTML =
        '<p class="home-signal__eyebrow">HPKP / SIGNAL ARCHIVE</p>' +
        '<h1 class="home-signal__title">信号档案</h1>' +
        '<p class="home-signal__copy">记录日常与折腾。</p>' +
        '<div class="home-signal__metrics">' +
          '<div class="home-signal__metric"><strong>' + postCount + '</strong><span>ARCHIVED</span></div>' +
          '<div class="home-signal__metric"><strong>' + tagCount + '</strong><span>SIGNALS</span></div>' +
          '<div class="home-signal__metric"><strong>LIVE</strong><span>RECORDING</span></div>' +
        '</div>';
      mask.appendChild(signal);
      return;
    }

    var marker = createElement('p', 'cockpit-page-marker');
    if (document.body.classList.contains('is-post')) {
      marker.textContent = 'ARTICLE / SIGNAL ARCHIVE';
    } else if (document.body.classList.contains('is-about')) {
      marker.textContent = 'PROFILE / SIGNAL ARCHIVE';
    } else {
      marker.textContent = 'INDEX / SIGNAL ARCHIVE';
    }
    mask.appendChild(marker);
  }

  function mountPoeticVerses() {
    if (!document.body.classList.contains('is-home')) return;

    var banner = document.getElementById('banner');
    var mask = banner && banner.querySelector('.mask');
    if (!mask || mask.querySelector('.poetry-field')) return;

    var field = document.createElement('div');
    field.className = 'poetry-field';
    field.setAttribute('aria-hidden', 'true');

    // The image is the stable visual anchor. Text stays in the DOM so Chinese
    // remains crisp, selectable and responsive while the four short phrases
    // continue their counter-clockwise orbit around it.
    var coreArt = document.createElement('img');
    coreArt.className = 'signal-core-art';
    coreArt.src = '/img/signal-core-v1.png';
    coreArt.alt = '';
    coreArt.setAttribute('aria-hidden', 'true');
    coreArt.decoding = 'async';
    mask.appendChild(coreArt);

    var orbit = createElement('div', 'poetry-orbit');
    pickOrbitVerses().forEach(function(verse, index) {
      var line = createElement('span', 'poetry-orbit__line poetry-orbit__line--' + (index + 1), verse);
      orbit.appendChild(line);
    });
    ['cyan', 'pink', 'gold', 'violet'].forEach(function(tone, index) {
      orbit.appendChild(createElement('i', 'poetry-orbit__particle poetry-orbit__particle--' + (index + 1) + ' poetry-orbit__particle--' + tone));
    });
    field.appendChild(orbit);

    mask.appendChild(field);
    startPoetryOrbit(orbit, banner);
  }

  function startPoetryOrbit(orbit, banner) {
    if (!orbit || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var anchor = banner.querySelector('.banner-text .h2') || banner.querySelector('.banner-text');
    var lines = Array.prototype.slice.call(orbit.querySelectorAll('.poetry-orbit__line'));
    if (!anchor || !lines.length) return;

    var resizeTimer = null;
    var frame = 0;

    function layoutOrbit() {
      var bannerRect = banner.getBoundingClientRect();
      var anchorRect = anchor.getBoundingClientRect();
      // Use a fractional edge so an exact 767px viewport cannot fall through
      // the CSS/JS breakpoint gap caused by scrollbar rounding.
      var mobile = window.matchMedia('(max-width: 767.98px)').matches;
      // Keep the JavaScript hand-off aligned with the CSS tablet bridge.
      // A 1024–1100px layout still has the same two-line-title constraints.
      var compact = window.matchMedia('(max-width: 1100.98px)').matches;
      var centerX = anchorRect.left - bannerRect.left + anchorRect.width / 2;
      var centerY = anchorRect.top - bannerRect.top + anchorRect.height / 2;
      var headlineTop = anchorRect.top - bannerRect.top;
      var orbitYRadius;

      // Keep the ring visually behind the headline without forcing every
      // orbit label into the same vertical band. Desktop gets a deliberate
      // upper-right bias; phones lift the ring into the open upper field so
      // its lower chip cannot fall behind the route dock on short screens.
      if (mobile) {
        centerY -= Math.min(7.2 * 16, banner.clientHeight * 0.18);
      } else if (compact) {
        centerX += Math.min(2.2 * 16, banner.clientWidth * 0.03);
        centerY -= Math.min(2.2 * 16, banner.clientHeight * 0.06);
      } else {
        centerX += Math.min(4.5 * 16, banner.clientWidth * 0.04);
        centerY -= Math.min(4 * 16, banner.clientHeight * 0.075);
      }
      var desiredRadius = mobile
        ? Math.min(banner.clientWidth * 0.29, Math.max(5.8 * 16, anchorRect.width / 2 + 0.7 * 16))
        : compact
          ? Math.min(banner.clientWidth * 0.25, Math.max(11.5 * 16, anchorRect.width / 2 + 3 * 16))
          : Math.min(banner.clientWidth * 0.3, Math.max(13.5 * 16, anchorRect.width / 2 + 4.3 * 16));
      // Account for the floating label width as well as the geometric ring.
      // This prevents a responsive headline near an edge from sending half of
      // the counter-clockwise verse ring outside the visible Hero.
      var labelHalf = mobile ? 3 * 16 : (compact ? 3.5 * 16 : 4.2 * 16);
      var horizontalLimit = Math.max(4.5 * 16, Math.min(centerX, banner.clientWidth - centerX) - labelHalf);
      var verticalLimit = Math.max(4.5 * 16, Math.min(centerY, banner.clientHeight - centerY) - labelHalf);
      var radius = Math.min(desiredRadius, horizontalLimit, verticalLimit);
      var labelHalfHeight = mobile ? 0.9 * 16 : 0.85 * 16;
      var desktopOrbitYRadius = radius;

      // Tablet widths retain the split composition, but the title often wraps
      // to two lines. Reserve the upper-right signal window for the moving
      // labels so the orbit never crosses that longer headline.
      if (!mobile && compact) {
        var compactTopClearance = 4.25 * 16;
        var compactGap = 0.6 * 16;
        var compactRadiusLimit = (headlineTop - compactTopClearance - 2 * (labelHalfHeight + compactGap)) / 2;
        if (compactRadiusLimit > 4.2 * 16) {
          radius = Math.min(radius, compactRadiusLimit);
          centerY = compactTopClearance + labelHalfHeight + compactGap + radius;
          desktopOrbitYRadius = radius;
        }
      } else if (!mobile) {
        // The art keeps the full circular core, while the readable labels use
        // a wide upper ellipse. This preserves all four phrases at desktop
        // scale without letting a long Chinese headline cut through a lap.
        var desktopTopClearance = 4 * 16;
        var desktopGap = 0.6 * 16;
        var desktopYLimit = (headlineTop - desktopTopClearance - 2 * (labelHalfHeight + desktopGap)) / 2;
        if (desktopYLimit > 3.5 * 16) {
          desktopOrbitYRadius = Math.min(radius, desktopYLimit);
          centerY = desktopTopClearance + labelHalfHeight + desktopGap + desktopOrbitYRadius;
        }
      }

      // A phone has a single vertical reading lane. Keep the four labels in
      // the open band between the HUD and the headline, rather than letting a
      // label sweep across the words during the lower part of a circular lap.
      // The visual core itself remains circular; only the responsive label
      // path becomes a shallow ellipse on small screens.
      if (mobile) {
        var hud = banner.querySelector('.home-signal');
        var hudRect = hud && hud.getBoundingClientRect();
        var topLimit = hudRect
          ? hudRect.bottom - bannerRect.top + 0.72 * 16 + labelHalfHeight
          : labelHalfHeight + 1.25 * 16;
        var bottomLimit = headlineTop - 0.82 * 16 - labelHalfHeight;
        var availableHeight = bottomLimit - topLimit;

        if (availableHeight > 0) {
          centerY = topLimit + availableHeight / 2;
          orbitYRadius = Math.min(radius, availableHeight / 2);
        } else {
          // If a browser presents an exceptionally short viewport, preserve
          // the horizontal circulation but collapse its vertical travel rather
          // than letting a label trespass into either protected reading lane.
          centerY = Math.max(topLimit, Math.min(bottomLimit, centerY));
          orbitYRadius = 0;
        }
      } else {
        orbitYRadius = desktopOrbitYRadius;
      }

      orbit.style.setProperty('--orbit-x', centerX.toFixed(1) + 'px');
      orbit.style.setProperty('--orbit-y', centerY.toFixed(1) + 'px');
      orbit.style.setProperty('--orbit-radius', radius.toFixed(1) + 'px');
      orbit.style.setProperty('--orbit-radius-y', orbitYRadius.toFixed(1) + 'px');
      orbit.style.setProperty('--orbit-radius-x-negative', (-radius).toFixed(1) + 'px');
      orbit.style.setProperty('--orbit-radius-y-negative', (-orbitYRadius).toFixed(1) + 'px');
      orbit.style.setProperty('--orbit-diagonal-x', (radius * 0.7071).toFixed(1) + 'px');
      orbit.style.setProperty('--orbit-diagonal-x-negative', (-radius * 0.7071).toFixed(1) + 'px');
      orbit.style.setProperty('--orbit-diagonal-y', (orbitYRadius * 0.7071).toFixed(1) + 'px');
      orbit.style.setProperty('--orbit-diagonal-y-negative', (-orbitYRadius * 0.7071).toFixed(1) + 'px');
      orbit.style.setProperty('--orbit-w', (radius * 2).toFixed(1) + 'px');
      orbit.style.setProperty('--orbit-h', (orbitYRadius * 2).toFixed(1) + 'px');

      lines.forEach(function(line) {
        line.style.left = centerX.toFixed(1) + 'px';
        line.style.top = centerY.toFixed(1) + 'px';
      });
    }

    function scheduleLayout() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function() {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(layoutOrbit);
      }, 80);
    }

    frame = window.requestAnimationFrame(layoutOrbit);
    window.addEventListener('resize', function() {
      scheduleLayout();
    }, { passive: true });
    window.addEventListener('orientationchange', scheduleLayout, { passive: true });

    // Banner copy can wrap differently after a phone rotates, web fonts load,
    // or a theme feature changes the subtitle. Re-measure the true anchor
    // rather than leaving the counter-clockwise ring around a stale box.
    if (typeof window.ResizeObserver === 'function') {
      var observer = new window.ResizeObserver(scheduleLayout);
      observer.observe(anchor);
      observer.observe(banner);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleLayout);
    }
  }

  function mountHomeDock() {
    if (!document.body.classList.contains('is-home')) return;

    var banner = document.getElementById('banner');
    var mask = banner && banner.querySelector('.mask');
    if (!mask || mask.querySelector('.night-dock')) return;

    var dock = document.createElement('section');
    dock.className = 'night-dock';
    dock.setAttribute('aria-label', '月光航线');
    dock.innerHTML =
      '<div class="night-dock__head"><span>SIGNAL ROUTE / 01</span><span class="night-dock__status"><i></i>LIVE</span></div>' +
      '<p class="night-dock__quote">发现留痕，回声可循。</p>' +
      '<div class="night-dock__rail" aria-hidden="true"><span></span></div>' +
      '<div class="night-dock__meta"><span>ARCHIVE / 2026</span><span>STAY LUMINOUS</span></div>';
    mask.appendChild(dock);
  }

  function mountHomeDeck() {
    if (!document.body.classList.contains('is-home')) return;

    var cards = Array.prototype.slice.call(document.querySelectorAll('#board .index-card'));
    if (!cards.length || document.querySelector('.flight-deck')) return;

    var parent = cards[0].parentNode;
    var postCount = cards.length;
    var categoryCount = countDistinct('#board .post-metas a[href^="/categories/"]');
    var tagCount = countDistinct('#board .post-metas a[href^="/tags/"]');
    var overview = document.createElement('section');
    overview.className = 'flight-overview';
    overview.setAttribute('aria-label', '文章概览');
    overview.innerHTML =
      '<div>' +
        '<p class="flight-overview__kicker">SIGNAL ARCHIVE / 持续记录</p>' +
        '<h2 class="flight-overview__title">最近信号</h2>' +
        '<p class="flight-overview__copy">每一篇都是一枚已经发生、值得留存的信号。慢一点读，也没关系。</p>' +
      '</div>' +
      '<div class="flight-overview__stats" aria-label="站点统计">' +
        '<div class="flight-stat"><strong>' + postCount + '</strong><span>ENTRIES</span></div>' +
        '<div class="flight-stat"><strong>' + categoryCount + '</strong><span>ROUTES</span></div>' +
        '<div class="flight-stat"><strong>' + tagCount + '</strong><span>SIGNALS</span></div>' +
      '</div>';

    var deck = document.createElement('section');
    deck.className = 'flight-deck';
    deck.setAttribute('aria-label', '文章列表');

    parent.insertBefore(overview, cards[0]);
    parent.insertBefore(deck, cards[0]);
    cards.forEach(function(card, index) {
      card.classList.add('flight-card');
      if (index === 0) card.classList.add('is-featured');
      deck.appendChild(card);
    });
  }

  function mountHomeScrollTopGuard() {
    if (!document.body.classList.contains('is-home')) return;

    var banner = document.getElementById('banner');
    var button = document.getElementById('scroll-top-button');
    if (!banner || !button) return;

    var queued = false;
    function syncVisibility() {
      queued = false;
      // A return-to-top control has no purpose while the visitor is already
      // at the top, and on a phone it can cover the route dock. Reveal it only
      // after the Hero is meaningfully behind the viewport.
      document.body.classList.toggle('home-scroll-top-ready', window.scrollY > banner.offsetHeight * 0.72);
    }

    function scheduleVisibility() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(syncVisibility);
    }

    syncVisibility();
    window.addEventListener('scroll', scheduleVisibility, { passive: true });
    window.addEventListener('resize', scheduleVisibility, { passive: true });
  }

  function mountSpringMotion() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var targets = Array.prototype.slice.call(document.querySelectorAll(
      '.flight-overview, .flight-deck .index-card, body.is-post #board .post-content, body.is-post .post-pulse, body.is-about #board .about-info, body.is-about .about-manifest__facts li'
    ));
    if (!targets.length) return;

    targets.forEach(function(target, index) {
      target.classList.add('spring-in');
      target.style.setProperty('--spring-delay', Math.min(index, 7) * 75 + 'ms');
    });

    window.requestAnimationFrame(function() {
      window.requestAnimationFrame(function() {
        document.documentElement.classList.add('spring-motion-ready');
      });
    });
  }

  function mountReadingProgress() {
    if (!document.body.classList.contains('is-post') || document.querySelector('.reading-progress')) return;

    var progress = document.createElement('div');
    progress.className = 'reading-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);

    function updateProgress() {
      var root = document.documentElement;
      var documentHeight = Math.max(root.scrollHeight, document.body.scrollHeight);
      var available = Math.max(documentHeight - window.innerHeight, 1);
      var ratio = Math.max(0, Math.min(1, window.scrollY / available));
      progress.style.setProperty('--reading-progress', (ratio * 100).toFixed(2) + '%');
    }

    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    updateProgress();
  }

  function visitorId() {
    var key = 'hpkp-cloud-visitor-id';
    var existing = null;
    try {
      existing = window.localStorage.getItem(key);
    } catch (error) {
      // Private browsing can deny storage.  The current visit still works.
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

  // The post body can contain Markdown `---` separators.  Only a direct
  // child divider belongs to the metadata area and is safe to insert before.
  function postMetaDivider(article) {
    for (var index = 0; index < article.children.length; index += 1) {
      if (article.children[index].tagName === 'HR') return article.children[index];
    }
    return null;
  }

  function insertPostPulse(article, box) {
    var marker = postMetaDivider(article);
    if (marker) article.insertBefore(box, marker); else article.appendChild(box);
  }

  function mountPostPulse() {
    var article = document.querySelector('article.post-content');
    if (!article || article.querySelector('.post-pulse')) return;

    var path = window.location.pathname;
    var state = { views: 0, likes: 0, liked: false, comments: [] };
    var box = document.createElement('section');
    box.className = 'post-pulse';
    box.setAttribute('aria-label', '文章互动');
    box.innerHTML =
      '<div class="pulse-header"><strong>回应这篇</strong><span class="pulse-status">正在连接互动区…</span></div>' +
      '<div class="pulse-actions"><button class="pulse-button" type="button" data-action="like" aria-pressed="false">♡ <span>喜欢 0</span></button><span class="pulse-button" aria-label="浏览量">◉ <span>浏览 0</span></span></div>' +
      '<form class="pulse-comment-form"><p class="pulse-identity">会以本设备的匿名代号发布，评论提交后即时公开。</p><textarea name="comment" maxlength="500" required placeholder="想对这篇说点什么…" aria-label="评论内容"></textarea><button class="pulse-submit" type="submit">发布回应</button></form><div class="pulse-comments"></div>';
    insertPostPulse(article, box);

    var likeButton = box.querySelector('[data-action="like"]');
    var likeCount = likeButton.querySelector('span');
    var viewCount = box.querySelector('[aria-label="浏览量"] span');
    var comments = box.querySelector('.pulse-comments');
    var status = box.querySelector('.pulse-status');
    var form = box.querySelector('form');
    var textarea = form.querySelector('textarea');
    var submit = form.querySelector('button');

    function setStatus(value) {
      status.textContent = value;
    }

    function render() {
      likeCount.textContent = '喜欢 ' + state.likes;
      viewCount.textContent = '浏览 ' + state.views;
      likeButton.classList.toggle('is-liked', state.liked);
      likeButton.setAttribute('aria-pressed', String(state.liked));
      comments.innerHTML = '';

      if (!state.comments.length) {
        comments.appendChild(createElement('p', 'pulse-empty', '还没有回应，写下第一句也很好。'));
        return;
      }

      state.comments.forEach(function(comment) {
        var item = createElement('div', 'pulse-comment');
        var createdAt = comment.created_at ? new Date(comment.created_at).toLocaleString('zh-CN', { hour12: false }) : '';
        item.appendChild(createElement('div', 'pulse-comment-meta', (comment.nickname || '匿名访客') + (createdAt ? ' · ' + createdAt : '')));
        item.appendChild(createElement('div', '', comment.content || ''));
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
        triggerSpring(likeButton, 'pulse-pop');
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
        triggerSpring(submit, 'pulse-submit-pop');
      } catch (error) {
        setStatus(/blocked content/i.test(String(error)) ? '内容未能发布，请调整后再试' : '回应提交失败，请稍后重试');
      } finally {
        submit.disabled = false;
      }
    });
  }

  function init() {
    setPageState();
    bindThemeSwitchShield();
    mountAtmosphere();
    mountPoeticVerses();
    mountHomeDock();
    mountHomeDeck();
    mountHomeScrollTopGuard();
    mountReadingProgress();
    mountPostPulse();
    mountSpringMotion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
