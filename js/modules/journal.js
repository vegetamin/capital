
import {storage,downloadText,csvEscape} from '../storage.js';

export function renderJournal(dc,root){
  const list=()=>dc.state.journals.map((j,i)=>`<div class="entry">
    <b>${j.date} · ${j.action} ${j.asset} · ¥${j.amount}</b>
    <div class="muted">原因：${j.reason||'未写'}</div>
    <div class="muted">风险：${j.risk||'未写'}</div>
    <div class="muted">跌30%预案：${j.plan||'未写'}</div>
    <div class="muted">复盘：${j.review||'未写'}</div>
    <button class="mini-btn danger" data-del="${i}">删除</button>
  </div>`).join('')||'<div class="muted">暂无日志</div>';

  root.innerHTML=`<div class="grid">
    <div class="card s5">
      <h3>新增投资决策</h3>
      <label>日期</label><input id="jDate" type="date">
      <label>品种</label><input id="jAsset" placeholder="例：中证红利ETF">
      <label>操作</label><select id="jAction"><option>买入</option><option>卖出</option><option>观察</option><option>调仓</option></select>
      <label>金额</label><input id="jAmount" type="number">
      <label>为什么现在操作？</label><textarea id="jReason"></textarea>
      <label>最大风险</label><textarea id="jRisk"></textarea>
      <label>如果跌30%，怎么办？</label><textarea id="jPlan"></textarea>
      <label>后续复盘</label><textarea id="jReview"></textarea>
      <button id="jSave" class="primary">保存日志</button>
    </div>
    <div class="card s7">
      <div class="actions" style="justify-content:space-between">
        <h3>投资日志</h3>
        <div>
          <button id="exportJournalCsv">导出CSV</button>
          <button id="exportJournalMd">导出Markdown</button>
        </div>
      </div>
      <div id="journalList">${list()}</div>
    </div>
  </div>`;

  jDate.value=new Date().toISOString().slice(0,10);

  const refresh=()=>{
    journalList.innerHTML=list();
    document.querySelectorAll('[data-del]').forEach(btn=>btn.onclick=()=>{
      const i=+btn.dataset.del;
      if(confirm('确认删除这条投资日志吗？')){
        dc.state.journals.splice(i,1);
        storage.set('journals',dc.state.journals);
        refresh();
      }
    });
  };

  jSave.onclick=()=>{
    if(!jAsset.value.trim())return alert('请填写品种');
    dc.state.journals.unshift({
      date:jDate.value,
      asset:jAsset.value.trim(),
      action:jAction.value,
      amount:+jAmount.value||0,
      reason:jReason.value.trim(),
      risk:jRisk.value.trim(),
      plan:jPlan.value.trim(),
      review:jReview.value.trim(),
      createdAt:new Date().toISOString()
    });
    storage.set('journals',dc.state.journals);
    refresh();
  };

  exportJournalCsv.onclick=()=>{
    const headers=['日期','品种','操作','金额','原因','风险','跌30%预案','复盘'];
    const rows=dc.state.journals.map(j=>[j.date,j.asset,j.action,j.amount,j.reason,j.risk,j.plan,j.review].map(csvEscape).join(','));
    downloadText(`投资日志_${new Date().toISOString().slice(0,10)}.csv`,'\\uFEFF'+[headers.join(','),...rows].join('\\r\\n'),'text/csv;charset=utf-8');
  };
  exportJournalMd.onclick=()=>{
    const md=['# 投资日志','',...dc.state.journals.flatMap(j=>[
      `## ${j.date} · ${j.action} ${j.asset}`,
      `- 金额：¥${j.amount}`,
      `- 原因：${j.reason||'未写'}`,
      `- 风险：${j.risk||'未写'}`,
      `- 跌30%预案：${j.plan||'未写'}`,
      `- 复盘：${j.review||'未写'}`,
      ''
    ])].join('\\n');
    downloadText(`投资日志_${new Date().toISOString().slice(0,10)}.md`,md,'text/markdown;charset=utf-8');
  };
}
