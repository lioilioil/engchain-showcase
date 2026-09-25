
/* ══════════════════════════════════════════════════════════════
   数据：五个身份（与线上 auth.html 同一套口径）
   ══════════════════════════════════════════════════════════════ */
const ICONS={
  check:'<svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>',
  clock:'<svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/></svg>',
  warn:'<svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z"/></svg>',
  lock:'<svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96Z"/></svg>',
  arrow:'<svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"/></svg>',
  share:'<svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M176,160a39.89,39.89,0,0,0-28.62,12.09l-46.1-29.63a39.8,39.8,0,0,0,0-28.92l46.1-29.63a40,40,0,1,0-8.66-13.45l-46.1,29.63a40,40,0,1,0,0,55.82l46.1,29.63A40,40,0,1,0,176,160Zm0-128a24,24,0,1,1-24,24A24,24,0,0,1,176,32ZM64,152a24,24,0,1,1,24-24A24,24,0,0,1,64,152Zm112,72a24,24,0,1,1,24-24A24,24,0,0,1,176,224Z"/></svg>',
  chevR:'<svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M90.34,61.66a8,8,0,0,1,11.32,0l80,80a8,8,0,0,1,0,11.32l-80,80a8,8,0,0,1-11.32-11.32L164.69,148,40,148a8,8,0,0,1,0-16H164.69L90.34,73a8,8,0,0,1,0-11.32Z"/></svg>'
};

const IDENTITIES=[
  {key:'realname',name:'个人认证',tag:'基石',line:'F',img:'assets/identity-realname.jpg',
   desc:'实名认证 · 人脸核验 · 免费',
   benefit:'解锁其他全部身份的基础',
   benefits:['昵称获得官方实名标识，沟通更可信','解锁人才入驻、合伙人、企业认证全部入口','人脸核验约 1 分钟，全程免费'],
   fee:'免费',time:'约 1 分钟'},
  {key:'personal-entry',name:'个人入驻',tag:'人才',line:'P',img:'assets/identity-personal-entry.jpg',
   desc:'专业资质 · 完整简历 · 免费',
   benefit:'解锁人才展示与岗位匹配',
   benefits:['获得专业人才档案与展示主页','岗位与项目优先按资质匹配推荐','资质背书提升接单成功率'],
   fee:'免费',time:'1–3 个工作日'},
  {key:'partner',name:'个人合伙人',tag:'分销',line:'P',img:'assets/identity-partner.jpg',
   desc:'分销意向 · 推广渠道 · 免费',
   benefit:'解锁二级分销与推广权益',
   benefits:['生成专属推广链接，邀请即享分佣','解锁二级分销网络与收益看板','参与平台合伙人专属激励活动'],
   fee:'免费',time:'1–2 个工作日'},
  {key:'enterprise',name:'企业工商认证',tag:'企业',line:'E',img:'assets/identity-enterprise.jpg',
   desc:'工商信息核验 · ¥999 / 年',
   benefit:'解锁企业经营与发布权限',
   benefits:['企业名称旁展示官方核验标识','提升供需发布与合作洽谈信任度','企业资质信息全站同步可见'],
   fee:'¥999 / 年',time:'1–3 个工作日'},
  {key:'entry',name:'企业入驻',tag:'经营',line:'E',img:'assets/identity-entry.jpg',
   desc:'入驻缴费 · 审核通过后开通',
   benefit:'解锁发布供需与平台经营权益',
   benefits:['开通企业店铺与供需发布权限','获得平台经营位与流量扶持','线上接单、结算一体化经营'],
   fee:'入驻费',time:'1–3 个工作日'}
];
const byKey=k=>IDENTITIES.find(d=>d.key===k);

