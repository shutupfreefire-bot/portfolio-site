import * as THREE from 'three';

/* ---------------- LEAD FORM ---------------- */
// Paste the Apps Script /exec URL here after deploying (see apps-script.gs)
const FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzLpvc8pM-2uvl-KQ35UVgpNjZHBRDQkFoloVm9OZ7fjNnNmgIcTK6_P1xJ298v_zLT/exec';

const form = document.getElementById('lead-form');
const statusEl = document.getElementById('f-status');
const submitBtn = document.getElementById('f-submit');

// crossfade the status text between states: fade out 120ms, swap text, fade in 180ms
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function setStatus(text, cls) {
  if (reduceMotion) {
    statusEl.className = 'f-status mono' + (cls ? ' ' + cls : '');
    statusEl.textContent = text;
    return;
  }
  statusEl.classList.add('swap');
  setTimeout(() => {
    statusEl.className = 'f-status mono' + (cls ? ' ' + cls : '');
    statusEl.textContent = text;
    requestAnimationFrame(() => statusEl.classList.remove('swap'));
  }, 120);
}

if (form && !FORM_ENDPOINT.includes('PASTE_')) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // client-side validation
    let valid = true;
    form.querySelectorAll('[required]').forEach((f) => {
      const bad = !f.value.trim() || (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value));
      f.classList.toggle('err', bad);
      if (bad) valid = false;
    });
    if (!valid) {
      setStatus('Fill the highlighted fields.', 'bad');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.45';
    setStatus('Sending...');

    const payload = Object.fromEntries(new FormData(form).entries());
    payload.source = 'portfolio-site';

    try {
      // no-cors: Apps Script doesn't send CORS headers on POST; we fire and confirm via response ok path
      await fetch(FORM_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      form.reset();
      setStatus('Sent. I will get back to you soon.', 'ok');
    } catch (err) {
      setStatus('Something broke. WhatsApp me instead.', 'bad');
    } finally {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '';
    }
  });
}

/* ---------------- SCROLL REVEAL ---------------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) {
      en.target.classList.add('in');
      io.unobserve(en.target);
    }
  });
}, { threshold: 0.12 });
// stagger indexes for grid children
document.querySelectorAll('.stagger').forEach((grid) => {
  [...grid.children].forEach((child, i) => child.style.setProperty('--i', i));
});
document.querySelectorAll('.rv, .rv-sm').forEach((el) => io.observe(el));
// safety net: reveal everything already above the fold on load
window.addEventListener('load', () => {
  document.querySelectorAll('.rv:not(.in), .rv-sm:not(.in)').forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in');
  });
});

/* ---------------- MARQUEE: pause off-screen ---------------- */
const marquee = document.querySelector('.marquee');
if (marquee) {
  const mio = new IntersectionObserver((entries) => {
    entries.forEach((en) => marquee.classList.toggle('off', !en.isIntersecting));
  }, { threshold: 0 });
  mio.observe(marquee);
}

/* ---------------- LOADER ---------------- */
const loader = document.getElementById('loader');
const barFill = document.getElementById('bar-fill');
const pct = document.getElementById('pct');

// Fake-but-tied-to-reality progress: jumps at real milestones (scene built, fonts ready, first frame)
let progress = 0;
function setProgress(p) {
  progress = Math.max(progress, p);
  barFill.style.right = `${100 - progress}%`;
  pct.textContent = `${Math.round(progress)}%`;
}
setProgress(10);

const sceneReady = new Promise((res) => { window.__sceneReady = res; });
const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

Promise.all([sceneReady, fontsReady, new Promise(r => setTimeout(r, 1400))]).then(() => {
  setProgress(100);
  setTimeout(() => {
    loader.classList.add('done');
    document.body.classList.add('ready');
  }, 350);
});

// smooth fake ticks while loading
const tick = setInterval(() => setProgress(Math.min(progress + 4, 90)), 120);
sceneReady.then(() => clearInterval(tick));

/* ---------------- THREE SCENE ---------------- */
const canvas = document.getElementById('gl');
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 8);

// --- the object: an icosahedron core + orbiting rings + particle halo ---
const group = new THREE.Group();
scene.add(group);

const core = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.5, 1),
  new THREE.MeshStandardMaterial({
    color: 0x1a1a22, metalness: 0.9, roughness: 0.28,
    flatShading: true,
    emissive: 0x2a2a12, emissiveIntensity: 0.35,
  })
);
group.add(core);

// wireframe overlay on the core
const wire = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.52, 1),
  new THREE.MeshBasicMaterial({ color: 0xe8ff47, wireframe: true, transparent: true, opacity: 0.12 })
);
group.add(wire);

// orbiting rings
const rings = [];
for (let i = 0; i < 3; i++) {
  const r = new THREE.Mesh(
    new THREE.TorusGeometry(2.2 + i * 0.45, 0.012, 8, 128),
    new THREE.MeshBasicMaterial({ color: i === 1 ? 0xe8ff47 : 0x555560, transparent: true, opacity: i === 1 ? 0.55 : 0.25 })
  );
  r.rotation.x = Math.PI / 2.6 + i * 0.5;
  r.rotation.y = i * 0.7;
  group.add(r);
  rings.push(r);
}

// particle halo
const COUNT = 500;
const pos = new Float32Array(COUNT * 3);
for (let i = 0; i < COUNT; i++) {
  const r = 2.6 + Math.random() * 2.4;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
  pos[i * 3 + 2] = r * Math.cos(phi);
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
const halo = new THREE.Points(pGeo, new THREE.PointsMaterial({
  color: 0xe8ff47, size: 0.028, transparent: true, opacity: 0.5,
  depthWrite: false, blending: THREE.AdditiveBlending,
}));
group.add(halo);

// lights
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const key = new THREE.DirectionalLight(0xfff8e0, 2.2); key.position.set(4, 5, 6); scene.add(key);
const rim = new THREE.PointLight(0xe8ff47, 18, 20); rim.position.set(-5, -3, 4); scene.add(rim);

/* ---------------- INTERACTION: drag to rotate, inertia, hover pulse ---------------- */
const drag = { on: false, x: 0, y: 0, vx: 0, vy: 0, rx: 0, ry: 0 };
let hovered = false;

canvas.addEventListener('pointerdown', (e) => { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { drag.on = false; });
canvas.addEventListener('pointermove', (e) => {
  if (drag.on) {
    drag.vy = (e.clientX - drag.x) * 0.005;
    drag.vx = (e.clientY - drag.y) * 0.005;
    drag.x = e.clientX; drag.y = e.clientY;
  }
});
canvas.addEventListener('pointerenter', () => { hovered = true; });
canvas.addEventListener('pointerleave', () => { hovered = false; });

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

const clock = new THREE.Clock();

function animate() {
  const t = clock.getElapsedTime();

  if (!drag.on) {
    // inertia decay + gentle idle spin
    drag.vy *= 0.95; drag.vx *= 0.95;
    if (!reduceMotion) drag.ry += 0.003;
  }
  drag.rx += drag.vx; drag.ry += drag.vy;
  drag.rx = Math.max(-1.2, Math.min(1.2, drag.rx));

  group.rotation.y = drag.ry;
  group.rotation.x = drag.rx;

  if (!reduceMotion) {
    rings.forEach((r, i) => { r.rotation.z = t * (0.12 + i * 0.07) * (i % 2 ? -1 : 1); });
    halo.rotation.y = t * 0.05;
    // hover: core breathes
    const target = hovered ? 1.08 : 1;
    core.scale.lerp(new THREE.Vector3(target, target, target), 0.08);
    wire.scale.copy(core.scale);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
window.__sceneReady();
