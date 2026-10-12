import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function invitationForm(send) {
 const requests=[],refreshes=[],slots=[];let index=0,values;
 const jsx=(type,props,key)=>({type,props,key});
 const react={
  useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next];},
  useRef(initial){const i=index++;return slots[i]??={current:initial};},
  useMemo:fn=>fn(),useEffect(){},
 };
 const form={control:{},register:name=>({name}),formState:{errors:{}},reset:next=>values=structuredClone(next),handleSubmit:fn=>()=>fn(structuredClone(values))};
 const modules={
  'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},
  'react-hook-form':{useForm:options=>{values??=structuredClone(options.defaultValues);return form;},useWatch:({name})=>values[name],Controller:'Controller'},
  '@tanstack/react-query':{useQueryClient:()=>({invalidateQueries:async({queryKey})=>refreshes.push(queryKey[0])})},
  '@/lib/api':{apiFetch:async(path,options)=>{const payload=JSON.parse(options.body);requests.push(payload);return send(payload,requests.length);}},
  '@/lib/phone':{phoneDigits:value=>value.replace(/\D/g,''),formatPhone:value=>value},
 };
 const exports={};
 const source=fs.readFileSync(new URL('../src/components/admin/admin-client.tsx',import.meta.url),'utf8')+'\nexport { InvitationSection };';
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,window:{location:{origin:'http://local.test'}},Error,require:name=>modules[name]??{default:name}});
 const props={invitations:[],sites:[],canInviteAdmins:true};
 function render(){index=0;return exports.InvitationSection(props);}
 function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}return null;}
 function chooseSites(tree,siteIds){const control=find(tree,n=>n.type==='Controller'&&n.props.name==='siteIds');assert.ok(control,'site selection belongs to the invitation form');const checks=control.props.render({field:{value:values.siteIds,onChange:value=>values.siteIds=value}});checks.props.onChange(siteIds);}
 return {render,find,chooseSites,requests,refreshes,fill:fields=>Object.assign(values,fields),values:()=>values,submit:tree=>find(tree,n=>n.type==='form').props.onSubmit(),key:tree=>find(tree,n=>n.type==='form').key};
}

test('two consecutive invitations send independent hospital selections and remount after success',async()=>{
 const ui=invitationForm(async(_,n)=>({token:`token-${n}`,deliveryStatus:'SENT'}));
 let tree=ui.render();ui.fill({email:'first@example.com',name:'First',phone:'01012345678'});ui.chooseSites(tree,['001']);await ui.submit(tree);
 tree=ui.render();assert.equal(ui.key(tree),1);assert.deepEqual(ui.values(),{email:'',name:'',phone:'',role:'USER',siteIds:[]});
 ui.fill({email:'second@example.com',name:'Second',phone:''});ui.chooseSites(tree,['002','003']);await ui.submit(tree);
 assert.deepEqual(ui.requests.map(request=>request.siteIds),[['001'],['002','003']]);
 assert.deepEqual(ui.requests.map(request=>request.email),['first@example.com','second@example.com']);
 assert.equal(ui.key(ui.render()),2);
 assert.deepEqual(ui.refreshes,['admin-invitations','admin-sites','admin-audits','admin-invitations','admin-sites','admin-audits']);
});

test('failed invitation preserves input and selected hospitals for retry',async()=>{
 const ui=invitationForm(async()=>{throw Error('send failed');});const tree=ui.render();
 ui.fill({email:'retry@example.com',name:'Retry'});ui.chooseSites(tree,['002']);await ui.submit(tree);
 assert.equal(ui.key(ui.render()),0);assert.equal(ui.values().email,'retry@example.com');assert.deepEqual(ui.values().siteIds,['002']);assert.deepEqual(ui.refreshes,[]);
});

test('double submit cannot send the same invitation twice',async()=>{
 let complete;const ui=invitationForm(()=>new Promise(resolve=>complete=resolve));const tree=ui.render();
 ui.fill({email:'one@example.com',name:'One'});ui.chooseSites(tree,['001']);const first=ui.submit(tree);await ui.submit(tree);
 assert.equal(ui.requests.length,1);complete({token:'token',deliveryStatus:'SENT'});await first;
});
