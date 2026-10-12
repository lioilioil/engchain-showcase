<script setup>
// 生产级虚拟列表：el-table-v2（Element Plus 自带，零新依赖）
// 当数据行数 > virtualThreshold(默认 200) 时启用，DOM 只渲染可视窗口行
import { computed } from 'vue'
import { ElTableV2 } from 'element-plus'
import { maskPhone } from '@/utils/mask.js'

const props = defineProps({
  data: { type: Array, default: () => [] },
  sensitive: { type: Boolean, default: false },
  virtualThreshold: { type: Number, default: 200 }
})

const active = computed(() => props.data.length > props.virtualThreshold)

const columns = [
  { key: 'id', dataKey: 'id', title: 'ID', width: 90, fixed: 'left' },
  {
    key: 'name', dataKey: 'name', title: '姓名', width: 140, fixed: 'left',
    cellRenderer: ({ rowData }) => {
      const a = rowData.avatar || '?'
      return `<span style="display:inline-flex;align-items:center;gap:8px"><span style="width:26px;height:26px;border-radius:50%;background:#67c23a;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px">${a}</span>${rowData.name}</span>`
    }
  },
  { key: 'company', dataKey: 'company', title: '企业', minWidth: 220 },
  {
    key: 'mobile', dataKey: 'mobile', title: '手机号', width: 140,
    cellRenderer: ({ rowData }) => {
      const m = rowData.mobile || ''
      return props.sensitive ? m : maskPhone(m)
    }
  },
  { key: 'tag', dataKey: 'tag', title: '身份标签', width: 140 },
  {
    key: 'status', dataKey: 'status', title: '状态', width: 110,
    cellRenderer: ({ rowData }) => rowData.banned ? '已封禁' : '正常'
  }
]
</script>

<template>
  <div v-if="active" class="virtual-table">
    <div class="virtual-table__hint">虚拟列表已启用（共 {{ data.length }} 行，仅渲染可视窗口）</div>
    <el-table-v2
      :columns="columns"
      :data="data"
      :width="900"
      :height="480"
      fixed
    />
  </div>
  <slot v-else />
</template>

<style lang="scss" scoped>
.virtual-table__hint {
  font-size: 12px;
  color: $color-text-secondary;
  margin-bottom: $spacing-sm;
}
</style>
