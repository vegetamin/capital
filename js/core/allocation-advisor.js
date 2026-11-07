(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AliceAllocation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const PROFILES={
    conservative:{label:'稳健保守',targets:{liquid:30,fixed:45,investment:25,other:0}},
    balanced:{label:'均衡增长',targets:{liquid:20,fixed:30,investment:50,other:0}},
    growth:{label:'长期成长',targets:{liquid:15,fixed:20,investment:65,other:0}},
    custom:{label:'自定义',targets:{liquid:20,fixed:30,investment:50,other:0}}
  };
  const GROUPS=[
    {id:'liquid',name:'灵活资金'},
    {id:'fixed',name:'定期与低风险'},
    {id:'investment',name:'投资资产'},
    {id:'other',name:'债权与其他资产'}
  ];
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
  const sum=(rows,fn=x=>x)=>rows.reduce((n,x)=>n+Number(fn(x)||0),0);
  const round=n=>Math.round(Number(n)||0);
  const activePurposes=state=>(state.fundPurposes||[]).filter(x=>x.status==='active');
  const pendingOrders=state=>(state.decisions||[]).filter(x=>x.status==='submitted');
  const accountGroup=kind=>['cash','bank','money'].includes(kind)?'liquid':kind==='fixed'?'fixed':kind==='investment'?'investment':['receivable','other'].includes(kind)?'other':'';

  function policy(state){
    const saved=state?.policy?.allocation||{},profile=PROFILES[saved.riskProfile]?saved.riskProfile:'balanced';
    const base=PROFILES[profile].targets;
    return {
      riskProfile:profile,
      confirmed:saved.confirmed===true,
      horizonYears:clamp(saved.horizonYears||10,1,80),
      driftTolerance:clamp(saved.driftTolerance||5,1,20),
      targets:{...base,...(saved.targets||{})},
      rebalanceMethod:'contributions-first',
      updatedAt:saved.updatedAt||null
    };
  }

  function staleAccount(account,now,days=45){
    if(!account.asOf)return true;
    const time=new Date(account.asOf+'T00:00:00').getTime();
    return !Number.isFinite(time)||(now.getTime()-time)>days*86400000;
  }

  function build(state,{balanceOf=()=>0,holdingValue=h=>round((h.qty||0)*(h.priceUnit??(h.priceCents||0)*100)/((h.scale||1)*100)),now=new Date()}={}){
    state=state||{};
    const p=policy(state),amounts={liquid:0,fixed:0,investment:0,other:0};
    const accounts=(state.accounts||[]).filter(a=>!a.auditExcluded&&a.kind!=='liability');
    accounts.forEach(a=>{const group=accountGroup(a.kind),value=Math.max(0,round(balanceOf(a)));if(group)amounts[group]+=value});
    amounts.investment+=sum(state.holdings||[],h=>Math.max(0,round(holdingValue(h))));
    const total=sum(Object.values(amounts)),assignedCents=sum(activePurposes(state),x=>x.amountCents),reservedCents=sum(pendingOrders(state),x=>x.reservedCents),cashFloorCents=Math.max(0,round(state.policy?.cashFloor));
    const protectedCents=assignedCents+reservedCents+cashFloorCents;
    const configurableCents=Math.max(0,amounts.liquid-protectedCents),cashGapCents=Math.max(0,protectedCents-amounts.liquid);
    const rows=GROUPS.map(group=>{
      const currentCents=amounts[group.id],currentPercent=total?currentCents/total*100:0,targetPercent=clamp(p.targets[group.id],0,100),targetCents=round(total*targetPercent/100),gapCents=targetCents-currentCents;
      const driftPercent=currentPercent-targetPercent;
      return {...group,currentCents,currentPercent,targetPercent,targetCents,gapCents,driftPercent,hasData:total>0,isSignificant:total>0&&Math.abs(driftPercent)>p.driftTolerance};
    });
    const conflicts=(state.wealthFacts||[]).filter(x=>x.status!=='superseded'&&x.verification==='conflict');
    const pending=pendingOrders(state),stale=accounts.filter(a=>staleAccount(a,now));
    const blockers=[];
    if(!total)blockers.push('尚未形成可计算的资产总额');
    if(!p.confirmed)blockers.push('目标配置仍是系统草案，尚未由你确认');
    if(conflicts.length)blockers.push(`存在 ${conflicts.length} 条未解决的财富事实冲突`);
    if(pending.length)blockers.push(`存在 ${pending.length} 笔待成交委托，需先确认成交或撤单`);
    if(stale.length)blockers.push(`有 ${stale.length} 个账户超过45天未核对或缺少余额日期`);
    const actions=[];
    if(!total)actions.push({kind:'data',title:'先录入或导入资产余额',detail:'至少需要一份带日期的账户余额，才能判断当前配置和可配置资金。',amountCents:0});
    if(conflicts.length)actions.push({kind:'verify',title:'先解决财富事实冲突',detail:'冲突未解决前，不生成新的权益买入金额。',amountCents:0});
    if(stale.length)actions.push({kind:'verify',title:'更新过期账户余额',detail:`先核对 ${stale.slice(0,3).map(x=>x.name||'未命名账户').join('、')}${stale.length>3?'等':''}。`,amountCents:0});
    if(pending.length)actions.push({kind:'orders',title:'处理待成交委托',detail:`已有 ${pending.length} 笔挂单，先确认成交、撤单或继续等待。`,amountCents:reservedCents});
    if(!p.confirmed)actions.push({kind:'policy',title:'确认你的目标配置',detail:'风险模板只是起点；确认投资期限和目标比例后，系统才计算配置金额。',amountCents:0});
    if(total>0&&cashGapCents>0)actions.push({kind:'protect',title:'优先补足资金边界',detail:'当前灵活资金不足以同时覆盖现金底线、资金用途和待成交冻结。',amountCents:cashGapCents});

    const preciseAllowed=blockers.length===0&&cashGapCents===0;
    if(preciseAllowed&&configurableCents>0){
      const under=rows.filter(x=>x.id!=='liquid'&&x.gapCents>0).sort((a,b)=>b.gapCents-a.gapCents),totalGap=sum(under,x=>x.gapCents);
      let remaining=configurableCents;
      under.forEach((row,index)=>{const suggested=index===under.length-1?Math.min(row.gapCents,remaining):Math.min(row.gapCents,round(configurableCents*row.gapCents/Math.max(1,totalGap)));if(suggested>0){actions.push({kind:'allocate',groupId:row.id,title:`本期优先补充${row.name}`,detail:`当前 ${row.currentPercent.toFixed(1)}%，目标 ${row.targetPercent.toFixed(1)}%；采用新增资金优先，不要求为调仓强制卖出。`,amountCents:suggested});remaining-=suggested}});
      if(!under.length)actions.push({kind:'hold',title:'暂不需要新增调仓',detail:'非现金资产均未低于目标，保留可配置资金并等待下次复盘。',amountCents:configurableCents});
      else if(remaining>0)actions.push({kind:'hold',title:'保留未分配余额',detail:'目标缺口补足后仍有余额，不自动扩大风险资产比例。',amountCents:remaining});
    }else if(preciseAllowed&&!configurableCents){actions.push({kind:'hold',title:'本期没有可配置资金',detail:'现金底线和已隔离资金尚未覆盖完毕，暂不增加新的配置动作。',amountCents:0})}

    const significant=rows.filter(x=>Math.abs(x.driftPercent)>p.driftTolerance);
    const status=blockers.length?'blocked':cashGapCents?'protect':actions.some(x=>x.kind==='allocate')?'allocate':'stable';
    return {policy:p,amounts,total,rows,assignedCents,reservedCents,cashFloorCents,protectedCents,configurableCents,cashGapCents,blockers,actions,significantDrift:significant,status,staleAccounts:stale.map(x=>({id:x.id,name:x.name,asOf:x.asOf||null}))};
  }

  return {PROFILES,GROUPS,policy,build};
});
