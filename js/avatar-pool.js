/* ============================================================================
   工程链 ENGCHAIN — 奢华动物头像池（luxury-animal-avatar）
   20 个写实摄影风动物头像：牛 / 马 / 猫 / 狗 × 人类角色身份造型。
   存储约定：localStorage['engchain-user-profile'].avatar 存图片相对路径；
   旧版数字索引（渐变预设）自动回退为首字母文字头像，不报错。
   ============================================================================ */
(function () {
  // 页面位于 pages/profile/ 下，资产前缀为 ../../
  var BASE = '../../assets/me/avatars/';

  var LIST = [
    { file: 'ox-01.jpg',    label: '黄牛 · 酋长',   species: '牛' },
    { file: 'ox-02.jpg',   label: '花牛 · 绅士',   species: '牛' },
    { file: 'ox-03.jpg',    label: '水牛 · 牛仔',   species: '牛' },
    { file: 'ox-04.jpg',     label: '牦牛 · 军官',   species: '牛' },
    { file: 'ox-05.jpg',     label: '黄牛 · 潮客',   species: '牛' },
    { file: 'horse-01.jpg',  label: '栗马 · 酋长',   species: '马' },
    { file: 'horse-02.jpg',  label: '黑马 · 绅士',   species: '马' },
    { file: 'horse-03.jpg',   label: '棕马 · 牛仔',   species: '马' },
    { file: 'horse-04.jpg',  label: '白马 · 贵族',   species: '马' },
    { file: 'horse-05.jpg',  label: '栗马 · 飞行员', species: '马' },
    { file: 'cat-01.jpg',    label: '橘猫 · 潮客',   species: '猫' },
    { file: 'cat-02.jpg',    label: '三花 · 酋长',   species: '猫' },
    { file: 'cat-03.jpg',    label: '白猫 · 名媛',   species: '猫' },
    { file: 'cat-04.jpg',    label: '英短 · 大亨',   species: '猫' },
    { file: 'cat-05.jpg',    label: '布偶 · 赛车手', species: '猫' },
    { file: 'dog-01.jpg',    label: '柴犬 · 牛仔',   species: '狗' },
    { file: 'dog-02.jpg',    label: '金毛 · 绅士',   species: '狗' },
    { file: 'dog-03.jpg',    label: '法斗 · 大亨',   species: '狗' },
    { file: 'dog-04.jpg',    label: '德牧 · 军官',   species: '狗' },
    { file: 'dog-05.jpg',    label: '贵宾 · 贵族',   species: '狗' }
  ];

  var KEY = 'engchain-user-profile';
  var DEFAULT_FILE = 'default-dragon.jpg'; /* 注册初始默认头像：朴素龙 */

  function readProfile() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function writeProfile(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }

  /** 当前选中头像：返回图片路径；无图（旧数字索引/未选）返回 null */
  function currentAvatar() {
    var a = readProfile().avatar;
    if (typeof a === 'string' && a.indexOf('.jpg') > -1) return a;
    return null;
  }

  /** 取第 i 个头像的完整路径 */
  function url(i) {
    return BASE + LIST[i].file;
  }

  /** 按路径反查索引，未命中返回 -1 */
  function indexOf(path) {
    for (var i = 0; i < LIST.length; i++) {
      if (BASE + LIST[i].file === path) return i;
    }
    return -1;
  }

  /** 持久化选中头像（合并已有资料，不覆盖昵称/性别等字段） */
  function saveAvatar(path) {
    var data = readProfile();
    data.avatar = path;
    data.updatedAt = Date.now();
    writeProfile(data);
  }

  /** 默认（注册初始）头像路径 */
  function defaultAvatar() {
    return BASE + DEFAULT_FILE;
  }

  /** 是否为默认龙头像路径 */
  function isDefault(path) {
    return path === defaultAvatar();
  }

  /** 当前头像；无有效图片（未设置/旧数字索引）时回退默认龙 */
  function currentOrDefault() {
    return currentAvatar() || defaultAvatar();
  }

  /** 注册/初始化时写入默认龙头像：仅当尚无有效图片头像时落盘，不覆盖用户已选 */
  function initDefault() {
    var cur = readProfile();
    var hasImg = typeof cur.avatar === 'string' && cur.avatar.indexOf('.jpg') > -1;
    if (!hasImg) {
      writeProfile(Object.assign({}, cur, { avatar: defaultAvatar(), updatedAt: Date.now() }));
    }
  }

  window.AvatarPool = {
    list: LIST,
    base: BASE,
    url: url,
    indexOf: indexOf,
    readProfile: readProfile,
    saveAvatar: saveAvatar,
    currentAvatar: currentAvatar,
    currentOrDefault: currentOrDefault,
    defaultAvatar: defaultAvatar,
    isDefault: isDefault,
    initDefault: initDefault
  };
})();
