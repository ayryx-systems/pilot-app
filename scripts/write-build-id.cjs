const fs = require('fs');
const path = require('path');

const buildId = Date.now().toString();
const outPath = path.join(process.cwd(), '.build-id.json');
fs.writeFileSync(outPath, JSON.stringify({ buildId }), 'utf8');
console.log('Wrote build ID:', buildId);
