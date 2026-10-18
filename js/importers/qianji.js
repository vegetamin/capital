function csvRows(input){const text=input.replace(/^\uFEFF/,'');const rows=[];let row=[],v='',quote=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quote&&text[i+1]==='"'){v+='"';i++}else quote=!quote}else if(ch===','&&!quote){row.push(v);v=''}else if((ch==='\r'||ch==='\n')&&!quote){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(v);if(row.some(x=>x.trim()))rows.push(row);row=[];v=''}else v+=ch}if(quote)throw Error('CSV 存在未闭合的引号');row.push(v);if(row.some(x=>x.trim()))rows.push(row);return rows}
function normalizeDate(x){let v=String(x||'').trim().replace(/\//g,'-').replace(/\./g,'-');const m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(!m)throw Error('日期格式无法识别：'+v);const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);let dt=new Date(y,mo-1,d);if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==d)throw Error('日期无效：'+v);return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function fingerprint(x){return [x.date,x.type,x.category,x.subcategory,x.amount,x.account,x.note].join('\u001f')}
async function readQianjiRows(file){
  const lower=file.name.toLowerCase();
  if(/\.(xlsx|xls)$/.test(lower)){
    if(!globalThis.XLSX)throw Error('Excel 解析组件尚未加载。请检查网络连接并刷新页面后重试。');
    const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
    if(!workbook.SheetNames.length)throw Error('Excel 中没有工作表');
    const sheets=workbook.SheetNames.map(name=>XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,defval:'',raw:false,blankrows:false}));
    const candidate=sheets.find(rows=>rows.some(row=>Array.isArray(row)&&['时间','分类','类型','金额'].every(k=>row.some(v=>String(v).trim()===k))));
    if(!candidate)throw Error('Excel 中未找到钱迹账单表头（时间、分类、类型、金额）。请检查导出文件格式。');
    return candidate;
  }
  if(/\.csv$/.test(lower)){
    const buffer=await file.arrayBuffer();
    let content=new TextDecoder('utf-8',{fatal:false}).decode(buffer);
    if(content.includes('\uFFFD')){try{content=new TextDecoder('gb18030').decode(buffer)}catch{}}
    return csvRows(content);
  }
  throw Error('只支持 .xlsx、.xls、.csv 钱迹账本，请选择原始导出文件');
}
async function previewCSV(e){preview=null;$('csvCommit').disabled=true;const file=e.target.files?.[0];if(!file)return;try{
  const rows=await readQianjiRows(file);if(!rows.length)throw Error('空文件');
  const headerAt=rows.findIndex(row=>Array.isArray(row)&&['时间','分类','类型','金额'].every(k=>row.some(v=>String(v).trim()===k)));
  if(headerAt<0)throw Error('缺少钱迹表头：时间、分类、类型、金额');
  const header=rows[headerAt].map(x=>String(x??'').trim());const idx=n=>header.indexOf(n);
  const valid=[],ignored=[];
  for(let i=headerAt+1;i<rows.length;i++){
    const r=rows[i],read=n=>idx(n)<0?'':String(r[idx(n)]??'').trim();
    if(!r||!r.some(v=>String(v??'').trim()))continue;
    try{
      const type=read('类型');if(type!=='收入'&&type!=='支出'){ignored.push({line:i+1,reason:'非收入/支出类型：'+type});continue}
      const amount=cents(read('金额'));if(amount<=0)throw Error('金额须大于0');
      const x={date:normalizeDate(read('时间')),type:type==='收入'?'income':'expense',category:read('分类')||'未分类',subcategory:read('二级分类'),amount,account:read('账户1'),note:read('备注')};
      x.fingerprint=fingerprint(x);valid.push(x);
    }catch(ex){ignored.push({line:i+1,reason:ex.message})}
  }
  const existing=new Set(state.transactions.map(t=>t.importFingerprint).filter(Boolean));const seen=new Set();
  const newRows=valid.filter(x=>{if(existing.has(x.fingerprint)||seen.has(x.fingerprint))return false;seen.add(x.fingerprint);return true});
  preview={fileName:file.name,valid:newRows,ignored,duplicate:valid.length-newRows.length};
  $('csvPreview').innerHTML=`可导入 <b>${newRows.length}</b> 笔；重复 <b>${preview.duplicate}</b> 笔；不支持/无效 <b>${ignored.length}</b> 笔。${ignored.length?'前5条：'+esc(ignored.slice(0,5).map(i=>i.line+'行 '+i.reason).join('；')):''}<br>该账单只进入消费和收入统计，不会改变任何资产账户余额。`;
  $('csvCommit').disabled=!newRows.length;
}catch(ex){$('csvPreview').textContent='解析失败：'+ex.message}}
async function commitCSV(){
 if(!preview||!preview.valid.length)return;
 if(!confirm(`将导入 ${preview.valid.length} 笔钱迹收支明细，仅用于消费和收入分析。不会修改任何银行或现金账户余额。确认？`))return;
 const batch=uid();
 const items=preview.valid.map(x=>({id:uid(),createdAt:now(),status:'posted',type:x.type,date:x.date,accountId:null,sourceAccountName:x.account||'',category:x.category,subcategory:x.subcategory,description:x.note,source:'钱迹账本',qianjiImported:true,importAmountCents:x.amount,importFingerprint:x.fingerprint,importBatch:batch,entries:[]}));
 state.transactions.push(...items);
 state.imports.push({id:batch,fileName:preview.fileName,createdAt:now(),count:items.length,ignored:preview.ignored.length,duplicate:preview.duplicate,mode:'analytics-only'});
 preview=null;await save('qianji-import',batch+' '+items.length+'笔（不影响账户余额）');alert('导入完成：已添加消费/收入记录，不会改变资产账户余额。');
}
