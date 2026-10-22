/**
 * 分销中心数据模块
 * 包含：分销团队、返佣流水
 * 数据来源：旧版 databus.js seedDistTeam、seedDistFlows
 */

const now = Date.now()
const DAY = 864e5
const t = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)
const th = (d, h) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10) + ' ' + (h || '10:00')

// ========== 分销团队 ==========
const seedDistTeam = [
  { id: 'T1', uid: 'u2', name: '李明', company: '××建材有限公司', level: 1, active: true, joinedAt: t(42), orders: 6, credit: 12000, note: '' },
  { id: 'T2', uid: 'u5', name: '张涛', company: '××劳务有限公司', level: 1, active: true, joinedAt: t(30), orders: 4, credit: 8600, note: '' },
  { id: 'T3', uid: 'u3', name: '王芳', company: '××建设有限公司', level: 1, active: true, joinedAt: t(21), orders: 3, credit: 5200, note: '' },
  { id: 'T4', uid: 'u6', name: '刘洋', company: '××装饰工程有限公司', level: 1, active: false, joinedAt: t(15), orders: 1, credit: 1200, note: '30 天未活跃' },
  { id: 'T5', uid: 'u4', name: '张敏', company: '××工程咨询有限公司', level: 2, uplineId: 'T1', active: true, joinedAt: t(12), orders: 2, credit: 3400, note: '' }
  /* [M4-7] T6 原误挂 uid=u7(游客)，已移除；游客不计分销团队 */
]

// ========== 返佣流水（[M4-6] 充值不计入返佣基数，移除 recharge 来源流水） ==========
const seedDistFlows = [
  { id: 'DF002', tier: 't2', source: 'order', member: '张涛', uid: 'u5', amount: 1533, fee: 46, rate: 0.03, status: 'settled', ts: th(6, '08:41'), note: '二级分销 | 订单返佣' },
  { id: 'DF003', tier: 't1', source: 'entry', member: '王芳', uid: 'u3', amount: 4167, fee: 500, rate: 0.12, status: 'pending', ts: th(7, '16:05'), note: '一级分销 | 入驻返佣' },
  { id: 'DF005', tier: 't2', source: 'order', member: '张敏', uid: 'u4', amount: 2200, fee: 66, rate: 0.03, status: 'pending', ts: th(11, '09:15'), note: '二级分销 | 订单返佣' }
]

// ========== 内存缓存 ==========
let _teamCache = null
let _flowsCache = null

// ========== 团队 API ==========
export function listTeam() {
  if (!_teamCache) _teamCache = JSON.parse(JSON.stringify(seedDistTeam))
  return _teamCache
}

// ========== 流水 API ==========
export function listFlows() {
  if (!_flowsCache) _flowsCache = JSON.parse(JSON.stringify(seedDistFlows))
  return _flowsCache
}

export function settleFlow(id) {
  const list = listFlows()
  const item = list.find(f => f.id === id)
  if (!item || item.status !== 'pending') return null
  item.status = 'settled'
  item.settledAt = Date.now()
  return item
}

export function payFlow(id) {
  const list = listFlows()
  const item = list.find(f => f.id === id)
  if (!item || item.status !== 'settled') return null
  item.status = 'paid'
  item.paidAt = Date.now()
  return item
}

// ========== 统计 ==========
export function stat() {
  const team = listTeam()
  const flows = listFlows()
  const st = {
    team: team.length,
    active: team.filter(m => m.active).length,
    t1Fee: 0,
    t2Fee: 0,
    pending: 0,
    settled: 0,
    paid: 0
  }
  flows.forEach(f => {
    if (f.tier === 't1') st.t1Fee += f.fee || 0
    else st.t2Fee += f.fee || 0
    if (f.status === 'pending') st.pending++
    else if (f.status === 'settled') st.settled++
    else if (f.status === 'paid') st.paid++
  })
  st.t1Fee = Math.round(st.t1Fee * 100) / 100
  st.t2Fee = Math.round(st.t2Fee * 100) / 100
  return st
}

export default { listTeam, listFlows, settleFlow, payFlow, stat }
