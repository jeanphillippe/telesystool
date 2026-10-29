/* Telesys · Planejador de Link Budget (Rascunho)
   Motor de RF: modelos de propagação, link budget DL/UL, alcance e capacidade.
   Modelos: espaço livre; Okumura-Hata / COST-231; 3GPP TR 38.901 (RMa, UMa, InF). */
window.TS = window.TS || {};
(function () {
  const L10 = Math.log10;
  const C = 299792458;
  const RF = {};

  /* ---------- Modelos de perda de percurso (dB) ---------- */
  RF.fspl = (dm, fMHz) => 20 * L10(Math.max(dm, 1) / 1000) + 20 * L10(fMHz) + 32.44;

  RF.hata = (dm, fMHz, hb, hm, area) => {
    const f = Math.min(Math.max(fMHz, 150), 2000);
    const dkm = Math.max(dm / 1000, 0.02);
    const a = (1.1 * L10(f) - 0.7) * hm - (1.56 * L10(f) - 0.8);
    let pl = f <= 1500
      ? 69.55 + 26.16 * L10(f) - 13.82 * L10(hb) - a + (44.9 - 6.55 * L10(hb)) * L10(dkm)
      : 46.3 + 33.9 * L10(f) - 13.82 * L10(hb) - a + (44.9 - 6.55 * L10(hb)) * L10(dkm);
    if (area === 'aberto') pl = pl - 4.78 * Math.pow(L10(f), 2) + 18.33 * L10(f) - 40.94;
    else if (area === 'suburbano') pl = pl - 2 * Math.pow(L10(f / 28), 2) - 5.4;
    return Math.max(pl, RF.fspl(dm, fMHz));
  };

  RF.rma = (d2, fGHz, hBS, hUT, modo) => {
    const h = 5, W = 20;
    const d3 = Math.max(Math.sqrt(d2 * d2 + (hBS - hUT) ** 2), 10);
    const dBP = 2 * Math.PI * hBS * hUT * fGHz * 1e9 / C;
    const PL1 = d => 20 * L10(40 * Math.PI * d * fGHz / 3) + Math.min(0.03 * h ** 1.72, 10) * L10(d)
      - Math.min(0.044 * h ** 1.72, 14.77) + 0.002 * L10(h) * d;
    const los = d2 <= dBP ? PL1(d3) : PL1(dBP) + 40 * L10(d3 / dBP);
    if (modo === 'los') return los;
    const nl = 161.04 - 7.1 * L10(W) + 7.5 * L10(h) - (24.37 - 3.7 * (h / hBS) ** 2) * L10(hBS)
      + (43.42 - 3.1 * L10(hBS)) * (L10(d3) - 3) + 20 * L10(fGHz)
      - (3.2 * (L10(11.75 * hUT)) ** 2 - 4.97);
    const nlos = Math.max(los, nl);
    if (modo === 'nlos') return nlos;
    const p = d2 <= 10 ? 1 : Math.exp(-(d2 - 10) / 1000);
    return p * los + (1 - p) * nlos;
  };

  RF.uma = (d2, fGHz, hBS, hUT, modo) => {
    const d3 = Math.max(Math.sqrt(d2 * d2 + (hBS - hUT) ** 2), 10);
    const dBP = 4 * (hBS - 1) * Math.max(hUT - 1, 0.5) * fGHz * 1e9 / C;
    const los = d2 <= dBP
      ? 28 + 22 * L10(d3) + 20 * L10(fGHz)
      : 28 + 40 * L10(d3) + 20 * L10(fGHz) - 9 * L10(dBP * dBP + (hBS - hUT) ** 2);
    if (modo === 'los') return los;
    const nlos = Math.max(los, 13.54 + 39.08 * L10(d3) + 20 * L10(fGHz) - 0.6 * (hUT - 1.5));
    if (modo === 'nlos') return nlos;
    const p = d2 <= 18 ? 1 : (18 / d2 + Math.exp(-d2 / 63) * (1 - 18 / d2));
    return p * los + (1 - p) * nlos;
  };

  RF.inf = (d2, fGHz, hBS, hUT, sub, modo) => {
    const d3 = Math.max(Math.sqrt(d2 * d2 + (hBS - hUT) ** 2), 1);
    const los = 31.84 + 21.5 * L10(d3) + 19 * L10(fGHz);
    if (modo === 'los') return los;
    const sl = Math.max(los, 33 + 25.5 * L10(d3) + 20 * L10(fGHz));
    if (sub === 'sl') return sl;
    return Math.max(sl, 18.6 + 35.7 * L10(d3) + 20 * L10(fGHz));
  };

  /* Resolve o modelo efetivo para frequência e ambiente */
  RF.resolverModelo = (modelo, amb, fMHz) => {
    let m = modelo === 'auto' ? amb.modelo : modelo;
    const avisos = [];
    if ((m === 'rma' || m === 'uma' || m.startsWith('inf')) && fMHz < 500) {
      avisos.push('Abaixo de 0,5 GHz o modelo 3GPP é extrapolado; mantido para comparar faixas nas mesmas condições.');
    }
    if (m === 'hata' && fMHz > 2000) avisos.push('Okumura-Hata / COST-231 é válido até 2 GHz; acima disso o resultado é extrapolação.');
    if (m === 'rma' && fMHz > 7000) avisos.push('RMa é validado até 7 GHz no TR 38.901.');
    return { m, avisos };
  };

  /* Perda de percurso por distância (m) */
  RF.pathLoss = (dm, fMHz, ctx) => {
    const fG = fMHz / 1000;
    const vis = ctx.visada === 'auto' ? ctx.amb.visada : ctx.visada;
    let pl;
    switch (ctx.m) {
      case 'fspl': pl = RF.fspl(Math.sqrt(dm * dm + (ctx.hBS - ctx.hUT) ** 2), fMHz); break;
      case 'hata': pl = RF.hata(dm, fMHz, ctx.hBS, ctx.hUT, ctx.amb.id === 'rural' ? 'aberto' : 'suburbano'); break;
      case 'rma': pl = RF.rma(dm, fG, ctx.hBS, ctx.hUT, vis); break;
      case 'uma': pl = RF.uma(dm, fG, ctx.hBS, ctx.hUT, vis); break;
      case 'inf-sl': pl = RF.inf(dm, fG, ctx.hBS, ctx.hUT, 'sl', vis); break;
      case 'inf-dl': pl = RF.inf(dm, fG, ctx.hBS, ctx.hUT, 'dl', vis); break;
      default: pl = RF.fspl(dm, fMHz);
    }
    return Math.max(pl, RF.fspl(Math.max(dm, 1), fMHz));
  };

  /* Perdas de obstáculos aplicadas a toda a área (dB) */
  RF.perdasObstaculos = (obst, fMHz) => {
    const g = fMHz / 1000;
    let tot = 0; const det = [];
    TS.OBSTACULOS.forEach(o => {
      const v = Number(obst[o.id]) || 0;
      if (!v) return;
      let db;
      if (o.veg) db = TS.weissberger(g, v);
      else if (o.fixo) db = v;
      else db = o.f(g) * v;
      tot += db; det.push({ l: o.l, v, un: o.un, db });
    });
    return { tot, det };
  };

  /* Perda extra de uma zona desenhada no mapa */
  RF.perdaZona = (z, fMHz) => {
    const g = fMHz / 1000;
    if (z.tipo === 'vegetacao') return TS.weissberger(g, Number(z.prof) || 60);
    if (z.tipo === 'predio') return (5 + 4 * g) * (Number(z.paredes) || 2);
    return Number(z.db) || 10;
  };

  RF.zDeConfiabilidade = p => ({ 50: 0, 75: 0.674, 90: 1.2816, 95: 1.645, 98: 2.054 }[p] ?? 1.2816);

  RF.sensFormula = (bwMHz, nf, sinr, tech) => {
    const occ = bwMHz * 1e6 * (tech === 'NR' ? 0.98 : 0.9);
    return -174 + 10 * L10(occ) + nf + sinr;
  };

  RF.antAtt = (phi, bw3 = 65) => -Math.min(12 * (phi / bw3) ** 2, 25);

  /* Busca o maior alcance em que a perda total não ultrapassa o alvo */
  RF.alcance = (plFn, alvo) => {
    let d = 5, last = 0;
    if (plFn(d) > alvo) return 0;
    while (d < 80000) {
      const nd = d * 1.03;
      if (plFn(nd) > alvo) {
        let lo = d, hi = nd;
        for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (plFn(m) > alvo) hi = m; else lo = m; }
        return lo;
      }
      d = nd; last = d;
    }
    return last;
  };

  /* ---------- Link budget completo ---------- */
  RF.calcular = (inp) => {
    const { band, amb, rf } = inp;
    const res = RF.resolverModelo(rf.modelo, amb, band.fDL);
    const ctxBase = { m: res.m, amb, visada: rf.visada, hBS: rf.hBS, hUT: rf.hUT };
    const obstDL = RF.perdasObstaculos(rf.obst, band.fDL);
    const obstUL = RF.perdasObstaculos(rf.obst, band.fUL);
    const sigma = rf.sigma ?? amb.sigma;
    const z = RF.zDeConfiabilidade(rf.conf);
    const fade = z * sigma;
    const folgaReq = fade + (Number(rf.interf) || 0);

    const dl = rf.dl, ul = rf.ul;
    const DL = {
      sai: dl.ptx + dl.gant - dl.cabo,
      ptx: dl.ptx, gtx: dl.gant, cabos: dl.cabo,
      grx: dl.grx + (dl.div || 0), sens: dl.sens,
      obst: obstDL.tot, f: band.fDL
    };
    DL.mapl = DL.sai + DL.grx - DL.sens;           // perda máxima admissível sem folga
    const UL = {
      sai: ul.ptx + ul.gtx,
      ptx: ul.ptx, gtx: ul.gtx, cabos: dl.cabo,
      grx: dl.gant - dl.cabo + (ul.div || 0), sens: ul.sens,
      obst: obstUL.tot, f: band.fUL
    };
    UL.mapl = UL.sai + UL.grx - UL.sens;

    const plDL = d => RF.pathLoss(d, band.fDL, ctxBase);
    const plUL = d => RF.pathLoss(d, band.fUL, ctxBase);
    DL.rFolga = RF.alcance(d => plDL(d) + DL.obst, DL.mapl - folgaReq);
    DL.rLimite = RF.alcance(d => plDL(d) + DL.obst, DL.mapl);
    UL.rFolga = RF.alcance(d => plUL(d) + UL.obst, UL.mapl - folgaReq);
    UL.rLimite = RF.alcance(d => plUL(d) + UL.obst, UL.mapl);
    const limitante = UL.rFolga < DL.rFolga ? 'UL' : 'DL';
    const rFolga = Math.min(DL.rFolga, UL.rFolga);
    const rLimite = Math.min(DL.rLimite, UL.rLimite);
    const desbalanco = (DL.mapl - DL.obst) - (UL.mapl - UL.obst);

    return {
      modelo: res.m, avisos: res.avisos, ctx: ctxBase, DL, UL, obstDL, obstUL,
      sigma, z, fade, folgaReq, limitante, rFolga, rLimite, desbalanco, plDL, plUL
    };
  };

  /* Margem em uma distância (para gráficos e mapa) */
  RF.margem = (r, dir, d, extra = 0) => {
    const D = r[dir];
    const pl = dir === 'DL' ? r.plDL(d) : r.plUL(d);
    return D.mapl - pl - D.obst - extra;
  };

  /* ---------- Capacidade aproximada por estação ---------- */
  RF.capacidade = (band, bw, tech, tddCfg) => {
    const nr = tech === 'NR';
    const legado = tech === 'Legado';
    const seDL = legado ? 0.5 : nr ? 2.2 : 1.6;
    const seUL = legado ? 0.5 : nr ? 1.1 : 0.9;
    let shDL = 1, shUL = 1;
    if (band.duplex !== 'FDD' && !legado) { const t = TS.TDD[tddCfg] || TS.TDD.cfg1; shDL = t.dl; shUL = t.ul; }
    if (legado) { shDL = 0.5; shUL = 0.5; }
    return { dl: bw * seDL * shDL, ul: bw * seUL * shUL, seDL, seUL, shDL, shUL };
  };

  /* ---------- Backhaul ---------- */
  RF.fresnel = (dkm, fGHz) => 8.657 * Math.sqrt(dkm / fGHz);

  /* ---------- Geo ---------- */
  const R = 6371008.8, rad = Math.PI / 180;
  RF.dist = (a, b) => {
    const x = (b[1] - a[1]) * rad * Math.cos(((a[0] + b[0]) / 2) * rad);
    const y = (b[0] - a[0]) * rad;
    return Math.sqrt(x * x + y * y) * R;
  };
  RF.rumo = (a, b) => {
    const x = (b[1] - a[1]) * Math.cos(((a[0] + b[0]) / 2) * rad);
    const y = b[0] - a[0];
    return (Math.atan2(x, y) / rad + 360) % 360;
  };
  RF.angDiff = (a, b) => { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  RF.pip = (pt, poly) => {
    let ins = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
      if (((yi > pt[0]) !== (yj > pt[0])) && (pt[1] < (xj - xi) * (pt[0] - yi) / (yj - yi) + xi)) ins = !ins;
    }
    return ins;
  };
  RF.centroide = poly => {
    if (!poly.length) return null;
    let la = 0, lo = 0; poly.forEach(p => { la += p[0]; lo += p[1]; });
    return [la / poly.length, lo / poly.length];
  };
  RF.areaM2 = poly => {
    if (poly.length < 3) return 0;
    const c = RF.centroide(poly), k = Math.cos(c[0] * rad);
    const pts = poly.map(p => [(p[1] - c[1]) * rad * k * R, (p[0] - c[0]) * rad * R]);
    let s = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(s) / 2;
  };
  RF.perimetro = poly => {
    let s = 0; for (let i = 0; i < poly.length; i++) s += RF.dist(poly[i], poly[(i + 1) % poly.length]);
    return s;
  };
  RF.bbox = pts => {
    let s = 90, n = -90, w = 180, e = -180;
    pts.forEach(p => { s = Math.min(s, p[0]); n = Math.max(n, p[0]); w = Math.min(w, p[1]); e = Math.max(e, p[1]); });
    return { s, n, w, e };
  };
  RF.offset = (p, dx, dy) => [p[0] + dy / R / rad, p[1] + dx / (R * Math.cos(p[0] * rad)) / rad];
  RF.mercY = lat => Math.log(Math.tan(Math.PI / 4 + lat * rad / 2));
  RF.invMercY = y => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / rad;

  TS.RF = RF;
})();
