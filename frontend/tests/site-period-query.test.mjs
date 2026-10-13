import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=ts.transpileModule(fs.readFileSync(new URL('../src/hooks/use-site-detail-query.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function queryFor(...args) {
 const exported={};
 vm.runInNewContext(source,{exports:exported,URLSearchParams,require:name=>name==='@tanstack/react-query'?{useQuery:query=>query}:{apiFetch:async path=>path}});
 return exported.useSiteDetailQuery(...args);
}
test('period and count are sent together, and changing count retains both dates',async()=>{
 const from='2026-04-30T15:00:00.000Z',to='2026-10-13T00:00:00.000Z';
 for (const take of [10,20,50,100]) {
  const query=queryFor('001',take,from,to);
  const url=new URL(await query.queryFn(),'https://fixture.invalid');
  assert.equal(url.searchParams.get('from'),from);
  assert.equal(url.searchParams.get('to'),to);
  assert.equal(url.searchParams.get('take'),String(take));
  assert.equal(url.searchParams.has('page'),false);
  assert.equal(query.queryKey[2],take);
  assert.equal(query.queryKey[3],from);
  assert.equal(query.queryKey[4],to);
 }
});
test('latest count mode remains available without period parameters',async()=>{
 const url=new URL(await queryFor('008',20).queryFn(),'https://fixture.invalid');
 assert.equal(url.pathname,'/sites/008');
 assert.equal(url.search,'?take=20');
});
