<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api'

const router = useRouter()
const loading = ref(false)
const monitorFeed = ref([])
const lastUpdated = ref('')
let timer = null

async function loadData() {
  loading.value = true
  try {
    const feed = await api.risk.listMonitorFeed()
    // 字段契约统一：mock 返回 dim/kind/text/ts，归一为 level/event/desc/time
    monitorFeed.value = feed.map(m => ({
      ...m,
      level: m.level || m.dim || 'low',
      event: m.event || m.kind || '',
      desc: m.desc || m.text || '',
      time: m.time || m.ts || ''
    }))
    lastUpdated.value = new Date().toLocaleTimeString()
  } finally {
    loading.value = false
  }
}

// 模拟实时：轮询 15s 刷新
onMounted(() => {
  loadData()
  timer = setInterval(loadData, 15000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })

function goReport(item) {
  router.push('/risk/reports')
}
</script>

<template>
  <div class="monitor-page" v-loading="loading">
    <div class="page-header">
      <h2>企业监控</h2>
      <p class="page-desc">企业工商变更、资质异常、司法风险实时预警</p>
      <div style="margin-left:auto; display:flex; gap:8px; align-items:center">
        <span style="font-size:12px; color:#999">最近更新 {{ lastUpdated }}</span>
        <el-button size="small" @click="loadData">手动刷新</el-button>
      </div>
    </div>

    <div class="feed-list">
      <div v-for="item in monitorFeed" :key="item.id" class="feed-item">
        <div class="feed-item__level" :class="'feed-item__level--' + item.level">
          {{ item.level === 'high' ? '高' : item.level === 'medium' ? '中' : '低' }}
        </div>
        <div class="feed-item__content">
          <div class="feed-item__company">{{ item.company }}</div>
          <div class="feed-item__event">{{ item.event }}</div>
          <div class="feed-item__desc">{{ item.desc }}</div>
          <div class="feed-item__time">{{ item.time }}
            <el-button v-if="item.level === 'high'" size="small" type="danger" link @click="goReport(item)">前往处罚</el-button>
          </div>
        </div>
      </div>
    </div>

    <el-empty v-if="!loading && monitorFeed.length === 0" description="暂无监控预警" />
  </div>
</template>

<style lang="scss" scoped>
.monitor-page {
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

.feed-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.feed-item {
  display: flex;
  gap: $spacing-md;
  padding: $spacing-md $spacing-lg;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;

  &__level {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;

    &--high {
      background: #ffebe9;
      color: #cf222e;
    }

    &--medium {
      background: #fff8c5;
      color: #9a6700;
    }

    &--low {
      background: #dafbe1;
      color: #1f883d;
    }
  }

  &__company {
    font-weight: 500;
    color: $color-text-primary;
  }

  &__event {
    margin-top: $spacing-xs;
    font-size: 13px;
    font-weight: 500;
    color: $color-text-regular;
  }

  &__desc {
    margin-top: $spacing-xs;
    font-size: 12px;
    color: $color-text-secondary;
  }

  &__time {
    margin-top: $spacing-xs;
    font-size: 12px;
    color: $color-text-secondary;
  }
}
</style>
