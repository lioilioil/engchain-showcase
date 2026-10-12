<script setup>
import { ref } from 'vue'

const phases = ref([
  { key: 'alpha', name: '内测期', date: '2026-06 ~ 2026-08', status: 'ended', desc: '种子用户邀请、产品功能验证' },
  { key: 'beta', name: '公测期', date: '2026-09 ~ 2026-10', status: 'active', desc: '公开注册、运营策略打磨' },
  { key: 'ga', name: '正式上线', date: '2026-11 起', status: 'pending', desc: '全量推广、商业化运营' }
])
</script>

<template>
  <div class="phase-page">
    <div class="page-header">
      <h2>运营周期</h2>
      <p class="page-desc">平台各阶段运营时间线</p>
    </div>

    <div class="phase-timeline">
      <div v-for="phase in phases" :key="phase.key" class="phase-item" :class="'phase-item--' + phase.status">
        <div class="phase-item__dot" />
        <div class="phase-item__content">
          <div class="phase-item__header">
            <h3>{{ phase.name }}</h3>
            <el-tag size="small" :type="phase.status === 'active' ? 'success' : phase.status === 'ended' ? 'info' : 'warning'">
              {{ phase.status === 'active' ? '进行中' : phase.status === 'ended' ? '已结束' : '待开始' }}
            </el-tag>
          </div>
          <div class="phase-item__date">{{ phase.date }}</div>
          <p class="phase-item__desc">{{ phase.desc }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.phase-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
.phase-timeline { display: flex; flex-direction: column; gap: $spacing-lg; padding-left: $spacing-lg; border-left: 2px solid $color-border; }
.phase-item { position: relative; padding-left: $spacing-lg;
  &__dot { position: absolute; left: -$spacing-lg - 7px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: $color-border; }
  &--active &__dot { background: $color-primary; box-shadow: 0 0 0 4px rgba(31, 136, 61, 0.2); }
  &__header { display: flex; align-items: center; gap: $spacing-sm; h3 { margin: 0; font-size: 16px; } }
  &__date { margin-top: $spacing-xs; font-size: 13px; color: $color-text-secondary; }
  &__desc { margin-top: $spacing-sm; font-size: 13px; color: $color-text-regular; }
}
</style>
