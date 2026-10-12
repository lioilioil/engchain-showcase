<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/api'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const company = ref(null)

async function loadCompany() {
  loading.value = true
  try {
    const id = route.params.id
    const users = await api.user.list()
    const user = users.find(u => u.id === id)
    if (user) {
      company.value = {
        id: user.id,
        name: user.entry?.co || user.company || '-',
        owner: user.name,
        mobile: user.mobile,
        creditCode: user.entry?.creditCode || user.auth?.enterprise?.creditCode || '—',
        address: user.entry?.address || '—',
        type: user.entry?.type || '企业入驻',
        status: user.entry?.status === 'active' ? 'active' : 'pending',
        establishedAt: user.entry?.establishedAt || '—',
        businessScope: user.entry?.businessScope || '—'
      }
    }
  } finally {
    loading.value = false
  }
}

function handleEdit() {
  ElMessage.info('编辑企业信息功能开发中')
}

onMounted(loadCompany)
</script>

<template>
  <div class="company-detail-page" v-loading="loading">
    <!-- 返回按钮 -->
    <el-button link @click="router.back()" style="margin-bottom: 16px">
      ← 返回列表
    </el-button>

    <template v-if="company">
      <!-- 企业头部卡片 -->
      <div class="company-header">
        <div class="company-header__info">
          <h2>{{ company.name }}</h2>
          <div class="company-header__meta">
            <el-tag size="small" :type="company.status === 'active' ? 'success' : 'warning'">
              {{ company.status === 'active' ? '已入驻' : '待审核' }}
            </el-tag>
            <el-tag size="small" effect="plain">{{ company.type }}</el-tag>
            <span class="meta-item">统一信用代码：{{ company.creditCode }}</span>
          </div>
        </div>
        <div class="company-header__actions">
          <el-button type="primary" @click="handleEdit">编辑信息</el-button>
        </div>
      </div>

      <!-- 详细信息 -->
      <el-descriptions :column="2" border size="default" class="detail-section">
        <el-descriptions-item label="企业名称">{{ company.name }}</el-descriptions-item>
        <el-descriptions-item label="企业主">{{ company.owner }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ company.mobile }}</el-descriptions-item>
        <el-descriptions-item label="成立时间">{{ company.establishedAt }}</el-descriptions-item>
        <el-descriptions-item label="企业地址" :span="2">{{ company.address }}</el-descriptions-item>
        <el-descriptions-item label="经营范围" :span="2">{{ company.businessScope }}</el-descriptions-item>
      </el-descriptions>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.company-detail-page {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.company-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: $spacing-lg;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;

  &__info {
    h2 {
      margin: 0 0 $spacing-sm 0;
      font-size: 20px;
      font-weight: 600;
    }
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  .meta-item {
    font-size: 13px;
    color: $color-text-secondary;
    margin-left: $spacing-sm;
  }
}

.detail-section {
  margin-top: $spacing-md;
}
</style>
