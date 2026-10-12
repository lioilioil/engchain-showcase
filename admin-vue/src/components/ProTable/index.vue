<script setup>
import { reactive, computed, watch, ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { ArrowDown, Setting, Download, Check } from '@element-plus/icons-vue'
import Skeleton from '@/components/Skeleton/index.vue'
import EmptyState from '@/components/EmptyState/index.vue'

const props = defineProps({
  // 列配置
  columns: { type: Array, default: () => [] },
  // 筛选栏配置
  filters: { type: Array, default: () => [] },
  // 行操作列
  actions: { type: Array, default: () => [] },
  // 表格数据
  data: { type: Array, default: () => [] },
  // 总条数
  total: { type: Number, default: 0 },
  // 加载态
  loading: { type: Boolean, default: false },
  // 当前页（v-model:page）
  page: { type: Number, default: 1 },
  // 每页条数（v-model:pageSize）
  pageSize: { type: Number, default: 10 },
  // 行 key 字段
  rowKey: { type: String, default: 'id' },
  // 是否显示多选列
  selection: { type: Boolean, default: false },
  // 行是否可点击
  rowClickable: { type: Boolean, default: false },
  // 空态文案
  emptyText: { type: String, default: '暂无数据' },
  // 是否显示列设置按钮
  showColumnSetting: { type: Boolean, default: true },
  // 是否显示下载 CSV 按钮
  showDownloadCsv: { type: Boolean, default: true },
  // 是否显示行展开
  expandable: { type: Boolean, default: false },
  // 表格最大高度（超过则表头吸顶）
  maxTableHeight: { type: [Number, String], default: 560 },
  // 空状态：类型 inbox/search/error/default、描述、CTA 文案
  emptyType: { type: String, default: 'default' },
  emptyDescription: { type: String, default: '' },
  emptyActionText: { type: String, default: '' },
  // 虚拟滚动：数据行数超过阈值时启用窗口化渲染
  virtualThreshold: { type: Number, default: 100 },
  virtualRowHeight: { type: Number, default: 44 }
})

// ============================================================
// 虚拟滚动：行数超过阈值时只渲染可视窗口行
// ============================================================
const VIRTUAL_BUFFER = 5
const scrollTop = ref(0)
const scrollViewH = ref(560)
const tableScrollRef = ref(null)

const useVirtual = computed(() => props.data.length > props.virtualThreshold)

const virtualStart = computed(() => {
  const start = Math.floor(scrollTop.value / props.virtualRowHeight) - VIRTUAL_BUFFER
  return Math.max(0, start)
})
const virtualEnd = computed(() => {
  const end = virtualStart.value + Math.ceil(scrollViewH.value / props.virtualRowHeight) + VIRTUAL_BUFFER * 2
  return Math.min(props.data.length, end)
})
const virtualData = computed(() => props.data.slice(virtualStart.value, virtualEnd.value))

function onTableScroll(e) {
  const target = e.target
  scrollTop.value = target.scrollTop
  scrollViewH.value = target.clientHeight
}

onMounted(() => {
  const wrap = document.querySelector('.pro-table .el-table__body-wrapper')
  if (wrap) wrap.addEventListener('scroll', onTableScroll, { passive: true })
})
onBeforeUnmount(() => {
  const wrap = document.querySelector('.pro-table .el-table__body-wrapper')
  if (wrap) wrap.removeEventListener('scroll', onTableScroll)
})

const emit = defineEmits([
  'update:page',
  'update:pageSize',
  'page-change',
  'filter-change',
  'row-click',
  'selection-change',
  'action-click',
  'empty-action'
])

// ============================================================
// 筛选栏
// ============================================================
const filterModel = reactive({})

const initFilterModel = () => {
  Object.keys(filterModel).forEach((k) => delete filterModel[k])
  props.filters.forEach((f) => {
    if (f.type === 'date-range' || f.type === 'multi-select') {
      filterModel[f.prop] = []
    } else {
      filterModel[f.prop] = ''
    }
  })
}
initFilterModel()
watch(() => props.filters, initFilterModel, { deep: true })

const emitFilterChange = () => emit('filter-change', { ...filterModel })

let debounceTimer = null
// input 防抖 300ms
const onInput = () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(emitFilterChange, 300)
}
// select / multi-select / date-range change 立即触发
const onFilterChange = () => emitFilterChange()

