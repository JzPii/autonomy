import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const ids=process.argv.slice(2).length?process.argv.slice(2):fs.readdirSync('models').filter(d=>fs.existsSync(`public/models/${d}/manifest.json`));
for(const id of ids){for(const s of ['validate-model.mjs','validate-explosion.mjs'])execFileSync('node',['--experimental-strip-types',`scripts/${s}`,id],{stdio:'inherit'})}
execFileSync('node',['--experimental-strip-types','scripts/validate-touch.mjs'],{stdio:'inherit'});
