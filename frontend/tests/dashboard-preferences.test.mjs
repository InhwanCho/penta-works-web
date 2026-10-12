import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function preferences(storage) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/dashboard-preferences.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,localStorage:storage});
  return exports;
}
test('account preferences remain isolated and survive a new app instance',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  preferences(storage).writeDashboardPreferences(7,{columns:['hepres','lastAt']});
  const next=preferences(storage);
  assert.equal(JSON.stringify(next.readDashboardPreferences(7)),JSON.stringify({columns:['hepres','lastAt']}));
  assert.equal(next.readDashboardPreferences(8).columns,null);
});
test('corrupt or unavailable storage falls back to the full table',()=>{
  for(const value of ['broken','{"columns":[3]}','{"columns":false}']){
    const result=preferences({getItem:()=>value}).readDashboardPreferences(7);
    assert.equal(result.columns,null);
  }
  const offline=preferences({getItem:()=>{throw Error('storage unavailable');},setItem:()=>{throw Error('storage unavailable');}});
  assert.equal(offline.readDashboardPreferences(7).columns,null);
  assert.doesNotThrow(()=>offline.writeDashboardPreferences(7,{columns:null}));
});

test('legacy favorites are ignored while selected columns are retained',()=>{
 const result=preferences({getItem:()=>JSON.stringify({favorites:['001'],columns:['hepres']})}).readDashboardPreferences(7);
 assert.equal(JSON.stringify(result),JSON.stringify({columns:['hepres']}));
});
