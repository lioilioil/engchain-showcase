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
    static: { labels: { price: '转让价', qualification: '资质证照' }, placeholders: { price: '如 500万', priceMax: '如 800万（可谈）' }, titlePlaceholder: '例如：房建二级资质公司转让 · 无负债 · 川内' },
    platform: [ { kind: 'geo-radar', side: 'seller' } ]
  },

  'material-supply': { static: { labels: { price: '报价区间', qty: '日供能力', spec: '产品技术参数', delivery: '交货时效', qualification: '自身资质' }, placeholders: { price: '如 300-350元/方', priceMax: '如 350（元/方）', qty: '如 日供2000方', spec: '如 强度等级C30，抗渗P6', delivery: '如 下单后2小时发车', qualification: '如 国标合格证、ISO9001、质检报告' }, hide: ['qty-card'], titlePlaceholder: '例如：C30商品混凝土供应 · 成都天府新区' } },
  'transport-supply': { static: { labels: { price: '运费报价', qty: '可用车台数', spec: '车型与运力', delivery: '调度响应', qualification: '运输资质' }, placeholders: { price: '如 0.5-1.0元/吨·公里（起）', priceMax: '如 1.0元/吨·公里（上限可空）', qty: '如 罐车8台+自卸车12台', spec: '如 混凝土罐车12-15方、自卸车30-40吨', delivery: '如 24小时调度，2小时内派车', qualification: '如 道路运输经营许可证、车辆营运证、A2/B2驾照' }, hide: ['qty-card'], cardPriceTitle: '运费报价', titlePlaceholder: '例如：砂石运输车队 · 成都周边100km' } },
  'equipment-supply': { static: { labels: { price: '月租报价', qty: '可租台数', spec: '设备型号参数', delivery: '进场时间', qualification: '设备证件' }, placeholders: { price: '如 16000-20000元/月', priceMax: '如 20000（元/月）', qty: '如 3台', spec: '如 QTZ80塔吊，臂长56m', delivery: '如 3天内进场安装', qualification: '如 特种设备证、年检合格' }, hide: ['spec'], cardPriceTitle: '月租报价', titlePlaceholder: '例如：QTZ80塔吊出租 · 带司机 · 成都' } },
  'labor-supply': { static: { labels: { price: '计价方式', qty: '可出工人数', spec: '工种构成', delivery: '进场时间', qualification: '班组合规资质' }, placeholders: { price: '如 280-380元/工日 · 钢筋350元/吨', priceMax: '如 计件上限（可不填）', qty: '如 30人', spec: '如 钢筋工20+混凝土工10', delivery: '如 随时进场', qualification: '如 实名制、工伤险、三级教育' }, hide: ['qty','spec','unit'], cardTitle: '交付 / 进场', cardPriceTitle: '计价方式', titlePlaceholder: '例如：钢筋工班组30人 · 成都及周边' } },
  'franchise-supply': { static: { labels: { price: '加盟费', qty: '开放区域数', spec: '总部资质包', delivery: '授权时间', qualification: '总部资质' }, placeholders: { price: '如 5万/年', priceMax: '如 8（万/年）', qty: '如 全国开放', spec: '如 建筑+市政双一级', delivery: '如 签约后7天授权', qualification: '如 四库一平台可查' }, cardPriceTitle: '加盟费', titlePlaceholder: '例如：建筑总承包一级资质招商 · 区域独家' } },
  'agency-supply': { static: { labels: { price: '服务费', qty: '可接单量', spec: '服务范围', delivery: '办理周期', qualification: '中介资质/案例' }, placeholders: { price: '如 5-8万', priceMax: '如 8（万）', qty: '如 月接10单', spec: '如 资质新办/升级/安许', delivery: '如 45-60天取证', qualification: '如 10年经验、500+成功案例' }, hide: ['spec','delivery'], cardTitle: '接单容量', cardPriceTitle: '服务费', titlePlaceholder: '例如：建筑总承包二级新办代办 · 45天取证' } },
  'personnel-demand': { static: { labels: { price: '薪资范围', qty: '招聘人数', spec: '证书与经验要求', delivery: '到岗时间', qualification: '岗位证书要求' }, placeholders: { price: '如 15000-20000元/月', priceMax: '如 20000（元/月）', qty: '如 2人', spec: '如 一建建筑+5年经验', delivery: '如 随时到岗', qualification: '如 一建注册+B证' }, hide: ['qty-card'], cardPriceTitle: '薪资范围', titlePlaceholder: '例如：项目经理（一建建筑）招聘 · 1.5-2万/月' } }
};

/* 静态字段 id → 编辑器 fields 上的键名（用于按 layout.labels 改文案；
   price 键对应价格区间左框 f-price，priceMax 对应右框 f-price-max） */
PUBLISH_TYPE_LAYOUTS.STATIC_FIELD_MAP = {
  title: 'f-title', subType: 'f-sub', location: 'f-location', price: 'f-price', priceMax: 'f-price-max',
  unit: 'f-unit', qty: 'f-qty', spec: 'f-spec', delivery: 'f-delivery', qualification: 'f-qual',
  desc: 'f-desc'
};

window.PUBLISH_TYPE_LAYOUTS = PUBLISH_TYPE_LAYOUTS;
