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
   let category='',kind='',items=[],skipped=[];
   for(let r=header.r+1;r<matrix.length;r++){
     const row=matrix[r]||[], label=String(row[0]??'').trim();
     if(!label)continue;
     if(label==='汇总')break;
     if(ASSET_GROUP_KINDS[label]){category=label;kind=ASSET_GROUP_KINDS[label];continue}
     if(ASSET_SKIP_LABELS.has(label))continue;
     if(!kind){skipped.push(`第${r+1}行：未识别资产分类 ${label}`);continue}
     const raw=row[col];
     if(raw===null||raw===undefined||String(raw).trim()===''){skipped.push(`第${r+1}行：${label} 金额为空`);continue}
     let amount;
     try{amount=cents(raw)}catch{skipped.push(`第${r+1}行：${label} 金额格式错误`);continue}
     if(amount<0){skipped.push(`第${r+1}行：${label} 金额为负，不自动导入`);continue}
     items.push({name:label,kind,category,amount,date});
   }
   if(!items.length)continue;
   best={sheetName,fileName:name,date,items,skipped};break;
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
  parsed.items=parsed.items.map(item=>({...item,exists:state.accounts.some(a=>a.name===item.name&&a.assetSourceCategory===item.category)}));
  assetExcelPending=parsed;
  const rows=parsed.items.map(x=>`<tr><td>${esc(x.category)}</td><td>${esc(x.name)}</td><td>${amt(x.amount)}</td><td>${x.exists?'已存在：跳过':'新建账户'}</td></tr>`).join('');
  area.innerHTML=`<p><b>文件：</b>${esc(file.name)}　<b>工作表：</b>${esc(parsed.sheetName)}　<b>余额日期：</b>${esc(parsed.date)}</p><p>识别 ${parsed.items.length} 项；将新建 ${parsed.items.filter(x=>!x.exists).length} 个账户；已存在 ${parsed.items.filter(x=>x.exists).length} 项将跳过。<b>不会改动现有账户或交易流水。</b></p>${table(['分类','账户','余额','操作'],rows)}${parsed.skipped.length?`<p>跳过 ${parsed.skipped.length} 行：${esc(parsed.skipped.slice(0,6).join('；'))}</p>`:''}<p>注意：“投资”分类按资产账面余额录入，不会自动生成ETF/股票持仓；若原系统已录入相同持仓，可能重复计算，请先核对。</p>`;
  commit.disabled=!parsed.items.some(x=>!x.exists);
 }catch(e){area.textContent='资产Excel解析失败：'+e.message}
}
async function commitAssetExcel(){
 const p=assetExcelPending;if(!p)return;
 const fresh=p.items.filter(x=>!state.accounts.some(a=>a.name===x.name&&a.assetSourceCategory===x.category));
 if(!fresh.length)return alert('没有需要新增的账户');
 if(!confirm(`将根据 ${p.date} 的账目新增 ${fresh.length} 个资产账户。\n不会修改既有账户、交易、持仓，也不会自动合并重名。\n若账目与现有持仓重叠，请取消并核对。\n确认导入？`))return;
 const before=state.accounts.length;
 try{
  const batch=uid();for(const item of fresh){state.accounts.push({id:uid(),name:item.name,institution:'',kind:item.kind,opening:item.kind==='liability'?-item.amount:item.amount,asOf:item.date,assetSourceCategory:item.category,assetImportBatch:batch})}
  state.imports.push({id:batch,type:'asset-excel',fileName:p.fileName,createdAt:now(),sheetName:p.sheetName,asOf:p.date,count:fresh.length,skipped:p.skipped.length});
  await save('asset-excel-import',p.fileName+' '+fresh.length+'项');assetExcelPending=null;alert('已导入 '+fresh.length+' 个账户；请与 Excel 账面净资产核对。');
 }catch(e){state.accounts.splice(before);alert('导入失败：'+e.message+'。请检查数据中心的账户记录。')}
}
