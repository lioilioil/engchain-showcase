<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const phrases = ref([])

const dialogVisible = ref(false)
const isEdit = ref(false)
const form = ref({ category: '', content: '' })

async function loadData() {
  loading.value = true
  try {
    phrases.value = await api.system.listPhrases()
  } finally {
    loading.value = false
  }
}

function openAdd() {
  isEdit.value = false
  form.value = { category: '', content: '' }
  dialogVisible.value = true
}

function openEdit(item) {
  isEdit.value = true
  form.value = { ...item }
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.value.category || !form.value.content) {
    ElMessage.warning('请填写分类和内容')
    return
  }
  ElMessage.success(isEdit.value ? '已更新' : '已新增')
  dialogVisible.value = false
  loadData()
}

async function handleDelete(item) {
  await ElMessageBox.confirm('确定删除该短语？', '提示', { type: 'warning' })
  ElMessage.success('已删除')
  loadData()
}

onMounted(loadData)
</script>

<template>
  <div class="phrases-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2>快捷短语</h2>
        <p class="page-desc">客服/运营常用回复模板管理</p>
      </div>
      <el-button type="primary" @click="openAdd">新增短语</el-button>
    </div>

    <div class="phrases-grid">
      <div v-for="item in phrases" :key="item.id" class="phrase-card">
        <div class="phrase-card__header">
          <el-tag size="small">{{ item.category }}</el-tag>
          <div class="phrase-card__actions">
            <el-button size="small" link type="primary" @click="openEdit(item)">编辑</el-button>
            <el-button size="small" link type="danger" @click="handleDelete(item)">删除</el-button>
          </div>
        </div>
        <div class="phrase-card__content">{{ item.content }}</div>
      </div>
    </div>

    <el-empty v-if="!loading && phrases.length === 0" description="暂无快捷短语" />

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑短语' : '新增短语'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="分类">
          <el-input v-model="form.category" placeholder="如：投诉处理 / 认证指引" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="form.content" type="textarea" :rows="4" placeholder="短语内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.phrases-page {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

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

.phrases-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: $spacing-md;
}

.phrase-card {
  padding: $spacing-md $spacing-lg;
  background: $color-bg-container;
  border: 1px solid $color-border;
  border-radius: $radius-md;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: $spacing-sm;
  }

  &__actions {
    display: flex;
    gap: $spacing-xs;
  }

  &__content {
    font-size: 13px;
    color: $color-text-regular;
    line-height: 1.6;
  }
}
</style>
