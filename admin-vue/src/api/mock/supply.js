/**
 * 供需/撮合数据模块
 * 数据来源：旧版 databus.js seedSupply()
 * 共 24 条供需演示条目
 */

const t = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)

// 供需种子数据（与旧版完全一致）
const seedSupply = [
  { id: 'SU001', cat: '材料', dir: 'demand', title: '成都天府新区商业综合体 急需商品混凝土 C30/C40', company: '四川中建××建设有限公司', location: '成都·天府新区', amount: '¥1,350,000', publisher: 'u1', status: 'on', ts: t(1), note: '' },
  { id: 'SU002', cat: '材料', dir: 'supply', title: '供应 P.O42.5 散装水泥/商品砂浆 厂家直发 成都仓', company: '成都××建材供应有限公司', location: '成都·双流', amount: '¥860,000', publisher: 'u3', status: 'on', ts: t(2), note: '' },
  { id: 'SU003', cat: '设备', dir: 'demand', title: '重庆江津 河道治理工程 急租 塔吊 QTZ63', company: '重庆××水利工程有限公司', location: '重庆·江津', amount: '¥420,000', publisher: 'u5', status: 'pending', ts: t(0), note: '' },
  { id: 'SU004', cat: '设备', dir: 'supply', title: '供应 塔吊/施工电梯 整机租赁 成都辐射西南', company: '成都××机械租赁有限公司', location: '成都·高新区', amount: '¥260,000', publisher: 'u1', status: 'on', ts: t(3), note: '' },
  { id: 'SU005', cat: '劳务', dir: 'demand', title: '贵阳乌当区老旧小区改造 防水项目分包', company: '贵阳××建设有限公司', location: '贵阳·乌当', amount: '¥180,000', publisher: 'u3', status: 'pending', ts: t(0), note: '' },
  { id: 'SU006', cat: '劳务', dir: 'supply', title: '供应 钢筋工/木工/混凝土工 劳务班组 可进场', company: '四川××劳务分包有限公司', location: '成都·青白江', amount: '按工日', publisher: 'u1', status: 'on', ts: t(2), note: '' },
  { id: 'SU007', cat: '资质招商', dir: 'supply', title: '大型公建 EPC 联合体联营 寻求设计+施工伙伴', company: '××建筑设计院', location: '成都·锦江', amount: '面议', publisher: 'u3', status: 'on', ts: t(4), note: '' },
  { id: 'SU008', cat: '劳务', dir: 'demand', title: '市政道路项目 劳务分包合作 长期稳定需求', company: '成都××市政工程有限公司', location: '成都·温江', amount: '¥950,000', publisher: 'u5', status: 'pending', ts: t(0), note: '' },
  { id: 'SU009', cat: '中介服务', dir: 'supply', title: '建筑资质升级代办 施工总承包二升一 全程服务', company: '四川××工程中介服务有限公司', location: '成都·高新', amount: '¥68,000', publisher: 'u2', status: 'on', ts: t(1), note: '' },
  { id: 'SU010', cat: '中介服务', dir: 'supply', title: '安许代办/资质分立 西南区域 承诺制办理', company: '××企业管理咨询有限公司', location: '成都·武侯', amount: '¥25,000', publisher: 'u2', status: 'rejected', ts: t(6), note: '材料真实性存疑，请补充安许有效期证明' },
  { id: 'SU011', cat: '资质招商', dir: 'supply', title: '电力工程施工总承包一级 寻分公司合作', company: '贵州黔电电力工程有限公司', location: '贵阳·观山湖', amount: '10-30万/年', publisher: 'u1', status: 'on', ts: t(2), note: '' },
  { id: 'SU012', cat: '资质招商', dir: 'supply', title: '建筑工程施工总承包一级 联营/分公司挂靠', company: '四川××建设集团有限公司', location: '成都·青羊', amount: '面议', publisher: 'u3', status: 'on', ts: t(5), note: '' },
  { id: 'SU013', cat: '建企买卖', dir: 'supply', title: '公路工程施工总承包二级 建企整体转让', company: '××路桥建设工程有限公司', location: '成都·双流', amount: '¥580,000', publisher: 'u1', status: 'on', ts: t(3), note: '' },
  { id: 'SU014', cat: '建企买卖', dir: 'demand', title: '收购 水利水电施工总承包三级 带安许 川内', company: '成都××投资有限公司', location: '成都·成华', amount: '¥300,000', publisher: 'u5', status: 'pending', ts: t(0), note: '' },
  { id: 'SU015', cat: '招聘', dir: 'demand', title: '招聘 一级建造师（建筑工程） 成都 全职', company: '四川××建设有限公司', location: '成都·高新', amount: '薪资面议', publisher: 'u1', status: 'on', ts: t(1), note: '' },
  { id: 'SU016', cat: '求职', dir: 'supply', title: '一级建造师（建筑+市政双证） 寻求全职/顾问', company: '张×（个人）', location: '成都', amount: '面议', publisher: 'u4', status: 'on', ts: t(2), note: '' },
  { id: 'SU017', cat: '材料', dir: 'demand', title: '西安浐灞项目 急需 级配碎石/砂石料 采购询价', company: '西安××建设集团有限公司', location: '西安·浐灞', amount: '¥750,000', publisher: 'u5', status: 'pending', ts: t(0), note: '' },
  { id: 'SU018', cat: '设备', dir: 'supply', title: '供应 挖掘机/装载机 台班出租 带司机', company: '成都××工程机械有限公司', location: '成都·新都', amount: '按台班', publisher: 'u1', status: 'off', ts: t(8), note: '季节性调整下架' },
  { id: 'SU019', cat: '劳务', dir: 'supply', title: '供应 水电安装班组 持证上岗 可全国进场', company: '四川××水电安装有限公司', location: '成都·金牛', amount: '按工日', publisher: 'u3', status: 'on', ts: t(1), note: '' },
  { id: 'SU020', cat: '资质招商', dir: 'supply', title: '建材供应链招商加盟 区域独家授权', company: '××供应链管理有限公司', location: '成都·龙泉驿', amount: '¥120,000', publisher: 'u8', status: 'pending', ts: t(0), note: '' },
  { id: 'SU021', cat: '中介服务', dir: 'supply', title: '工商注册/变更 建筑类公司 加急代办', company: '××企业管理服务有限公司', location: '成都·锦江', amount: '¥8,800', publisher: 'u2', status: 'on', ts: t(2), note: '' },
  { id: 'SU022', cat: '资质招商', dir: 'supply', title: '水利水电施工总承包二级 资质联营合作', company: '××水利水电工程有限公司', location: '绵阳·涪城', amount: '面议', publisher: 'u3', status: 'on', ts: t(4), note: '' },
  { id: 'SU023', cat: '建企买卖', dir: 'supply', title: '机电安装专业承包一级 带安许 转让', company: '××机电安装工程有限公司', location: '德阳·旌阳', amount: '¥420,000', publisher: 'u1', status: 'off', ts: t(9), note: '资料更新中，暂下架' },
  { id: 'SU024', cat: '求职', dir: 'supply', title: '造价工程师（一级） 10 年经验 全职/项目制', company: '李×（个人）', location: '成都·天府新区', amount: '面议', publisher: 'u4', status: 'pending', ts: t(0), note: '' }
]

