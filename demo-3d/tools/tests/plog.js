window.SKIP_DAWN=1;
try{localStorage.setItem('cbs.base.settings', JSON.stringify({playAs:'partner'}))}catch(e){}
window.PLOG={untr:[],errs:[],swaps:0,busyHer:0,tele:[],lines:0};
addEventListener('error',e=>PLOG.errs.push(String(e.message)));
const _iv=setInterval(()=>{ if(!window.G||!G.say||!window.DEMO) return; clearInterval(_iv);
  const s=G.say; G.say=function(who,text,o){ PLOG.lines++; try{ if(who==null && G.herSide && G.herSide() && !(window.CBS_NARR_HER||{})[text] && /\b(she|her|hers|herself)\b/i.test(text) && !/^\(Take your time/.test(text)) { if(!PLOG.untr.includes(G.S.chapter+': '+text)) PLOG.untr.push(G.S.chapter+': '+text); } }catch(e){} return s.apply(this,arguments); };
  let was=false, px=0,pz=0; G.TICKERS.add(()=>{ const P=DEMO.PLAYER,a=!!DEMO.STATE.asHer; if(a!==was){ PLOG.swaps++; was=a; } if(a && G.busy() && !(G.S&&G.S.inInter)) PLOG.busyHer++; });
},50);
