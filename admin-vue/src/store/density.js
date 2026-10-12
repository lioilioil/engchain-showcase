import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// 密度三档：comfortable / compact / ultra
export const DENSITY_LEVELS = {
  comfortable: { label: '舒适', scale: 1 },
  compact: { label: '紧凑', scale: 0.85 },
  ultra: { label: '极紧', scale: 0.72 }
}

const STORAGE_KEY = 'engchain_density'

export const useDensityStore = defineStore('density', () => {
  const level = ref(localStorage.getItem(STORAGE_KEY) || 'comfortable')

  function apply(lv) {
    document.documentElement.setAttribute('data-density', lv)
    document.documentElement.style.setProperty('--density-scale', DENSITY_LEVELS[lv].scale)
  }

  function setLevel(lv) {
    if (!DENSITY_LEVELS[lv]) return
    level.value = lv
    localStorage.setItem(STORAGE_KEY, lv)
    apply(lv)
  }

  // 初始化
  apply(level.value)
  watch(level, setLevel)

  return { level, setLevel, levels: DENSITY_LEVELS }
})
