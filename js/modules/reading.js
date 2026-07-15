
import {storage,downloadText} from '../storage.js';

export function renderReading(dc,root){
  const list=()=>dc.state.reading.map((r,i)=>`<div class="entry">
    <b>${r.title} · ${r.status}</b>
    <div class="muted">作者：${r.author||'—'} · 日期：${r.date||'—'}</div>
    <div>核心观点：${r.insight||'—'}</div>
    <div>我的感想：${r.reflection||'—'}</div>
    <div>准备实践：${r.action||'—'}</div>
    <button class="mini-btn danger" data-del="${i}">删除</button>
  </div>`).join('')||'<div class="muted">暂无阅读记录</div>';

  root.innerHTML=`<div class="grid">
    <div class="card s5">
      <h3>新增投资阅读</h3>
      <label>书名 / 文章名</label><input id="bTitle">
      <label>作者</label><input id="bAuthor">
      <div class="form-grid">
        <div><label>状态</label><select id="bStatus"><option>待读</option><option>在读</option><option>已读</option><option>重读</option></select></div>
        <div><label>日期</label><input id="bDate" type="date"></div>
      </div>
      <label>最重要的三个观点</label><textarea id="bInsight"></textarea>
      <label>哪些观点改变了我的判断？</label><textarea id="bReflection"></textarea>
      <label>我准备怎样实践？</label><textarea id="bAction"></textarea>
      <label>不同意或存疑的地方</label><textarea id="bQuestion"></textarea>
      <button id="bSave" class="primary">保存阅读记录</button>
    </div>
    <div class="card s7">
      <div class="actions" style="justify-content:space-between"><h3>阅读与感想</h3><button id="exportReading">导出Markdown</button></div>
      <div id="readingList">${list()}</div>
    </div>
  </div>`;

  bDate.value=new Date().toISOString().slice(0,10);
  const refresh=()=>{
    readingList.innerHTML=list();
    document.querySelectorAll('[data-del]').forEach(btn=>btn.onclick=()=>{
      const i=+btn.dataset.del;
      if(confirm('确认删除这条阅读记录吗？')){
        dc.state.reading.splice(i,1);storage.set('reading',dc.state.reading);refresh();
      }
    });
  };
  bSave.onclick=()=>{
    if(!bTitle.value.trim())return alert('请填写书名或文章名');
    dc.state.reading.unshift({
      title:bTitle.value.trim(),author:bAuthor.value.trim(),status:bStatus.value,date:bDate.value,
      insight:bInsight.value.trim(),reflection:bReflection.value.trim(),action:bAction.value.trim(),
      question:bQuestion.value.trim(),createdAt:new Date().toISOString()
    });
    storage.set('reading',dc.state.reading);refresh();
  };
  exportReading.onclick=()=>{
    const md=['# 投资阅读与感想','',...dc.state.reading.flatMap(r=>[
      `## ${r.title}`,
      `- 作者：${r.author||'—'}`,
      `- 状态：${r.status}`,
      `- 日期：${r.date||'—'}`,
      `- 核心观点：${r.insight||'—'}`,
      `- 我的感想：${r.reflection||'—'}`,
      `- 实践计划：${r.action||'—'}`,
      `- 存疑：${r.question||'—'}`,
      ''
    ])].join('\\n');
    downloadText(`投资阅读_${new Date().toISOString().slice(0,10)}.md`,md,'text/markdown;charset=utf-8');
  };
}
