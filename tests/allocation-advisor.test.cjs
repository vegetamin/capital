const test=require('node:test');
const assert=require('node:assert/strict');
const Allocation=require('../js/core/allocation-advisor.js');

const base=()=>({
  accounts:[],holdings:[],fundPurposes:[],decisions:[],wealthFacts:[],
  policy:{cashFloor:2000000,allocation:{riskProfile:'balanced',confirmed:true,horizonYears:10,driftTolerance:5,targets:{liquid:20,fixed:25,investment:50,other:5}}}
});

test('built-in profiles total 100 percent without forcing other assets',()=>{
  for(const id of ['conservative','balanced','growth']){
    const targets=Allocation.PROFILES[id].targets;
    assert.equal(Object.values(targets).reduce((n,x)=>n+x,0),100);
    assert.equal(targets.other,0);
  }
});

test('configurable funds exclude floor, purposes and pending orders',()=>{
  const state=base();
  state.accounts=[{id:'cash',name:'活期',kind:'bank',asOf:'2026-11-01'}];
  state.fundPurposes=[{status:'active',amountCents:1000000}];
  state.decisions=[{status:'submitted',reservedCents:500000}];
  const out=Allocation.build(state,{balanceOf:()=>5000000,now:new Date('2026-11-07')});
  assert.equal(out.configurableCents,1500000);
  assert.equal(out.reservedCents,500000);
  assert.ok(out.blockers.some(x=>x.includes('待成交')));
});

test('unconfirmed target policy blocks precise allocation amounts',()=>{
  const state=base();state.policy.allocation.confirmed=false;
  state.accounts=[{id:'cash',name:'活期',kind:'bank',asOf:'2026-11-01'}];
  const out=Allocation.build(state,{balanceOf:()=>5000000,now:new Date('2026-11-07')});
  assert.equal(out.status,'blocked');
  assert.equal(out.actions.some(x=>x.kind==='allocate'),false);
});

test('contributions-first advice allocates only available cash to underweight groups',()=>{
  const state=base();
  state.accounts=[
    {id:'cash',name:'活期',kind:'bank',asOf:'2026-11-01'},
    {id:'fixed',name:'定期',kind:'fixed',asOf:'2026-11-01'},
    {id:'invest',name:'证券资金',kind:'investment',asOf:'2026-11-01'}
  ];
  const balances={cash:5000000,fixed:1000000,invest:1000000};
  const out=Allocation.build(state,{balanceOf:a=>balances[a.id],now:new Date('2026-11-07')});
  const suggested=out.actions.filter(x=>x.kind==='allocate').reduce((n,x)=>n+x.amountCents,0);
  assert.equal(out.configurableCents,3000000);
  assert.ok(suggested<=out.configurableCents);
  assert.ok(out.actions.some(x=>x.groupId==='investment'));
});

test('cash protection takes priority when protected funds exceed liquid cash',()=>{
  const state=base();
  state.accounts=[{id:'cash',name:'活期',kind:'bank',asOf:'2026-11-01'}];
  state.fundPurposes=[{status:'active',amountCents:1500000}];
  const out=Allocation.build(state,{balanceOf:()=>2500000,now:new Date('2026-11-07')});
  assert.equal(out.cashGapCents,1000000);
  assert.ok(out.actions.some(x=>x.kind==='protect'&&x.amountCents===1000000));
});
