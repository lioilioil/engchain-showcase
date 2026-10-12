<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'
import { useLogStore } from '@/store/log.js'
const logStore = useLogStore()

const loading = ref(false)
const messages = ref([])
const activeTab = ref('all')

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'system', label: '系统通知' },
  { key: 'business', label: '业务通知' },
  { key: 'warning', label: '预警消息' }
]

async function loadData() {
  loading.value = true
  try {
    const list = await api.system.listMessages()
    // 字段与枚举契约统一：content→body、time→ts；mock 中文类型映射到 tab key
    const TYPE_MAP = { 系统: 'system', 系统通知: 'system', 业务: 'business', 活动: 'business', 公告: 'business', 风控: 'warning', 预警: 'warning' }
    messages.value = list.map(m => ({
      ...m,
      content: m.content || m.body || '',
      time: m.time || m.ts || '',
      read: m.read ?? false,
      type: TYPE_MAP[m.type] || m.type || 'system'
    }))
  } finally {
    loading.value = false
  }
}

const filteredMessages = ref([])
function filterMessages() {
  if (activeTab.value === 'all') {
    filteredMessages.value = messages.value
  } else {
    filteredMessages.value = messages.value.filter(m => m.type === activeTab.value)
  }
}

function markAllRead() {
  messages.value.forEach(m => m.read = true)
  filterMessages()
}

// 群发通知：写入本地共享消息并留痕
function broadcast() {
  const m = { id: 'b' + Date.now(), type: 'system', content: '平台公告：系统维护通知', time: new Date().toLocaleString(), read: false }
  messages.value.unshift(m)
  filterMessages()
  logStore.addLog({ action: '群发通知', module: '消息中心', target: '全部用户', extra: m.content })
  ElMessage.success('已发布群发通知')
}

onMounted(() => {
  loadData().then(filterMessages)
})
</script>

<template>
  <div class="messages-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2>消息中心</h2>
        <p class="page-desc">平台消息与通知管理</p>
      </div>
      <el-button @click="markAllRead">全部标记已读</el-button>
      <el-button type="primary" @click="broadcast">发布通知</el-button>
    </div>

    <el-tabs v-model="activeTab" @tab-change="filterMessages">
      <el-tab-pane v-for="tab in tabs" :key="tab.key" :label="tab.label" :name="tab.key" />
    </el-tabs>

    <div class="message-list">
      <div
        v-for="msg in filteredMessages"
        :key="msg.id"
        class="message-item"
        :class="{ 'message-item--unread': !msg.read }"
      >
        <div class="message-item__icon" :class="'message-item__icon--' + (msg.type || 'system')">
          {{ msg.type === 'warning' ? '!' : msg.type === 'business' ? 'i' : 'S' }}
        </div>
        <div class="message-item__content">
          <div class="message-item__title">
            {{ msg.title }}
            <el-tag v-if="!msg.read" size="small" type="danger" effect="plain" style="margin-left: 8px">未读</el-tag>
          </div>
          <div class="message-item__desc">{{ msg.content }}</div>
          <div class="message-item__time">{{ msg.time }}</div>
        </div>
      </div>
    </div>

    <el-empty v-if="filteredMessages.length === 0" description="暂无消息" />
  </div>
</template>

<style lang="scss" scoped>
.messages-page {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

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

.message-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.message-item {
  display: flex;
  align-items: flex-start;
  gap: $spacing-md;
  padding: $spacing-md $spacing-lg;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;

  &--unread {
    border-left: 3px solid $color-primary;
    background: #f6f8fa;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    font-size: 16px;
    font-weight: 700;
    flex-shrink: 0;

    &--system {
      background: #ddf4ff;
      color: #0969da;
    }

    &--business {
      background: #dafbe1;
      color: #1f883d;
    }

    &--warning {
      background: #fff8c5;
      color: #9a6700;
    }
  }

  &__content {
    flex: 1;
  }

  &__title {
    font-weight: 500;
    color: $color-text-primary;
  }

  &__desc {
    margin-top: $spacing-xs;
    font-size: 13px;
    color: $color-text-regular;
  }

  &__time {
    margin-top: $spacing-xs;
    font-size: 12px;
    color: $color-text-secondary;
  }
}
</style>
