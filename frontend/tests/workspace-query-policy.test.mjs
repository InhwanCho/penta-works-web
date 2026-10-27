import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness(){
 const exports={},queries=[],requests=[];
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/components/workspace/workspace-data.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,URLSearchParams,require(name){
   if(name==='@tanstack/react-query')return {useQuery:options=>{queries.push(options);return options;}};
   if(name.includes('auth-provider'))return {useAuth:()=>({session:{id:4}})};
   return {apiFetch:path=>{requests.push(path);return Promise.resolve([]);}};
  }
 });
 return {queries,requests,workspace:exports.useWorkspace};
}
test('new work authoring can skip both records and optional schedule data',()=>{
 const h=harness();h.workspace({records:false,schedules:false});
 const [sites,records,schedules]=h.queries;
 assert.equal(sites.enabled,true);assert.equal(sites.staleTime,60000);
 assert.equal(records.enabled,false);assert.equal(schedules.enabled,false);
});
test('schedule queries stay enabled by default and retain company account and date scope',async()=>{
 const h=harness();h.workspace({scheduleFrom:'2026-10-27',scheduleTo:'2026-10-27'});
 const schedules=h.queries[2];assert.equal(schedules.enabled,true);assert.equal(schedules.staleTime,30000);
 assert.equal(schedules.queryKey[1],4);await schedules.queryFn();
 assert.equal(h.requests[0],'/workspace/schedules?from=2026-10-27&to=2026-10-27');
});