// 重置：清空所有筛选值再 emit
const onReset = () => {
  Object.keys(filterModel).forEach((k) => {
    filterModel[k] = Array.isArray(filterModel[k]) ? [] : ''
  })
  emitFilterChange()
}

// ============================================================
// 分页
// ============================================================
const onPageChange = (p) => {
  emit('update:page', p)
  emit('page-change', { page: p, pageSize: props.pageSize })
}
const onSizeChange = (s) => {
  emit('update:pageSize', s)
  emit('update:page', 1)
  emit('page-change', { page: 1, pageSize: s })
}

// ============================================================
// 表格事件
// ============================================================
const onRowClick = (row) => {
  if (!props.rowClickable) return
  const index = props.data.indexOf(row)
  emit('row-click', { row, index })
}

// 批量选择
const selectedRows = ref([])
function onSelectionChange(rows) {
  selectedRows.value = rows
  emit('selection-change', { rows })
}

function clearSelection() {
  selectedRows.value = []
}

// ============================================================
// 列显示/隐藏设置
// ============================================================
const hiddenColumns = ref(new Set())

function toggleColumn(prop) {
  if (hiddenColumns.value.has(prop)) {
    hiddenColumns.value.delete(prop)
  } else {
    hiddenColumns.value.add(prop)
  }
  hiddenColumns.value = new Set(hiddenColumns.value)
}

const visibleColumns = computed(() => {
  return props.columns.filter(col => !hiddenColumns.value.has(col.prop))
})

// ============================================================
// 下载 CSV
// ============================================================
function downloadCsv() {
  if (!props.data.length) {
    ElMessage.warning('暂无数据可导出')
    return
  }

  const headers = visibleColumns.value.map(col => col.label)
  const rows = props.data.map(row =>
    visibleColumns.value.map(col => {
      let val = row[col.prop]
      if (col.formatter) {
        try {
          val = col.formatter(row)
        } catch (e) {
          val = ''
        }
      }
      if (typeof val === 'object' && val && val.text) return val.text
      return String(val ?? '').replace(/,/g, '，')
    })
  )

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `table-${Date.now()}.csv`
  link.click()
  URL.revokeObjectURL(url)
  ElMessage.success('导出成功')
}

// ============================================================
// 行操作
// ============================================================
const visibleActions = (row) => props.actions.filter((a) => !a.if || a.if(row))

// 操作列：超过 2 个收进"更多"下拉
const MAX_VISIBLE_ACTIONS = 2
const getVisibleActions = (row) => visibleActions(row).slice(0, MAX_VISIBLE_ACTIONS)
const getHiddenActions = (row) => visibleActions(row).slice(MAX_VISIBLE_ACTIONS)

const actionColumnWidth = computed(() => {
  if (props.actions.length <= MAX_VISIBLE_ACTIONS) {
    return Math.max(140, props.actions.length * 90 + 32)
  }
  // 2个按钮 + 更多按钮
  return Math.max(180, (MAX_VISIBLE_ACTIONS + 1) * 90 + 32)
})

// 危险操作二次确认
async function onActionClick(action, row, index) {
  if (action.danger && action.confirm !== false) {
    try {
      await ElMessageBox.confirm(
        action.confirmText || `确定要执行"${action.label}"吗？`,
        '操作确认',
        { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }
      )
    } catch {
      return // 用户取消
    }
  }
  emit('action-click', { action, row, index })
}

