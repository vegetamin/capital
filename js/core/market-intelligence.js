(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AliceMarket=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const GROUPS=[
    {id:'global',name:'国际与宏观',question:'增长、通胀、政策与美元是否正在改变资金环境？'},
    {id:'industry',name:'行业景气',question:'盈利、估值、库存与政策是否支持行业趋势？'},
    {id:'equity',name:'股票市场',question:'主要指数、市场宽度、波动率与盈利预期是否一致？'},
    {id:'bond',name:'债券与利率',question:'利率曲线、实际利率与信用利差如何定价风险？'},
    {id:'futures',name:'期货与商品',question:'油、金、铜、期限结构与持仓是否出现异常？'},
    {id:'events',name:'事件与态势',question:'央行、数据发布、财报与地缘事件是否临近？'}
  ];
  const CADENCE_HOURS={realtime:1,intraday:8,daily:72,weekly:240,monthly:1488,quarterly:3360,event:720};
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
  const iso=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toISOString():null};

  function normalize(input,now=new Date()){
    const raw=input&&typeof input==='object'?input:{};
    const observations=(Array.isArray(raw.observations)?raw.observations:[]).slice(0,160).map((x,index)=>{
      const cadence=CADENCE_HOURS[x?.cadence]?x.cadence:'daily';
      const observedAt=iso(x?.observedAt),fetchedAt=iso(x?.fetchedAt)||now.toISOString();
      const ageHours=observedAt?Math.max(0,(now-new Date(observedAt))/36e5):Infinity;
      const group=GROUPS.some(g=>g.id===x?.group)?x.group:'events';
      return {id:String(x?.id||group+'-'+index).slice(0,80),group,label:String(x?.label||'未命名指标').slice(0,80),value:x?.value??null,unit:String(x?.unit||'').slice(0,20),change:Number.isFinite(Number(x?.change))?Number(x.change):null,signal:clamp(x?.signal,-1,1),cadence,observedAt,fetchedAt,source:String(x?.source||'未标明来源').slice(0,120),sourceUrl:/^https:\/\//.test(String(x?.sourceUrl||''))?String(x.sourceUrl):'',note:String(x?.note||'').slice(0,300),stale:ageHours>CADENCE_HOURS[cadence],ageHours};
    });
    const events=(Array.isArray(raw.events)?raw.events:[]).slice(0,40).map((x,index)=>({id:String(x?.id||'event-'+index),title:String(x?.title||'未命名事件').slice(0,120),at:iso(x?.at),importance:['low','medium','high'].includes(x?.importance)?x.importance:'medium',source:String(x?.source||'').slice(0,120),note:String(x?.note||'').slice(0,300)}));
    return {version:'ALICE-MARKET-1',asOf:iso(raw.asOf)||now.toISOString(),fetchedAt:iso(raw.fetchedAt)||now.toISOString(),observations,events,errors:Array.isArray(raw.errors)?raw.errors.map(String).slice(0,20):[]};
  }

  function assess(input,now=new Date()){
    const snapshot=normalize(input,now),usable=snapshot.observations.filter(x=>!x.stale&&x.observedAt&&x.value!==null),covered=new Set(usable.map(x=>x.group));
    const coverage=Math.round(covered.size/GROUPS.length*100),freshness=snapshot.observations.length?Math.round(snapshot.observations.filter(x=>!x.stale).length/snapshot.observations.length*100):0;
    const weight=usable.reduce((n,x)=>n+(x.group==='events'?1.2:1),0),score=weight?usable.reduce((n,x)=>n+x.signal*(x.group==='events'?1.2:1),0)/weight:0;
    const highEvents=snapshot.events.filter(x=>x.importance==='high'&&x.at&&Math.abs(new Date(x.at)-now)<=7*864e5);
    let regime='insufficient',label='证据不足',summary='尚未取得足够的新鲜数据，不能形成市场态势判断。';
    if(covered.size>=3&&freshness>=50){
      if(score<=-.28||highEvents.length>=2){regime='defensive';label='防御与复核';summary='风险证据占优或重要事件密集，执行前需要分批并复核。'}
      else if(score>=.28&&highEvents.length===0){regime='constructive';label='环境偏支持';summary='多数新鲜证据偏正面，但仍不能替代长期目标配置。'}
      else{regime='mixed';label='信号分化';summary='不同市场证据未形成一致方向，适合按计划小步执行。'}
    }
    const overlay={
      insufficient:{pace:'先核对数据',batches:0,reviewRequired:true,note:'暂停新增市场判断；先补齐或更新数据源。'},
      defensive:{pace:'谨慎分批',batches:4,reviewRequired:true,note:'把本期配置拆成四批，重要事件后重新确认；不自动降低长期目标比例。'},
      mixed:{pace:'小步分批',batches:2,reviewRequired:true,note:'把本期配置拆成两批，第二批前复核利率、波动与事件风险。'},
      constructive:{pace:'按计划执行',batches:1,reviewRequired:false,note:'按既定周期执行；市场态势不构成扩大风险预算的理由。'}
    }[regime];
    const groups=GROUPS.map(g=>{const rows=snapshot.observations.filter(x=>x.group===g.id);return {...g,rows,fresh:rows.filter(x=>!x.stale).length,stale:rows.filter(x=>x.stale).length,score:rows.length?rows.reduce((n,x)=>n+x.signal,0)/rows.length:0}});
    return {snapshot,regime,label,summary,score:Number(score.toFixed(3)),coverage,freshness,highEvents,overlay,groups};
  }

  return {GROUPS,CADENCE_HOURS,normalize,assess};
});
