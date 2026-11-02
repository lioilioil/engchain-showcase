const BASE='http://127.0.0.1:8765/pages/vendor/upgrades.html', PROFILE='http://127.0.0.1:8765/pages/profile/index.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const t=await(await fetch('http://127.0.0.1:9333/json/list')).json(); const pg=t.find(x=>x.type==='page');
const ws=new WebSocket(pg.webSocketDebuggerUrl); let id=0; const pend=new Map(); const errors=[];
ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data); if(m.id!=null){const p=pend.get(m.id); if(p){pend.delete(m.id); m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);} return;} if(m.method==='Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception&&m.params.exceptionDetails.exception.description)||m.params.exceptionDetails.text);});
const send=(method,params)=>new Promise((res,rej)=>{const mid=++id; pend.set(mid,{resolve:res,reject:rej}); ws.send(JSON.stringify({id:mid,method,params:params||{}}));});
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true,userGesture:true}); return r.exceptionDetails?{__err:(r.exceptionDetails.exception&&r.exceptionDetails.exception.description)||r.exceptionDetails.text}:r.result.value;};
const nav=async u=>{await send('Page.navigate',{url:u}); await sleep(1700);};
await new Promise(r=>ws.addEventListener('open',r)); await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
for(const [key,plan] of [['realname','p-premium'],['enterprise','e-pro'],['resident_agency','a-pro']]){
  await nav(PROFILE); await ev(`['engchain-ops','engchain-upgrades','engchain-balance','engchain-state','engchain-agent-demo'].forEach(k=>localStorage.removeItem(k))`);
  await nav(PROFILE); await ev(`DataBus.applyDemoScenario(${JSON.stringify(key)})`); await sleep(400);
  await ev(`BalanceStore.recharge(2500,'wechat',{remark:'m'})`);
  await ev(`OpsStore.subscribe(${JSON.stringify(plan)},'monthly')`); await sleep(250);
  await nav(BASE);
  console.log(key, JSON.stringify(await ev(`(function(){
    return {meters:Array.prototype.map.call(document.querySelectorAll('.ops-meter'),function(m){return m.innerText.replace(/\s+/g,' ');}),
      cols:getComputedStyle(document.querySelector('.ops-meters')||document.body).gridTemplateColumns};
  })()`)));
}
console.log('ERRORS', errors.length?errors.slice(0,4):'none'); ws.close();
})().catch(e=>{console.error(e);process.exit(1);});
