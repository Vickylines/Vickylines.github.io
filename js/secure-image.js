(() => {
  /*
   * 浏览器端加密图片解锁器。
   * 页面只公开密文 JSON；读者输入密码后，浏览器在本地派生密钥并解密，密码不会上传。
   * 注意：这是“凭密码阅读”的静态站点方案，不等同于有登录权限控制的私有存储。
   */
  const encoder = new TextEncoder();
  const encryptedFiles = new Map();

  // 加密 JSON 用 Base64 保存二进制字段，这里把它还原为 Web Crypto 可接收的字节数组。
  const base64ToBytes = (value) => {
    const binary = atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  };

  // 使用 JSON 中记录的盐值和迭代次数，从密码派生 AES-256-GCM 密钥并解出原图字节。
  async function decryptImage(password, encrypted) {
    // importKey 只导入密码原料；真正的 AES 密钥在下一步通过 PBKDF2 派生。
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey({
      name: 'PBKDF2',
      salt: base64ToBytes(encrypted.salt),
      iterations: encrypted.iterations,
      hash: 'SHA-256',
    }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    // Web Crypto 要求 GCM 认证标签接在密文末尾，所以需要把两个字段重新拼起来。
    const ciphertext = base64ToBytes(encrypted.ciphertext);
    const tag = base64ToBytes(encrypted.tag);
    const data = new Uint8Array(ciphertext.length + tag.length);
    data.set(ciphertext);
    data.set(tag, ciphertext.length);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(encrypted.iv) }, key, data);
  }

  // 同一密文只下载一次；网络失败会清掉缓存，下一次提交仍可重试。
  function loadEncrypted(url) {
    if (!encryptedFiles.has(url)) {
      const request = fetch(url, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error('Could not load encrypted image');
          return response.json();
        })
        .catch((error) => {
          encryptedFiles.delete(url);
          throw error;
        });
      encryptedFiles.set(url, request);
    }
    return encryptedFiles.get(url);
  }

  // 一页可以放多张加密图，每个带 data-secure-image 的容器独立绑定自己的表单。
  for (const container of document.querySelectorAll('[data-secure-image]')) {
    const form = container.querySelector('form');
    const input = container.querySelector('input[type="password"]');
    const error = container.querySelector('[data-secure-image-error]');
    const image = container.querySelector('img');
    const button = container.querySelector('button');
    const encryptedUrl = container.dataset.secureImage;
    if (!form || !input || !error || !image || !button || !encryptedUrl || container.dataset.secureImageReady) {
      continue;
    }
    container.dataset.secureImageReady = 'true';
    let objectUrl = '';
    let unlocking = false;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (unlocking) return;
      unlocking = true;
      error.hidden = true;
      button.disabled = true;
      try {
        const encrypted = await loadEncrypted(encryptedUrl);
        const bytes = await decryptImage(input.value, encrypted);
        // 用内存中的 Blob 显示解密结果，不把明文图片写回站点目录或 localStorage。
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: container.dataset.imageType || 'image/png' }));
        image.src = objectUrl;
        image.hidden = false;
        input.value = '';
      } catch (_) {
        // 密码错误、密文损坏和网络失败对访客统一显示为解锁失败，避免泄露内部细节。
        error.hidden = false;
      } finally {
        unlocking = false;
        button.disabled = false;
      }
    });

    window.addEventListener('pagehide', (event) => {
      // 进入 bfcache 时页面仍会恢复使用；只有真正离开才释放当前明文 Blob。
      if (event.persisted) return;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = '';
    });
  }
})();
