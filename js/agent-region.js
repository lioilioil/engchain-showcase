/* ============================================================================
   js/agent-region.js —— M4-1 本省免解锁 / M4-2 本省无限关注（纯函数 + 当前身份读取）
   ----------------------------------------------------------------------------
   规则（D13/§3.5）：
   - 默认拒绝；仅授权省「同省」放行；省名归一；trade（建企买卖保证金）不免；
   - 不写 engchain-unlocked（免解锁不落 mark）；终止态（terminated/revoked/removed）不放行；
   - 总代/二级 active 本省无限关注；外省受限；无省不误放开；终止态不可关注；
   - 建筑30/服务商50 旧额度不变（本模块只给「active 代理」返回无限，不改其它档位）。
   浏览器 → window.AgentRegion；node → module.exports（纯函数可注入 bits）。
   ============================================================================ */
(function (root) {
  'use strict';

  var TERMINAL = ['terminated', 'revoked', 'removed'];

  function norm(s) {
    return String(s == null ? '' : s).trim().replace(/省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区/g, '').replace(/\s/g, '');
  }

  /* 终止态判定（含二级 removed/terminated、总代 terminated/revoked/suspended 收回） */
  function isTerminal(status) {
    return TERMINAL.indexOf(status) >= 0 || status === 'suspended';
  }

  /* 当前代理身份位（浏览器读 AgentStore/DataBus；测试可直接传 bits） */
  function currentBits() {
    var bits = { active: false, province: '', status: '', kind: '' };
    try {
      var U = (root.DataBus && root.DataBus.current) ? (root.DataBus.current() || {}).id || '' : '';
      if (!U) return bits;
      if (root.AgentStore && typeof root.AgentStore.bitsFor === 'function') {
        var b = root.AgentStore.bitsFor(U) || {};
        bits = { active: !!(b.isProvinceAgent || b.isSubAgent), province: b.agentProvince || '', status: b.status || '', kind: b.isProvinceAgent ? 'province' : (b.isSubAgent ? 'sub' : '') };
      }
    } catch (e) {}
    return bits;
  }

  /* 省名还原表：供需记录普遍只带 location（如「成都市·新津区」）而不带 province，
     直接比对 location 会得到「成都新津区」≠「四川」，导致本省规则永不命中。 */
  var PROVINCES = ['内蒙古', '黑龙江', '北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '广西', '海南', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆', '香港', '澳门', '台湾'];
  var CITY_PROV = {
    '成都': '四川', '泸州': '四川', '南充': '四川', '绵阳': '四川', '德阳': '四川', '宜宾': '四川', '达州': '四川', '乐山': '四川', '眉山': '四川', '自贡': '四川', '内江': '四川', '遂宁': '四川', '广安': '四川', '巴中': '四川', '雅安': '四川', '资阳': '四川', '广元': '四川', '攀枝花': '四川', '凉山': '四川', '甘孜': '四川', '阿坝': '四川',
    '贵阳': '贵州', '遵义': '贵州', '六盘水': '贵州', '安顺': '贵州', '毕节': '贵州', '铜仁': '贵州',
    '昆明': '云南', '曲靖': '云南', '玉溪': '云南', '大理': '云南',
    '西安': '陕西', '咸阳': '陕西', '宝鸡': '陕西', '渭南': '陕西', '延安': '陕西', '榆林': '陕西',
    '长沙': '湖南', '株洲': '湖南', '湘潭': '湖南', '衡阳': '湖南', '岳阳': '湖南',
    '武汉': '湖北', '宜昌': '湖北', '襄阳': '湖北', '黄石': '湖北', '荆州': '湖北',
    '杭州': '浙江', '宁波': '浙江', '温州': '浙江', '嘉兴': '浙江', '绍兴': '浙江', '金华': '浙江',
    '南京': '江苏', '苏州': '江苏', '无锡': '江苏', '常州': '江苏', '南通': '江苏', '徐州': '江苏',
    '合肥': '安徽', '芜湖': '安徽', '蚌埠': '安徽', '安庆': '安徽',
    '南昌': '江西', '赣州': '江西', '九江': '江西', '上饶': '江西',
    '郑州': '河南', '洛阳': '河南', '开封': '河南', '南阳': '河南',
    '深圳': '广东', '广州': '广东', '东莞': '广东', '佛山': '广东', '珠海': '广东', '中山': '广东', '惠州': '广东',
    '南宁': '广西', '桂林': '广西', '柳州': '广西',
    '银川': '宁夏', '兰州': '甘肃', '西宁': '青海', '乌鲁木齐': '新疆', '拉萨': '西藏',
    '呼和浩特': '内蒙古', '哈尔滨': '黑龙江', '长春': '吉林', '沈阳': '辽宁', '大连': '辽宁',
    '石家庄': '河北', '太原': '山西', '济南': '山东', '青岛': '山东', '烟台': '山东',
    '福州': '福建', '厦门': '福建', '海口': '海南',
    '香港': '香港', '澳门': '澳门',
    '台北': '台湾', '新北': '台湾', '桃园': '台湾', '台中': '台湾', '台南': '台湾', '高雄': '台湾',
    '基隆': '台湾', '新竹': '台湾', '嘉义': '台湾', '苗栗': '台湾', '彰化': '台湾', '南投': '台湾',
    '云林': '台湾', '屏东': '台湾', '宜兰': '台湾', '花莲': '台湾', '台东': '台湾', '澎湖': '台湾'
  };

  /* 单串 → 省：先认省名前缀（含「四川成都」「四川省·成都市」），再认城市名 */
  function provinceOfText(s) {
    var t = String(s == null ? '' : s).trim();
    if (!t) return '';
    var i;
    for (i = 0; i < PROVINCES.length; i++) {
      if (t.indexOf(PROVINCES[i]) === 0) return PROVINCES[i];
    }
    var seg = t.split(/[·•\/、\s]/)[0].replace(/市$/, '');
    if (CITY_PROV[seg]) return CITY_PROV[seg];
    for (var c in CITY_PROV) {
      if (CITY_PROV.hasOwnProperty(c) && t.indexOf(c) === 0) return CITY_PROV[c];
    }
    return '';
  }

  /* 记录 → 省：显式 province → location → city → region */
  function provinceOf(rec) {
    if (!rec || typeof rec !== 'object') return '';
    return provinceOfText(rec.province) || provinceOfText(rec.location) ||
      provinceOfText(rec.city) || provinceOfText(rec.region);
  }

  /* M4-1 本省免解锁：rec 需可还原出省份；bizKey==='trade' 一律不免 */
  function isProvinceFreeUnlock(rec, bits) {
    bits = bits || currentBits();
    if (!bits || !bits.active) return false;
    if (isTerminal(bits.status)) return false;           /* 终止/暂停收回，不放行 */
    if (!bits.province) return false;                    /* 无省不误放开 */
    if (!rec) return false;
    if (rec.bizKey === 'trade') return false;            /* 保证金类排除 */
    var recProv = provinceOf(rec);
    if (!recProv) return false;                          /* 记录无省：不误放开 */
    return norm(recProv) === norm(bits.province);
  }

  /* M4-2 本省无限关注：active 代理同省 → true（无限）；其余返回 null 表示走旧额度 */
  function unlimitedFollow(companyProvince, bits) {
    bits = bits || currentBits();
    if (!bits || !bits.active) return null;
    if (isTerminal(bits.status)) return false;           /* 终止态不可关注 */
    if (!bits.province) return null;
    if (companyProvince == null) return null;            /* 无省信息不误放开 */
    var cp = provinceOfText(companyProvince) || companyProvince;
    return norm(cp) === norm(bits.province);
  }

  var api = {
    norm: norm, isTerminal: isTerminal,
    currentBits: currentBits,
    provinceOf: provinceOf, provinceOfText: provinceOfText,
    isProvinceFreeUnlock: isProvinceFreeUnlock,
    unlimitedFollow: unlimitedFollow
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AgentRegion = api;
})(typeof window !== 'undefined' ? window : globalThis);