/* 五个演示场景（线上页由 AuthStore / EntryStore 实时推导，原型内置同口径数据） */
const SCENARIOS={
  guest:{label:'未认证访客',sub:'尚未完成实名，一切身份待解锁',icon:'user',
    states:{realname:'todo','personal-entry':'locked',partner:'locked',enterprise:'locked',entry:'locked'}},
  choose:{label:'已实名 · 选方向',sub:'实名已完成，个人/企业两条线待选',icon:'arrow',
    states:{realname:'done','personal-entry':'todo',partner:'todo',enterprise:'todo',entry:'todo'}},
  review:{label:'审核进行中',sub:'企业工商认证资料正在核验',icon:'clock',
    states:{realname:'done','personal-entry':'done',partner:'todo',enterprise:'review',entry:'todo'}},
  reject:{label:'申请被驳回',sub:'企业工商认证需补充资料后重提',icon:'warn',
    states:{realname:'done','personal-entry':'todo',partner:'todo',enterprise:'reject',entry:'todo'}},
  done:{label:'全部已点亮',sub:'五项身份全部通过，权益全开',icon:'check',
    states:{realname:'done','personal-entry':'done',partner:'done',enterprise:'done',entry:'done'}}
};
let scenario='guest';

const STATE_UI={
  todo:{pill:'去开通',sealText:'',mini:'todo'},
  review:{pill:'审核中'},
  done:{pill:'已通过'},
  reject:{pill:'已驳回'},
  locked:{pill:'未解锁'}
};

/* ── toast ── */
const toastEl=document.getElementById('toast');let toastT;
function toast(msg){
  toastEl.textContent=msg;toastEl.classList.add('on');
  clearTimeout(toastT);toastT=setTimeout(()=>toastEl.classList.remove('on'),1700);
}

/* ── HERO 渲染 ── */
function renderHero(){
  const st=SCENARIOS[scenario].states;
  const box=document.getElementById('heroDynamic');
  const img=document.getElementById('heroImg');
  let html='';
  if(scenario==='guest'){
    img.src='assets/hero-medal.jpg';
    html='<span class="hero-badge b-gold">第一步 · 实名认证</span>'+
      '<h1 class="hero-title">点亮你的<br>工程信任通行证</h1>'+
      '<p class="hero-desc">完成实名与人脸核验，约 1 分钟、全程免费。<br>这是开通其余四项身份、解锁全部平台权益的基石。</p>'+
      '<div class="hero-facts">'+
        '<span class="hf">'+ICONS.check+'约 1 分钟</span>'+
        '<span class="hf">'+ICONS.check+'全程免费</span>'+
        '<span class="hf">'+ICONS.check+'加密核验</span>'+
      '</div>';
  }else if(scenario==='choose'){
    img.src='assets/hero-medal.jpg';
    html='<span class="hero-badge b-ghost">下一步 · 二选一或都要</span>'+
      '<h1 class="hero-title">选择你的<br>发展方向</h1>'+
      '<p class="hero-desc">实名认证已完成。沿「个人发展线」接单赚钱，或沿「企业经营线」入驻做生意——两条线可同时点亮。</p>';
  }else if(scenario==='review'){
    img.src='assets/identity-enterprise.jpg';
    html='<span class="hero-badge b-steel"><i class="pulse-dot"></i>审核中</span>'+
      '<h1 class="hero-title">「企业工商认证」<br>正在核验</h1>'+
      '<p class="hero-desc">资料已提交，平台通常在 1–3 个工作日内完成工商核验，结果实时同步。</p>'+
      '<div class="steps">'+
        '<div class="step done"><div class="sd">'+ICONS.check+'</div>提交资料</div>'+
        '<div class="step active"><div class="sd"><i class="pulse-dot"></i></div>平台核验</div>'+
        '<div class="step"><div class="sd">3</div>认证完成</div>'+
      '</div>';
  }else if(scenario==='reject'){
    img.src='assets/identity-enterprise.jpg';
    html='<span class="hero-badge b-coral">'+ICONS.warn+'待处理</span>'+
      '<h1 class="hero-title">「企业工商认证」<br>暂未通过</h1>'+
      '<div class="hero-reason">'+ICONS.warn+
        '<span><b>驳回原因：</b>营业执照照片模糊、关键信息不完整。请上传清晰原件照片后重新提交，历史资料已保留。</span></div>';
  }else{
    img.src='assets/hero-medal.jpg';
    html='<span class="hero-badge b-done">'+ICONS.check+'全部完成</span>'+
      '<h1 class="hero-title">五项身份<br>全部已点亮</h1>'+
      '<p class="hero-desc">你已获得平台完整信任标识，人才匹配、分销推广与企业经营权益全部开通。</p>';
  }
  box.innerHTML=html;

  /* 完成度 */
  const doneN=IDENTITIES.filter(d=>st[d.key]==='done').length;
  const bars=document.getElementById('progBars');
  bars.innerHTML=IDENTITIES.map(d=>'<i><b style="width:'+(st[d.key]==='done'?'100%':'0')+'"></b></i>').join('');
  requestAnimationFrame(()=>{bars.querySelectorAll('b').forEach((b,i)=>{
    if(IDENTITIES[i]&&st[IDENTITIES[i].key]==='done')b.style.width='100%';});});
  document.getElementById('progNum').textContent=doneN;
}