// 内存缓存
let _supplyCache = null

/**
 * 获取供需列表
 * @param {string} status - 过滤状态：on/pending/rejected/off/active/pending_review
 */
export function list(status) {
  if (!_supplyCache) {
    _supplyCache = JSON.parse(JSON.stringify(seedSupply))
  }
  if (!status) return _supplyCache
  // 兼容旧版状态映射
  const statusMap = { on: 'on', pending: 'pending', active: 'on', pending_review: 'pending' }
  const targetStatus = statusMap[status] || status
  return _supplyCache.filter(item => item.status === targetStatus)
}

/**
 * 按 ID 获取供需条目
 */
export function byId(id) {
  const items = list()
  return items.find(item => item.id === id) || null
}

/**
 * 审核操作
 */
export function audit(id, action, note) {
  const items = list()
  const idx = items.findIndex(item => item.id === id)
  if (idx < 0) return null
  if (action === 'approve' || action === 'on') items[idx].status = 'on'
  else if (action === 'reject') { items[idx].status = 'rejected'; items[idx].note = note || '内容不符合发布规范' }
  else if (action === 'off') { items[idx].status = 'off'; items[idx].note = note || '主动下架' }
  items[idx].auditTs = Date.now()
  return items[idx]
}

/**
 * 发布供需
 */
export function create(data) {
  const items = list()
  const newItem = { id: 'SU' + String(Date.now()).slice(-4), status: 'pending', ts: new Date().toISOString().slice(0, 10), ...data }
  items.unshift(newItem)
  return newItem
}

export default { list, byId, audit, create }
