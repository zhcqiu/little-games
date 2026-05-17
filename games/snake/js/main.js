// main.js — 入口与主循环（后续 Task 逐步填）
console.log('snake main loaded');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = new URL('../../../sw.js', import.meta.url);
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.warn('SW 注册失败：', err);
    });
  });
}
