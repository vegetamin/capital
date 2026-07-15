
import {storage,downloadText} from '../storage.js';

export function renderResearch(dc,root){
  const list=()=>dc.state.research.map((r,i)=>`<div class="entry">
    <b>${r.company} · ${r.date}</b>
    <div class="muted">行业：${r.industry||'—'} · 结论：${r.conclusion||'—'}</div>
    <div>商业模式：${r.business||'—'}</div>
    <div>竞争优势：${r.moat||'—'}</div>
    <div>主要风险：${r.risk||'—'}</div>
    <div>估值判断：${r.valuation||'—'}</div>
    <button class="mini-btn danger" data-del="${i}">删除</button>
  </div>`).join('')||'<div class="muted">暂无企业分析</div>';

  root.innerHTML=`<div class="grid">
    <div class="card s6">
      <h3>企业分析模板</h3>
      <div class="form-grid">
        <div><label>公司名称</label><input id="cCompany"></div>
        <div><label>日期</label><input id="cDate" type="date"></div>
        <div><label>行业</label><input id="cIndustry"></div>
        <div><label>结论</label><select id="cConclusion"><option>继续观察</option><option>值得深入研究</option><option>暂不投资</option><option>进入候选池</option></select></div>
      </div>
      <label>它赚谁的钱？商业模式是什么？</label><textarea id="cBusiness"></textarea>
      <label>为什么别人难以替代？竞争优势是什么？</label><textarea id="cMoat"></textarea>
      <label>财务质量：收入、利润、现金流、负债</label><textarea id="cFinancial"></textarea>
      <label>最主要的风险</label><textarea id="cRisk"></textarea>
      <label>估值与安全边际</label><textarea id="cValuation"></textarea>
      <label>如果市场关闭5年，我愿意持有吗？为什么？</label><textarea id="cFiveYear"></textarea>
      <button id="cSave" class="primary">保存分析</button>
    </div>
    <div class="card s6">
      <div class="actions" style="justify-content:space-between"><h3>分析记录</h3><button id="exportResearch">导出Markdown</button></div>
      <div id="researchList">${list()}</div>
    </div>
  </div>`;

  cDate.value=new Date().toISOString().slice(0,10);
  const refresh=()=>{
    researchList.innerHTML=list();
    document.querySelectorAll('[data-del]').forEach(btn=>btn.onclick=()=>{
      const i=+btn.dataset.del;
      if(confirm('确认删除这份企业分析吗？')){
        dc.state.research.splice(i,1);storage.set('research',dc.state.research);refresh();
      }
    });
  };
  cSave.onclick=()=>{
    if(!cCompany.value.trim())return alert('请填写公司名称');
    dc.state.research.unshift({
      company:cCompany.value.trim(),date:cDate.value,industry:cIndustry.value.trim(),conclusion:cConclusion.value,
      business:cBusiness.value.trim(),moat:cMoat.value.trim(),financial:cFinancial.value.trim(),
      risk:cRisk.value.trim(),valuation:cValuation.value.trim(),fiveYear:cFiveYear.value.trim(),
      createdAt:new Date().toISOString()
    });
    storage.set('research',dc.state.research);refresh();
  };
  exportResearch.onclick=()=>{
    const md=['# 企业分析记录','',...dc.state.research.flatMap(r=>[
      `## ${r.company} · ${r.date}`,
      `- 行业：${r.industry||'—'}`,
      `- 结论：${r.conclusion||'—'}`,
      `- 商业模式：${r.business||'—'}`,
      `- 竞争优势：${r.moat||'—'}`,
      `- 财务质量：${r.financial||'—'}`,
      `- 主要风险：${r.risk||'—'}`,
      `- 估值与安全边际：${r.valuation||'—'}`,
      `- 市场关闭5年是否愿意持有：${r.fiveYear||'—'}`,
      ''
    ])].join('\\n');
    downloadText(`企业分析_${new Date().toISOString().slice(0,10)}.md`,md,'text/markdown;charset=utf-8');
  };
}
