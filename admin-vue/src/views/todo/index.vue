<script setup>
import { ref, onMounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api'

const router = useRouter()
const loading = ref(true)

// 待办统计
const todoStats = ref({
  authPending: 0,
  entryPending: 0,
  withdrawPending: 0,
  supplyPending: 0
})

// 今日跟进列表
const followUps = ref([])

// 预警列表
const warnings = ref([])

async function loadData() {
  loading.value = true
  try {
    const [users, withdrawals, supply, violations] = await Promise.all([
      api.user.list(),
      api.finance.listWithdrawals(),
      api.supply.list(),
      api.finance.listViolations()
    ])

    // 计算各类待办数
    todoStats.value = {
      authPending: users.filter(u =>
        u.auth?.realname?.status === 'pending' ||
        u.auth?.enterprise?.status === 'pending' ||
        u.auth?.qual?.status === 'pending'
      ).length,
      entryPending: users.filter(u =>
        u.entry?.status === 'pending' || u.entry?.status === 'first_ok'
      ).length,
      withdrawPending: withdrawals.filter(w => w.status === 'pending').length,
      supplyPending: supply.filter(s => s.status === 'pending').length
    }

    // 今日跟进（提现待审 + 供需待审）
    followUps.value = [
      ...withdrawals.filter(w => w.status === 'pending').map(w => ({
        id: w.id,
        type: '提现审批',
        title: `${w.userName} 申请提现 ¥${w.amount}`,
        time: new Date(w.appliedAt).toLocaleString('zh-CN'),
        urgent: w.amount > 500,
        path: '/finance/withdraw'
      })),
      ...supply.filter(s => s.status === 'pending').slice(0, 5).map(s => ({
        id: s.id,
        type: '供需审核',
        title: s.title,
        time: s.ts,
        urgent: s.dir === 'demand',
        path: '/mediation/requests'
      }))
    ]

    // 预警（违规 + 风控）
    warnings.value = violations.filter(v => v.status === 'open').map(v => ({
      id: v.id,
      level: v.level,
      desc: v.desc,
      userName: v.userName,
      company: v.company,
      ts: v.ts,
      path: '/risk/reports'
    }))
  } finally {
    loading.value = false
  }
}

const todoCards = [
  { key: 'authPending', title: '认证审核', desc: '实名认证 / 企业认证 / 资质审核', path: '/users/auth-review', color: '#1f883d' },
  { key: 'entryPending', title: '入驻审核', desc: '企业入驻 / 中介入驻 / 合伙人入驻', path: '/users/entry-review', color: '#0969da' },
  { key: 'withdrawPending', title: '提现审批', desc: '用户提现申请待处理', path: '/finance/withdraw', color: '#d4a72c' },
  { key: 'supplyPending', title: '供需审核', desc: '供需信息发布待审核', path: '/mediation/requests', color: '#cf222e' }
]

onMounted(loadData)

// keep-alive 激活时刷新数据
onActivated(() => {
  loadData()
})
</script>

<template>
  <div class="todo-page" v-loading="loading">
    <div class="page-header">
      <h2>待办中心</h2>
      <p class="page-desc">需要您处理的事项，按优先级排序</p>
    </div>

    <!-- 待办卡片 -->
    <div class="todo-cards">
      <div
        v-for="card in todoCards"
        :key="card.key"
        class="todo-card"
        :style="{ '--card-color': card.color }"
        @click="router.push(card.path)"
      >
        <div class="todo-card__count">{{ todoStats[card.key] }}</div>
        <div class="todo-card__title">{{ card.title }}</div>
        <div class="todo-card__desc">{{ card.desc }}</div>
      </div>
    </div>

    <!-- 今日跟进 -->
    <div class="followup-section">
      <h3>今日跟进</h3>
      <el-table :data="followUps" size="small" stripe>
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="事项" min-width="300" />
        <el-table-column prop="time" label="时间" width="180" />
        <el-table-column label="紧急" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.urgent" type="danger" size="small">紧急</el-tag>
            <span v-else>普通</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="router.push(row.path)">处理</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 预警信息 -->
    <div class="warning-section" v-if="warnings.length">
      <h3>风险预警</h3>
      <div class="warning-list">
        <div v-for="w in warnings" :key="w.id" class="warning-item" :class="'warning-item--' + w.level">
          <div class="warning-item__header">
            <el-tag :type="w.level === 'serious' ? 'danger' : 'warning'" size="small">
              {{ w.level === 'serious' ? '严重' : '警告' }}
            </el-tag>
            <span class="warning-item__user">{{ w.userName }} · {{ w.company }}</span>
            <span class="warning-item__time">{{ w.ts }}</span>
          </div>
          <p class="warning-item__desc">{{ w.desc }}</p>
          <el-button size="small" type="primary" link @click="router.push(w.path)">去处理</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.todo-page {
  display: flex;
  flex-direction: column;
  gap: $spacing-xl;
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

.todo-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-lg;
}

.todo-card {
  padding: $spacing-xl;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-top: 3px solid var(--card-color);
  border-radius: $radius-md;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }

  &__count {
    font-size: 36px;
    font-weight: 700;
    color: var(--card-color);
    line-height: 1;
  }

  &__title {
    margin-top: $spacing-sm;
    font-size: 15px;
    font-weight: 600;
    color: $color-text-primary;
  }

  &__desc {
    margin-top: $spacing-xs;
    font-size: 12px;
    color: $color-text-secondary;
  }
}

.followup-section,
.warning-section {
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: $spacing-lg;

  h3 {
    margin: 0 0 $spacing-md;
    font-size: 16px;
    font-weight: 600;
  }
}

.warning-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.warning-item {
  padding: $spacing-md;
  border: 1px solid $color-border;
  border-left: 4px solid;
  border-radius: $radius-sm;

  &--warn {
    border-left-color: $color-warning;
  }

  &--serious {
    border-left-color: $color-danger;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin-bottom: $spacing-xs;
  }

  &__user {
    font-weight: 500;
    font-size: 14px;
  }

  &__time {
    margin-left: auto;
    font-size: 12px;
    color: $color-text-secondary;
  }

  &__desc {
    margin: 0 0 $spacing-sm;
    font-size: 13px;
    color: $color-text-regular;
  }
}
</style>
