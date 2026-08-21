/* 延长叙事节奏入口：新文件名与查询版本共同绕过浏览器及 CDN 的旧动画缓存。 */
(function() {
  'use strict';
  var script = document.createElement('script');
  script.src = '/js/organism-v5.js?rev=20260815-extended-narrative-v1';
  script.async = false;
  document.head.appendChild(script);
})();
