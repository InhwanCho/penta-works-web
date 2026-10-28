import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const out={},windows=[];
const source=ts.transpileModule(fs.readFileSync(new URL('../src/components/common/photo-preview-link.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
vm.runInNewContext(source,{exports:out,window:{open:(...args)=>windows.push(args)},require:()=>({jsx:(type,props)=>({type,props})})});
const click=(tree,detail=1)=>tree.props.onClick({detail,preventDefault(){}});
test('one click or tap opens photo and double-click does not open a second viewer',()=>{
 let opens=0;const tree=out.default({href:'/photo.jpg',label:'사진',onOpen:()=>opens++});
 click(tree);assert.equal(opens,1);click(tree,2);assert.equal(opens,1);
 assert.doesNotMatch(tree.props['aria-label'],/두 번/);
});
test('keyboard activation opens photo',()=>{
 let opens=0;click(out.default({href:'/photo.jpg',label:'사진',onOpen:()=>opens++}),0);assert.equal(opens,1);
});
test('legacy photo opens safely on first click',()=>{
 windows.length=0;click(out.default({href:'blob:photo',label:'사진'}));
 assert.equal(windows.length,1);assert.equal(windows[0][0],'blob:photo');assert.match(windows[0][2],/noopener/);
});
