// 统一错误追踪：带 user/session/route 上下文，本地记录 + console，不打断交互
import { useUserStore } from '@/store/user.js'
import { useLogStore } from '@/store/log.js'

function ctx() {
  try {
    const u = useUserStore()
    return { user: u.name || '-', role: u.role || '-', route: location.hash, ts: new Date().toISOString() }
  } catch (e) {
    return { user: '-', route: location.hash }
  }
}

function reportError(source, message, extra = '') {
  const c = ctx()
  const entry = {
    source,
    message: String(message),
    ...c,
    extra: typeof extra === 'object' ? JSON.stringify(extra).slice(0, 200) : String(extra)
  }
  // 本地记录到日志 store（错误类）
  try {
    const logStore = useLogStore()
    logStore.addLog({ action: '错误:' + source, module: '错误追踪', target: String(message).slice(0, 60), extra: JSON.stringify(entry).slice(0, 200) })
  } catch (e) {}
  // console 输出（mock 上报端点）
  console.error('[trackError]', entry)
}

export function installErrorTracking() {
  // 未处理 Promise rejection
  window.addEventListener('unhandledrejection', (e) => {
    reportError('unhandledrejection', e.reason?.message || e.reason, e.reason?.stack)
  })
}

export { reportError }
