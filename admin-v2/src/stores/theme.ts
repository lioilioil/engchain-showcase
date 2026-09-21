import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

type ThemeMode = 'light' | 'dark' | 'system';

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  let resolved = mode;
  if (mode === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  root.setAttribute('data-theme', resolved);
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>((localStorage.getItem('engchain-console-theme') as ThemeMode) || 'light');

  function setMode(m: ThemeMode) {
    mode.value = m;
    localStorage.setItem('engchain-console-theme', m);
  }

  function toggle() {
    setMode(mode.value === 'dark' ? 'light' : 'dark');
  }

  watch(mode, applyTheme, { immediate: true });

  if (mode.value === 'system') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme('system'));
  }

  return { mode, setMode, toggle };
});
