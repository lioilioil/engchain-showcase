/* ============================================================================
   工程链 ENGCHAIN — 统一业务数据层 DataBus + 完整用户表（v1.1）
   ----------------------------------------------------------------------------
   多用户真实场景基建：
   - 用户表 engchain-users：预置 8 类画像（覆盖六级身份 × 三类入驻 × 差异权益）
   - 登录历史 engchain-login-history：最近登录账号，App 登录页"历史登录"一键切换
   - 登录切换 = 目标用户快照整体写入各业务 Store（engchain-state/auth/entry/balance/credits）
   - 全端（App / 后台 / preview）共用本层读写与派生，保证"完整联动，不止 localStorage 键共享"
   依赖：data.js → common.js → stores.js → databus.js
   ============================================================================ */
window.DataBus = (function () {
  'use strict';
  var LS = window.localStorage;
  var USERS_KEY = 'engchain-users';
  var HIST_KEY = 'engchain-login-history';
  var AUDIT_KEY = 'engchain-audit';
  var now = Date.now();
  var DAY = 864e5, YEAR = 365 * DAY;

  /* ---- 预置 8 类用户画像（v2.0 双线并行身份模型） ----
     identity = { personal: 'none'|'verified'|'professional', enterprise: 'none'|'verified'|'resident', entryTypes: [] }
     auth.qual 已拆分为 auth.personalQual（个人资质）+ auth.enterpriseQual（企业资质），旧 auth.qual 保留兼容
     旧 u.status / u.entry.type 保留为兼容别名，新代码应使用 u.identity */
  function seedUsers() {
    return [
      { id:'u1', name:'陈建国', company:'四川省××建设有限公司', account:'chenjianguo@engchain.cn', pwd:'demo8888',
        avatar:'陈', tag:'入驻企业 · 建筑', status:'resident',
        identity:{ personal:'verified', enterprise:'resident', entryTypes:['construction'] },
        auth:{ realname:{ok:true,ts:now-DAY*30,name:'陈建国',idNo:'',mobile:'138****1234',idMask:''}, enterprise:{ok:true,expireAt:now+YEAR,co:'四川省××建设有限公司',code:'91510100MA6×××12X',legal:'陈建国',shortName:'川×建设',nameBasis:'品牌简称',nameProof:[]}, personalQual:{ok:false,list:[]}, enterpriseQual:{ok:true,list:['建筑业企业资质 · 建筑工程施工总承包贰级']}, qual:{ok:true,list:['建筑业企业资质 · 建筑工程施工总承包贰级']}, payment:{ok:true,ts:now-DAY*60} },
        entry:{ type:'construction', types:['construction'], orderId:'EN20260601001', status:'active', active:true, paidAt:now-DAY*60, expireAt:now+YEAR, depositType:'basic', depositPaid:5000, fee:2980, contact:'陈建国', tel:'13800001234', scope:'房屋建筑工程 · 市政公用工程 · 建筑装修装饰工程 · 机电设备安装工程 · 建筑幕墙工程 · 钢结构工程 · 地基基础工程 · 环保工程 · 城市及道路照明工程 · 特种工程（结构补强）', qualifications:[{name:'建筑工程施工总承包',level:'贰级',no:'D2510××××',expireAt:'2027-12-31',image:''},{name:'市政公用工程施工总承包',level:'叁级',no:'D3510××××',expireAt:'2026-06-30',image:''}], intro:{founded:'2008',capital:'5000',staffSize:'101-500人',desc:'四川省××建设有限公司成立于2008年，是一家集房屋建筑、市政公用、装饰装修、机电安装于一体的综合性建筑施工企业。公司注册资本5000万元，拥有建筑工程施工总承包贰级、市政公用工程施工总承包叁级等多项资质。现有员工300余人，其中高级工程师20人，一级建造师15人，二级建造师30人。公司先后承建了成都天府新区多个重点项目，累计施工面积超过200万平方米，工程合格率100%，多次获得"四川省优质工程奖"、"成都市安全文明工地"等荣誉。公司秉承"质量第一、信誉至上"的经营理念，致力于为客户提供优质、高效、安全的建筑服务。'}, cases:[{name:'成都天府新区××商业综合体项目',type:'房屋建筑',amount:'32000',startDate:'2023-03-01',endDate:'2025-06-30',desc:'项目位于成都天府新区核心商务区，总建筑面积约18万平方米，包含两栋甲级写字楼、一栋商业裙楼及地下三层车库。我司承担总承包施工，涵盖基坑支护、主体结构、机电安装、装饰装修全流程。项目采用BIM技术进行全过程管理，荣获2024年度四川省建设工程"天府杯"银奖。施工期间实现零安全事故，主体结构提前45天封顶。',images:[]},{name:'成都市××市政道路改造工程',type:'市政公用',amount:'8600',startDate:'2022-05-01',endDate:'2023-11-30',desc:'项目对成都市武侯区三条主干道进行综合改造，道路总长4.2公里，包含路面翻新、雨污管网分流、绿化景观提升、照明系统更新及交通设施完善。施工期间采用半幅通行方案，最大限度减少对市民出行的影响。项目竣工验收评定为优良工程。',images:[]}], address:{province:'四川省',city:'成都市',district:'武侯区',detail:'天府大道北段××号××大厦15楼'}, website:'https://www.sc-jianshe.example.com', attachments:[] },
        balance:{ balance:1286.50, frozen:200, totalIn:13486.50 },
        credits:{ balance:2350, quota:{ month:'', used:0 } } },
      { id:'u2', name:'李雅', company:'四川××工程中介服务有限公司', account:'liya@engchain.cn', pwd:'demo8888',
        avatar:'李', tag:'入驻企业 · 中介', status:'resident',
        identity:{ personal:'verified', enterprise:'resident', entryTypes:['agency'] },
        auth:{ realname:{ok:true,ts:now-DAY*45}, enterprise:{ok:true,expireAt:now+YEAR}, personalQual:{ok:false,list:[]}, enterpriseQual:{ok:true,list:['房地产经纪机构备案','工程造价咨询乙级']}, qual:{ok:true,list:['房地产经纪机构备案','工程造价咨询乙级']}, payment:{ok:true,ts:now-DAY*40} },
        entry:{ type:'agency', types:['agency'], orderId:'EN20260615001', status:'active', active:true, paidAt:now-DAY*40, expireAt:now+YEAR, depositType:'engineering', depositPaid:20000 },
        balance:{ balance:8600, frozen:1200, totalIn:51200 },
        credits:{ balance:1200, quota:{ month:'', used:0 } } },
      { id:'u3', name:'王强', company:'××工程咨询有限公司', account:'wangqiang@engchain.cn', pwd:'demo8888',
        avatar:'王', tag:'企业认证', status:'enterprise',
        identity:{ personal:'verified', enterprise:'verified', entryTypes:[] },
        auth:{ realname:{ok:true,ts:now-DAY*20}, enterprise:{ok:true,expireAt:now+YEAR}, personalQual:{ok:false,list:[]}, enterpriseQual:{ok:false,list:[]}, qual:{ok:false,list:[]}, payment:{ok:false,ts:0} },
        entry:{ type:null, types:[], orderId:null, status:null, active:false, paidAt:0, expireAt:0, note:'' },
        balance:{ balance:320, frozen:0, totalIn:1320 },
        credits:{ balance:300, quota:{ month:'', used:0 } } },
      { id:'u4', name:'张敏', company:'', account:'zhangmin@engchain.cn', pwd:'demo8888',
        avatar:'张', tag:'个人专业入驻', status:'pro',
        identity:{ personal:'professional', enterprise:'none', entryTypes:[] },
        auth:{ realname:{ok:true,ts:now-DAY*60,name:'张敏',idNo:'',mobile:'139****5678',idMask:''}, enterprise:{ok:false,expireAt:0}, personalQual:{ok:true,list:['一级建造师 · 建筑工程','注册安全工程师']}, personalEntry:{ok:true,status:'approved',note:'',submittedAt:now-DAY*50,list:[{name:'一级建造师（建筑工程）',no:'JZ000××××',image:''},{name:'注册安全工程师',no:'AQ000××××',image:''}],certs:[],profile:{basic:{gender:'女',birth:'1990-06',location:'四川省成都市高新区',jobStatus:'在职-考虑机会',mobile:'13900005678'},education:[{school:'四川大学',major:'土木工程',degree:'本科',start:'2008-09',end:'2012-06',certFile:''},{school:'西南交通大学',major:'建筑与土木工程',degree:'硕士',start:'2012-09',end:'2015-06',certFile:''}],work:[{company:'四川省××建设有限公司',position:'项目工程师',start:'2015-07',end:'2019-03',desc:'负责房建项目现场技术管理，参与3个总承包项目的施工组织设计编制与现场协调，管理施工班组约80人，完成产值约1.2亿元。'},{company:'成都××地产开发有限公司',position:'工程主管',start:'2019-04',end:'至今',desc:'负责地产项目工程管理，统筹总包、监理、分包单位，管控进度、质量、安全，累计管理项目面积约25万平方米。'}],project:[{name:'成都天府新区××综合体',role:'现场技术负责人',time:'2017-2019',desc:'18万㎡商业综合体项目，负责主体结构施工技术管理，解决深基坑、高支模等技术难题。'},{name:'成都××住宅项目',role:'工程主管',time:'2020-2022',desc:'30万㎡住宅开发项目，统筹工程全流程管理，实现按期交付，业主满意度95%。'}],skills:['一级建造师','注册安全工程师','BIM建模','项目管理','施工组织设计','质量管控','安全管理'],jobIntent:{position:'工程项目经理',salary:'25-35K',location:'成都',workType:'全职'},intro:'10年建筑行业从业经验，拥有一级建造师（建筑工程）和注册安全工程师双证。熟悉房建项目全流程管理，具备丰富的现场技术管理和团队协调经验。曾参与多个大型商业综合体和住宅项目建设，累计管理面积超50万平方米。工作认真负责，具备良好的沟通协调能力和抗压能力。',resumeFile:'张敏-个人简历.pdf'}}, enterpriseQual:{ok:false,list:[]}, qual:{ok:true,list:['一级建造师 · 建筑工程','注册安全工程师']}, payment:{ok:false,ts:0} },
        entry:{ type:null, types:[], orderId:null, status:null, active:false, paidAt:0, expireAt:0, note:'' },
        balance:{ balance:150, frozen:0, totalIn:650 },
        credits:{ balance:800, quota:{ month:'', used:0 } } },
      { id:'u5', name:'赵磊', company:'', account:'zhaolei@engchain.cn', pwd:'demo8888',
        avatar:'赵', tag:'个人认证', status:'realname',
        identity:{ personal:'verified', enterprise:'none', entryTypes:[] },
        auth:{ realname:{ok:true,ts:now-DAY*10}, enterprise:{ok:false,expireAt:0}, personalQual:{ok:false,list:[]}, enterpriseQual:{ok:false,list:[]}, qual:{ok:false,list:[]}, payment:{ok:false,ts:0} },
        entry:{ type:null, types:[], orderId:null, status:null, active:false, paidAt:0, expireAt:0, note:'' },
        balance:{ balance:0, frozen:0, totalIn:500 },
        credits:{ balance:500, quota:{ month:'', used:0 } } },
      { id:'u6', name:'刘洋', company:'', account:'liuyang@engchain.cn', pwd:'demo8888',
        avatar:'刘', tag:'注册会员', status:'registered',
        identity:{ personal:'none', enterprise:'none', entryTypes:[] },
        auth:{ realname:{ok:false,ts:0}, enterprise:{ok:false,expireAt:0}, personalQual:{ok:false,list:[]}, enterpriseQual:{ok:false,list:[]}, qual:{ok:false,list:[]}, payment:{ok:false,ts:0} },
        entry:{ type:null, types:[], orderId:null, status:null, active:false, paidAt:0, expireAt:0, note:'' },
        balance:{ balance:0, frozen:0, totalIn:0 },
        credits:{ balance:100, quota:{ month:'', used:0 } } },
      { id:'u7', name:'游客', company:'', account:'', pwd:'', avatar:'游', tag:'游客 · 未登录', status:'guest',
        identity:{ personal:'none', enterprise:'none', entryTypes:[] },
        auth:{ realname:{ok:false,ts:0}, enterprise:{ok:false,expireAt:0}, personalQual:{ok:false,list:[]}, enterpriseQual:{ok:false,list:[]}, qual:{ok:false,list:[]}, payment:{ok:false,ts:0} },
        entry:{ type:null, types:[], orderId:null, status:null, active:false, paidAt:0, expireAt:0, note:'' },
        balance:{ balance:0, frozen:0, totalIn:0 },
        credits:{ balance:0, quota:{ month:'', used:0 } } },
      { id:'u8', name:'周航', company:'××合伙企业管理中心', account:'zhouhang@engchain.cn', pwd:'demo8888',
        avatar:'周', tag:'入驻企业 · 合伙人', status:'resident',
        identity:{ personal:'verified', enterprise:'resident', entryTypes:['partner'] },
        auth:{ realname:{ok:true,ts:now-DAY*90}, enterprise:{ok:true,expireAt:now+YEAR}, personalQual:{ok:false,list:[]}, enterpriseQual:{ok:true,list:['合伙企业执业资质']}, qual:{ok:true,list:['合伙企业执业资质']}, payment:{ok:true,ts:now-DAY*30} },
        entry:{ type:'partner', types:['partner'], orderId:'EN20260701001', status:'active', active:true, paidAt:0, expireAt:now+YEAR, depositType:'high', depositPaid:50000, auditPass:true },
        balance:{ balance:50000, frozen:5000, totalIn:120000 },
        credits:{ balance:5000, quota:{ month:'', used:0 } } },
      { id:'u9', name:'孙小美', company:'', account:'sunxiaomei@engchain.cn', pwd:'demo8888',
        avatar:'孙', tag:'个人合伙人', status:'partner',
        identity:{ personal:'partner', partner:true, enterprise:'none', identities:['realname','partner'], entryTypes:[] },
        auth:{ realname:{ok:true,ts:now-DAY*15,name:'孙小美',idNo:'',mobile:'138****6789',idMask:''},
          enterprise:{ok:false,expireAt:0}, personalQual:{ok:false,list:[]},
          personalEntry:{ok:false,status:'',list:[],certs:[],profile:{basic:{},education:[],work:[],project:[],skills:[],jobIntent:{},intro:'',resumeFile:'',regStatus:null,socialSecurity:null}},
          enterpriseQual:{ok:false,list:[]},
          partner:{ok:true,status:'approved',note:'',submittedAt:now-DAY*10,approvedAt:now-DAY*8,
            channel:['朋友圈','社群','短视频'], intent:'两者兼有',
            intro:'建筑行业5年从业经验，拥有丰富的行业人脉资源，擅长通过社群和短视频进行推广。',
            experience:'曾担任某建材公司区域经理，负责渠道拓展和客户维护，年销售额超500万。', profitConfig:{} },
          qual:{ok:false,list:[]}, payment:{ok:false,ts:0} },
        entry:{ type:null, types:[], orderId:null, status:null, active:false, paidAt:0, expireAt:0, note:'' },
        balance:{ balance:2680, frozen:0, totalIn:5680 },
        credits:{ balance:1200, quota:{ month:'', used:0 } } }
    ];
  }

  /* ---- 用户表读写 ---- */
  /* 用户表结构迁移（Phase 3）：兼容 Phase 1/2 旧 profile。
     仅补缺失字段；已有 entry.type / banned / payment 一律不动，不破坏用户已进行的状态。 */
  function migrateSeedIfNeeded() {
    var a = [];
    try { a = JSON.parse(LS.getItem(USERS_KEY) || '[]'); } catch (e) { return; }
    if (!Array.isArray(a) || !a.length) return;
    var dirty = false;
    var entryMap = { u3: 'construction', u4: 'partner', u5: 'agency', u6: 'construction' };
    a.forEach(function (u) {
      if (!u.auth) u.auth = {};
      if (u.auth.payment === undefined) {
        u.auth.payment = (u.status === 'guest')
          ? { ok: false, ts: 0 }
          : { ok: !!(u.auth.enterprise && u.auth.enterprise.ok), ts: 0 };
        dirty = true;
      }
      if (!u.entry) { u.entry = { type: null, orderId: null, status: null, active: false, paidAt: 0, expireAt: 0 }; dirty = true; }
      if (!u.entry.type && u.status !== 'guest' && !u.banned && entryMap[u.id]) {
        u.entry.type = entryMap[u.id]; u.entry.status = 'pending'; u.entry.note = ''; dirty = true;
      }
    });
    if (dirty) { try { LS.setItem(USERS_KEY, JSON.stringify(a)); } catch (e) {} }
  }

  function loadUsers() {
    var a = [];
    try {
      if (LS.getItem(USERS_KEY) === null) {
        a = seedUsers(); saveUsers(a);
        if (LS.getItem(HIST_KEY) === null) saveHistory(['u1']); /* 默认历史登录：陈建国 */
        return a;
      }
      a = JSON.parse(LS.getItem(USERS_KEY) || '[]');
    } catch (e) { a = []; }
    migrateSeedIfNeeded();
    return Array.isArray(a) && a.length ? a : seedUsers();
  }
  function saveUsers(a) { try { LS.setItem(USERS_KEY, JSON.stringify(a)); } catch (e) {} return a; }
  function byId(id) {
    var a = loadUsers(), i;
    for (i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
    return null;
  }

  /* ---- 登录历史 ---- */
  function history() { var h = []; try { h = JSON.parse(LS.getItem(HIST_KEY) || '[]'); } catch (e) {} return Array.isArray(h) ? h : []; }
  function saveHistory(h) { try { LS.setItem(HIST_KEY, JSON.stringify(h)); } catch (e) {} return h; }

  /* ---- 当前登录用户：engchain-state.account 匹配用户表；显式登出 → 游客；无匹配回退默认 u1 ---- */
  function current() {
    var st = (window.UI && UI.state) ? UI.state.get() : {};
    if (st.loggedIn === false) return byId('u7') || null;
    var acct = st.account || '';
    var a = loadUsers(), i;
    for (i = 0; i < a.length; i++) if (a[i].account === acct) return a[i];
    return byId('u1') || null;
  }

  /* ---- 登录：目标用户快照整体写入各 store（完整联动：身份/认证/入驻/余额/积分全端派生） ---- */
  function login(id) {
    var u = byId(id);
    if (!u) return null;
    if (window.AuthStore) AuthStore.write(JSON.parse(JSON.stringify(u.auth || {})));
    if (window.EntryStore) EntryStore.write(JSON.parse(JSON.stringify(u.entry || {})));
    if (window.BalanceStore) BalanceStore.write(JSON.parse(JSON.stringify(u.balance || { balance:0, frozen:0, totalIn:0, logs:[] })));
    if (window.CreditStore) CreditStore.write(JSON.parse(JSON.stringify(u.credits || { balance:0, logs:[], quota:{ month:'', used:0 } })));
    if (window.UI && UI.state) {
      UI.state.set({
        user: u.name, company: u.company || '', account: u.account || '',
        loggedIn: u.status !== 'guest', status: u.status === 'guest' ? 'guest' : u.status,
        member: (u.status === 'pro' || u.status === 'enterprise' || u.status === 'resident')
      });
    }
    /* 登录历史：去重置顶，限 5 条 */
    var h = history().filter(function (x) { return x !== id; });
    h.unshift(id);
    saveHistory(h.slice(0, 5));
    /* 付费墙与免费额度按新身份重估 */
    try { LS.removeItem('engchain-unlocked'); } catch (e) {}
    if (window.CreditStore) {
      var c = CreditStore.read();
      if (c.quota) { c.quota = { month: new Date().getFullYear() + '-' + (new Date().getMonth() + 1), used: 0 }; CreditStore.write(c); }
    }
    window.dispatchEvent(new CustomEvent('engchain:login', { detail: { id: id, user: u } }));
    window.dispatchEvent(new CustomEvent('engchain:state', { detail: (window.UI ? UI.state.get() : {}) }));
    audit('登录', '账号', u.name, '切换账号：' + u.tag);
    return u;
  }

  /* ---- 退出（游客态） ---- */
  function logout() {
    if (window.UI && UI.state) UI.state.set({ loggedIn: false, status: 'guest', member: false });
    try { LS.removeItem('engchain-unlocked'); } catch (e) {}
    window.dispatchEvent(new CustomEvent('engchain:login', { detail: { id: 'u7' } }));
    audit('退出登录', '账号', '', '当前账号已登出');
    return true;
  }

  /* ---- 全局重置：恢复所有用户数据到预设初始状态（仅业务数据，不动 UI 偏好） ---- */
  /* 重置范围：用户表/登录历史/认证/入驻/余额/积分/订单/供需/消息/提现/发票/佣金/团队/资质/违规/签到/监控/模式/解锁记录/收藏/角色/审计
     不重置：engchain-theme（主题偏好）、engchain-sidenav（后台侧边栏折叠状态） */
  function resetAll() {
    var KEEP = ['engchain-theme', 'engchain-sidenav'];
    var removed = [];
    try {
      var keys = [];
      for (var i = 0; i < LS.length; i++) { var k = LS.key(i); if (k && k.indexOf('engchain-') === 0 && KEEP.indexOf(k) === -1) keys.push(k); }
      keys.forEach(function (k) { LS.removeItem(k); removed.push(k); });
    } catch (e) {}
    /* 重新 seed 用户表（必须最先，后续业务数据依赖用户 ID） */
    var users = seedUsers(); saveUsers(users);
    /* 恢复默认登录历史：陈建国(u1)置顶 */
    saveHistory(['u1']);
    /* 各业务 Store 自动 seed（load 函数检测 key 为 null 时自动 seed） */
    try { loadSupply(); } catch (e) {}
    try { loadOrders(); } catch (e) {}
    try { loadMessages(); } catch (e) {}
    try { loadWithdrawals(); } catch (e) {}
    try { loadInvoices(); } catch (e) {}
    try { loadCommission(); } catch (e) {}
    try { loadViolations(); } catch (e) {}
    try { loadQualifications(); } catch (e) {}
    try { loadDistTeam(); } catch (e) {}
    try { loadDistFlows(); } catch (e) {}
    /* 当前状态设为游客 */
    if (window.UI && UI.state) {
      UI.state.set({ user: '', company: '', account: '', status: 'guest', loggedIn: false, member: false });
    }
    /* 清除付费墙解锁记录 */
    try { LS.removeItem('engchain-unlocked'); LS.removeItem('engchain-personal-unlocks'); } catch (e) {}
    /* 全局事件通知：所有页面刷新 */
    window.dispatchEvent(new CustomEvent('engchain:reset', { detail: { removed: removed.length, keys: removed } }));
    audit('全局重置', '系统', '', '清除 ' + removed.length + ' 项业务数据，恢复 8 用户初始状态');
    return { removed: removed.length, users: users.length };
  }

  /* ---- 操作日志（后台留痕 / 登录审计，engchain-audit） ---- */
  function audit(action, module, target, extra) {
    var a = [];
    try { a = JSON.parse(LS.getItem(AUDIT_KEY) || '[]'); } catch (e) {}
    var op = '';
    try { var st = (window.UI && UI.state) ? UI.state.get() : {}; op = st.user || 'system'; } catch (e) {}
    a.unshift({ ts: Date.now(), operator: op, action: action || '', module: module || '', target: target || '', extra: extra || '' });
    if (a.length > 200) a = a.slice(0, 200);
    try { LS.setItem(AUDIT_KEY, JSON.stringify(a)); } catch (e) {}
    window.dispatchEvent(new CustomEvent('engchain:audit', { detail: a[0] }));
    return a[0];
  }

  /* ---- 后台审批后同步用户表（保持用户表 = 最新业务状态） ---- */
  function syncUser(id) {
    var u = byId(id); if (!u) return null;
    if (window.AuthStore) u.auth = JSON.parse(JSON.stringify(AuthStore.read()));
    if (window.EntryStore) u.entry = JSON.parse(JSON.stringify(EntryStore.read()));
    if (window.BalanceStore) { var b = BalanceStore.read(); u.balance = { balance: b.balance, frozen: b.frozen, totalIn: b.totalIn }; }
    if (window.CreditStore) { var c = CreditStore.read(); u.credits = { balance: c.balance, quota: c.quota || { month: '', used: 0 } }; }
    var a = loadUsers();
    for (var i = 0; i < a.length; i++) if (a[i].id === id) { a[i] = u; break; }
    saveUsers(a);
    return u;
  }

  /* ---- 平台统计（后台数据总览 KPI / 运营看板用） ---- */
  /* ---- Phase 3 用户与认证中心 API ----
     权威：用户表 engchain-users（后台审批直接写用户表）；
     联动：被审用户若为当前登录账号 → 同步 AuthStore/EntryStore 快照 + UI.state + 事件广播，
           App 端（同源 iframe）经 storage 事件 / preview refreshAll 即时派生；非当前登录仅写用户表，
           下次登录 login(id) 时自然读到新状态。 */
  var ENTRYFEE_KEY = 'engchain-entry-fees';
  var TYPE_LABEL = { construction: '建筑企业', agency: '中介服务企业', partner: '合伙人企业' };
  var DEPOSIT_TYPE = { construction: 'basic', agency: 'engineering', partner: 'high' };
  function statusOf(u) {
    if (u.banned) return 'banned';
    /* v3.0：优先使用 identity 结构化字段，回退旧字段兼容 */
    if (u.identity) {
      if (u.identity.enterprise === 'resident') return 'resident';
      if (u.identity.enterprise === 'verified') return 'enterprise';
      /* v3.0：个人合伙人优先级高于个人入驻 */
      if (u.identity.partner) return 'partner';
      if (u.identity.personal === 'professional' || u.identity.personal === 'full') return 'pro';
      if (u.identity.personal === 'verified') return 'realname';
      return (u.status === 'guest') ? 'guest' : 'registered';
    }
    if (u.entry && u.entry.type && u.entry.active && u.entry.status === 'active') return 'resident';
    if (u.auth && u.auth.enterprise && u.auth.enterprise.ok) return 'enterprise';
    if (u.auth && u.auth.partner && u.auth.partner.ok) return 'partner';
    if (u.auth && u.auth.qual && u.auth.qual.ok) return 'pro';
    if (u.auth && u.auth.realname && u.auth.realname.ok) return 'realname';
    return (u.status === 'guest') ? 'guest' : 'registered';
  }
  function tagOf(u) {
    if (u.banned) return '已封禁';
    var st2 = statusOf(u);
    if (st2 === 'resident') {
      var et = (u.identity && u.identity.entryTypes && u.identity.entryTypes.length) ? u.identity.entryTypes[0] : (u.entry && u.entry.type);
      return '企业入驻 · ' + (TYPE_LABEL[et] || '');
    }
    if (st2 === 'enterprise') return '企业认证';
    if (st2 === 'partner') return '个人合伙人';
    if (st2 === 'pro') return '个人入驻';
    if (st2 === 'realname') return '个人认证';
    if (st2 === 'guest') return '游客 · 未登录';
    return '注册会员';
  }
  function entryFeeOf(type) {
    var cfg = (window.MOCK && MOCK.business) ? MOCK.business : {};
    var base = (cfg.entryTypes && cfg.entryTypes[type]) ? cfg.entryTypes[type].fee : 0;
    if (window.ModeStore && ModeStore.isBreakIn() && cfg.breakin && cfg.breakin.entry && cfg.breakin.entry[type] !== undefined) return cfg.breakin.entry[type];
    return base;
  }
  function entryLabel(type) { return TYPE_LABEL[type] || type; }
  /* 按 auth/entry 权威字段重算 u.identity（与 stores.deriveIdentity 同口径 v3.0），保证后台列表与状态一致 */
  function recomputeIdentity(u) {
    if (!u) return;
    var a = u.auth || {}, e = u.entry || {};
    var realnameOk = !!(a.realname && a.realname.ok);
    /* personalEntry 优先（v3.0），回退 personalQual / qual */
    var pe = a.personalEntry || a.personalQual || a.qual || { ok: false, list: [] };
    var proOk = !!(pe.ok && pe.list && pe.list.length);
    var partnerOk = !!(a.partner && a.partner.ok);
    var personal = 'none';
    if (proOk && partnerOk) personal = 'full';
    else if (partnerOk) personal = 'partner';
    else if (proOk) personal = 'professional';
    else if (realnameOk) personal = 'verified';
    var identities = [];
    if (realnameOk) identities.push('realname');
    if (proOk) identities.push('pro');
    if (partnerOk) identities.push('partner');
    var types = (e.types && e.types.length) ? e.types : (e.type ? [e.type] : []);
    var enterprise = 'none';
    if (types.length && e.active && e.status === 'active') enterprise = 'resident';
    else if (a.enterprise && a.enterprise.ok && a.enterprise.expireAt > Date.now()) enterprise = 'verified';
    if (enterprise === 'verified') identities.push('enterprise');
    if (enterprise === 'resident') identities.push('resident');
    u.identity = { personal: personal, partner: partnerOk, enterprise: enterprise, identities: identities, entryTypes: enterprise === 'resident' ? types : [] };
  }
  /* 被审用户若为当前登录 → 同步快照 + 状态，App 端即时派生 */
  function syncSnapshotIfCurrent(u) {
    var cu = current();
    if (!cu || cu.id !== u.id) return false;
    if (window.AuthStore) {
      var snapAuth = JSON.parse(JSON.stringify(u.auth || {}));
      /* qual 通过时镜像到 personalQual，保证 deriveIdentity 个人线识别为 professional */
      if (snapAuth.qual && snapAuth.qual.ok && !(snapAuth.personalQual && snapAuth.personalQual.ok)) {
        snapAuth.personalQual = JSON.parse(JSON.stringify(snapAuth.qual));
      }
      AuthStore.write(snapAuth);
    }
    if (window.EntryStore) EntryStore.write(JSON.parse(JSON.stringify(u.entry || {})));
    /* [FIX BM-004] 修复：原 BalanceStore.write(整个 u.balance 快照) 会用用户表快照覆盖 logs，
       导致充值后钱包历史流水被清空。改为增量 merge：只同步 balance/frozen/totalIn/totalRebate，
       保留 BalanceStore 自身 logs 数组不被覆盖。 */
    if (window.BalanceStore && u.balance) {
      var bsNow = BalanceStore.read();
      bsNow.balance = Math.round((u.balance.balance || 0) * 100) / 100;
      bsNow.frozen = Math.round((u.balance.frozen || 0) * 100) / 100;
      bsNow.totalIn = Math.round((u.balance.totalIn || 0) * 100) / 100;
      if (typeof u.balance.totalRebate === 'number') bsNow.totalRebate = Math.round(u.balance.totalRebate * 100) / 100;
      if (!bsNow.logs || !Array.isArray(bsNow.logs)) bsNow.logs = [];
      BalanceStore.write(bsNow);
    }
    if (window.UI && UI.state) {
      var st2 = statusOf(u);
      UI.state.set({ status: st2, member: (st2 === 'resident' || st2 === 'enterprise' || st2 === 'pro') });
    }
    window.dispatchEvent(new CustomEvent('engchain:auth', { detail: u.auth }));
    window.dispatchEvent(new CustomEvent('engchain:entry', { detail: u.entry }));
    return true;
  }
  function saveUsersPatch(u) {
    var a = loadUsers();
    for (var i = 0; i < a.length; i++) if (a[i].id === u.id) { a[i] = u; break; }
    saveUsers(a);
  }
  /* 认证审批（type: realname / enterprise / qual / payment） */
  function authApprove(id, type, note) {
    var u = byId(id); if (!u) return null;
    var t = Date.now();
    if (type === 'payment') {
      if (!u.auth) u.auth = {};
      u.auth.payment = { ok: true, ts: t };
    } else if (u.auth && u.auth[type]) {
      u.auth[type].ok = true;
      u.auth[type].ts = t;
      u.auth[type].status = 'approved';
      if (type === 'enterprise') u.auth[type].expireAt = t + YEAR;
      if (type === 'partner') u.auth[type].approvedAt = t;
      if (type === 'qual') {
        if (!u.auth.qual.list || !u.auth.qual.list.length) u.auth.qual.list = ['平台资质核验通过'];
        u.auth.personalQual = JSON.parse(JSON.stringify(u.auth.qual));
        /* v3.0：同步 personalEntry */
        if (!u.auth.personalEntry) u.auth.personalEntry = { ok: true, status: 'approved', note: '', submittedAt: t, list: u.auth.qual.list, certs: u.auth.qual.certs || [],
          profile: { basic: {}, education: [], work: [], project: [], skills: [], jobIntent: {}, intro: '', resumeFile: '', regStatus: null, socialSecurity: null } };
        u.auth.personalEntry.ok = true; u.auth.personalEntry.status = 'approved';
        u.auth.personalEntry.list = u.auth.qual.list; u.auth.personalEntry.certs = u.auth.qual.certs || [];
        /* 阶段一：qual 审核通过 → 激活对应用户的人才条目（pending_review → active） */
        try {
          if (window.SupplyStore && u.auth.personalEntry.userType === 'jobseeker' && u.auth.personalEntry.resumeComplete) {
            var tid = 'talent-u' + (u.account || u.id || '');
            var item = SupplyStore.byId(tid);
            if (item) {
              item.status = 'active';
              item.verified = true;
              SupplyStore.remove(tid);
              SupplyStore.add(item);
            }
          }
        } catch (eTalent) { console.warn('activate talent item error', eTalent); }
      }
    } else return null;
    recomputeIdentity(u); u.status = statusOf(u); u.tag = tagOf(u);
    saveUsersPatch(u);
    var synced = syncSnapshotIfCurrent(u);
    audit('认证通过', '认证审核', u.name, entryLabel(type) + '认证' + (synced ? '（已同步当前账号）' : ''));
    return u;
  }
  function authReject(id, type, note) {
    var u = byId(id); if (!u) return null;
    if (type === 'payment') { if (u.auth) u.auth.payment = { ok: false, ts: 0, note: note || '资料不齐' }; }
    else if (u.auth && u.auth[type]) { u.auth[type].ok = false; u.auth[type].status = 'rejected'; u.auth[type].note = note || '资料不齐';
      if (type === 'qual') u.auth.personalQual = JSON.parse(JSON.stringify(u.auth.qual));
    }
    else return null;
    /* [FIX BM-003] 修复：原企业认证驳回不退费（提交即扣，驳回仅置状态）。
       企业认证且费用>0 且尚未退款时，退回 BalanceStore 并写退款流水。 */
    if (type === 'enterprise' && u.auth.enterprise && u.auth.enterprise.fee > 0 && !u.auth.enterprise.feeRefunded) {
      var refundFee = Math.round(u.auth.enterprise.fee * 100) / 100;
      try {
        if (window.BalanceStore) {
          BalanceStore.refund(refundFee, '企业认证驳回退款', { method: u.auth.enterprise.payMethod || 'balance' });
          var bs2 = BalanceStore.read();
          if (u.balance) { u.balance.balance = bs2.balance; u.balance.frozen = bs2.frozen; u.balance.totalIn = bs2.totalIn; }
        } else if (u.balance) {
          u.balance.balance = Math.round((u.balance.balance + refundFee) * 100) / 100;
        }
      } catch (eRefund) { console.warn('authReject refund error', eRefund); }
      u.auth.enterprise.feeRefunded = true;
    }
    recomputeIdentity(u); u.status = statusOf(u); u.tag = tagOf(u);
    saveUsersPatch(u);
    syncSnapshotIfCurrent(u);
    audit('认证驳回', '认证审核', u.name, entryLabel(type) + '：' + (note || '资料不齐'));
    return u;
  }
  /* ===== 入驻两级审批（任务 2-3）：pending(待初审) → first_ok(初审通过·待终审) → active(终审通过·入驻生效) ===== */
  function entryFirstApprove(id, type, note) {
    var u = byId(id); if (!u) return null;
    if (!u.entry || u.entry.type !== type || u.entry.status !== 'pending') return null;
    u.entry.status = 'first_ok';
    u.entry.firstBy = '运营初审';
    u.entry.firstAt = Date.now();
    u.entry.firstNote = note || '';
    saveUsersPatch(u);
    syncSnapshotIfCurrent(u);
    audit('入驻初审通过', '入驻审核', u.name, entryLabel(type) + ' → 待终审');
    window.dispatchEvent(new CustomEvent('engchain:entry', { detail: u.entry }));
    return u;
  }
  function entryFinalApprove(id, type, note) {
    var u = byId(id); if (!u) return null;
    if (!u.entry || u.entry.type !== type) return null;
    if (u.entry.status !== 'first_ok' && u.entry.status !== 'pending') return null;
    var fee = entryFeeOf(type);
    var t = Date.now();
    var orderId = 'EN2026' + String(t).slice(-5);
    var dep = (window.MOCK && MOCK.business && MOCK.business.commission && MOCK.business.commission.deposit) ? MOCK.business.commission.deposit : { basic: 5000, engineering: 20000, high: 50000 };
    var prevE = u.entry || {};
    var prevTypes = (prevE.types && prevE.types.length) ? prevE.types : (prevE.type ? [prevE.type] : []);
    if (prevTypes.indexOf(type) < 0) prevTypes.push(type);
    /* [FIX BM-007] 修复：原终审凭空写 depositPaid=5000/20000/50000（未真实缴纳）。
       现取 entryApply 时记录的 depositAmount（已冻结），终审时从 BalanceStore.frozen 划转至实缴。 */
    var depTypeFinal = prevE.depositType || DEPOSIT_TYPE[type] || 'basic';
    var depAmountFinal = Math.round(((typeof prevE.depositAmount === 'number') ? prevE.depositAmount : (dep[depTypeFinal] || 0)) * 100) / 100;
    try { if (window.BalanceStore && depAmountFinal > 0 && current() && current().id === u.id) BalanceStore.commitDeposit(depAmountFinal, '入驻保证金转正 · ' + entryLabel(type)); } catch (eCommit) { console.warn('commitDeposit error', eCommit); }
    u.entry = { type: type, types: prevTypes, orderId: orderId, status: 'active', active: true, paidAt: t, expireAt: t + YEAR, depositType: depTypeFinal, depositAmount: depAmountFinal, depositPaid: depAmountFinal, auditPass: type === 'partner', firstBy: prevE.firstBy || '', firstAt: prevE.firstAt || 0, submittedAt: prevE.submittedAt || 0, contact: prevE.contact || '', tel: prevE.tel || '', scope: prevE.scope || '', fee: prevE.fee || fee };
    recomputeIdentity(u); u.status = statusOf(u); u.tag = tagOf(u);
    saveUsersPatch(u);
    var fees = [];
    try { fees = JSON.parse(LS.getItem(ENTRYFEE_KEY) || '[]'); } catch (e) {}
    fees.unshift({ orderId: orderId, uid: id, userName: u.name, type: type, typeLabel: entryLabel(type), fee: fee, cycle: 'once', status: 'paid', ts: t });
    try { LS.setItem(ENTRYFEE_KEY, JSON.stringify(fees)); } catch (e) {}
    var synced = syncSnapshotIfCurrent(u);
    window.dispatchEvent(new CustomEvent('engchain:entry', { detail: u.entry }));
    audit('入驻终审通过', '入驻审核', u.name, entryLabel(type) + ' 入驻费 ¥' + fee + (synced ? '（已同步当前账号）' : ''));
    return u;
  }
  /* 入驻审批（type: construction / agency / partner）——兼容单级直通（两级页面请用 First/Final） */
  function entryApprove(id, type) {
    var u = byId(id); if (!u) return null;
    var fee = entryFeeOf(type);
    var t = Date.now();
    var orderId = 'EN2026' + String(t).slice(-5);
    var dep = (window.MOCK && MOCK.business && MOCK.business.commission && MOCK.business.commission.deposit) ? MOCK.business.commission.deposit : { basic: 5000, engineering: 20000, high: 50000 };
    var prevE2 = u.entry || {};
    var prevTypes2 = (prevE2.types && prevE2.types.length) ? prevE2.types : (prevE2.type ? [prevE2.type] : []);
    if (prevTypes2.indexOf(type) < 0) prevTypes2.push(type);
    /* [FIX BM-007] 同上：单级直通审批也从已冻结保证金划转，不凭空写 depositPaid。 */
    var depTypeAppr = prevE2.depositType || DEPOSIT_TYPE[type] || 'basic';
    var depAmountAppr = Math.round(((typeof prevE2.depositAmount === 'number') ? prevE2.depositAmount : (dep[depTypeAppr] || 0)) * 100) / 100;
    try { if (window.BalanceStore && depAmountAppr > 0 && current() && current().id === u.id) BalanceStore.commitDeposit(depAmountAppr, '入驻保证金转正 · ' + entryLabel(type)); } catch (eCommit2) { console.warn('commitDeposit error', eCommit2); }
    u.entry = { type: type, types: prevTypes2, orderId: orderId, status: 'active', active: true, paidAt: t, expireAt: t + YEAR, depositType: depTypeAppr, depositAmount: depAmountAppr, depositPaid: depAmountAppr, auditPass: type === 'partner', submittedAt: prevE2.submittedAt || 0, contact: prevE2.contact || '', tel: prevE2.tel || '', scope: prevE2.scope || '', fee: prevE2.fee || fee };
    recomputeIdentity(u); u.status = statusOf(u); u.tag = tagOf(u);
    saveUsersPatch(u);
    var fees = [];
    try { fees = JSON.parse(LS.getItem(ENTRYFEE_KEY) || '[]'); } catch (e) {}
    fees.unshift({ orderId: orderId, uid: id, userName: u.name, type: type, typeLabel: entryLabel(type), fee: fee, cycle: 'once', status: 'paid', ts: t });
    try { LS.setItem(ENTRYFEE_KEY, JSON.stringify(fees)); } catch (e) {}
    var synced = syncSnapshotIfCurrent(u);
    window.dispatchEvent(new CustomEvent('engchain:entry', { detail: u.entry }));
    audit('入驻通过', '入驻审核', u.name, entryLabel(type) + ' 入驻费 ¥' + fee + (synced ? '（已同步当前账号）' : ''));
    return u;
  }
  function entryReject(id, type, note, level) {
    var u = byId(id); if (!u) return null;
    u.entry = u.entry || {};
    var prevStatus = u.entry.status;
    u.entry.status = 'rejected'; u.entry.note = note || '资料不齐，请补充后重新提交'; u.entry.active = false;
    u.entry.rejectLevel = level || (prevStatus === 'first_ok' ? 'final' : 'first');
    u.entry.rejectedAt = Date.now();
    /* [FIX BM-006] 修复：原入驻驳回不退费。已支付入驻费且未退款时退回 BalanceStore；
       已冻结保证金一并解冻。 */
    if (!u.entry.feeRefunded) {
      var entryFee = Math.round((u.entry.fee || 0) * 100) / 100;
      if (entryFee > 0) {
        try {
          if (window.BalanceStore) {
            BalanceStore.refund(entryFee, '入驻驳回退款', { method: 'balance' });
            var bsE = BalanceStore.read();
            if (u.balance) { u.balance.balance = bsE.balance; u.balance.frozen = bsE.frozen; }
          } else if (u.balance) {
            u.balance.balance = Math.round((u.balance.balance + entryFee) * 100) / 100;
          }
        } catch (eEntryRef) { console.warn('entryReject fee refund error', eEntryRef); }
        u.entry.feeRefunded = true;
      }
      var depAmt = Math.round((u.entry.depositAmount || 0) * 100) / 100;
      if (depAmt > 0) {
        try { if (window.BalanceStore) BalanceStore.unfreezeDeposit(depAmt, '入驻驳回 · 保证金解冻'); } catch (eDep) { console.warn('entryReject unfreeze error', eDep); }
        u.entry.depositAmount = 0;
        u.entry.depositPaid = 0;
      }
    }
    recomputeIdentity(u); u.status = statusOf(u); u.tag = tagOf(u);
    saveUsersPatch(u);
    syncSnapshotIfCurrent(u);
    var act = level === 'final' ? '入驻终审驳回' : (level === 'first' ? '入驻初审驳回' : '入驻驳回');
    audit(act, '入驻审核', u.name, entryLabel(type) + '：' + (note || ''));
    return u;
  }
  /* ===== App 端 → 后台：认证申请（app↔后台连通） =====
     realname：二要素+活体自动核验即时通过；enterprise/qual：入后台认证审核队列（pending，由后台通过/驳回）
     权威写用户表并同步当前账号快照；fee 非 0 时从用户余额扣减 */
  /* [FIX BM-001/BM-002/BM-005/BM-009] authApply 新增第 4 参 payMethod：
     'balance'|'wechat'|'alipay'|'corp'。企业认证收费统一经 BalanceStore.consume 扣减并写 logs，
     logs.method 记录所选方式；非余额通道标注"模拟支付"。选对公转账(corp)不扣款，生成 CorpPay 待审记录。 */
  function authApply(type, payload, fee, payMethod) {
    payload = payload || {};
    var u = current();
    if (!u) return { error: '未登录' };
    if (!u.auth) u.auth = {};
    var t = Date.now();
    if (type === 'realname') {
      var idNo = payload.idNo || '';
      u.auth.realname = { ok: true, ts: t, name: payload.name || u.name,
        idMask: idNo ? (idNo.slice(0, 4) + '**********' + idNo.slice(-4)) : '',
        mobile: payload.mobile || '', auto: true };
    } else if (type === 'enterprise') {
      if (u.auth.enterprise && u.auth.enterprise.ok) return { error: '已通过企业认证，无需重复提交' };
      /* 驳回后重新提交不重复收取认证费（审核通过前仅收一次） */
      var paidBefore = u.auth.enterprise && u.auth.enterprise.fee && !u.auth.enterprise.ok && !u.auth.enterprise.feeRefunded;
      var charge = paidBefore ? 0 : (fee || 0);
      payMethod = payMethod || (payload.payMethod || 'balance');
      /* [FIX BM-009] 余额判断统一用 BalanceStore.available()（=balance-frozen），排除冻结资金 */
      if (charge && payMethod !== 'corp' && window.BalanceStore && BalanceStore.available() < charge) {
        return { error: '余额不足，请先充值后再支付认证费' };
      }
      u.auth.enterprise = { ok: false, expireAt: 0, status: 'pending', submittedAt: t,
        co: payload.co || '', code: payload.code || '', legal: payload.legal || '',
        shortName: payload.shortName || '', nameBasis: payload.nameBasis || '', nameProof: payload.nameProof || [],
        fee: (u.auth.enterprise && u.auth.enterprise.fee) || fee || 0, note: '', resubmit: !!paidBefore,
        payMethod: payMethod };
      if (charge) {
        if (payMethod === 'corp') {
          /* [FIX BM-002] 对公转账：不扣款，生成待审 CorpPay 记录，后台审批通过后入账/扣费 */
          try {
            if (window.CorpPay) {
              var corpRec = CorpPay.create({
                amount: charge, status: 'pending', bizType: 'enterprise_cert', uid: u.id,
                remark: '企业认证服务费 · ' + (payload.co || u.name),
                appliedAt: t
              });
              u.auth.enterprise.corpPayId = corpRec.id;
            }
          } catch (eCorp) { console.warn('enterprise corp pay create error', eCorp); }
          u.auth.enterprise.awaitingCorp = true;
        } else {
          /* [FIX BM-001/BM-005] 统一走 BalanceStore.consume 扣减并写 logs；非余额通道标注模拟支付 */
          var simMark = (payMethod === 'wechat' || payMethod === 'alipay') ? '(模拟支付)' : '';
          var r = null;
          if (window.BalanceStore) {
            r = BalanceStore.consume(charge, 'certification', { method: payMethod, remark: '企业认证服务费' + simMark });
          } else if (u.balance) {
            u.balance.balance = Math.round((u.balance.balance - charge) * 100) / 100;
          }
          if (!r && window.BalanceStore) return { error: '余额不足，请先充值后再支付认证费' };
          /* 回写用户表 u.balance */
          try { if (window.BalanceStore) { var bs3 = BalanceStore.read(); u.balance = u.balance || {}; u.balance.balance = bs3.balance; u.balance.frozen = bs3.frozen; u.balance.totalIn = bs3.totalIn; } } catch (eSyncB) {}
        }
      }
    } else if (type === 'qual') {
      var certs = (payload.list || []).map(function (x) {
        return (typeof x === 'string') ? { name: x, no: '' } : x;
      });
      var q = { ok: false, status: 'pending', submittedAt: t,
        list: certs.map(function (x) { return x.name; }), certs: certs, note: '' };
      u.auth.qual = q;
      u.auth.personalQual = JSON.parse(JSON.stringify(q));
      /* v3.0：同步写入 personalEntry（个人入驻新结构，含 profile 占位） */
      if (!u.auth.personalEntry) u.auth.personalEntry = { ok: false, status: '', note: '', submittedAt: 0, list: [], certs: [],
        profile: { basic: {}, education: [], work: [], project: [], skills: [], jobIntent: {}, intro: '', resumeFile: '' } };
      u.auth.personalEntry.ok = false; u.auth.personalEntry.status = 'pending';
      u.auth.personalEntry.submittedAt = t; u.auth.personalEntry.list = q.list;
      u.auth.personalEntry.certs = certs;
    } else if (type === 'partner') {
      /* v3.0：个人合伙人申请（与企业入驻 partner 类型分离） */
      if (u.auth.partner && u.auth.partner.ok) return { error: '已通过个人合伙人认证，无需重复提交' };
      u.auth.partner = { ok: false, status: 'pending', note: '', submittedAt: t, approvedAt: 0,
        channel: payload.channel || [], intent: payload.intent || '',
        intro: payload.intro || '', experience: payload.experience || '', profitConfig: {} };
    } else return { error: '未知认证类型' };
    recomputeIdentity(u); u.status = statusOf(u); u.tag = tagOf(u);
    saveUsersPatch(u);
    syncSnapshotIfCurrent(u);
    audit(type === 'realname' ? '实名认证（自动核验）' : '提交认证申请', '认证审核', u.name,
      entryLabel(type) + (type === 'realname' ? ' · 人脸与二要素核验通过' : ' · 待后台审核'));
    return { ok: true, pending: type !== 'realname', user: u };
  }
  /* 企业认证续费：已认证用户支付后即时延长一年 */
  function authRenew(fee) {
    var u = current();
    if (!u) return { error: '未登录' };
    if (!(u.auth && u.auth.enterprise && u.auth.enterprise.ok)) return { error: '请先完成企业认证' };
    if (fee && !(u.balance && u.balance.balance >= fee)) return { error: '余额不足，请先充值' };
    var base = Math.max(u.auth.enterprise.expireAt || 0, Date.now());
    u.auth.enterprise.expireAt = base + YEAR;
    u.auth.enterprise.renewedAt = Date.now();
    if (fee && u.balance) u.balance.balance -= fee;
    recomputeIdentity(u); u.status = statusOf(u); u.tag = tagOf(u);
    saveUsersPatch(u);
    syncSnapshotIfCurrent(u);
    audit('企业认证续费', '认证审核', u.name, '有效期至 ' + new Date(u.auth.enterprise.expireAt).toISOString().slice(0, 10));
    return { ok: true, expireAt: u.auth.enterprise.expireAt };
  }
  /* App 端 → 后台：入驻申请（三类统一进入后台两级审核队列；partner 免费审核制） */
  /* [FEAT 9.2-2] 增加 cycle 参数：once=一次性 / yearly=年度订阅 */
  function entryApply(type, payload, fee) {
    payload = payload || {};
    var u = current();
    if (!u) return { error: '未登录' };
    if (u.entry && (u.entry.status === 'pending' || u.entry.status === 'first_ok')) return { error: '已有入驻申请正在审核中' };
    /* [FIX BM-009] 余额判断统一用 BalanceStore.available()（=balance-frozen），排除冻结资金 */
    if (fee && window.BalanceStore && BalanceStore.available() < fee) return { error: '余额不足，请先充值后再支付入驻费' };
    var t = Date.now();
    /* [FIX BM-007] 保证金项选择：payload.depositType 决定保证金档位，提交时真实冻结 */
    var depCfg = (window.MOCK && MOCK.business && MOCK.business.commission && MOCK.business.commission.deposit) ? MOCK.business.commission.deposit : { basic: 5000, engineering: 20000, high: 50000 };
    var depTypeChosen = payload.depositType || DEPOSIT_TYPE[type] || 'basic';
    var depAmountChosen = Math.round((depCfg[depTypeChosen] || 0) * 100) / 100;
    if (fee && window.BalanceStore) {
      /* [FIX BM-008] 入驻费经 BalanceStore.consume 扣减并写 logs type='entry' */
      var consumeR = BalanceStore.consume(fee, 'entry', { method: 'balance', remark: '入驻费 · ' + entryLabel(type) });
      if (!consumeR) return { error: '余额不足，请先充值后再支付入驻费' };
      var bsE2 = BalanceStore.read();
      u.balance = u.balance || {}; u.balance.balance = bsE2.balance; u.balance.frozen = bsE2.frozen; u.balance.totalIn = bsE2.totalIn;
    } else if (fee && u.balance) {
      u.balance.balance = Math.round((u.balance.balance - fee) * 100) / 100;
    }
    /* [FIX BM-007] 冻结保证金（partner 免费审核制不收保证金） */
    if (type !== 'partner' && depAmountChosen > 0 && window.BalanceStore) {
      var fr = BalanceStore.freezeDeposit(depAmountChosen, '入驻保证金冻结 · ' + entryLabel(type));
      if (!fr) {
        /* 保证金不足：回滚已扣入驻费 */
        if (fee && window.BalanceStore) BalanceStore.refund(fee, '保证金不足 · 入驻费回滚', { method: 'balance' });
        return { error: '保证金可用余额不足，请先充值' };
      }
      var bsF = BalanceStore.read();
      u.balance = u.balance || {}; u.balance.balance = bsF.balance; u.balance.frozen = bsF.frozen;
    }
    /* 保留历史已申请/已入驻类型（含并行类型与驳回重提场景） */
    var prevTypes = (u.entry && u.entry.types && u.entry.types.length) ? u.entry.types.slice() : (u.entry && u.entry.type ? [u.entry.type] : []);
    var types = prevTypes.indexOf(type) < 0 ? prevTypes.concat(type) : prevTypes;
    u.entry = { type: type, types: types, orderId: null, status: 'pending', active: false,
      paidAt: (type === 'partner') ? 0 : t, fee: fee || 0,
      depositType: depTypeChosen, depositAmount: depAmountChosen, depositPaid: 0,
      contact: payload.contact || '', tel: payload.tel || '', scope: payload.scope || '',
      qualifications: payload.qualifications || [],
      intro: payload.intro || { founded: '', capital: '', staffSize: '', desc: '' },
      cases: payload.cases || [],
      address: payload.address || { province: '', city: '', district: '', detail: '' },
      website: payload.website || '', attachments: payload.attachments || [],
      /* [FEAT 9.2-2] 付费模式 */
      cycle: payload.cycle || 'once',
      submittedAt: t, note: '' };
    recomputeIdentity(u); u.status = statusOf(u); u.tag = tagOf(u);
    saveUsersPatch(u);
    syncSnapshotIfCurrent(u);
    audit('提交入驻申请', '入驻审核', u.name, entryLabel(type) + (fee ? ' · 入驻费 ¥' + fee : ' · 后台审核制') + (depAmountChosen ? ' · 保证金冻结 ¥' + depAmountChosen : ''));
    return { ok: true, entry: u.entry };
  }
  /* [FIX BM-033] 封禁时冻结全部可用余额并写 logs，解封时恢复；
     isBanned(uid) 供前台数据层门控查询。 */
  function isBanned(uid) {
    var u = byId(uid);
    return !!(u && u.banned);
  }
  function toggleBan(id) {
    var u = byId(id); if (!u || u.status === 'guest') return null;
    u.banned = !u.banned;
    try {
      if (window.BalanceStore) {
        if (u.banned) {
          var availNow = BalanceStore.available();
          if (availNow > 0) {
            var bsB = BalanceStore.read();
            bsB.frozen = Math.round((bsB.frozen + availNow) * 100) / 100;
            bsB.logs.unshift({ type: 'freeze', amount: -availNow, method: 'ban', reason: '风控封禁 · 全额冻结', ts: Date.now() });
            BalanceStore.write(bsB);
          }
        } else {
          /* 解封：将封禁期间冻结的可用部分解冻（保守地解冻当前 frozen 中非提现占用的部分，
             原型单钱包：直接将全部 frozen 释放回可用） */
          var bsU = BalanceStore.read();
          if (bsU.frozen > 0) {
            bsU.logs.unshift({ type: 'unfreeze', amount: bsU.frozen, method: 'ban', reason: '解除封禁 · 解冻冻结资金', ts: Date.now() });
            bsU.frozen = 0;
            BalanceStore.write(bsU);
          }
        }
        if (current() && current().id === u.id) {
          var bsSync = BalanceStore.read();
          u.balance = u.balance || {}; u.balance.balance = bsSync.balance; u.balance.frozen = bsSync.frozen; u.balance.totalIn = bsSync.totalIn;
        }
      }
    } catch (eBan) { console.warn('toggleBan balance error', eBan); }
    recomputeIdentity(u); u.status = statusOf(u); u.tag = tagOf(u);
    saveUsersPatch(u);
    syncSnapshotIfCurrent(u);
    audit(u.banned ? '封禁账号' : '解除封禁', '用户管理', u.name, u.banned ? '已封禁 · 资金冻结' : '已解锁 · 资金解冻');
    return u;
  }
  function loadEntryFees() { var a = []; try { a = JSON.parse(LS.getItem(ENTRYFEE_KEY) || '[]'); } catch (e) {} return Array.isArray(a) ? a : []; }


  function stats() {
    var users = loadUsers();
    var resident = 0, enterprise = 0, realname = 0, i;
    for (i = 0; i < users.length; i++) {
      if (users[i].entry && users[i].entry.active && users[i].entry.status === 'active') resident++;
      if (users[i].auth && users[i].auth.enterprise && users[i].auth.enterprise.ok) enterprise++;
      if (users[i].auth && users[i].auth.realname && users[i].auth.realname.ok) realname++;
    }
    var corp = (window.CorpPay ? CorpPay.list() : []);
    var corpPending = 0;
    for (i = 0; i < corp.length; i++) if (corp[i].status === 'pending' || corp[i].status === 'submitted') corpPending++;
    var cm = (window.CommissionStore ? CommissionStore.read() : { flows: [] });
    var feeTotal = 0;
    for (i = 0; i < (cm.flows || []).length; i++) feeTotal += cm.flows[i].fee || 0;
  
  return {
      users: Math.max(0, users.length - 1),   /* 游客不计注册 */
      realname: realname, enterprise: enterprise, resident: resident,
      corpPending: corpPending, feeTotal: feeTotal, feeCount: (cm.flows || []).length
    };
  }

  /* ---- 供需内容审核 Store（Phase 2 运营中心 · 供需管理） ----
     基线：9 类供需演示条目；状态机：pending(待审核)→on(上架)/rejected(已驳回)；on↔off(下架)
     后台审核动作写回本层并广播 engchain:supply，App 供需列表可监听同步。 */
  var SUPPLY_KEY = 'engchain-supply';
  function seedSupply() {
    var t = function (d) { return new Date(Date.now() - d * 864e5).toISOString().slice(0, 10); };
    return [
      { id:'SU001', cat:'材料', dir:'demand', title:'成都天府新区商业综合体 急需商品混凝土 C30/C40', company:'四川中建××建设有限公司', location:'成都·天府新区', amount:'¥1,350,000', publisher:'u1', status:'on', ts:t(1), note:'' },
      { id:'SU002', cat:'材料', dir:'supply', title:'供应 P.O42.5 散装水泥/商品砂浆 厂家直发 成都仓', company:'成都××建材供应有限公司', location:'成都·双流', amount:'¥860,000', publisher:'u3', status:'on', ts:t(2), note:'' },
      { id:'SU003', cat:'设备', dir:'demand', title:'重庆江津 河道治理工程 急租 塔吊 QTZ63', company:'重庆××水利工程有限公司', location:'重庆·江津', amount:'¥420,000', publisher:'u5', status:'pending', ts:t(0), note:'' },
      { id:'SU004', cat:'设备', dir:'supply', title:'供应 塔吊/施工电梯 整机租赁 成都辐射西南', company:'成都××机械租赁有限公司', location:'成都·高新区', amount:'¥260,000', publisher:'u1', status:'on', ts:t(3), note:'' },
      { id:'SU005', cat:'劳务', dir:'demand', title:'贵阳乌当区老旧小区改造 防水项目分包', company:'贵阳××建设有限公司', location:'贵阳·乌当', amount:'¥180,000', publisher:'u3', status:'pending', ts:t(0), note:'' },
      { id:'SU006', cat:'劳务', dir:'supply', title:'供应 钢筋工/木工/混凝土工 劳务班组 可进场', company:'四川××劳务分包有限公司', location:'成都·青白江', amount:'按工日', publisher:'u1', status:'on', ts:t(2), note:'' },
      { id:'SU007', cat:'合作', dir:'supply', title:'大型公建 EPC 联合体联营 寻求设计+施工伙伴', company:'××建筑设计院', location:'成都·锦江', amount:'面议', publisher:'u3', status:'on', ts:t(4), note:'' },
      { id:'SU008', cat:'合作', dir:'demand', title:'市政道路项目 劳务分包合作 长期稳定需求', company:'成都××市政工程有限公司', location:'成都·温江', amount:'¥950,000', publisher:'u5', status:'pending', ts:t(0), note:'' },
      { id:'SU009', cat:'中介', dir:'supply', title:'建筑资质升级代办 施工总承包二升一 全程服务', company:'四川××工程中介服务有限公司', location:'成都·高新', amount:'¥68,000', publisher:'u2', status:'on', ts:t(1), note:'' },
      { id:'SU010', cat:'中介', dir:'supply', title:'安许代办/资质分立 西南区域 承诺制办理', company:'××企业管理咨询有限公司', location:'成都·武侯', amount:'¥25,000', publisher:'u2', status:'rejected', ts:t(6), note:'材料真实性存疑，请补充安许有效期证明' },
      { id:'SU011', cat:'资质招商', dir:'supply', title:'电力工程施工总承包一级 寻分公司合作', company:'贵州黔电电力工程有限公司', location:'贵阳·观山湖', amount:'10-30万/年', publisher:'u1', status:'on', ts:t(2), note:'' },
      { id:'SU012', cat:'资质招商', dir:'supply', title:'建筑工程施工总承包一级 联营/分公司挂靠', company:'四川××建设集团有限公司', location:'成都·青羊', amount:'面议', publisher:'u3', status:'on', ts:t(5), note:'' },
      { id:'SU013', cat:'建企买卖', dir:'supply', title:'公路工程施工总承包二级 建企整体转让', company:'××路桥建设工程有限公司', location:'成都·双流', amount:'¥580,000', publisher:'u1', status:'on', ts:t(3), note:'' },
      { id:'SU014', cat:'建企买卖', dir:'demand', title:'收购 水利水电施工总承包三级 带安许 川内', company:'成都××投资有限公司', location:'成都·成华', amount:'¥300,000', publisher:'u5', status:'pending', ts:t(0), note:'' },
      { id:'SU015', cat:'招聘', dir:'demand', title:'招聘 一级建造师（建筑工程） 成都 全职', company:'四川××建设有限公司', location:'成都·高新', amount:'薪资面议', publisher:'u1', status:'on', ts:t(1), note:'' },
      { id:'SU016', cat:'求职', dir:'supply', title:'一级建造师（建筑+市政双证） 寻求全职/顾问', company:'张×（个人）', location:'成都', amount:'面议', publisher:'u4', status:'on', ts:t(2), note:'' },
      { id:'SU017', cat:'材料', dir:'demand', title:'西安浐灞项目 急需 级配碎石/砂石料 采购询价', company:'西安××建设集团有限公司', location:'西安·浐灞', amount:'¥750,000', publisher:'u5', status:'pending', ts:t(0), note:'' },
      { id:'SU018', cat:'设备', dir:'supply', title:'供应 挖掘机/装载机 台班出租 带司机', company:'成都××工程机械有限公司', location:'成都·新都', amount:'按台班', publisher:'u1', status:'off', ts:t(8), note:'季节性调整下架' },
      { id:'SU019', cat:'劳务', dir:'supply', title:'供应 水电安装班组 持证上岗 可全国进场', company:'四川××水电安装有限公司', location:'成都·金牛', amount:'按工日', publisher:'u3', status:'on', ts:t(1), note:'' },
      { id:'SU020', cat:'合作', dir:'supply', title:'建材供应链招商加盟 区域独家授权', company:'××供应链管理有限公司', location:'成都·龙泉驿', amount:'¥120,000', publisher:'u8', status:'pending', ts:t(0), note:'' },
      { id:'SU021', cat:'中介', dir:'supply', title:'工商注册/变更 建筑类公司 加急代办', company:'××企业管理服务有限公司', location:'成都·锦江', amount:'¥8,800', publisher:'u2', status:'on', ts:t(2), note:'' },
      { id:'SU022', cat:'资质招商', dir:'supply', title:'水利水电施工总承包二级 资质联营合作', company:'××水利水电工程有限公司', location:'绵阳·涪城', amount:'面议', publisher:'u3', status:'on', ts:t(4), note:'' },
      { id:'SU023', cat:'建企买卖', dir:'supply', title:'机电安装专业承包一级 带安许 转让', company:'××机电安装工程有限公司', location:'德阳·旌阳', amount:'¥420,000', publisher:'u1', status:'off', ts:t(9), note:'资料更新中，暂下架' },
      { id:'SU024', cat:'求职', dir:'supply', title:'造价工程师（一级） 10 年经验 全职/项目制', company:'李×（个人）', location:'成都·天府新区', amount:'面议', publisher:'u4', status:'pending', ts:t(0), note:'' }
    ];
  }
  function loadSupply() {
    /* L1：统一从 SupplyStore（engchain-supply {items:[]}）读取，兼容旧数组格式；空时自动 seed（resetAll 后恢复） */
    if (window.SupplyStore) {
      var items = SupplyStore.read().items || [];
      if (!items.length) {
        var seed = seedSupply();
        items = seed.map(function (x) {
          var st = x.status;
          if (st === 'on') st = 'active';
          else if (st === 'pending') st = 'pending_review';
          return Object.assign({}, x, { status: st });
        });
        var s2 = SupplyStore.read(); s2.items = items; SupplyStore.write(s2);
      }
      return items;
    }
    var a = [];
    try {
      var raw = JSON.parse(LS.getItem(SUPPLY_KEY) || 'null');
      a = Array.isArray(raw) ? raw : (raw && raw.items ? raw.items : []);
    } catch (e) { a = []; }
    return Array.isArray(a) ? a : [];
  }
  /* 确保 SupplyStore 有种子数据（resetAll 清除后自动恢复；首次加载为空时 seed） */
  (function ensureSupplySeed() {
    if (!window.SupplyStore) return;
    var s = SupplyStore.read();
    if (!s.items || !s.items.length) {
      var seed = seedSupply();
      s.items = seed.map(function (x) {
        var st = x.status;
        if (st === 'on') st = 'active';
        else if (st === 'pending') st = 'pending_review';
        return Object.assign({}, x, { status: st });
      });
      SupplyStore.write(s);
    }
  })();
  function saveSupply(a) {
    if (window.SupplyStore) { var s = SupplyStore.read(); s.items = a; SupplyStore.write(s); return a; }
    try { LS.setItem(SUPPLY_KEY, JSON.stringify(a)); } catch (e) {}
    return a;
  }
  function supplyAudit(id, action, note) {
    if (!window.SupplyStore) return null;
    var it = SupplyStore.byId(id);
    if (!it) return null;
    var s = SupplyStore.read();
    s.items.forEach(function (x) {
      if (x.id === id) {
        if (action === 'approve' || action === 'on') x.status = 'active';
        else if (action === 'reject') { x.status = 'rejected'; x.note = note || '内容不符合发布规范'; }
        else if (action === 'off') { x.status = 'off'; x.note = note || '主动下架'; }
        x.auditTs = Date.now();
      }
    });
    SupplyStore.write(s);
    var updated = SupplyStore.byId(id);
    window.dispatchEvent(new CustomEvent('engchain:supply', { detail: { id: id, status: updated ? updated.status : it.status } }));
    return updated;
  }

  /* ---- L1 统一供需发布/审核 API（publish/* → DataBus → SupplyStore → 后台审核 → App 可见） ---- */
  function publishSupply(payload) {
    if (!window.SupplyStore) return null;
    var item = SupplyStore.add(payload);
    audit('发布供需', '运营', '供需管理', item.title + '（待审核）');
    return item;
  }
  function supplyApprove(id) {
    if (!window.SupplyStore) return;
    SupplyStore.approve(id);
    audit('供需上架', '运营', '供需管理', id);
    window.dispatchEvent(new CustomEvent('engchain:supply', { detail: { id: id, status: 'active' } }));
  }
  function supplyReject(id, note) {
    if (!window.SupplyStore) return;
    SupplyStore.reject(id, note);
    audit('供需驳回', '运营', '供需管理', id + ': ' + note);
    window.dispatchEvent(new CustomEvent('engchain:supply', { detail: { id: id, status: 'rejected' } }));
  }
  function supplyList(status) {
    if (!window.SupplyStore) return [];
    if (status === 'active') return SupplyStore.listActive();
    if (status === 'pending') return SupplyStore.listPending();
    return SupplyStore.read().items || [];
  }

  /* ---- 订单生命周期 Store（Phase 2 运营中心 · 订单管理） ----
     类型：供方承接 / 需求匹配 / 中介撮合 / 建企买卖 / 资质招商
     状态机：pending(待支付)→serving(服务中)→await_accept(待验收)→settled(已结算)；→cancelled(已取消)
     里程碑：金额 ≥5 万按 4 节点 30/30/30/10 分期（规则同源 data.js commission.milestone）；<5 万整单结算。
     佣金：commissionRate(amount) 同源（stores.js 暴露） */
  var ORDERS_KEY = 'engchain-orders';
  function seedOrders() {
    var t = function (d) { return new Date(Date.now() - d * 864e5).toISOString().slice(0, 10); };
    function mk(id, type, title, amount, owner, counterparty, status, day, ms) {
      var M = (window.MOCK && MOCK.business && MOCK.business.commission && MOCK.business.commission.milestone) || { enable: true, minAmount: 50000, nodes: [0.3,0.3,0.3,0.1], labels:['合同签订','服务进度50%','验收','质保期满'] };
      var multi = M.enable && amount >= M.minAmount;
      var nodes = multi ? M.nodes : [1];
      var labels = multi ? M.labels : ['整单结算'];
      var milestones = [];
      for (var i = 0; i < nodes.length; i++) {
        milestones.push({ label: labels[i] || ('节点' + (i+1)), pct: nodes[i], status: 'todo', doneAt: 0 });
      }
      var fee = 0, rate = 0;
      /* 已结算订单：里程碑全达成 + 佣金按 orderCalc 全额计提（与结算逻辑同源，演示数据不自相矛盾） */
      if (status === 'settled') {
        var c = orderCalc(amount);
        milestones.forEach(function (m) { m.status = 'done'; m.doneAt = Date.now(); });
        fee = c.fee; rate = c.rate;
      }
      return { id:id, type:type, title:title, amount:amount, owner:owner, counterparty:counterparty,
               status:status, ts:t(day), milestones:milestones, fee:fee, rate:rate, note:'' };
    }
    return [
      mk('EN20260904001','supply','商品混凝土供应承接 · 天府新区综合体', 320000, 'u1', '四川中建××建设有限公司', 'settled', 1, true),
      mk('EN20260903058','need','塔吊租赁需求匹配 · 重庆江津河道治理', 86000, 'u5', '成都××机械租赁有限公司', 'serving', 2, true),
      mk('EN20260903021','agency','中介撮合 · 资质升级代办（二升一）', 500000, 'u2', '××建设集团有限公司', 'await_accept', 3, true),
      mk('EN20260902094','supply','劳务班组供应承接 · 贵阳旧改防水分包', 45200, 'u1', '贵阳××建设有限公司', 'serving', 4, false),
      mk('EN20260902012','need','砂石料采购匹配 · 西安浐灞项目', 12800, 'u5', '西安××建设集团有限公司', 'cancelled', 5, false),
      mk('EN20260901077','transfer','建企买卖 · 公路二级整体转让', 580000, 'u1', '××路桥建设工程有限公司', 'serving', 6, true),
      mk('EN20260901033','qual','资质招商 · 电力一级分公司合作', 200000, 'u1', '贵州黔电电力工程有限公司', 'pending', 6, true),
      mk('EN20260831009','agency','中介撮合 · 安许代办承诺制', 25000, 'u2', '××企业管理咨询有限公司', 'settled', 8, false),
      mk('EN20260831021','supply','水泥供应承接 · 成都双流仓', 96000, 'u3', '成都××建材供应有限公司', 'serving', 8, true),
      mk('EN20260830055','need','汽车吊租赁匹配 · 西安泾河项目', 54000, 'u5', '成都××工程机械有限公司', 'await_accept', 9, true),
      mk('EN20260830018','transfer','建企买卖 · 机电一级带安许转让', 420000, 'u1', '××机电安装工程有限公司', 'pending', 9, true),
      mk('EN20260829003','qual','资质招商 · 水利二级联营合作', 0, 'u3', '××水利水电工程有限公司', 'cancelled', 10, true),
      mk('EN20260828044','supply','水电班组承接 · 成都金牛项目', 61000, 'u3', '四川××水电安装有限公司', 'serving', 11, true),
      mk('EN20260828007','agency','中介撮合 · 工商注册加急代办', 8800, 'u2', '××企业管理服务有限公司', 'settled', 11, false),
      mk('EN20260827019','need','防水分包匹配 · 西安浐灞旧改', 33200, 'u5', '××防水工程有限公司', 'settled', 12, false),
      mk('EN20260827031','supply','塔吊整机租赁承接 · 成都辐射西南', 158000, 'u1', '××建设集团有限公司', 'pending', 12, true)
    ];
  }
  function loadOrders() {
    var a = [];
    try {
      if (LS.getItem(ORDERS_KEY) === null) { a = seedOrders(); saveOrders(a); return a; }
      a = JSON.parse(LS.getItem(ORDERS_KEY) || '[]');
    } catch (e) { a = []; }
    return Array.isArray(a) && a.length ? a : seedOrders();
  }
  function saveOrders(a) { try { LS.setItem(ORDERS_KEY, JSON.stringify(a)); } catch (e) {} return a; }
  function orderCalc(amount) {
    /* 规则同源：调用 stores.js 暴露的 commissionRate（同 data.js 阶梯 + 破冰期首档） */
    var r = { rate: 0.08, fee: 0 };
    try { r = window.commissionRate ? commissionRate(amount) : r; } catch (e) {}
    var M = (window.MOCK && MOCK.business && MOCK.business.commission && MOCK.business.commission.milestone) || { enable: true, minAmount: 50000, nodes: [0.3,0.3,0.3,0.1], labels:['合同签订','服务进度50%','验收','质保期满'] };
    var nodes = (M.enable && amount >= M.minAmount) ? M.nodes : [1];
    var labels = (M.enable && amount >= M.minAmount) ? M.labels : ['整单结算'];
    var items = nodes.map(function (p, i) { return { label: labels[i] || ('节点' + (i+1)), pct: p, fee: Math.round(r.fee * p * 100) / 100 }; });
    return { rate: r.rate, fee: r.fee, milestone: (M.enable && amount >= M.minAmount), items: items };
  }
  function orderTransition(id, next, patch) {
    var a = loadOrders(), i, it = null;
    for (i = 0; i < a.length; i++) if (a[i].id === id) { it = a[i]; break; }
    if (!it) return null;
    var allow = { pending: ['serving','cancelled'], serving: ['await_accept','cancelled'], await_accept: ['settled','cancelled'], settled: [], cancelled: [] };
    var can = (allow[it.status] || []).indexOf(next) >= 0;
    if (!can) return { error: '非法状态迁移: ' + it.status + ' → ' + next };
    it.status = next;
    if (patch) for (var k in patch) if (patch.hasOwnProperty(k)) it[k] = patch[k];
    /* 到达结算：按里程碑已达成比例计提佣金；未启用里程碑整单计提 */
    if (next === 'settled') {
      var c = orderCalc(it.amount);
      var donePct = 0, j;
      for (j = 0; j < it.milestones.length; j++) if (it.milestones[j].status === 'done') donePct += it.milestones[j].pct;
      it.fee = Math.round(c.fee * (donePct > 0 ? donePct : 1) * 100) / 100;
      it.rate = c.rate;
    }
    it.updatedAt = Date.now();
    saveOrders(a);
    window.dispatchEvent(new CustomEvent('engchain:orders', { detail: { id: id, status: it.status } }));
    return it;
  }
  function orderAdvanceMilestone(id, idx) {
    var a = loadOrders(), i, it = null;
    for (i = 0; i < a.length; i++) if (a[i].id === id) { it = a[i]; break; }
    if (!it) return null;
    if (it.status !== 'serving' && it.status !== 'await_accept') return { error: '当前状态不可推进里程碑' };
    if (!it.milestones[idx]) return { error: '里程碑节点不存在' };
    if (it.milestones[idx].status === 'done') return { error: '该节点已达成' };
    it.milestones[idx].status = 'done';
    it.milestones[idx].doneAt = Date.now();
    var allDone = it.milestones.every(function (m) { return m.status === 'done'; });
    if (allDone && it.status === 'serving') it.status = 'await_accept';
    it.updatedAt = Date.now();
    saveOrders(a);
    window.dispatchEvent(new CustomEvent('engchain:orders', { detail: { id: id, ms: idx } }));
    return it;
  }

  /* ---- 消息中心 Store（Phase 2 运营中心 · 消息中心） ----
     系统公告/消息发布 → 写回本层并广播 engchain:messages，App 消息入口可监听同步 */
  var MSG_KEY = 'engchain-messages';
  function seedMessages() {
    var t = function (d) { return new Date(Date.now() - d * 864e5).toISOString().slice(0, 10); };
    return [
      { id:'MSG1005', type:'公告', title:'破冰期扶持政策延续', body:'建筑企业 0 元入驻、中介 5 折优惠延续至本月底，注册即送 3 条免费解锁额度。', target:'全部用户', ts:t(1) },
      { id:'MSG1004', type:'系统', title:'对公转账入账优化', body:'对公转账审批通过后将自动入账至钱包余额，无需手动确认。', target:'入驻企业', ts:t(2) },
      { id:'MSG1003', type:'风控', title:'防跳单治理规则提醒', body:'平台将对线下跳单行为实施警告、禁聊、罚款直至清退处罚，请遵守撮合规则。', target:'全部用户', ts:t(4) },
      { id:'MSG1002', type:'活动', title:'共创者计划招募', body:'诚邀建筑企业与建筑人加入首批共创成员，享流量扶持与佣金阶段性减免。', target:'认证企业', ts:t(6) },
      { id:'MSG1001', type:'系统', title:'平台例行维护通知', body:'本周六 02:00-04:00 系统例行维护，期间部分功能暂不可用，敬请谅解。', target:'全部用户', ts:t(8) }
    ];
  }
  function loadMessages() {
    var a = [];
    try {
      if (LS.getItem(MSG_KEY) === null) { a = seedMessages(); saveMessages(a); }
      else { a = JSON.parse(LS.getItem(MSG_KEY) || '[]'); }
    } catch (e) { a = []; }
    if (!Array.isArray(a) || !a.length) a = seedMessages();
    /* 成熟期过滤破冰期专属公告 MSG1005（seed 保留，破冰期仍需显示） */
    if (window.ModeStore && !ModeStore.isBreakIn()) {
      a = a.filter(function (m) { return m.id !== 'MSG1005'; });
    }
    return a;
  }
  function saveMessages(a) { try { LS.setItem(MSG_KEY, JSON.stringify(a)); } catch (e) {} return a; }
  function publishMessage(m) {
    var a = loadMessages();
    a.unshift({ id: 'MSG' + String(Date.now()).slice(-5), type: m.type || '公告', title: m.title || '', body: m.body || '', target: m.target || '全部用户', ts: new Date().toISOString().slice(0, 10), admin: true });
    saveMessages(a);
    window.dispatchEvent(new CustomEvent('engchain:messages', { detail: a[0] }));
    return a[0];
  }


  /* ---- Phase 4 资金中心 API ----
     余额账 = BalanceStore（engchain-balance）、积分 = CreditStore（engchain-credits）、
     对公审批记录 = CorpPay（engchain-corp-pays，common.js 定义）——全部同源复用；
     本层新增：提现申请审批流（engchain-withdrawals：申请冻结→通过打款/驳回解冻）、
     发票（engchain-invoices）、佣金结算（settled 订单派生 + CommissionStore 结算单）、防跳单违规处罚。 */
  var WDL_KEY = 'engchain-withdrawals';
  var INV_KEY = 'engchain-invoices';

  function seedWithdrawals() {
    var now = Date.now();
    return [
      { id: 'WD20260904001', uid: 'u1', userName: '陈建国', amount: 500, method: 'bank', bank: '招商银行 · 尾号 1234', status: 'pending', appliedAt: now - 2 * 3600e3, note: '' },
      { id: 'WD20260904002', uid: 'u5', userName: '赵磊', amount: 300, method: 'alipay', bank: '支付宝 · 赵*磊', status: 'pending', appliedAt: now - 5 * 3600e3, note: '' },
      { id: 'WD20260903011', uid: 'u1', userName: '陈建国', amount: 400, method: 'bank', bank: '招商银行 · 尾号 1234', status: 'paid', appliedAt: now - 26 * 3600e3, paidAt: now - 25 * 3600e3, note: '' },
      { id: 'WD20260902018', uid: 'u6', userName: '刘洋', amount: 600, method: 'bank', bank: '工商银行 · 尾号 8899', status: 'rejected', appliedAt: now - 3 * 864e5, note: '到账信息不完整' }
    ];
  }
  function saveWithdrawals(a) { try { LS.setItem(WDL_KEY, JSON.stringify(a)); } catch (e) {} return a; }
  function loadWithdrawals() {
    var a = [];
    try { a = JSON.parse(LS.getItem(WDL_KEY) || '[]'); } catch (e) {}
    if (!Array.isArray(a) || !a.length) {
      a = seedWithdrawals();
      /* 先持久化申请列表（防 BalanceStore.write 广播回环：engchain:balance → 页面 render → 再 loadWithdrawals） */
      saveWithdrawals(a);
      /* 首次 seed：pending 申请冻结可用余额（幂等——仅本分支执行一次） */
      if (window.BalanceStore) {
        var fr = a.reduce(function (s, w) { return s + (w.status === 'pending' ? w.amount : 0); }, 0);
        if (fr > 0) { var bs = BalanceStore.read(); bs.frozen = Math.round((bs.frozen + fr) * 100) / 100; BalanceStore.write(bs); }
      }
    }
    return a;
  }
  /* 冻结合计（pending 提现占用） */
  function withdrawalFrozen() {
    return loadWithdrawals().reduce(function (s, w) { return s + ((w.status === 'pending' || w.status === 'first_ok') ? w.amount : 0); }, 0);
  }
  /* 提现申请：冻结可用余额，后台审批驱动后续（App 通道可调用） */
  /* 提现冻结/解冻/打款后，把 BalanceStore 权威余额回写用户表快照，
     避免重新登录（login 会用 u.balance 覆盖 BalanceStore）时丢失冻结态、可用余额虚高 */
  function syncBalanceToUser(uid) {
    try {
      var a = loadUsers(), i, changed = false;
      var s = BalanceStore.read();
      for (i = 0; i < a.length; i++) if (a[i].id === uid) {
        a[i].balance = Object.assign({}, a[i].balance, { balance: s.balance, frozen: s.frozen, totalIn: s.totalIn });
        changed = true; break;
      }
      if (changed) saveUsers(a);
    } catch (e) {}
  }
  /* [FIX BM-035] 修复：原"每日2次"仅展示文案，提交不校验次数。
     现增加 dailyMax 次数校验（localStorage 记录当日次数），校验在冻结资金之前执行。 */
  var WDL_DAILY_KEY = 'engchain-withdraw-daily-count';
  function wdlTodayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function wdlDailyCount() {
    var dailyMax = (MOCK.business.withdraw && MOCK.business.withdraw.dailyMax) || 2;
    var rec = { date: wdlTodayKey(), count: 0 };
    try {
      var raw = JSON.parse(LS.getItem(WDL_DAILY_KEY) || 'null');
      if (raw && raw.date === rec.date) rec.count = raw.count || 0;
    } catch (e) {}
    return { count: rec.count, dailyMax: dailyMax };
  }
  function wdlDailyIncr() {
    var rec = { date: wdlTodayKey(), count: 0 };
    try {
      var raw = JSON.parse(LS.getItem(WDL_DAILY_KEY) || 'null');
      if (raw && raw.date === rec.date) rec.count = raw.count || 0;
    } catch (e) {}
    rec.count += 1;
    try { LS.setItem(WDL_DAILY_KEY, JSON.stringify(rec)); } catch (e) {}
    return rec.count;
  }
  function withdrawalApply(uid, amount, method, extra) {
    var amt = Math.round(amount * 100) / 100;
    if (amt <= 0 || !window.BalanceStore) return null;
    /* [FIX BM-035] 先校验当日提现次数，再冻结资金 */
    var dc = wdlDailyCount();
    if (dc.count >= dc.dailyMax) return { error: '今日提现次数已达上限（每日' + dc.dailyMax + '次）' };
    if (BalanceStore.available() < amt) return { error: '可用余额不足' };
    var s = BalanceStore.read();
    s.frozen = Math.round((s.frozen + amt) * 100) / 100;
    BalanceStore.write(s);
    syncBalanceToUser(uid);
    wdlDailyIncr();
    var u = byId(uid);
    var w = { id: 'WD' + String(Date.now()).slice(-9), uid: uid, userName: u ? u.name : uid,
              amount: amt, method: method || 'bank', bank: (extra && extra.bank) || '银行 · 尾号 ****',
              status: 'pending', appliedAt: Date.now(), note: '' };
    var a = loadWithdrawals(); a.unshift(w); saveWithdrawals(a);
    audit('提现申请', '提现审批', w.userName, '¥' + amt + ' 已冻结（今日第 ' + (dc.count + 1) + ' 次）');
    return w;
  }
  /* ===== 提现两级审批（任务 2-3）：pending(待初审) → first_ok(初审通过·待终审) → paid(终审通过·打款) ===== */
  function withdrawalFirstApprove(id, note) {
    var a = loadWithdrawals(), w = null, i;
    for (i = 0; i < a.length; i++) if (a[i].id === id) { w = a[i]; break; }
    if (!w || w.status !== 'pending') return null;
    w.status = 'first_ok'; w.firstAt = Date.now(); w.firstNote = note || '运营初审通过';
    saveWithdrawals(a);
    syncBalanceToUser(w.uid);
    audit('提现初审通过', '提现审批', w.userName, '¥' + w.amount + ' → 待终审（资金保持冻结）');
    window.dispatchEvent(new CustomEvent('engchain:withdrawals', { detail: w }));
    return w;
  }
  function withdrawalFinalApprove(id, note) {
    var a = loadWithdrawals(), w = null, i;
    for (i = 0; i < a.length; i++) if (a[i].id === id) { w = a[i]; break; }
    if (!w || (w.status !== 'first_ok' && w.status !== 'pending')) return null;
    w.status = 'paid'; w.paidAt = Date.now(); w.finalNote = note || '';
    saveWithdrawals(a);
    var s = BalanceStore.read();
    s.frozen = Math.max(0, Math.round((s.frozen - w.amount) * 100) / 100);
    BalanceStore.write(s);
    var r = BalanceStore.withdraw(w.amount, w.method, { remark: '提现终审通过 · 已到账' });
    if (!r) return null;
    syncBalanceToUser(w.uid);
    audit('提现终审通过', '提现审批', w.userName, '¥' + w.amount + ' 已打款');
    window.dispatchEvent(new CustomEvent('engchain:withdrawals', { detail: w }));
    return w;
  }
  /* 审批通过（兼容单级直通）：解冻该笔 → BalanceStore.withdraw 扣减入账 */
  function withdrawalApprove(id) {
    var a = loadWithdrawals(), w = null, i;
    for (i = 0; i < a.length; i++) if (a[i].id === id) { w = a[i]; break; }
    if (!w || w.status !== 'pending') return null;
    w.status = 'paid'; w.paidAt = Date.now();
    saveWithdrawals(a);
    var s = BalanceStore.read();
    s.frozen = Math.max(0, Math.round((s.frozen - w.amount) * 100) / 100);
    BalanceStore.write(s);
    var r = BalanceStore.withdraw(w.amount, w.method, { remark: '提现审批通过 · 已到账' });
    if (!r) return null;
    syncBalanceToUser(w.uid);
    audit('提现通过', '提现审批', w.userName, '¥' + w.amount + ' 已打款');
    window.dispatchEvent(new CustomEvent('engchain:withdrawals', { detail: w }));
    return w;
  }
  /* 审批驳回：解冻该笔，余额不变（可用余额回升）；pending / first_ok 均可驳回 */
  function withdrawalReject(id, note) {
    var a = loadWithdrawals(), w = null, i;
    for (i = 0; i < a.length; i++) if (a[i].id === id) { w = a[i]; break; }
    if (!w || (w.status !== 'pending' && w.status !== 'first_ok')) return null;
    var prevSt = w.status;
    w.status = 'rejected'; w.note = note || '资料不完整'; w.rejectedAt = Date.now();
    w.rejectLevel = prevSt === 'first_ok' ? 'final' : 'first';
    saveWithdrawals(a);
    var s = BalanceStore.read();
    s.frozen = Math.max(0, Math.round((s.frozen - w.amount) * 100) / 100);
    BalanceStore.write(s);
    syncBalanceToUser(w.uid);
    audit('提现驳回', '提现审批', w.userName, '¥' + w.amount + ' 已解冻');
    window.dispatchEvent(new CustomEvent('engchain:withdrawals', { detail: w }));
    return w;
  }

  /* ---- 发票（engchain-invoices）：复用 App 发票页字段（抬头/税号/类型/金额/状态） ---- */
  function seedInvoices() {
    var now = Date.now();
    var t = function (d) { return new Date(now - d * 864e5).toISOString().slice(0, 10); };
    return [
      { id: 'INV20260904001', title: '四川省××建设有限公司', tax: '91510100MA6C9LKD1X', type: '增值税专用发票', amount: 8600, status: 'pending', applyAt: t(0), note: '' },
      { id: 'INV20260903012', title: '××工程咨询有限公司', tax: '91510100MA5A1B2C3D', type: '增值税专用发票', amount: 5000, status: 'issued', applyAt: t(1), note: '' },
      { id: 'INV20260902007', title: '四川××机械租赁有限公司', tax: '91510100MA6B2C3D4E', type: '增值税普通发票', amount: 1280, status: 'shipped', applyAt: t(2), note: '' },
      { id: 'INV20260901005', title: '成都××建材供应有限公司', tax: '91510100MA7C3D4E5F', type: '增值税普通发票', amount: 960, status: 'void', applyAt: t(3), note: '信息有误，已作废' }
    ];
  }
  function saveInvoices(a) {
    /* L3：优先通过 InvoiceStore 统一写入（{items:[]} 格式），保证新旧 API 同源 */
    if (window.InvoiceStore) {
      var s = InvoiceStore.read();
      s.items = Array.isArray(a) ? a : [];
      InvoiceStore.write(s);
      return a;
    }
    try { LS.setItem(INV_KEY, JSON.stringify(a)); } catch (e) {} return a;
  }
  function loadInvoices() {
    /* L3：优先从 InvoiceStore 读取，兼容旧数组格式 */
    if (window.InvoiceStore) {
      var list = InvoiceStore.list();
      if (list && list.length) return list;
    }
    var a = [];
    try {
      var raw = JSON.parse(LS.getItem(INV_KEY) || 'null');
      if (Array.isArray(raw)) a = raw;
      else if (raw && Array.isArray(raw.items)) a = raw.items;
    } catch (e) {}
    if (!Array.isArray(a) || !a.length) { a = seedInvoices(); saveInvoices(a); }
    return a;
  }
  var INV_ACT = { pending: '开票', issued: '已开票', shipped: '寄出', void: '作废' };
  function invoiceUpdate(id, status, note) {
    var a = loadInvoices(), it = null, i;
    for (i = 0; i < a.length; i++) if (a[i].id === id) { it = a[i]; break; }
    if (!it) return null;
    it.status = status;
    if (note) it.note = note;
    saveInvoices(a);
    audit('发票' + (INV_ACT[status] || status), '发票管理', it.title, '¥' + it.amount);
    return it;
  }
  /* ---- 发票全链路（L3）：通过 InvoiceStore 统一读写，与旧 engchain-invoices 数组兼容 ---- */
  function invoiceApply(payload) {
    if (!window.InvoiceStore) return { error: 'InvoiceStore 未加载' };
    var u = current();
    var item = InvoiceStore.apply(Object.assign({
      uid: u ? u.id : '', userName: u ? u.name : '',
      title: '', tax: '', type: '增值税普通发票', amount: 0, email: '', orderId: ''
    }, payload || {}));
    audit('申请开票', '发票管理', item.title, '¥' + item.amount + ' · 待审核');
    window.dispatchEvent(new CustomEvent('engchain:invoice', { detail: item }));
    return item;
  }
  function invoiceApprove(id) {
    if (!window.InvoiceStore) return null;
    InvoiceStore.approve(id);
    var list = InvoiceStore.list(), it = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { it = list[i]; break; }
    if (it) {
      audit('开票通过', '发票管理', it.title, '¥' + it.amount + ' · 已开票');
    }
    window.dispatchEvent(new CustomEvent('engchain:invoice', { detail: { id: id, status: 'issued' } }));
    return it;
  }
  function invoiceReject(id, note) {
    if (!window.InvoiceStore) return null;
    InvoiceStore.reject(id, note);
    var list = InvoiceStore.list(), it = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { it = list[i]; break; }
    if (it) {
      audit('开票驳回', '发票管理', it.title, '¥' + it.amount + ' · ' + (note || '资料不完整'));
    }
    window.dispatchEvent(new CustomEvent('engchain:invoice', { detail: { id: id, status: 'rejected' } }));
    return it;
  }
  function invoiceList() {
    /* 优先走 loadInvoices（含首次 seed 逻辑），保证空库时自动加载演示数据 */
    return loadInvoices();
  }

  /* ---- 佣金结算：settled 订单派生（规则同源 orderCalc）+ 结算单 CommissionStore + 防跳单违规 ---- */
  function seedCommissionFlows() {
    var now = Date.now();
    return [
      { orderId: 'EN20260831009', uid: 'u2', userName: '李雅', title: '中介撮合 · 安许代办承诺制', amount: 25000, rate: 0.05, fee: 1250, milestones: '整单', settledAt: now - 2 * 864e5, status: 'done' },
      { orderId: 'EN20260828007', uid: 'u2', userName: '李雅', title: '中介撮合 · 工商注册加急代办', amount: 8800, rate: 0.05, fee: 440, milestones: '整单', settledAt: now - 3 * 864e5, status: 'done' }
    ];
  }
  function commissionFlows() {
    if (!window.CommissionStore) return [];
    var s = CommissionStore.read();
    if (!s.flows || !s.flows.length) { s.flows = seedCommissionFlows(); CommissionStore.write(s); }
    return s.flows;
  }
  /* 待结算 = settled 且未在结算单中的订单 */
  function settledPending() {
    var out = [];
    var done = commissionFlows().map(function (f) { return f.orderId; });
    loadOrders().forEach(function (o) { if (o.status === 'settled' && done.indexOf(o.id) < 0) out.push(o); });
    return out;
  }
  function commissionSettle(orderId) {
    var o = null;
    loadOrders().forEach(function (x) { if (x.id === orderId) o = x; });
    if (!o || o.status !== 'settled' || !window.CommissionStore) return null;
    var c = orderCalc(o.amount);
    var u = byId(o.owner);
    var ms = o.milestones || [];
    var f = { orderId: o.id, uid: o.owner, userName: u ? u.name : o.owner, title: o.title, amount: o.amount,
              rate: c.rate, fee: c.fee,
              milestones: c.milestone ? (ms.filter(function (m) { return m.status === 'done'; }).length + '/' + ms.length) : '整单',
              settledAt: Date.now(), status: 'done' };
    CommissionStore.addFlow(f);
    audit('佣金结算', '佣金结算', o.title, '¥' + c.fee + ' @' + Math.round(c.rate * 100) + '%');
    window.dispatchEvent(new CustomEvent('engchain:commission', { detail: f }));
    return f;
  }
  /* 防跳单违规（Phase 4 seed + 处罚执行；Phase 6 合规审计复用同一 Store） */
  function seedViolations() {
    var now = Date.now();
    var t = function (d) { return new Date(now - d * 864e5).toISOString().slice(0, 10); };
    return [
      { id: 'VIO001', uid: 'u5', userName: '赵磊', company: '成都××机械租赁有限公司', level: 'warn', desc: '撮合后绕开平台线下交易（订单 EN20260903058 疑似跳单）', ts: t(2), status: 'open', note: '' },
      { id: 'VIO002', uid: 'u3', userName: '王强', company: '××工程咨询有限公司', level: 'serious', desc: '多次线下接单规避平台佣金', ts: t(5), status: 'open', note: '' }
    ];
  }
  function loadViolations() {
    if (!window.CommissionStore) return [];
    var s = CommissionStore.read();
    if (!s.violations || !s.violations.length) { s.violations = seedViolations(); CommissionStore.write(s); }
    return s.violations;
  }
  function violationPunish(id, action) {
    if (!window.CommissionStore) return null;
    /* 先确保 seed（loadViolations 首次调用写入预置违规） */
    var list = loadViolations();
    var v = null;
    list.forEach(function (x) { if (x.id === id) v = x; });
    if (!v || v.status === 'done') return null;
    v.status = 'done'; v.note = action || '已处理';
    v.punish = { action: action || '警告', at: Date.now(), operator: '平台管理员' };
    /* 必须基于同一数组写回（read() 重读会丢失内存改动） */
    var s = CommissionStore.read();
    s.violations = list;
    CommissionStore.write(s);
    audit('违规处罚 · ' + (action || '已处理'), '风控合规', v.userName + ' · ' + v.desc, '已完成处置');
    window.dispatchEvent(new CustomEvent('engchain:violations', { detail: v }));
    return v;
  }



  /* ---- Phase 6 风控合规中心 API ----
     资质核验（engchain-quals：已认证企业资质 + GEO 评分来源）；
     企业监控 feed 预置（engchain-monitor.feed：与 App 监控页同源，风险等级/异常预警）；
     违规处罚升级：5 档处置（警告→禁聊7天→二次禁聊30天→罚款5000→停号15天→二次清退），记录 punish 明细 + 审计。 */
  var QUAL_KEY = 'engchain-quals';

  function seedQualifications() {
    var now = Date.now();
    var t = function (d) { return new Date(now - d * 864e5).toISOString().slice(0, 10); };
    return [
      { id: 'QUA001', uid: 'u1', company: '四川省××建设有限公司', license: '91510100MA6×××12X', quals: ['建筑业企业资质 · 建筑工程施工总承包贰级'], geo: 92, source: 'AI 评估引擎 · 企业资质核验报告', status: 'verified', ts: t(28) },
      { id: 'QUA002', uid: 'u2', company: '四川××工程中介服务有限公司', license: '91510100MA6×××88Q', quals: ['房地产经纪机构备案', '工程造价咨询乙级'], geo: 88, source: 'AI 评估引擎 · 企业资质核验报告', status: 'verified', ts: t(24) },
      { id: 'QUA003', uid: 'u8', company: '四川××建设工程（集团）有限公司', license: '91510100MA6×××66K', quals: ['建筑业企业资质 · 市政公用工程施工总承包壹级'], geo: 95, source: 'AI 评估引擎 · 企业资质核验报告', status: 'verified', ts: t(15) }
    ];
  }
  function saveQualifications(a) { try { LS.setItem(QUAL_KEY, JSON.stringify(a)); } catch (e) {} return a; }
  function loadQualifications() {
    var a = [];
    try { a = JSON.parse(LS.getItem(QUAL_KEY) || '[]'); } catch (e) {}
    if (!Array.isArray(a) || !a.length) { a = seedQualifications(); saveQualifications(a); }
    return a;
  }

  /* 企业监控 feed 预置：仅当 feed 为空时写入（与 App 监控页 engchain-monitor 同源） */
  function loadMonitorFeed() {
    if (!window.MonitorStore) return [];
    var s = MonitorStore.read();
    if (!Array.isArray(s.feed) || !s.feed.length) {
      var now = Date.now();
      var t = function (d, h) { return new Date(now - d * 864e5).toISOString().slice(0, 10) + ' ' + (h || '09:00'); };
      s.feed = [
        { company: '成都××机械租赁有限公司', dim: '风险', kind: 'warn', text: '出现 1 笔疑似跳单预警，已进入风控复核', ts: t(0, '10:40'), read: false },
        { company: '四川××工程中介服务有限公司', dim: '经营', kind: 'info', text: '新增 2 条服务评价，评分 4.8 保持高位', ts: t(1, '16:20'), read: false },
        { company: '四川省××建设有限公司', dim: '资金', kind: 'ok', text: '对公入账 ¥1,500 已确认，资金流正常', ts: t(2, '09:15'), read: false },
        { company: '××工程咨询有限公司', dim: '风险', kind: 'warn', text: '多次线下接单规避平台佣金，风险等级提升', ts: t(3, '14:05'), read: false }
      ];
      MonitorStore.write(s);
    }
    return s.feed;
  }
  /* 监控统计：关注企业 / feed / 风险预警数 */
  function monitorStat() {
    var s = MonitorStore ? MonitorStore.read() : { follows: [], feed: [] };
    var st = { follows: (s.follows || []).length, feed: (s.feed || []).length, warn: 0, ok: 0 };
    (s.feed || []).forEach(function (f) { if (f.kind === 'warn') st.warn++; else if (f.kind === 'ok') st.ok++; });
    return st;
  }

  /* 5 档处罚动作（防跳单）：警告 → 禁聊 7 天 → 二次禁聊 30 天 → 罚款 ¥5,000 → 停号 15 天 → 二次清退 */
  var PUNISH_STEPS = [
    { id: 'warn', label: '警告' },
    { id: 'ban7', label: '禁聊 7 天' },
    { id: 'ban30', label: '二次禁聊 30 天' },
    { id: 'fine', label: '罚款 ¥5,000' },
    { id: 'freeze15', label: '停号 15 天' },
    { id: 'remove', label: '二次清退' }
  ];

  /* ---- Phase 5 分销中心 API ----
     档位派生复用 stores.js entryAccess（单一来源：建筑=基础一级 / 中介=受限一级6% / 合伙人=完整二级）；
     本层新增：分销团队（engchain-dist-team：一级/二级邀请关系、有效伙伴、等级）、
     返佣流水（engchain-dist-flows：充值/订单/入驻返佣，状态机 pending→settled→paid）。 */
  var DIST_TEAM_KEY = 'engchain-dist-team';
  var DIST_FLOW_KEY = 'engchain-dist-flows';

  function seedDistTeam() {
    var now = Date.now();
    var t = function (d) { return new Date(now - d * 864e5).toISOString().slice(0, 10); };
    return [
      { id: 'T1', uid: 'u2', name: '李明', company: '××建材有限公司', level: 1, active: true, joinedAt: t(42), orders: 6, credit: 12000, note: '' },
      { id: 'T2', uid: 'u5', name: '张涛', company: '××劳务有限公司', level: 1, active: true, joinedAt: t(30), orders: 4, credit: 8600, note: '' },
      { id: 'T3', uid: 'u3', name: '王芳', company: '××建设有限公司', level: 1, active: true, joinedAt: t(21), orders: 3, credit: 5200, note: '' },
      { id: 'T4', uid: 'u6', name: '刘洋', company: '××装饰工程有限公司', level: 1, active: false, joinedAt: t(15), orders: 1, credit: 1200, note: '30 天未活跃' },
      { id: 'T5', uid: 'u4', name: '张敏', company: '××工程咨询有限公司', level: 2, active: true, joinedAt: t(12), orders: 2, credit: 3400, note: '' },
      { id: 'T6', uid: 'u7', name: '赵磊', company: '××机械租赁有限公司', level: 2, active: true, joinedAt: t(8), orders: 1, credit: 1800, note: '' }
    ];
  }
  function saveDistTeam(a) { try { LS.setItem(DIST_TEAM_KEY, JSON.stringify(a)); } catch (e) {} return a; }
  function loadDistTeam() {
    var a = [];
    try { a = JSON.parse(LS.getItem(DIST_TEAM_KEY) || '[]'); } catch (e) {}
    if (!Array.isArray(a) || !a.length) { a = seedDistTeam(); saveDistTeam(a); }
    return a;
  }

  function seedDistFlows() {
    var now = Date.now();
    var t = function (d, h) { return new Date(now - d * 864e5).toISOString().slice(0, 10) + ' ' + (h || '10:00'); };
    return [
      { id: 'DF001', tier: 't1', source: 'recharge', member: '李明', uid: 'u2', amount: 2333, fee: 280, rate: 0.12, status: 'paid', ts: t(6, '10:23'), note: '一级分销 | 充值返佣' },
      { id: 'DF002', tier: 't2', source: 'order', member: '张涛', uid: 'u5', amount: 1533, fee: 46, rate: 0.03, status: 'settled', ts: t(6, '08:41'), note: '二级分销 | 订单返佣' },
      { id: 'DF003', tier: 't1', source: 'entry', member: '王芳', uid: 'u3', amount: 4167, fee: 500, rate: 0.12, status: 'pending', ts: t(7, '16:05'), note: '一级分销 | 入驻返佣' },
      { id: 'DF004', tier: 't1', source: 'recharge', member: '李明', uid: 'u2', amount: 1500, fee: 180, rate: 0.12, status: 'settled', ts: t(9, '14:30'), note: '一级分销 | 充值返佣' },
      { id: 'DF005', tier: 't2', source: 'order', member: '张敏', uid: 'u4', amount: 2200, fee: 66, rate: 0.03, status: 'pending', ts: t(11, '09:15'), note: '二级分销 | 订单返佣' }
    ];
  }
  function saveDistFlows(a) { try { LS.setItem(DIST_FLOW_KEY, JSON.stringify(a)); } catch (e) {} return a; }
  function loadDistFlows() {
    var a = [];
    try { a = JSON.parse(LS.getItem(DIST_FLOW_KEY) || '[]'); } catch (e) {}
    if (!Array.isArray(a) || !a.length) { a = seedDistFlows(); saveDistFlows(a); }
    return a;
  }
  /* 分销统计：团队规模 / 有效伙伴 / 一级·二级返佣合计 */
  function distStat() {
    var team = loadDistTeam();
    var flows = loadDistFlows();
    var st = { team: team.length, active: 0, t1Fee: 0, t2Fee: 0, pending: 0, settled: 0, paid: 0 };
    team.forEach(function (m) { if (m.active) st.active++; });
    flows.forEach(function (f) {
      if (f.tier === 't1') st.t1Fee += (f.fee || 0); else st.t2Fee += (f.fee || 0);
      if (f.status === 'pending') st.pending++; else if (f.status === 'settled') st.settled++; else if (f.status === 'paid') st.paid++;
    });
    st.t1Fee = Math.round(st.t1Fee * 100) / 100;
    st.t2Fee = Math.round(st.t2Fee * 100) / 100;
    return st;
  }
  /* 结算（pending→settled）：T+1 结算单 */
  function distSettle(id) {
    var a = loadDistFlows(), f = null, i;
    for (i = 0; i < a.length; i++) if (a[i].id === id) { f = a[i]; break; }
    if (!f || f.status !== 'pending') return null;
    f.status = 'settled'; f.settledAt = Date.now();
    saveDistFlows(a);
    audit('返佣结算', '分销中心', f.member + ' · ' + f.note, '¥' + f.fee);
    window.dispatchEvent(new CustomEvent('engchain:dist-flows', { detail: f }));
    return f;
  }
  /* 发放（settled→paid）：打款至收款方钱包（BalanceStore 入账 + 用户表同步 + engchain:balance 广播） */
  function distPay(id) {
    var a = loadDistFlows(), f = null, i;
    for (i = 0; i < a.length; i++) if (a[i].id === id) { f = a[i]; break; }
    if (!f || f.status !== 'settled') return null;
    f.status = 'paid'; f.paidAt = Date.now();
    saveDistFlows(a);
    /* 佣金入账：受益人余额 +fee（当前登录用户同步 BalanceStore，否则仅写用户表） */
    var amt = Math.round((f.fee || 0) * 100) / 100;
    if (amt > 0) {
      var users = loadUsers(), j, cur = current();
      for (j = 0; j < users.length; j++) if (users[j].id === f.uid) {
        users[j].balance = users[j].balance || { balance: 0, frozen: 0, totalIn: 0 };
        users[j].balance.balance = Math.round((users[j].balance.balance + amt) * 100) / 100;
        users[j].balance.totalIn = Math.round((users[j].balance.totalIn + amt) * 100) / 100;
        break;
      }
      saveUsers(users);
      if (cur && cur.id === f.uid && window.BalanceStore) {
        var b = BalanceStore.read();
        b.balance = Math.round((b.balance + amt) * 100) / 100;
        b.totalIn = Math.round((b.totalIn + amt) * 100) / 100;
        b.logs.unshift({ type: 'dist_pay', amount: amt, method: 'platform', reason: '返佣发放 · ' + (f.note || f.id), ts: Date.now() });
        BalanceStore.write(b);
      }
      window.dispatchEvent(new CustomEvent('engchain:balance', { detail: { uid: f.uid, amount: amt } }));
    }
    audit('返佣发放', '分销中心', f.member + ' · ' + f.note, '¥' + f.fee + ' 已入钱包');
    window.dispatchEvent(new CustomEvent('engchain:dist-flows', { detail: f }));
    return f;
  }

  /* ---- v3.1：简历投递门控（个人入驻两类用户区分 + 简历完成状态） ----
     返回 { can, reason, userType }；读取 AuthStore.personalEntry 判断 */
  function canDeliverResume() {
    var pe = (window.AuthStore && AuthStore.read) ? AuthStore.read().personalEntry : null;
    if (!pe || !pe.ok) {
      return { can: false, reason: '请先完成个人入驻', userType: '' };
    }
    var ut = pe.userType || 'jobseeker';
    if (ut === 'standard') {
      return { can: false, reason: '您当前为标准入驻用户，暂不支持简历投递。完成简历编辑后即可解锁投递权益', userType: 'standard' };
    }
    if (ut === 'jobseeker' && !pe.resumeComplete) {
      return { can: false, reason: '请先完成简历详情编辑', userType: 'jobseeker' };
    }
    return { can: true, reason: '', userType: 'jobseeker' };
  }

  return {
    USERS_KEY: USERS_KEY, HIST_KEY: HIST_KEY, AUDIT_KEY: AUDIT_KEY,
    users: loadUsers, byId: byId, current: current, history: history,
    login: login, logout: logout, resetAll: resetAll, audit: audit, syncUser: syncUser, stats: stats,
    seed: seedUsers,
    /* Phase 2 运营中心 */
    SUPPLY_KEY: SUPPLY_KEY, supply: loadSupply, supplyAudit: supplyAudit,
    /* L1 统一供需发布/审核 */
    publishSupply: publishSupply, supplyApprove: supplyApprove, supplyReject: supplyReject, supplyList: supplyList,
    ORDERS_KEY: ORDERS_KEY, orders: loadOrders, orderCalc: orderCalc,
    orderTransition: orderTransition, orderAdvanceMilestone: orderAdvanceMilestone,
    MSG_KEY: MSG_KEY, messages: loadMessages, publishMessage: publishMessage,
    /* Phase 3 用户与认证中心 */
    TYPE_LABEL: TYPE_LABEL,
    statusOf: statusOf, tagOf: tagOf, entryFeeOf: entryFeeOf,
    authApprove: authApprove, authReject: authReject,
    authApply: authApply, authRenew: authRenew,
    entryApply: entryApply,
    entryApprove: entryApprove, entryReject: entryReject,
    entryFirstApprove: entryFirstApprove, entryFinalApprove: entryFinalApprove,
    toggleBan: toggleBan, isBanned: isBanned, entryFees: loadEntryFees, ENTRYFEE_KEY: ENTRYFEE_KEY,
    /* Phase 4 资金中心 */
    WDL_KEY: WDL_KEY, INV_KEY: INV_KEY,
    withdrawals: loadWithdrawals, withdrawalFrozen: withdrawalFrozen,
    withdrawalApply: withdrawalApply, withdrawalApprove: withdrawalApprove, withdrawalReject: withdrawalReject,
    withdrawalFirstApprove: withdrawalFirstApprove, withdrawalFinalApprove: withdrawalFinalApprove,
    invoices: loadInvoices, invoiceUpdate: invoiceUpdate,
    invoiceApply: invoiceApply, invoiceApprove: invoiceApprove, invoiceReject: invoiceReject, invoiceList: invoiceList,
    commissionFlows: commissionFlows, settledPending: settledPending, commissionSettle: commissionSettle,
    violations: loadViolations, violationPunish: violationPunish,
    /* Phase 5 分销中心 */
    DIST_TEAM_KEY: DIST_TEAM_KEY, DIST_FLOW_KEY: DIST_FLOW_KEY,
    distTeam: loadDistTeam, distFlows: loadDistFlows, distStat: distStat,
    distSettle: distSettle, distPay: distPay,
    /* Phase 6 风控合规中心 */
    QUAL_KEY: QUAL_KEY, qualifications: loadQualifications,
    loadMonitorFeed: loadMonitorFeed, monitorStat: monitorStat,
    PUNISH_STEPS: PUNISH_STEPS,
    /* v3.1：简历投递门控 */
    canDeliverResume: canDeliverResume
  };
})();
