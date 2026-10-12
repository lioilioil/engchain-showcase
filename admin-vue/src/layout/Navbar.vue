<template>
  <header class="navbar">
    <div class="left">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item v-if="crumbs.length > 1" :to="'/dashboard'">首页</el-breadcrumb-item>
        <el-breadcrumb-item v-for="(c, i) in crumbs" :key="i">{{ c }}</el-breadcrumb-item>
      </el-breadcrumb>
    </div>
    
    <div class="right">
      <!-- 全局搜索 -->
      <div class="search-wrapper" role="button" tabindex="0" aria-label="全局搜索" @click="showSearch = true" @keydown.enter.prevent="showSearch = true" @keydown.space.prevent="showSearch = true">
        <el-icon><Search /></el-icon>
        <span class="search-placeholder">搜索...</span>
        <kbd class="search-shortcut">⌘K</kbd>
      </div>

      <!-- 通知中心 -->
      <el-popover placement="bottom-end" :width="360" trigger="click">
        <template #reference>
          <el-badge :value="unreadCount" :max="99" :is-dot="unreadCount > 0" class="icon-badge">
            <el-tooltip content="通知">
              <el-icon class="action-icon" role="button" tabindex="0" aria-label="通知中心"><Bell /></el-icon>
            </el-tooltip>
          </el-badge>
        </template>

        <div class="notification-panel">
          <div class="notification-header">
            <h4>通知中心</h4>
            <el-button text size="small" @click="markAllRead">全部已读</el-button>
          </div>
          <div class="notification-list">
            <div
              v-for="n in notifications"
              :key="n.id"
              class="notification-item"
              :class="{ unread: !n.read, ['level-' + n.level]: true }"
              @click="handleNotifyClick(n)"
            >
              <div class="notification-dot"></div>
              <div class="notification-content">
                <div class="notification-title">
                  {{ n.title }}
                  <el-tag v-if="n.level === 'urgent'" size="small" type="danger">紧急</el-tag>
                  <el-tag v-else-if="n.level === 'important'" size="small" type="warning">重要</el-tag>
                </div>
                <div class="notification-time">{{ n.time }}</div>
              </div>
            </div>
            <div v-if="!notifications.length" class="notification-empty">
              暂无通知
            </div>
          </div>
        </div>
      </el-popover>
      
      <!-- 暗色切换 -->
      <el-tooltip :content="isDark ? '切换亮色' : '切换暗色'">
        <el-icon class="action-icon" role="button" tabindex="0" :aria-label="isDark ? '切换亮色主题' : '切换暗色主题'" @click="toggleDark" @keydown.enter.prevent="toggleDark" @keydown.space.prevent="toggleDark">
          <Moon v-if="!isDark" /><Sunny v-else />
        </el-icon>
      </el-tooltip>

      <!-- 用户菜单 -->
      <el-dropdown @command="handleCommand" trigger="click">
        <div class="user-info" role="button" tabindex="0" aria-label="用户菜单">
          <el-avatar :size="32" class="user-avatar">{{ userStore.name?.[0] || 'A' }}</el-avatar>
          <div class="user-meta">
            <div class="user-name">{{ userStore.name }}</div>
            <div class="user-role">{{ roleLabel }}</div>
          </div>
          <el-icon class="user-arrow"><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item disabled>切换角色：</el-dropdown-item>
            <el-dropdown-item
              v-for="(label, key) in ROLE_LABELS"
              :key="key"
              :command="'role:' + key"
            >
              {{ label }}<span v-if="userStore.role === key" class="check">✓</span>
            </el-dropdown-item>
            <el-dropdown-item disabled divided>密度：</el-dropdown-item>
            <el-dropdown-item
              v-for="(lv, key) in densityStore.levels"
              :key="key"
              :command="'density:' + key"
            >
              {{ lv.label }}<span v-if="densityStore.level === key" class="check">✓</span>
            </el-dropdown-item>
            <el-dropdown-item disabled divided>语言：</el-dropdown-item>
            <el-dropdown-item command="lang:zh">中文<span v-if="locale==='zh'" class="check">✓</span></el-dropdown-item>
            <el-dropdown-item command="lang:en">English<span v-if="locale==='en'" class="check">✓</span></el-dropdown-item>
            <el-dropdown-item command="offline:toggle">{{ isOnline() ? '模拟断网' : '恢复联网' }}</el-dropdown-item>
            <el-dropdown-item command="focus:toggle">{{ focusMode ? '退出聚焦' : '聚焦模式' }}</el-dropdown-item>
            <el-dropdown-item divided command="logout">{{ t('nav.logout') }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
  
  <!-- 全局搜索弹窗（Cmd+K） -->
  <el-dialog v-model="showSearch" title="全局搜索" width="600px" append-to-body>
    <el-input
      v-model="searchKw"
      placeholder="搜索页面、数据..."
      :prefix-icon="Search"
      autofocus
      size="large"
      @keydown="onSearchKeydown"
    />
    <div class="search-results">
      <div class="search-section-title">跳转页面</div>
      <div
        v-for="(p, i) in flatPages"
        :key="p.path"
        class="search-result-item"
        :class="{ active: i === activeIdx }"
        @click="execPage(p)"
        @mouseenter="activeIdx = i"
      >
        <el-icon><ArrowRight /></el-icon>
        <span>{{ p.title }} <small class="search-group">{{ p.group }}</small></span>
      </div>
      <div v-if="!flatPages.length" class="search-empty">无匹配页面</div>
    </div>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, ArrowDown, ArrowRight, Moon, Sunny, Bell } from '@element-plus/icons-vue'
