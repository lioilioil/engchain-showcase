<template>
  <div class="u-orders">
    <div class="u-orders__head">
      <h1 class="u-orders__title">我的订单</h1>
      <div class="u-orders__sub">查看你发起和参与的所有订单。</div>
    </div>

    <div class="tabs">
      <button class="tabs__item" :class="{ 'is-active': tab === 'all' }" @click="tab = 'all'">全部</button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'active' }" @click="tab = 'active'">进行中</button>
      <button class="tabs__item" :class="{ 'is-active': tab === 'done' }" @click="tab = 'done'">已完成</button>
    </div>

    <div v-if="!filtered.length" class="card empty-card">
      <EmptyState title="暂无订单" desc="当你发起或参与订单后会显示在这里" action-text="去发布" @action="$router.push('/u/publish')" />
    </div>

    <div v-for="o in filtered" :key="o.id" class="card order-card" @click="onView(o)">
      <div class="order-card__main">
        <div class="order-card__title">{{ o.title || o.desc || o.id }}</div>
        <div class="order-card__meta">
          <span>订单号 {{ o.id }}</span>
          <span>·</span>
          <span>¥{{ Number(o.amount || 0).toLocaleString() }}</span>
          <span>·</span>
          <span>{{ fmtDate(o.createdAt || o.ts) }}</span>
        </div>
      </div>
      <span class="tag" :class="statusClass(o.state)">{{ statusLabel(o.state) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useBus } from '@/composables/useLegacyBus';
import EmptyState from '@/components/EmptyState.vue';

const { bus } = useBus();
const orders = ref<any[]>([]);
const tab = ref<'all' | 'active' | 'done'>('all');

const statusLabel = (s: string) => {
  const m: Record<string, string> = { done: '已完成', serving: '进行中', await_accept: '待接受', pending: '待付款', disputed: '纠纷', cancelled: '已取消', refunded: '已退款' };
  return m[s] || s;
};
const statusClass = (s: string) => {
  const m: Record<string, string> = { done: 'tag--green', serving: 'tag--blue', await_accept: 'tag--yellow', pending: 'tag--yellow', disputed: 'tag--red', cancelled: 'tag--gray', refunded: 'tag--gray' };
  return m[s] || 'tag--gray';
};
function fmtDate(ts: any) {
  if (!ts) return '';
  if (typeof ts === 'number') return new Date(ts).toISOString().slice(0, 10);
  return String(ts).slice(0, 10);
}

const filtered = computed(() => {
  if (tab.value === 'active') return orders.value.filter((o: any) => o.state === 'serving' || o.state === 'await_accept' || o.state === 'pending');
  if (tab.value === 'done') return orders.value.filter((o: any) => o.state === 'done' || o.state === 'cancelled' || o.state === 'refunded');
  return orders.value;
});

function onView(o: any) {
  // 后续可跳订单详情
}

onMounted(() => {
  orders.value = bus()?.orders?.() || [];
});
</script>

<style scoped>
.u-orders { max-width: 800px; }
.u-orders__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.u-orders__sub { font-size: var(--font-size-md); color: var(--font-tertiary); margin: 4px 0 20px; }
.tabs { display: flex; gap: 4px; margin-bottom: 16px; }
.tabs__item {
  padding: 6px 16px; border-radius: var(--radius-sm);
  background: transparent; border: none; color: var(--font-secondary);
  font-size: var(--font-size-md); cursor: pointer;
}
.tabs__item.is-active { background: var(--bg-secondary); color: var(--font-primary); font-weight: var(--font-weight-medium); }
.empty-card { padding: 0; }
.order-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px; margin-bottom: 8px; cursor: pointer;
  transition: border-color var(--duration-fast) ease;
}
.order-card:hover { border-color: var(--color-blue); }
.order-card__title { font-size: var(--font-size-md); font-weight: var(--font-weight-medium); color: var(--font-primary); margin-bottom: 4px; }
.order-card__meta { font-size: var(--font-size-sm); color: var(--font-tertiary); display: flex; gap: 6px; }
</style>
