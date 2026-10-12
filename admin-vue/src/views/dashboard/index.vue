<script setup>
import { ref, onMounted, onUnmounted, onActivated, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import KpiCard from '@/components/KpiCard/index.vue'
import ErrorBoundary from '@/components/ErrorBoundary/index.vue'
import { CHART_PALETTE, CHART_AXIS, CHART_SPLIT } from '@/utils/chartColors.js'
import api from '@/api'
import { useDataStore } from '@/store/data'

const router = useRouter()
const dataStore = useDataStore()

const loading = ref(true)

// KPI 数据
const kpis = ref({
  users: 0,
  realname: 0,
  enterprise: 0,
  resident: 0
})

// 待办统计
const todoCounts = ref({
  authPending: 0,
  entryPending: 0,
  withdrawPending: 0,
  supplyPending: 0
})

// 近期动态
const recentActivities = ref([])

// 图表实例
const trendChart = ref(null)
const orderChart = ref(null)
let trendChartInstance = null
let orderChartInstance = null
let echartsModule = null

// 异步加载 ECharts（按需引入，只加载用到的图表）
async function loadECharts() {
  if (echartsModule) return echartsModule
  const [echartsCore, lineChart, pieChart, barChart, components, renderers] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts').then(m => m.LineChart),
    import('echarts/charts').then(m => m.PieChart),
    import('echarts/charts').then(m => m.BarChart),
    import('echarts/components'),
    import('echarts/renderers')
  ])
  echartsCore.use([lineChart, pieChart, barChart, ...Object.values(components), ...Object.values(renderers)])
  echartsModule = echartsCore
  return echartsModule
}

async function loadData() {
  loading.value = true
  try {
    const [stats, users, withdrawals, supply, orders] = await Promise.all([
      api.user.stats(),
      api.user.list(),
      api.finance.listWithdrawals(),
      api.supply.list(),
      api.order.list()
    ])

    kpis.value = stats

    todoCounts.value = {
      authPending: users.filter(u => u.auth?.realname?.status === 'pending' || u.auth?.enterprise?.status === 'pending' || u.auth?.qual?.status === 'pending').length,
      entryPending: users.filter(u => u.entry?.status === 'pending' || u.entry?.status === 'first_ok').length,
      withdrawPending: withdrawals.filter(w => w.status === 'pending').length,
      supplyPending: supply.filter(s => s.status === 'pending').length
    }

    const logs = await api.system.listAuditLogs()
    recentActivities.value = logs.slice(0, 8)

    // 异步初始化图表
    nextTick(async () => {
      await initTrendChart(users)
      await initOrderChart(orders)
    })
  } finally {
    loading.value = false
  }
}

async function initTrendChart(users) {
  if (!trendChart.value) return
  const echarts = await loadECharts()
  if (trendChartInstance) trendChartInstance.dispose()
  trendChartInstance = echarts.init(trendChart.value)
  
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const newUsers = [12, 19, 15, 25, 22, 18, users.length]
  
  trendChartInstance.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: days, axisLine: { lineStyle: { color: CHART_AXIS } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: CHART_SPLIT } } },
    series: [{
      data: newUsers,
      type: 'line',
      smooth: true,
      lineStyle: { color: CHART_PALETTE[0], width: 3 },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(31, 136, 61, 0.3)' },
        { offset: 1, color: 'rgba(31, 136, 61, 0.05)' }
      ])}
    }]
  })
}

async function initOrderChart(orders) {
  if (!orderChart.value) return
  const echarts = await loadECharts()
  if (orderChartInstance) orderChartInstance.dispose()
  orderChartInstance = echarts.init(orderChart.value)
  
  const statusMap = {}
  orders.forEach(o => {
    statusMap[o.status] = (statusMap[o.status] || 0) + 1
  })
  
  const statusLabels = {
    pending: '待确认',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消'
  }
  
  const pieData = Object.entries(statusMap).map(([key, value]) => ({
    name: statusLabels[key] || key,
    value
  }))
  
  orderChartInstance.setOption({
    color: CHART_PALETTE,
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, left: 'center' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      data: pieData.length ? pieData : [{ name: '暂无数据', value: 1 }],
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.2)' } },
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 }
    }]
  })
}

function handleResize() {
  trendChartInstance?.resize()
  orderChartInstance?.resize()
}

function goTodo() {
  router.push('/todo')
}

onMounted(() => {
  loadData()
  dataStore.loadPlatformStats()
  window.addEventListener('resize', handleResize)
})

// keep-alive 激活时刷新数据
onActivated(() => {
  loadData()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChartInstance?.dispose()
  orderChartInstance?.dispose()
})
</script>

