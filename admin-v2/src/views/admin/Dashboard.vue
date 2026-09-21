<template>
  <div class="dash">
    <div class="dash__header">
      <div>
        <div class="dash__eyebrow">总览</div>
        <h1 class="dash__title">数据总览</h1>
        <div class="dash__subtitle">欢迎回来，{{ userName }}。这里是你当前业务的关键指标。</div>
      </div>
    </div>

    <div class="dash__kpis">
      <div v-for="k in kpis" :key="k.label" class="card kpi" :class="{ clickable: k.link }" @click="k.link && go(k.link)">
        <div class="kpi__label">{{ k.label }}</div>
        <div class="kpi__value">{{ k.value }}</div>
        <div class="kpi__hint">{{ k.hint }}</div>
        <div v-if="k.link" class="kpi__arrow">→</div>
      </div>
    </div>

    <div class="dash__charts">
      <div class="card chart-card">
        <div class="card__title">营收趋势（近 7 日）</div>
        <div ref="revenueChart" class="chart" />
      </div>
      <div class="card chart-card">
        <div class="card__title">订单状态分布</div>
        <div ref="orderChart" class="chart" />
      </div>
    </div>

    <div class="dash__bottom">
      <div class="card">
        <div class="card__title">最近订单</div>
        <div v-if="!recentOrders.length" class="empty-mini">暂无订单</div>
        <div v-for="o in recentOrders" :key="o.id" class="order-row clickable" @click="go('/admin/operations/orders')">
          <span class="order-id">{{ o.id }}</span>
          <span class="order-title">{{ o.title || o.desc || '—' }}</span>
          <span class="order-amount">¥{{ Number(o.amount || 0).toLocaleString() }}</span>
          <span class="tag" :class="statusClass(o.state)">{{ statusLabel(o.state) }}</span>
        </div>
      </div>
      <div class="card">
        <div class="card__title">待办事项</div>
        <div v-if="!todos.length" class="empty-mini">全部处理完毕</div>
        <div v-for="t in todos" :key="t.label" class="todo-row">
          <span class="todo-label">{{ t.label }}</span>
          <span class="tag" :class="t.count > 0 ? 'tag--yellow' : 'tag--gray'">{{ t.count }}</span>
        </div>
      </div>
    </div>

    <!-- 用户转化漏斗 -->
    <div class="card funnel-card">
      <div class="card-title">用户转化漏斗</div>
      <div class="funnel">
        <div class="funnel-row">
          <div class="funnel-bar" style="width:100%;background:#2563eb">
            <span class="funnel-label">注册用户</span>
            <span class="funnel-count">8</span>
          </div>
        </div>
        <div class="funnel-row">
          <div class="funnel-bar" style="width:87.5%;background:#0891b2">
            <span class="funnel-label">完成实名</span>
            <span class="funnel-count">7 (87.5%)</span>
          </div>
        </div>
        <div class="funnel-row">
          <div class="funnel-bar" style="width:50%;background:#059669">
            <span class="funnel-label">企业认证</span>
            <span class="funnel-count">4 (50%)</span>
          </div>
        </div>
        <div class="funnel-row">
          <div class="funnel-bar" style="width:50%;background:#d97706">
            <span class="funnel-label">首单成交</span>
            <span class="funnel-count">4 (50%)</span>
          </div>
        </div>
        <div class="funnel-row">
          <div class="funnel-bar" style="width:50%;background:#dc2626">
            <span class="funnel-label">复购客户</span>
            <span class="funnel-count">4 (50%)</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import * as echarts from 'echarts';
import { useBus } from '@/composables/useLegacyBus';

const { bus } = useBus();
const userName = ref('管理员');
const recentOrders = ref<any[]>([]);

const revenueChart = ref<HTMLElement | null>(null);
const orderChart = ref<HTMLElement | null>(null);
let revenueInst: echarts.ECharts | null = null;
let orderInst: echarts.ECharts | null = null;

const kpis = computed(() => {
  const stats = bus()?.stats?.() || {};
  const users = bus()?.users?.() || [];
  const orders = bus()?.orders?.() || [];
  const supply = bus()?.supply?.() || [];
  const pendingSupply = supply.filter((s: any) => s.status === 'pending_review').length;
  const pendingWithdraw = bus()?.withdrawals?.()?.filter((w: any) => w.status === 'pending').length || 0;
  return [
    { label: '总用户', value: users.length - 1, hint: '游客不计', link: '/admin/crm/companies' },
    { label: '企业入驻', value: stats.resident || 0, hint: 'resident 身份', link: '/admin/crm/companies' },
    { label: '进行中订单', value: orders.filter((o: any) => o.status === 'serving' || o.status === 'await_accept').length, hint: '活跃交易', link: '/admin/operations/orders' },
    { label: '待审核', value: pendingSupply + pendingWithdraw, hint: '供需 + 提现', link: '/admin/operations/supply' },
  ];
});

const todos = computed(() => {
  const supply = bus()?.supply?.() || [];
  const withdrawals = bus()?.withdrawals?.() || [];
  const users = bus()?.users?.() || [];
  return [
    { label: '供需待审', count: supply.filter((s: any) => s.status === 'pending_review').length },
    { label: '提现待审', count: withdrawals.filter((w: any) => w.status === 'pending').length },
    { label: '入驻待审', count: users.filter((u: any) => u.entry?.status === 'pending' || u.entry?.status === 'first_ok').length },
  ];
});

