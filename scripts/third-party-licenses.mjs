import fs from 'node:fs';
import path from 'node:path';

export function writeThirdPartyLicenses(destination){
 const root=process.cwd(),lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
 const sections=['Third-party dependency licenses\n\nGenerated from the locked npm packages. Includes runtime and build dependencies.\nThe Oswald font license is provided separately in OFL-Oswald.txt.'];
 for(const name of Object.keys(lock.packages).filter(name=>name.startsWith('node_modules/')).sort()){
  const directory=path.join(root,name),metadata=path.join(directory,'package.json');if(!fs.existsSync(metadata))continue;
  const pkg=JSON.parse(fs.readFileSync(metadata,'utf8'));
  const names=fs.readdirSync(directory).filter(name=>/^(?:licen[cs]e(?:$|[-.])|copying)/i.test(name)&&fs.statSync(path.join(directory,name)).isFile());
  const texts=names.map(name=>fs.readFileSync(path.join(directory,name),'utf8').replaceAll('\r\n','\n'));
  sections.push(`${pkg.name} ${pkg.version}\nLicense: ${typeof pkg.license==='string'?pkg.license:JSON.stringify(pkg.license??'See package license')}\n\n${texts.join('\n\n')||'The npm package does not include a separate license text. Consult the upstream package license.'}`);
 }
 fs.writeFileSync(path.join(destination,'THIRD_PARTY_LICENSES.txt'),sections.join('\n\n'+'='.repeat(72)+'\n\n')+'\n');
}
