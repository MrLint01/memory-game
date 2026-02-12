(() => {
  const includes = Array.from(document.querySelectorAll('[data-include]'));

  const injectIncludes = async () => {
    await Promise.all(
      includes.map(async (el) => {
        const src = el.getAttribute('data-include');
        if (!src) return;
        const res = await fetch(src, { cache: 'no-cache' });
        if (!res.ok) {
          throw new Error(`Failed to load ${src}: ${res.status}`);
        }
        const html = await res.text();
        el.outerHTML = html;
      })
    );
  };

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const cacheBust = Date.now();
      script.src = src.includes('?') ? `${src}&v=${cacheBust}` : `${src}?v=${cacheBust}`;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });

  const scriptList = [
    'data.js',
    'stages-instructions.js',
    'stages-data.js',
    'stages-mode.js',
    'app-core.js',
    'modifiers/background-color.js',
    'modifiers/misleading-colors.js',
    'modifiers/math-ops.js',
    'modifiers/glitch.js',
    'modifiers/fog.js',
    'modifiers/ads.js',
    'modifiers/swap.js',
    'modifiers/platformer.js',
    'app-game.js',
    'app-events.js'
  ];

  (async () => {
    try {
      await injectIncludes();
    } catch (error) {
      console.error(error);
    }
    for (const src of scriptList) {
      await loadScript(src);
    }
  })();
})();
