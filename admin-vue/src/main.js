import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

import App from './App.vue'
import router from './router'
import { permissionDirective } from './directives/permission.js'
import { installErrorTracking, reportError } from './utils/track.js'
import { initRum } from './utils/rum.js'
import './styles/index.scss'

const app = createApp(App)

// 全局错误兜底：统一捕获未处理的组件/渲染错误，带上下文记录，避免整页白屏
app.config.errorHandler = (err, instance, info) => {
  reportError('vue-error', err?.message || err, { info, stack: err?.stack })
}

app.use(createPinia())
app.use(router)
app.directive('permission', permissionDirective)

// 未处理 Promise rejection 追踪
installErrorTracking()

// RUM 基础监控（FCP/LCP/CLS/慢请求）
initRum()

app.mount('#app')
