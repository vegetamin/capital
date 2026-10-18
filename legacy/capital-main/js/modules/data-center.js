
import {storage,downloadText} from '../storage.js';

const groups=[
  {id:'asset220',name:'V2.2资产模型与快照',keys:['lcos_asset_model_v220','lcos_asset_original_v220','lcos_asset_snapshots_v220']},
  {id:'draft',name:'资产草稿与撤销历史',keys:['lcos_asset_draft_v2','lcos_asset_history_v2']},
  {id:'excel',name:'资产Excel缓存',keys:['lcos_asset_workbook_b64','lcos_asset_workbook_name']},
  {id:'snapshots',name:'资产快照缓存',keys:['lcos_asset_snapshots_v1']},
  {id:'ledger',name:'钱迹账本缓存',keys:['lcos_v3_ledger']},
  {id:'journals',name:'投资日志',keys:['lcos_v3_journals']},
  {id:'reviews',name:'周期复盘',keys:['lcos_v3_reviews']},
  {id:'research',name:'企业分析',keys:['lcos_v3_research']},
  {id:'reading',name:'投资阅读',keys:['lcos_v3_reading']},
  {id:'assets',name:'资产摘要',keys:['lcos_v3_assets']}
];

function sizeOf(keys){
  return keys.reduce((a,k)=>a+(localStorage.getItem(k)?.length||0),0);
}
function fmtSize(n){
  if(n<1024)return n+' B';
  if(n<1024*1024)return (n/1024).toFixed(1)+' KB';
  return (n/1024/1024).toFixed(2)+' MB';
}

export function renderDataCenter(dc,root){
  const total=groups.reduce((a,g)=>a+sizeOf(g.keys),0);
  root.innerHTML=`<div class="grid">
    <div class="card kpi"><div class="label">本地数据占用</div><div class="value">${fmtSize(total)}</div></div>
    <div class="card kpi"><div class="label">投资日志</div><div class="value">${dc.state.journals.length}</div></div>
    <div class="card kpi"><div class="label">周期复盘</div><div class="value">${dc.state.reviews.length}</div></div>
    <div class="card kpi"><div class="label">学习记录</div><div class="value">${dc.state.research.length+dc.state.reading.length}</div></div>

    <div class="card s7">
      <h3>数据管理</h3>
      ${groups.map(g=>`<label class="cache-row"><input type="checkbox" value="${g.id}"> <span>${g.name}</span><b>${fmtSize(sizeOf(g.keys))}</b></label>`).join('')}
      <div class="actions" style="margin-top:14px">
        <button id="clearSelected" class="danger-btn">清除所选</button>
        <button id="clearTemp">仅清除临时缓存</button>
      </div>
      <p class="muted">删除资产、日志、复盘和学习记录后不可恢复。建议先导出完整备份。</p>
    </div>

    <div class="card s5">
      <h3>备份与恢复</h3>
      <button id="backupAll" class="primary">导出完整备份</button>
      <label class="file-btn" style="margin-top:10px">恢复完整备份<input id="restoreAll" type="file" accept=".json" hidden></label>
      <button id="factoryReset" class="danger-btn" style="margin-top:18px">恢复出厂设置</button>
      <p class="muted">恢复出厂设置会删除所有 Life Capital OS 本地数据，但不会删除你已经下载到电脑的 Excel、CSV 或备份文件。</p>
    </div>
  </div>`;

  clearSelected.onclick=()=>{
    const ids=[...document.querySelectorAll('.cache-row input:checked')].map(x=>x.value);
    if(!ids.length)return alert('请先选择要清除的内容');
    if(!confirm('确认清除所选数据吗？此操作不可恢复。'))return;
    groups.filter(g=>ids.includes(g.id)).forEach(g=>g.keys.forEach(k=>localStorage.removeItem(k)));
    location.reload();
  };
  clearTemp.onclick=()=>{
    if(!confirm('确认清除资产草稿、撤销历史和Excel临时缓存吗？'))return;
    groups.filter(g=>['draft','excel'].includes(g.id)).forEach(g=>g.keys.forEach(k=>localStorage.removeItem(k)));
    location.reload();
  };
  backupAll.onclick=()=>storage.exportAll(dc.state);
  restoreAll.onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const rd=new FileReader();
    rd.onload=()=>{
      try{
        const b=JSON.parse(rd.result);
        for(const key of ['ledger','assets','journals','reviews','research','reading']){
          if(b[key]!==undefined)storage.set(key,b[key]);
        }
        alert('备份已恢复，页面即将刷新。');
        location.reload();
      }catch{alert('备份文件无效')}
    };
    rd.readAsText(f,'UTF-8');
  };
  factoryReset.onclick=()=>{
    if(!confirm('确认恢复出厂设置？所有本地数据将被删除。'))return;
    Object.keys(localStorage).filter(k=>k.startsWith('lcos_')).forEach(k=>localStorage.removeItem(k));
    location.reload();
  };
}
