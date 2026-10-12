import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/lib/alert-settings-navigation.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,URLSearchParams,encodeURIComponent});
test('mobile editing preserves the selected metric and returns to the dashboard alert table',()=>{
 const url=new URL(exports.alertSettingsPageUrl('001','/',{metric:'hepres',only:'hepres'}),'https://local.test');
 assert.equal(url.pathname,'/alert-settings/001');assert.equal(url.searchParams.get('metric'),'hepres');assert.equal(url.searchParams.get('only'),'hepres');assert.equal(url.searchParams.get('return'),'/?view=alerts');
});
test('policy editing from management returns to thresholds without adding metric restrictions',()=>{
 const url=new URL(exports.alertSettingsPageUrl('002','/baselines',{pane:'schedule'}),'https://local.test');
 assert.equal(url.searchParams.get('pane'),'schedule');assert.equal(url.searchParams.has('only'),false);assert.equal(url.searchParams.get('return'),'/baselines?view=thresholds');
});
