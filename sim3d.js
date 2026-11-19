/* 3차시 '주사기 속 입자 모형' 3D 버전
   - app.js가 이 단계를 열 때만 불러옵니다 (Three.js 포함 약 0.7 MB).
   - 3D를 쓸 수 없는 기기에서는 app.js의 2D 모형이 그대로 쓰입니다.
   - 입자끼리의 충돌은 넣지 않은 단순 모형입니다. 온도(입자 속력)와 입자 수는 늘 같습니다. */
import * as THREE from './vendor/three.module.min.js';

var INK = 0x1B1F3B, YEL = 0xFFD43B, BLUE = 0x2F4BD8, BG = 0xF3F5FB;
var N = 50;            // 입자 수
var SPEED = 3.6;       // 입자 속력 (온도 일정 → 늘 같음)
var U = 0.33;          // 1 mL에 해당하는 길이
var RI = 0.95;         // 주사기 안쪽 반지름
var PR = 0.11;         // 입자 반지름
var X0 = -3.4;         // 막힌 끝(안쪽 면)의 위치
var GAP = 0.02;        // 입자 중심이 벽에 닿는 여유 — 작게 두어야 압력이 부피에 정확히 반비례해요
var VMAX = 20, VMIN = 7;

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function textSprite(txt, opt) {
  opt = opt || {};
  var fs = opt.size || 44, c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = '700 ' + fs + 'px "Noto Sans KR", sans-serif';
  var w = Math.ceil(g.measureText(txt).width) + 16, h = fs + 18;
  c.width = w; c.height = h;
  g.font = '700 ' + fs + 'px "Noto Sans KR", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = opt.color || '#1B1F3B';
  g.fillText(txt, w / 2, h / 2 + 2);
  var tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  var k = (opt.h || 0.32) / h; sp.scale.set(w * k, h * k, 1);
  return sp;
}