<template>
  <div class="dashboard-page" v-loading="loading">
    <!-- 欢迎区 -->
    <div class="welcome-banner">
      <div>
        <h1>欢迎使用 Engchain 运营后台</h1>
        <p>建筑 B2B 平台 · 纯信息撮合 · 不碰资金</p>
      </div>
      <el-button type="primary" @click="goTodo">
        查看待办 ({{ todoCounts.authPending + todoCounts.entryPending + todoCounts.withdrawPending + todoCounts.supplyPending }})
      </el-button>
    </div>

    <!-- KPI 卡片 -->
    <div class="kpi-grid">
      <KpiCard
        title="注册用户"
        :value="kpis.users"
        :change="8.2"
        trend="up"
        theme="primary"
        :trend-data="[12, 15, 14, 18, 20, 19, kpis.users]"
        clickable
        @click="router.push('/users/users')"
      />
      <KpiCard
        title="实名认证"
        :value="kpis.realname"
        :change="5.3"
        trend="up"
        theme="success"
        :trend-data="[6, 7, 8, 7, 9, 10, kpis.realname]"
        clickable
        @click="router.push('/users/auth-review')"
      />
      <KpiCard
        title="企业认证"
        :value="kpis.enterprise"
        :change="12.5"
        trend="up"
        theme="success"
        :trend-data="[2, 3, 3, 4, 5, 4, kpis.enterprise]"
        clickable
        @click="router.push('/users/auth-review')"
      />
      <KpiCard
        title="入驻企业"
        :value="kpis.resident"
        :change="-2.1"
        trend="down"
        theme="warning"
        :trend-data="[3, 4, 4, 3, 4, 3, kpis.resident]"
        clickable
        @click="router.push('/users/entry-review')"
      />
    </div>

    <!-- 待办提醒 -->
    <div class="todo-section">
      <h3>待办提醒</h3>
      <div class="todo-grid">
        <div class="todo-item" role="button" tabindex="0" @click="router.push('/users/auth-review')" @keydown.enter.prevent="router.push('/users/auth-review')" @keydown.space.prevent="router.push('/users/auth-review')">
          <div class="todo-item__count">{{ todoCounts.authPending }}</div>
          <div class="todo-item__label">认证审核</div>
        </div>
        <div class="todo-item" role="button" tabindex="0" @click="router.push('/users/entry-review')" @keydown.enter.prevent="router.push('/users/entry-review')" @keydown.space.prevent="router.push('/users/entry-review')">
          <div class="todo-item__count">{{ todoCounts.entryPending }}</div>
          <div class="todo-item__label">入驻审核</div>
        </div>
        <div class="todo-item" role="button" tabindex="0" @click="router.push('/finance/withdraw')" @keydown.enter.prevent="router.push('/finance/withdraw')" @keydown.space.prevent="router.push('/finance/withdraw')">
          <div class="todo-item__count">{{ todoCounts.withdrawPending }}</div>
          <div class="todo-item__label">提现审批</div>
        </div>
        <div class="todo-item" role="button" tabindex="0" @click="router.push('/mediation/requests')" @keydown.enter.prevent="router.push('/mediation/requests')" @keydown.space.prevent="router.push('/mediation/requests')">
          <div class="todo-item__count">{{ todoCounts.supplyPending }}</div>
          <div class="todo-item__label">供需审核</div>
        </div>
      </div>
    </div>

    <!-- 图表区域（错误边界包裹：图表渲染崩溃只降级该区块） -->
    <ErrorBoundary title="图表加载失败">
      <div class="charts-grid">
        <div class="chart-card" v-if="loading">
          <div class="skeleton-chart">
            <div class="skeleton-chart__bar skeleton-chart__bar--title"></div>
            <div class="skeleton-chart__body"></div>
          </div>
          <div class="skeleton-chart">
            <div class="skeleton-chart__bar skeleton-chart__bar--title"></div>
            <div class="skeleton-chart__body"></div>
          </div>
        </div>
        <template v-else>
          <div class="chart-card">
            <h3>用户增长趋势</h3>
            <div ref="trendChart" class="chart-container"></div>
          </div>
          <div class="chart-card">
            <h3>订单状态分布</h3>
            <div ref="orderChart" class="chart-container"></div>
          </div>
        </template>
      </div>
    </ErrorBoundary>

    <!-- 近期动态 -->
    <div class="activity-section">
      <h3>近期动态</h3>
      <el-timeline>
        <el-timeline-item
          v-for="(item, idx) in recentActivities"
          :key="idx"
          :timestamp="new Date(item.ts).toLocaleString('zh-CN')"
          placement="top"
        >
          <strong>{{ item.operator }}</strong>
          在 <strong>{{ item.module }}</strong> 执行了 <strong>{{ item.action }}</strong>
          <span v-if="item.target"> · {{ item.target }}</span>
        </el-timeline-item>
      </el-timeline>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: $spacing-xl;
}

// 图表骨架
.skeleton-chart {
  padding: $spacing-lg;
  border: 1px solid var(--color-border-light);
  border-radius: $radius-lg;
  &__bar--title { width: 40%; height: 16px; margin-bottom: $spacing-md; }
  &__body { height: 260px; border-radius: $radius-md; }
  &__bar, &__body {
    background: linear-gradient(90deg, var(--color-border-light) 25%, var(--color-bg-hover) 50%, var(--color-border-light) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: $radius-sm;
  }
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.welcome-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-xl $spacing-2xl;
  background: linear-gradient(135deg, $color-primary 0%, $color-primary-700 100%);
  border-radius: $radius-lg;
  color: #fff;
  box-shadow: $shadow-primary;

  h1 {
    margin: 0 0 $spacing-xs;
    font-size: $font-size-2xl;
    font-weight: $font-weight-bold;
  }

  p {
    margin: 0;
    opacity: 0.9;
    font-size: $font-size-base;
  }
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-lg;
}

.todo-section,
.activity-section,
.chart-card {
  background: var(--color-bg-container);
  border: 1px solid var(--color-border-light);
  border-radius: $radius-lg;
  padding: $spacing-lg;
  box-shadow: var(--shadow-sm);

  h3 {
    margin: 0 0 $spacing-md;
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: var(--color-text-primary);
  }
}

.todo-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-md;
}

.todo-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: $spacing-lg;
  border: 1px solid var(--color-border-light);
  border-radius: $radius-md;
  background: var(--color-bg-container);
  cursor: pointer;
  transition: all $duration-base $ease-out;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  &__count {
    font-size: $font-size-3xl;
    font-weight: $font-weight-bold;
    color: var(--color-primary);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  &__label {
    margin-top: $spacing-sm;
    font-size: $font-size-sm;
    color: var(--color-text-secondary);
  }
}

.charts-grid {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: $spacing-lg;
}

.chart-container {
  height: 300px;
}
</style>
