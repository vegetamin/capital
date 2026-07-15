
import {storage,downloadText,csvEscape} from '../storage.js';

export function renderReview(dc,root){
  const label={weekly:'每周',monthly:'每月',quarterly:'每季度'};
  const list=()=>dc.state.reviews.map((r,i)=>`<div class="entry">
    <b>${label[r.frequency]||r.frequency} · ${r.period}</b>
    <div>做得好：${r.good||'—'}</div>
    <div>需纠正：${r.bad||'—'}</div>
    <div>现金流：${r.cashflow||'—'}</div>
    <div>资产配置：${r.allocation||'—'}</div>
    <div>下周期三件事：${r.next||'—'}</div>
    <button class="mini-btn danger" data-del="${i}">删除</button>
  </div>`).join('')||'<div class="muted">暂无复盘</div>';

  root.innerHTML=`<div class="grid">
    <div class="card s6">
      <h3>新增周期复盘</h3>
      <div class="form-grid">
        <div><label>复盘频率</label><select id="rFrequency"><option value="weekly">每周</option><option value="monthly" selected>每月</option><option value="quarterly">每季度</option></select></div>
        <div><label>周期标识</label><input id="rPeriod" placeholder="例：2026-W29 / 2026-07 / 2026-Q3"></div>
      </div>
      <label>本周期最好的财务决定</label><textarea id="rGood"></textarea>
      <label>最需要纠正的一件事</label><textarea id="rBad"></textarea>
      <label>现金流情况</label><textarea id="rCashflow"></textarea>
      <label>资产配置变化</label><textarea id="rAllocation"></textarea>
      <label>下一周期只做哪三件事</label><textarea id="rNext"></textarea>
      <button id="rSave" class="primary">保存复盘</button>
    </div>
    <div class="card s6">
      <div class="actions" style="justify-content:space-between">
        <h3>历史复盘</h3>
        <div><button id="exportReviewCsv">导出CSV</button><button id="exportReviewMd">导出Markdown</button></div>
      </div>
      <div id="reviewList">${list()}</div>
    </div>
  </div>`;

  const defaultPeriod=()=> {
    const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0');
    if(rFrequency.value==='monthly')return `${y}-${m}`;
    if(rFrequency.value==='quarterly')return `${y}-Q${Math.floor(d.getMonth()/3)+1}`;
    const start=new Date(y,0,1),week=Math.ceil((((d-start)/86400000)+start.getDay()+1)/7);
    return `${y}-W${String(week).padStart(2,'0')}`;
  };
  rPeriod.value=defaultPeriod();
  rFrequency.onchange=()=>rPeriod.value=defaultPeriod();

  const refresh=()=>{
    reviewList.innerHTML=list();
    document.querySelectorAll('[data-del]').forEach(btn=>btn.onclick=()=>{
      const i=+btn.dataset.del;
      if(confirm('确认删除这条复盘吗？')){
        dc.state.reviews.splice(i,1);storage.set('reviews',dc.state.reviews);refresh();
      }
    });
  };

  rSave.onclick=()=>{
    dc.state.reviews.unshift({
      frequency:rFrequency.value,
      period:rPeriod.value.trim()||defaultPeriod(),
      good:rGood.value.trim(),
      bad:rBad.value.trim(),
      cashflow:rCashflow.value.trim(),
      allocation:rAllocation.value.trim(),
      next:rNext.value.trim(),
      createdAt:new Date().toISOString()
    });
    storage.set('reviews',dc.state.reviews);refresh();
  };

  exportReviewCsv.onclick=()=>{
    const headers=['频率','周期','做得好','需纠正','现金流','资产配置','下一周期'];
    const rows=dc.state.reviews.map(r=>[label[r.frequency]||r.frequency,r.period,r.good,r.bad,r.cashflow,r.allocation,r.next].map(csvEscape).join(','));
    downloadText(`周期复盘_${new Date().toISOString().slice(0,10)}.csv`,'\\uFEFF'+[headers.join(','),...rows].join('\\r\\n'),'text/csv;charset=utf-8');
  };
  exportReviewMd.onclick=()=>{
    const md=['# 周期复盘','',...dc.state.reviews.flatMap(r=>[
      `## ${label[r.frequency]||r.frequency} · ${r.period}`,
      `- 做得好：${r.good||'—'}`,
      `- 需纠正：${r.bad||'—'}`,
      `- 现金流：${r.cashflow||'—'}`,
      `- 资产配置：${r.allocation||'—'}`,
      `- 下一周期：${r.next||'—'}`,
      ''
    ])].join('\\n');
    downloadText(`周期复盘_${new Date().toISOString().slice(0,10)}.md`,md,'text/markdown;charset=utf-8');
  };
}
