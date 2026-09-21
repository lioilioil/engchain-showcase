<template>
  <teleport to="body">
    <Transition name="cmk">
      <div v-if="visible" class="cmk-overlay" @click="close">
        <div class="cmk-panel" @click.stop>
        <input
          ref="inputRef"
          v-model="query"
          class="cmk-input"
          placeholder="跳转或搜索…"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="pick"
          @keydown.esc="close"
        />
        <div class="cmk-list">
          <div
            v-for="(item, i) in filtered"
            :key="item.path"
            class="cmk-item"
            :class="{ 'is-active': i === activeIndex }"
            @mouseenter="activeIndex = i"
            @click="go(item)"
          >
            <span class="cmk-item-label">{{ item.label }}</span>
            <span class="cmk-item-path">{{ item.path }}</span>
          </div>
          <div v-if="!filtered.length" class="cmk-empty">无匹配结果</div>
        </div>
        </div>
      </div>
    </Transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits(['update:visible']);
const router = useRouter();
const inputRef = ref<HTMLInputElement | null>(null);

const query = ref('');
const activeIndex = ref(0);

const allItems = [
  { label: '数据总览', path: '/admin/dashboard' },
  { label: '客户公司', path: '/admin/customer/companies' },
  { label: '联系人', path: '/admin/customer/people' },
  { label: '商机', path: '/admin/customer/opportunities' },
  { label: '钱包总览', path: '/admin/finance/wallet' },
  { label: '提现审批', path: '/admin/finance/withdraw' },
  { label: '个人工作台', path: '/u/dashboard' },
  { label: '发布中心', path: '/u/publish' },
  { label: '消息', path: '/u/messages' },
];

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return allItems;
  return allItems.filter((i) => i.label.toLowerCase().includes(q) || i.path.toLowerCase().includes(q));
});

watch(
  () => props.visible,
  async (v) => {
    if (v) {
      query.value = '';
      activeIndex.value = 0;
      await nextTick();
      inputRef.value?.focus();
    }
  }
);

function move(d: number) {
  const len = filtered.value.length;
  if (!len) return;
  activeIndex.value = (activeIndex.value + d + len) % len;
}
function go(item: { path: string }) {
  router.push(item.path);
  close();
}
function pick() {
  const item = filtered.value[activeIndex.value];
  if (item) go(item);
}
function close() {
  emit('update:visible', false);
}
</script>

<style scoped>
.cmk-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-transparent-strong);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  z-index: 1500;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
}
.cmk-panel {
  width: 640px;
  max-width: 90vw;
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-medium);
  box-shadow: var(--shadow-super-heavy);
  overflow: hidden;
}
.cmk-input {
  width: 100%;
  padding: 14px 16px;
  border: none;
  border-bottom: 1px solid var(--border-medium);
  background: transparent;
  font-size: var(--font-size-lg);
  outline: none;
  color: var(--font-primary);
}
.cmk-list {
  max-height: 360px;
  overflow-y: auto;
  padding: 4px;
}
.cmk-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  color: var(--font-primary);
}
.cmk-item.is-active {
  background: var(--accent-tertiary);
}
.cmk-item-path {
  font-size: var(--font-size-xs);
  color: var(--font-tertiary);
}
.cmk-empty {
  padding: 24px;
  text-align: center;
  color: var(--font-tertiary);
  font-size: var(--font-size-sm);
}

/* 命令菜单动画：backdrop 淡入，panel 缩放淡入 */
.cmk-enter-active {
  transition: opacity var(--duration-fast) ease;
}
.cmk-enter-active .cmk-panel {
  transition: transform var(--duration-fast) ease, opacity var(--duration-fast) ease;
}
.cmk-leave-active {
  transition: opacity var(--duration-fast) ease;
}
.cmk-leave-active .cmk-panel {
  transition: transform var(--duration-fast) ease, opacity var(--duration-fast) ease;
}
.cmk-enter-from,
.cmk-leave-to {
  opacity: 0;
}
.cmk-enter-from .cmk-panel,
.cmk-leave-to .cmk-panel {
  transform: scale(0.96) translateY(-8px);
  opacity: 0;
}
</style>
