<script setup>
import { ref, onMounted, computed } from 'vue'
import ProTable from '@/components/ProTable/index.vue'
import api from '@/api'

// 表格列配置
const columns = [
  { prop: 'orderId', label: '订单号', width: 160 },
  { prop: 'title', label: '标题', minWidth: 240 },
  { prop: 'userName', label: '归属用户', width: 120 },
  { prop: 'amount', label: '交易额', width: 120, formatter: (row) => `¥${row.amount?.toLocaleString()}` },
  { prop: 'rate', label: '费率', width: 80, formatter: (row) => `${(row.rate * 100).toFixed(1)}%` },
  { prop: 'fee', label: '佣金', width: 110, formatter: (row) => `¥${row.fee?.toLocaleString()}` },
  { prop: 'milestones', label: '里程碑', width: 100 },
  { prop: 'status', label: '状态', width: 100, slot: 'status' },
  { prop: 'settledAt', label: '结算时间', width: 120, formatter: (row) => row.settledAt ? new Date(row.settledAt).toLocaleDateString() : '-' }
]

const loading = ref(false)
const allData = ref([])
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)

// 统计
const stats = computed(() => {
  const list = allData.value
  return {
    total: list.length,
    totalAmount: list.reduce((s, f) => s + (f.amount || 0), 0),
    totalFee: list.reduce((s, f) => s + (f.fee || 0), 0)
  }
})

async function loadData() {
  loading.value = true
  try {
    // 已结算订单作为成交记录
    const [orders, commissionFlows] = await Promise.all([
      api.order.list(),
      api.finance.listCommissionFlows()
    ])

    // 成交记录去重：佣金流水与已结算订单按 orderId 并集去重，成交总额只计一次
    const settledOrders = orders.filter(o => o.status === 'settled').map(o => ({
      orderId: o.id,
      title: o.title,
      userName: o.counterparty,
      amount: o.amount,
      rate: o.rate,
      fee: o.fee,
      milestones: o.milestones?.every(m => m.status === 'done') ? '全部完成' : `${o.milestones?.filter(m => m.status === 'done').length || 0}/${o.milestones?.length || 0}`,
      status: 'done',
      settledAt: o.updatedAt || Date.now()
    }))

    const seen = new Set()
    allData.value = [...commissionFlows, ...settledOrders].filter(r => {
      if (!r.orderId || seen.has(r.orderId)) return false
      seen.add(r.orderId)
      return true
    })
    total.value = allData.value.length
    applyFilter()
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  const start = (page.value - 1) * pageSize.value
  tableData.value = allData.value.slice(start, start + pageSize.value)
}

function onPageChange({ page: p, pageSize: ps }) {
  page.value = p
  pageSize.value = ps
  applyFilter()
}

onMounted(loadData)
</script>

<template>
  <div class="deals-page">
    <div class="page-header">
      <div>
        <h2>成交记录</h2>
        <p class="page-desc">平台已成交订单及佣金明细</p>
      </div>
    </div>

    <!-- 统计 -->
    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.total }}</div>
        <div class="stat-item__label">成交笔数</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">¥{{ stats.totalAmount?.toLocaleString() }}</div>
        <div class="stat-item__label">总交易额</div>
      </div>
      <div class="stat-item stat-item--highlight">
        <div class="stat-item__value">¥{{ stats.totalFee?.toLocaleString() }}</div>
        <div class="stat-item__label">平台佣金</div>
      </div>
    </div>

    <ProTable
      :columns="columns"
      :data="tableData"
      :total="total"
      :loading="loading"
      v-model:page="page"
      v-model:page-size="pageSize"
      row-key="orderId"
      @page-change="onPageChange"
    >
      <template #status="{ row }">
        <el-tag size="small" type="success">已结算</el-tag>
      </template>
    </ProTable>
  </div>
</template>

<style lang="scss" scoped>
.deals-page {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.page-header {
  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }
}

.page-desc {
  margin: $spacing-xs 0 0;
  font-size: 13px;
  color: $color-text-secondary;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-md;
}

.stat-item {
  padding: $spacing-md $spacing-lg;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  text-align: center;

  &--highlight {
    border-color: $color-primary;
  }

  &__value {
    font-size: 20px;
    font-weight: 600;
    color: $color-text-primary;
  }

  &--highlight &__value {
    color: $color-primary;
  }

  &__label {
    margin-top: 2px;
    font-size: 12px;
    color: $color-text-secondary;
  }
}
</style>
