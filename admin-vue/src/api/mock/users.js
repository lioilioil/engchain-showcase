/**
 * 用户数据模块
 * 数据来源：旧版 databus.js seedUsers()
 * 共 10 个用户画像，覆盖六级身份 × 三类入驻 × 差异权益
 */

const now = Date.now()
const DAY = 864e5
const YEAR = 365 * DAY

// 用户种子数据（与旧版完全一致）
const seedUsers = [
  {
    id: 'u1', name: '陈建国', company: '四川省××建设有限公司', account: 'chenjianguo@engchain.cn', pwd: 'demo8888',
    mobile: '13800001234', avatar: '陈', tag: '入驻企业 · 建筑', status: 'resident',
    identity: { personal: 'verified', enterprise: 'resident', entryTypes: ['construction'] },
    auth: {
      realname: { ok: true, ts: now - DAY * 30, name: '陈建国', idNo: '', mobile: '138****1234', idMask: '' },
      enterprise: { ok: true, expireAt: now + YEAR, co: '四川省××建设有限公司', code: '91510100MA6×××12X', legal: '陈建国', shortName: '川×建设', nameBasis: '品牌简称', nameProof: [] },
      personalQual: { ok: false, list: [] },
      enterpriseQual: { ok: true, list: ['建筑业企业资质 · 建筑工程施工总承包贰级'] },
      qual: { ok: true, list: ['建筑业企业资质 · 建筑工程施工总承包贰级'] },
      payment: { ok: true, ts: now - DAY * 60 }
    },
    entry: {
      type: 'construction', types: ['construction'], orderId: 'EN20260601001', status: 'active', active: true,
      paidAt: now - DAY * 60, expireAt: now + YEAR, depositType: 'basic', depositPaid: 5000, fee: 2980,
      contact: '陈建国', tel: '13800001234',
      scope: '房屋建筑工程 · 市政公用工程 · 建筑装修装饰工程 · 机电设备安装工程 · 建筑幕墙工程 · 钢结构工程 · 地基基础工程 · 环保工程 · 城市及道路照明工程 · 特种工程（结构补强）',
      qualifications: [
        { name: '建筑工程施工总承包', level: '贰级', no: 'D2510××××', expireAt: '2027-12-31', image: '' },
        { name: '市政公用工程施工总承包', level: '叁级', no: 'D3510××××', expireAt: '2026-06-30', image: '' }
      ],
      intro: {
        founded: '2008', capital: '5000', staffSize: '101-500人',
        desc: '四川省××建设有限公司成立于2008年，是一家集房屋建筑、市政公用、装饰装修、机电安装于一体的综合性建筑施工企业。公司注册资本5000万元，拥有建筑工程施工总承包贰级、市政公用工程施工总承包叁级等多项资质。现有员工300余人，其中高级工程师20人，一级建造师15人，二级建造师30人。公司先后承建了成都天府新区多个重点项目，累计施工面积超过200万平方米，工程合格率100%，多次获得"四川省优质工程奖"、"成都市安全文明工地"等荣誉。公司秉承"质量第一、信誉至上"的经营理念，致力于为客户提供优质、高效、安全的建筑服务。'
      },
      cases: [
        { name: '成都天府新区××商业综合体项目', type: '房屋建筑', amount: '32000', startDate: '2023-03-01', endDate: '2025-06-30', desc: '项目位于成都天府新区核心商务区，总建筑面积约18万平方米，包含两栋甲级写字楼、一栋商业裙楼及地下三层车库。我司承担总承包施工，涵盖基坑支护、主体结构、机电安装、装饰装修全流程。项目采用BIM技术进行全过程管理，荣获2024年度四川省建设工程"天府杯"银奖。施工期间实现零安全事故，主体结构提前45天封顶。', images: [] },
        { name: '成都市××市政道路改造工程', type: '市政公用', amount: '8600', startDate: '2022-05-01', endDate: '2023-11-30', desc: '项目对成都市武侯区三条主干道进行综合改造，道路总长4.2公里，包含路面翻新、雨污管网分流、绿化景观提升、照明系统更新及交通设施完善。施工期间采用半幅通行方案，最大限度减少对市民出行的影响。项目竣工验收评定为优良工程。', images: [] }
      ],
      address: { province: '四川省', city: '成都市', district: '武侯区', detail: '天府大道北段××号××大厦15楼' },
      website: 'https://www.sc-jianshe.example.com', attachments: []
    },
    balance: { balance: 1286.50, frozen: 200, totalIn: 13486.50 },
    credits: { balance: 2350, quota: { month: '', used: 0 } }
  },
  {
    id: 'u2', name: '李雅', company: '四川××工程中介服务有限公司', account: 'liya@engchain.cn', pwd: 'demo8888',
    mobile: '13700002345', avatar: '李', tag: '入驻企业 · 中介', status: 'resident',
    identity: { personal: 'verified', enterprise: 'resident', entryTypes: ['agency'] },
    auth: {
      realname: { ok: true, ts: now - DAY * 45 },
      enterprise: { ok: true, expireAt: now + YEAR },
      personalQual: { ok: false, list: [] },
      enterpriseQual: { ok: true, list: ['房地产经纪机构备案', '工程造价咨询乙级'] },
      qual: { ok: true, list: ['房地产经纪机构备案', '工程造价咨询乙级'] },
      payment: { ok: true, ts: now - DAY * 40 }
    },
    entry: { type: 'agency', types: ['agency'], orderId: 'EN20260615001', status: 'active', active: true, paidAt: now - DAY * 40, expireAt: now + YEAR, depositType: 'engineering', depositPaid: 20000 },
    balance: { balance: 8600, frozen: 1200, totalIn: 51200 },
    credits: { balance: 1200, quota: { month: '', used: 0 } }
  },
  {
    id: 'u3', name: '王强', company: '××工程咨询有限公司', account: 'wangqiang@engchain.cn', pwd: 'demo8888',
    mobile: '13600003456', avatar: '王', tag: '企业认证', status: 'enterprise',
    identity: { personal: 'verified', enterprise: 'verified', entryTypes: [] },
    auth: {
      realname: { ok: true, ts: now - DAY * 20 },
      enterprise: { ok: true, expireAt: now + YEAR },
      personalQual: { ok: false, list: [] },
      enterpriseQual: { ok: false, list: [] },
      qual: { ok: false, list: [] },
      payment: { ok: false, ts: 0 }
    },
    entry: { type: null, types: [], orderId: null, status: null, active: false, paidAt: 0, expireAt: 0, note: '' },
    balance: { balance: 320, frozen: 0, totalIn: 1320 },
    credits: { balance: 300, quota: { month: '', used: 0 } }
  },
  {
    id: 'u4', name: '张敏', company: '', account: 'zhangmin@engchain.cn', pwd: 'demo8888',
    mobile: '13900005678', avatar: '张', tag: '个人专业入驻', status: 'pro',
    identity: { personal: 'professional', enterprise: 'none', entryTypes: [] },
    auth: {
      realname: { ok: true, ts: now - DAY * 60, name: '张敏', idNo: '', mobile: '139****5678', idMask: '' },
      enterprise: { ok: false, expireAt: 0 },
      personalQual: { ok: true, list: ['一级建造师 · 建筑工程', '注册安全工程师'] },
      personalEntry: {
        ok: true, status: 'approved', note: '', submittedAt: now - DAY * 50,
        list: [{ name: '一级建造师（建筑工程）', no: 'JZ000××××', image: '' }, { name: '注册安全工程师', no: 'AQ000××××', image: '' }],
        certs: [],
        profile: {
          basic: { gender: '女', birth: '1990-06', location: '四川省成都市高新区', jobStatus: '在职-考虑机会', mobile: '13900005678' },
          education: [
            { school: '四川大学', major: '土木工程', degree: '本科', start: '2008-09', end: '2012-06', certFile: '' },
            { school: '西南交通大学', major: '建筑与土木工程', degree: '硕士', start: '2012-09', end: '2015-06', certFile: '' }
          ],
          work: [
            { company: '四川省××建设有限公司', position: '项目工程师', start: '2015-07', end: '2019-03', desc: '负责房建项目现场技术管理，参与3个总承包项目的施工组织设计编制与现场协调，管理施工班组约80人，完成产值约1.2亿元。' },
            { company: '成都××地产开发有限公司', position: '工程主管', start: '2019-04', end: '至今', desc: '负责地产项目工程管理，统筹总包、监理、分包单位，管控进度、质量、安全，累计管理项目面积约25万平方米。' }
          ],
          project: [
            { name: '成都天府新区××综合体', role: '现场技术负责人', time: '2017-2019', desc: '18万㎡商业综合体项目，负责主体结构施工技术管理，解决深基坑、高支模等技术难题。' },
            { name: '成都××住宅项目', role: '工程主管', time: '2020-2022', desc: '30万㎡住宅开发项目，统筹工程全流程管理，实现按期交付，业主满意度95%。' }
          ],
          skills: ['一级建造师', '注册安全工程师', 'BIM建模', '项目管理', '施工组织设计', '质量管控', '安全管理'],
          jobIntent: { position: '工程项目经理', salary: '25-35K', location: '成都', workType: '全职' },
          intro: '10年建筑行业从业经验，拥有一级建造师（建筑工程）和注册安全工程师双证。熟悉房建项目全流程管理，具备丰富的现场技术管理和团队协调经验。曾参与多个大型商业综合体和住宅项目建设，累计管理面积超50万平方米。工作认真负责，具备良好的沟通协调能力和抗压能力。',
          resumeFile: '张敏-个人简历.pdf'
        }
      },
      enterpriseQual: { ok: false, list: [] },
      qual: { ok: true, list: ['一级建造师 · 建筑工程', '注册安全工程师'] },
      payment: { ok: false, ts: 0 }
    },
    entry: { type: null, types: [], orderId: null, status: null, active: false, paidAt: 0, expireAt: 0, note: '' },
    balance: { balance: 150, frozen: 0, totalIn: 650 },
    credits: { balance: 800, quota: { month: '', used: 0 } }
  },
  {
    id: 'u5', name: '赵磊', company: '', account: 'zhaolei@engchain.cn', pwd: 'demo8888',
    mobile: '13500004567', avatar: '赵', tag: '个人认证', status: 'realname',
    identity: { personal: 'verified', enterprise: 'none', entryTypes: [] },
    auth: {
      realname: { ok: true, ts: now - DAY * 10 },
      enterprise: { ok: false, expireAt: 0 },
      personalQual: { ok: false, list: [] },
      enterpriseQual: { ok: false, list: [] },
      qual: { ok: false, list: [] },
      payment: { ok: false, ts: 0 }
    },
    entry: { type: null, types: [], orderId: null, status: null, active: false, paidAt: 0, expireAt: 0, note: '' },
    balance: { balance: 0, frozen: 0, totalIn: 500 },
    credits: { balance: 500, quota: { month: '', used: 0 } }
  },
  {
    id: 'u6', name: '刘洋', company: '', account: 'liuyang@engchain.cn', pwd: 'demo8888',
    mobile: '13400005678', avatar: '刘', tag: '注册会员', status: 'registered',
    identity: { personal: 'none', enterprise: 'none', entryTypes: [] },
    auth: {
      realname: { ok: false, ts: 0 },
      enterprise: { ok: false, expireAt: 0 },
      personalQual: { ok: false, list: [] },
      enterpriseQual: { ok: false, list: [] },
      qual: { ok: false, list: [] },
      payment: { ok: false, ts: 0 }
    },
    entry: { type: null, types: [], orderId: null, status: null, active: false, paidAt: 0, expireAt: 0, note: '' },
    balance: { balance: 0, frozen: 0, totalIn: 0 },
    credits: { balance: 100, quota: { month: '', used: 0 } }
  },
  {
    id: 'u7', name: '游客', company: '', account: '', pwd: '', avatar: '游', tag: '游客 · 未登录', status: 'guest',
    identity: { personal: 'none', enterprise: 'none', entryTypes: [] },
    auth: {
      realname: { ok: false, ts: 0 },
      enterprise: { ok: false, expireAt: 0 },
      personalQual: { ok: false, list: [] },
      enterpriseQual: { ok: false, list: [] },
      qual: { ok: false, list: [] },
      payment: { ok: false, ts: 0 }
    },
    entry: { type: null, types: [], orderId: null, status: null, active: false, paidAt: 0, expireAt: 0, note: '' },
    balance: { balance: 0, frozen: 0, totalIn: 0 },
    credits: { balance: 0, quota: { month: '', used: 0 } }
  },
  {
    /* [M4-4] u8 旧企业合伙人定点清零：回退为实名普通用户，移除 resident/partner 入驻与高额保证金 */
    id: 'u8', name: '周航', company: '', account: 'zhouhang@engchain.cn', pwd: 'demo8888',
    mobile: '13300008901', avatar: '周', tag: '实名用户', status: 'verified',
    identity: { personal: 'verified', enterprise: 'none', entryTypes: [] },
    auth: {
      realname: { ok: true, ts: now - DAY * 90 },
      enterprise: { ok: false, expireAt: 0 },
      personalQual: { ok: false, list: [] },
      enterpriseQual: { ok: false, list: [] },
      qual: { ok: false, list: [] },
      payment: { ok: false, ts: 0 }
    },
    entry: { type: null, types: [], orderId: null, status: null, active: false, paidAt: 0, expireAt: 0, note: '' },
    balance: { balance: 0, frozen: 0, totalIn: 0 },
    credits: { balance: 0, quota: { month: '', used: 0 } }
  },
  {
    id: 'u9', name: '孙小美', company: '', account: 'sunxiaomei@engchain.cn', pwd: 'demo8888',
    mobile: '13200009012', avatar: '孙', tag: '个人合伙人', status: 'partner',
    identity: { personal: 'partner', partner: true, enterprise: 'none', identities: ['realname', 'partner'], entryTypes: [] },
    auth: {
      realname: { ok: true, ts: now - DAY * 15, name: '孙小美', idNo: '', mobile: '138****6789', idMask: '' },
      enterprise: { ok: false, expireAt: 0 },
      personalQual: { ok: false, list: [] },
      personalEntry: { ok: false, status: '', list: [], certs: [], profile: { basic: {}, education: [], work: [], project: [], skills: [], jobIntent: {}, intro: '', resumeFile: '', regStatus: null, socialSecurity: null } },
      enterpriseQual: { ok: false, list: [] },
      partner: {
        ok: true, status: 'approved', note: '', submittedAt: now - DAY * 10, approvedAt: now - DAY * 8,
        channel: ['朋友圈', '社群', '短视频'], intent: '两者兼有',
        intro: '建筑行业5年从业经验，拥有丰富的行业人脉资源，擅长通过社群和短视频进行推广。',
        experience: '曾担任某建材公司区域经理，负责渠道拓展和客户维护，年销售额超500万。', profitConfig: {}
      },
      qual: { ok: false, list: [] },
      payment: { ok: false, ts: 0 }
    },
    entry: { type: null, types: [], orderId: null, status: null, active: false, paidAt: 0, expireAt: 0, note: '' },
    balance: { balance: 2680, frozen: 0, totalIn: 5680 },
    credits: { balance: 1200, quota: { month: '', used: 0 } }
  },
  {
    id: 'u10', name: '周平台', company: '工程链·平台运营组', account: 'platform@engchain.cn', pwd: 'demo8888',
    mobile: '13000000000', avatar: '周', tag: '平台内部 · 运营', status: 'resident',
    isPlatformStaff: true,
    identity: { personal: 'verified', enterprise: 'resident', entryTypes: ['construction', 'agency'], identities: ['realname', 'personal-entry', 'enterprise', 'entry'] },
    auth: {
      realname: { ok: true, ts: now - DAY * 365, name: '周平台', idNo: '', mobile: '130****0000', idMask: '' },
      enterprise: { ok: true, expireAt: now + YEAR, co: '工程链·平台运营组', code: '91510100PLATFORM001', legal: '周平台', shortName: '工程链运营' },
      personalQual: { ok: true, list: ['平台运营管理员资质'] },
      personalEntry: { ok: true, status: 'approved', list: [{ name: '平台运营管理员', no: 'PLAT-0001', image: '' }], certs: [], profile: { basic: {}, education: [], work: [], project: [], skills: [], jobIntent: {}, intro: '', resumeFile: '' } },
      /* [M4 收口] u10 平台运营不携带旧企业合伙人 partner 标记（isPlatformStaff/全量视角保留） */
      enterpriseQual: { ok: true, list: ['平台运营资质'] },
      qual: { ok: true, list: ['平台运营管理员资质'] },
      payment: { ok: true, ts: now - DAY * 365 }
    },
    entry: { type: 'construction', types: ['construction', 'agency'], orderId: 'PLAT-0001', status: 'active', active: true, paidAt: now - DAY * 365, expireAt: now + YEAR, depositType: 'basic', depositPaid: 0, fee: 0, contact: '周平台', tel: '13000000000', scope: '平台运营治理', qualifications: [], intro: { founded: '2026', capital: '-', staffSize: '平台方', desc: '工程链平台内部运营账号，拥有全部功能权限，用于演示平台治理视角。' }, cases: [], address: { province: '四川省', city: '成都市', district: '高新区', detail: '平台路1号' }, website: '', attachments: [] },
    balance: { balance: 0, frozen: 0, totalIn: 0 },
    credits: { balance: 0, quota: { month: '', used: 0 } }
  }
]