function flashTexture() {
  var s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  var g = c.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,212,59,0.85)'); gr.addColorStop(1, 'rgba(255,212,59,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

export function syringe3D(o) {
  var old = o.canvas, box = old.parentNode;
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
  catch (e) { return null; }
  if (!renderer.getContext()) return null;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cv = renderer.domElement;
  cv.className = 'sim3dcv';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', '끝을 막은 주사기의 입자 모형. 노란 입자들이 주사기 안에서 움직이며 벽과 피스톤에 충돌한다. 화면을 옆으로 끌면 주사기를 돌려 볼 수 있다.');
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(BG, 1);
  old.style.display = 'none';
  box.insertBefore(cv, old);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 2, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xC9CEE8, 1.1));
  var sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(3, 8, 5);
  scene.add(sun);

  // 돌려 볼 수 있는 주사기 전체
  var rig = new THREE.Group(); scene.add(rig);
  // 바닥에 비치는 부드러운 그림자
  (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(27,31,59,0.22)'); gr.addColorStop(0.6, 'rgba(27,31,59,0.08)'); gr.addColorStop(1, 'rgba(27,31,59,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    var sh = new THREE.Mesh(new THREE.PlaneGeometry(13, 1.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(2.1, -1.75, 0); scene.add(sh);
  })();
  function onX(geo) { geo.rotateZ(Math.PI / 2); return geo; }   // 원기둥을 x축으로 눕히기
  var inkMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.55 });
  var blueMat = new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.45 });

  // 주사기 몸통 (유리)
  var bodyLen = 20.8 * U, bodyMid = X0 + bodyLen / 2;
  var glass = new THREE.Mesh(onX(new THREE.CylinderGeometry(RI + 0.05, RI + 0.05, bodyLen, 48, 1, true)),
    new THREE.MeshStandardMaterial({ color: 0xBFD8FF, transparent: true, opacity: 0.2, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.x = bodyMid; glass.renderOrder = 2; rig.add(glass);
  var rimGeo = new THREE.TorusGeometry(RI + 0.05, 0.035, 8, 48); rimGeo.rotateY(Math.PI / 2);
  [X0, X0 + bodyLen].forEach(function (x) { var r = new THREE.Mesh(rimGeo, inkMat); r.position.x = x; rig.add(r); });
  // 손가락 걸이
  var flange = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.9, 0.5), inkMat);
  flange.position.x = X0 + bodyLen; rig.add(flange);
  // 막힌 끝: 바닥 + 주둥이 + 마개
  var endCap = new THREE.Mesh(onX(new THREE.CylinderGeometry(RI + 0.05, RI + 0.05, 0.14, 48)), inkMat);
  endCap.position.x = X0 - 0.07; rig.add(endCap);
  var tip = new THREE.Mesh(onX(new THREE.CylinderGeometry(0.16, 0.42, 0.5, 24)), new THREE.MeshStandardMaterial({ color: 0x868E96, roughness: 0.6 }));
  tip.position.x = X0 - 0.39; rig.add(tip);
  var plug = new THREE.Mesh(onX(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 24)), inkMat);
  plug.position.x = X0 - 0.78; rig.add(plug);
  var plugLab = textSprite('막음', { h: 0.44 }); plugLab.position.set(X0 - 0.75, 1.2, 0); rig.add(plugLab);

  // 눈금 (몸통 앞쪽 아래에 인쇄된 것처럼)
  var tickMat = new THREE.MeshBasicMaterial({ color: INK });
  for (var m = 0; m <= 20; m++) {
    var major = m % 5 === 0, th = major ? 0.34 : 0.18, yc = -0.45 - th / 2;
    var t = new THREE.Mesh(new THREE.BoxGeometry(0.025, th, 0.01), tickMat);
    t.position.set(X0 + m * U, yc, Math.sqrt((RI + 0.05) * (RI + 0.05) - yc * yc) + 0.004);
    t.rotation.x = -Math.asin(yc / (RI + 0.05));
    rig.add(t);
    if (major) { var nl = textSprite(String(m), { h: 0.42 }); nl.position.set(X0 + m * U, -RI - 0.42, 0.75); rig.add(nl); }
  }
  var mlLab = textSprite('mL', { h: 0.42 }); mlLab.position.set(X0 + 20 * U + 0.6, -RI - 0.42, 0.75); rig.add(mlLab);

  // 피스톤 (고무 마개 + 막대 + 누르개)
  var piston = new THREE.Group(); rig.add(piston);
  var gasket = new THREE.Mesh(onX(new THREE.CylinderGeometry(RI, RI, 0.32, 48)), inkMat);
  gasket.position.x = 0.16; piston.add(gasket);
  var rodLen = 13.9 * U + 0.25;   // 7 mL까지 밀어도 누르개가 몸통 밖에 있도록
  var rod = new THREE.Mesh(new THREE.BoxGeometry(rodLen, 0.18, 0.6), blueMat);
  rod.position.x = 0.32 + rodLen / 2; piston.add(rod);
  var rod2 = new THREE.Mesh(new THREE.BoxGeometry(rodLen, 0.6, 0.18), blueMat);
  rod2.position.x = rod.position.x; piston.add(rod2);
  var thumb = new THREE.Mesh(onX(new THREE.CylinderGeometry(1.0, 1.0, 0.14, 40)), blueMat);
  thumb.position.x = 0.32 + rodLen; piston.add(thumb);
  var push = textSprite('◀ 미는 힘', { h: 0.44, color: '#A61E6E' });
  push.position.set(0.32 + rodLen - 0.3, 1.75, 0); push.visible = false; piston.add(push);

  // 입자 (노란 공 + 남색 테두리)
  var fill = new THREE.InstancedMesh(new THREE.SphereGeometry(PR, 16, 12), new THREE.MeshStandardMaterial({ color: YEL, emissive: YEL, emissiveIntensity: 0.28, roughness: 0.45 }), N);
  var edge = new THREE.InstancedMesh(new THREE.SphereGeometry(PR * 1.22, 12, 10), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }), N);
  rig.add(fill); rig.add(edge);

  // 충돌 반짝임
  var ftex = flashTexture(), flashes = [], fi = 0;
  for (var k = 0; k < 40; k++) {
    var fs = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    fs.visible = false; fs.renderOrder = 3; rig.add(fs); flashes.push({ s: fs, t0: 0, on: false });
  }
  function flash(x, y, z, now) {
    if (reduce) return;
    var f = flashes[fi]; fi = (fi + 1) % flashes.length;
    f.s.position.set(x, y, z); f.t0 = now; f.on = true; f.s.visible = true;
  }

  // 입자 초기화
  var P = [];
  for (var i = 0; i < N; i++) {
    var a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * (RI - PR);
    var d = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    while (d.lengthSq() > 1 || d.lengthSq() < 0.01) d.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    d.normalize().multiplyScalar(SPEED);
    P.push({ x: X0 + PR + Math.random() * (VMAX * U - 2 * PR), y: rr * Math.cos(a), z: rr * Math.sin(a), vx: d.x, vy: d.y, vz: d.z, hit: -1e9 });
  }
  // 이 입자들이 20 mL에서 양 끝 벽에 1초 동안 충돌할 기대 횟수 → 1기압으로 맞추는 기준
  var sumVx = P.reduce(function (t, p) { return t + Math.abs(p.vx); }, 0);
  function expRate(v) { return sumVx / (v * U - 2 * GAP); }
  var R20 = expRate(VMAX);

  // 소리
  var actx = null, soundOn = true, lastSnd = 0, rateNow = 0;
  function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { soundOn = false; } } if (actx && actx.state === 'suspended') actx.resume(); }
  function pop(now) {
    if (!soundOn || !actx || actx.state !== 'running') return;
    var r = Math.min(rateNow / R20, 3);           // 20 mL일 때 1, 7 mL 근처에서 약 3
    var gap = Math.max(22, 95 - r * 24);           // 충돌이 잦을수록 더 촘촘하게
    if (now - lastSnd < gap) return; lastSnd = now;
    var t0 = actx.currentTime, osc = actx.createOscillator(), gn = actx.createGain();
    var f0 = 330 + r * 150;                        // 330Hz(여유) ~ 780Hz(빽빽)
    osc.type = 'sine'; osc.frequency.setValueAtTime(f0, t0); osc.frequency.exponentialRampToValueAtTime(f0 * 0.35, t0 + 0.05);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.06 + r * 0.03, t0 + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    osc.connect(gn).connect(actx.destination); osc.start(t0); osc.stop(t0 + 0.1);
  }
  var sb = o.sound;
  function paintSound() { if (sb) { sb.textContent = soundOn ? '🔊 충돌 소리 켜짐' : '🔇 충돌 소리 꺼짐'; sb.setAttribute('aria-pressed', soundOn ? 'true' : 'false'); } }
  function onSound() { soundOn = !soundOn; if (soundOn) audio(); paintSound(); }
  if (sb) { sb.hidden = false; sb.addEventListener('click', onSound); paintSound(); }
  function firstTouch() { if (soundOn) audio(); }
  box.addEventListener('pointerdown', firstTouch);

  // 부피 조절
  var vT = +o.slider.value || VMAX, vNow = vT, settleAt = performance.now();
  function onSlide() { vT = +o.slider.value; o.out.textContent = vT + ' mL'; settleAt = 1e15; firstTouch(); }
  o.slider.addEventListener('input', onSlide);
  vT = +o.slider.value || VMAX; vNow = vT; settleAt = 0;

  // 끌어서 돌려 보기
  var drag = null, yaw = -0.18, pitch = 0.12, yawT = yaw, pitchT = pitch;
  cv.style.touchAction = 'pan-y';
  cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, yaw: yawT, pitch: pitchT }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', function (e) { if (!drag) return; yawT = Math.max(-1.1, Math.min(1.1, drag.yaw + (e.clientX - drag.x) * 0.008)); pitchT = Math.max(-0.2, Math.min(0.55, drag.pitch + (e.clientY - drag.y) * 0.004)); });
  function endDrag() { drag = null; }
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('dblclick', function () { yawT = -0.18; pitchT = 0.12; });

  // 크기 맞추기
  function fit() {
    var w = box.clientWidth || 600, h = Math.round(Math.max(190, Math.min(400, w * (w < 560 ? 0.56 : 0.46))));
    renderer.setSize(w, h, false); cv.style.width = '100%'; cv.style.height = h + 'px';
    camera.aspect = w / h;
    // 주사기 전체(막음 ~ 누르개, 약 13칸)가 가로에 꼭 맞도록 거리 계산
    var halfW = 7.0, tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    var z = Math.max(halfW / (tanV * camera.aspect), 2.6 / tanV) + 1.2;
    camera.position.set(2.05, z * 0.2, z); camera.lookAt(2.05, -0.15, 0);
    camera.updateProjectionMatrix();
  }
  var ro = window.ResizeObserver ? new ResizeObserver(fit) : null;
  if (ro) ro.observe(box); else window.addEventListener('resize', fit);
  fit();

  // 측정: 넓이가 변하지 않는 양 끝 벽(막힌 끝 + 피스톤)에 부딪힌 순간들
  var hits = [], model = {}, cmp = o.extra, data = o.data;

  function bar(name, val, txt) { return '<div class="g"><span>' + name + '</span><div class="gb"><i style="width:' + Math.max(4, Math.min(100, val)) + '%"></i></div><b>' + txt + '</b></div>'; }

  function graph(liveV, liveP) {
    if (!cmp) return;
    var W = 560, H = 290, L = 56, Rr = 18, T = 34, B = 46, xa = 6, xb = 21, ya = 0, yb = 3.2;
    function X(v) { return L + (v - xa) / (xb - xa) * (W - L - Rr); }
    function Y(p) { return H - B - (p - ya) / (yb - ya) * (H - T - B); }
    var s = '<svg class="graph cmpg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="부피와 압력 그래프. 내 실험값과 입자 모형의 값을 비교한다.">';
    for (var p = 0; p <= 3; p += 0.5) s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + Y(p) + '" y2="' + Y(p) + '" stroke="#E2E6F3" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (Y(p) + 5) + '" text-anchor="end" font-size="13" fill="#555B80">' + p.toFixed(1) + '</text>';
    for (var v = 6; v <= 21; v++) if (v % 2 === 0) s += '<line x1="' + X(v) + '" x2="' + X(v) + '" y1="' + Y(0) + '" y2="' + (Y(0) + 6) + '" stroke="#1B1F3B" stroke-width="1.5"/><text x="' + X(v) + '" y="' + (Y(0) + 22) + '" text-anchor="middle" font-size="13" fill="#555B80">' + v + '</text>';
    s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="#1B1F3B" stroke-width="2"/><line x1="' + L + '" x2="' + L + '" y1="' + T + '" y2="' + Y(0) + '" stroke="#1B1F3B" stroke-width="2"/>';
    s += '<text x="' + ((L + W - Rr) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="14" font-weight="700" fill="#1B1F3B">부피 (mL)</text><text x="14" y="' + (T - 14) + '" font-size="14" font-weight="700" fill="#1B1F3B">압력 (기압)</text>';
    // 반비례 곡선 (안내선)
    var pts = []; for (var q = 6.5; q <= 21; q += 0.25) pts.push(X(q).toFixed(1) + ',' + Y(20 / q).toFixed(1));
    s += '<polyline fill="none" stroke="#9AA0BF" stroke-width="2" stroke-dasharray="6 5" points="' + pts.join(' ') + '"/>';
    // 내 실험값
    if (data && data.rows.length) data.rows.forEach(function (r) {
      if (r[0] < xa || r[0] > xb || r[1] > yb) return;
      s += '<circle cx="' + X(r[0]) + '" cy="' + Y(r[1]) + '" r="7" fill="#FFD43B" stroke="#1B1F3B" stroke-width="2.5"><title>' + (data.sample ? '예시 자료' : '내 실험값') + ' ' + r[0] + ' mL, ' + r[1].toFixed(2) + '기압</title></circle>';
    });
    // 입자 모형 값
    Object.keys(model).forEach(function (kv) {
      var v = +kv, p = model[kv]; if (p > yb) return; var cx = X(v), cy = Y(p);
      s += '<rect x="' + (cx - 6) + '" y="' + (cy - 6) + '" width="12" height="12" transform="rotate(45 ' + cx + ' ' + cy + ')" fill="#2F4BD8" stroke="#fff" stroke-width="2"><title>입자 모형 ' + v + ' mL, 약 ' + p.toFixed(2) + '기압</title></rect>';
    });
    // 지금 재는 중인 값
    if (liveP != null && liveP <= yb) s += '<rect x="' + (X(liveV) - 7) + '" y="' + (Y(liveP) - 7) + '" width="14" height="14" transform="rotate(45 ' + X(liveV) + ' ' + Y(liveP) + ')" fill="none" stroke="#2F4BD8" stroke-width="2" stroke-dasharray="3 3"/>';
    s += '</svg>';
    var lg = '<div class="cmplg"><span><i class="dy"></i>' + (data ? (data.sample ? '예시 자료' : '내 실험값 (센서)') : '내 실험값') + '</span><span><i class="db"></i>입자 모형</span><span><i class="dl"></i>반비례 곡선</span></div>';
    var note = data ? (data.sample ? '<p class="tiny">노란 점은 <b>예시 자료</b>예요. 앞 단계 표에 우리 모둠 값을 넣으면 내 값으로 바뀌어요.</p>' : '')
      : '<p class="tiny">앞 단계 ‘자료 입력과 그래프’에 값을 넣으면 <b>내 실험값</b>이 노란 점으로 함께 나와요.</p>';
    var n = Object.keys(model).length;
    cmp.innerHTML = '<div class="cmp"><h4>🔍 내가 잰 값 vs 입자 모형</h4>' + lg + s +
      '<p class="tiny">파란 마름모는 모형 속 입자가 <b>양 끝 벽(막힌 끝과 피스톤)</b>에 부딪힌 횟수로 계산한 압력이에요. 20 mL일 때를 1기압으로 맞췄어요. ' +
      (n < 3 ? '슬라이더를 여러 부피에 놓고 <b>잠깐 기다리면</b> 점이 찍혀요. (지금 ' + n + '개)' : '모형의 점도 반비례 곡선을 따라가나요?') + '</p>' + note + '</div>';
  }

  var simT = 0, lastSig = '', run = true, last = performance.now(), frame = 0, mtx = new THREE.Matrix4(), q0 = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  graph();

  function loop(now) {
    if (!run) return;
    if (!document.body.contains(cv)) { stop(); return; }
    requestAnimationFrame(loop);
    var dt = Math.min(0.034, (now - last) / 1000); last = now; frame++; simT += dt * 1000;   // 느린 기기에서도 압력이 맞게: 모형 속 시간으로 재요

    // 피스톤이 목표 부피를 향해 부드럽게 이동
    var moving = Math.abs(vT - vNow) > 0.02;
    if (moving) vNow += (vT - vNow) * (1 - Math.exp(-dt * 3.2)); else { vNow = vT; if (settleAt > simT) settleAt = simT; }
    var xr = X0 + vNow * U;
    piston.position.x = xr; push.visible = vT < VMAX - 0.5;

    var lo = X0 + GAP, hi = xr - GAP, lim = RI - PR;
    for (var i = 0; i < N; i++) {
      var p = P[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      var r2 = p.y * p.y + p.z * p.z;
      if (r2 > lim * lim) {
        var r = Math.sqrt(r2), nx = p.y / r, nz = p.z / r, dn = p.vy * nx + p.vz * nz;
        if (dn > 0) { p.vy -= 2 * dn * nx; p.vz -= 2 * dn * nz; p.hit = now; flash(p.x, nx * RI, nz * RI, now); pop(now); }
        p.y = nx * lim; p.z = nz * lim;
      }
      if (p.x < lo) { p.x = lo; if (p.vx < 0) { p.vx = -p.vx; p.hit = now; hits.push(simT); flash(X0, p.y, p.z, now); pop(now); } }
      if (p.x > hi) { p.x = hi; if (p.vx > 0) { p.vx = -p.vx; p.hit = now; hits.push(simT); flash(xr, p.y, p.z, now); pop(now); } }
      var e = now - p.hit, k2 = 1;
      if (!reduce && e < 170) { var t = e / 170; k2 = 1 + 0.55 * Math.sin(t * Math.PI) * (1 - t); }
      pv.set(p.x, p.y, p.z); sv.set(k2, k2, k2);
      mtx.compose(pv, q0, sv); fill.setMatrixAt(i, mtx); edge.setMatrixAt(i, mtx);
    }
    fill.instanceMatrix.needsUpdate = true; edge.instanceMatrix.needsUpdate = true;
    while (hits.length && hits[0] < simT - 6000) hits.shift();

    for (var j = 0; j < flashes.length; j++) {
      var f = flashes[j]; if (!f.on) continue;
      var u = (now - f.t0) / 230;
      if (u >= 1) { f.on = false; f.s.visible = false; continue; }
      var sz = 0.12 + u * 0.55; f.s.scale.set(sz, sz, 1); f.s.material.opacity = 1 - u;
    }

    yaw += (yawT - yaw) * 0.15; pitch += (pitchT - pitch) * 0.15;
    rig.rotation.y = yaw; rig.rotation.x = pitch;
    renderer.render(scene, camera);

    // 최근 1.5초 충돌 빈도 → 소리
    var c15 = 0; for (var h = hits.length - 1; h >= 0 && hits[h] > simT - 1500; h--) c15++;
    rateNow = c15 / 1.5;

    if (frame % 12 === 0) {
      var c3 = 0; for (var h3 = hits.length - 1; h3 >= 0 && hits[h3] > simT - 3000; h3--) c3++;
      var pTheory = VMAX / vNow, top = expRate(VMIN) * 3;
      o.gauges.innerHTML = bar('주사기 속 부피', vNow / VMAX * 100, vNow.toFixed(0) + ' mL') +
        bar('양 끝 벽에 충돌한 횟수 (3초)', c3 / top * 100, c3 + '번') +
        bar('기체의 압력', pTheory / 3 * 100, '약 ' + pTheory.toFixed(1) + '기압') +
        bar('입자 수 · 크기 · 빠르기', 47, '그대로');
      o.status.textContent = moving ? '피스톤이 움직이는 중…' : vT === VMAX ? '처음 상태예요. 피스톤을 밀어 부피를 줄여 보세요.' : '공간이 좁아져 같은 수의 입자가 벽에 더 자주 부딪혀요 → 압력이 커져요';

      // 멈춘 뒤 2.5초가 지나면, 멈춘 뒤 쌓인 충돌(최대 6초)로 모형의 압력을 계산해 점으로 찍어요
      var live = null;
      if (!moving && simT - settleAt > 600) {
        var win = Math.min(6000, simT - settleAt), cnt = 0;
        for (var h6 = hits.length - 1; h6 >= 0 && hits[h6] > simT - win; h6--) cnt++;
        live = (cnt / (win / 1000)) / R20;
        if (simT - settleAt > 2500) model[vT] = live;
      }
      var sig = Object.keys(model).map(function (kv) { return kv + ':' + model[kv].toFixed(2); }).join('|') + '#' + vNow.toFixed(1) + '#' + (live == null ? '' : live.toFixed(2));
      if (frame % 24 === 0 && sig !== lastSig) { lastSig = sig; graph(vNow, live); }
    }
  }
  requestAnimationFrame(loop);

  function stop() {
    if (!run) return; run = false;
    if (ro) ro.disconnect(); else window.removeEventListener('resize', fit);
    o.slider.removeEventListener('input', onSlide);
    if (sb) sb.removeEventListener('click', onSound);
    box.removeEventListener('pointerdown', firstTouch);
    if (actx) { try { actx.close(); } catch (e) { } }
    scene.traverse(function (ob) { if (ob.geometry) ob.geometry.dispose(); if (ob.material) { if (ob.material.map) ob.material.map.dispose(); ob.material.dispose(); } });
    renderer.dispose();
  }
  return { stop: stop };
}

// app.js가 <script type="module">로 불러온 뒤 찾을 수 있게
window.GasSim3D = { syringe3D: syringe3D };
