// RUM 基础监控：PerformanceObserver 采 FCP/LCP/CLS，慢请求>2s 标记
import { useLogStore } from '@/store/log.js'

const metrics = { fcp: 0, lcp: 0, cls: 0, slowRequests: [] }

function initRum() {
  try {
    // FCP
    new PerformanceObserver((list) => {
      for (const e of list.getEntriesByName('first-contentful-paint')) {
        metrics.fcp = Math.round(e.startTime)
      }
    }).observe({ type: 'paint', buffered: true })

    // LCP
    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1]
      if (last) metrics.lcp = Math.round(last.startTime)
    }).observe({ type: 'largest-contentful-paint', buffered: true })

    // CLS
    let cls = 0
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) cls += e.value
      }
      metrics.cls = Math.round(cls * 1000) / 1000
    }).observe({ type: 'layout-shift', buffered: true })

    // 资源请求慢请求 >2s
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.duration > 2000) {
          metrics.slowRequests.push({ name: e.name.slice(0, 60), ms: Math.round(e.duration) })
        }
      }
    }).observe({ type: 'resource', buffered: true })
  } catch (e) {}
}

function getRum() {
  return { ...metrics }
}

// 落一条 RUM 汇总日志到日志 store
function logRumToStore() {
  try {
    const logStore = useLogStore()
    logStore.addLog({
      action: 'RUM 指标',
      module: '监控',
      target: `FCP:${metrics.fcp}ms LCP:${metrics.lcp}ms CLS:${metrics.cls}`,
      extra: `slow:${metrics.slowRequests.length} reqs`
    })
  } catch (e) {}
}

export { initRum, getRum, logRumToStore }
