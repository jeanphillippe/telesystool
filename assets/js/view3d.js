/* Telesys · Planejador de Link Budget (Rascunho)
   Vista 3D (three.js): superfície de margem de sinal, estações, zonas e backhaul com zona de Fresnel. */
window.TS = window.TS || {};
(function () {
  const V = { pronto: false, ativo: false, relevo: true, exag: 1 };
  let T, renderer, scene, camera, controls, grupo, host, superficie, ultimo, ray, tip, raf;
  const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  V.init = el => {
    host = el;
    const start = () => {
      if (V.pronto || !window.THREE) return;
      T = window.THREE;
      renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(V._bg ?? 0x0b0e12, 1);
      host.appendChild(renderer.domElement);
      scene = new T.Scene();
      scene.fog = new T.Fog(V._bg ?? 0x0b0e12, 160, 420);
      camera = new T.PerspectiveCamera(45, 1, 0.1, 2000);
      camera.position.set(70, 75, 95);
      controls = new window.THREE_OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.08;
      controls.maxPolarAngle = Math.PI * 0.49;
      scene.add(new T.HemisphereLight(0xdfe8f0, 0x1a1f26, 0.9));
      const dl = new T.DirectionalLight(0xffffff, 0.9); dl.position.set(60, 120, 40); scene.add(dl);
      const grid = new T.GridHelper(400, 80, 0x253040, 0x161c24); grid.position.y = -0.6; scene.add(grid);
      grupo = new T.Group(); scene.add(grupo);
      ray = new T.Raycaster();
      tip = document.createElement('div'); tip.className = 'v3-tip'; host.appendChild(tip);
      renderer.domElement.addEventListener('pointermove', hover);
      renderer.domElement.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
      new ResizeObserver(redimensionar).observe(host);
      V.pronto = true;
      redimensionar();
      if (ultimo) V.construir(...ultimo);
      loop();
    };
    if (window.THREE) start(); else window.addEventListener('three-ready', start, { once: true });
  };

  function redimensionar() {
    if (!renderer) return;
    const w = host.clientWidth || 600, h = host.clientHeight || 400;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!V.ativo) return;
    controls.update();
    renderer.render(scene, camera);
  }
  function limpar() {
    while (grupo.children.length) {
      const o = grupo.children.pop();
      o.traverse(c => { c.geometry && c.geometry.dispose(); if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose()); });
    }
    superficie = null;
  }

  V.construir = (st, r, cv) => {
    ultimo = [st, r, cv];
    if (!V.pronto) return;
    limpar();
    const vazio = document.getElementById('v3Vazio');
    if (!cv) { if (vazio) vazio.style.display = ''; return; }
    if (vazio) vazio.style.display = 'none';
    const RF = TS.RF, bb = cv.bb;
    const c0 = [(bb.s + bb.n) / 2, (bb.w + bb.e) / 2];
    const Wm = RF.dist([c0[0], bb.w], [c0[0], bb.e]), Hm = RF.dist([bb.s, c0[1]], [bb.n, c0[1]]);
    const k = 120 / Math.max(Wm, Hm);
    const W = Wm * k, H = Hm * k;
    const toXZ = (lat, lng) => {
      const dx = RF.dist([c0[0], c0[1]], [c0[0], lng]) * (lng < c0[1] ? -1 : 1);
      const dy = RF.dist([c0[0], c0[1]], [lat, c0[1]]) * (lat < c0[0] ? -1 : 1);
      return [dx * k, -dy * k];
    };
    const hk = V.relevo ? 0.32 * V.exag : 0;
    const altura = m => (Math.max(-25, Math.min(35, m)) + 25) * hk;
    V.ctx = { k, W, H, toXZ, altura, cv, r };

    // superfície de margem
    const g = new T.PlaneGeometry(W, H, cv.nx - 1, cv.ny - 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, cols = new Float32Array(pos.count * 3);
    const base = { 3: new T.Color(0x2fbf71), 2: new T.Color(0xf2b233), 1: new T.Color(0xe5484d) };
    let hmax = 0;
    for (let j = 0; j < cv.ny; j++) for (let i = 0; i < cv.nx; i++) {
      const v = j * cv.nx + i, m = cv.margem[v];
      const y = altura(m); hmax = Math.max(hmax, y);
      pos.setY(v, y);
      const col = base[cv.cls[v]].clone();
      const lum = 0.55 + 0.45 * Math.min(1, Math.max(0, (m + 25) / 60));
      col.multiplyScalar(cv.dentro[v] ? lum : lum * 0.32);
      cols[v * 3] = col.r; cols[v * 3 + 1] = col.g; cols[v * 3 + 2] = col.b;
    }
    g.setAttribute('color', new T.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    superficie = new T.Mesh(g, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, flatShading: false, side: T.DoubleSide }));
    grupo.add(superficie);
    if (V.relevo) {
      const wire = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0x0b0e12, wireframe: true, transparent: true, opacity: 0.08 }));
      grupo.add(wire);
    }

    // cerca do polígono
    const poly = st.area.poligono;
    if (poly.length >= 3) {
      const fh = Math.max(hmax * 1.05, 3);
      const mat = new T.MeshBasicMaterial({ color: 0x4cc9e0, transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false });
      const pts = [];
      poly.forEach((p, i) => {
        const a = toXZ(...p), b = toXZ(...poly[(i + 1) % poly.length]);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const wall = new T.Mesh(new T.PlaneGeometry(len, fh), mat);
        wall.position.set((a[0] + b[0]) / 2, fh / 2, (a[1] + b[1]) / 2);
        wall.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
        grupo.add(wall);
        pts.push(new T.Vector3(a[0], fh, a[1]));
      });
      pts.push(pts[0].clone());
      grupo.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x4cc9e0 })));
    }

    // estações
    const topoEst = [];
    st.area.estacoes.forEach(e => {
      const [x, z] = toXZ(e.lat, e.lng);
      const yb = superficieY(x, z);
      const hT = 6 + (Number(e.h) || 20) * 0.22;
      const mast = new T.Mesh(new T.CylinderGeometry(0.28, 0.5, hT, 8), new T.MeshStandardMaterial({ color: 0xd9dee5, metalness: 0.3, roughness: 0.4 }));
      mast.position.set(x, yb + hT / 2, z); grupo.add(mast);
      const head = new T.Mesh(new T.BoxGeometry(1.6, 1.1, 1.6), new T.MeshStandardMaterial({ color: 0x4cc9e0, emissive: 0x0d3a44, roughness: 0.5 }));
      head.position.set(x, yb + hT, z); grupo.add(head);
      topoEst.push(new T.Vector3(x, yb + hT, z));
      if (!V.relevo) {
        [[r.rFolga, 0x2fbf71], [r.rLimite, 0xf2b233]].forEach(([rad, cor]) => {
          const ring = new T.Mesh(new T.RingGeometry(rad * k - 0.25, rad * k + 0.25, 96), new T.MeshBasicMaterial({ color: cor, side: T.DoubleSide, transparent: true, opacity: 0.8 }));
          ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.08, z); grupo.add(ring);
        });
      }
      const lbl = sprite(e.nome); lbl.position.set(x, yb + hT + 2.6, z); grupo.add(lbl);
    });

    // zonas
    (st.area.zonas || []).forEach(zn => {
      if (zn.forma === 'ret' || zn.forma === 'linha') {
        const alt = 1.2 + (zn.alt || 3) * 0.55;
        const mat = new T.MeshStandardMaterial({ color: new T.Color(zn.cor || '#9aa6b4'), transparent: true, opacity: 0.72, roughness: 0.7 });
        let geo, px, pz, rot = 0;
        if (zn.forma === 'ret') {
          [px, pz] = toXZ(zn.lat, zn.lng);
          geo = new T.BoxGeometry(Math.max(zn.w * k, 0.4), alt, Math.max(zn.h * k, 0.4));
          rot = (zn.ang || 0) * Math.PI / 180;
        } else {
          const a = toXZ(...zn.a), b = toXZ(...zn.b);
          px = (a[0] + b[0]) / 2; pz = (a[1] + b[1]) / 2;
          geo = new T.BoxGeometry(Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.4), alt, 0.45);
          rot = -Math.atan2(b[1] - a[1], b[0] - a[0]);
        }
        const m = new T.Mesh(geo, mat);
        m.position.set(px, superficieY(px, pz) + alt / 2, pz); m.rotation.y = rot; grupo.add(m);
        return;
      }
      const t = TS.ZONAS.find(x => x.id === zn.tipo) || TS.ZONAS[0];
      const [x, z] = toXZ(zn.lat, zn.lng);
      const m = new T.Mesh(new T.CylinderGeometry(zn.raio * k, zn.raio * k, 2.2, 40, 1, true), new T.MeshBasicMaterial({ color: new T.Color(t.cor), transparent: true, opacity: 0.28, side: T.DoubleSide, depthWrite: false }));
      m.position.set(x, superficieY(x, z) + 1.1, z); grupo.add(m);
    });

    // core + backhaul com elipsoide de Fresnel
    if (st.area.core) {
      const [x, z] = toXZ(st.area.core.lat, st.area.core.lng);
      const yb = superficieY(x, z);
      const core = new T.Mesh(new T.BoxGeometry(3, 2.4, 2), new T.MeshStandardMaterial({ color: 0xc7b8ff, roughness: 0.6 }));
      core.position.set(x, yb + 1.2 + 4, z); grupo.add(core);
      const pole = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 4, 6), new T.MeshStandardMaterial({ color: 0x9aa4b1 }));
      pole.position.set(x, yb + 2, z); grupo.add(pole);
      const pc = new T.Vector3(x, yb + 5.2, z);
      topoEst.forEach((pe, i) => {
        const e = st.area.estacoes[i];
        const dkm = TS.RF.dist([e.lat, e.lng], [st.area.core.lat, st.area.core.lng]) / 1000;
        if (dkm < 0.05) return;
        grupo.add(new T.Line(new T.BufferGeometry().setFromPoints([pe, pc]), new T.LineDashedMaterial({ color: 0xc7b8ff, dashSize: 1.2, gapSize: 0.8 })).computeLineDistances());
        const r1 = TS.RF.fresnel(dkm, 5.8) * k * 3;
        const len = pe.distanceTo(pc);
        const el = new T.Mesh(new T.SphereGeometry(1, 28, 14), new T.MeshBasicMaterial({ color: 0xc7b8ff, transparent: true, opacity: 0.13, depthWrite: false }));
        el.scale.set(len / 2, Math.max(r1, 0.35), Math.max(r1, 0.35));
        el.position.copy(pe.clone().add(pc).multiplyScalar(0.5));
        const dir = pc.clone().sub(pe).normalize();
        el.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), dir);
        grupo.add(el);
      });
      const lbl = sprite('CORE'); lbl.position.set(x, yb + 9, z); grupo.add(lbl);
    }
    controls.target.set(0, hmax * 0.3, 0);
    V.render();
  };

  function superficieY(x, z) {
    const c = V.ctx; if (!c) return 0;
    const i = Math.round((x + c.W / 2) / c.W * (c.cv.nx - 1)), j = Math.round((z + c.H / 2) / c.H * (c.cv.ny - 1));
    if (i < 0 || j < 0 || i >= c.cv.nx || j >= c.cv.ny) return 0;
    return c.altura(c.cv.margem[j * c.cv.nx + i]);
  }

  function sprite(txt) {
    const cvs = document.createElement('canvas'); cvs.width = 256; cvs.height = 72;
    const g = cvs.getContext('2d');
    g.fillStyle = 'rgba(11,14,18,.85)'; g.strokeStyle = 'rgba(232,236,241,.5)'; g.lineWidth = 3;
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    rr(4, 4, 248, 64, 14); g.fill(); g.stroke();
    g.fillStyle = '#e8ecf1'; g.font = '600 34px IBM Plex Sans, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, 128, 38);
    const tex = new T.CanvasTexture(cvs); tex.colorSpace = T.SRGBColorSpace;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false }));
    sp.scale.set(7, 2, 1); sp.renderOrder = 10;
    return sp;
  }

  function hover(ev) {
    if (!superficie || !V.ctx) return;
    const rc = renderer.domElement.getBoundingClientRect();
    const p = new T.Vector2(((ev.clientX - rc.left) / rc.width) * 2 - 1, -((ev.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(p, camera);
    const hit = ray.intersectObject(superficie)[0];
    if (!hit) { tip.style.display = 'none'; return; }
    const c = V.ctx;
    const i = Math.round((hit.point.x + c.W / 2) / c.W * (c.cv.nx - 1)), j = Math.round((hit.point.z + c.H / 2) / c.H * (c.cv.ny - 1));
    const v = j * c.cv.nx + i; if (v < 0 || v >= c.cv.margem.length) return;
    const m = c.cv.margem[v], cl = c.cv.cls[v];
    const nome = cl === 3 ? 'com folga' : cl === 2 ? 'no limite' : 'sem cobertura';
    tip.innerHTML = `<b class="c${cl}">${nome}</b><span>margem ${nf1.format(m)} dB</span>`;
    tip.style.display = 'block';
    tip.style.left = (ev.clientX - rc.left + 14) + 'px'; tip.style.top = (ev.clientY - rc.top + 10) + 'px';
  }

  V.fundo = hex => { V._bg = hex; if (!V.pronto) return; renderer.setClearColor(hex, 1); scene.fog.color.set(hex); V.render(); };
  V.render = () => { if (V.pronto) { controls.update(); renderer.render(scene, camera); } };
  V.setAtivo = a => { V.ativo = a; if (a) { redimensionar(); V.render(); } };
  V.setRelevo = on => { V.relevo = on; if (ultimo) V.construir(...ultimo); };
  V.setExag = x => { V.exag = x; if (ultimo) V.construir(...ultimo); };
  V.camera = modo => {
    if (!V.pronto) return;
    if (modo === 'topo') camera.position.set(0, 190, 0.1);
    else if (modo === 'perfil') camera.position.set(0, 30, 150);
    else camera.position.set(70, 75, 95);
    controls.update(); V.render();
  };
  V.png = () => { if (!V.pronto || !ultimo || !ultimo[2]) return null; V.render(); return renderer.domElement.toDataURL('image/png'); };

  TS.View3D = V;
})();