/* ── 主操作坞 ── */
function renderDock(){
  const btn=document.getElementById('ctaMain'),sub=document.getElementById('ctaSub');
  const map={
    guest:['cta-gold','立即实名认证'+ICONS.arrow,()=>toast('即将跳转实名认证 · 人脸核验（约 1 分钟）')],
    choose:['cta-ghost','查看成长路径 ↓',()=>{document.querySelector('.branches').scrollIntoView({behavior:'smooth',block:'center'});
      document.querySelectorAll('.bnode').forEach(n=>n.classList.remove('hl-path'));
      document.querySelectorAll('.bnode:not(.locked)').forEach(n=>n.classList.add('hl-path'));
      setTimeout(()=>document.querySelectorAll('.bnode').forEach(n=>n.classList.remove('hl-path')),1600);}],
    review:['cta-steel','查看审核进度'+ICONS.arrow,()=>toast('跳转审核进度页 · 结果将实时同步')],
    reject:['cta-coral','重新提交申请'+ICONS.arrow,()=>openIdentity('enterprise')],
    done:['cta-done','分享我的信任名片'+ICONS.share,()=>toast('信任名片已生成，去分享给合作伙伴')]
  };
  const[cls,txt,fn]=map[scenario];
  btn.className='cta-main '+cls;btn.innerHTML=txt;btn.onclick=fn;
  if(scenario==='review'||scenario==='reject'){
    sub.style.display='grid';
    sub.innerHTML=scenario==='review'?ICONS.clock:ICONS.warn;
    sub.onclick=()=>openIdentity('enterprise');
  }else{sub.style.display='none';}
}

/* ── 路径节点 / 列表 ── */
function stateIcon(st){
  if(st==='done')return ICONS.check;
  if(st==='review')return '<span class="pulse-dot" style="background:var(--steel)"></span>';
  if(st==='reject')return ICONS.warn;
  if(st==='locked')return ICONS.lock;
  return ICONS.chevR;
}
function renderPath(){
  const st=SCENARIOS[scenario].states;
  const found=st.realname;
  const seal=document.getElementById('foundSeal');
  seal.className='pf-seal '+found;
  seal.innerHTML=found==='done'?ICONS.check:found==='review'?'<span class="pulse-dot" style="background:var(--steel)"></span>':ICONS.chevR;
  document.querySelector('.path-found').classList.toggle('done',found==='done');

  const nodeHtml=d=>{
    const s=st[d.key];
    return '<button class="bnode '+(s==='done'?'done':'')+(s==='locked'?' locked':'')+'" data-id="'+d.key+'">'+
      '<span class="bn-imgwrap"><img class="bn-img" src="'+d.img+'" alt="">'+
      (s==='locked'?'<span class="bn-lock">'+ICONS.lock+'</span>':'')+'</span>'+
      '<span class="bn-body"><span class="bn-name">'+d.name+'</span>'+
      '<span class="bn-desc">'+(s==='locked'?'需先完成实名认证':d.benefit)+'</span></span>'+
      '<span class="bn-state '+s+'">'+stateIcon(s)+'</span></button>';
  };
  document.getElementById('nodesP').innerHTML=IDENTITIES.filter(d=>d.line==='P').map(nodeHtml).join('');
  document.getElementById('nodesE').innerHTML=IDENTITIES.filter(d=>d.line==='E').map(nodeHtml).join('');
  const pn=IDENTITIES.filter(d=>d.line==='P'&&st[d.key]==='done').length;
  const en=IDENTITIES.filter(d=>d.line==='E'&&st[d.key]==='done').length;
  document.getElementById('cntP').textContent=pn+'/2';
  document.getElementById('cntE').textContent=en+'/2';
  document.getElementById('pathCount').textContent=(IDENTITIES.filter(d=>st[d.key]==='done').length)+' / 5';
}
function renderList(){
  const st=SCENARIOS[scenario].states;
  document.getElementById('iList').innerHTML=IDENTITIES.map(d=>{
    const s=st[d.key];
    return '<button class="irow '+(s==='done'?'done':'')+'" data-id="'+d.key+'">'+
      '<img class="ir-img" src="'+d.img+'" alt="">'+
      '<span class="ir-body">'+
        '<span class="ir-name">'+d.name+'<span class="ir-tag">'+d.tag+'</span></span>'+
        '<span class="ir-desc">'+d.desc+'</span></span>'+
      '<span class="ir-right"><span class="spill '+s+'">'+spillIcon(s)+STATE_UI[s].pill+'</span>'+
      '<svg class="ir-arrow" viewBox="0 0 256 256" fill="currentColor"><path d="M90.34,61.66a8,8,0,0,1,11.32,0l80,80a8,8,0,0,1,0,11.32l-80,80a8,8,0,0,1-11.32-11.32L164.69,148,40,148a8,8,0,0,1,0-16H164.69L90.34,73a8,8,0,0,1,0-11.32Z"/></svg>'+
      '</span></button>';
  }).join('');
  document.getElementById('listCount').textContent='完成 '+IDENTITIES.filter(d=>st[d.key]==='done').length+' / 5';
}
function spillIcon(s){
  if(s==='done')return ICONS.check;
  if(s==='review')return '<span class="pulse-dot" style="background:var(--steel)"></span>';
  if(s==='reject')return ICONS.warn;
  if(s==='locked')return ICONS.lock;
  return '';
}

