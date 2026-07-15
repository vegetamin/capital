
const DB_KEYS={ledger:'lcos_v3_ledger',assets:'lcos_v3_assets',journals:'lcos_v3_journals',reviews:'lcos_v3_reviews',research:'lcos_v3_research',reading:'lcos_v3_reading'};
export const storage={
  get(key,fallback){try{return JSON.parse(localStorage.getItem(DB_KEYS[key]))??fallback}catch{return fallback}},
  set(key,value){localStorage.setItem(DB_KEYS[key],JSON.stringify(value))},
  exportAll(state){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`LifeCapitalOS_V3_Backup_${new Date().toISOString().slice(0,10)}.json`;a.click();
  }
};

export function downloadText(filename,text,mime='text/plain;charset=utf-8'){
  const blob=new Blob([text],{type:mime});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  a.click();
}
export function csvEscape(v){
  const s=String(v??'');
  return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
}
