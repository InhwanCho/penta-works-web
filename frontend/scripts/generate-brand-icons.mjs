// Run from frontend: node scripts/generate-brand-icons.mjs
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const root = new URL('../public/favicon/', import.meta.url);
const source = await fs.readFile(new URL('mreyes-mark.svg', root));
for (const [size, name] of [[16,'favicon-16x16.png'],[32,'favicon-32x32.png'],[180,'apple-touch-icon.png'],[192,'android-chrome-192x192.png'],[512,'android-chrome-512x512.png']]) {
  await sharp(source).resize(size,size).png().toFile(new URL(name,root).pathname);
}
// ICO entries use PNG payloads, retaining smooth edges and transparent corners.
const sizes=[16,32,48];
const payloads=await Promise.all(sizes.map(size=>sharp(source).resize(size,size).png().toBuffer()));
const header=Buffer.alloc(6+16*sizes.length);
header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
let offset=header.length;
for(let i=0;i<sizes.length;i++){
  const pos=6+i*16;
  header[pos]=sizes[i];header[pos+1]=sizes[i];
  header.writeUInt16LE(1,pos+4);header.writeUInt16LE(32,pos+6);
  header.writeUInt32LE(payloads[i].length,pos+8);header.writeUInt32LE(offset,pos+12);
  offset+=payloads[i].length;
}
const ico=Buffer.concat([header,...payloads]);
await fs.writeFile(new URL('favicon.ico',root),ico);
await fs.writeFile(new URL('../src/app/favicon.ico',import.meta.url),ico);