// 内存缓存
let _userCache = null

/* Demo 桥接：前端 App 提交的认证申请写入 localStorage 的 engchain-users（与前端 DataBus 同键），
   后台读取时按 id 合并，使「前端提交 → 后台可见 → 通过/驳回」在同一浏览器闭环。 */
const LS_KEY = 'engchain-users'

function readLS() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : null
  } catch {
    return null
  }
}

function writeLS(arr) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(arr)) } catch { /* 忽略写入失败 */ }
}

/**
 * 获取用户列表：种子为基底，localStorage(engchain-users) 中同 id 用户覆盖/并入
 */
export function list() {
  if (!_userCache) {
    _userCache = JSON.parse(JSON.stringify(seedUsers))
  }
  const ls = readLS()
  if (ls && ls.length) {
    const merged = new Map()
    _userCache.forEach(u => merged.set(u.id, u))
    ls.forEach(u => { if (u && u.id) merged.set(u.id, u) })
    _userCache = [...merged.values()]
  }
  return _userCache
}

/**
 * 把内存用户表持久化到 localStorage（审批通过/驳回后调用，刷新不还原、前端可见结果）
 */
export function save() {
  writeLS(list())
  return list()
}

/**
 * 按 ID 获取用户
 */
export function byId(id) {
  const users = list()
  return users.find(u => u.id === id) || null
}

