/*
 * 视觉引擎使用独立、带版本号的请求。主题的 custom_js 会自动补 .js，
 * 因而版本参数只能在这里附加，不能直接写进主题配置。
 */
(function() {
  'use strict';
  var script = document.createElement('script');
  script.src = '/js/organism-v5.js?rev=20260815-static-frame-v2';
  script.async = false;
  document.head.appendChild(script);
})();
