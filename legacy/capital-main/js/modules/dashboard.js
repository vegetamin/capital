
export function renderDashboard(dc,root){
  const a=dc.getAssetStats(),cfg=dc.state.config,assets=dc.state.assets;
  const fmt=n=>'¥'+Number(n||0).toLocaleString('zh-CN',{maximumFractionDigits:2});
  const total=Math.max(a.total,1);
  const cashRatio=Number(assets.cash||0)/total;
  const fixedRatio=Number(assets.fixed||0)/total;
  const debtRatio=Number(assets.liabilities||0)/total;
  const riskRatio=a.ratio;

  const architecture=[
    ['灵活资金',Number(assets.cash||0),cashRatio],
    ['低风险资产',Number(assets.fixed||0),fixedRatio],
    ['风险资产',Number(a.risk||0),riskRatio],
    ['债权',Number(assets.receivables||0),Number(assets.receivables||0)/total]
  ];
  const max=Math.max(...architecture.map(x=>x[1]),1);

  let action='请先进入“资产配置”导入原始账目 Excel。';
  if(a.total>0){
    if(Number(assets.cash||0)<cfg.cashTarget){
      action=`第一优先级是补足现金安全垫。距离 ${fmt(cfg.cashTarget)} 还差 <b>${fmt(cfg.cashTarget-Number(assets.cash||0))}</b>。`;
    }else if(cfg.salaryDelayedMonths>0){
      action='现金安全垫已接近目标，但工资发放仍有不确定性。维持小额定投，不做大额一次性建仓。';
    }else if(riskRatio<cfg.riskTargetMin){
      action='现金流稳定后，可通过新增资金分批把风险资产提高到训练区间下限，不动用大额安全资产一次到位。';
    }else{
      action='当前进入“按比例维护”阶段：优先补低配资产，每半年再平衡一次。';
    }
  }

  const advice=[];
  if(fixedRatio>0.70) advice.push('低风险资产占比超过70%，增长效率偏低；用新增资金逐步调整，不建议集中赎回。');
  if(riskRatio<cfg.riskTargetMin && a.total>0) advice.push(`风险资产低于 ${(cfg.riskTargetMin*100).toFixed(0)}% 训练下限；先建立承受波动的能力，而非追求高收益。`);
  if(debtRatio>0.08) advice.push('负债占比较高，应先比较贷款成本与投资预期收益，优先处理高成本负债。');
  if(!advice.length) advice.push('资产结构暂无明显红线，重点是维持现金安全垫并持续记录。');

  root.innerHTML=`<div class="grid">
    <div class="card kpi"><div class="label">金融资产</div><div class="value">${fmt(a.total)}</div><div class="hint">不含公积金和年金</div></div>
    <div class="card kpi"><div class="label">实际净资产</div><div class="value">${fmt(a.net)}</div><div class="hint">扣除负债</div></div>
    <div class="card kpi"><div class="label">风险资产占比</div><div class="value">${(riskRatio*100).toFixed(1)}%</div><div class="hint">当前训练目标 ${(cfg.riskTargetMin*100).toFixed(0)}%—${(cfg.riskTargetMax*100).toFixed(0)}%</div></div>
    <div class="card kpi"><div class="label">现金安全垫</div><div class="value">${fmt(assets.cash||0)}</div><div class="hint">目标 ${fmt(cfg.cashTarget)}</div></div>

    <div class="card s7"><h3>本阶段行动</h3><div class="notice">${action}</div></div>
    <div class="card s5"><h3>数据状态</h3><div class="notice">${assets.sourceFile?`已导入：${assets.sourceFile}<br>最新日期：${assets.latestDate||'—'}`:'尚未导入资产账目 Excel。'}<br>钱迹账本：${dc.state.ledger.length?`${dc.state.ledger.length} 笔（仅消费页维护）`:'未导入'}</div></div>

    <div class="card s7"><h3>当前财富架构</h3>
      ${architecture.map(([k,v,r])=>`<div class="bar-row"><span>${k}</span><div class="bar"><i style="width:${v/max*100}%"></i></div><b>${(r*100).toFixed(1)}%</b></div>`).join('')}
    </div>
    <div class="card s5"><h3>结构诊断</h3><div class="notice">${advice.map(x=>`• ${x}`).join('<br>')}</div></div>

    <div class="card s12"><h3>操作顺序</h3>
      <table><thead><tr><th>顺序</th><th>触发条件</th><th>动作</th></tr></thead><tbody>
        <tr><td>1</td><td>现金低于 ${fmt(cfg.cashTarget)} 或工资延迟</td><td>优先补现金，不扩大风险仓位</td></tr>
        <tr><td>2</td><td>现金达标且工资连续稳定发放</td><td>用新增结余分批建立指数基金仓位</td></tr>
        <tr><td>3</td><td>风险资产达到 ${(cfg.riskTargetMin*100).toFixed(0)}%—${(cfg.riskTargetMax*100).toFixed(0)}%</td><td>维持比例，停止追涨和随意增加品种</td></tr>
        <tr><td>4</td><td>每半年或资产结构偏离目标5个百分点</td><td>通过新增资金再平衡</td></tr>
      </tbody></table>
    </div>
  </div>`;
}
