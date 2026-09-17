const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless:'new', defaultViewport:{width:390,height:844}, args:['--no-sandbox','--enable-gpu','--use-gl=angle'] });
  const p = await b.newPage();
  const logs=[];
  p.on('console', m=>logs.push(m.type()+': '+m.text()));
  p.on('pageerror', e=>logs.push('PAGEERROR: '+e.message));
  await p.goto('http://127.0.0.1:8765/home-liquidglass.html',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,3000));
  console.log(JSON.stringify(await p.evaluate(()=>{
    const cv=document.querySelector('canvas.lg-gl');
    if(!cv) return {canvas:false};
    const gl=cv.getContext('webgl')||cv.getContext('experimental-webgl');
    let px=null, err=null;
    if(gl){
      const buf=new Uint8Array(4*cv.width*cv.height);
      try{ gl.readPixels(0,0,cv.width,cv.height,gl.RGBA,gl.UNSIGNED_BYTE,buf);
           let mx=0,sum=0; for(let i=3;i<buf.length;i+=4){ sum+=buf[i]; if(buf[i]>mx) mx=buf[i]; }
           px={maxAlpha:mx, meanAlpha:+(sum/(buf.length/4)).toFixed(2), w:cv.width,h:cv.height};
      }catch(e){ err=String(e); }
      return {canvas:true, cls:cv.className, cssOpacity:getComputedStyle(cv).opacity,
              glLost:gl.isContextLost(), glError:gl.getError(), pixels:px, readErr:err,
              attr:{w:cv.width,h:cv.height},
              box:{w:cv.getBoundingClientRect().width,h:cv.getBoundingClientRect().height}};
    }
    return {canvas:true, ctx:false, cls:cv.className};
  }),null,2));
  console.log('LOGS '+JSON.stringify(logs.slice(0,15),null,2));
  await b.close();
})();
