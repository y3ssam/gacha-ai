import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for(const directory of ['src','bridge'])for(const name of readdirSync(directory))if(/\.(m?js)$/.test(name)){
 const r=spawnSync(process.execPath,['--check',`${directory}/${name}`],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);
}
