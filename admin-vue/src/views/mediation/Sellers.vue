<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const loading = ref(false)
const sellers = ref([])

const stats = computed(() => {
  const list = sellers.value
  return {
    total: list.length,
    verified: list.filter(item => item.verified).length,
    premium: list.filter(item => item.premium).length
  }
})

async function loadData() {
  loading.value = true
  try {
    const users = await api.user.list()
    sellers.value = users
      .filter(u => u.entry?.co && (u.entry?.type?.includes('企业') || u.entry?.type?.includes('供应')))
      .slice(0, 10)
      .map(u => ({
        id: u.id,
        name: u.entry.co,
        owner: u.name,
        mobile: u.mobile,
        rating: 4 + Math.random(),
        orders: Math.floor(Math.random() * 50),
        verified: true,
        premium: Math.random() > 0.5,
        category: u.entry?.category || '建筑材料'
      }))
  } finally {
    loading.value = false
  }
}

function handleView(row) {
  ElMessage.info(`查看供方详情: ${row.name}`)
}

function handleContact(row) {
  ElMessage.success(`已发起联系 ${row.name}`)
}

onMounted(loadData)
</script>

<template>
  <div class="sellers-page" v-loading="loading">
    <div class="page-header">
      <h2>供方库</h2>
      <p class="page-desc">平台供方企业库与评分管理</p>
    </div>
    <el-alert type="warning" :closable="false" style="margin-bottom:12px" title="该模块已下线：Phase 0 不做供方库评分运营，本页仅为历史快照。" />

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.total }}</div>
        <div class="stat-item__label">供方总数</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.verified }}</div>
        <div class="stat-item__label">已认证</div>
      </div>
      <div class="stat-item">
        <div class="stat-item__value">{{ stats.premium }}</div>
        <div class="stat-item__label">优质供方</div>
      </div>
    </div>

    <!-- 供方列表 -->
    <el-table :data="sellers" size="default">
      <el-table-column prop="id" label="编号" width="80" />
      <el-table-column prop="name" label="企业名称" min-width="200">
        <template #default="{ row }">
          <div class="seller-name">
            <span>{{ row.name }}</span>
            <el-tag v-if="row.verified" size="small" type="success" style="margin-left: 8px">已认证</el-tag>
            <el-tag v-if="row.premium" size="small" type="warning" style="margin-left: 4px">优质</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="owner" label="负责人" width="100" />
      <el-table-column prop="mobile" label="联系电话" width="130" />
      <el-table-column prop="category" label="主营类目" width="120" />
      <el-table-column label="评分" width="100">
        <template #default="{ row }">
          <span style="color: #d4a72c; font-weight: 600">★ {{ row.rating.toFixed(1) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="orders" label="成交订单" width="100" />
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="handleView(row)">查看</el-button>
          <el-button size="small" type="success" link @click="handleContact(row)">联系</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style lang="scss" scoped>
.sellers-page {
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
  padding: $spacing-lg;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;

  &__value {
    font-size: 24px;
    font-weight: 700;
    color: $color-text-primary;
    margin-bottom: $spacing-xs;
  }

  &__label {
    font-size: 13px;
    color: $color-text-secondary;
  }
}

.seller-name {
  display: flex;
  align-items: center;
}
</style>
