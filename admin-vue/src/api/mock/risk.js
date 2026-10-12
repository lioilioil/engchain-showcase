/**
 * 风控合规数据模块
 * 包含：资质核验、企业监控、违规（与 finance.js 中的违规共享，此处为风控视角）
 * 数据来源：旧版 databus.js seedQualifications、loadMonitorFeed
 */

const now = Date.now()
const DAY = 864e5
const t = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)
const th = (d, h) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10) + ' ' + (h || '09:00')

// ========== 资质核验数据 ==========
const seedQualifications = [
  { id: 'QUA001', uid: 'u1', company: '四川省××建设有限公司', license: '91510100MA6×××12X', quals: ['建筑业企业资质 · 建筑工程施工总承包贰级'], geo: 92, source: 'AI 评估引擎 · 企业资质核验报告', status: 'verified', ts: t(28) },
  { id: 'QUA002', uid: 'u2', company: '四川××工程中介服务有限公司', license: '91510100MA6×××88Q', quals: ['房地产经纪机构备案', '工程造价咨询乙级'], geo: 88, source: 'AI 评估引擎 · 企业资质核验报告', status: 'verified', ts: t(24) },
  { id: 'QUA003', uid: 'u8', company: '四川××建设工程（集团）有限公司', license: '91510100MA6×××66K', quals: ['建筑业企业资质 · 市政公用工程施工总承包壹级'], geo: 95, source: 'AI 评估引擎 · 企业资质核验报告', status: 'verified', ts: t(15) }
]

// ========== 企业监控 Feed ==========
const seedMonitorFeed = [
  { company: '成都××机械租赁有限公司', dim: '风险', kind: 'warn', text: '出现 1 笔疑似跳单预警，已进入风控复核', ts: th(0, '10:40'), read: false },
  { company: '四川××工程中介服务有限公司', dim: '经营', kind: 'info', text: '新增 2 条服务评价，评分 4.8 保持高位', ts: th(1, '16:20'), read: false },
  { company: '四川省××建设有限公司', dim: '资金', kind: 'ok', text: '对公入账 ¥1,500 已确认，资金流正常', ts: th(2, '09:15'), read: false },
  { company: '××工程咨询有限公司', dim: '风险', kind: 'warn', text: '多次线下接单规避平台佣金，风险等级提升', ts: th(3, '14:05'), read: false }
]

// ========== 内存缓存 ==========
let _qualsCache = null
let _monitorCache = null

// ========== 资质核验 API ==========
export function listQualifications() {
  if (!_qualsCache) _qualsCache = JSON.parse(JSON.stringify(seedQualifications))
  return _qualsCache
}

// ========== 企业监控 API ==========
export function listMonitorFeed() {
  if (!_monitorCache) _monitorCache = JSON.parse(JSON.stringify(seedMonitorFeed))
  return _monitorCache
}

export function monitorStat() {
  const feed = listMonitorFeed()
  return {
    follows: 5,
    feed: feed.length,
    warn: feed.filter(f => f.kind === 'warn').length,
    ok: feed.filter(f => f.kind === 'ok').length
  }
}

export default { listQualifications, listMonitorFeed, monitorStat }
