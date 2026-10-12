<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <div class="brand-logo">E</div>
        <div class="brand-name">Engchain 运营后台</div>
      </div>
      <h2 class="login-title">登录</h2>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent>
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" size="large" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="请输入密码" size="large" @keyup.enter="onSubmit" />
        </el-form-item>
        <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="onSubmit">
          登 录
        </el-button>
      </el-form>
      <div class="login-hint">
        演示账号：admin / admin123（超管）<br />viewer / viewer123（只读）
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/user.js'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const formRef = ref()
const form = reactive({ username: '', password: '' })
const loading = ref(false)
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function onSubmit() {
  await formRef.value.validate()
  loading.value = true
  setTimeout(() => {
    const res = userStore.login(form.username, form.password)
    loading.value = false
    if (res.ok) {
      ElMessage.success('登录成功')
      const redirect = route.query.redirect
      router.replace(typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/dashboard')
    } else {
      ElMessage.error(res.message || '登录失败')
    }
  }, 200)
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-page);
}
.login-card {
  width: 380px;
  background: var(--color-bg-container);
  border: 1px solid var(--color-border-light);
  border-radius: $radius-lg;
  padding: $spacing-2xl $spacing-xl;
  box-shadow: var(--shadow-lg);
}
.brand {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-lg;
}
.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: $radius-md;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-700));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: $font-weight-bold;
}
.brand-name {
  font-size: $font-size-lg;
  font-weight: $font-weight-bold;
  color: var(--color-text-primary);
}
.login-title {
  margin: 0 0 $spacing-lg;
  font-size: $font-size-xl;
  color: var(--color-text-primary);
}
.login-btn {
  width: 100%;
}
.login-hint {
  margin-top: $spacing-lg;
  font-size: $font-size-xs;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
</style>
