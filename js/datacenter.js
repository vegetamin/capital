
import {storage} from './storage.js';
export class DataCenter{
  constructor(){this.state={ledger:[],assets:{},config:{},journals:[],reviews:[],research:[],reading:[]};this.cache=new Map()}
  async init(){
    const [ledger,assets,config]=await Promise.all([
      fetch('./data/ledger.json').then(r=>r.json()),
      fetch('./data/assets.json').then(r=>r.json()),
      fetch('./data/config.json').then(r=>r.json())
    ]);
    this.state.ledger=storage.get('ledger',ledger);
    this.state.assets=storage.get('assets',assets);
    this.state.config=config;
    this.state.journals=storage.get('journals',[]);
    this.state.reviews=storage.get('reviews',[]);
    this.state.research=storage.get('research',[]);
    this.state.reading=storage.get('reading',[]);
  }
  invalidate(){this.cache.clear()}
  getSummary(){
    if(this.cache.has('summary'))return this.cache.get('summary');
    let income=0,expense=0,last=0;const months={},cats12={};
    for(const x of this.state.ledger){
      const t=Date.parse(x.date);if(t>last)last=t;
      if(x.type==='收入')income+=x.amount; else if(x.type==='支出')expense+=x.amount;
      const m=x.date.slice(0,7);months[m]??={income:0,expense:0};months[m][x.type==='收入'?'income':'expense']+=x.amount;
    }
    const d=new Date(last),cutoff=new Date(d.getFullYear(),d.getMonth()-11,1).getTime();
    for(const x of this.state.ledger)if(Date.parse(x.date)>=cutoff&&x.type==='支出')cats12[x.category]=(cats12[x.category]||0)+x.amount;
    const keys=Object.keys(months).sort().slice(-12),exp12=keys.reduce((a,m)=>a+months[m].expense,0);
    const result={income,expense,balance:income-expense,months,cats12,keys,avg12:exp12/12,records:this.state.ledger.length};
    this.cache.set('summary',result);return result;
  }
  getAssetStats(){
    const a=this.state.assets;
    const cash=Number(a.cash||0), fixed=Number(a.fixed||0), investment=Number(a.investmentTotal||0), gold=Number(a.gold||0), receivables=Number(a.receivables||0), liabilities=Number(a.liabilities||0);
    const gross=cash+fixed+investment+gold+receivables;
    const net=Number(a.netWorth||0) || (gross-liabilities);
    const risk=investment+gold;
    return {total:gross,net,risk,ratio:gross?risk/gross:0,liabilities};
  }
}
