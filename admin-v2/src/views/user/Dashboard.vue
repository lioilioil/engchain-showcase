<template>
  <div class="u-dash">
    <div class="u-dash__head">
      <h1 class="u-dash__title">工作台</h1>
      <div class="u-dash__sub">欢迎回来，{{ userName }}。快速开始你的工作。</div>
    </div>

    <div class="u-dash__quick">
      <router-link to="/u/publish" class="quick-card">
        <div class="quick-card__icon"><AppIcon name="plus" :size="20" /></div>
        <div class="quick-card__title">发布供需</div>
        <div class="quick-card__desc">发布新的需求或供应信息</div>
      </router-link>
      <router-link to="/u/orders" class="quick-card">
        <div class="quick-card__icon"><AppIcon name="file" :size="20" /></div>
        <div class="quick-card__title">我的订单</div>
        <div class="quick-card__desc">查看进行中和历史订单</div>
      </router-link>
      <router-link to="/u/messages" class="quick-card">
        <div class="quick-card__icon"><AppIcon name="message" :size="20" /></div>
        <div class="quick-card__title">消息通知</div>
        <div class="quick-card__desc">查看系统消息和聊天记录</div>
      </router-link>
      <router-link to="/u/finance" class="quick-card">
        <div class="quick-card__icon"><AppIcon name="currency-dollar" :size="20" /></div>
        <div class="quick-card__title">我的财务</div>
        <div class="quick-card__desc">充值提现和收支明细</div>
      </router-link>
    </div>

    <!-- 待办事项 -->
    <div class="card todo-card">
      <div class="card__title">待办事项</div>
      <div v-if="!todos.length" class="empty-mini">全部完成，没有待办事项</div>
      <div v-for="t in todos" :key="t.id" class="todo-row">
        <span class="todo-dot" :class="t.level"></span>
        <span class="todo-text">{{ t.text }}</span>
        <span class="tag" :class="t.level === 'urgent' ? 'tag--red' : t.level === 'warning' ? 'tag--yellow' : 'tag--blue'">{{ t.tag }}</span>
      </div>
    </div>

    <div class="u-dash__grid">
      <div class="card">
        <div class="card__title">我的供需</div>
        <div v-if="!mySupply.length" class="empty-mini">还没有发布供需，<router-link to="/u/publish" class="link">去发布</router-link></div>
        <div v-for="s in mySupply" :key="s.id" class="list-row">
          <div class="list-row__main">{{ s.title }}</div>
          <div class="list-row__sub">{{ s.cat }} · ¥{{ s.amount }}</div>
          <span class="tag" :class="statusClass(s.status)">{{ statusLabel(s.status) }}</span>
        </div>
      </div>
      <div class="card">
        <div class="card__title">进行中订单</div>
        <div v-if="!activeOrders.length" class="empty-mini">暂无进行中订单</div>
        <div v-for="o in activeOrders" :key="o.id" class="list-row">
          <div class="list-row__main">{{ o.title || o.desc || o.id }}</div>
          <div class="list-row__sub">¥{{ Number(o.amount || 0).toLocaleString() }}</div>
          <span class="tag tag--blue">{{ statusLabel(o.state) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useBus, useBusWatch } from '@/composables/useLegacyBus';
import AppIcon from '@/components/AppIcon.vue';

const { bus } = useBus();
const userName = ref('');
const mySupply = ref<any[]>([]);
const activeOrders = ref<any[]>([]);
const todos = ref([
  { id: 1, text: '有 2 条供需信息等待审核', level: 'urgent', tag: '审核' },
  { id: 2, text: '订单 ORD-2024-001 待验收', level: 'warning', tag: '订单' },
  { id: 3, text: '企业认证资料待提交', level: 'info', tag: '认证' },
]);

const statusLabel = (s: string) => {
  const m: Record<string, string> = { pending_review: '待审核', active: '已上架', off: '已下架', rejected: '已驳回', done: '已完成', serving: '进行中', await_accept: '待接受', pending: '待付款', disputed: '纠纷', cancelled: '已取消' };
  return m[s] || s;
};
const statusClass = (s: string) => {
  const m: Record<string, string> = { pending_review: 'tag--yellow', active: 'tag--green', off: 'tag--gray', rejected: 'tag--red', done: 'tag--green', serving: 'tag--blue', await_accept: 'tag--yellow', pending: 'tag--yellow', disputed: 'tag--red', cancelled: 'tag--gray' };
  return m[s] || 'tag--gray';
};

function load() {
  const cur = bus()?.current?.();
  if (cur) userName.value = cur.name || '用户';
  const allSupply = bus()?.supply?.() || [];
  mySupply.value = allSupply.filter((s: any) => s.publisher === cur?.name).slice(0, 5);
  const allOrders = bus()?.orders?.() || [];
  activeOrders.value = allOrders.filter((o: any) => o.state === 'serving' || o.state === 'await_accept').slice(0, 5);
}

let stopWatch: (() => void) | null = null;
onMounted(() => { load(); stopWatch = useBusWatch(load); });
onUnmounted(() => { stopWatch?.(); });
</script>

<style scoped>
.u-dash { display: flex; flex-direction: column; gap: 20px; max-width: 960px; }
.u-dash__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.u-dash__sub { font-size: var(--font-size-md); color: var(--font-tertiary); margin-top: 4px; }
.u-dash__quick { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.quick-card {
  padding: 20px;
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  text-decoration: none;
  transition: all var(--duration-fast) ease;
}
.quick-card:hover { border-color: var(--color-blue); transform: translateY(-2px); }
.quick-card__icon {
  width: 40px; height: 40px; border-radius: 10px;
  background: rgba(25,97,237,0.1); color: var(--color-blue);
  display: flex; align-items: center; justify-content: center; margin-bottom: 12px;
}
.quick-card__title { font-size: var(--font-size-lg); font-weight: var(--font-weight-medium); color: var(--font-primary); margin-bottom: 4px; }
.quick-card__desc { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.u-dash__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.u-dash__grid .card { padding: 16px; }
.card__title { font-size: var(--font-size-lg); font-weight: var(--font-weight-medium); color: var(--font-primary); margin-bottom: 12px; }
.list-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-light); font-size: var(--font-size-md); }
.list-row:last-child { border-bottom: none; }
.list-row__main { flex: 1; color: var(--font-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list-row__sub { color: var(--font-tertiary); font-size: var(--font-size-sm); }
.todo-card { padding: 16px; }
.todo-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--border-light); }
.todo-row:last-child { border-bottom: none; }
.todo-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.todo-dot.urgent { background: #dc2626; }
.todo-dot.warning { background: #d97706; }
.todo-dot.info { background: #2563eb; }
.todo-text { flex: 1; font-size: var(--font-size-md); color: var(--font-primary); }
.empty-mini { padding: 24px; text-align: center; color: var(--font-light); font-size: var(--font-size-md); }
.link { color: var(--color-blue); text-decoration: none; }
@media (max-width: 768px) {
  .u-dash__quick { grid-template-columns: 1fr; }
  .u-dash__grid { grid-template-columns: 1fr; }
}
</style>
