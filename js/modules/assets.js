import {storage} from '../storage.js';

const MODEL_KEY='lcos_asset_model_v220';
const ORIGINAL_KEY='lcos_asset_original_v220';
const CACHE_KEY='lcos_asset_snapshots_v220';
const fmt=n=>'¥'+Number(n||0).toLocaleString('zh-CN',{maximumFractionDigits:2});
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const today=()=>new Date().toISOString().slice(0,10);

let model=null;
let sourceWorkbook=null;
let sourceFileName='账目.xlsx';

const coreRole={
  '灵活取用':'liquid',
  '定期':'safe',
  '投资':'risk',
  '债权':'receivable',
  '负债':'liability'
};
const roleLabel={
  liquid:'流动资产',
  safe:'低风险资产',
  risk:'风险资产',
  receivable:'债权资产',
  liability:'负债',
  asset:'其他资产',
  info:'信息类'
};

function abToB64(buffer){
  const bytes=new Uint8Array(buffer);let binary='';
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
}
function b64ToArray(b64){
  const bin=atob(b64),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return bytes.buffer;
}
function safeText(v){
  if(v===null||v===undefined)return '';
  if(v instanceof Date)return '';
  const s=String(v).trim();
  if(/^1899-12-3[01]T/.test(s))return '';
  if(s==='Invalid Date'||s==='NaN')return '';
  return s;
}
function excelDate(v){
  if(v instanceof Date&&!Number.isNaN(v.getTime()))return v.toISOString().slice(0,10);
  if(typeof v==='number'&&v>20000&&v<90000){
    const d=new Date(Date.UTC(1899,11,30)+v*86400000);
    return d.toISOString().slice(0,10);
  }
  const s=safeText(v);
  if(/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(s))return s.replaceAll('/','-');
  const d=new Date(s);
  return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);
}
function validateModel(m){
  const errors=[];
  if(!m||!Array.isArray(m.categories))errors.push('资产模型不存在');
  for(const c of m?.categories||[]){
    if(!safeText(c.name))errors.push('存在未命名分类');
    if(!roleLabel[c.role])errors.push(`分类“${c.name}”属性无效`);
    for(const i of c.items||[]){
      if(!safeText(i.name))errors.push(`分类“${c.name}”存在未命名项目`);
      if(!Number.isFinite(Number(i.value)))errors.push(`项目“${i.name}”金额无效`);
      if(/^1899-12-3[01]T/.test(String(i.name)))errors.push(`项目“${i.name}”疑似异常日期`);
    }
  }
  return errors;
}
function recompute(m){
  for(const c of m.categories)c.total=(c.items||[]).reduce((a,i)=>a+num(i.value),0);
  const positive=m.categories.filter(c=>!['liability','info'].includes(c.role)).reduce((a,c)=>a+c.total,0);
  const liabilities=m.categories.filter(c=>c.role==='liability').reduce((a,c)=>a+c.total,0);
  m.summary={
    ownerEquity:positive,
    liabilities,
    netWorth:positive-liabilities,
    investment:m.categories.filter(c=>c.role==='risk').reduce((a,c)=>a+c.total,0),
    cash:m.categories.filter(c=>c.role==='liquid').reduce((a,c)=>a+c.total,0)
  };
  return m;
}
function parseWorkbook(buffer,name){
  const wb=XLSX.read(buffer,{type:'array',cellDates:false,cellStyles:false,cellFormula:false});
  const sheetName=wb.SheetNames.find(n=>n.includes('个人财产'))||wb.SheetNames[0];
  const ws=wb.Sheets[sheetName];
  const matrix=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
  const first=matrix[0]||[];
  let lastCol=1;
  for(let c=1;c<first.length;c++)if(excelDate(first[c]))lastCol=c;

  const categories=[];
  let current=null;
  for(let r=1;r<matrix.length;r++){
    const label=safeText(matrix[r]?.[0]);
    if(!label)continue;
    if(label==='汇总')break;
    if(coreRole[label]){
      current={id:crypto.randomUUID(),name:label,role:coreRole[label],core:true,items:[]};
      categories.push(current);
      continue;
    }
    if(label==='占比')continue;
    if(['所有者权益','欠款总额','实际资产','资产净值变化','周期','理论资产'].includes(label))continue;
    if(!current)continue;
    current.items.push({
      id:crypto.randomUUID(),
      name:label,
      note:'',
      value:num(matrix[r]?.[lastCol])
    });
  }

  const m={
    schemaVersion:'2.2.0',
    sourceName:name,
    sourceSheet:sheetName,
    previousDate:excelDate(first[lastCol])||'',
    snapshotDate:today(),
    categories,
    summary:{}
  };
  recompute(m);
  return {wb,m};
}
function persistModel(){
  recompute(model);
  localStorage.setItem(MODEL_KEY,JSON.stringify(model));
}
function restoreModel(){
  try{
    const m=JSON.parse(localStorage.getItem(MODEL_KEY)||'null');
    if(m?.schemaVersion==='2.2.0'){
      model=m;
      recompute(model);
      return true;
    }
  }catch{}
  return false;
}
function modelToWorkbook(m){
  recompute(m);
  const wb=XLSX.utils.book_new();
  const aoa=[['日期',m.previousDate||'',m.snapshotDate||today()]];
  for(const c of m.categories){
    aoa.push([c.name,c.total,c.total]);
    const ratio=m.summary.ownerEquity?c.total/m.summary.ownerEquity:0;
    aoa.push(['占比',ratio,ratio]);
    for(const i of c.items)aoa.push([safeText(i.name),num(i.value),num(i.value)]);
    aoa.push(['','','']);
  }
  aoa.push(['汇总','','']);
  aoa.push(['所有者权益',m.summary.ownerEquity,m.summary.ownerEquity]);
  aoa.push(['欠款总额',m.summary.liabilities,m.summary.liabilities]);
  aoa.push(['实际资产',m.summary.netWorth,m.summary.netWorth]);
  aoa.push(['资产净值变化','',m.summary.netWorth]);
  aoa.push(['周期','',0]);
  aoa.push(['理论资产',m.summary.netWorth,m.summary.netWorth]);

  const ws=XLSX.utils.aoa_to_sheet(aoa,{cellDates:false});
  ws['!cols']=[{wch:24},{wch:16},{wch:16}];
  for(let r=0;r<aoa.length;r++){
    if(aoa[r][0]==='占比'){
      for(const c of [1,2]){
        const addr=XLSX.utils.encode_cell({r,c});
        if(ws[addr])ws[addr].z='0.00%';
      }
    }
  }
  XLSX.utils.book_append_sheet(wb,ws,'个人财产');
  return wb;
}
function workbookBytes(m){
  const wb=modelToWorkbook(m);
  return XLSX.write(wb,{bookType:'xlsx',type:'array',compression:true});
}
function downloadBytes(bytes,fileName){
  const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function snapshotItem(m,bytes){
  return {
    id:Date.now(),
    date:m.snapshotDate,
    fileName:`账目_${m.snapshotDate}.xlsx`,
    createdAt:new Date().toISOString(),
    summary:{...m.summary},
    model:JSON.parse(JSON.stringify(m)),
    workbookB64:abToB64(bytes)
  };
}
function saveSnapshot(dc,download){
  syncInputs();
  recompute(model);
  const errors=validateModel(model);
  if(errors.length){
    alert('无法保存：\n'+errors.join('\n'));
    return false;
  }
  const bytes=workbookBytes(model);
  const list=JSON.parse(localStorage.getItem(CACHE_KEY)||'[]');
  const item=snapshotItem(model,bytes);
  list.unshift(item);while(list.length>30)list.pop();
  localStorage.setItem(CACHE_KEY,JSON.stringify(list));
  persistModel();

  dc.state.assets={
    ...dc.state.assets,
    cash:model.summary.cash,
    fixed:model.categories.filter(c=>c.role==='safe').reduce((a,c)=>a+c.total,0),
    investmentTotal:model.summary.investment,
    receivables:model.categories.filter(c=>c.role==='receivable').reduce((a,c)=>a+c.total,0),
    liabilities:model.summary.liabilities,
    ownerEquity:model.summary.ownerEquity,
    netWorth:model.summary.netWorth,
    latestDate:model.snapshotDate,
    categories:Object.fromEntries(model.categories.map(c=>[c.name,{role:c.role,value:c.total}]))
  };
  storage.set('assets',dc.state.assets);
  dc.invalidate();

  if(download)downloadBytes(bytes,item.fileName);
  return true;
}
function syncInputs(){
  document.querySelectorAll('[data-category-name]').forEach(el=>{
    const c=model.categories.find(x=>x.id===el.dataset.categoryName);
    if(c)c.name=safeText(el.value)||'未命名分类';
  });
  document.querySelectorAll('[data-item-name]').forEach(el=>{
    const i=findItem(el.dataset.itemName);
    if(i)i.name=safeText(el.value)||'未命名项目';
  });
  document.querySelectorAll('[data-item-value]').forEach(el=>{
    const i=findItem(el.dataset.itemValue);
    if(i)i.value=num(el.value);
  });
  document.querySelectorAll('[data-item-note]').forEach(el=>{
    const i=findItem(el.dataset.itemNote);
    if(i)i.note=safeText(el.value);
  });
  const d=document.getElementById('snapshotDate');
  if(d)model.snapshotDate=d.value||today();
  recompute(model);
}
function findItem(id){
  for(const c of model.categories){
    const i=c.items.find(x=>x.id===id);
    if(i)return i;
  }
  return null;
}
function renderTable(){
  recompute(model);
  const rows=model.categories.map(c=>`
    <tr class="asset-section">
      <td><input class="section-name-input" data-category-name="${c.id}" value="${c.name}"></td>
      <td><span class="pill">${roleLabel[c.role]}</span></td>
      <td class="right">${fmt(c.total)}</td>
      <td><button class="mini-btn" data-add-item="${c.id}">＋项目</button></td>
      <td>${c.core?'<span class="muted">核心分类</span>':`<button class="mini-btn danger" data-del-category="${c.id}">删除分类</button>`}</td>
    </tr>
    ${c.items.map(i=>`<tr>
      <td><input data-item-name="${i.id}" value="${safeText(i.name)}"></td>
      <td><input data-item-note="${i.id}" value="${safeText(i.note)}" placeholder="备注（可选）"></td>
      <td><input data-item-value="${i.id}" type="number" step="0.01" value="${num(i.value)}"></td>
      <td colspan="2"><button class="mini-btn danger" data-del-item="${i.id}">删除项目</button></td>
    </tr>`).join('')}
    <tr class="asset-computed"><td>占比</td><td colspan="2">${model.summary.ownerEquity?(c.total/model.summary.ownerEquity*100).toFixed(2):'0.00'}%</td><td colspan="2"></td></tr>
  `).join('');

  return `<div class="form-grid">
    <div><label>上一期日期</label><input value="${model.previousDate||'—'}" disabled></div>
    <div><label>新一期日期</label><input id="snapshotDate" type="date" value="${model.snapshotDate||today()}"></div>
  </div>
  <div class="category-manager">
    <div><label>新增分类名称</label><input id="newCategoryName" placeholder="例如：保险现金价值"></div>
    <div><label>分类属性</label><select id="newCategoryRole">
      <option value="asset">其他资产</option><option value="liquid">流动资产</option>
      <option value="safe">低风险资产</option><option value="risk">风险资产</option>
      <option value="receivable">债权资产</option><option value="liability">负债</option>
      <option value="info">信息类（不计入净资产）</option>
    </select></div>
    <div class="category-add-action"><button id="addCategory" class="primary">＋ 新增分类</button></div>
  </div>
  <div class="table-scroll"><table class="asset-entry-table">
    <thead><tr><th>分类 / 项目</th><th>属性 / 备注</th><th>金额</th><th colspan="2">操作</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <div class="notice" id="snapshotSummary">所有者权益 <b>${fmt(model.summary.ownerEquity)}</b>；实际资产 <b>${fmt(model.summary.netWorth)}</b>；风险资产占比 <b>${model.summary.ownerEquity?(model.summary.investment/model.summary.ownerEquity*100).toFixed(1):0}%</b>；负债 <b>${fmt(model.summary.liabilities)}</b>。</div>`;
}

export function renderAssets(dc,root){
  root.innerHTML=`<div class="grid">
    <div class="card s12">
      <h3>第一步：选择资产账目</h3>
      <p class="muted">原始Excel只用于导入。网页编辑的是独立资产模型，导出时临时生成全新的xlsx，不会污染原文件。</p>
      <div class="actions">
        <a class="file-btn" href="./templates/资产账目空白模板.xlsx" download>下载空白资产模板</a>
        <label class="file-btn">导入账目Excel<input id="assetWorkbookInput" type="file" accept=".xls,.xlsx" hidden></label>
        <button id="restoreModel">读取本地资产模型</button>
        <button id="clearAssetDraft">清除资产模型</button>
        <span id="excelStatus" class="muted"></span>
      </div>
    </div>
    <div id="assetEntry" class="card s7"><h3>资产录入</h3><div class="muted">请先导入账目或读取本地资产模型。</div></div>
    <div class="card s5">
      <h3>财富架构建议</h3>
      <div id="architectureAdvice" class="notice">载入资产数据后生成。</div>
      <div id="autosaveStatus" class="muted" style="margin:10px 0">自动保存：等待载入数据</div>
      <button id="saveAssetCache" class="primary block-action" disabled>提交并保存到缓存</button>
      <button id="exportAssetWorkbook" class="secondary-action block-action" disabled>保存并导出Excel</button>
      <p class="muted">两项操作都会生成完整xlsx缓存；后者额外立即下载文件。</p>
    </div>
  </div>`;

  const redraw=()=>{
    if(!model)return;
    document.getElementById('assetEntry').innerHTML=`<h3>第二步：维护分类、项目和新一期数据</h3>${renderTable()}`;
    document.getElementById('saveAssetCache').disabled=false;
    document.getElementById('exportAssetWorkbook').disabled=false;
    document.getElementById('architectureAdvice').innerHTML=`当前分类数：<b>${model.categories.length}</b><br>当前净资产：<b>${fmt(model.summary.netWorth)}</b><br><br>导出文件统一为xlsx，且不会反向覆盖页面模型。`;

    let timer;
    document.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{syncInputs();persistModel();document.getElementById('autosaveStatus').textContent='自动保存：'+new Date().toLocaleTimeString('zh-CN');redraw();},450);
    }));
    document.querySelectorAll('[data-add-item]').forEach(b=>b.onclick=()=>{
      syncInputs();
      const c=model.categories.find(x=>x.id===b.dataset.addItem);
      c.items.push({id:crypto.randomUUID(),name:'新项目',note:'',value:0});
      persistModel();redraw();
    });
    document.querySelectorAll('[data-del-item]').forEach(b=>b.onclick=()=>{
      syncInputs();
      for(const c of model.categories)c.items=c.items.filter(i=>i.id!==b.dataset.delItem);
      persistModel();redraw();
    });
    document.querySelectorAll('[data-del-category]').forEach(b=>b.onclick=()=>{
      if(!confirm('确认删除该分类及全部项目吗？'))return;
      model.categories=model.categories.filter(c=>c.id!==b.dataset.delCategory);
      persistModel();redraw();
    });
    document.getElementById('addCategory').onclick=()=>{
      syncInputs();
      const name=safeText(document.getElementById('newCategoryName').value);
      if(!name)return alert('请填写分类名称');
      model.categories.push({id:crypto.randomUUID(),name,role:document.getElementById('newCategoryRole').value,core:false,items:[{id:crypto.randomUUID(),name:'账户1',note:'',value:0},{id:crypto.randomUUID(),name:'账户2',note:'',value:0}]});
      persistModel();redraw();
    };
  };

  document.getElementById('assetWorkbookInput').onchange=async e=>{
    const f=e.target.files[0];if(!f)return;
    try{
      const buffer=await f.arrayBuffer();
      const parsed=parseWorkbook(buffer,f.name);
      sourceWorkbook=parsed.wb;model=parsed.m;sourceFileName=f.name;
      localStorage.setItem(ORIGINAL_KEY,abToB64(buffer));
      persistModel();
      document.getElementById('excelStatus').textContent=`已导入：${f.name}`;
      redraw();
    }catch(error){
      console.error(error);alert('导入失败：'+(error?.message||error));
    }
  };
  document.getElementById('restoreModel').onclick=()=>{
    if(!restoreModel())return alert('没有可读取的本地资产模型');
    document.getElementById('excelStatus').textContent=`已读取本地资产模型：${model.sourceName||''}`;
    redraw();
  };
  document.getElementById('clearAssetDraft').onclick=()=>{
    if(!confirm('仅清除资产模型，不影响投资日志、复盘和消费数据。确认吗？'))return;
    localStorage.removeItem(MODEL_KEY);model=null;
    document.getElementById('assetEntry').innerHTML='<h3>资产录入</h3><div class="muted">资产模型已清除，请重新导入原始账目。</div>';
    document.getElementById('saveAssetCache').disabled=true;
    document.getElementById('exportAssetWorkbook').disabled=true;
  };
  document.getElementById('saveAssetCache').onclick=()=>{
    if(saveSnapshot(dc,false)){document.getElementById('autosaveStatus').textContent='已保存到缓存：'+new Date().toLocaleTimeString('zh-CN');redraw();}
  };
  document.getElementById('exportAssetWorkbook').onclick=()=>{
    if(saveSnapshot(dc,true)){document.getElementById('autosaveStatus').textContent='已保存并导出：'+new Date().toLocaleTimeString('zh-CN');redraw();}
  };

  if(restoreModel()){
    document.getElementById('excelStatus').textContent=`已读取本地资产模型：${model.sourceName||''}`;
    redraw();
  }
}
