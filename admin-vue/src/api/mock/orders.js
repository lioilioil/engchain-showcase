/**
 * 订单数据模块
 * 数据来源：旧版 databus.js seedOrders()
 * 共 16 个订单，含状态机和里程碑
 */

const t = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)

// 里程碑配置（与旧版 data.js commission.milestone 同源）
const MILESTONE_CONFIG = {
  enable: true,
  minAmount: 50000,
  nodes: [0.3, 0.3, 0.3, 0.1],
  labels: ['合同签订', '服务进度50%', '验收', '质保期满']
}

/**
 * 佣金计算（与旧版 commissionRate 同口径）
 * 阶梯费率：5万以下5%，5-20万8%，20-50万10%，50万以上12%
 */
export function orderCalc(amount) {
  let rate = 0.08
  if (amount < 50000) rate = 0.05
  else if (amount < 200000) rate = 0.08
  else if (amount < 500000) rate = 0.10
  else rate = 0.12
  const fee = Math.round(amount * rate * 100) / 100

  const multi = MILESTONE_CONFIG.enable && amount >= MILESTONE_CONFIG.minAmount
  const nodes = multi ? MILESTONE_CONFIG.nodes : [1]
  const labels = multi ? MILESTONE_CONFIG.labels : ['整单结算']
  const items = nodes.map((p, i) => ({
    label: labels[i] || `节点${i + 1}`,
    pct: p,
    fee: Math.round(fee * p * 100) / 100
  }))

  return { rate, fee, milestone: multi, items }
}

// 生成单个订单
function mk(id, type, title, amount, owner, counterparty, counterpartyId, status, day) {
  const calc = orderCalc(amount)
  const multi = calc.milestone
  const nodes = multi ? MILESTONE_CONFIG.nodes : [1]
  const labels = multi ? MILESTONE_CONFIG.labels : ['整单结算']
  const milestones = nodes.map((p, i) => ({
    label: labels[i] || `节点${i + 1}`,
    pct: p,
    status: 'todo',
    doneAt: 0
  }))

  let fee = 0
  let rate = 0
  if (status === 'settled') {
    milestones.forEach(m => { m.status = 'done'; m.doneAt = Date.now() })
    fee = calc.fee
    rate = calc.rate
  }

  return {
    id, type, title, amount, owner, counterparty, counterpartyId: counterpartyId || '',
    status, ts: t(day), milestones, fee, rate, note: '',
    contactPhone: '13' + String(80000000 + (id.charCodeAt(id.length - 2) * 137 + id.charCodeAt(id.length - 1) * 911) % 90000000).slice(0, 9)
  }
}

