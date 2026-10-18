// 旧版 Alice 资产账目 XLSX 导入：先预览、后确认；永不覆盖已有账户、流水或持仓。
let assetExcelPending=null;
const ASSET_GROUP_KINDS={'灵活取用':'bank','定期':'fixed','投资':'investment','债权':'receivable','负债':'liability','其他资产':'other'};
const ASSET_SKIP_LABELS=new Set(['日期','占比','汇总','所有者权益','欠款总额','实际资产','资产净值变化','周期','理论资产','资产净值','净资产']);
function assetDate(x){
 if(x instanceof Date&&!Number.isNaN(+x))return x.toISOString().slice(0,10);
 if(typeof x==='number'&&x>20000&&x<90000)return new Date(Date.UTC(1899,11,30)+Math.floor(x)*86400000).toISOString().slice(0,10);
 const s=String(x??'').trim();let m=s.match(/^(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
 if(!m)return '';const y=+m[1],mon=+m[2],d=+m[3],v=new Date(Date.UTC(y,mon-1,d));return v.getUTCFullYear()===y&&v.getUTCMonth()===mon-1&&v.getUTCDate()===d?`${y}-${String(mon).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';
}
function parseAssetWorkbook(wb,name){
 const preferred=wb.SheetNames.find(n=>n.includes('个人财产'));
 let best=null;
 for(const sheetName of [preferred,...wb.SheetNames].filter((v,i,a)=>v&&a.indexOf(v)===i)){
   const matrix=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,raw:true,defval:'',blankrows:false});
   if(!matrix.length)continue;
   const headers=matrix.slice(0,6).map((row,r)=>({row,r})).filter(x=>String(x.row[0]??'').trim()==='日期');
   if(!headers.length)continue;
   const header=headers[0];let col=-1,date='';
   for(let c=1;c<header.row.length;c++){const d=assetDate(header.row[c]);if(d){col=c;date=d}}
   if(col<0)continue;
   let category='',kind='',items=[],skipped=[],categorySums={},sourceTotals={};
   for(let r=header.r+1;r<matrix.length;r++){
     const row=matrix[r]||[], label=String(row[0]??'').trim();
     if(!label)continue;
     if(label==='汇总')break;
     if(ASSET_GROUP_KINDS[label]){category=label;kind=ASSET_GROUP_KINDS[label];try{categorySums[label]=cents(row[col])}catch{}continue}
     if(ASSET_SKIP_LABELS.has(label)){try{sourceTotals[label]=cents(row[col])}catch{}continue;}
     if(!kind){skipped.push(`第${r+1}行：未识别资产分类 ${label}`);continue}
     const raw=row[col];
     if(raw===null||raw===undefined||String(raw).trim()===''){skipped.push(`第${r+1}行：${label} 金额为空`);continue}
     let amount;
     try{amount=cents(raw)}catch{skipped.push(`第${r+1}行：${label} 金额格式错误`);continue}
     if(amount<0){skipped.push(`第${r+1}行：${label} 金额为负，不自动导入`);continue}
     items.push({name:label,kind,category,amount,date,sourceRow:r+1,sourceColumn:col+1});
   }
   if(!items.length)continue;
   best={sheetName,fileName:name,date,items,skipped,categorySums,sourceTotals};break;
 }
 if(!best)throw Error('无法识别旧版资产账目模板：需要“日期”行，以及“灵活取用 / 定期 / 投资 / 债权 / 负债”等资产分类。');
 const unique=new Set();for(const item of best.items){let key=item.category+'\u001f'+item.name;if(unique.has(key))throw Error('同一分类出现重名账户：'+item.name+'。为避免重复计算，请先调整 Excel。');unique.add(key)}
 return best;
}
async function previewAssetExcel(event){
 assetExcelPending=null;const commit=$('assetExcelCommit'),area=$('assetExcelPreview');commit.disabled=true;
 const file=event.target.files?.[0];if(!file)return;
 try{
  if(!/\.(xlsx|xls)$/i.test(file.name))throw Error('请选择 .xlsx 或 .xls 文件');
  if(!globalThis.XLSX)throw Error('Excel 解析组件尚未加载，请确认网络连接并刷新网页');
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
  const parsed=parseAssetWorkbook(workbook,file.name);
  // 保守处理：同分类、同名称的账户不自动覆盖；有余额和历史流水都不会篡改。
  // 识别所有同名旧账户：即使旧账户没有 assetSourceCategory，也不能当成新资产再次新增。
  const oldByName=new Map();for(const a of state.accounts){const key=String(a.name).trim().replace(/\s+/g,'').toLowerCase();if(!oldByName.has(key))oldByName.set(key,[]);oldByName.get(key).push(a)}
  parsed.items=parsed.items.map(item=>{const matches=oldByName.get(item.name.replace(/\s+/g,'').toLowerCase())||[];return {...item,exists:matches.length>0,existingCount:matches.length}});
  // 分类合计为资产表中的权威小计；明细有不在小计内的项目时，明确展示，不静默并入。
  parsed.reconcile=Object.entries(parsed.categorySums).map(([category,total])=>{const detail=parsed.items.filter(x=>x.category===category).reduce((n,x)=>n+x.amount,0);return {category,total,detail,diff:detail-total}});
  const activeCategories=['灵活取用','定期','投资','债权'];const sourceGross=activeCategories.reduce((n,k)=>n+(parsed.categorySums[k]||0),0);const liability=parsed.categorySums['负债']||0;
  const extra=parsed.reconcile.filter(x=>x.diff!==0);const sourceNet=sourceGross-liability;
  parsed.sourceGross=sourceGross;parsed.sourceNet=sourceNet;parsed.extra=extra;
  assetExcelPending=parsed;
  const rows=parsed.items.map(x=>`<tr><td>${esc(x.category)}</td><td>${esc(x.name)}</td><td>${amt(x.amount)}</td><td>${x.exists?'同名账户已存在：跳过':'待新增'}</td></tr>`).join('');
  const recRows=parsed.reconcile.map(x=>`<tr><td>${esc(x.category)}</td><td>${amt(x.total)}</td><td>${amt(x.detail)}</td><td>${amt(x.diff)}</td></tr>`).join('');
  const suppliedGross=parsed.sourceTotals['实际资产'];
  const discrepancy=suppliedGross===undefined?'未找到“实际资产”汇总字段':`Excel“实际资产” ${amt(suppliedGross)}；分类合计 ${amt(sourceGross)}；差额 ${amt(sourceGross-suppliedGross)}`;
  const extraMsg=extra.length?`<div class="notice"><b>重要：分类小计与明细不一致。</b> ${esc(extra.map(x=>x.category+'：明细较小计多'+yuan(x.diff)+'元').join('；'))}。这可能意味着有未纳入小计的项目（如黄金），需确认后决定统计口径。不会把 Excel 的“实际资产”直接当作净资产。</div>`:'';
  const existingWarnings=parsed.items.some(x=>x.exists)?'<div class="notice">发现现有同名账户。旧导入记录可能与本文件重复。系统不修改这些旧账户，若资产总额异常，请先在数据中心备份并核查旧账户。</div>':'';
  area.innerHTML=`<p><b>文件：</b>${esc(file.name)}　<b>工作表：</b>${esc(parsed.sheetName)}　<b>余额日期：</b>${esc(parsed.date)}</p><p><b>资产对账：</b>${discrepancy}。<br><b>标准净资产（按分类小计、扣除负债）：</b>${amt(sourceNet)}；<b>负债：</b>${amt(liability)}。注意“实际资产”是原表标签，不保证为标准净资产。</p>${extraMsg}${existingWarnings}<h3>分类汇总与明细核对</h3>${table(['类别','原表小计','明细合计','差异'],recRows)}<h3>拟导入账户</h3>${table(['分类','账户','余额','操作'],rows)}${parsed.skipped.length?`<p>跳过 ${parsed.skipped.length} 行：${esc(parsed.skipped.slice(0,6).join('；'))}</p>`:''}<p>共识别 ${parsed.items.length} 项，将新增 ${parsed.items.filter(x=>!x.exists).length} 项。所有账户必须与实际余额核对，AI 不应直接信任存在差异的资产总数。</p>`;
  commit.disabled=!parsed.items.some(x=>!x.exists)||parsed.extra.length>0; // 小计不一致先停用导入，避免错误入账
 }catch(e){area.textContent='资产Excel解析失败：'+e.message}
}
async function commitAssetExcel(){
 const p=assetExcelPending;if(!p)return;if(p.extra?.length){alert('资产明细与分类小计不一致，请先核对原表后再导入。');return;}
 const fresh=p.items.filter(x=>!state.accounts.some(a=>a.name.trim().replace(/\s+/g,'').toLowerCase()===x.name.trim().replace(/\s+/g,'').toLowerCase()));
 if(!fresh.length)return alert('没有需要新增的账户');
 if(!confirm(`将根据 ${p.date} 的账目新增 ${fresh.length} 个资产账户。\n不会修改既有账户、交易、持仓，也不会自动合并重名。\n若账目与现有持仓重叠，请取消并核对。\n确认导入？`))return;
 const before=state.accounts.length;
 try{
  const batch=uid();for(const item of fresh){state.accounts.push({id:uid(),name:item.name,institution:'',kind:item.kind,opening:item.kind==='liability'?-item.amount:item.amount,asOf:item.date,assetSourceCategory:item.category,assetImportBatch:batch,assetSourceFile:p.fileName,assetSourceSheet:p.sheetName,assetSourceRow:item.sourceRow,assetSourceColumn:item.sourceColumn})}
  state.imports.push({id:batch,type:'asset-excel',fileName:p.fileName,createdAt:now(),sheetName:p.sheetName,asOf:p.date,count:fresh.length,skipped:p.skipped.length});
  await save('asset-excel-import',p.fileName+' '+fresh.length+'项');assetExcelPending=null;alert('已导入 '+fresh.length+' 个账户；请与 Excel 账面净资产核对。');
 }catch(e){state.accounts.splice(before);alert('导入失败：'+e.message+'。请检查数据中心的账户记录。')}
}
