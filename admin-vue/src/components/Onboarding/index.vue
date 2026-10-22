<template>
  <div v-if="visible" class="guide-mask">
    <div class="guide-card">
      <div class="guide-title">新手引导（{{ step + 1 }}/{{ steps.length }}）</div>
      <div class="guide-progress"><div class="guide-bar" :style="{ width: ((step + 1) / steps.length * 100) + '%' }"></div></div>
      <p class="guide-body">{{ steps[step] }}</p>
      <div class="guide-actions">
        <button class="g-btn" @click="skip">跳过</button>
        <button v-if="step > 0" class="g-btn" @click="step--">上一步</button>
        <button class="g-btn primary" @click="next">{{ step === steps.length - 1 ? '完成' : '下一步' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
const KEY = 'engchain_guide_done'
const steps = [
  '① 侧边导航：按业务分组折叠展开，权限菜单按角色过滤。',
  '② 批量操作：勾选多行后浮现批量导出/批量封禁，支持跨页选中。',
  '③ Cmd+K：按 ⌘/Ctrl+K 唤起全局搜索，键盘 ↑↓/Enter/Esc 操作。',
  '④ 密度设置：用户菜单切换舒适/紧凑/极紧三档，即时生效。'
]
const visible = ref(false)
const step = ref(0)
onMounted(() => {
  if (!localStorage.getItem(KEY)) visible.value = true
})
function done() {
  localStorage.setItem(KEY, '1')
  visible.value = false
}
function skip() { done() }
function next() {
  if (step.value >= steps.length - 1) done()
  else step.value++
}
</script>

<style scoped>
.guide-mask { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 3000; display: flex; align-items: center; justify-content: center; }
.guide-card { background: #fff; border-radius: 10px; padding: 24px; width: 360px; box-shadow: 0 10px 40px rgba(0,0,0,.2); }
.guide-title { font-weight: 600; margin-bottom: 10px; }
.guide-progress { height: 6px; background: #eee; border-radius: 3px; overflow: hidden; margin-bottom: 14px; }
.guide-bar { height: 100%; background: #1f2a44; transition: width .2s; }
.guide-body { color: #333; line-height: 1.6; margin-bottom: 16px; }
.guide-actions { display: flex; gap: 8px; justify-content: flex-end; }
.g-btn { padding: 6px 12px; border: 1px solid #ddd; border-radius: 6px; background: #fff; cursor: pointer; }
.g-btn.primary { background: #1f2a44; color: #fff; border-color: #1f2a44; }
</style>
