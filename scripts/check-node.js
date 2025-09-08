#!/usr/bin/env node
const semver = process.versions.node.split('.').map(n=>parseInt(n,10));
const [major] = semver;
if(major >=21 || major <20){
  console.error(`Node ${process.version} not supported. Please switch to Node 20 LTS.`);
  process.exit(1);
}
console.log(`Node version OK (${process.version}).`);
