<template>
  <div class="login">
    <!-- 背后模糊板：模拟界面氛围 -->
    <div class="login__backdrop" aria-hidden="true">
      <div class="login__mock">
        <div class="mock-sidebar"></div>
        <div class="mock-main">
          <div class="mock-row"></div>
          <div class="mock-row short"></div>
          <div class="mock-card"></div>
          <div class="mock-card wide"></div>
        </div>
      </div>
    </div>

    <!-- 毛玻璃认证卡 -->
    <div class="auth-modal">
      <span class="auth-modal__logo">E</span>
      <h1 class="auth-modal__title">Engchain</h1>
      <form class="auth-modal__content" @submit.prevent="onSubmit">
        <input v-model="account" class="text-input" placeholder="账号" autocomplete="username" />
        <input v-model="password" type="password" class="text-input" placeholder="密码" autocomplete="current-password" />
        <div class="role-switch">
          <button type="button" class="role-btn" :class="{ 'is-active': role === 'admin' }" @click="role = 'admin'">管理后台</button>
          <button type="button" class="role-btn" :class="{ 'is-active': role === 'user' }" @click="role = 'user'">用户工作台</button>
        </div>
        <button type="submit" class="btn-main" :disabled="!account || !password">
          <AppIcon name="user" :size="16" />
          登录
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import AppIcon from '@/components/AppIcon.vue';

const router = useRouter();
const userStore = useUserStore();
const account = ref('');
const password = ref('');
const role = ref<'admin' | 'user'>('admin');

function onSubmit() {
  userStore.login(account.value, role.value);
  router.push(role.value === 'admin' ? '/admin/dashboard' : '/u/dashboard');
}
</script>

<style scoped>
.login {
  position: relative;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background: var(--bg-primary);
}

/* 背后模拟界面：模糊 + 不可交互 */
.login__backdrop {
  position: absolute;
  inset: 0;
  filter: blur(2px);
  pointer-events: none;
  opacity: 0.9;
  transform: scale(1.02);
}
.login__mock {
  display: flex;
  height: 100%;
  width: 100%;
  background: var(--bg-primary);
}
.mock-sidebar {
  width: 236px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-light);
}
.mock-main {
  flex: 1;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.mock-row {
  height: 24px;
  width: 200px;
  background: var(--bg-tertiary);
  border-radius: 4px;
}
.mock-row.short { width: 120px; }
.mock-card {
  height: 120px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
}
.mock-card.wide { height: 200px; }

/* 毛玻璃认证卡 */
.auth-modal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  width: 400px;
  max-width: calc(100% - 32px);
  padding: 40px;
  border-radius: var(--radius-md);
  background: var(--bg-overlay);
  color: var(--font-inverted);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: auth-in var(--duration-normal) ease;
}
.auth-modal__logo {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  background: var(--color-blue);
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.auth-modal__title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: #fff;
  margin: 0 0 24px;
}
.auth-modal__content {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 暗色输入变体 */
.auth-modal .text-input {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.16);
  color: #fff;
}
.auth-modal .text-input::placeholder { color: rgba(255, 255, 255, 0.4); }
.auth-modal .text-input:hover:not(:disabled) { border-color: rgba(255, 255, 255, 0.28); }
.auth-modal .text-input:focus {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: none;
}
.role-switch {
  display: flex; gap: 4px; padding: 3px;
  background: rgba(255,255,255,0.08); border-radius: 6px;
}
.role-btn {
  flex: 1; padding: 6px; border-radius: 4px;
  background: transparent; border: none; color: rgba(255,255,255,0.6);
  font-size: 13px; cursor: pointer; transition: all 0.15s;
}
.role-btn.is-active { background: rgba(255,255,255,0.15); color: #fff; }

@keyframes auth-in {
  from { opacity: 0; transform: translate(-50%, -48%); }
  to   { opacity: 1; transform: translate(-50%, -50%); }
}
</style>
