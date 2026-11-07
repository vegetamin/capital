// Excel account snapshots are authoritative as of their snapshot date. Imported QianJi
// historical spending is an analytical record, never a balance movement.
function effectiveEntry(t,e,a){
 if(e.accountId!==a.id || t.status==='void')return 0;
 if(t.source==='钱迹CSV'||t.source==='钱迹账本'||t.qianjiImported)return 0;
 const date=a.assetSnapshotDate || (a.assetImportBatch?a.asOf:null);
 if(date && t.date && t.date<=date && t.type!=='adjustment')return 0;
 return Number(e.amount)||0;
}
function acctBalance(id){const a=state.accounts.find(x=>x.id===id);if(!a)return 0;return a.opening+sum(state.transactions.filter(t=>t.status!=='void'),t=>sum(t.entries||[],e=>effectiveEntry(t,e,a)))}
function assetBalance(){return sum(state.accounts.filter(a=>a.kind!=='liability'&&!a.auditExcluded),a=>acctBalance(a.id))+sum(state.holdings,h=>h.qty*(h.priceUnit??h.priceCents*100)/(h.scale*100))}function liabilityBalance(){return -sum(state.accounts.filter(a=>a.kind==='liability'&&!a.auditExcluded),a=>acctBalance(a.id))}function netWorth(){return assetBalance()-liabilityBalance()}function transactionSpend(t){if(t.type!=='expense')return 0;if(Number.isSafeInteger(t.importAmountCents))return t.importAmountCents;return -sum(t.entries||[],e=>e.accountId===t.accountId?e.amount:0)}
function transactionIncome(t){if(t.type!=='income')return 0;if(Number.isSafeInteger(t.importAmountCents))return t.importAmountCents;return sum(t.entries||[],e=>e.accountId===t.accountId?e.amount:0)}
function monthlySpend(month){return sum(state.transactions.filter(t=>t.status==='posted'&&t.date.startsWith(month)&&t.type==='expense'),transactionSpend)}
function txnTotals(){return state.transactions.filter(t=>t.status==='posted').reduce((o,t)=>{if(t.type==='expense')o.exp+=transactionSpend(t);if(t.type==='income')o.inc+=transactionIncome(t);return o},{exp:0,inc:0})}
function card(k,v,h=''){return `<section class="card"><div class="small">${k}</div><div class="metric">${v}</div><div class="small">${h}</div></section>`}
function table(headers,rows){return `<div class="tablewrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}" class="empty">暂无记录</td></tr>`}</tbody></table></div>`}
function accountSelect(id='account',filter=x=>x.kind!=='liability'){return `<select id="${id}">${options(state.accounts.filter(filter))}</select>`}
function msgNoAcct(){return `<div class="notice">尚未建立账户。先到“资产账户”添加现金、银行或投资资金账户，再录入流水。旧版本的样本数据不会自动进入新系统。</div>`}

let assetChartSelection='';
const ASSET_CHILD_COLORS={
 liquid:['#356B72','#4E858B','#69A0A4','#87B5B6','#A7CAC8','#C5DDDA'],
 fixed:['#B98128','#D2A64B','#E0BB6B','#E9CC8B','#F0DCAA','#F6EBCB'],
 investment:['#5C4C91','#7466A8','#8E81BC','#A79BCB','#BEB5D9','#D5CFE7'],
 receivable:['#A84F43','#C86E5D','#D48777','#DFA294','#E9BCAF','#F1D5CB'],
 other:['#64725E','#809079','#98A38F','#AFBAA8','#C6CFC0','#DDE3D9']
};
function assetPercent(value,total){return total?`${(value/total*100).toFixed(value/total<.01?1:0)}%`:'0%'}
function assetCompact(value){return `¥${new Intl.NumberFormat('zh-CN',{notation:'compact',maximumFractionDigits:1}).format(value/100)}`}
function assetDonut(items,total,label,interactive){
 let offset=0;
 const segments=items.map((item,index)=>{
  const percent=total?item.value/total*100:0,stroke=item.color||'#809079',dash=`${percent} ${100-percent}`,current=offset;offset+=percent;
  const action=interactive?`onclick="showAssetGroup('${esc(item.id)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showAssetGroup('${esc(item.id)}')}" tabindex="0"`:'tabindex="-1"';
  return `<circle class="asset-donut-segment" cx="100" cy="100" r="72" pathLength="100" fill="none" stroke="${stroke}" stroke-width="31" stroke-dasharray="${dash}" stroke-dashoffset="${-current}" ${action}><title>${esc(item.name)} ${assetPercent(item.value,total)}</title></circle>`;
 }).join('');
 return `<svg class="asset-donut" viewBox="0 0 200 200" role="img" aria-label="${esc(label)}资产构成饼状图"><circle cx="100" cy="100" r="72" pathLength="100" fill="none" stroke="#e8ece8" stroke-width="31"/>${segments}<text x="100" y="92" text-anchor="middle" class="asset-donut-caption">${esc(label)}</text><text x="100" y="112" text-anchor="middle" class="asset-donut-total">${esc(assetCompact(total))}</text></svg>`;
}
function assetCompositionMarkup(){
 const data=AliceAssetComposition.build(state,acctBalance);
 if(!data.total)return `<div class="asset-composition-empty"><div class="asset-empty-ring" aria-hidden="true"></div><div><h3>等待资产数据</h3><p>添加或导入账户后，这里会按一级项目生成资产构成，并可继续查看每个账户和持仓的占比。</p><button onclick="navigate('accounts')">添加资产账户</button></div></div>`;
 const selected=data.groups.find(g=>g.id===assetChartSelection);
 const items=selected?selected.children.map((c,i)=>({...c,color:ASSET_CHILD_COLORS[selected.id][i%ASSET_CHILD_COLORS[selected.id].length]})):data.groups;
 const total=selected?selected.value:data.total;
 const legend=items.map(item=>{const content=`<i style="--asset-color:${item.color}"></i><span><b>${esc(item.name)} · ${assetPercent(item.value,total)}</b><small>${amt(item.value)}</small></span>`;return selected?`<div class="asset-legend-row is-child">${content}</div>`:`<button type="button" class="asset-legend-row" onclick="showAssetGroup('${esc(item.id)}')">${content}<em>查看明细</em></button>`}).join('');
 return `<div class="asset-chart-heading"><div>${selected?`<button class="asset-back" onclick="showAssetGroup('')">← 全部资产</button>`:'<span class="asset-chart-kicker">可交互资产视图</span>'}<h2>${selected?esc(selected.name)+'构成':'资产构成'}</h2><p>${selected?'占比按该一级项目内部计算。':'点击饼图或一级项目，查看二级账户与持仓。'}</p></div><span class="asset-chart-date">更新至 ${today()}</span></div><div class="asset-chart-body"><div class="asset-chart-visual">${assetDonut(items,total,selected?selected.name:'总资产',!selected)}</div><div class="asset-legend">${legend}</div></div>`;
}
function showAssetGroup(id){assetChartSelection=id||'';const target=$('assetComposition');if(target)target.innerHTML=assetCompositionMarkup()}
function assetComposition(){return `<section class="card asset-composition-card" id="assetComposition">${assetCompositionMarkup()}</section>`}

function home(){
 const month=today().slice(0,7),cash=sum(state.accounts.filter(x=>!x.auditExcluded&&['cash','bank','money'].includes(x.kind)),a=>acctBalance(a.id)),fixed=sum(state.accounts.filter(x=>!x.auditExcluded&&x.kind==='fixed'),a=>acctBalance(a.id)),inv=sum(state.accounts.filter(x=>!x.auditExcluded&&x.kind==='investment'),a=>acctBalance(a.id))+sum(state.holdings,h=>h.qty*(h.priceUnit??h.priceCents*100)/(h.scale*100)),short=cash-state.policy.cashFloor;
 return `${state.accounts.length?'':msgNoAcct()}<div class="grid dashboard-kpis">${card('净资产',amt(netWorth()),'账户与投资持仓合计')}${card('灵活资金',amt(cash),'现金、活期与现金管理')}${card('定期存款',amt(fixed),'按存款账户余额')}${card('投资资产',amt(inv),'证券资金与持仓市值')}</div><div class="dashboard-main">${assetComposition()}<section class="card financial-check"><div class="section-heading"><span>财务边界</span><h2>当前财务检查</h2></div><div class="check-row"><span>现金安全底线</span><b>${amt(state.policy.cashFloor)}</b></div><div class="check-row"><span>底线以上现金</span><b class="${short<0?'error':'success'}">${amt(short)}</b></div><div class="check-row"><span>本月已登记消费</span><b>${amt(monthlySpend(month))}</b></div><p class="financial-note">资产数值来自已录入余额、交易和最新估值。系统没有银行直连，请定期与银行及券商对账。</p><div class="actions"><button class="primary" onclick="navigate('allocation')">查看配置建议</button><button onclick="navigate('accounts')">核对账户</button></div></section></div><section class="card dashboard-workbench"><div class="section-heading"><span>下一步</span><h2>本期工作台</h2></div><div class="workbench-steps"><p><b>01</b><span>核实账户余额与日期</span></p><p><b>02</b><span>确认资金用途与现金底线</span></p><p><b>03</b><span>检查配置偏离与可配置资金</span></p><p><b>04</b><span>核实订单与实际成交</span></p><p><b>05</b><span>复盘配置草案与结果</span></p></div></section>`;
}
