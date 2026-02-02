const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'Productos.jsx');
const s = fs.readFileSync(file, 'utf8');
function checkPairs(str, open, close) {
  const stackIdx = [];
  for (let i=0;i<str.length;i++){
    if (str[i]===open) stackIdx.push(i);
    else if (str[i]===close) stackIdx.pop();
    if (stackIdx.length<0) return {ok:false, pos:i};
  }
  return {ok: stackIdx.length===0, remaining: stackIdx.length, lastOpen: stackIdx[stackIdx.length-1]};
}
const pairs = [['(',')'], ['{','}'], ['[',']']];
let ok=true;
for (const [o,c] of pairs){
  const r = checkPairs(s,o,c);
  console.log(`${o}${c}:`, r);
  if (!r.ok) ok=false;
}
if (ok) console.log('All basic pairs balanced.');

// If there is an unmatched parenthesis, print its line/column and context
const rPar = checkPairs(s,'(',')');
if (!rPar.ok && typeof rPar.lastOpen === 'number'){
  const idx = rPar.lastOpen;
  const before = s.slice(Math.max(0, idx-80), idx+80);
  const lines = s.slice(0, idx).split(/\r?\n/);
  const lineNum = lines.length;
  const col = lines[lines.length-1].length + 1;
  console.log('\nUnmatched ( at index', idx, 'line', lineNum, 'col', col);
  console.log('Context:\n', before);
}

// Print parentheses balance per line to help locate mismatch
const linesAll = s.split(/\r?\n/);
let bal = 0;
for (let i=0;i<linesAll.length;i++){
  const line = linesAll[i];
  for (const ch of line){
    if (ch==='(') bal++;
    if (ch===')') bal--;
  }
  if (bal !== 0) {
    // print when balance changes
    console.log(`Line ${i+1} balance after line: ${bal}`);
  }
}
