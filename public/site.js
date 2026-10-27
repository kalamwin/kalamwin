// Tiny public-page runtime: records a view and a click per tracked element.
(function () {
  if (document.body.dataset.preview) return;

  function beacon(payload) {
    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/click', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/click', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
      }
    } catch { /* analytics must never break the page */ }
  }

  beacon({ view: true });

  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-track]');
    if (el) beacon({ id: el.dataset.track });
  }, { passive: true, capture: true });
})();
