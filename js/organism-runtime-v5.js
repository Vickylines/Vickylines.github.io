/* 克制动效入口：新文件名与查询版本共同绕过浏览器及 CDN 的旧回弹缓存。 */
(function() {
  'use strict';
  var script = document.createElement('script');
  script.src = '/js/organism-v5.js?rev=20260816-menu-spring-only-v4';
  script.async = false;
  document.head.appendChild(script);
})();
