/**
 * 财务数据模块
 * 包含：提现、发票、佣金流水、违规处罚
 * 数据来源：旧版 databus.js 各 seed 函数
 */

const now = Date.now()
const DAY = 864e5
const t = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)
const th = (d, h) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10) + ' ' + (h || '10:00')

// ========== 提现数据 ==========
const seedWithdrawals = [
  { id: 'WD20260904001', uid: 'u1', userName: '陈建国', amount: 500, method: 'bank', bank: '招商银行 · 尾号 1234', status: 'pending', appliedAt: now - 2 * 3600e3, note: '' },
  { id: 'WD20260904002', uid: 'u5', userName: '赵磊', amount: 300, method: 'alipay', bank: '支付宝 · 赵*磊', status: 'pending', appliedAt: now - 5 * 3600e3, note: '' },
  { id: 'WD20260903011', uid: 'u1', userName: '陈建国', amount: 400, method: 'bank', bank: '招商银行 · 尾号 1234', status: 'paid', appliedAt: now - 26 * 3600e3, paidAt: now - 25 * 3600e3, note: '' },
  { id: 'WD20260902018', uid: 'u6', userName: '刘洋', amount: 600, method: 'bank', bank: '工商银行 · 尾号 8899', status: 'rejected', appliedAt: now - 3 * DAY, note: '到账信息不完整' }
]

// ========== 发票数据 ==========
const seedInvoices = [
  { id: 'INV20260904001', title: '四川省××建设有限公司', tax: '91510100MA6C9LKD1X', type: '增值税专用发票', amount: 8600, status: 'pending', applyAt: t(0), note: '' },
  { id: 'INV20260903012', title: '××工程咨询有限公司', tax: '91510100MA5A1B2C3D', type: '增值税专用发票', amount: 5000, status: 'issued', applyAt: t(1), note: '' },
  { id: 'INV20260902007', title: '四川××机械租赁有限公司', tax: '91510100MA6B2C3D4E', type: '增值税普通发票', amount: 1280, status: 'shipped', applyAt: t(2), note: '' },
  { id: 'INV20260901005', title: '成都××建材供应有限公司', tax: '91510100MA7C3D4E5F', type: '增值税普通发票', amount: 960, status: 'void', applyAt: t(3), note: '信息有误，已作废' }
]

// ========== 佣金流水 ==========
const seedCommissionFlows = [
  { orderId: 'EN20260831009', uid: 'u2', userName: '李雅', title: '中介撮合 · 安许代办承诺制', amount: 25000, rate: 0.05, fee: 1250, milestones: '整单', settledAt: now - 2 * DAY, status: 'done' },
  { orderId: 'EN20260828007', uid: 'u2', userName: '李雅', title: '中介撮合 · 工商注册加急代办', amount: 8800, rate: 0.05, fee: 440, milestones: '整单', settledAt: now - 3 * DAY, status: 'done' }
]

// ========== 违规处罚 ==========
const seedViolations = [
  { id: 'VIO001', uid: 'u5', userName: '赵磊', company: '成都××机械租赁有限公司', level: 'warn', desc: '撮合后绕开平台线下交易（订单 EN20260903058 疑似跳单）', ts: t(2), status: 'open', note: '' },
  { id: 'VIO002', uid: 'u3', userName: '王强', company: '××工程咨询有限公司', level: 'serious', desc: '多次线下接单规避平台佣金', ts: t(5), status: 'open', note: '' }
]

// ========== 内存缓存 ==========
let _wdCache = null
let _invCache = null
let _commCache = null
let _vioCache = null

// ========== 提现 API ==========
export function listWithdrawals() {
  if (!_wdCache) _wdCache = JSON.parse(JSON.stringify(seedWithdrawals))
  return _wdCache
}

export function withdrawalApprove(id, note) {
  const list = listWithdrawals()
  const item = list.find(w => w.id === id)
  if (!item || item.status !== 'pending') return null
  item.status = 'paid'
  item.paidAt = Date.now()
  item.finalNote = note || ''
  return item
}

export function withdrawalReject(id, note) {
  const list = listWithdrawals()
  const item = list.find(w => w.id === id)
  if (!item || (item.status !== 'pending' && item.status !== 'first_ok')) return null
  item.status = 'rejected'
  item.note = note || '资料不完整'
  item.rejectedAt = Date.now()
  return item
}

// ========== 发票 API ==========
export function listInvoices() {
  if (!_invCache) _invCache = JSON.parse(JSON.stringify(seedInvoices))
  return _invCache
}

export function invoiceUpdate(id, status, note) {
  const list = listInvoices()
  const item = list.find(i => i.id === id)
  if (!item) return null
  item.status = status
  if (note) item.note = note
  return item
}

// ========== 佣金 API ==========
export function listCommissionFlows() {
  if (!_commCache) _commCache = JSON.parse(JSON.stringify(seedCommissionFlows))
  return _commCache
}

// ========== 违规 API ==========
export function listViolations() {
  if (!_vioCache) _vioCache = JSON.parse(JSON.stringify(seedViolations))
  return _vioCache
}

export function punishViolation(id, action) {
  const list = listViolations()
  const item = list.find(v => v.id === id)
  if (!item || item.status === 'done') return null
  item.status = 'done'
  item.note = action || '已处理'
  item.punish = { action: action || '警告', at: Date.now(), operator: '平台管理员' }
  return item
}

// ========== 处罚档位 ==========
export const PUNISH_STEPS = [
  { id: 'warn', label: '警告' },
  { id: 'ban7', label: '禁聊 7 天' },
  { id: 'ban30', label: '二次禁聊 30 天' },
  { id: 'fine', label: '罚款 ¥5,000' },
  { id: 'freeze15', label: '停号 15 天' },
  { id: 'remove', label: '二次清退' }
]

export default {
  listWithdrawals, withdrawalApprove, withdrawalReject,
  listInvoices, invoiceUpdate,
  listCommissionFlows,
  listViolations, punishViolation,
  PUNISH_STEPS
}
