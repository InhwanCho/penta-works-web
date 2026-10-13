import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(fs.readFileSync(new URL('../src/lib/alert-event-state.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const state = {};
vm.runInNewContext(source,{exports:state});
const ended = {eventType:'HIGH',acknowledgedAt:null,recoveredAt:'2026-10-06T06:00:00Z',deliveryStatus:'SKIPPED'};
test('auto recovery removes the incident from the default list while preserving all history',()=>{
 assert.equal(state.DEFAULT_ALERT_EVENT_FILTER,'unacknowledged');
 assert.equal(state.matchesAlertEventFilter(ended,state.DEFAULT_ALERT_EVENT_FILTER),false);
 assert.equal(state.matchesAlertEventFilter(ended,'all'),true);
 assert.equal(state.needsAcknowledgement(ended),true);
 assert.equal(state.matchesAlertEventFilter(ended,'open'),false);
});
test('acknowledged and ended incidents remain available in all history',()=>{
 const acknowledged={...ended,acknowledgedAt:'2026-10-06T07:00:00Z'};
 assert.equal(state.matchesAlertEventFilter(acknowledged,'unacknowledged'),false);
 assert.equal(state.needsAcknowledgement(acknowledged),false);
 assert.equal(state.matchesAlertEventFilter(acknowledged,'all'),true);
});
test('acknowledgement and active condition remain independent',()=>{
 const active={...ended,recoveredAt:null,acknowledgedAt:'2026-10-06T07:00:00Z'};
 assert.equal(state.matchesAlertEventFilter(active,'open'),true);
 assert.equal(state.matchesAlertEventFilter(active,'unacknowledged'),false);
});
test('legacy recovery entries are not separate incidents or selectable acknowledgement targets',()=>{
 const recovery={...ended,eventType:'RECOVERY'};
 for(const filter of ['all','open','unacknowledged','failed','skipped']) assert.equal(state.matchesAlertEventFilter(recovery,filter),false);
 assert.equal(state.needsAcknowledgement(recovery),false);
});
