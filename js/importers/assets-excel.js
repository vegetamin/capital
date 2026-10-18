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
const ASSET_IMPORT_MODES={review:'仅核对，不修改',add:'只新增未匹配账户',sync:'更新匹配账户余额并新增账户'};
const canonicalAccountName=s=>String(s??'').normalize('NFKC').replace(/\s+/g,'').toLowerCase();
function assetTargetBalance(item){return item.kind==='liability'?-item.amount:item.amount}
function assetMatch(item){return state.accounts.filter(a=>canonicalAccountName(a.name)===canonicalAccountName(item.name))}
function assetLinkedTransactions(a){return state.transactions.filter(t=>t.status!=='void'&&(t.entries||[]).some(e=>e.accountId===a.id)).length}
function chooseAssetImportMode(){if(!assetExcelPending)return;refreshAssetPreview()}
function refreshAssetPreview(){
 const p=assetExcelPending;if(!p)return;const mode=$('assetExcelMode')?.value||'review',commit=$('assetExcelCommit'),area=$('assetExcelPreview');
 const rows=p.items.map(item=>{
  const hits=assetMatch(item);const a=hits[0];let op='',difference=null;
  if(hits.length>1)op='⚠ 同名多账户，禁止自动处理';
  else if(!a)op=mode==='review'?'仅核对': '新增账户';
  else{
   difference=assetTargetBalance(item)-acctBalance(a.id);
   const linked=assetLinkedTransactions(a);
   const compatible=(a.kind===item.kind)||(a.kind==='cash'&&item.name==='现金'&&item.kind==='bank');
   if(!compatible)op='⚠ 账户性质冲突，人工核实';
   else if(linked&&difference)op=`⚠ 有${linked}笔关联流水，禁止自动覆盖`;
   else if(!difference)op='余额一致';
   else op=mode==='sync'?'更新当前余额（留审计）':'现有账户不更新';
  }
  return `<tr><td>${esc(item.category)}</td><td>${esc(item.name)}</td><td>${amt(item.amount)}</td><td>${a?amt(acctBalance(a.id)):'—'}</td><td>${difference===null?'—':amt(difference)}</td><td>${esc(op)}</td></tr>`
 }).join('');
 const recRows=p.reconcile.map(x=>`<tr><td>${esc(x.category)}</td><td>${amt(x.total)}</td><td>${amt(x.detail)}</td><td>${amt(x.diff)}</td></tr>`).join('');
 const existing=state.accounts.filter(a=>!a.auditExcluded);
 const expectedGross=p.items.filter(x=>x.kind!=='liability').reduce((n,x)=>n+x.amount,0);
 const expectedDebt=p.items.filter(x=>x.kind==='liability').reduce((n,x)=>n+x.amount,0);
 const expectedNet=expectedGross-expectedDebt;
 const sourceGross=p.sourceTotals['实际资产'];
 const totalsText=`<p><b>Excel明细总资产：</b>${amt(expectedGross)}；<b>负债：</b>${amt(expectedDebt)}；<b>标准净资产：</b>${amt(expectedNet)}。${sourceGross!==undefined?`<br>Excel“实际资产”字段：${amt(sourceGross)}（字段含义可能是总资产，需核对公式）。`:''}</p>`;
 const invalid=p.reconcile.filter(x=>x.diff!==0);
 const eligible=p.items.filter(item=>{
  const hits=assetMatch(item);if(!hits.length)return mode!=='review';if(mode!=='sync'||hits.length!==1)return false;
  const a=hits[0];return (a.kind===item.kind||(a.kind==='cash'&&item.name==='现金'&&item.kind==='bank'))&&!assetLinkedTransactions(a)&&assetTargetBalance(item)!==acctBalance(a.id);
 });
 area.innerHTML=`<p><b>文件：</b>${esc(p.fileName)}　<b>工作表：</b>${esc(p.sheetName)}　<b>余额日期：</b>${esc(p.date)}</p>${totalsText}<div class="notice">历史账户不会因名称相同而自动跳过且假装完成更新。更新只允许无关联流水、性质一致且唯一匹配的账户；有交易或重名冲突的账户必须单独核对。</div>${invalid.length?`<div class="notice"><b>分类小计与明细存在差异：</b>${esc(invalid.map(x=>x.category+' '+yuan(x.diff)+'元').join('；'))}。停止自动入账，先核对Excel。</div>`:''}<h3>Excel小计核对</h3>${table(['类别','原表小计','明细合计','差异'],recRows)}<h3>逐账户差异</h3>${table(['分类','账户','本次Excel余额','系统余额','差额','计划操作'],rows)}<p>当前模式：${esc(ASSET_IMPORT_MODES[mode])}；可安全执行 ${eligible.length} 项。存在旧账户但不在本次Excel中的记录不会自动删除或排除。</p>`;
 commit.disabled=mode==='review'||eligible.length===0||invalid.length>0;
 commit.textContent=mode==='sync'?'确认同步账户余额':mode==='add'?'确认新增账户':'仅核对（不写入）';
}
async function previewAssetExcel(event){
 assetExcelPending=null;const commit=$('assetExcelCommit'),area=$('assetExcelPreview');commit.disabled=true;
 const file=event.target.files?.[0];if(!file)return;
 try{
  if(!/\.(xlsx|xls)$/i.test(file.name))throw Error('请选择 .xlsx 或 .xls 文件');
  if(!globalThis.XLSX)throw Error('Excel 解析组件尚未加载');
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
  const parsed=parseAssetWorkbook(workbook,file.name);
  parsed.reconcile=Object.entries(parsed.categorySums).map(([category,total])=>{const detail=parsed.items.filter(x=>x.category===category).reduce((n,x)=>n+x.amount,0);return {category,total,detail,diff:detail-total}});
  if(parsed.items.some(item=>assetMatch(item).length>1))parsed.hasAmbiguous=true;
  assetExcelPending=parsed;
  $('assetExcelMode').value='review';refreshAssetPreview();
 }catch(e){area.textContent='资产Excel解析失败：'+e.message}
}
async function commitAssetExcel(){
 const p=assetExcelPending,mode=$('assetExcelMode')?.value;if(!p||mode==='review')return;
 if(p.reconcile.some(x=>x.diff!==0))return alert('分类小计与明细不一致，暂停导入。');
 const proposed=[];const blocked=[];
 for(const item of p.items){
  const hits=assetMatch(item);
  if(!hits.length){proposed.push({type:'add',item});continue}
  if(mode!=='sync')continue;
  if(hits.length!==1){blocked.push(item.name+'（同名多账户）');continue}
  const a=hits[0];const target=assetTargetBalance(item),delta=target-acctBalance(a.id);
  if(!delta)continue;
  if(a.kind!==item.kind&&!(a.kind==='cash'&&item.name==='现金'&&item.kind==='bank')){blocked.push(item.name+'（账户类型不同）');continue}
  if(assetLinkedTransactions(a)){blocked.push(item.name+'（关联流水，需人工对账）');continue}
  proposed.push({type:'update',item,account:a,oldBalance:acctBalance(a.id),target,delta});
 }
 if(blocked.length)return alert('部分账户不能自动更新：'+blocked.join('；')+'。请到资产中心单独对账后再同步。未修改任何数据。');
 if(!proposed.length)return alert('没有可执行的新增或更新');
 const added=proposed.filter(x=>x.type==='add').length,updated=proposed.length-added;
 if(!confirm(`依据 ${p.date} 的Excel操作：新增 ${added} 个，更新 ${updated} 个。\n余额更新会修改无流水账户的期初基准，并保留旧余额及变更审计。\n系统将先自动下载完整备份。继续？`))return;
 // 先下载完整备份；下载不意味着已经保存到用户磁盘，页面明确提醒。
 download('Alice-同步资产前备份-'+today()+'.json',JSON.stringify({app:'Alice Life Capital OS',exportedAt:now(),data:state},null,2),'application/json');
 const snapshot=structuredClone(state),batch=uid();
 try{
  for(const change of proposed){const x=change.item;
   if(change.type==='add')state.accounts.push({id:uid(),name:x.name,institution:'',kind:x.kind,opening:assetTargetBalance(x),asOf:x.date,assetSourceCategory:x.category,assetImportBatch:batch,assetSourceFile:p.fileName,assetSourceSheet:p.sheetName,assetSourceRow:x.sourceRow,assetSourceColumn:x.sourceColumn});
   else{const a=change.account;
    a.balanceAuditHistory=a.balanceAuditHistory||[];
    a.balanceAuditHistory.push({at:now(),from:change.oldBalance,to:change.target,delta:change.delta,fromDate:a.asOf||null,toDate:p.date,source:p.fileName,sheet:p.sheetName,row:x.sourceRow,batch});
    a.opening+=change.delta;a.asOf=x.date;a.assetImportBatch=batch;a.assetSourceFile=p.fileName;a.assetSourceSheet=p.sheetName;a.assetSourceRow=x.sourceRow;a.assetSourceColumn=x.sourceColumn;
   }
  }
  state.imports.push({id:batch,type:'asset-excel-reconciled',mode,fileName:p.fileName,createdAt:now(),sheetName:p.sheetName,asOf:p.date,count:proposed.length,added,updated,sourceNet:p.items.filter(x=>x.kind!=='liability').reduce((n,x)=>n+x.amount,0)-p.items.filter(x=>x.kind==='liability').reduce((n,x)=>n+x.amount,0)});
  await save('asset-excel-sync',p.fileName+'：新增'+added+'、更新'+updated);
  assetExcelPending=null;alert('同步完成：新增'+added+'、更新'+updated+'。请检查首页总资产、净资产，并继续核对未匹配或待核账户。');
 }catch(e){state=snapshot;alert('同步失败，已回滚当前内存状态：'+e.message)}
}
