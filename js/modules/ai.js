
export function renderAI(dc,root){
  root.innerHTML=`<div class="grid"><div class="card s7"><h3>生成当前对话上下文包</h3><label>问题</label><textarea id="aiQuestion"></textarea><button id="buildPrompt" class="primary">生成</button><button id="copyPrompt">复制</button><label>上下文包</label><textarea id="aiOutput" style="min-height:350px"></textarea></div><div class="card s5"><h3>说明</h3><div class="notice">上下文包会同时附带最新资产 Excel 分析和消费账本摘要。独立网页不能直接写入当前 ChatGPT 对话，请复制后粘贴。</div></div></div>`;
  buildPrompt.onclick=()=>{const s=dc.getSummary(),a=dc.getAssetStats();aiOutput.value=`【问题】\n${aiQuestion.value}\n\n【最新资产数据】\n${JSON.stringify(dc.state.assets,null,2)}\n\n【资产统计】\n${JSON.stringify(a,null,2)}\n\n【消费摘要】\n${JSON.stringify({records:s.records,avg12:s.avg12,topCategories:Object.entries(s.cats12||{}).sort((x,y)=>y[1]-x[1]).slice(0,10)},null,2)}\n\n请给出具体金额、比例、触发条件和操作顺序，并区分事实、假设和风险。`};
  copyPrompt.onclick=async()=>{await navigator.clipboard.writeText(aiOutput.value);alert('已复制')};
}
