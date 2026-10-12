/**
 * 竞态防护：快速切换筛选/Tab 时，旧请求不得覆盖新数据
 * 用法：
 *   const guard = createRequestGuard()
 *   async function load() {
 *     const token = guard.next()
 *     const data = await api.xxx()
 *     if (!guard.isCurrent(token)) return  // 已有更新请求，丢弃旧结果
 *     tableData.value = data
 *   }
 */
export function createRequestGuard() {
  let seq = 0
  return {
    next() { return ++seq },
    isCurrent(token) { return token === seq }
  }
}
