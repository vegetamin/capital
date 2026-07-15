
self.onmessage=e=>{
  const {rows,month}=e.data;
  const selected=month==='all12'?rows:rows.filter(x=>x.date.startsWith(month));
  let income=0,expense=0;const categories={};
  for(const x of selected){
    if(x.type==='收入')income+=x.amount;
    if(x.type==='支出'){expense+=x.amount;categories[x.category]=(categories[x.category]||0)+x.amount}
  }
  self.postMessage({income,expense,balance:income-expense,count:selected.length,categories});
};
