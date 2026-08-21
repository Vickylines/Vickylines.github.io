(function() {
  'use strict';

  /*
   * 博客文章的稳定互动层：负责浏览量、点赞和评论。
   *
   * 这一层故意与视觉皮肤分开。数据库里的旧数据用“完整 pathname + 访客编号”
   * 定位，因此换主题时不要改 RPC 名、参数名、localStorage 键名，也不要随意
   * 更改文章永久链接或末尾斜杠，否则历史浏览、点赞和评论会被当成另一篇文章。
   */
  var CLOUD_CONFIG = {
    url: 'https://qjtwjkylnzgsbmovnweo.supabase.co',
    publishableKey: 'sb_publishable_zEWw-_oMnu7HARuu8vqqkA_n8J8uo05'
  };

  // 创建一个 DOM 元素，并按需补上类名和纯文本。使用 textContent 可避免把用户内容当成 HTML。
  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  }

  // 判断当前是否为本机或局域网预览。预览时禁止写云端，避免调试刷新污染真实统计。
  function isLocalPreview() {
    var host = window.location.hostname;
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host) || /\.(local|lan)$/i.test(host)) return true;
    if (/^(10\.|192\.168\.)/.test(host)) return true;
    var parts = host.split('.').map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    }
    return false;
  }

  function isUuid(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
  }

  // 取得本设备的匿名访客编号。它只用于防止重复计数，不包含账号或真实身份信息。
  function visitorId() {
    var key = 'hpkp-cloud-visitor-id';
    var existing = null;

    try {
      existing = window.localStorage.getItem(key);
    } catch (error) {
      // 无痕模式可能禁止本地存储；这种情况下本次访问使用临时编号即可。
    }

    // 损坏或被手动改写的 localStorage 值不能永久拖垮所有 RPC；重新生成合法 UUID 即可。
    if (isUuid(existing)) return existing;

    var value = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(character) {
        var random = Math.floor(Math.random() * 16);
        return (character === 'x' ? random : (random & 3) | 8).toString(16);
      });

    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      // 写入失败时仍返回刚生成的编号，至少保证当前页面可以继续工作。
    }

    return value;
  }

  // 调用 Supabase 的数据库函数。name 和 payload 字段属于线上数据契约，不能随皮肤改名。
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

  // 把成功与失败都转换成普通结果，避免一个接口失败时丢掉另一个接口已经取得的数据。
  function settle(promise) {
    return promise.then(function(value) {
      return { ok: true, value: value };
    }, function(error) {
      return { ok: false, error: error };
    });
  }

  // 只在文章页挂载互动区；重复执行时会通过 .post-pulse 提前退出，避免生成两套控件。
  function mountPostPulse() {
    var article = document.querySelector('article.post-content');
    if (!article || article.querySelector('.post-pulse')) return;

    // pathname 是数据库中的文章主键组成部分，必须保留原样（包括中文编码和末尾斜杠）。
    var path = window.location.pathname;
    var state = { views: 0, likes: 0, liked: false, comments: [] };
    var box = element('section', 'post-pulse');
    box.setAttribute('aria-label', '文章互动');
    box.innerHTML =
      '<div class="pulse-header">' +
        '<div><span class="pulse-kicker">RESPONSE CHANNEL</span><strong>回应这份记录</strong></div>' +
        '<span class="pulse-status">正在连接互动区…</span>' +
      '</div>' +
      '<div class="pulse-actions">' +
        '<button class="pulse-button" type="button" data-action="like" aria-pressed="false">♡ <span>喜欢 0</span></button>' +
        '<span class="pulse-button" aria-label="浏览量">◉ <span>浏览 0</span></span>' +
      '</div>' +
      '<form class="pulse-comment-form">' +
        '<p class="pulse-identity">以本设备的匿名代号发布 · 最多 500 字</p>' +
        '<textarea name="comment" maxlength="500" required placeholder="留下一个真实的回应…" aria-label="评论内容"></textarea>' +
        '<button class="pulse-submit" type="submit">发送回应 <span aria-hidden="true">↗</span></button>' +
      '</form>' +
      '<div class="pulse-comments" aria-live="polite"></div>';

    article.appendChild(box);

    var likeButton = box.querySelector('[data-action="like"]');
    var likeCount = likeButton.querySelector('span');
    var viewCount = box.querySelector('[aria-label="浏览量"] span');
    var comments = box.querySelector('.pulse-comments');
    var status = box.querySelector('.pulse-status');
    var form = box.querySelector('form');
    var textarea = form.querySelector('textarea');
    var submit = form.querySelector('button');

    // 初始状态返回前不接受写操作，避免旧的初始化结果覆盖用户刚完成的点赞或评论。
    likeButton.disabled = true;
    submit.disabled = true;

    // 统一更新连接/提交状态，方便读者知道操作是否真的同步成功。
    function setStatus(value) {
      status.textContent = value;
    }

    // 根据内存中的 state 一次性刷新点赞、浏览量和评论列表。
    function render() {
      likeCount.textContent = '喜欢 ' + state.likes;
      viewCount.textContent = '浏览 ' + state.views;
      likeButton.classList.toggle('is-liked', state.liked);
      likeButton.setAttribute('aria-pressed', String(state.liked));
      likeButton.firstChild.textContent = state.liked ? '♥ ' : '♡ ';
      comments.innerHTML = '';

      if (!state.comments.length) {
        comments.appendChild(element('p', 'pulse-empty', '频道里还没有回应。第一句可以很短。'));
        return;
      }

      state.comments.forEach(function(comment, index) {
        var item = element('article', 'pulse-comment');
        var createdAt = comment.created_at
          ? new Date(comment.created_at).toLocaleString('zh-CN', { hour12: false })
          : '';
        item.setAttribute('data-response', String(index + 1).padStart(2, '0'));
        item.appendChild(element(
          'div',
          'pulse-comment-meta',
          (comment.nickname || '匿名访客') + (createdAt ? ' · ' + createdAt : '')
        ));
        item.appendChild(element('div', 'pulse-comment-body', comment.content || ''));
        comments.appendChild(item);
      });
    }

    // 本地仍显示完整界面，但所有会写入线上数据库的控件都禁用。
    if (isLocalPreview()) {
      likeButton.disabled = true;
      textarea.disabled = true;
      submit.disabled = true;
      setStatus('LOCAL MODE · 不写入线上数据');
      render();
      return;
    }

    var id = visitorId();
    // 首次进入文章时并行登记浏览和读取评论；两项独立落地，部分失败也保留成功结果。
    Promise.all([
      settle(cloudRpc('record_blog_view', { p_post_path: path, p_visitor_id: id })),
      settle(cloudRpc('get_blog_comments', { p_post_path: path }))
    ]).then(function(results) {
      var statsResult = results[0];
      var commentsResult = results[1];

      if (statsResult.ok) {
        var statsRows = Array.isArray(statsResult.value) ? statsResult.value : [];
        var stats = statsRows[0] || {};
        state.views = Number(stats.view_count || 0);
        state.likes = Number(stats.like_count || 0);
        state.liked = Boolean(stats.liked);
      }
      if (commentsResult.ok) {
        state.comments = Array.isArray(commentsResult.value) ? commentsResult.value : [];
      }

      setStatus(statsResult.ok && commentsResult.ok
        ? 'CHANNEL ONLINE'
        : (statsResult.ok || commentsResult.ok ? 'CHANNEL PARTIAL · 部分数据稍后重试' : 'CHANNEL OFFLINE · 稍后再试'));
      render();
      likeButton.disabled = false;
      submit.disabled = false;
    });

    // 点赞采用“切换”语义：同一设备再次点击会取消点赞。
    likeButton.addEventListener('click', async function() {
      likeButton.disabled = true;
      try {
        var result = await cloudRpc('toggle_blog_like', {
          p_post_path: path,
          p_visitor_id: id
        });
        var data = result[0] || {};
        state.liked = Boolean(data.liked);
        state.likes = Number(data.like_count || 0);
        setStatus('已同步');
        render();
      } catch (error) {
        setStatus('喜欢未能同步 · 稍后再试');
      } finally {
        likeButton.disabled = false;
      }
    });

    // 提交评论成功后重新拉取列表，以数据库结果为准，不在前端伪造成功状态。
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
        setStatus('回应已公开 · 正在刷新列表…');
        try {
          state.comments = await cloudRpc('get_blog_comments', { p_post_path: path });
          setStatus('回应已公开');
          render();
        } catch (refreshError) {
          // 写入已经成功，刷新失败不能误报为“提交失败”，否则用户重试会产生重复评论。
          setStatus('回应已公开 · 列表稍后刷新');
        }
      } catch (error) {
        var message = String(error);
        setStatus(/blocked content/i.test(message)
          ? '内容未能发布 · 请调整后再试'
          : (/rate limit/i.test(message) ? '发送太快 · 请稍后再试' : '回应提交失败 · 稍后再试'));
      } finally {
        submit.disabled = false;
      }
    });
  }

  // 脚本可能位于页面底部，也可能被提前加载；两种情况下都只在 DOM 可用后启动。
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountPostPulse);
  } else {
    mountPostPulse();
  }
})();
