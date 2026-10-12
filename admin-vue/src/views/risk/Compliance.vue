<script setup>
import { ref } from 'vue'

const complianceItems = ref([
  { id: 'c1', name: '营业执照核验', status: 'pass', desc: '企业营业执照真实性核验' },
  { id: 'c2', name: '资质证书核验', status: 'pass', desc: '建筑资质证书有效性核验' },
  { id: 'c3', name: '法人身份核验', status: 'pending', desc: '企业法人身份信息核验' },
  { id: 'c4', name: '银行账户核验', status: 'pass', desc: '对公银行账户真实性核验' }
])
</script>

<template>
  <div class="compliance-page">
    <div class="page-header">
      <h2>合规管理</h2>
      <p class="page-desc">平台合规校验项配置与执行</p>
    </div>
    <div class="compliance-list">
      <div v-for="item in complianceItems" :key="item.id" class="compliance-card">
        <div class="compliance-card__header">
          <h4>{{ item.name }}</h4>
          <el-tag size="small" :type="item.status === 'pass' ? 'success' : 'warning'">
            {{ item.status === 'pass' ? '已通过' : '待执行' }}
          </el-tag>
        </div>
        <p class="compliance-card__desc">{{ item.desc }}</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.compliance-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
.compliance-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: $spacing-md; }
.compliance-card { padding: $spacing-md $spacing-lg; background: $color-bg-container; border: 1px solid $color-border; border-radius: $radius-md;
  &__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: $spacing-xs; h4 { margin: 0; font-size: 15px; } }
  &__desc { margin: 0; font-size: 13px; color: $color-text-secondary; }
}
</style>