/* ── 半屏面板：身份详情 ── */
const scrim=document.getElementById('scrim'),sheet=document.getElementById('sheet');
function setSheet(on){
  scrim.classList.toggle('on',on);sheet.classList.toggle('on',on);
}
scrim.onclick=()=>setSheet(false);
function stateBanner(d,s){
  const map={
    done:['done',ICONS.check,'<b>已通过 · 权益已开通</b><br>该身份标识已在你的主页、名片与合作场景中展示。'],
    review:['review','<span class="pulse-dot" style="background:var(--steel)"></span>','<b>审核中 · 预计 1–3 个工作日</b><br>平台正在核验你的资料，结果将实时同步，无需重复提交。'],
    reject:['reject',ICONS.warn,'<b>未通过 · 按驳回原因补充后可重新提交</b><br>已为你保留历史填写资料，修改后一键再提交。'],
    todo:['todo',ICONS.arrow,'<b>尚未开通</b><br>'+d.benefit+'，准备好相关资料即可开始。'],
    locked:['locked',ICONS.lock,'<b>尚未解锁</b><br>请先完成「个人认证」（实名 + 人脸核验），通过后自动解锁本身份。']
  };
  const[cls,ic,txt]=map[s];
  return '<div class="sh-state '+cls+'">'+ic+'<div>'+txt+'</div></div>';
}
function openIdentity(key){
  const d=byKey(key);if(!d)return;
  const s=SCENARIOS[scenario].states[key];
  const ctaMap={
    done:['查看认证详情','cta-gold'],
    review:['查看审核进度','cta-steel'],
    reject:['重新提交申请','cta-coral'],
    todo:['去开通 · '+d.fee,'cta-gold'],
    locked:['先完成实名认证','cta-ghost']
  };
  const[ctaTxt,ctaCls]=ctaMap[s];
  sheet.innerHTML=
    '<div class="grab"></div>'+
    '<div class="sh-banner"><img src="'+d.img+'" alt="">'+
      '<div class="sh-cap"><b>'+d.name+'</b><span>'+d.tag+'身份</span></div></div>'+
    '<div class="sh-body">'+
      stateBanner(d,s)+
      '<div class="sh-sec-t">开通后你将获得</div>'+
      '<div class="sh-benefits">'+d.benefits.map(b=>'<div>'+ICONS.check+'<span>'+b+'</span></div>').join('')+'</div>'+
      '<div class="sh-meta"><div><b>费用</b><span>'+d.fee+'</span></div>'+
      '<div><b>预计耗时</b><span>'+d.time+'</span></div></div>'+
    '</div>'+
    '<div class="sh-cta"><button class="'+ctaCls+'" id="shCta">'+ctaTxt+ICONS.arrow+'</button></div>';
  setSheet(true);
  document.getElementById('shCta').onclick=()=>{
    if(s==='locked'){setSheet(false);setScenario('guest');toast('已定位到基石身份：个人认证');return;}
    toast('演示环境：跳转「'+d.name+'」流程页');
  };
}

