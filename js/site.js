(() => {
  'use strict';
  const root = document.documentElement;
  const mobile = window.matchMedia('(max-width: 760px)');
  const menu = document.querySelector('#site-navigation');
  const menuToggle = document.querySelector('#menu-toggle');

  function setMenu(open, restoreFocus = false) {
    const expanded = open && mobile.matches;
    menu.hidden = mobile.matches && !expanded;
    menuToggle.setAttribute('aria-expanded', String(expanded));
    menuToggle.setAttribute('aria-label', expanded ? '关闭导航' : '打开导航');
    root.classList.toggle('menu-is-open', expanded);
    if (restoreFocus) menuToggle.focus();
  }

  menuToggle.addEventListener('click', () => {
    const opening = menuToggle.getAttribute('aria-expanded') !== 'true';
    setMenu(opening);
    if (opening) menu.querySelector('a')?.focus();
  });
  menu.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.site-header')) setMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root.classList.contains('menu-is-open')) setMenu(false, true);
  });
  mobile.addEventListener('change', () => {
    const focusWasInMenu = menu.contains(document.activeElement);
    setMenu(false, focusWasInMenu && mobile.matches);
  });
  menuToggle.hidden = false;
  root.classList.add('navigation-ready');
  setMenu(false);

  const themeToggle = document.querySelector('#theme-toggle');
  if (window.hpkpAppearance) {
    const updateLabel = () => {
      const dark = root.dataset.userColorScheme === 'dark';
      themeToggle.setAttribute('aria-label', dark ? '切换到浅色外观' : '切换到深色外观');
      themeToggle.title = themeToggle.getAttribute('aria-label');
    };
    themeToggle.addEventListener('click', window.hpkpAppearance.toggle);
    document.addEventListener('hpkp:appearance', updateLabel);
    updateLabel();
    themeToggle.hidden = false;
  }

  const toc = document.querySelector('#article-toc');
  if (toc) {
    const resizeToc = () => { toc.open = !mobile.matches; };
    resizeToc();
    mobile.addEventListener('change', resizeToc);
    toc.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || !mobile.matches) return;
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      toc.open = false;
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  }

  const dialog = document.querySelector('#search-dialog');
  const input = document.querySelector('#search-input');
  const status = document.querySelector('#search-status');
  const results = document.querySelector('#search-results');
  const retry = document.querySelector('#search-retry');
  let indexPromise;
  let searchVersion = 0;

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = (async () => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch(dialog.dataset.index, { signal: controller.signal });
          if (!response.ok) throw new Error('Search index unavailable');
          const data = await response.json();
          if (!Array.isArray(data)) throw new Error('Invalid search index');
          return data.filter((item) => {
            if (typeof item.title !== 'string' || typeof item.url !== 'string' || typeof item.text !== 'string') return false;
            try { return new URL(item.url, location.href).origin === location.origin; } catch (_) { return false; }
          }).map((item) => ({ ...item, searchable: [item.title, item.text, ...(item.tags || [])].join(' ').toLocaleLowerCase() }));
        } finally { window.clearTimeout(timeout); }
      })().catch((error) => { indexPromise = null; throw error; });
    }
    return indexPromise;
  }

  async function search() {
    const version = ++searchVersion;
    const query = input.value.trim().toLocaleLowerCase();
    results.replaceChildren();
    retry.hidden = true;
    if (!query) { status.textContent = '输入关键词，找回一篇记录。'; return; }
    status.textContent = '正在查找…';
    try {
      const posts = await loadIndex();
      if (version !== searchVersion) return;
      const words = query.split(/\s+/);
      const matches = posts.filter((post) => words.every((word) => post.searchable.includes(word)));
      status.textContent = matches.length ? `找到 ${matches.length} 篇文章${matches.length > 30 ? '，显示前 30 篇' : ''}` : '没有找到相关文章，换个关键词试试。';
      for (const post of matches.slice(0, 30)) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = post.url;
        const title = document.createElement('strong');
        title.textContent = post.title;
        const excerpt = document.createElement('p');
        const position = post.text.toLocaleLowerCase().indexOf(words[0]);
        const start = Math.max(0, position - 30);
        excerpt.textContent = (start ? '…' : '') + post.text.slice(start, start + 120) + (post.text.length > start + 120 ? '…' : '');
        link.append(title, excerpt);
        item.append(link);
        results.append(item);
      }
    } catch (_) {
      if (version !== searchVersion) return;
      status.textContent = '搜索暂时无法加载，请检查网络后重试。';
      retry.hidden = false;
    }
  }

  function openSearch() {
    setMenu(false);
    if (!dialog.open) dialog.showModal();
    input.focus();
    if (input.value.trim()) search();
  }
  document.querySelectorAll('[data-open-search]').forEach((button) => {
    button.addEventListener('click', openSearch);
    button.hidden = false;
  });
  document.querySelector('[data-close-search]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => { searchVersion++; });
  input.addEventListener('input', search);
  // Search inputs consume Escape to clear their value in Chromium; close in one press.
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    dialog.close();
  });
  retry.addEventListener('click', search);
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    openSearch();
  });

  const imageDialog = document.querySelector('#image-dialog');
  if (imageDialog) {
    const preview = imageDialog.querySelector('img');
    const caption = imageDialog.querySelector('figcaption');
    imageDialog.querySelector('[data-close-image]').addEventListener('click', () => imageDialog.close());
    imageDialog.addEventListener('click', (event) => { if (event.target === imageDialog) imageDialog.close(); });
    imageDialog.addEventListener('close', () => preview.removeAttribute('src'));
    document.querySelectorAll('.markdown-body img').forEach((image) => {
      function enablePreview() {
        if (!image.naturalWidth || image.closest('a, button')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'image-preview';
        button.setAttribute('aria-label', '放大图片：' + (image.alt || '文章图片'));
        image.before(button);
        button.append(image);
        button.addEventListener('click', () => {
          preview.src = image.currentSrc || image.src;
          preview.alt = image.alt;
          caption.textContent = image.alt;
          imageDialog.showModal();
        });
      }
      image.addEventListener('load', enablePreview);
      enablePreview();
    });
  }

  // Copy only code, excluding the line-number gutter.
  document.querySelectorAll('.markdown-body figure.highlight, .markdown-body > pre').forEach((block) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-code';
    button.textContent = '复制代码';
    button.setAttribute('aria-live', 'polite');
    const code = block.querySelector('.code pre, code') || block;
    const text = code.textContent;
    let resetTimer;
    button.addEventListener('click', async () => {
      window.clearTimeout(resetTimer);
      try { await navigator.clipboard.writeText(text); button.textContent = '已复制'; }
      catch (_) { button.textContent = '复制失败，请手动选择'; }
      resetTimer = window.setTimeout(() => { button.textContent = '复制代码'; }, 2000);
    });
    block.prepend(button);
  });
})();
