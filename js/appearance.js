(() => {
  'use strict';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const storageKey = 'Fluid_Color_Scheme'; // Preserve preferences from the previous theme.
  let choice;
  try { choice = localStorage.getItem(storageKey); } catch (_) { /* Storage is optional. */ }
  if (!['light', 'dark'].includes(choice)) choice = null;

  function apply() {
    const dark = (choice || (media.matches ? 'dark' : 'light')) === 'dark';
    root.dataset.userColorScheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#101012' : '#ffffff';
    document.dispatchEvent(new Event('hpkp:appearance'));
  }

  window.hpkpAppearance = {
    toggle() {
      choice = root.dataset.userColorScheme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(storageKey, choice); } catch (_) { /* Keep the in-memory choice. */ }
      apply();
    }
  };
  media.addEventListener('change', () => { if (!choice) apply(); });
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    choice = ['light', 'dark'].includes(event.newValue) ? event.newValue : null;
    apply();
  });
  apply();
})();
