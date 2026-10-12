/**
 * 系统数据模块
 * 包含：操作日志、消息中心、快捷短语
 * 数据来源：旧版 databus.js audit、seedMessages
 */

const now = Date.now()
const DAY = 864e5
const t = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)

// ========== 操作日志（种子数据） ==========
const seedAuditLogs = [
  { ts: now - 1 * 3600e3, operator: '周平台', action: '认证通过', module: '认证审核', target: '陈建国', extra: '实名认证 · 已同步当前账号' },
  { ts: now - 2 * 3600e3, operator: '周平台', action: '供需上架', module: '运营中心', target: 'SU002', extra: '水泥供应信息审核通过' },
  { ts: now - 5 * 3600e3, operator: '运营A', action: '提现通过', module: '提现审批', target: '陈建国', extra: '¥400 已打款' },
  { ts: now - 8 * 3600e3, operator: '运营A', action: '入驻通过', module: '入驻审核', target: '李雅', extra: '中介服务企业 入驻费 ¥2980' },
  { ts: now - 1 * DAY, operator: '风控B', action: '违规处罚', module: '风控合规', target: '赵磊 · 成都××机械租赁有限公司', extra: '警告 · 疑似跳单预警' },
  { ts: now - 1 * DAY, operator: '周平台', action: '佣金结算', module: '佣金结算', target: '中介撮合 · 安许代办承诺制', extra: '¥1250 @5%' },
  { ts: now - 2 * DAY, operator: '运营A', action: '发票开票', module: '发票管理', target: '××工程咨询有限公司', extra: '¥5000 · 已开票' },
  { ts: now - 2 * DAY, operator: '周平台', action: '登录', module: '账号', target: '周平台', extra: '切换账号：平台内部 · 运营' }
]

// ========== 消息中心 ==========
const seedMessages = [
  { id: 'MSG1005', type: '公告', title: '破冰期扶持政策延续', body: '建筑企业 0 元入驻、中介 5 折优惠延续至本月底，注册即送 3 条免费解锁额度。', target: '全部用户', ts: t(1), action: { label: '查看活动', href: '#' } },
  { id: 'MSG1004', type: '系统', title: '对公转账入账优化', body: '对公转账审批通过后将自动入账至钱包余额，无需手动确认。', target: '入驻企业', ts: t(2), action: { label: '查看钱包', href: '#' } },
  { id: 'MSG1003', type: '风控', title: '防跳单治理规则提醒', body: '平台将对线下跳单行为实施警告、禁聊、罚款直至清退处罚，请遵守撮合规则。', target: '全部用户', ts: t(4) },
  { id: 'MSG1002', type: '活动', title: '共创者计划招募', body: '诚邀建筑企业与建筑人加入首批共创成员，享流量扶持与佣金阶段性减免。', target: '认证企业', ts: t(6), action: { label: '立即参与', href: '#' } },
  { id: 'MSG1001', type: '系统', title: '平台例行维护通知', body: '本周六 02:00-04:00 系统例行维护，期间部分功能暂不可用，敬请谅解。', target: '全部用户', ts: t(8) }
]

// ========== 快捷短语 ==========
const seedPhrases = [
  { id: 'P1', category: '认证审核', content: '您提交的材料不齐全，请补充营业执照原件照片后重新提交。' },
  { id: 'P2', category: '认证审核', content: '恭喜您，企业认证已通过，有效期一年。' },
  { id: 'P3', category: '入驻审核', content: '您的入驻申请已通过初审，请耐心等待终审结果。' },
  { id: 'P4', category: '内容审核', content: '您发布的供需信息已通过审核，现已上架展示。' },
  { id: 'P5', category: '内容审核', content: '您发布的信息不符合平台规范，已被驳回，请修改后重新发布。' },
  { id: 'P6', category: '提现审批', content: '您的提现申请已通过，资金将在1-3个工作日内到账。' },
  { id: 'P7', category: '风控合规', content: '经核查，您存在线下跳单行为，已被警告处理，请遵守平台规则。' },
  { id: 'P8', category: '通用', content: '您好，请问有什么可以帮助您的？' }
]

// ========== 内存缓存 ==========
let _auditCache = null
let _msgCache = null
let _phraseCache = null

// ========== 操作日志 API ==========
export function listAuditLogs() {
  if (!_auditCache) _auditCache = JSON.parse(JSON.stringify(seedAuditLogs))
  return _auditCache
}

export function addAuditLog(action, module, target, extra) {
  const list = listAuditLogs()
  const log = {
    ts: Date.now(),
    operator: '当前管理员',
    action, module, target, extra: extra || ''
  }
  list.unshift(log)
  if (list.length > 200) list.length = 200
  return log
}

// ========== 消息 API ==========
export function listMessages() {
  if (!_msgCache) _msgCache = JSON.parse(JSON.stringify(seedMessages))
  return _msgCache
}

export function publishMessage(msg) {
  const list = listMessages()
  const newMsg = {
    id: 'MSG' + String(Date.now()).slice(-5),
    type: msg.type || '公告',
    title: msg.title || '',
    body: msg.body || '',
    target: msg.target || '全部用户',
    ts: new Date().toISOString().slice(0, 10),
    admin: true,
    action: msg.action || null
  }
  list.unshift(newMsg)
  return newMsg
}

// ========== 快捷短语 API ==========
export function listPhrases() {
  if (!_phraseCache) _phraseCache = JSON.parse(JSON.stringify(seedPhrases))
  return _phraseCache
}

export default { listAuditLogs, addAuditLog, listMessages, publishMessage, listPhrases }