import { useUserStore, ROLE_LABELS } from '@/store/user.js'
import { useDensityStore } from '@/store/density.js'
import { useI18n } from '@/locale/index.js'
import { MENU_GROUPS } from '@/router/index.js'
import { setOnline, isOnline } from '@/utils/offlineQueue.js'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const densityStore = useDensityStore()
const { locale, t, setLocale } = useI18n()
const focusMode = ref(localStorage.getItem('engchain_focus') === '1')
onMounted(() => { document.body.classList.toggle('focus-mode', focusMode.value) })
const searchKw = ref('')
const showSearch = ref(false)
const isDark = ref(false)

const roleLabel = computed(() => ROLE_LABELS[userStore.role] || '')

// 通知数据：level = urgent(紧急打断) / important(重要红点) / normal(普通仅列表)
const notifications = ref([
  { id: 1, title: '有 3 条认证审核待处理', time: '10 分钟前', read: false, level: 'urgent', path: '/users/auth-review' },
  { id: 2, title: '提现审批已通过', time: '2 小时前', read: false, level: 'important', path: '/finance/withdraw' },
  { id: 3, title: '系统将于本周六维护', time: '昨天', read: true, level: 'normal', path: '/dashboard' },
])

// 未读数（红点/角标）
const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

function handleNotifyClick(n) {
  n.read = true
  if (n.path) router.push(n.path)
}

const crumbs = computed(() => {
  const arr = []
  if (route.meta.group) arr.push(route.meta.group)
  if (route.meta.title) arr.push(route.meta.title)
  return arr
})

// 扁平页面列表（模糊匹配页面名/分组）
const flatPages = computed(() => {
  const all = []
  MENU_GROUPS.forEach(g => g.items.forEach(i => all.push({ path: i.path, title: i.title, group: g.group })))
  const kw = searchKw.value.trim().toLowerCase()
  if (!kw) return all
  return all.filter(p => p.title.toLowerCase().includes(kw) || p.group.toLowerCase().includes(kw))
})
const activeIdx = ref(0)

// 输入变化时重置高亮
watch(searchKw, () => { activeIdx.value = 0 })

function execPage(p) {
  showSearch.value = false
  searchKw.value = ''
  router.push(p.path)
}

function onSearchKeydown(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx.value = Math.min(flatPages.value.length - 1, activeIdx.value + 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx.value = Math.max(0, activeIdx.value - 1) }
  else if (e.key === 'Enter') { if (flatPages.value[activeIdx.value]) execPage(flatPages.value[activeIdx.value]) }
  else if (e.key === 'Escape') { showSearch.value = false }
}

function markAllRead() {
  notifications.value.forEach(n => n.read = true)
}

function handleCommand(cmd) {
  if (cmd.startsWith('role:')) {
    const role = cmd.split(':')[1]
    userStore.setRole(role)
    router.push('/dashboard')
  } else if (cmd.startsWith('density:')) {
    densityStore.setLevel(cmd.split(':')[1])
  } else if (cmd.startsWith('lang:')) {
    setLocale(cmd.split(':')[1])
  } else if (cmd === 'offline:toggle') {
    setOnline(isOnline() ? false : true)
    ElMessage.info(isOnline() ? '已恢复联网，队列已提交' : '已模拟断网')
  } else if (cmd === 'focus:toggle') {
    focusMode.value = !focusMode.value
    localStorage.setItem('engchain_focus', focusMode.value ? '1' : '0')
    document.body.classList.toggle('focus-mode', focusMode.value)
  } else if (cmd === 'logout') {
    userStore.logout()
    router.replace('/login')
  }
}

