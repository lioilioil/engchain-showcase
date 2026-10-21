<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api'
import ProDrawer from '@/components/ProDrawer/index.vue'
import { usePermissionStore } from '@/store/permission.js'
import { maskPhone } from '@/utils/mask.js'

const route = useRoute()
const router = useRouter()
const permStore = usePermissionStore()

const loading = ref(true)
const user = ref(null)
const activeTab = ref('basic')

// 加载用户详情
async function loadUser() {
  loading.value = true
  try {
    const id = route.params.id
    user.value = await api.user.byId(id)
  } finally {
    loading.value = false
  }
}

// 计算用户状态标签
const statusText = computed(() => {
  if (!user.value) return ''
  return user.value.tag || user.value.status
})

// 认证维度状态
const authDimensions = computed(() => {
  if (!user.value) return []
  const a = user.value.auth || {}
  return [
    { key: 'realname', label: '实名认证', ok: a.realname?.ok, ts: a.realname?.ts },
    { key: 'enterprise', label: '企业认证', ok: a.enterprise?.ok, ts: a.enterprise?.ts, expireAt: a.enterprise?.expireAt },
    { key: 'personalQual', label: '个人资质', ok: a.personalQual?.ok || a.qual?.ok, ts: a.personalQual?.ts || a.qual?.ts, list: a.personalQual?.list || a.qual?.list },
    { key: 'enterpriseQual', label: '企业资质', ok: a.enterpriseQual?.ok, ts: a.enterpriseQual?.ts, list: a.enterpriseQual?.list },
    { key: 'payment', label: '资金账户', ok: a.payment?.ok, ts: a.payment?.ts }
  ]
})

onMounted(loadUser)
</script>

