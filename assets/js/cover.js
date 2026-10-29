/* Telesys · Planejador de Link Budget (Rascunho)
   Predição de cobertura em grade: margem por ponto, três classes e estatísticas. */
window.TS = window.TS || {};
(function () {
  const RF = () => TS.RF;
  const CORES = { 3: [47, 191, 113], 2: [242, 178, 51], 1: [229, 72, 77] };

  const Cover = {};

  Cover.limites = (st, r) => {
    const a = st.area;
    const pts = [...a.poligono, ...a.estacoes.map(e => [e.lat, e.lng])];
    if (!pts.length) return null;
    let bb = RF().bbox(pts);
    // garante um tamanho mínimo e inclui o alcance quando não há polígono
    const c = [(bb.s + bb.n) / 2, (bb.w + bb.e) / 2];
    const minHalf = a.poligono.length >= 3 ? 80 : Math.max(200, Math.min(r.rLimite * 1.25, 30000));
    const p1 = RF().offset(c, -minHalf, -minHalf), p2 = RF().offset(c, minHalf, minHalf);
    bb = { s: Math.min(bb.s, p1[0]), n: Math.max(bb.n, p2[0]), w: Math.min(bb.w, p1[1]), e: Math.max(bb.e, p2[1]) };
    const padLat = (bb.n - bb.s) * 0.12, padLng = (bb.e - bb.w) * 0.12;
    return { s: bb.s - padLat, n: bb.n + padLat, w: bb.w - padLng, e: bb.e + padLng };
  };

  Cover.calcular = (st, r, opts = {}) => {
    const a = st.area;
    const bb = Cover.limites(st, r);
    if (!bb || !a.estacoes.length) return null;
    const nx = opts.nx || 170;
    const yS = RF().mercY(bb.s), yN = RF().mercY(bb.n);
    const wM = (bb.e - bb.w) * Math.PI / 180, hM = yN - yS;
    const ny = Math.max(20, Math.min(260, Math.round(nx * hM / wM)));
    const N = nx * ny;
    const margem = new Float32Array(N), cls = new Uint8Array(N), dentro = new Uint8Array(N), serv = new Int16Array(N);
    const temPoli = a.poligono.length >= 3;
    const band = r.band;
    const est = a.estacoes.map(e => ({
      p: [e.lat, e.lng], h: Number(e.h) || st.rf.hBS, ant: e.antena || 'omni', az: Number(e.az) || 0,
      ctx: Object.assign({}, r.ctx, { hBS: Number(e.h) || st.rf.hBS })
    }));
    const zonas = (a.zonas || []).map(z => ({ p: [z.lat, z.lng], raio: Number(z.raio) || 100, lDL: RF().perdaZona(z, band.fDL), lUL: RF().perdaZona(z, band.fUL) }));
    let cont = { 3: 0, 2: 0, 1: 0 }, tot = 0, pior = null;
    for (let j = 0; j < ny; j++) {
      const lat = RF().invMercY(yN - (j + 0.5) / ny * hM);
      for (let i = 0; i < nx; i++) {
        const lng = bb.w + (i + 0.5) / nx * (bb.e - bb.w);
        const pt = [lat, lng];
        let zDL = 0, zUL = 0;
        for (const z of zonas) if (RF().dist(pt, z.p) <= z.raio) { zDL += z.lDL; zUL += z.lUL; }
        let best = -999, bi = -1;
        for (let k = 0; k < est.length; k++) {
          const e = est[k];
          const d = Math.max(RF().dist(pt, e.p), 1);
          let att = e.ant === 'omni' ? Math.min(0, 10 - (Number(st.rf.est.gant) || 0)) : 0;
          if (e.ant !== 'omni') {
            const b = RF().rumo(e.p, pt);
            if (e.ant === 'setorial') att = RF().antAtt(RF().angDiff(b, e.az));
            else att = Math.max(...[0, 120, 240].map(o => RF().antAtt(RF().angDiff(b, e.az + o))));
          }
          const mDL = r.DL.mapl - TS.RF.pathLoss(d, band.fDL, e.ctx) - r.DL.obst - zDL + att;
          const mUL = r.UL.mapl - TS.RF.pathLoss(d, band.fUL, e.ctx) - r.UL.obst - zUL + att;
          const m = Math.min(mDL, mUL);
          if (m > best) { best = m; bi = k; }
        }
        const idx = j * nx + i;
        margem[idx] = best; serv[idx] = bi;
        const c = best >= r.folgaReq ? 3 : best >= 0 ? 2 : 1;
        cls[idx] = c;
        const ins = temPoli ? RF().pip(pt, a.poligono) : 1;
        dentro[idx] = ins ? 1 : 0;
        if (ins) {
          cont[c]++; tot++;
          if (!pior || best < pior.m) pior = { m: best, lat, lng };
        }
      }
    }
    const pct = k => tot ? cont[k] / tot * 100 : 0;
    return { nx, ny, bb, yS, yN, margem, cls, dentro, serv, temPoli, stats: { folga: pct(3), limite: pct(2), sem: pct(1), tot }, pior };
  };

  Cover.canvas = (cv, opts = {}) => {
    if (!cv) return null;
    const c = document.createElement('canvas');
    c.width = cv.nx; c.height = cv.ny;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(cv.nx, cv.ny);
    const aIn = opts.alphaIn ?? 165, aOut = opts.alphaOut ?? 55;
    for (let k = 0; k < cv.nx * cv.ny; k++) {
      const col = CORES[cv.cls[k]];
      img.data[k * 4] = col[0]; img.data[k * 4 + 1] = col[1]; img.data[k * 4 + 2] = col[2];
      img.data[k * 4 + 3] = cv.dentro[k] ? aIn : aOut;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  };

  Cover.CORES = CORES;
  TS.Cover = Cover;
})();
