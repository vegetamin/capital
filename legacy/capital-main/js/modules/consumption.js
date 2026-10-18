
import {storage} from '../storage.js';

function parseCsv(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
  const parse=line=>{
    let out=[],cur='',quoted=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){
        if(quoted&&line[i+1]==='"'){cur+='"';i++}
        else quoted=!quoted;
      }else if(ch===','&&!quoted){out.push(cur);cur=''}
      else cur+=ch;
    }
    out.push(cur);return out;
  };
  if(!lines.length)return [];
  const header=parse(lines[0]),idx=name=>header.indexOf(name);
  return lines.slice(1).map(line=>{
    const r=parse(line);
    return {
      date:r[idx('时间')]||'',
      category:r[idx('分类')]||'',
      subcategory:r[idx('二级分类')]||'',
      type:r[idx('类型')]||'',
      amount:+r[idx('金额')]||0,
      account:r[idx('账户1')]||'',
      note:r[idx('备注')]||''
    };
  }).filter(x=>x.date);
}
function csvEscape(v){
  const s=String(v??'');
  return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
}
function exportLedger(rows){
  const headers=['时间','分类','二级分类','类型','金额','账户1','备注'];
  const body=rows.map(x=>[x.date,x.category,x.subcategory,x.type,x.amount,x.account,x.note].map(csvEscape).join(','));
  const blob=new Blob(['\uFEFF'+[headers.join(','),...body].join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`钱迹账本_本地导出_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

export function renderConsumption(dc,root){
  root.innerHTML=`<div class="grid">
    <div class="card s12">
      <h3>钱迹账本文件</h3>
      <p class="muted">钱迹 CSV 的导入和导出只在本页进行。数据仅保存在当前浏览器。</p>
      <div class="actions">
        <label class="file-btn">导入钱迹 CSV<input id="ledgerImport" type="file" accept=".csv" hidden></label>
        <button id="ledgerExport">导出当前账本 CSV</button>
        <span id="ledgerStatus" class="muted">${dc.state.ledger.length?`当前 ${dc.state.ledger.length} 笔`:'尚未导入'}</span>
      </div>
    </div>
    <div id="consumptionBody" class="s12"></div>
  </div>`;

  document.getElementById('ledgerImport').onchange=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        dc.state.ledger=parseCsv(reader.result);
        storage.set('ledger',dc.state.ledger);
        dc.invalidate();
        document.getElementById('ledgerStatus').textContent=`已导入 ${dc.state.ledger.length} 笔`;
        draw();
      }catch(err){alert('导入失败，请确认文件为钱迹 CSV。')}
    };
    reader.readAsText(file,'UTF-8');
  };
  document.getElementById('ledgerExport').onclick=()=>{
    if(!dc.state.ledger.length)return alert('当前没有可导出的账本。');
    exportLedger(dc.state.ledger);
  };

  function draw(){
    const holder=document.getElementById('consumptionBody');
    if(!dc.state.ledger.length){
      holder.innerHTML='<div class="card"><div class="notice">尚未导入钱迹账本。消费分析是辅助模块，不影响资产管理功能。</div></div>';
      return;
    }
    const months=[...new Set(dc.state.ledger.map(x=>x.date.slice(0,7)))].sort().reverse();
    holder.innerHTML=`<div class="grid">
      <div class="card s12"><label>分析月份</label><select id="monthSelect"><option value="all12">最近12个月</option>${months.map(m=>`<option>${m}</option>`).join('')}</select></div>
      <div id="consumptionResult" class="card s12 loading">正在计算……</div>
    </div>`;
    const worker=new Worker('./worker/analysis.worker.js');
    const calculate=()=>{
      const month=document.getElementById('monthSelect').value;
      let rows=dc.state.ledger;
      if(month==='all12'){
        const keys=dc.getSummary().keys;
        rows=rows.filter(x=>keys.includes(x.date.slice(0,7)));
      }
      worker.postMessage({rows,month:month==='all12'?'all12':month});
    };
    worker.onmessage=e=>{
      const r=e.data,fmt=n=>'¥'+Number(n||0).toLocaleString('zh-CN',{maximumFractionDigits:2});
      const cats=Object.entries(r.categories).sort((a,b)=>b[1]-a[1]),max=cats[0]?.[1]||1;
      const target=document.getElementById('consumptionResult');
      target.className='card s12';
      target.innerHTML=`<div class="grid">
        <div class="card kpi"><div class="label">支出</div><div class="value">${fmt(r.expense)}</div></div>
        <div class="card kpi"><div class="label">收入</div><div class="value">${fmt(r.income)}</div></div>
        <div class="card kpi"><div class="label">结余</div><div class="value">${fmt(r.balance)}</div></div>
        <div class="card kpi"><div class="label">笔数</div><div class="value">${r.count}</div></div>
        <div class="card s12"><h3>分类排行</h3>${cats.slice(0,15).map(([k,v])=>`<div class="bar-row"><span>${k}</span><div class="bar"><i style="width:${v/max*100}%"></i></div><b>${fmt(v)}</b></div>`).join('')}</div>
      </div>`;
    };
    document.getElementById('monthSelect').onchange=calculate;
    calculate();
  }
  draw();
}
