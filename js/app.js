import {DataCenter} from './datacenter.js';

const dc=new DataCenter();
const root=document.getElementById('appView');
const title=document.getElementById('pageTitle');
const subtitle=document.getElementById('pageSubtitle');

const titles={
  dashboard:'资产总览与财富架构',
  assets:'资产配置与数据维护',
  'asset-cache':'资产缓存',
  journal:'投资日志',
  review:'周期复盘',
  research:'企业分析',
  reading:'投资阅读',
  consumption:'消费分析',
  ai:'AI 协作',
  'data-center':'数据管理',
  changelog:'更新日志'
};

const subtitles={
  dashboard:'先管理资产结构，再讨论收益率。',
  assets:'资产模型与Excel导出彻底解耦，统一导出xlsx。',
  'asset-cache':'查看、导出和删除已提交的资产快照。',
  journal:'记录决策依据，而不只记录盈亏。',
  review:'按周、月或季度校准现金流、仓位和行为。',
  research:'用标准模板训练企业分析能力。',
  reading:'记录投资书籍、要点和个人感想。',
  consumption:'钱迹CSV的导入与导出仅在本页进行。',
  ai:'生成最新资产与行为上下文包。',
  'data-center':'管理缓存、备份、恢复和清理本地数据。',
  changelog:'查看版本变化。'
};

const modules={
  dashboard:()=>import('./modules/dashboard.js').then(m=>m.renderDashboard(dc,root)),
  assets:()=>import('./modules/assets.js?v=2.2.0').then(m=>m.renderAssets(dc,root)),
  'asset-cache':()=>import('./modules/asset-cache.js?v=2.2.0').then(m=>m.renderAssetCache(dc,root)),
  journal:()=>import('./modules/journal.js').then(m=>m.renderJournal(dc,root)),
  review:()=>import('./modules/review.js').then(m=>m.renderReview(dc,root)),
  research:()=>import('./modules/research.js').then(m=>m.renderResearch(dc,root)),
  reading:()=>import('./modules/reading.js').then(m=>m.renderReading(dc,root)),
  consumption:()=>import('./modules/consumption.js').then(m=>m.renderConsumption(dc,root)),
  ai:()=>import('./modules/ai.js').then(m=>m.renderAI(dc,root)),
  'data-center':()=>import('./modules/data-center.js').then(m=>m.renderDataCenter(dc,root)),
  changelog:()=>import('./modules/changelog.js').then(m=>m.renderChangelog(dc,root))
};

async function show(page){
  title.textContent=titles[page]||page;
  subtitle.textContent=subtitles[page]||'';
  root.innerHTML='<div class="loading">正在加载……</div>';
  try{
    await modules[page]();
  }catch(error){
    console.error(error);
    root.innerHTML=`<div class="card"><h3>页面加载失败</h3><pre>${String(error?.stack||error)}</pre></div>`;
  }
}

await dc.init();
document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#nav button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  show(b.dataset.page);
});
await show('dashboard');