function toggleDark() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}

// Cmd+K 快捷键
function handleKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    showSearch.value = true
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  // 紧急通知：打断式 toast
  notifications.value.filter(n => n.level === 'urgent' && !n.read).forEach(n => {
    ElMessage({ message: '【紧急】' + n.title, type: 'warning', duration: 5000 })
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style lang="scss" scoped>
.navbar {
  height: 60px;
  background: var(--color-bg-container);
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 $spacing-lg;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: $z-navbar;
}

.right {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

// 搜索框
.search-wrapper {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  width: 260px;
  padding: $spacing-sm $spacing-md;
  background: var(--color-bg-hover);
  border: 1px solid transparent;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all $duration-fast;
  
  &:hover {
    background: var(--color-bg-active);
    border-color: var(--color-border-light);
  }
}

.search-placeholder {
  flex: 1;
  font-size: $font-size-sm;
  color: var(--color-text-placeholder);
}

.search-shortcut {
  font-size: $font-size-2xs;
  padding: 2px 6px;
  background: var(--color-bg-container);
  border: 1px solid var(--color-border-light);
  border-radius: $radius-sm;
  color: var(--color-text-secondary);
  font-family: var(--font-family-mono);
}

// 图标按钮
.icon-badge {
  display: flex;
  align-items: center;
}

.action-icon {
  font-size: 18px;
  cursor: pointer;
  color: var(--color-text-regular);
  transition: all $duration-fast;
  padding: $spacing-sm;
  border-radius: $radius-md;
  
  &:hover {
    color: var(--color-primary);
    background: var(--color-bg-hover);
  }
}

// 用户信息
.user-info {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  cursor: pointer;
  padding: $spacing-xs $spacing-sm;
  border-radius: $radius-md;
  transition: all $duration-fast;
  
  &:hover {
    background: var(--color-bg-hover);
  }
}

.user-avatar {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-700));
  font-weight: $font-weight-medium;
  flex-shrink: 0;
}

.user-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.user-name {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: var(--color-text-primary);
}

.user-role {
  font-size: $font-size-2xs;
  color: var(--color-text-secondary);
}

.user-arrow {
  font-size: 12px;
  color: var(--color-text-placeholder);
}

.check {
  margin-left: $spacing-sm;
  color: var(--color-primary);
}

// 通知面板
.notification-panel {
  padding: 0;
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md $spacing-lg;
  border-bottom: 1px solid var(--color-border-light);
  
  h4 {
    margin: 0;
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
  }
}

.notification-list {
  max-height: 320px;
  overflow-y: auto;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: $spacing-sm;
  padding: $spacing-md $spacing-lg;
  transition: background $duration-fast;
  
  &:hover {
    background: var(--color-bg-hover);
  }
  
  &.unread {
    background: var(--color-primary-50);
  }
}

.notification-dot {
  width: 8px;
  height: 8px;
  border-radius: $radius-full;
  background: var(--color-primary);
  margin-top: 6px;
  flex-shrink: 0;
}

.notification-item:not(.unread) .notification-dot {
  background: var(--color-border);
}

.notification-content {
  flex: 1;
}

.notification-title {
  font-size: $font-size-sm;
  color: var(--color-text-primary);
  line-height: 1.4;
}

.notification-time {
  font-size: $font-size-2xs;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.notification-empty {
  padding: $spacing-2xl;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: $font-size-sm;
}

// 搜索结果
.search-results {
  margin-top: $spacing-lg;
}

.search-section-title {
  font-size: $font-size-2xs;
  font-weight: $font-weight-semibold;
  color: var(--color-text-placeholder);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: $spacing-sm;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  border-radius: $radius-md;
  cursor: pointer;
  font-size: $font-size-sm;
  color: var(--color-text-regular);
  transition: all $duration-fast;
  
  &:hover, &.active {
    background: var(--color-bg-hover);
    color: var(--color-primary);
  }
}
.search-group {
  color: var(--color-text-secondary);
  font-size: 12px;
  margin-left: 6px;
}
</style>
