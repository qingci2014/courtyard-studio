// One-time adaptation from the user's MIT-licensed floorplan project.
import fs from 'node:fs/promises';
import vm from 'node:vm';
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Pass the original floor/index.html path');
const source = await fs.readFile(sourcePath, 'utf8');
await fs.mkdir('src', {recursive:true});
const between = (a,b) => source.slice(source.indexOf(a), source.indexOf(b,source.indexOf(a)));
const provenance = '// Adapted from wy51ai/floorplan-3d (MIT), via qingci2014/courtyard-studio\n// Reference commit: 54d45f8e6057e6f726dc08ea359742afca43ea59\n';
const catalog = between('const MATS =', 'const typeColor =');
await fs.writeFile('src/catalog.js', provenance + catalog + '\nexport {MATS, LIB};\n');
const models = between('const matCache = new Map();', '/* ======================= 建筑 ======================= */').replace('let envTex = null, envK = 1;', "let envTex = null, envK = 1;\nconst glassMat = new THREE.MeshStandardMaterial({color:'#c4dce0',roughness:.16,transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide});\nconst frameMat = new THREE.MeshStandardMaterial({color:'#677a73',roughness:.4,metalness:.3});");
await fs.writeFile('src/assets.js', provenance + "import * as THREE from 'three';\nimport {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';\nlet renderer;\nconst M = v => v / 1000, wx = M, wz = M;\nexport function configureAssets(r){renderer = r;}\n" + models + '\nexport {buildFurniture, floorMat, mat, box};\n');
const svg = between("const ST = 'stroke=", '/* ======================= 渲染 ======================= */');
const shade = between('function hex2rgb(h)', 'function buildDefs()');
await fs.writeFile('src/furniture-svg.js',provenance + shade + svg + '\nexport {furnSVG};\n');
const context={}; vm.createContext(context);
const data = between('const WALLS =', 'const MATS =');
const furn = between('let _n', 'function defaultState()');
// The sample keeps its original millimetre geometry; the adapter normalizes it.
vm.runInContext(catalog + data + "\n" + between('const typeColor =','function defaultState()') + '\nthis.sample={WALLS,WINS,DOORS,SLIDES,ROOMS,furniture:defaultFurniture()};',context);
await fs.writeFile('src/reference-sample.json',JSON.stringify(context.sample,null,2));
console.log('Extracted furniture models, materials, SVG symbols and original sample.');
