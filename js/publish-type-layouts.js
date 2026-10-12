/* ================================================================
 * PUBLISH_TYPE_LAYOUTS — 每类专属编辑器布局
 * 与 FIELD_CONFIG(editor.html) 对应：
 *   static   → 通用静态字段（标题/地区/价格/数量/规格/交付/资质）的显隐与文案
 *   groups   → 若提供，则完全替换 FIELD_CONFIG[biz].groups
 *   platform → 平台自动带入/自动生成的卡片（只读，标记"平台已算"）
 * 说明（2026-10-10 清理）：
 *   仅保留「详细类 8 种」的配置；简要类 8 种走一句话发布（brief-editor.html），
 *   隐藏兼容类（cooperation-supply/demand）不入发布入口，其旧配置已一并删除。
 * ================================================================ */
var PUBLISH_TYPE_LAYOUTS = {

  /* ---------- 供应侧：卖公司/资质（平台自动算风险雷达） ---------- */
  'trade-supply': {
    platform: [ { kind: 'geo-radar', side: 'seller' } ]
  },

  'material-supply': { static: { labels: { price: '报价区间', qty: '日供能力', spec: '产品技术参数', delivery: '交货时效', qualification: '自身资质' }, placeholders: { price: '如 300-350元/方', qty: '如 日供2000方', spec: '如 强度等级C30，抗渗P6', delivery: '如 下单后2小时发车', qualification: '如 国标合格证、ISO9001、质检报告' }, titlePlaceholder: '例如：C30商品混凝土供应 · 成都天府新区' } },
  'transport-supply': { static: { labels: { price: '计价方式', qty: '可用车台数', spec: '车型与运力', delivery: '调度响应', qualification: '运输资质' }, placeholders: { price: '如 0.5元/吨·公里起', qty: '如 罐车8台+自卸车12台', spec: '如 混凝土罐车12-15方、自卸车30-40吨', delivery: '如 24小时调度，2小时内派车', qualification: '如 道路运输经营许可证、车辆营运证、A2/B2驾照' }, titlePlaceholder: '例如：砂石运输车队 · 成都周边100km' } },
  'equipment-supply': { static: { labels: { price: '月租报价', qty: '可租台数', spec: '设备型号参数', delivery: '进场时间', qualification: '设备证件' }, placeholders: { price: '如 16000-20000元/月', qty: '如 3台', spec: '如 QTZ80塔吊，臂长56m', delivery: '如 3天内进场安装', qualification: '如 特种设备证、年检合格' }, titlePlaceholder: '例如：QTZ80塔吊出租 · 带司机 · 成都' } },
  'labor-supply': { static: { labels: { price: '计价方式', qty: '可出工人数', spec: '工种构成', delivery: '进场时间', qualification: '班组合规资质' }, placeholders: { price: '如 350元/吨', qty: '如 30人', spec: '如 钢筋工20+混凝土工10', delivery: '如 随时进场', qualification: '如 实名制、工伤险、三级教育' }, titlePlaceholder: '例如：钢筋工班组30人 · 成都及周边' } },
  'franchise-supply': { static: { labels: { price: '加盟费', qty: '开放区域数', spec: '总部资质包', delivery: '授权时间', qualification: '总部资质' }, placeholders: { price: '如 5万/年', qty: '如 全国开放', spec: '如 建筑+市政双一级', delivery: '如 签约后7天授权', qualification: '如 四库一平台可查' }, titlePlaceholder: '例如：建筑总承包一级资质招商 · 区域独家' } },
  'agency-supply': { static: { labels: { price: '服务费', qty: '可接单量', spec: '服务范围', delivery: '办理周期', qualification: '中介资质/案例' }, placeholders: { price: '如 5-8万', qty: '如 月接10单', spec: '如 资质新办/升级/安许', delivery: '如 45-60天取证', qualification: '如 10年经验、500+成功案例' }, titlePlaceholder: '例如：建筑总承包二级新办代办 · 45天取证' } },
  'personnel-demand': { static: { labels: { price: '薪资范围', qty: '招聘人数', spec: '证书与经验要求', delivery: '到岗时间', qualification: '岗位证书要求' }, placeholders: { price: '如 15000-20000元/月', qty: '如 2人', spec: '如 一建建筑+5年经验', delivery: '如 随时到岗', qualification: '如 一建注册+B证' }, titlePlaceholder: '例如：项目经理（一建建筑）招聘 · 1.5-2万/月' } }
};

/* 静态字段 id → 编辑器 fields 上的键名（用于按 layout.labels 改文案） */
PUBLISH_TYPE_LAYOUTS.STATIC_FIELD_MAP = {
  title: 'f-title', subType: 'f-sub', location: 'f-location', price: 'f-price',
  unit: 'f-unit', qty: 'f-qty', spec: 'f-spec', delivery: 'f-delivery', qualification: 'f-qual'
};

window.PUBLISH_TYPE_LAYOUTS = PUBLISH_TYPE_LAYOUTS;
