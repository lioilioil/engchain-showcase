<template>
  <el-drawer
    :model-value="modelValue"
    :title="title"
    :size="drawerSize"
    :destroy-on-close="true"
    append-to-body
    @update:model-value="onVisibleChange"
    @close="onClose"
  >
    <div v-loading="false" class="pro-drawer__body">
      <el-skeleton v-if="loading" :rows="8" animated />

      <!-- 详情模式 -->
      <div v-else-if="mode === 'detail'" class="pro-drawer__detail">
        <div
          v-for="(field, idx) in fields"
          :key="idx"
          class="pro-drawer__detail-item"
          :class="{ 'is-full': field.span === 2 }"
        >
          <div class="pro-drawer__detail-label">{{ field.label }}</div>
          <div class="pro-drawer__detail-value">
            {{ field.formatter ? field.formatter(data) : (data ? data[field.prop] : '-') ?? '-' }}
          </div>
        </div>
        <el-empty
          v-if="!fields || fields.length === 0"
          description="暂无数据"
          :image-size="80"
        />
      </div>

      <!-- 表单模式 -->
      <el-form
        v-else
        ref="formRef"
        :model="formData || {}"
        :rules="formRules"
        label-width="90px"
        class="pro-drawer__form"
      >
        <el-row :gutter="16">
          <el-col
            v-for="(item, idx) in formItems"
            :key="idx"
            :span="item.span === 2 ? 24 : 12"
          >
            <el-form-item
              :label="item.label"
              :prop="item.prop"
            >
              <el-input
                v-if="item.type === 'input'"
                v-model="formData[item.prop]"
                :placeholder="item.placeholder || `请输入${item.label}`"
                clearable
              />
              <el-input
                v-else-if="item.type === 'textarea'"
                v-model="formData[item.prop]"
                type="textarea"
                :rows="item.rows || 3"
                :placeholder="item.placeholder || `请输入${item.label}`"
              />
              <el-select
                v-else-if="item.type === 'select'"
                v-model="formData[item.prop]"
                :placeholder="item.placeholder || `请选择${item.label}`"
                clearable
                style="width: 100%"
              >
                <el-option
                  v-for="opt in (item.options || [])"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <el-input-number
                v-else-if="item.type === 'number'"
                v-model="formData[item.prop]"
                :placeholder="item.placeholder || `请输入${item.label}`"
                controls-position="right"
                style="width: 100%"
              />
              <el-date-picker
                v-else-if="item.type === 'date'"
                v-model="formData[item.prop]"
                type="date"
                :placeholder="item.placeholder || `请选择${item.label}`"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>

    <template #footer v-if="!hideFooter">
      <div class="pro-drawer__footer">
        <template v-if="mode === 'detail'">
          <el-button @click="onVisibleChange(false)">关闭</el-button>
        </template>
        <template v-else>
          <el-button @click="onVisibleChange(false)">取消</el-button>
          <el-button type="primary" @click="onSubmit">{{ submitText }}</el-button>
        </template>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  mode: { type: String, default: 'detail', validator: v => ['detail', 'form'].includes(v) },
  size: { type: String, default: 'md', validator: v => ['sm', 'md', 'lg'].includes(v) },
  data: { type: Object, default: () => ({}) },
  fields: { type: Array, default: () => [] },
  formItems: { type: Array, default: () => [] },
  formData: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  hideFooter: { type: Boolean, default: false },
  submitText: { type: String, default: '确定' }
})

const emit = defineEmits(['update:modelValue', 'submit', 'close'])

const formRef = ref(null)

const sizeMap = { sm: '480px', md: '600px', lg: '720px' }
const drawerSize = computed(() => sizeMap[props.size] || '600px')

const formRules = computed(() => {
  const rules = {}
  ;(props.formItems || []).forEach(item => {
    if (item.required) {
      const action = item.type === 'select' || item.type === 'date' ? '请选择' : '请输入'
      rules[item.prop] = { required: true, message: `${action}${item.label}`, trigger: item.type === 'select' || item.type === 'date' ? 'change' : 'blur' }
    }
  })
  return rules
})

function onVisibleChange(val) {
  emit('update:modelValue', val)
}

function onClose() {
  emit('close')
}

async function onSubmit() {
  if (mode !== 'form') return
  if (formRef.value) {
    try {
      await formRef.value.validate()
    } catch (e) {
      return
    }
  }
  emit('submit', props.formData)
}
</script>

<style lang="scss" scoped>
.pro-drawer {
  &__body {
    padding: 0 $spacing-lg;
  }

  &__detail {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
  }

  &__detail-item {
    width: 50%;
    padding: $spacing-md $spacing-sm;
    box-sizing: border-box;
    border-bottom: 1px solid $color-border;

    &.is-full {
      width: 100%;
    }
  }

  &__detail-label {
    font-size: 13px;
    color: $color-text-secondary;
    line-height: 1.6;
  }

  &__detail-value {
    margin-top: 4px;
    font-size: 14px;
    color: $color-text-regular;
    line-height: 1.6;
    word-break: break-all;
  }

  &__footer {
    text-align: right;
  }
}
</style>
