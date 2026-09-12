/* ============================================================
   工程链：个人入驻简历 → 人才详情(talent) 数据转换器
   将 AuthStore.personalEntry.profile + certs 转换为
   与 js/data.js 中 talents 数组结构 100% 对齐的 talent 记录，
   并可进一步包装为 SupplyStore 条目。
   纯函数模块，无副作用，不依赖 DOM。
   ============================================================ */
(function () {
  'use strict';

  /* ---- 工具函数 ---- */
  function esc(s) { return s == null ? '' : String(s); }
  function firstNonEmpty() {
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] != null && arguments[i] !== '') return arguments[i];
    }
    return '';
  }
  function maskName(name) {
    if (!name) return '匿名人才';
    var s = String(name);
    if (s.length <= 1) return s + '工';
    return s.charAt(0) + '工';
  }
  function maskCompany(co) {
    if (!co) return '某建筑企业';
    var s = String(co);
    /* 保留地域前缀 + 行业后缀，中间打码 */
    var m = /^(.{2,4}?)(省|市|自治区)?(.+?)(建设|建筑|工程|地产|开发|集团|有限公司|有限责任公司|公司)$/.exec(s);
    if (m) {
      var prefix = (m[1] || '') + (m[2] || '');
      var suffix = m[4] || '';
      return prefix + '××' + suffix;
    }
    return s.charAt(0) + '××' + (s.length > 3 ? s.slice(-2) : '');
  }
  function maskPhone(phone) {
    if (!phone) return '';
    var s = String(phone).replace(/\D/g, '');
    if (s.length < 7) return s;
    return s.slice(0, 3) + '****' + s.slice(-4);
  }
  function maskCertNo(no) {
    if (!no) return '****0000';
    var s = String(no);
    if (s.length <= 4) return '****' + s;
    return '****' + s.slice(-4);
  }
  function maskSchool(school) {
    if (!school) return '某高校';
    var s = String(school);
    if (s.length <= 4) return s.charAt(0) + '××大学';
    return s.slice(0, 2) + '××' + s.slice(-2);
  }
  function maskProject(pname) {
    if (!pname) return '某工程项目';
    var s = String(pname);
    /* 保留地域 + 类型后缀 */
    var m = /^(.{2,4})(.+?)(项目|工程|综合体|住宅|大厦|广场|园区|基地)$/.exec(s);
    if (m) return m[1] + '××' + m[3];
    return s.slice(0, 2) + '××项目';
  }

  /* ---- 证书名称解析：从 "一级建造师（建筑工程）" 提取等级/类型/专业 ---- */
  function parseCertName(name) {
    var s = String(name || '');
    var level = '', type = '', major = '';
    /* 等级 */
    var lm = /(一级|二级|三级|特级|初级|中级|高级|注册)/.exec(s);
    if (lm) level = lm[1];
    /* 专业：括号内或"专业"后 */
    var mm = /[（(]([^）)]+)[）)]/.exec(s);
    if (mm) major = mm[1].trim();
    else {
      var mm2 = /专业[:：]\s*(.+)/.exec(s);
      if (mm2) major = mm2[1].trim();
    }
    /* 类型：去掉等级和专业后的剩余 */
    type = s.replace(/[（(][^）)]+[）)]/g, '').replace(/(一级|二级|三级|特级|初级|中级|高级|注册)/g, '').trim();
    if (!type) type = s;
    return { level: level, type: type, major: major };
  }

  /* ---- 从 birth (YYYY-MM) 推算年龄区间 ---- */
  function birthToAgeRange(birth) {
    if (!birth) return '30-35岁';
    var m = /(\d{4})/.exec(String(birth));
    if (!m) return '30-35岁';
    var year = parseInt(m[1], 10);
    var now = new Date();
    var age = now.getFullYear() - year;
    if (age < 25) return '25岁以下';
    if (age < 30) return '25-30岁';
    if (age < 35) return '30-35岁';
    if (age < 40) return '35-40岁';
    if (age < 45) return '40-45岁';
    if (age < 50) return '45-50岁';
    return '50岁以上';
  }

  /* ---- 从 work[] 推算工作年限 ---- */
  function calcWorkYears(workList) {
    if (!workList || !workList.length) return 5;
    var earliest = null, latest = null;
    workList.forEach(function (w) {
      if (w.start) {
        var sm = /(\d{4})/.exec(String(w.start));
        if (sm) {
          var y = parseInt(sm[1], 10);
          if (!earliest || y < earliest) earliest = y;
        }
      }
      var endRef = w.end === '至今' || !w.end ? new Date().getFullYear() : (function () {
        var em = /(\d{4})/.exec(String(w.end));
        return em ? parseInt(em[1], 10) : null;
      })();
      if (endRef && (!latest || endRef > latest)) latest = endRef;
    });
    if (!earliest) return 5;
    var years = (latest || new Date().getFullYear()) - earliest;
    return Math.max(1, years);
  }

  /* ---- 从 salary 文本解析薪资范围 ---- */
  function parseSalary(salaryText) {
    var s = String(salaryText || '');
    if (!s) return { salaryRange: '面议', minAcceptable: '', certSubsidyExpect: '', arrivalTime: '1个月内到岗' };
    /* 提取数字范围 */
    var range = s;
    var m = /(\d+(?:\.\d+)?)\s*[-~至到]\s*(\d+(?:\.\d+)?)\s*(K|k|千|万|w|W)?/.exec(s);
    if (m) {
      var unit = m[3] || '';
      var unitLabel = /[万wW]/.test(unit) ? '万/年' : (/[Kk千]/.test(unit) ? 'K/月' : '');
      range = m[1] + '-' + m[2] + unitLabel;
    } else if (/面议|面议/.test(s)) {
      range = '面议';
    }
    return { salaryRange: range, minAcceptable: '', certSubsidyExpect: '', arrivalTime: '1个月内到岗' };
  }

  /* ---- certs → certPack 转换 ---- */
  function certsToCertPack(certs) {
    if (!certs || !certs.length) return [];
    return certs.map(function (c) {
      var parsed = parseCertName(c.name || c.certType || '');
      var level = c.level || parsed.level || '';
      var type = c.certType || parsed.type || c.name || '';
      var major = c.major || parsed.major || '';
      return {
        certType: type,
        certLevel: level,
        certMajor: major || '—',
        issueDate: c.issueDate || '2020-01',
        registerStatus: c.registerStatus || '已注册（可变更转出）',
        certNoSuffix: c.no ? maskCertNo(c.no) : '****0000',
        hasBCert: !!c.hasBCert
      };
    });
  }

  /* ---- work[] → workHistory[] 转换 ---- */
  function workToHistory(workList) {
    if (!workList || !workList.length) return [];
    return workList.map(function (w) {
      return {
        company: w.company || '',
        companyMasked: maskCompany(w.company),
        position: w.position || '',
        startDate: w.start || '',
        endDate: w.end || '至今',
        industry: w.industry || '房屋建筑',
        summary: w.summary || w.desc || '',
        detail: w.detail || w.desc || ''
      };
    });
  }

  /* ---- project[] → projectExperience[] 转换 ---- */
  function projectToExperience(projList) {
    if (!projList || !projList.length) return [];
    return projList.map(function (p) {
      /* time 字段可能是 "2017-2019" 或 "2017.03-2019.06" */
      var startD = p.startDate || '', endD = p.endDate || '';
      if (!startD && p.time) {
        var tm = /(\d{4}(?:[-.]\d{1,2})?)\s*[-~至]\s*(\d{4}(?:[-.]\d{1,2})?|至今)/.exec(String(p.time));
        if (tm) { startD = tm[1]; endD = tm[2]; }
      }
      return {
        projectName: p.name || '',
        projectNameMasked: maskProject(p.name),
        projectType: p.projectType || '房建工程',
        projectScale: p.projectScale || '—',
        role: p.role || '',
        startDate: startD,
        endDate: endD || '至今',
        description: p.description || p.desc || '',
        detail: p.detail || p.desc || ''
      };
    });
  }

  /* ---- education[] → education 对象转换（取最高学历） ---- */
  function educationToObj(eduList) {
    if (!eduList || !eduList.length) {
      return { level: '本科', school: '', major: '', graduateYear: '', schoolMasked: '' };
    }
    /* 按学历排序取最高 */
    var rank = { '博士': 5, '硕士': 4, '研究生': 4, '本科': 3, '大专': 2, '专科': 2, '高中': 1, '中专': 1 };
    var sorted = eduList.slice().sort(function (a, b) {
      return (rank[b.degree] || 0) - (rank[a.degree] || 0);
    });
    var top = sorted[0];
    var gradYear = '';
    if (top.end) {
      var gm = /(\d{4})/.exec(String(top.end));
      if (gm) gradYear = gm[1];
    }
    return {
      level: top.degree || '本科',
      school: top.school || '',
      major: top.major || '',
      graduateYear: gradYear,
      schoolMasked: maskSchool(top.school)
    };
  }

  /* ============================================================
     主转换函数：personalEntry + realname → talent 完整记录
     ============================================================ */
  function profileToTalent(pe, realname) {
    pe = pe || {};
    realname = realname || {};
    var profile = pe.profile || {};
    var basic = profile.basic || {};
    var jobIntent = profile.jobIntent || {};
    var certs = pe.certs || pe.list || [];
    var certPack = certsToCertPack(certs);

    /* 主证书（第一本）用于 Hero 区展示 */
    var mainCert = certPack[0] || {};
    var fullName = realname.name || basic.name || '张工';
    var salaryObj = jobIntent.salaryRange
      ? { salaryRange: jobIntent.salaryRange, minAcceptable: jobIntent.minAcceptable || '', certSubsidyExpect: jobIntent.certSubsidy || '', arrivalTime: jobIntent.arrivalTime || '1个月内到岗' }
      : parseSalary(jobIntent.salary);

    var workYears = calcWorkYears(profile.work);
    var ageRange = birthToAgeRange(basic.birth);

    /* 注册状态：优先用 profile.regStatus，其次从主证书 registerStatus 推导 */
    var regStatus = profile.regStatus || null;
    if (!regStatus && mainCert.registerStatus) {
      regStatus = {
        status: mainCert.registerStatus,
        registerUnit: '—',
        registerUnitMasked: '—',
        registerDate: mainCert.issueDate,
        expireDate: '2029-12',
        registerMajor: mainCert.certMajor || '—'
      };
    }

    /* 社保情况：优先用 profile.socialSecurity，其次默认值 */
    var socialSec = profile.socialSecurity || {
      status: '社保在缴',
      payUnit: '—',
      payUnitMasked: '—',
      canTransfer: true,
      uniqueSocial: true,
      lastPayMonth: '2026-08'
    };

    var talent = {
      /* 身份 */
      id: '', /* 由调用方填充 */
      name: fullName,
      nameMasked: maskName(fullName),
      avatar: '',
      title: (mainCert.certLevel || '') + (mainCert.certType || '技术人才'),
      certType: mainCert.certType || '',
      certLevel: mainCert.certLevel || '',
      ageRange: ageRange,
      gender: basic.gender || '男',
      workYears: workYears,
      experience: workYears + '年',
      location: basic.location || '四川省成都市',
      city: basic.location || '成都',
      /* 证书 */
      certPack: certPack,
      certVerified: !!pe.ok,
      verified: !!pe.ok,
      /* 注册 & 社保 */
      registerStatus: regStatus,
      socialSecurity: socialSec,
      /* 求职 */
      currentStatus: basic.jobStatus || '在职-考虑机会',
      expectedPosition: jobIntent.position || mainCert.certType || '项目经理',
      expectedSalary: salaryObj,
      arrivalTime: salaryObj.arrivalTime,
      workArea: jobIntent.location || basic.location || '成都',
      languageSkill: '普通话熟练',
      resumeActive: true,
      selfEvaluation: profile.intro || '多年建筑行业从业经验，具备丰富的现场技术管理和团队协调经验。',
      desc: profile.intro || '',
      /* 经历 */
      workHistory: workToHistory(profile.work),
      projectExperience: projectToExperience(profile.project),
      education: educationToObj(profile.education),
      skills: profile.skills || [],
      /* 联系 */
      contact: {
        name: fullName,
        phone: basic.mobile || '',
        phoneMasked: maskPhone(basic.mobile),
        wechat: basic.wechat || '',
        wechatMasked: basic.wechat ? maskPhone(basic.wechat) : ''
      },
      address: basic.address || basic.location || '',
      addressDetail: '',
      /* 价格
         [FIX BM-041] 清除硬编码旧"线索包"定价 29/59/79/229，统一改读 MOCK.business：
         单价 = credits.consume.talent；原价 = credits.consume.franchise.t3.original 同源演示价；
         条数包 packOptions 由 commission.vendorUpgrades.leadPack.enabled 控制（首期 false → 空数组不展示）。 */
      unlockPrice: {
        singlePrice: (window.MOCK && MOCK.business && MOCK.business.credits && MOCK.business.credits.consume && MOCK.business.credits.consume.talent) || 29,
        originalPrice: (window.MOCK && MOCK.business && MOCK.business.credits && MOCK.business.credits.consume && MOCK.business.credits.consume.franchise && MOCK.business.credits.consume.franchise.t3 && MOCK.business.credits.consume.franchise.t3.original) || 58,
        packOptions: (window.MOCK && MOCK.business && MOCK.business.commission && MOCK.business.commission.vendorUpgrades && MOCK.business.commission.vendorUpgrades.leadPack && MOCK.business.commission.vendorUpgrades.leadPack.enabled)
          ? (MOCK.business.commission.vendorUpgrades.leadPack.packs || [])
          : [],
        unlockContent: ['真实姓名与联系方式', '完整工作履历与项目详情', '证书编号与注册状态', '社保缴纳情况', '期望薪资与到岗时间', '详细自我介绍', '在线沟通对接']
      },
      /* 列表卡片用 */
      bizKey: 'talent',
      dir: 'supply',
      cat: '求职',
      sub: mainCert.certType || '人才',
      price: salaryObj.salaryRange,
      budget: salaryObj.salaryRange,
      tags: [mainCert.certLevel + mainCert.certType, basic.jobStatus || ''].filter(Boolean),
      match: 0,
      hot: false,
      source: 'user_publish',
      _badge: '用户发布'
    };

    return talent;
  }

  /* ============================================================
     talent 记录 → SupplyStore 条目
     确保 detail.html 走 talent 专业渲染器（需含 talentDetail）
     ============================================================ */
  function talentToSupplyItem(talent, uid, account) {
    var item = Object.assign({}, talent, {
      id: talent.id || ('talent-u' + (account || uid || Date.now())),
      uid: uid || '',
      account: account || '',
      bizKey: 'talent',
      type: 'supply',
      dir: 'supply',
      title: talent.nameMasked + ' · ' + talent.title,
      name: talent.name,
      nameMasked: talent.nameMasked,
      cat: '求职',
      sub: talent.certType || '人才',
      category: '求职',
      subType: talent.certType || '',
      city: talent.city || talent.location || '',
      location: talent.location || '',
      price: talent.expectedSalary ? talent.expectedSalary.salaryRange : '',
      budget: talent.expectedSalary ? talent.expectedSalary.salaryRange : '',
      unit: '期望年薪',
      tags: talent.tags || [],
      company: talent.nameMasked,
      desc: talent.selfEvaluation || '',
      description: talent.selfEvaluation || '',
      verified: !!talent.verified,
      status: talent.status || 'active',
      source: 'user_publish',
      ts: Date.now(),
      time: Date.now(),
      views: 0,
      /* 嵌套 talentDetail，确保 detail.html _hasRich=true 走专业渲染器 */
      talentDetail: {
        intent: [],
        certPack: talent.certPack,
        expectedSalary: talent.expectedSalary,
        regStatus: talent.registerStatus,
        socialSecurity: talent.socialSecurity,
        workHistory: talent.workHistory,
        projectExp: talent.projectExperience,
        education: talent.education
      }
    });
    return item;
  }

  /* ============================================================
     生成人才条目 ID
     ============================================================ */
  function talentIdFor(account) {
    return 'talent-u' + (account || 'guest');
  }

  /* ============================================================
     对比两份 certs 是否发生变更（决定是否需要重新审核）
     ============================================================ */
  function certsChanged(oldCerts, newCerts) {
    oldCerts = oldCerts || [];
    newCerts = newCerts || [];
    if (oldCerts.length !== newCerts.length) return true;
    var oldKey = oldCerts.map(function (c) {
      return [c.name, c.no, c.level, c.major, c.issueDate, c.registerStatus, c.hasBCert ? 1 : 0].join('|');
    }).sort().join(';;');
    var newKey = newCerts.map(function (c) {
      return [c.name, c.no, c.level, c.major, c.issueDate, c.registerStatus, c.hasBCert ? 1 : 0].join('|');
    }).sort().join(';;');
    return oldKey !== newKey;
  }

  /* ---- 导出 ---- */
  window.TalentAdapter = {
    profileToTalent: profileToTalent,
    talentToSupplyItem: talentToSupplyItem,
    talentIdFor: talentIdFor,
    certsChanged: certsChanged,
    parseCertName: parseCertName,
    maskName: maskName,
    maskCompany: maskCompany,
    maskPhone: maskPhone,
    maskCertNo: maskCertNo,
    maskSchool: maskSchool,
    maskProject: maskProject,
    calcWorkYears: calcWorkYears,
    birthToAgeRange: birthToAgeRange,
    parseSalary: parseSalary
  };
})();
