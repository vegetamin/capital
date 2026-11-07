const test=require('node:test');
const assert=require('node:assert/strict');
const AliceMaterials=require('../js/core/ai-materials.js');

test('builds reusable site materials from asset and spending imports',()=>{
  const state={
    imports:[
      {id:'asset-1',type:'asset-excel-reconciled',fileName:'资产账目.xlsx',sheetName:'个人财产',asOf:'2026-10-31',createdAt:'2026-11-01',count:1},
      {id:'spend-1',fileName:'钱迹账单.xlsx',createdAt:'2026-10-30',count:2,duplicate:1,ignored:0}
    ],
    accounts:[{id:'a1',name:'招商银行活期',kind:'bank',assetImportBatch:'asset-1',assetSourceRow:8}],
    transactions:[
      {importBatch:'spend-1',status:'posted',type:'expense',category:'餐饮',date:'2026-10-02',importAmountCents:8800},
      {importBatch:'spend-1',status:'posted',type:'income',category:'工资',date:'2026-10-01',importAmountCents:500000}
    ]
  };
  const items=AliceMaterials.buildSiteMaterials(state,{balanceOf:()=>120000,spendOf:t=>t.importAmountCents,incomeOf:t=>t.importAmountCents});
  assert.equal(items.length,2);
  assert.match(items.find(x=>x.name==='资产账目.xlsx').content,/招商银行活期/);
  assert.match(items.find(x=>x.name==='钱迹账单.xlsx').content,/餐饮：¥88\.00/);
});

test('composes bounded untrusted material context with source labels',()=>{
  const out=AliceMaterials.composeContext([{name:'投资备忘录.md',origin:'library',content:'A'.repeat(200)}],80);
  assert.equal(out.count,1);
  assert.equal(out.truncated,true);
  assert.match(out.text,/我的资料库/);
  assert.ok(out.text.length<120);
});