// 订单种子数据（与旧版完全一致）
const seedOrders = [
  mk('EN20260904001', 'supply', '商品混凝土供应承接 · 天府新区综合体', 320000, 'u1', '四川中建××建设有限公司', 'u2', 'settled', 1),
  mk('EN20260903058', 'need', '塔吊租赁需求匹配 · 重庆江津河道治理', 86000, 'u5', '成都××机械租赁有限公司', 'u1', 'serving', 2),
  mk('EN20260903021', 'agency', '中介撮合 · 资质升级代办（二升一）', 500000, 'u2', '××建设集团有限公司', 'u1', 'await_accept', 3),
  mk('EN20260902094', 'supply', '劳务班组供应承接 · 贵阳旧改防水分包', 45200, 'u1', '贵阳××建设有限公司', 'u3', 'serving', 4),
  mk('EN20260902012', 'need', '砂石料采购匹配 · 西安浐灞项目', 12800, 'u5', '西安××建设集团有限公司', 'u2', 'cancelled', 5),
  mk('EN20260901077', 'transfer', '建企买卖 · 公路二级整体转让', 580000, 'u1', '××路桥建设工程有限公司', 'u5', 'serving', 6),
  mk('EN20260901033', 'qual', '资质招商 · 电力一级分公司合作', 200000, 'u1', '贵州黔电电力工程有限公司', 'u3', 'pending', 6),
  mk('EN20260831009', 'agency', '中介撮合 · 安许代办承诺制', 25000, 'u2', '××企业管理咨询有限公司', 'u3', 'settled', 8),
  mk('EN20260831021', 'supply', '水泥供应承接 · 成都双流仓', 96000, 'u3', '成都××建材供应有限公司', 'u1', 'serving', 8),
  mk('EN20260830055', 'need', '汽车吊租赁匹配 · 西安泾河项目', 54000, 'u5', '成都××工程机械有限公司', 'u2', 'await_accept', 9),
  mk('EN20260830018', 'transfer', '建企买卖 · 机电一级带安许转让', 420000, 'u1', '××机电安装工程有限公司', 'u5', 'pending', 9),
  mk('EN20260829003', 'qual', '资质招商 · 水利二级联营合作', 0, 'u3', '××水利水电工程有限公司', 'u2', 'cancelled', 10),
  mk('EN20260828044', 'supply', '水电班组承接 · 成都金牛项目', 61000, 'u3', '四川××水电安装有限公司', 'u1', 'serving', 11),
  mk('EN20260828007', 'agency', '中介撮合 · 工商注册加急代办', 8800, 'u2', '××企业管理服务有限公司', 'u5', 'settled', 11),
  mk('EN20260827019', 'need', '防水分包匹配 · 西安浐灞旧改', 33200, 'u5', '××防水工程有限公司', 'u3', 'settled', 12),
  mk('EN20260827031', 'supply', '塔吊整机租赁承接 · 成都辐射西南', 158000, 'u1', '××建设集团有限公司', 'u2', 'pending', 12)
]

// 内存缓存
let _ordersCache = null

/**
 * 获取订单列表
 */
export function list() {
  if (!_ordersCache) {
    _ordersCache = JSON.parse(JSON.stringify(seedOrders))
  }
  return _ordersCache
}

/**
 * 按 ID 获取订单
 */
export function byId(id) {
  const orders = list()
  return orders.find(o => o.id === id) || null
}

/**
 * 状态迁移（与旧版 orderTransition 同口径）
 */
export function transition(id, next, patch = {}) {
  const orders = list()
  const idx = orders.findIndex(o => o.id === id)
  if (idx < 0) return null

  const order = orders[idx]
  const allowMap = {
    pending: ['serving', 'cancelled'],
    serving: ['await_accept', 'cancelled'],
    await_accept: ['settled', 'cancelled'],
    settled: [],
    cancelled: []
  }
  const allowed = allowMap[order.status] || []
  if (!allowed.includes(next)) {
    return { error: `非法状态迁移: ${order.status} → ${next}` }
  }

  order.status = next
  Object.assign(order, patch)

  // 到达结算：按里程碑比例计提佣金
  if (next === 'settled') {
    const calc = orderCalc(order.amount)
    let donePct = 0
    order.milestones.forEach(m => { if (m.status === 'done') donePct += m.pct })
    order.fee = Math.round(calc.fee * (donePct > 0 ? donePct : 1) * 100) / 100
    order.rate = calc.rate
  }

  order.updatedAt = Date.now()
  return order
}

/**
 * 推进里程碑
 */
export function advanceMilestone(id, idx) {
  const orders = list()
  const order = orders.find(o => o.id === id)
  if (!order) return null
  if (order.status !== 'serving' && order.status !== 'await_accept') {
    return { error: '当前状态不可推进里程碑' }
  }
  if (!order.milestones[idx]) return { error: '里程碑节点不存在' }
  if (order.milestones[idx].status === 'done') return { error: '该节点已达成' }

  order.milestones[idx].status = 'done'
  order.milestones[idx].doneAt = Date.now()

  const allDone = order.milestones.every(m => m.status === 'done')
  if (allDone && order.status === 'serving') {
    order.status = 'await_accept'
  }
  order.updatedAt = Date.now()
  return order
}

export default { list, byId, transition, advanceMilestone, orderCalc }
