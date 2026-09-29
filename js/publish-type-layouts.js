/* ================================================================
 * PUBLISH_TYPE_LAYOUTS — 每类专属编辑器布局
 * 与 FIELD_CONFIG(editor.html) 对应：
 *   static   → 通用静态字段（标题/地区/价格/数量/规格/交付/资质）的显隐与文案
 *   groups   → 若提供，则完全替换 FIELD_CONFIG[biz].groups（demand 侧专用）
 *   platform → 平台自动带入/自动生成的卡片（只读，标记"平台已算"）
 * 设计原则：demand 侧不填供应方的资料；supply 侧不填采购方的要求。
 * ================================================================ */
var PUBLISH_TYPE_LAYOUTS = {

  /* ---------- 供需通用：材料 ---------- */
  'material-demand': {
    static: {
      labels: { price: '采购预算', qty: '需求量', spec: '采购规格要求', delivery: '期望到货时间', qualification: '对供应商资质要求' },
      placeholders: { price: '如 300-350元/方', qty: '如 月需6000方', spec: '如 强度等级C30，抗渗P6', delivery: '如 下单后2天内送到', qualification: '如 需国标合格证、ISO9001、质检报告' }
    },
    groups: [
      { title: '采购规格', fields: [ {type:'kvlist', key:'spec', label:'规格参数', hint:'每行一个，如 强度等级:C30 / 抗渗等级:P6'} ] },
      { title: '预算与计价', fields: [ {type:'text', key:'priceRange', label:'采购预算区间', placeholder:'如 300-350元/方'}, {type:'text', key:'priceBasis', label:'计价要求', placeholder:'如 需含运费含税，按工地实方结算'} ] },
      { title: '配送要求', fields: [ {type:'text', key:'deliveryRadius', label:'期望配送范围', placeholder:'如 工地半径50公里内'}, {type:'text', key:'deliveryCapacity', label:'月需求量', placeholder:'如 月需6000方'}, {type:'text', key:'deliveryEta', label:'期望到货时效', placeholder:'如 下单后48小时内'}, {type:'text', key:'deliveryCost', label:'运费承担', placeholder:'如 供方包运费'} ] },
      { title: '对供应商要求', fields: [ {type:'taglist', key:'quals', label:'需提供资质', hint:'如 质检报告、出厂合格证、ISO认证'}, {type:'kvlist', key:'docs', label:'需提供文件清单', hint:'如 质检报告:批次 / 合格证:随车'}, {type:'text', key:'warranty', label:'对售后/质保的要求', placeholder:'如 不合格退换，质保期按国标'} ] },
      { title: '结算与付款', fields: [ {type:'kvlist', key:'trade', label:'结算要求', hint:'如 付款方式:月结 / 对账周期:次月15日'} ] }
    ]
  },

  /* ---------- 供需通用：设备 ---------- */
  'equipment-demand': {
    static: {
      labels: { price: '月租预算', qty: '需求台数', spec: '需要的设备型号', delivery: '期望进场时间', qualification: '对设备证件要求' },
      placeholders: { price: '如 15000-18000元/月', qty: '如 2台', spec: '如 QTZ80塔吊，臂长56m', delivery: '如 3月15日前进场', qualification: '如 需年检合格、特种设备证、操作司机持证' }
    },
    groups: [
      { title: '需要的设备', fields: [ {type:'kvlist', key:'specs', label:'设备参数要求', hint:'如 型号:QTZ80 / 臂长:56m / 独立高度:40m'} ] },
      { title: '租赁预算', fields: [ {type:'text', key:'feeRange', label:'月租金预算', placeholder:'如 15000-18000元/月'}, {type:'kvlist', key:'feeRows', label:'其他费用预期', hint:'如 押金:3万内 / 进出场费:1.5万内'} ] },
      { title: '租期与结算', fields: [ {type:'kvlist', key:'trade', label:'租期/付款要求', hint:'如 最短租期:3个月 / 付款方式:季付'} ] },
      { title: '对出租方要求', fields: [ {type:'taglist', key:'quals', label:'需提供证件', hint:'如 设备合格证、年检报告、司机操作证'}, {type:'kvlist', key:'promise', label:'对设备状况/服务的要求', hint:'如 故障48小时内维修 / 误工减免'} ] }
    ]
  },

  /* ---------- 供需通用：劳务 ---------- */
  'labor-demand': {
    static: {
      labels: { price: '工资预算', qty: '需求人数', spec: '需要的工种', delivery: '期望进场时间', qualification: '对班组合规要求' },
      placeholders: { price: '如 350元/吨', qty: '如 30人', spec: '如 钢筋工20+混凝土工10', delivery: '如 3月1日进场', qualification: '如 需实名制、工伤险、三级安全教育' }
    },
    groups: [
      { title: '用工需求', fields: [ {type:'kvlist', key:'workforce', label:'工种与人数', hint:'如 钢筋工:20人 / 混凝土工:10人'} ] },
      { title: '工资预算', fields: [ {type:'kvlist', key:'wage', label:'可接受计价方式', hint:'如 钢筋绑扎:350元/吨 / 计时:280元/工日'} ] },
      { title: '结算要求', fields: [ {type:'kvlist', key:'trade', label:'结算/付款要求', hint:'如 月结 / 次月10日前付80%'} ] },
      { title: '对班组要求', fields: [ {type:'taglist', key:'compliance', label:'需提供的合规保障', hint:'如 实名制、工伤险、工资专户'}, {type:'text', key:'foremanExp', label:'期望班组长条件', placeholder:'如 从业10年以上，有同类项目经验'} ] }
    ]
  },

  /* ---------- 中介需求侧（找中介服务） ---------- */
  'agency-demand': {
    static: {
      labels: { price: '服务预算', spec: '要办的事项', delivery: '期望周期', qualification: '对中介的资质要求' },
      hide: ['unit','qty'],
      placeholders: { price: '如 5-8万', spec: '如 建筑工程总承包二级新办', delivery: '如 60天内取证', qualification: '如 需有同类成功案例、签正式合同' }
    },
    groups: [
      { title: '我要办什么', fields: [ {type:'kvlist', key:'serveType', label:'需求描述', hint:'如 要办事项:资质新办 / 目标:建筑总承包二级 / 地区:成都'} ] },
      { title: '预算与期望周期', fields: [ {type:'kvlist', key:'quote', label:'预算与付款预期', hint:'如 总预算:8万 / 付款方式:分期'}, {type:'text', key:'overdueClause', label:'期望周期', placeholder:'如 60个工作日内取证，超期需有赔付约定'} ] },
      { title: '我已有的材料', fields: [ {type:'taglist', key:'requiredMaterials', label:'已有/能提供的材料', hint:'如 营业执照、法人身份证、章程、社保'} ] },
      { title: '对中介的要求', fields: [ {type:'kvlist', key:'cases', label:'希望看到的成功案例', hint:'如 近半年同类案例:3个以上'}, {type:'text', key:'refundPolicy', label:'对退款保障的要求', placeholder:'如 不过全额退款，写入合同'} ] }
    ]
  },

  /* ---------- 找资质加盟 ---------- */
  'franchise-demand': {
    static: {
      labels: { price: '可接受费用', spec: '想找的资质', delivery: '期望签约时间' },
      placeholders: { price: '如 5万/年以内', spec: '如 建筑工程总承包二级或一级', delivery: '如 1个月内签约' }
    },
    groups: [
      { title: '我的情况', fields: [ {type:'kvlist', key:'companyInfo', label:'我现有资源/团队', hint:'如 现有团队:10人 / 已有业绩:5000万 / 所在地区:成都'} ] },
      { title: '想找的资质', fields: [ {type:'kvlist', key:'qualPack', label:'期望资质包', hint:'如 建筑总承包:二级 / 市政:三级'} ] },
      { title: '能接受的合作条件', fields: [ {type:'kvlist', key:'coopTerms', label:'合作模式偏好', hint:'如 区域:成都独家 / 合作期限:3年'} ] },
      { title: '费用预算', fields: [ {type:'kvlist', key:'feeStructure', label:'可接受费用范围', hint:'如 加盟费:≤5万/年 / 管理费:≤2%'} ] }
    ]
  },

  /* ---------- 收购公司/资质 ---------- */
  'trade-demand': {
    static: {
      labels: { price: '收购预算', spec: '目标资质要求', location: '目标地区', delivery: '期望交割时间' },
      hide: ['unit','qty'],
      placeholders: { price: '如 500-800万', spec: '如 建筑总承包一级+市政二级', location: '如 四川省内', delivery: '如 资料齐全后30天内' }
    },
    groups: [
      { title: '我的收购条件', fields: [ {type:'kvlist', key:'dealTerms', label:'预算与付款方式', hint:'如 预算:600万 / 付款:分期3-4-3'}, {type:'text', key:'deposit', label:'愿意支付的诚意金', placeholder:'如 5万元，可走平台担保'} ] }
    ],
    platform: [ { kind: 'geo-radar', side: 'buyer' } ]
  },

  /* ---------- 供应侧：卖公司/资质（平台自动算风险雷达） ---------- */
  'trade-supply': {
    platform: [ { kind: 'geo-radar', side: 'seller' } ]
  },

  'material-supply': { static: { labels: { price: '报价区间', qty: '日供能力', spec: '产品技术参数', delivery: '交货时效', qualification: '自身资质' }, placeholders: { price: '如 300-350元/方', qty: '如 日供2000方', spec: '如 强度等级C30，抗渗P6', delivery: '如 下单后2小时发车', qualification: '如 国标合格证、ISO9001、质检报告' }, titlePlaceholder: '例如：C30商品混凝土供应 · 成都天府新区' } },
  'equipment-supply': { static: { labels: { price: '月租报价', qty: '可租台数', spec: '设备型号参数', delivery: '进场时间', qualification: '设备证件' }, placeholders: { price: '如 16000-20000元/月', qty: '如 3台', spec: '如 QTZ80塔吊，臂长56m', delivery: '如 3天内进场安装', qualification: '如 特种设备证、年检合格' }, titlePlaceholder: '例如：QTZ80塔吊出租 · 带司机 · 成都' } },
  'labor-supply': { static: { labels: { price: '计价方式', qty: '可出工人数', spec: '工种构成', delivery: '进场时间', qualification: '班组合规资质' }, placeholders: { price: '如 350元/吨', qty: '如 30人', spec: '如 钢筋工20+混凝土工10', delivery: '如 随时进场', qualification: '如 实名制、工伤险、三级教育' }, titlePlaceholder: '例如：钢筋工班组30人 · 成都及周边' } },
  'cooperation-supply': { static: { labels: { price: '承接报价', qty: '可承接规模', spec: '擅长领域', delivery: '可进场时间', qualification: '自身资质' }, placeholders: { price: '如 450元/㎡', qty: '如 月完成产值500万', spec: '如 主体结构劳务、模板脚手架', delivery: '如 3月10日进场', qualification: '如 施工总承包二级、安全生产许可证' }, titlePlaceholder: '例如：主体结构劳务分包承接 · 成都' } },
  'franchise-supply': { static: { labels: { price: '加盟费', qty: '开放区域数', spec: '总部资质包', delivery: '授权时间', qualification: '总部资质' }, placeholders: { price: '如 5万/年', qty: '如 全国开放', spec: '如 建筑+市政双一级', delivery: '如 签约后7天授权', qualification: '如 四库一平台可查' }, titlePlaceholder: '例如：建筑总承包一级资质招商 · 区域独家' } },
  'agency-supply': { static: { labels: { price: '服务费', qty: '可接单量', spec: '服务范围', delivery: '办理周期', qualification: '中介资质/案例' }, placeholders: { price: '如 5-8万', qty: '如 月接10单', spec: '如 资质新办/升级/安许', delivery: '如 45-60天取证', qualification: '如 10年经验、500+成功案例' }, titlePlaceholder: '例如：建筑总承包二级新办代办 · 45天取证' } },
  'talent-supply': { static: { labels: { price: '期望薪资', qty: '可到岗人数', spec: '证书与职称', delivery: '到岗时间' }, hide: ['unit','qualification'], placeholders: { price: '如 20000-25000元/月', qty: '1人', spec: '如 一级建造师（建筑）+高工', delivery: '如 1个月内到岗' }, titlePlaceholder: '例如：一建（建筑）求职 · 期望2万/月' } },
  'cooperation-demand': { static: { labels: { price: '项目预算', qty: '工程量', spec: '工程内容', delivery: '工期要求', qualification: '对合作方资质要求' }, placeholders: { price: '如 暂估5000万', qty: '如 约20万㎡', spec: '如 主体结构+二次结构劳务', delivery: '如 720日历天', qualification: '如 施工总承包二级及以上' }, titlePlaceholder: '例如：XX综合体项目劳务分包 · 约5000万' } },
  'personnel-demand': { static: { labels: { price: '薪资范围', qty: '招聘人数', spec: '证书与经验要求', delivery: '到岗时间', qualification: '岗位证书要求' }, placeholders: { price: '如 15000-20000元/月', qty: '如 2人', spec: '如 一建建筑+5年经验', delivery: '如 随时到岗', qualification: '如 一建注册+B证' }, titlePlaceholder: '例如：项目经理（一建建筑）招聘 · 1.5-2万/月' } }
};

/* 静态字段 id → 编辑器 fields 上的键名（用于按 layout.labels 改文案） */
PUBLISH_TYPE_LAYOUTS.STATIC_FIELD_MAP = {
  title: 'f-title', subType: 'f-sub', location: 'f-location', price: 'f-price',
  unit: 'f-unit', qty: 'f-qty', spec: 'f-spec', delivery: 'f-delivery', qualification: 'f-qual'
};

global.PUBLISH_TYPE_LAYOUTS = PUBLISH_TYPE_LAYOUTS;
