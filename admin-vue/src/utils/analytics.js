// 统一操作埋点：事件名 event:xxx + props:{}，本地记录到 log store
// 命名规范：event:{领域}:{动作}，如 auth:login, user:create, user:export, user:ban, user:undo, role:change
import { useLogStore } from '@/store/log.js'

function trackEvent(event, props = {}) {
  const entry = { event, props, ts: new Date().toISOString() }
  try {
    const logStore = useLogStore()
    logStore.addLog({
      action: '埋点:' + event,
      module: '埋点',
      target: Object.keys(props).slice(0, 2).map(k => k + '=' + props[k]).join(', ').slice(0, 60),
      extra: JSON.stringify(entry).slice(0, 200)
    })
  } catch (e) {}
  console.info('[trackEvent]', entry)
}

export { trackEvent }
