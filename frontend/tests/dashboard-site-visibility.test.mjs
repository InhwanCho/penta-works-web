import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/dashboard-site-visibility.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports});
const rows=[{siteDb:'001',siteSlug:'1'},{siteDb:'002',siteSlug:'2'}];
const ids=result=>Array.from(result,row=>row.siteDb);
test('personal hiding supports restoring and hiding all without modifying assigned rows',()=>{
 assert.deepEqual(ids(exports.visibleDashboardSites(rows,['001'])),['002']);
 assert.deepEqual(ids(exports.visibleDashboardSites(rows,[])),['001','002']);
 assert.deepEqual(ids(exports.visibleDashboardSites(rows,['001','002'])),[]);
 assert.equal(rows.length,2);
});
test('notification links cannot implicitly reveal or resume a hidden hospital',()=>{
 const hidden=['001','002'];
 assert.deepEqual(ids(exports.visibleDashboardSites(rows,hidden,'001')),[]);
 assert.deepEqual(ids(exports.visibleDashboardSites(rows,hidden,'1')),[]);
 assert.deepEqual(hidden,['001','002']);
});
