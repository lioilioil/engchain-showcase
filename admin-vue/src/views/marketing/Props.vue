<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const props = ref([
  { id: 'p1', name: '供需置顶卡', price: 99, unit: '元/7天', desc: '供需信息置顶展示，提升曝光' },
  { id: 'p2', name: '企业认证徽章', price: 199, unit: '元/年', desc: '企业主页展示认证徽章，增强信任' },
  { id: 'p3', name: '精准推荐', price: 299, unit: '元/月', desc: '系统智能推荐匹配供需，提升撮合率' },
  { id: 'p4', name: '首页广告位', price: 999, unit: '元/周', desc: '平台首页轮播广告位' }
])

function handleEdit(item) {
  ElMessage.info(`编辑 ${item.name}`)
}
</script>

<template>
  <div class="props-page">
    <div class="page-header">
      <h2>增值道具</h2>
      <p class="page-desc">平台增值服务与营销道具管理</p>
    </div>
    <div class="props-grid">
      <div v-for="item in props" :key="item.id" class="prop-card">
        <div class="prop-card__name">{{ item.name }}</div>
        <div class="prop-card__price">¥{{ item.price }} <span class="prop-card__unit">{{ item.unit }}</span></div>
        <div class="prop-card__desc">{{ item.desc }}</div>
        <el-button size="small" type="primary" link @click="handleEdit(item)">编辑</el-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.props-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
.props-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: $spacing-md; }
.prop-card { padding: $spacing-lg; background: $color-bg-container; border: 1px solid $color-border; border-radius: $radius-md;
  &__name { font-weight: 500; margin-bottom: $spacing-sm; }
  &__price { font-size: 20px; font-weight: 700; color: $color-primary; margin-bottom: $spacing-xs; }
  &__unit { font-size: 12px; font-weight: 400; color: $color-text-secondary; }
  &__desc { font-size: 13px; color: $color-text-secondary; margin-bottom: $spacing-sm; }
}
</style>
