/**
 * provinceBridge.js —— M2-2 双端审核桥接（方案A 共享种子导出，demo 最小闭环）
 * ----------------------------------------------------------------------------
 * admin(:5173) 与 App(:8767) 跨源不共享 localStorage、无后端。
 * 本模块在 admin 内存维护审核/终止动作队列，导出 engchain-agent-seed/1 JSON，
 * 由 App 侧「导入审核种子」落盘（js/agent-bridge.js 负责事务式应用与四道校验）。
 * 生产演进：替换为真实后端审核 API + 事件推送，本模块为 demo 隔离层，不编造后端。
 *
 * 说明：admin 无法直接引用工程根 js/agent-rules.js（Vite 根隔离），
 * 此处内嵌与 M1-3 一致的最小校验镜像；权威校验在 App 导入侧 js/agent-bridge.js 复跑。
 */

const SCHEMA = 'engchain-agent-seed/1'

/* 与 js/agent-rules.js 一致的合法边镜像（M1-7） */
const PROVINCE_EDGES = {
  active: ['suspended', 'terminated', 'revoked'],
  suspended: ['active', 'terminated', 'revoked'],
  terminated: [],
  revoked: []
}
const SUB_EDGES = {
  pending: ['approved', 'rejected'],
  approved: ['removed', 'terminated'],
  suspended: ['approved', 'removed', 'terminated'],
  removed: [],
  terminated: [],
  rejected: ['pending']
}

const queue = []

export function pushAction(action) {
  queue.push({ at: Date.now(), ...action })
  return queue.length
}

export function clearQueue() {
  queue.length = 0
}

export function listQueue() {
  return queue.slice()
}

export function removeAction(index) {
  queue.splice(index, 1)
}

export function buildSeed(meta = {}) {
  return {
    schema: SCHEMA,
    exportedAt: Date.now(),
    meta,
    actions: queue.slice()
  }
}

export function seedToText(seed) {
  return JSON.stringify(seed, null, 2)
}

/* ---------- 内嵌最小校验镜像（权威校验在 App 导入侧复跑） ---------- */
function normUscc(s) { return String(s || '').trim().toUpperCase().replace(/\s+/g, '') }

/**
 * M2-3 直接指定开通前置校验：失败返回 {ok:false,code,msg}，不落占位。
 * existing: 当前在册总代列表（active/suspended），用于省独家/uscc 唯一/一人一省。
 */
export function validateDirectGrant(form, existing = []) {
  if (form.isNaturalPerson) return { ok: false, code: 'E_NATURAL_PERSON_FORBIDDEN', msg: '自然人不能登记为省级总代主体' }
  if (!form.companyName || !form.companyName.trim()) return { ok: false, code: 'E_COMPANY_EMPTY', msg: '请填写分公司名称' }
  if (!normUscc(form.uscc)) return { ok: false, code: 'E_USCC_EMPTY', msg: '请填写统一社会信用代码' }
  if (!form.license || !form.license.trim()) return { ok: false, code: 'E_LICENSE_REQUIRED', msg: '请填写营业执照' }
  if (!form.province || !form.province.trim()) return { ok: false, code: 'E_PROVINCE_EMPTY', msg: '请选择意向授权省' }
  if (!form.legalRep || !form.legalRep.trim()) return { ok: false, code: 'E_LEGALREP_EMPTY', msg: '请填写法定代表人' }
  const uscc = normUscc(form.uscc)
  for (const a of existing) {
    if (a.status !== 'active' && a.status !== 'suspended') continue
    if (a.province === form.province) return { ok: false, code: 'E_PROVINCE_TAKEN', msg: '该省已独家授权，不可重复开通' }
    if (normUscc(a.branchCompany && a.branchCompany.uscc) === uscc) return { ok: false, code: 'E_USCC_DUPLICATE', msg: '统一社会信用代码已绑定在册总代' }
    if (form.uid && a.uid === form.uid) return { ok: false, code: 'E_ONE_PROVINCE_PER_SUBJECT', msg: '同一主体已在册另一省' }
  }
  return { ok: true }
}

/** M2-7 终止态合法边校验（镜像 M1-7） */
export function canTransition(kind, from, to) {
  const edges = kind === 'province' ? PROVINCE_EDGES : SUB_EDGES
  return Array.isArray(edges[from]) && edges[from].includes(to)
}

export { SCHEMA, PROVINCE_EDGES, SUB_EDGES }
