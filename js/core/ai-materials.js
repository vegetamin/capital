(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AliceMaterials=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const text=value=>String(value??'').trim();
  const dateLabel=value=>text(value)||'日期未记录';
  const money=cents=>'¥'+(Number(cents||0)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const safeId=value=>text(value).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,120);

  function groupTotals(rows,valueOf){
    const totals={};
    rows.forEach(row=>{const key=text(row.category)||'未分类';totals[key]=(totals[key]||0)+Number(valueOf(row)||0)});
    return Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  }

  function buildImportMaterial(batch,state,helpers){
    const balanceOf=typeof helpers.balanceOf==='function'?helpers.balanceOf:()=>0;
    const spendOf=typeof helpers.spendOf==='function'?helpers.spendOf:t=>Number(t.importAmountCents||0);
    const incomeOf=typeof helpers.incomeOf==='function'?helpers.incomeOf:t=>Number(t.importAmountCents||0);
    const fileName=text(batch.fileName)||'未命名导入文件';
    const accounts=(state.accounts||[]).filter(a=>a.assetImportBatch===batch.id);
    const transactions=(state.transactions||[]).filter(t=>t.importBatch===batch.id&&t.status!=='void');
    const isAsset=batch.type==='asset-excel-reconciled'||accounts.length>0;
    const lines=[`资料名称：${fileName}`,`站内来源：${isAsset?'资产账目导入':'收支账单导入'}`,`导入时间：${dateLabel(batch.createdAt)}`];

    if(isAsset){
      lines.push(`账目日期：${dateLabel(batch.asOf)}`,`工作表：${text(batch.sheetName)||'未记录'}`,`导入模式：${text(batch.mode)||'未记录'}`,`账户数量：${accounts.length}`);
      accounts.forEach(a=>lines.push(`- ${text(a.name)||'未命名账户'}｜性质 ${text(a.kind)||'未分类'}｜余额 ${money(balanceOf(a))}｜来源行 ${a.assetSourceRow??'未记录'}`));
    }else{
      const expenses=transactions.filter(t=>t.type==='expense'),incomes=transactions.filter(t=>t.type==='income');
      lines.push(`有效记录：${transactions.length} 笔`,`导入统计：原批次 ${Number(batch.count||0)} 笔，重复 ${Number(batch.duplicate||0)} 笔，无效或忽略 ${Number(batch.ignored||0)} 笔`);
      const expenseTotal=expenses.reduce((n,t)=>n+spendOf(t),0),incomeTotal=incomes.reduce((n,t)=>n+incomeOf(t),0);
      lines.push(`支出合计：${money(expenseTotal)}`,`收入合计：${money(incomeTotal)}`,'支出分类：');
      groupTotals(expenses,spendOf).slice(0,20).forEach(([name,value])=>lines.push(`- ${name}：${money(value)}`));
      if(transactions.length)lines.push(`记录日期范围：${transactions.map(t=>t.date).filter(Boolean).sort()[0]||'未记录'} 至 ${transactions.map(t=>t.date).filter(Boolean).sort().at(-1)||'未记录'}`);
    }

    return {
      id:'site-import-'+safeId(batch.id||fileName),
      origin:'site',
      kind:isAsset?'asset-import':'spending-import',
      name:fileName,
      subtitle:isAsset?`资产账目 · ${dateLabel(batch.asOf)}`:`收支账单 · ${transactions.length||Number(batch.count||0)} 笔`,
      updatedAt:batch.createdAt||batch.asOf||'',
      content:lines.join('\n')
    };
  }

  function buildSiteMaterials(state,helpers={}){
    if(!state||typeof state!=='object')return [];
    return (state.imports||[]).slice().sort((a,b)=>text(b.createdAt).localeCompare(text(a.createdAt))).map(batch=>buildImportMaterial(batch,state,helpers));
  }

  function composeContext(materials,maxChars=56000){
    const selected=Array.isArray(materials)?materials:[];
    let used=0,truncated=false;
    const sections=[];
    for(const item of selected){
      const header=`【资料：${text(item.name)||'未命名资料'}｜来源：${item.origin==='site'?'Alice Capital OS 站内':'我的资料库'}】\n`;
      const remain=Math.max(0,maxChars-used-header.length-8);
      if(remain<=0){truncated=true;break}
      const body=text(item.content).slice(0,remain);
      if(body.length<text(item.content).length)truncated=true;
      sections.push(header+body+'\n【资料结束】');
      used+=header.length+body.length+8;
    }
    return {text:sections.join('\n\n'),truncated,count:sections.length};
  }

  return {buildSiteMaterials,composeContext};
});
