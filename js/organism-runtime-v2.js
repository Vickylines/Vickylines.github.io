/* 四阶段叙事动效入口：独立文件名与查询版本共同绕过旧的 Canvas 缓存。 */
(function() {
  'use strict';
  var script = document.createElement('script');
  script.src = '/js/organism-v5.js?rev=20260815-four-phase-scenes-v1';
  script.async = false;
  document.head.appendChild(script);
})();
