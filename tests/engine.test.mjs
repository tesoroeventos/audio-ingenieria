// Tests del motor de cálculo de Tesoro PA.
// Se corren con:  node --test tests/
// No hace falta instalar nada. Leen el bloque marcado como MOTOR dentro de index.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function cargarMotor() {
  const ini = html.indexOf('/* MOTOR:INICIO */');
  const fin = html.indexOf('/* MOTOR:FIN */');
  assert.ok(ini >= 0 && fin > ini, 'index.html tiene que tener el bloque MOTOR:INICIO ... MOTOR:FIN');
  const ctx = vm.createContext({ console });
  vm.runInContext(html.slice(ini, fin), ctx);
  const run = (code) => vm.runInContext(code, ctx);
  run('S.env.temp=20;S.env.earH=1.6;S.env.head=6;');
  return run;
}

const C20 = 331.3 + 0.606 * 20; // 343,42 m/s
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} esperado ${b}, dio ${a}`);

// Cajas completas para los tests. Respuesta natural muy abierta para que en el cruce
// manden los filtros del procesador y no la caja.
const CAJAS = `LIB.push(
 {id:'t-top',type:'ps',brand:'Test',model:'Top',f:{sens:97,rms:400,hCov:90,vCov:60,fLow:5,fHigh:20000,w:0.4,h:0.6}},
 {id:'t-sub',type:'sub',brand:'Test',model:'Sub',f:{sens:98,rms:1000,fLow:2,fHigh:5000,w:0.6,h:0.55,d:0.75}});`;

test('velocidad del sonido a 20 °C', () => {
  const run = cargarMotor();
  cerca(run('C()'), 343.42, 1e-9);
});

test('perilla de fase: 3,03 ms a 100 Hz son 109°', () => {
  const run = cargarMotor();
  const k = run('knobFor(3.03,100)');
  assert.equal(k.k, 109);
  assert.equal(k.err, 0);
});

test('perilla de fase: sin diferencia queda en 0°', () => {
  const run = cargarMotor();
  const { k, err, L } = run('knobFor(0,100)');
  assert.deepEqual({ k, err, L }, { k: 0, err: 0, L: 0 });
});

test('perilla de fase: si hace falta más de 180° se queda en el tope y avisa la diferencia', () => {
  const run = cargarMotor();
  const k = run('knobFor(6,100)'); // 216°
  assert.equal(k.k, 180);
  assert.equal(k.err, 36);
});

test('perilla de fase: cerca de 360° conviene volver a 0°', () => {
  const run = cargarMotor();
  const k = run('knobFor(8,100)'); // 288°
  assert.equal(k.k, 0);
  assert.equal(k.err, 72);
});

test('perilla de fase: si los tops llegan antes, se calcula la vuelta completa', () => {
  const run = cargarMotor();
  const k = run('knobFor(-1,100)'); // -36° es lo mismo que 324°
  assert.equal(k.L, 324);
  assert.equal(k.k, 0);
  assert.equal(k.err, 36);
});

test('Linkwitz-Riley 24: pasa bajos + pasa altos suman plano', () => {
  const run = cargarMotor();
  for (const f of [20, 40, 70, 100, 140, 250, 600, 1000]) {
    const [lr, li] = run(`filt('LR24',100,${f},false)`);
    const [hr, hi] = run(`filt('LR24',100,${f},true)`);
    cerca(Math.hypot(lr + hr, li + hi), 1, 1e-9, `suma a ${f} Hz`);
  }
});

test('Linkwitz-Riley 24: cada vía está 6 dB abajo en el corte', () => {
  const run = cargarMotor();
  const [r, i] = run(`filt('LR24',100,100,false)`);
  cerca(Math.hypot(r, i), 0.5, 1e-9);
});

test('Butterworth 12: 3 dB abajo en el corte', () => {
  const run = cargarMotor();
  const [r, i] = run(`filt('BW12',100,100,true)`);
  cerca(Math.hypot(r, i), Math.SQRT1_2, 1e-9);
});

test('caja activa: el nivel sale del SPL máximo menos pico y headroom', () => {
  const run = cargarMotor();
  cerca(run(`spl1m({f:{act:true,maxSpl:128}})`), 128 - 6 - 6, 1e-9);
});

test('caja pasiva: el nivel sale de sensibilidad y potencia', () => {
  const run = cargarMotor();
  cerca(run(`spl1m({f:{sens:97,rms:400}})`), 97 + 10 * Math.log10(400) - 6, 1e-9);
});

test('delay entre PA y subs: coincide con la cuenta a mano', () => {
  const run = cargarMotor();
  run(CAJAS + `S.pa={type:'ps',cab:'t-top',n:1,h:2.4,tilt:0};S.la.x=3;S.la.y=0;S.la.toe=0;
    S.subs.on=true;S.subs.list=[{x:-3,y:0,z:0.3,ang:0,delay:0,pol:1},{x:3,y:0,z:0.3,ang:0,delay:0,pol:1}];`);
  const g = run('geoAt({x:0,y:10,z:1.6})');
  const dT = Math.hypot(3, 10, 2.4 - 1.6);
  const dS = Math.hypot(3, 10, 0.3 - 1.6);
  cerca(g.dT, dT, 1e-9, 'recorrido del PA');
  cerca(g.dS, dS, 1e-9, 'recorrido de los subs');
  cerca(g.ms, (dT - dS) / C20 * 1000, 1e-9, 'delay');
});

test('delay entre PA y subs: el delay propio del sub cuenta como recorrido extra', () => {
  const run = cargarMotor();
  run(CAJAS + `S.pa={type:'ps',cab:'t-top',n:1,h:2.4,tilt:0};S.la.x=3;S.la.y=0;S.la.toe=0;
    S.subs.on=true;S.subs.list=[{x:0,y:0,z:0.3,ang:0,delay:2,pol:1}];`);
  const g = run('geoAt({x:0,y:10,z:1.6})');
  cerca(g.dS, Math.hypot(0, 10, 1.3) + 0.002 * C20, 1e-9);
});

test('modelo: una fuente sola cae 6 dB cada vez que se duplica la distancia', () => {
  const run = cargarMotor();
  run(CAJAS + `S.pa={type:'ps',cab:'t-top',n:1,h:1.6,tilt:0};S.la.x=0;S.la.y=0;S.la.toe=0;S.subs.on=false;S.ps=[];`);
  const a = run(`(()=>{const m=buildModel({sides:['L'],subs:false,ps:false});return energyAt(0,10,1.6,m,[1000]);})()`);
  const b = run(`(()=>{const m=buildModel({sides:['L'],subs:false,ps:false});return energyAt(0,20,1.6,m,[1000]);})()`);
  cerca(a - b, 20 * Math.log10(2), 0.15, 'caída de 10 a 20 m');
});

test('line array: con ángulo 0 las cajas cuelgan derechas', () => {
  const run = cargarMotor();
  const b = run(`laBoxes({n:2,site:0,splay:[0],rigH:7},{f:{h:0.3}})`);
  cerca(b[0].B[0], 0, 1e-12);
  cerca(b[0].B[1], 6.7, 1e-12);
  cerca(b[1].c[1], 6.55, 1e-12);
});

test('end-fire: la fila de adelante se retrasa la distancia entre filas', () => {
  const run = cargarMotor();
  run(CAJAS);
  const l = run(`genSubs({cab:'t-sub',cfg:'endfire',n:2,row:2,dsep:0.9,y:0.5,loc:'center',s:1})`);
  const adelante = l.find((s) => s.y === 0.5), atras = l.find((s) => s.y !== 0.5);
  cerca(adelante.delay, +(0.9 / C20 * 1000).toFixed(2), 1e-9);
  assert.equal(atras.delay, 0);
});

test('cardioide: el sub de atrás mira para atrás, invertido y retrasado', () => {
  const run = cargarMotor();
  run(CAJAS);
  const l = run(`genSubs({cab:'t-sub',cfg:'cardioid',n:2,dsep:0.9,y:0.5,loc:'center',s:1})`);
  const atras = l.find((s) => s.ang === 180);
  assert.equal(atras.pol, -1);
  cerca(atras.delay, +(0.9 / C20 * 1000).toFixed(2), 1e-9);
});

test('cajas distribuidas: delay respecto del PA', () => {
  const run = cargarMotor();
  run(CAJAS + `S.pa={type:'ps',cab:'t-top',n:1,h:2.4,tilt:0};S.la.x=3;S.la.y=0;S.la.toe=0;
    S.dist={ref:'pa',behind:3,offset:0,auto:true,gen:{}};
    S.ps=[{x:0,y:20,z:3,yaw:0,tilt:0,gain:0,delay:0,pol:1}];`);
  const d = run('distInfo(0)');
  const dSec = Math.hypot(0, 3, 3 - 1.6);
  const dMain = Math.hypot(3, 23, 2.4 - 1.6);
  cerca(d.ms, (dMain - dSec) / C20 * 1000, 1e-9);
});

test('cajas distribuidas sin PA: la primera fila es la referencia', () => {
  const run = cargarMotor();
  run(`S.pa.type='none';S.dist={ref:'first',behind:3,offset:5,auto:true,gen:{}};
    S.ps=[{x:-5,y:10,z:3,yaw:0},{x:5,y:10,z:3,yaw:0},{x:-5,y:20,z:3,yaw:0},{x:5,y:20,z:3,yaw:0}];`);
  const d = [0, 1, 2, 3].map((i) => run(`distInfo(${i})`));
  assert.equal(d[0].ms, 0);
  assert.equal(d[1].ms, 0);
  cerca(d[2].ms, d[3].ms, 1e-9, 'las dos cajas de la segunda fila');
  assert.ok(d[2].ms > 5, 'la segunda fila lleva delay');
});

test('ajuste por fase: con sub y top en el mismo lugar y LR24 da 0 ms y polaridad normal', () => {
  const run = cargarMotor();
  run(CAJAS + `S.pa={type:'ps',cab:'t-top',n:1,h:1.6,tilt:0};S.la.x=3;S.la.y=0;S.la.toe=0;
    S.subs={...S.subs,on:true,cab:'t-sub',cfg:'custom',list:[{x:-3,y:0,z:1.6,ang:0,delay:0,pol:1,gain:0},{x:3,y:0,z:1.6,ang:0,delay:0,pol:1,gain:0}]};
    S.xo={...S.xo,fc:100,hp:'LR24',lp:'LR24',subGain:0,subDelay:0,topDelay:0,subPol:1,topPol:1};`);
  const r = run('phaseOpt({x:0,y:15,z:1.6})');
  cerca(r.d, 0, 0.15, 'delay');
  assert.equal(r.pol, 1);
});

test('ajuste por fase: con LR12 pide invertir la polaridad', () => {
  const run = cargarMotor();
  run(CAJAS + `S.pa={type:'ps',cab:'t-top',n:1,h:1.6,tilt:0};S.la.x=3;S.la.y=0;S.la.toe=0;
    S.subs={...S.subs,on:true,cab:'t-sub',cfg:'custom',list:[{x:-3,y:0,z:1.6,ang:0,delay:0,pol:1,gain:0},{x:3,y:0,z:1.6,ang:0,delay:0,pol:1,gain:0}]};
    S.xo={...S.xo,fc:100,hp:'LR12',lp:'LR12',subGain:0,subDelay:0,topDelay:0,subPol:1,topPol:1};`);
  const r = run('phaseOpt({x:0,y:15,z:1.6})');
  assert.equal(r.pol, -1);
});
