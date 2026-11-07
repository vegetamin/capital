const test=require('node:test');
const assert=require('node:assert/strict');
const chart=require('../js/core/asset-composition.js');

test('groups accounts and holdings without liabilities or excluded accounts',()=>{
 const state={
  accounts:[
   {id:'bank',name:'日常账户',kind:'bank'},
   {id:'fixed',name:'三年定期',kind:'fixed'},
   {id:'broker',name:'证券资金',kind:'investment'},
   {id:'debt',name:'信用卡',kind:'liability'},
   {id:'hidden',name:'待核账户',kind:'bank',auditExcluded:true}
  ],
  holdings:[{id:'etf',accountId:'broker',symbol:'510300',name:'沪深300ETF',qty:100000,scale:10000,priceUnit:4000000}]
 };
 const balances={bank:500000,fixed:900000,broker:100000,debt:-300000,hidden:800000};
 const result=chart.build(state,id=>balances[id]||0);
 assert.equal(result.total,1900000);
 assert.deepEqual(result.groups.map(g=>g.name),['灵活资金','定期存款','投资资产']);
 assert.equal(result.groups.find(g=>g.id==='investment').children.length,2);
 assert.ok(!result.groups.some(g=>g.children.some(c=>c.name==='待核账户')));
});

test('secondary percentages are calculated within the selected primary group',()=>{
 const state={accounts:[
  {id:'a',name:'工资卡',kind:'bank'},
  {id:'b',name:'备用金',kind:'cash'}
 ],holdings:[]};
 const result=chart.build(state,id=>id==='a'?7500:2500);
 const liquid=result.groups[0];
 assert.equal(liquid.children[0].percent,.75);
 assert.equal(liquid.children[1].percent,.25);
});
