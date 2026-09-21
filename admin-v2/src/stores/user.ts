import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface AdminUser {
  id: string;
  name: string;
  role: 'admin' | 'ops' | 'finance' | 'readonly';
  avatarColor: string;
}

export const useUserStore = defineStore('user', () => {
  const user = ref<AdminUser | null>(null);

  const isLoggedIn = computed(() => !!user.value);

  function login(name: string, role: AdminUser['role'] = 'admin') {
    user.value = {
      id: 'u-' + Date.now(),
      name,
      role,
      avatarColor: 'blue',
    };
    localStorage.setItem('engchain-console-user', JSON.stringify(user.value));
  }

  function logout() {
    user.value = null;
    localStorage.removeItem('engchain-console-user');
  }

  function restore() {
    try {
      const raw = localStorage.getItem('engchain-console-user');
      if (raw) user.value = JSON.parse(raw);
    } catch (e) {
      /* ignore */
    }
  }

  return { user, isLoggedIn, login, logout, restore };
});