// ============================================================
// 单元格渲染器：formatter 可返回字符串、数字、或 { text, type } 对象
// ============================================================
function formatCell(col, row) {
  if (col.formatter) {
    const val = col.formatter(row)
    return autoFormat(val, col.prop)
  }
  return autoFormat(row[col.prop], col.prop)
}

// 自动格式化：金额、日期、数字
function autoFormat(val, prop) {
  if (val === null || val === undefined || val === '') return '-'

  // 状态对象直接返回（不二次处理）
  if (typeof val === 'object' && val.text && val.type) return val

  // 金额字段自动千分位
  if (/amount|fee|price|balance|total|revenue|cost/i.test(prop) && typeof val === 'number') {
    return '¥' + val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // 数字字段自动千分位
  if (typeof val === 'number' && /count|num|rate|percent/i.test(prop)) {
    return val.toLocaleString('zh-CN')
  }

  return val
}

// 判断是否为状态对象（{ text, type }）
function isStatusCell(val) {
  return val && typeof val === 'object' && val.text && val.type
}

// 数字列自动右对齐
function getColumnAlign(col) {
  if (col.align) return col.align
  // 金额/数字列自动右对齐
  if (/amount|fee|price|balance|total|revenue|cost|count|num|rate|percent/i.test(col.prop)) {
    return 'right'
  }
  return 'left'
}
</script>

<template>
  <div class="pro-table">
    <!-- 顶部筛选栏 -->
    <div v-if="filters && filters.length" class="pro-table__filter">
      <div class="pro-table__filter-items">
        <div v-for="item in filters" :key="item.prop" class="pro-table__filter-item">
          <span class="pro-table__filter-label">{{ item.label }}</span>

          <el-input
            v-if="item.type === 'input'"
            v-model="filterModel[item.prop]"
            :placeholder="item.placeholder || `请输入${item.label}`"
            :clearable="item.clearable !== false"
            @input="onInput"
          />

          <el-select
            v-else-if="item.type === 'select'"
            v-model="filterModel[item.prop]"
            :placeholder="item.placeholder || `请选择${item.label}`"
            :clearable="item.clearable !== false"
            class="pro-table__filter-control"
            @change="onFilterChange"
          >
            <el-option
              v-for="opt in item.options"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>

          <el-select
            v-else-if="item.type === 'multi-select'"
            v-model="filterModel[item.prop]"
            multiple
            :placeholder="item.placeholder || `请选择${item.label}`"
            :clearable="item.clearable !== false"
            class="pro-table__filter-control"
            @change="onFilterChange"
          >
            <el-option
              v-for="opt in item.options"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>

          <el-date-picker
            v-else-if="item.type === 'date-range'"
            v-model="filterModel[item.prop]"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            :clearable="item.clearable !== false"
            class="pro-table__filter-control pro-table__filter-control--date"
            @change="onFilterChange"
          />
        </div>
      </div>

      <div class="pro-table__filter-actions">
        <el-button type="primary" @click="emitFilterChange">查询</el-button>
        <el-button @click="onReset">重置</el-button>
      </div>
    </div>

    <!-- 表格工具栏 -->
    <div class="pro-table__toolbar">
      <div class="toolbar-left">
        <slot name="toolbar-left" />
      </div>
      <div class="toolbar-right">
        <slot name="toolbar-right" />
        <!-- 下载 CSV -->
        <el-tooltip v-if="showDownloadCsv" content="导出 CSV">
          <el-button text size="small" @click="downloadCsv">
            <el-icon><Download /></el-icon>
          </el-button>
        </el-tooltip>
        <!-- 列设置 -->
        <el-popover v-if="showColumnSetting" placement="bottom-end" :width="200" trigger="click">
          <template #reference>
            <el-button text size="small" title="列设置">
              <el-icon><Setting /></el-icon>
            </el-button>
          </template>
          <div class="column-setting">
            <div class="column-setting__title">显示列</div>
            <div
              v-for="col in columns"
              :key="col.prop"
              class="column-setting__item"
              @click="toggleColumn(col.prop)"
            >
              <el-checkbox :model-value="!hiddenColumns.has(col.prop)">
                {{ col.label }}
              </el-checkbox>
            </div>
          </div>
        </el-popover>
      </div>
    </div>

    <!-- 批量操作栏（多选时显示） -->
    <div v-if="selection && selectedRows.length" class="pro-table__batch-bar">
      <div class="batch-info">
        <el-icon class="batch-info__icon"><Check /></el-icon>
        <span>已选 <strong>{{ selectedRows.length }}</strong> 项</span>
        <el-button text size="small" @click="clearSelection">取消选择</el-button>
      </div>
      <div class="batch-actions">
        <slot name="batch-actions" :rows="selectedRows" />
      </div>
    </div>

    <!-- 表格 -->
    <div v-if="loading" class="pro-table__skeleton">
      <Skeleton variant="table" :rows="5" />
    </div>
    <el-table
      v-else
      :data="useVirtual ? virtualData : data"
      :row-key="rowKey"
      :empty-text="emptyText"
      :max-height="maxTableHeight"
      :class="{ 'pro-table--clickable': rowClickable, 'pro-table--virtual': useVirtual }"
      stripe
      border
      @selection-change="onSelectionChange"
      @row-click="onRowClick"
      @scroll="onTableScroll"
    >
      <el-table-column v-if="selection" type="selection" width="40" fixed="left" reserve-selection :row-key="rowKey" />

      <el-table-column
        v-for="(col, ci) in visibleColumns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
        :min-width="col.minWidth || col.min_width"
        :align="getColumnAlign(col)"
        :sortable="col.sortable"
        :fixed="ci === 0 ? 'left' : (col.fixed || undefined)"
        :show-overflow-tooltip="col.showOverflowTooltip !== false"
      >
        <template #default="scope">
          <!-- 1. 具名插槽自定义渲染 -->
          <slot
            v-if="col.slot"
            :name="col.slot"
            :row="scope.row"
            :$index="scope.$index"
          />
          <!-- 2. 状态对象自动渲染成标签 -->
          <el-tag
            v-else-if="isStatusCell(formatCell(col, scope.row))"
            :type="formatCell(col, scope.row).type"
            size="small"
          >
            {{ formatCell(col, scope.row).text }}
          </el-tag>
          <!-- 3. 普通文本/数字 -->
          <template v-else>{{ formatCell(col, scope.row) }}</template>
        </template>
      </el-table-column>

      <!-- 行操作列 -->
      <el-table-column
        v-if="actions && actions.length"
        label="操作"
        fixed="right"
        :width="actionColumnWidth"
        align="center"
      >
        <template #default="scope">
          <!-- 前 2 个操作直接显示 -->
          <el-button
            v-for="action in getVisibleActions(scope.row)"
            :key="action.label"
            :type="action.danger ? 'danger' : (action.type || 'primary')"
            link
            size="small"
            :disabled="action.disabled ? action.disabled(scope.row) : false"
            class="action-btn"
            @click="onActionClick(action, scope.row, scope.$index)"
          >
            <el-icon v-if="action.icon" class="pro-table__action-icon">
              <component :is="action.icon" />
            </el-icon>
            {{ action.label }}
          </el-button>

          <!-- 超过 2 个的收进"更多"下拉 -->
          <el-dropdown
            v-if="getHiddenActions(scope.row).length"
            trigger="click"
            @command="(cmd) => onActionClick(cmd, scope.row, scope.$index)"
          >
            <el-button link size="small" type="primary">
              更多<el-icon class="el-icon--right"><arrow-down /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="action in getHiddenActions(scope.row)"
                  :key="action.label"
                  :command="action"
                  :disabled="action.disabled ? action.disabled(scope.row) : false"
                >
                  {{ action.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>

      <!-- 空状态插槽 -->
      <template #empty>
        <EmptyState
          :type="emptyType"
          :title="emptyText"
          :description="emptyDescription"
          :action-text="emptyActionText"
          @action="emit('empty-action')"
        />
      </template>
    </el-table>

    <!-- 分页 -->
    <div v-if="total > 0" class="pro-table__pagination">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.pro-table {
  background: var(--color-bg-container);
  border: 1px solid var(--color-border-light);
  border-radius: $radius-lg;
  padding: $spacing-lg;
  box-shadow: var(--shadow-sm);
  transition: box-shadow $duration-base $ease-out;

  &:hover {
    box-shadow: var(--shadow-md);
  }

  // 筛选栏
  &__filter {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: $spacing-md;
    margin-bottom: $spacing-lg;
    padding-bottom: $spacing-md;
    border-bottom: 1px solid var(--color-border-light);
  }

  &__filter-items {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-md $spacing-lg;
    flex: 1;
  }

  &__filter-item {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  &__filter-label {
    color: var(--color-text-secondary);
    font-size: $font-size-sm;
    white-space: nowrap;
    font-weight: $font-weight-medium;
  }

  &__filter-control {
    width: 200px;
  }

  &__filter-control--date {
    width: 280px;
  }

  &__filter-actions {
    display: flex;
    gap: $spacing-sm;
    margin-left: auto;
  }

  // 分页
  &__pagination {
    display: flex;
    justify-content: flex-end;
    margin-top: $spacing-lg;
    padding-top: $spacing-md;
    border-top: 1px solid var(--color-border-light);
  }

  // 工具栏
  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: $spacing-md;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
  }

  .column-setting {
    &__title {
      font-size: $font-size-sm;
      font-weight: $font-weight-semibold;
      margin-bottom: $spacing-sm;
      color: var(--color-text-primary);
    }

    &__item {
      padding: $spacing-xs 0;
      cursor: pointer;
    }
  }

  // 批量操作栏
  &__batch-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $spacing-sm $spacing-md;
    margin-bottom: $spacing-md;
    background: var(--color-primary-50);
    border: 1px solid var(--color-primary-200);
    border-radius: $radius-md;
    animation: slideDown 0.2s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  // 骨架屏容器
  &__skeleton {
    padding: $spacing-md 0;
  }

  .batch-info {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    font-size: $font-size-sm;
    color: var(--color-primary);
    font-weight: $font-weight-medium;

    strong {
      font-size: $font-size-base;
    }

    &__icon {
      font-size: 16px;
    }
  }

  .batch-actions {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
  }

  // 表格样式优化
  :deep(.el-table) {
    --el-table-border-color: var(--color-border-light);
    --el-table-header-bg-color: var(--color-bg-page);
    --el-table-row-hover-bg-color: var(--color-primary-50);
    --el-table-tr-bg-color: var(--color-bg-container);
    border-radius: $radius-md;
    font-size: $font-size-sm;

    th {
      font-weight: $font-weight-semibold;
      color: var(--color-text-regular);
      font-size: $font-size-xs;
      letter-spacing: 0.03em;
      height: 44px;
    }

    td {
      padding: 12px 0;
    }

    // 行 hover 时整行高亮
    .el-table__row:hover > td {
      background-color: var(--color-primary-50) !important;
    }
  }

  // 斑马纹
  :deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
    background: var(--color-bg-page);
  }

  // 行可点击时鼠标手型
  &--clickable {
    :deep(.el-table__row) {
      cursor: pointer;
      transition: background-color $duration-fast;
    }
  }

  &__action-icon {
    margin-right: 4px;
    vertical-align: middle;
  }
}

// 骨架屏加载
.pro-table--loading {
  .pro-table__filter,
  .pro-table__pagination {
    opacity: 0.5;
    pointer-events: none;
  }
}

// 空状态优化
:deep(.el-table__empty-block) {
  .el-table__empty-text {
    color: var(--color-text-secondary);
    font-size: $font-size-sm;
  }
}
</style>
