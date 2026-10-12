// 轻量自研 i18n：为当前页面量与 Mock 阶段选型（不引入 vue-i18n）
// 取舍依据：当前硬编码文案集中在登录/导航/菜单/用户列表等少数关键面，
// 切换复杂度低，自研 reactive t() 即可覆盖，避免 vue-i18n 包体积与配置成本。
import { ref, computed } from 'vue'

const STORAGE_KEY = 'engchain_locale'

const messages = {
  zh: {
    'app.name': 'Engchain',
    'login.title': 'Engchain 建筑 B2B 后台',
    'login.account': '账号',
    'login.password': '密码',
    'login.submit': '登 录',
    'login.failed': '账号或密码错误',
    'nav.search': '全局搜索',
    'nav.notification': '通知中心',
    'nav.logout': '退出登录',
    'menu.dashboard': '数据总览',
    'menu.users': '用户管理',
    'users.title': '用户管理',
    'users.add': '新增用户',
    'users.export': '批量导出',
    'users.ban': '批量封禁',
    'users.keyword': '关键词',
    'users.search': '查询',
    'users.reset': '重置',
    'common.cancel': '取消',
    'common.confirm': '确定',
    'common.language': '语言'
  },
  en: {
    'app.name': 'Engchain',
    'login.title': 'Engchain Construction B2B Admin',
    'login.account': 'Account',
    'login.password': 'Password',
    'login.submit': 'Sign In',
    'login.failed': 'Invalid account or password',
    'nav.search': 'Search',
    'nav.notification': 'Notifications',
    'nav.logout': 'Sign out',
    'menu.dashboard': 'Dashboard',
    'menu.users': 'Users',
    'users.title': 'User Management',
    'users.add': 'Add User',
    'users.export': 'Batch Export',
    'users.ban': 'Batch Ban',
    'users.keyword': 'Keyword',
    'users.search': 'Search',
    'users.reset': 'Reset',
    'common.cancel': 'Cancel',
    'common.confirm': 'OK',
    'common.language': 'Language'
  }
}

const locale = ref(localStorage.getItem(STORAGE_KEY) || 'zh')

function t(key) {
  return messages[locale.value][key] || key
}

function setLocale(lv) {
  if (!messages[lv]) return
  locale.value = lv
  localStorage.setItem(STORAGE_KEY, lv)
}

// 响应式：模板中 t() 随 locale 变化
export function useI18n() {
  return { locale, t: computed(() => t).value, setLocale, tRaw: t }
}
