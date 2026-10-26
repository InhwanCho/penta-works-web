import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const out = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/components/workspace/recent-work-weeks.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out});
const group = rows => JSON.parse(JSON.stringify(out.groupRecentWorkByWeek(rows)));
test('October weeks follow calendar rows and show newest weeks and records first',()=>{
 const rows=[{id:1,workDate:'2026-10-01'},{id:2,workDate:'2026-10-04'},{id:3,workDate:'2026-10-03'},{id:4,workDate:'2026-10-11'},{id:5,workDate:'2026-10-26'}];
 const groups=group(rows);
 assert.deepEqual(groups.map(g=>g.label),['10월 5주차','10월 3주차','10월 2주차','10월 1주차']);
 assert.deepEqual(groups.at(-1).records.map(r=>r.id),[3,1]);
 assert.equal(rows[0].id,1);
});
test('month and year boundaries never combine same numbered weeks',()=>{
 const groups=group([{id:1,workDate:'2025-10-01'},{id:2,workDate:'2026-10-01'},{id:3,workDate:'2026-11-01'}]);
 assert.deepEqual(groups.map(g=>g.key),['2026-11-1','2026-10-1','2025-10-1']);
 assert.equal(group([]).length,0);
});
test('leap dates and months with six calendar rows retain the correct week',()=>{
 assert.equal(group([{id:1,workDate:'2024-02-29'}])[0].label,'2월 5주차');
 assert.equal(group([{id:1,workDate:'2026-05-31'}])[0].label,'5월 6주차');
});