<template>
  <div class="user-detail-page" v-loading="loading">
    <!-- 返回按钮 -->
    <el-button link @click="router.back()" style="margin-bottom: 16px">
      ← 返回列表
    </el-button>

    <template v-if="user">
      <!-- 用户头部卡片 -->
      <div class="user-header">
        <div class="user-header__avatar">{{ user.avatar }}</div>
        <div class="user-header__info">
          <h2>{{ user.name }}</h2>
          <div class="user-header__meta">
            <el-tag size="small">{{ statusText }}</el-tag>
            <span v-if="user.company" class="meta-item">{{ user.company }}</span>
            <span v-if="user.mobile" class="meta-item">{{ permStore.has('sensitive:view') ? user.mobile : maskPhone(user.mobile) }}</span>
          </div>
        </div>
        <div class="user-header__stats">
          <div class="stat">
            <div class="stat__value">¥{{ user.balance?.balance?.toFixed(2) || '0.00' }}</div>
            <div class="stat__label">可用余额</div>
          </div>
          <div class="stat">
            <div class="stat__value">{{ user.credits?.balance || 0 }}</div>
            <div class="stat__label">积分</div>
          </div>
          <div class="stat">
            <div class="stat__value">{{ user.entry?.status === 'active' ? '已入驻' : '未入驻' }}</div>
            <div class="stat__label">入驻状态</div>
          </div>
        </div>
      </div>

      <!-- Tab 区域 -->
      <div class="tab-container">
        <el-tabs v-model="activeTab">
          <!-- 基本信息 -->
          <el-tab-pane label="基本信息" name="basic">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="用户ID">{{ user.id }}</el-descriptions-item>
              <el-descriptions-item label="账号">{{ user.account }}</el-descriptions-item>
              <el-descriptions-item label="姓名">{{ user.name }}</el-descriptions-item>
              <el-descriptions-item label="手机号">{{ permStore.has('sensitive:view') ? user.mobile : maskPhone(user.mobile) }}</el-descriptions-item>
              <el-descriptions-item label="企业">{{ user.company || '-' }}</el-descriptions-item>
              <el-descriptions-item label="状态">{{ user.status }}</el-descriptions-item>
              <el-descriptions-item label="地址" v-if="user.entry?.address">
                {{ [user.entry.address.province, user.entry.address.city, user.entry.address.district, user.entry.address.detail].filter(Boolean).join(' ') }}
              </el-descriptions-item>
              <el-descriptions-item label="网站" v-if="user.entry?.website">{{ user.entry.website }}</el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>

          <!-- 认证信息 -->
          <el-tab-pane label="认证信息" name="auth">
            <div class="auth-list">
              <div v-for="dim in authDimensions" :key="dim.key" class="auth-item">
                <div class="auth-item__header">
                  <el-tag :type="dim.ok ? 'success' : 'danger'" size="small">
                    {{ dim.ok ? '已通过' : '未通过' }}
                  </el-tag>
                  <span class="auth-item__label">{{ dim.label }}</span>
                </div>
                <div v-if="dim.list && dim.list.length" class="auth-item__list">
                  <el-tag v-for="(item, i) in dim.list" :key="i" size="small" style="margin-right: 4px">{{ item }}</el-tag>
                </div>
                <div v-if="dim.expireAt" class="auth-item__expire">
                  有效期至：{{ new Date(dim.expireAt).toLocaleDateString() }}
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- 入驻信息 -->
          <el-tab-pane label="入驻信息" name="entry">
            <template v-if="user.entry && user.entry.type">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="入驻类型">{{ user.entry.type }}</el-descriptions-item>
                <el-descriptions-item label="状态">{{ user.entry.status }}</el-descriptions-item>
                <el-descriptions-item label="订单号">{{ user.entry.orderId || '-' }}</el-descriptions-item>
                <el-descriptions-item label="入驻费">¥{{ user.entry.fee || 0 }}</el-descriptions-item>
                <el-descriptions-item label="保证金">{{ user.entry.depositType || '-' }} · ¥{{ user.entry.depositPaid || 0 }}</el-descriptions-item>
                <el-descriptions-item label="到期时间" v-if="user.entry.expireAt">
                  {{ new Date(user.entry.expireAt).toLocaleDateString() }}
                </el-descriptions-item>
              </el-descriptions>

              <div v-if="user.entry.qualifications && user.entry.qualifications.length" class="section-block">
                <h4>资质证书</h4>
                <el-table :data="user.entry.qualifications" size="small">
                  <el-table-column prop="name" label="资质名称" />
                  <el-table-column prop="level" label="等级" width="100" />
                  <el-table-column label="证书编号" width="150">
                    <template #default="{ row }">{{ permStore.has('sensitive:view') ? row.no : '****' }}</template>
                  </el-table-column>
                  <el-table-column prop="expireAt" label="到期日期" width="120" />
                </el-table>
              </div>

              <div v-if="user.entry.intro" class="section-block">
                <h4>企业介绍</h4>
                <p>{{ user.entry.intro.desc }}</p>
              </div>
            </template>
            <el-empty v-else description="未入驻" />
          </el-tab-pane>

          <!-- 财务信息 -->
          <el-tab-pane label="财务信息" name="finance">
            <el-descriptions :column="3" border>
              <el-descriptions-item label="可用余额">¥{{ user.balance?.balance?.toFixed(2) || '0.00' }}</el-descriptions-item>
              <el-descriptions-item label="冻结金额">¥{{ user.balance?.frozen?.toFixed(2) || '0.00' }}</el-descriptions-item>
              <el-descriptions-item label="累计入账">¥{{ user.balance?.totalIn?.toFixed(2) || '0.00' }}</el-descriptions-item>
              <el-descriptions-item label="积分余额">{{ user.credits?.balance || 0 }}</el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>

          <!-- 资质履历 -->
          <el-tab-pane label="资质履历" name="resume">
            <template v-if="user.auth?.personalEntry?.profile">
              <div class="resume-section" v-if="user.auth.personalEntry.profile.basic?.gender">
                <h4>基本信息</h4>
                <p>{{ user.auth.personalEntry.profile.basic.gender }} · {{ user.auth.personalEntry.profile.basic.birth }} · {{ user.auth.personalEntry.profile.basic.location }}</p>
              </div>
              <div class="resume-section" v-if="user.auth.personalEntry.profile.education?.length">
                <h4>教育经历</h4>
                <div v-for="(edu, i) in user.auth.personalEntry.profile.education" :key="i" class="timeline-item">
                  <strong>{{ edu.school }}</strong> · {{ edu.major }} · {{ edu.degree }}
                  <div class="text-secondary">{{ edu.start }} ~ {{ edu.end }}</div>
                </div>
              </div>
              <div class="resume-section" v-if="user.auth.personalEntry.profile.work?.length">
                <h4>工作经历</h4>
                <div v-for="(work, i) in user.auth.personalEntry.profile.work" :key="i" class="timeline-item">
                  <strong>{{ work.company }}</strong> · {{ work.position }}
                  <div class="text-secondary">{{ work.start }} ~ {{ work.end }}</div>
                  <p>{{ work.desc }}</p>
                </div>
              </div>
              <div class="resume-section" v-if="user.auth.personalEntry.profile.skills?.length">
                <h4>技能标签</h4>
                <el-tag v-for="(skill, i) in user.auth.personalEntry.profile.skills" :key="i" size="small" style="margin-right: 4px; margin-bottom: 4px">{{ skill }}</el-tag>
              </div>
            </template>
            <el-empty v-else description="暂无个人简历" />
          </el-tab-pane>

          <!-- 订单记录 -->
          <el-tab-pane label="订单记录" name="orders">
            <el-empty description="暂无订单数据" />
          </el-tab-pane>

          <!-- 操作记录 -->
          <el-tab-pane label="操作记录" name="logs">
            <el-empty description="暂无操作记录" />
          </el-tab-pane>
        </el-tabs>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.user-detail-page {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.user-header {
  display: flex;
  align-items: center;
  gap: $spacing-lg;
  padding: $spacing-xl;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-lg;

  &__avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: $color-primary;
    color: #fff;
    font-size: 24px;
    font-weight: 500;
  }

  &__info {
    flex: 1;

    h2 {
      margin: 0 0 $spacing-xs;
      font-size: 20px;
    }
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: $spacing-md;
  }

  &__stats {
    display: flex;
    gap: $spacing-xl;
  }
}