/**
 * 按手机号获取用户
 */
export function byMobile(phone) {
  const p = String(phone || '').replace(/\s+/g, '')
  if (!p) return null
  const users = list()
  return users.find(u => u.mobile === p) || null
}

/**
 * 创建用户（mock：追加到内存数组）
 */
export function create(data) {
  const users = list()
  const newUser = { id: 'u' + (users.length + 1), ...data }
  users.push(newUser)
  return newUser
}

/**
 * 更新用户
 */
export function update(id, data) {
  const users = list()
  const idx = users.findIndex(u => u.id === id)
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...data }
    return users[idx]
  }
  return null
}

/**
 * 平台统计
 */
export function stats() {
  const users = list().filter(u => u.id !== 'u7') // 游客不计
  const resident = users.filter(u => u.entry?.active && u.entry?.status === 'active').length
  const enterprise = users.filter(u => u.auth?.enterprise?.ok).length
  const realname = users.filter(u => u.auth?.realname?.ok).length
  return {
    users: users.length,
    realname,
    enterprise,
    resident
  }
}

/**
 * 状态计算（与旧版 statusOf 同口径）
 */
export function statusOf(u) {
  if (u.banned) return 'banned'
  if (u.identity) {
    if (u.identity.enterprise === 'resident') return 'resident'
    if (u.identity.enterprise === 'verified') return 'enterprise'
    if (u.identity.partner) return 'partner'
    if (u.identity.personal === 'professional' || u.identity.personal === 'full') return 'pro'
    if (u.identity.personal === 'verified') return 'realname'
    return (u.status === 'guest') ? 'guest' : 'registered'
  }
  return u.status || 'registered'
}

/**
 * 标签计算（与旧版 tagOf 同口径）
 */
export function tagOf(u) {
  if (u.banned) return '已封禁'
  const st = statusOf(u)
  /* [M4-4] 旧企业合伙人 partner 标签已摘除；个人合伙人(st=partner)在下方单独映射 */
  const TYPE_LABEL = { construction: '建筑企业', agency: '中介服务企业' }
  if (st === 'resident') {
    const et = u.identity?.entryTypes?.[0] || u.entry?.type
    return '企业入驻 · ' + (TYPE_LABEL[et] || '')
  }
  if (st === 'enterprise') return '企业认证'
  if (st === 'partner') return '个人合伙人'
  if (st === 'pro') return '个人入驻'
  if (st === 'realname') return '个人认证'
  if (st === 'guest') return '游客 · 未登录'
  return '注册会员'
}

export default { list, byId, byMobile, create, update, save, stats, statusOf, tagOf }
