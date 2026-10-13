import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=file=>ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const metricExports={},order={};
vm.runInNewContext(compile('../src/lib/metrics.ts'),{exports:metricExports});
vm.runInNewContext(compile('../src/lib/dashboard-row-order.ts'),{exports:order,require:()=>metricExports});
const metrics=metricExports.METRICS;
const make=(id,patch={})=>({siteDb:id,siteSlug:String(Number(id)),metrics:{hepres:1},alertStatus:'NORMAL',openAlertCount:0,unacknowledgedAlertCount:0,alertIssues:[],...patch});
const ids=rows=>Array.from(rows,r=>r.siteDb);
const bounds={mrplel:.5,mrpleh:2};
test('a red value sorts first even before the scheduler registers its alert',()=>{
 const normal=make('001'),noData=make('003',{alertStatus:'NO_DATA'}),red=make('008',{metrics:{hepres:3}});
 const registered=make('002',{alertStatus:'WARNING',unacknowledgedAlertCount:10,alertIssues:[{eventType:'HIGH'}]});
 const rows=[normal,noData,red,registered];
 assert.deepEqual(ids(order.sortDashboardRows(rows,{'008':bounds},metrics)),['008','002','003','001']);
 assert.deepEqual(ids(rows),['001','003','008','002']);
});
test('bounds, missing sentinels and disabled bounds match the displayed red-cell rules',()=>{
 for (const value of [.5,2,0,.001,.01,.1,null,NaN]) assert.equal(order.hasRedDashboardValue(make('008',{metrics:{hepres:value}}),{'008':bounds},metrics),false);
 for (const value of [.4,2.1]) assert.equal(order.hasRedDashboardValue(make('008',{metrics:{hepres:value}}),{'008':bounds},metrics),true);
 assert.equal(order.hasRedDashboardValue(make('008',{metrics:{hepres:3}}),{},metrics),false);
 assert.equal(order.hasRedDashboardValue(make('008',{metrics:{hepres:3}}),{'008':{mrplel:5,mrpleh:2}},metrics),false);
});
test('missing collection and metric alerts stay above normals, with stable numeric site ordering',()=>{
 const rows=[make('010'),make('002'),make('006',{alertStatus:'WARNING'}),make('005',{alertStatus:'NO_DATA'})];
 assert.deepEqual(ids(order.sortDashboardRows(rows,{},metrics)),['005','006','002','010']);
});

test('current red readings participate in warning filters and counts without inventing notification events',()=>{
 const red=make('008',{metrics:{hepres:3}});
 assert.equal(order.dashboardRowStatus(red,{'008':bounds},metrics),'WARNING');
 assert.equal(red.alertStatus,'NORMAL');
 assert.equal(red.openAlertCount,0);
 assert.equal(order.dashboardRowStatus(make('008',{alertStatus:'NO_DATA',metrics:{hepres:3}}),{'008':bounds},metrics),'NO_DATA');
 assert.equal(order.dashboardRowStatus(make('008'),{'008':bounds},metrics),'NORMAL');
});
