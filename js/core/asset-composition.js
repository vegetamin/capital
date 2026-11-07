(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.AliceAssetComposition=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const GROUPS=[
  {id:'liquid',name:'灵活资金',color:'#356B72',kinds:['cash','bank','money']},
  {id:'fixed',name:'定期存款',color:'#D2A64B',kinds:['fixed']},
  {id:'investment',name:'投资资产',color:'#7466A8',kinds:['investment']},
  {id:'receivable',name:'应收债权',color:'#C86E5D',kinds:['receivable']},
  {id:'other',name:'其他资产',color:'#809079',kinds:['other']}
 ];
 function holdingValue(h){
  const scale=Number(h.scale)||1;
  return Math.round((Number(h.qty)||0)*(h.priceUnit??(Number(h.priceCents)||0)*100)/(scale*100));
 }
 function build(state,balanceOf){
  const groups=GROUPS.map(g=>({...g,value:0,children:[]}));
  const byId=Object.fromEntries(groups.map(g=>[g.id,g]));
  const accounts=Array.isArray(state?.accounts)?state.accounts:[];
  const excluded=new Set(accounts.filter(a=>a.auditExcluded).map(a=>a.id));
  accounts.filter(a=>!a.auditExcluded&&a.kind!=='liability').forEach(a=>{
   const group=groups.find(g=>g.kinds.includes(a.kind))||byId.other;
   const value=Math.max(0,Math.round(Number(balanceOf(a.id))||0));
   if(!value)return;
   group.value+=value;
   group.children.push({id:'account-'+a.id,name:a.name||'未命名账户',value,type:'account'});
  });
  (Array.isArray(state?.holdings)?state.holdings:[]).filter(h=>!excluded.has(h.accountId)).forEach(h=>{
   const value=Math.max(0,holdingValue(h));
   if(!value)return;
   byId.investment.value+=value;
   byId.investment.children.push({id:'holding-'+h.id,name:[h.symbol,h.name].filter(Boolean).join(' · ')||'未命名持仓',value,type:'holding'});
  });
  const visible=groups.filter(g=>g.value>0);
  const total=visible.reduce((n,g)=>n+g.value,0);
  visible.forEach(g=>{
   g.percent=total?g.value/total:0;
   g.children.sort((a,b)=>b.value-a.value);
   g.children.forEach(c=>c.percent=g.value?c.value/g.value:0);
  });
  return {groups:visible,total};
 }
 return {GROUPS,build,holdingValue};
});
