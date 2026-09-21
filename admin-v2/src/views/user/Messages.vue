<template>
  <div class="u-msgs">
    <div class="u-msgs__head">
      <h1 class="u-msgs__title">消息中心</h1>
      <div class="u-msgs__sub">系统通知、订单动态和聊天消息。</div>
    </div>

    <div v-if="!(messages || []).length" class="card empty-card">
      <EmptyState title="暂无消息" desc="有新消息时会显示在这里" />
    </div>

    <div v-for="m in messages" :key="m.id" class="card msg-item" :class="{ 'is-unread': !m.read }" @click="onRead(m)">
      <div class="msg-item__avatar" :style="{ background: avatarColor(m.sender) }">
        {{ (m.sender || '?').charAt(0).toUpperCase() }}
      </div>
      <div class="msg-item__body">
        <div class="msg-item__head">
          <span class="msg-item__sender">{{ m.sender || '系统通知' }}</span>
          <span class="msg-item__time">{{ fmtTime(m.ts) }}</span>
        </div>
        <div class="msg-item__content">{{ m.content }}</div>
      </div>
      <div v-if="!m.read" class="msg-item__dot" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useBus } from '@/composables/useLegacyBus';
import EmptyState from '@/components/EmptyState.vue';

const { bus } = useBus();
const messages = ref<any[]>([]);

function avatarColor(name: string) {
  const colors = ['#1961ed', '#0d9488', '#d97706', '#7c3aed', '#db2777'];
  let hash = 0;
  const n = String(name || 'system');
  for (let i = 0; i < n.length; i++) hash = n.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
function fmtTime(ts: any) {
  if (!ts) return '';
  if (typeof ts === 'number') {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return String(ts).slice(5, 16);
}
function onRead(m: any) {
  m.read = true;
}

onMounted(() => {
  const raw = bus()?.messages?.() || [];
  messages.value = Array.isArray(raw) ? raw.slice(0, 50) : [];
});
</script>

<style scoped>
.u-msgs { max-width: 720px; }
.u-msgs__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.u-msgs__sub { font-size: var(--font-size-md); color: var(--font-tertiary); margin: 4px 0 20px; }
.empty-card { padding: 0; }
.msg-item {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 16px; margin-bottom: 8px; cursor: pointer;
  transition: background var(--duration-fast) ease;
}
.msg-item:hover { background: var(--bg-secondary); }
.msg-item.is-unread { background: rgba(25,97,237,0.03); }
.msg-item__avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 14px; font-weight: 600; flex-shrink: 0;
}
.msg-item__body { flex: 1; min-width: 0; }
.msg-item__head { display: flex; justify-content: space-between; margin-bottom: 4px; }
.msg-item__sender { font-size: var(--font-size-md); font-weight: var(--font-weight-medium); color: var(--font-primary); }
.msg-item__time { font-size: var(--font-size-xs); color: var(--font-light); }
.msg-item__content { font-size: var(--font-size-md); color: var(--font-secondary); line-height: 1.5; }
.msg-item__dot {
  width: 8px; height: 8px; border-radius: 50%; background: #1961ed;
  flex-shrink: 0; margin-top: 6px;
}
</style>
