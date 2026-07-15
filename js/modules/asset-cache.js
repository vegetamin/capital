const CACHE_KEY='lcos_asset_snapshots_v220';
const MODEL_KEY='lcos_asset_model_v220';
const fmt=n=>'¥'+Number(n||0).toLocaleString('zh-CN',{maximumFractionDigits:2});

function b64ToBlob(b64){
  const bin=atob(b64),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function download(item){
  if(!item?.workbookB64)return alert('该记录没有可导出的Excel数据');
  const url=URL.createObjectURL(b64ToBlob(item.workbookB64));
  const a=document.createElement('a');a.href=url;a.download=item.fileName||`账目_${item.date}.xlsx`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function renderAssetCache(dc,root){
  const draw=()=>{
    const list=JSON.parse(localStorage.getItem(CACHE_KEY)||'[]');
    root.innerHTML=`<div class="grid"><div class="card s12">
      <h3>资产缓存</h3>
      <p class="muted">每条记录都包含完整资产模型和可下载的xlsx文件。</p>
      ${list.length?`<table><thead><tr><th>日期</th><th>实际资产</th><th>投资</th><th>现金</th><th>文件</th><th>操作</th></tr></thead>
      <tbody>${list.map(x=>`<tr><td>${x.date}</td><td>${fmt(x.summary?.netWorth)}</td><td>${fmt(x.summary?.investment)}</td><td>${fmt(x.summary?.cash)}</td><td>${x.fileName}</td><td>
        <button data-download="${x.id}">导出Excel</button>
        <button data-restore="${x.id}">恢复到资产配置</button>
        <button data-delete="${x.id}">删除</button>
      </td></tr>`).join('')}</tbody></table>`:'<div class="notice">暂无缓存。请先在资产配置页提交一个快照。</div>'}
    </div></div>`;

    document.querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>download(list.find(x=>x.id===+b.dataset.download)));
    document.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{
      const item=list.find(x=>x.id===+b.dataset.restore);
      if(!item?.model)return alert('该记录没有可恢复的资产模型');
      localStorage.setItem(MODEL_KEY,JSON.stringify(item.model));
      alert('已恢复。请进入“资产配置”页查看。');
    });
    document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{
      const next=list.filter(x=>x.id!==+b.dataset.delete);
      localStorage.setItem(CACHE_KEY,JSON.stringify(next));draw();
    });
  };
  draw();
}