/* ── 演示状态切换面板 ── */
function openDemo(){
  sheet.innerHTML='<div class="grab"></div>'+
    '<div class="demo-title">切换演示状态</div>'+
    '<div class="demo-sub">仅用于原型预览 · 线上页面由认证数据实时推导</div>'+
    '<div class="demo-opts">'+Object.keys(SCENARIOS).map(k=>{
      const sc=SCENARIOS[k];
      const ic=(k==='guest')?'<svg class="ic" viewBox="0 0 256 256" fill="currentColor"><path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,0,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"/></svg>'
        :(k==='choose')?ICONS.arrow:(k==='review')?ICONS.clock:(k==='reject')?ICONS.warn:ICONS.check;
      return '<button class="demo-opt '+(scenario===k?'on':'')+'" data-sc="'+k+'">'+
        '<span class="do-ic">'+ic+'</span>'+
        '<span class="do-body"><b>'+sc.label+'</b><span>'+sc.sub+'</span></span>'+
        '<span class="do-check">'+ICONS.check+'</span></button>';
    }).join('')+'</div>'+
    '<div class="demo-note">同一套组件随状态切换：主视觉、主操作、路径节点、身份列表联动变化。</div>';
  setSheet(true);
  sheet.querySelectorAll('.demo-opt').forEach(b=>b.onclick=()=>{
    setScenario(b.dataset.sc);setSheet(false);
    toast('演示状态：'+SCENARIOS[b.dataset.sc].label);
  });
}

/* ── 事件委托：节点 / 列表点击 ── */
document.getElementById('flow').addEventListener('click',e=>{
  const t=e.target.closest('[data-id]');
  if(t)openIdentity(t.dataset.id);
});
document.getElementById('btnDemo').onclick=openDemo;
document.getElementById('btnBack').onclick=()=>toast('返回「我的」');
document.getElementById('btnHelp').onclick=()=>{document.getElementById('faq').classList.add('open');
  document.getElementById('faq').scrollIntoView({behavior:'smooth',block:'center'});};
document.getElementById('faqHd').onclick=()=>document.getElementById('faq').classList.toggle('open');

/* ── 场景渲染总入口 ── */
function setScenario(k){
  scenario=k;
  renderHero();renderDock();renderPath();renderList();
  document.getElementById('flow').scrollTo({top:0,behavior:'smooth'});
}
setScenario('guest');

/* ── 入场揭示：进屏才播（阅读次序） ── */
const io=new IntersectionObserver(es=>es.forEach(e=>{
  if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}
}),{threshold:.08});
document.querySelectorAll('.rv').forEach(el=>io.observe(el));

/* ── signature motion：徽章随滚动轻微视差 ── */
const heroImg=document.getElementById('heroImg'),flow=document.getElementById('flow');
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reduce)flow.addEventListener('scroll',()=>{
  const y=Math.max(0,-flow.getBoundingClientRect().top);
  heroImg.style.transform='translateY('+(Math.min(y*.06,22))+'px) scale(1.05)';
},{passive:true});

/* ── 关键屏声明（截图器只枚举这份清单） ── */
window.__UI_CAPTURE__={
  reset:async()=>{setSheet(false);setScenario('guest');
    document.getElementById('faq').classList.remove('open');
    await new Promise(r=>setTimeout(r,420));},
  states:[
    {id:'guest',label:'未认证访客'},
    {id:'choose',label:'已实名选方向',go:async()=>setScenario('choose')},
    {id:'review',label:'审核进行中',go:async()=>setScenario('review')},
    {id:'reject',label:'申请被驳回',go:async()=>setScenario('reject')},
    {id:'done',label:'全部已点亮',go:async()=>setScenario('done')},
    {id:'identity-sheet',label:'身份详情卡',go:async()=>{setScenario('choose');
      await new Promise(r=>setTimeout(r,300));openIdentity('enterprise');}},
    {id:'faq-open',label:'隐私保护展开',go:async()=>{document.getElementById('faq').classList.add('open');
      document.getElementById('faq').scrollIntoView({block:'center'});
      await new Promise(r=>setTimeout(r,400));}}
  ]};