function statusLabel(s: string) {
  const m: Record<string, string> = { done: '已完成', serving: '进行中', await_accept: '待接受', pending: '待付款', disputed: '纠纷', cancelled: '已取消', refunded: '已退款' };
  return m[s] || s;
}
function statusClass(s: string) {
  const m: Record<string, string> = { done: 'tag--green', serving: 'tag--blue', await_accept: 'tag--yellow', pending: 'tag--yellow', disputed: 'tag--red', cancelled: 'tag--gray', refunded: 'tag--gray' };
  return m[s] || 'tag--gray';
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function initCharts() {
  const blue = cssVar('--color-blue') || '#1961ed';
  const borderColor = cssVar('--border-medium') || '#e5e7eb';
  const textColor = cssVar('--font-tertiary') || '#6b7280';
  const palette = [blue, '#0d9488', '#d97706', '#7c3aed', '#db2777', '#dc2626'];
  if (revenueChart.value) {
    revenueInst = echarts.init(revenueChart.value);
    const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    revenueInst.setOption({
      color: palette,
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 16, top: 16, bottom: 28 },
      xAxis: { type: 'category', data: days, axisLine: { lineStyle: { color: borderColor } }, axisLabel: { color: textColor, fontSize: 11 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: borderColor } }, axisLabel: { color: textColor, fontSize: 11 } },
      series: [{
        data: [12000, 18000, 15000, 22000, 19000, 28000, 24000],
        type: 'line', smooth: true,
        lineStyle: { color: blue, width: 2 },
        areaStyle: { color: blue + '14' },
        itemStyle: { color: blue },
      }],
    });
  }
  if (orderChart.value) {
    orderInst = echarts.init(orderChart.value);
    const orders = bus()?.orders?.() || [];
    const states: Record<string, number> = {};
    orders.forEach((o: any) => { states[o.status || '其他'] = (states[o.status || '其他'] || 0) + 1; });
    orderInst.setOption({
      color: palette,
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: textColor, fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
        data: Object.entries(states).map(([name, value]) => ({ name: statusLabel(name), value })),
        label: { show: false },
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      }],
    });
  }
}

function onResize() {
  revenueInst?.resize();
  orderInst?.resize();
}

function go(path: string) { window.location.href = '/admin-v2' + path; }
onMounted(() => {
  const cur = bus()?.current?.();
  if (cur) userName.value = cur.name || '管理员';
  recentOrders.value = (bus()?.orders?.() || []).slice(0, 8);
  setTimeout(initCharts, 100);
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  revenueInst?.dispose();
  orderInst?.dispose();
});
</script>

<style scoped>
.dash { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 20px; }
.dash__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.dash__eyebrow { font-size: var(--font-size-xs); color: var(--font-light); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
.dash__title { font-size: var(--font-size-h1); font-weight: var(--font-weight-semibold); color: var(--font-primary); }
.dash__subtitle { font-size: var(--font-size-md); color: var(--font-tertiary); margin-top: 4px; }
.dash__kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kpi { display: flex; flex-direction: column; gap: 4px; }
.kpi__label { font-size: var(--font-size-sm); color: var(--font-tertiary); }
.kpi__value { font-size: 24px; font-weight: var(--font-weight-semibold); color: var(--font-primary); line-height: 1.2; }
.kpi__hint { font-size: var(--font-size-xs); color: var(--font-light); }
.dash__charts { display: grid; grid-template-columns: 3fr 2fr; gap: 12px; }
.chart-card { padding: 16px; }
.chart { height: 260px; }
.card__title { font-size: var(--font-size-lg); font-weight: var(--font-weight-medium); color: var(--font-primary); margin-bottom: 12px; }
.dash__bottom { display: grid; grid-template-columns: 3fr 2fr; gap: 12px; }
.dash__bottom .card { padding: 16px; }
.order-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border-light); font-size: var(--font-size-md); }
.order-row:last-child { border-bottom: none; }
.order-id { color: var(--font-tertiary); font-size: var(--font-size-sm); width: 100px; flex-shrink: 0; }
.order-title { flex: 1; color: var(--font-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.order-amount { color: var(--font-secondary); font-variant-numeric: tabular-nums; }
.todo-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-light); }
.todo-row:last-child { border-bottom: none; }
.todo-label { font-size: var(--font-size-md); color: var(--font-secondary); }
.empty-mini { padding: 24px; text-align: center; color: var(--font-light); font-size: var(--font-size-md); }
@media (max-width: 1100px) {
  .dash__kpis { grid-template-columns: repeat(2, 1fr); }
  .dash__charts, .dash__bottom { grid-template-columns: 1fr; }
}
.funnel-card { padding: 16px; }
.funnel { display: flex; flex-direction: column; gap: 4px; }
.funnel-row { display: flex; }
.funnel-bar { height: 36px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; min-width: 120px; }
.funnel-label { color: #fff; font-size: 13px; font-weight: 500; }
.funnel-count { color: #fff; font-size: 14px; font-weight: 700; }
.kpi.clickable { cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; position: relative; }
.kpi.clickable:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.kpi__arrow { position: absolute; top: 12px; right: 12px; color: var(--font-light); font-size: 18px; }
.order-row.clickable { cursor: pointer; transition: background 0.15s; }
.order-row.clickable:hover { background: var(--bg-secondary); }
</style>