.meta-item {
  font-size: 13px;
  color: $color-text-secondary;
}

.stat {
  text-align: center;

  &__value {
    font-size: 20px;
    font-weight: 600;
    color: $color-text-primary;
  }

  &__label {
    font-size: 12px;
    color: $color-text-secondary;
    margin-top: 2px;
  }
}

.tab-container {
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  padding: $spacing-lg;
}

.auth-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.auth-item {
  padding: $spacing-md;
  border: 1px solid $color-border;
  border-radius: $radius-sm;

  &__header {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    margin-bottom: $spacing-xs;
  }

  &__label {
    font-weight: 500;
  }

  &__list {
    margin-top: $spacing-xs;
  }

  &__expire {
    margin-top: $spacing-xs;
    font-size: 12px;
    color: $color-text-secondary;
  }
}

.section-block {
  margin-top: $spacing-lg;

  h4 {
    margin: 0 0 $spacing-sm;
    font-size: 14px;
  }
}

.resume-section {
  margin-bottom: $spacing-lg;

  h4 {
    margin: 0 0 $spacing-sm;
    font-size: 14px;
    color: $color-text-primary;
  }
}

.timeline-item {
  padding: $spacing-sm 0;
  border-bottom: 1px solid $color-border;

  p {
    margin: $spacing-xs 0 0;
    font-size: 13px;
    color: $color-text-regular;
  }
}

.text-secondary {
  font-size: 12px;
  color: $color-text-secondary;
}
</style>
