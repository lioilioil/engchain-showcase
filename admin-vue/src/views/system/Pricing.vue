<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const pricingItems = ref([
  { key: 'entry-enterprise', name: '企业入驻费', price: 2980, unit: '元/年', desc: '含企业认证、商铺展示、供需发布' },
  { key: 'entry-agency', name: '中介入驻费', price: 1980, unit: '元/年', desc: '含中介资质、撮合佣金权限' },
  { key: 'commission-rate', name: '撮合佣金率', price: 2.5, unit: '%', desc: '按成交金额收取' },
  { key: 'credits-package-100', name: '积分包（100）', price: 10, unit: '元', desc: '100 积分 = 10 元' },
  { key: 'credits-package-500', name: '积分包（500）', price: 45, unit: '元', desc: '500 积分 = 45 元（9折）' },
  { key: 'credits-package-1000', name: '积分包（1000）', price: 80, unit: '元', desc: '1000 积分 = 80 元（8折）' }
])

// 编辑弹窗
const editVisible = ref(false)
const currentItem = ref(null)
const editPrice = ref(0)

function handleEdit(item) {
  currentItem.value = item
  editPrice.value = item.price
  editVisible.value = true
}

function handleSave() {
  if (!editPrice.value || editPrice.value <= 0) {
    ElMessage.warning('请输入有效的价格')
    return
  }
  currentItem.value.price = editPrice.value
  ElMessage.success('已保存价格配置')
  editVisible.value = false
}
</script>

<template>
  <div class="pricing-page">
    <div class="page-header">
      <h2>定价配置</h2>
      <p class="page-desc">平台各项服务价格配置</p>
    </div>

    <div class="pricing-grid">
      <div v-for="item in pricingItems" :key="item.key" class="pricing-card">
        <div class="pricing-card__name">{{ item.name }}</div>
        <div class="pricing-card__price">
          <span class="pricing-card__value">¥{{ item.price }}</span>
          <span class="pricing-card__unit">{{ item.unit }}</span>
        </div>
        <div class="pricing-card__desc">{{ item.desc }}</div>
        <el-button size="small" type="primary" link @click="handleEdit(item)">编辑</el-button>
      </div>
    </div>

    <!-- 编辑价格弹窗 -->
    <el-dialog v-model="editVisible" title="编辑价格" width="400px">
      <el-form label-width="80px">
        <el-form-item label="项目名称">
          <span>{{ currentItem?.name }}</span>
        </el-form-item>
        <el-form-item label="价格" required>
          <el-input-number v-model="editPrice" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="单位">
          <span>{{ currentItem?.unit }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.pricing-page { display: flex; flex-direction: column; gap: $spacing-lg; }
.page-header h2 { margin: 0; font-size: 20px; font-weight: 600; }
.page-desc { margin: $spacing-xs 0 0; font-size: 13px; color: $color-text-secondary; }
.pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: $spacing-md; }
.pricing-card {
  padding: $spacing-lg;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  &__name { font-weight: 500; margin-bottom: $spacing-sm; }
  &__price { margin-bottom: $spacing-xs; }
  &__value { font-size: 24px; font-weight: 700; color: $color-primary; }
  &__unit { margin-left: $spacing-xs; font-size: 13px; color: $color-text-secondary; }
  &__desc { font-size: 12px; color: $color-text-secondary; margin-bottom: $spacing-sm; }
}
</style>
