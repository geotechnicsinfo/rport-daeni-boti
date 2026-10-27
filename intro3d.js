/* ============================================================
   Intro 3D – bloc de teren stilizat (EU-DEM 25 m) cu forajele și penetrările CPT
   „extrase” în ordinea execuției. Three.js r128, fără alte dependențe.
   window.initIntro3D(D, INV, CPT, T)  –  D = data.json, CPT = D.cpt.teste, T = terrain.json
   Parcul Dăeni are ~12 × 10 km, forajele 30 m: relieful (35–175 m) este exagerat ×VE, iar investigațiile
   sunt redate la scară verticală ×CORE_S („unități mari”); CPT-ul fiecărei turbine (în realitate în același
   punct cu forajul) este desenat schematic la R_CL m est de foraj; WT35nou la poziția sa reală.
   ============================================================ */
(function () {
  const VE = 5;             // exagerare verticală relief (amplitudine ~140 m -> ~700 m)
  const CORE_S = 22;        // 1 m de investigație = 22 m în scenă (foraj 30 m -> 660 m)
  const R_F = 110, R_C = 50; // raza carotei de foraj / a tijei CPT (m în plan)
  const R_CL = 170;         // deplasarea schematică a CPT-ului față de foraj (m în plan)
  const GAP = 160;          // distanța dintre teren și baza carotei extrase
  const BLUE = 0x0069B4, ORANGE = 0xF28C00, NAVY = 0x0A2F4F, WATER = 0x1F8FD8;

  window.initIntro3D = function (D, INV, CPT, T) {
    const host = document.getElementById('intro3d');
    if (!host || host.dataset.ready || !window.THREE || !T || !T.z) return;
    const THREE = window.THREE;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch (e) { host.classList.add('off'); return; }
    host.dataset.ready = '1';
    document.querySelector('.hero').classList.add('has3d');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xffffff, 0);
    host.appendChild(renderer.domElement);

    /* ---------- geometrie: proiecție locală (m) ---------- */
    const n = T.n, latc = (T.lat0 + T.lat1) / 2, lonc = (T.lon0 + T.lon1) / 2;
    const kx = 111320 * Math.cos(latc * Math.PI / 180), ky = 110540;
    const X = lon => (lon - lonc) * kx, Z = lat => -(lat - latc) * ky;
    const zmin = Math.min.apply(null, T.z), zmax = Math.max.apply(null, T.z);
    const H = z => (z - zmin) * VE;
    function zAt(lat, lon) {
      let fi = (lat - T.lat0) / (T.lat1 - T.lat0) * (n - 1), fj = (lon - T.lon0) / (T.lon1 - T.lon0) * (n - 1);
      fi = Math.max(0, Math.min(n - 1.001, fi)); fj = Math.max(0, Math.min(n - 1.001, fj));
      const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, g = (r, c) => T.z[r * n + c];
      return g(i, j) * (1 - a) * (1 - b) + g(i + 1, j) * a * (1 - b) + g(i, j + 1) * (1 - a) * b + g(i + 1, j + 1) * a * b;
    }
    const inside = (lat, lon) => lat >= T.lat0 && lat <= T.lat1 && lon >= T.lon0 && lon <= T.lon1;

    const SPAN = Math.max((T.lon1 - T.lon0) * kx, (T.lat1 - T.lat0) * ky);
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const sun = new THREE.DirectionalLight(0xffffff, 0.62); sun.position.set(-0.6, 1.4, 0.8); scene.add(sun);
    const world = new THREE.Group(); scene.add(world);

    /* ---------- teren ---------- */
    const pos = [], col = [], idx = [], cLo = new THREE.Color(0x8FB6D9), cHi = new THREE.Color(0xEAF1F7), c = new THREE.Color();
    const P = (i, j) => { const lat = T.lat0 + i * (T.lat1 - T.lat0) / (n - 1), lon = T.lon0 + j * (T.lon1 - T.lon0) / (n - 1); return [X(lon), H(T.z[i * n + j]), Z(lat)]; };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = P(i, j); pos.push(p[0], p[1], p[2]);
      c.copy(cLo).lerp(cHi, Math.pow((T.z[i * n + j] - zmin) / (zmax - zmin), 1.3)); col.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b = a + 1, d = a + n, e = d + 1; idx.push(a, b, d, b, e, d); }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tg.setIndex(idx); tg.computeVertexNormals();
    world.add(new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0, side: THREE.DoubleSide })));
    const gl = [], LIFT = SPAN * 0.0004;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = P(i, j);
      if (j < n - 1) { const q = P(i, j + 1); gl.push(p[0], p[1] + LIFT, p[2], q[0], q[1] + LIFT, q[2]); }
      if (i < n - 1) { const q = P(i + 1, j); gl.push(p[0], p[1] + LIFT, p[2], q[0], q[1] + LIFT, q[2]); }
    }
    const mkLines = (arr, color, op) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); };
    world.add(mkLines(gl, NAVY, 0.14));
    const BASE = -SPAN * 0.07, sp = [], si = [], rim = [], foot = [], border = [];
    for (let j = 0; j < n; j++) border.push([0, j]);
    for (let i = 1; i < n; i++) border.push([i, n - 1]);
    for (let j = n - 2; j >= 0; j--) border.push([n - 1, j]);
    for (let i = n - 2; i >= 0; i--) border.push([i, 0]);
    border.forEach((b, k) => {
      const p = P(b[0], b[1]); sp.push(p[0], p[1], p[2], p[0], BASE, p[2]);
      const q = P(border[(k + 1) % border.length][0], border[(k + 1) % border.length][1]);
      rim.push(p[0], p[1] + LIFT, p[2], q[0], q[1] + LIFT, q[2]); foot.push(p[0], BASE, p[2], q[0], BASE, q[2]);
      const a = 2 * k, a2 = 2 * ((k + 1) % border.length); si.push(a, a + 1, a2, a2, a + 1, a2 + 1);
    });
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setIndex(si); sg.computeVertexNormals();
    world.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xDCE7F1, roughness: 1, flatShading: true, side: THREE.DoubleSide })));
    world.add(mkLines(rim, NAVY, 0.85)); world.add(mkLines(foot, NAVY, 0.45));
    [[0, 0], [0, n - 1], [n - 1, n - 1], [n - 1, 0]].forEach(b => { const p = P(b[0], b[1]); world.add(mkLines([p[0], p[1], p[2], p[0], BASE, p[2]], NAVY, 0.45)); });

    /* ---------- CPT proiectate, neexecutate (puncte gri) ---------- */
    const pp = [];
    (D.cpt_neexecutate || []).forEach(p => { if (!inside(p.lat, p.lon)) return; pp.push(X(p.lon), H(zAt(p.lat, p.lon)) + LIFT * 4, Z(p.lat)); });
    if (pp.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); world.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x7B8794, size: 5, sizeAttenuation: false }))); }

    /* ---------- grupuri: foraj + CPTu-urile turbinei, desfășurate schematic ---------- */
    const items = [];
    const byTurb = {};
    INV.forEach(i => { if (i.lat != null && inside(i.lat, i.lon)) byTurb[i.id] = i; });
    CPT.forEach(t => {
      const b = byTurb[t.turbina]; let lat = t.lat, lon = t.lon, ang = null;
      if (b && t.nr === 1) { ang = 0; lat = b.lat; lon = b.lon; }
      if (lat == null || !inside(lat, lon)) return;
      items.push({ kind: 'cpt', id: t.id, data: t.data, ad: +t.adancime || 30, lat, lon, dx: ang == null ? 0 : Math.cos(ang) * R_CL, dz: ang == null ? 0 : Math.sin(ang) * R_CL, straturi: t.straturi_sbt, t, turb: t.turbina });
    });
    INV.forEach(i => {
      if (!byTurb[i.id]) return;
      const ds = CPT.filter(t => t.turbina === i.id).map(t => t.data).filter(Boolean).sort();
      items.push({ kind: 'foraj', id: i.id, data: ds.length ? ds[ds.length - 1] : '9999', nodate: true, ad: Math.max(+i.adancime || 40, ...i.straturi.map(s => s.la || 0)), lat: i.lat, lon: i.lon, dx: 0, dz: 0, i, turb: i.id });
    });
    // ordinea: după dată; forajul (fără dată pe fișă) imediat după CPT-urile turbinei; forajele fără CPT la sfârșit
    const order = items.sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.kind === b.kind ? a.id.localeCompare(b.id, undefined, { numeric: true }) : (a.kind === 'cpt' ? -1 : 1)));
    const cores = [], hits = [], matCache = {};
    const mat = hex => matCache[hex] || (matCache[hex] = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.9, metalness: 0 }));
    // legătura schematică foraj – CPT
    const linkMat = new THREE.LineBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.5 });
    Object.values(byTurb).forEach(b => {
      if (!CPT.some(t => t.turbina === b.id && t.nr === 1)) return;
      const y0 = H(zAt(b.lat, b.lon)) + LIFT * 3;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([X(b.lon), y0, Z(b.lat), X(b.lon) + R_CL, y0, Z(b.lat)], 3)); world.add(new THREE.LineSegments(g, linkMat));
    });
    order.forEach((it, k) => {
      const cpt = it.kind === 'cpt', R = cpt ? R_C : R_F, L = it.ad * CORE_S, colr = cpt ? ORANGE : BLUE;
      const g = new THREE.Group(); g.position.set(X(it.lon) + it.dx, H(zAt(it.lat, it.lon)), Z(it.lat) + it.dz); world.add(g);
      const ring = new THREE.Mesh(new THREE.RingGeometry(R * 1.3, R * 2.1, 24), new THREE.MeshBasicMaterial({ color: colr, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = LIFT * 2; g.add(ring);
      const stemG = new THREE.BufferGeometry(); stemG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3));
      const stem = new THREE.Line(stemG, new THREE.LineBasicMaterial({ color: NAVY, transparent: true, opacity: 0.5 })); g.add(stem);
      const core = new THREE.Group(); g.add(core);
      if (cpt) {
        it.straturi.forEach(s => { const h = Math.max((s.la - s.de) * CORE_S, 2); const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, h, 10), mat(s.culoare)); m.position.y = -(s.de + s.la) / 2 * CORE_S; core.add(m); });
        const cap = new THREE.Mesh(new THREE.ConeGeometry(R * 1.6, R * 1.8, 12), new THREE.MeshStandardMaterial({ color: it.t.tip === 'CPTu' ? NAVY : ORANGE, roughness: 0.6 }));
        cap.rotation.x = Math.PI; cap.position.y = -L - R * 0.9; core.add(cap);   // vârful conului la bază
        const top = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.5, R * 1.5, R * 0.7, 12), new THREE.MeshStandardMaterial({ color: ORANGE, roughness: 0.6 })); top.position.y = R * 0.35; core.add(top);
      } else {
        it.i.straturi.forEach(s => { const la = s.la == null ? it.ad : s.la, h = Math.max((la - s.de) * CORE_S, 2); const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, h, 18), mat(window.litho ? window.litho(s.descriere).c : '#C4A070')); m.position.y = -(s.de + la) / 2 * CORE_S; core.add(m); });
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.3, R * 1.3, R * 0.45, 18), new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.6 })); cap.position.y = R * 0.22; core.add(cap);
        if (it.i.NH != null) { const w = new THREE.Mesh(new THREE.CylinderGeometry(R * 2.8, R * 2.8, R * 0.2, 28), new THREE.MeshBasicMaterial({ color: WATER, transparent: true, opacity: 0.55, depthWrite: false })); w.position.y = -it.i.NH * CORE_S; w.userData.pulse = true; core.add(w); }
      }
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(R * 2.6, R * 2.6, L + GAP, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.position.y = -L / 2 + GAP / 3; hit.userData.it = it; core.add(hit); hits.push(hit);
      cores.push({ it, g, core, stem, L, k, label: null });
    });

    /* ---------- etichete: numele turbinei deasupra forajului; CPT-urile doar la hover ---------- */
    const LS = SPAN / 1400;   // factor de scară pentru sprite-uri (Sibiu: 70 m la 1,4 km)
    function mkSprite(txt, font, fill, w, h, cw) {
      const cv = document.createElement('canvas'); cv.width = cw || 256; cv.height = 96; const x = cv.getContext('2d');
      x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = 10; x.strokeStyle = 'rgba(255,255,255,.95)'; x.strokeText(txt, cv.width / 2, 50);
      x.fillStyle = fill; x.fillText(txt, cv.width / 2, 50);
      const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sp.scale.set(w, h, 1); return sp;
    }
    function addLabels() {
      cores.forEach((o, k) => {
        if (o.it.kind !== 'foraj') return;
        const sp = mkSprite(o.it.id, '600 58px "Barlow Condensed", "Barlow", Arial, sans-serif', '#0A2F4F', 70 * LS, 70 * LS * 0.375);
        sp.position.y = (k % 2 ? 30 : 16) * LS; o.core.add(sp); o.label = sp;
      });
      // etichetele zonelor
      const zc = {};
      INV.forEach(i => { if (!byTurb[i.id]) return; (zc[i.zona] ||= []).push(i); });
      Object.keys(zc).forEach(z => {
        const L_ = zc[z], la = L_.reduce((s, i) => s + i.lat, 0) / L_.length, lo = L_.reduce((s, i) => s + i.lon, 0) / L_.length;
        const sp = mkSprite((D.zone && D.zone[z] || ('zona ' + z)).toUpperCase(), '700 34px "Barlow Condensed", "Barlow", Arial, sans-serif', 'rgba(10,47,79,.5)', 320 * LS, 320 * LS * 0.15, 640);
        sp.position.set(X(lo) + (z === 'N' ? -SPAN * 0.22 : SPAN * 0.22), H(zAt(la, lo)) + 40 * LS, Z(la)); world.add(sp);
      });
    }
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(addLabels, addLabels);

    /* ---------- HUD ---------- */
    const hud = document.createElement('div'); hud.className = 'i3-hud';
    hud.innerHTML = '<div class="i3-date"><b id="i3-d">—</b><span id="i3-n"></span></div>' +
      '<div class="i3-leg"><span><i style="background:#0069B4;border-radius:50%"></i>foraj geotehnic (30 m)</span><span><i style="background:#F28C00;transform:rotate(45deg)"></i>CPT (≤ 25,5 m)</span><span><i style="background:#1F8FD8;border-radius:50%;opacity:.6"></i>NA</span></div>' +
      '<div class="i3-note">Relief EU-DEM 25 m, scară verticală ×' + VE + ' · investigații redate ×' + CORE_S + ' · CPT-ul fiecărei turbine (același punct cu forajul) desenat schematic alături · culorile tijelor = SBT Robertson · trage pentru a roti</div>' +
      '<button class="btn" id="i3-replay" type="button">↻ Reia animația</button>';
    host.appendChild(hud);
    const tip = document.createElement('div'); tip.className = 'i3-tip'; host.appendChild(tip);
    const elD = hud.querySelector('#i3-d'), elN = hud.querySelector('#i3-n');
    const fmt = s => { if (!s || s === '9999') return '—'; const p = s.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; };

    /* ---------- cameră ---------- */
    const camera = new THREE.PerspectiveCamera(30, 2, SPAN * 0.01, SPAN * 20);
    const target = new THREE.Vector3(0, H((zmin + zmax) / 2) * 0.6, 0);
    let az = -0.55, el = 0.5, elBase = 0.5, Rad = SPAN * 1.7, W = 0, Hh = 0, lastUser = 0;
    function resize() {
      const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; W = w; Hh = h;
      renderer.setSize(w, h, false); camera.aspect = w / h;
      Rad = SPAN * 1.7 * Math.max(1, 1.75 / camera.aspect); if (Rad > SPAN * 4) Rad = SPAN * 4;
      if (w > 900) camera.setViewOffset(w, h, -w * 0.12, h * 0.04, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);
    resize();

    /* ---------- interacțiune ---------- */
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); let drag = null, moved = 0, hover = null;
    const cvs = renderer.domElement; cvs.style.touchAction = 'pan-y';
    function pick(ev) {
      const r = cvs.getBoundingClientRect(); mouse.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera); const h = ray.intersectObjects(hits, false); return h.length ? h[0].object.userData.it : null;
    }
    const f2 = v => (+v).toFixed(2).replace('.', ',');
    cvs.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, az, el: elBase }; moved = 0; try { cvs.setPointerCapture(e.pointerId); } catch (_) {} });
    cvs.addEventListener('pointermove', e => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
        az = drag.az - dx * 0.006; if (e.pointerType !== 'touch') elBase = Math.max(0.18, Math.min(1.25, drag.el + dy * 0.004));
        lastUser = performance.now(); tip.style.display = 'none'; return;
      }
      const it = pick(e); hover = it; cvs.style.cursor = it ? 'pointer' : 'grab';
      if (it) {
        const r = host.getBoundingClientRect(); let body;
        if (it.kind === 'cpt') body = '<b>CPT ' + it.id + '</b> · turbina ' + it.turb + '<br>' + fmt(it.data) + ' · ' + f2(it.ad) + ' m<br>q<sub>c</sub> mediu ' + f2(it.t.qc_med) + ' MPa<br><em>click pentru diagrame</em>';
        else { const w = it.i.NH != null ? 'NA = ' + f2(it.i.NH) + ' m' : (it.i.apa || 'fără apă'); body = '<b>' + it.id + '</b> · foraj geotehnic<br>dată necompletată · ' + f2(it.ad) + ' m · ' + it.i.lab.length + ' probe<br><span class="w">' + w + '</span><br><em>click pentru fișă</em>'; }
        tip.innerHTML = body; tip.style.display = 'block'; tip.style.left = Math.min(e.clientX - r.left + 14, r.width - 200) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px';
      } else tip.style.display = 'none';
    });
    const end = e => { if (drag && moved < 6) { const it = pick(e); if (it) location.hash = it.kind === 'cpt' ? '#/cpt/' + it.id : '#/i/' + it.id; } drag = null; };
    cvs.addEventListener('pointerup', end); cvs.addEventListener('pointercancel', () => { drag = null; });
    cvs.addEventListener('pointerleave', () => { tip.style.display = 'none'; hover = null; });

    /* ---------- animație ---------- */
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const STEP = Math.max(0.05, Math.min(0.2, 9 / Math.max(1, cores.length))), DUR = 1.25, T0 = 0.7; let t0 = performance.now(), visible = true, lastShown = -1;
    hud.querySelector('#i3-replay').onclick = () => { t0 = performance.now(); lastShown = -1; };
    if (window.IntersectionObserver) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
    const ease = x => 1 - Math.pow(1 - x, 3);
    let prev = performance.now(), lastDate = null;
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || !W || document.hidden) { prev = now; return; }
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now; const t = (now - t0) / 1000;
      let shown = -1, ml = 0, mc = 0, nf = 0, nc = 0;
      cores.forEach(o => {
        let p = reduce ? 1 : (t - T0 - o.k * STEP) / DUR; p = p < 0 ? 0 : p > 1 ? 1 : p; const e = ease(p);
        if (p > 0) { shown = Math.max(shown, o.k); const v = o.it.ad * (p >= 1 ? 1 : e); if (o.it.kind === 'cpt') { mc += v; nc++; } else { ml += v; nf++; } }
        o.core.position.y = e * (o.L + GAP) + (p >= 1 && !reduce ? Math.sin(now / 900 + o.k) * LIFT * 2 : 0);
        o.core.visible = p > 0; o.core.rotation.y = (1 - e) * 2.2;
        const a = o.stem.geometry.attributes.position; a.setY(1, Math.max(0, o.core.position.y - o.L)); a.needsUpdate = true;
        o.core.scale.setScalar(hover === o.it ? 1.15 : 1);
        o.core.children.forEach(ch => { if (ch.userData.pulse) { const s = 1 + 0.12 * Math.sin(now / 420 + o.k); ch.scale.set(s, 1, s); } });
      });
      if (shown !== lastShown) {
        lastShown = shown; const it = shown < 0 ? order[0] : order[shown];
        if (it && !it.nodate) lastDate = it.data;
        elD.textContent = fmt(lastDate || (order[0] && order[0].data));
      }
      elN.textContent = nc + ' CPT · ' + mc.toFixed(0) + ' m  ·  ' + nf + ' foraje · ' + ml.toFixed(0) + ' m';
      if (!drag && !reduce && now - lastUser > 2500) az += dt * 0.05;
      const sc = Math.max(0, Math.min(1, -host.getBoundingClientRect().top / Math.max(1, Hh)));
      el += ((elBase + sc * 0.45) - el) * 0.08;
      const ce = Math.cos(el);
      camera.position.set(target.x + Rad * ce * Math.sin(az), target.y + Rad * Math.sin(el), target.z + Rad * ce * Math.cos(az));
      camera.lookAt(target); renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  };
})();
