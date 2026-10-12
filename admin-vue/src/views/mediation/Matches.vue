<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'
import { useLogStore } from '@/store/log.js'
const logStore = useLogStore()

const loading = ref(false)
const matches = ref([])

async function loadData() {
  loading.value = true
  try {
    const [supplyList, orderList] = await Promise.all([
      api.supply.list(),
      api.order.list()
    ])

    // 模拟撮合匹配：供应 vs 需求自动匹配
    const supplies = supplyList.filter(s => s.dir === 'supply' && s.status === 'on')
    const demands = supplyList.filter(s => s.dir === 'demand' && s.status === 'on')

    // 规则撮合打分：品类命中40 + 地区命中30 + 预算区间相近30（确定性，刷新不变）
    function scoreOf(demand, supply) {
      let s = 0
      if (demand.cat && supply.cat && demand.cat === supply.cat) s += 40
      if (demand.location && supply.location && demand.location === supply.location) s += 30
      const da = parseFloat(demand.amount) || 0
      const sa = parseFloat(supply.amount) || 0
      if (da && sa) {
        const ratio = Math.min(da, sa) / Math.max(da, sa)
        s += Math.round(30 * ratio)
      }
      return s
    }

    matches.value = demands.slice(0, 8).map((demand, i) => {
      // 取得分最高的供应（确定性）
      let best = supplies[0]; let bestScore = -1
      supplies.forEach(s => { const sc = scoreOf(demand, s); if (sc > bestScore) { bestScore = sc; best = s } })
      return {
        id: `match-${i + 1}`,
        demand: {
          title: demand.title,
          company: demand.company,
          cat: demand.cat,
          location: demand.location,
          amount: demand.amount
        },
        supply: {
          title: best?.title || '-',
          company: best?.company || '-',
          cat: best?.cat || '-',
          location: best?.location || '-',
          amount: best?.amount || '-'
        },
        score: bestScore,
        status: 'pending'
      }
    })
  } finally {
    loading.value = false
  }
}

function handleMatch(match, action) {
  match.status = action
  // 撮合操作留痕可追溯（match_record）
  logStore.addLog({
    action: action === 'accept' ? '确认推荐' : '忽略匹配',
    module: '撮合匹配',
    target: `${match.demand.title} → ${match.supply.title}`,
    extra: `得分 ${match.score}`
  })
  ElMessage.success(action === 'accept' ? '已推荐给双方' : '已忽略该匹配')
}

onMounted(loadData)
</script>

<template>
  <div class="matches-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2>撮合匹配</h2>
        <p class="page-desc">系统自动匹配供需信息，人工确认后推荐给双方</p>
      </div>
    </div>

    <div class="match-list">
      <div v-for="match in matches" :key="match.id" class="match-card">
        <div class="match-card__score" :class="match.score >= 90 ? 'match-card__score--high' : ''">
          {{ match.score }}%
        </div>

        <div class="match-card__content">
          <!-- 需求方 -->
          <div class="match-side">
            <div class="match-side__label">需求方</div>
            <div class="match-side__title">{{ match.demand.title }}</div>
            <div class="match-side__meta">
              <span>{{ match.demand.company }}</span>
              <span>{{ match.demand.cat }}</span>
              <span>{{ match.demand.location }}</span>
              <span>{{ match.demand.amount }}</span>
            </div>
          </div>

          <div class="match-connector">
            <el-icon><Right /></el-icon>
          </div>

          <!-- 供应方 -->
          <div class="match-side">
            <div class="match-side__label">供应方</div>
            <div class="match-side__title">{{ match.supply.title }}</div>
            <div class="match-side__meta">
              <span>{{ match.supply.company }}</span>
              <span>{{ match.supply.cat }}</span>
              <span>{{ match.supply.location }}</span>
              <span>{{ match.supply.amount }}</span>
            </div>
          </div>
        </div>

        <div class="match-card__actions">
          <el-button
            size="small"
            type="success"
            :disabled="match.status !== 'pending'"
            @click="handleMatch(match, 'accept')"
          >
            {{ match.status === 'accept' ? '已推荐' : '确认推荐' }}
          </el-button>
          <el-button
            size="small"
            :disabled="match.status !== 'pending'"
            @click="handleMatch(match, 'ignore')"
          >
            {{ match.status === 'ignore' ? '已忽略' : '忽略' }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Right } from '@element-plus/icons-vue'
export default {
  components: { Right }
}
</script>

<style lang="scss" scoped>
.matches-page {
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

.match-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.match-card {
  display: flex;
  align-items: center;
  gap: $spacing-lg;
  padding: $spacing-lg;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;

  &__score {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 700;
    background: $color-bg-page;
    color: $color-text-secondary;
    flex-shrink: 0;

    &--high {
      background: $color-primary;
      color: #fff;
    }
  }

  &__content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: $spacing-md;
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    flex-shrink: 0;
  }
}

.match-side {
  flex: 1;

  &__label {
    font-size: 12px;
    color: $color-text-secondary;
    margin-bottom: $spacing-xs;
  }

  &__title {
    font-size: 14px;
    font-weight: 500;
    color: $color-text-primary;
    margin-bottom: $spacing-xs;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-md;
    font-size: 12px;
    color: $color-text-secondary;
  }
}

.match-connector {
  color: $color-text-secondary;
  font-size: 20px;
}
</style>
