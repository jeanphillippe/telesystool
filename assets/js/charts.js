/* Telesys · Planejador de Link Budget (Rascunho)
   Gráficos 2D em SVG puro (sem bibliotecas). */
window.TS = window.TS || {};
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const s = (tag, a = {}, txt) => {
    const e = document.createElementNS(NS, tag);
    for (const k in a) e.setAttribute(k, a[k]);
    if (txt != null) e.textContent = txt;
    return e;
  };
  const svgRoot = (w, h, cls) => s('svg', { viewBox: `0 0 ${w} ${h}`, class: cls || 'chart', role: 'img', preserveAspectRatio: 'xMidYMid meet' });
  const ticks = (min, max, n) => {
    const span = max - min, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const st = [1, 2, 2.5, 5, 10].map(m => m * mag).find(v => v >= raw) || raw;
    const out = []; for (let v = Math.ceil(min / st) * st; v <= max + 1e-9; v += st) out.push(+v.toFixed(6));
    return out;
  };
  const C = {};

  /* Cascata horizontal do link budget */
  C.waterfall = (host, cfg) => {
    host.innerHTML = '';
    const rows = cfg.rows; // {l, sub, v, tipo: 'base'|'mais'|'menos'|'total', parte}
    const W = Math.max(400, host.clientWidth || 720), rowH = 34, top = 30, left = W < 520 ? 150 : 190, right = 24;
    const H = top + rows.length * rowH + 44;
    let lvl = 0; const seg = [];
    rows.forEach(r => {
      if (r.tipo === 'base') { seg.push([null, r.v]); lvl = r.v; }
      else if (r.tipo === 'total') { seg.push([null, lvl]); }
      else { const a = lvl, b = r.tipo === 'mais' ? lvl + r.v : lvl - r.v; seg.push([a, b]); lvl = b; }
    });
    const vals = seg.flatMap(x => x.filter(v => v != null)).concat([cfg.sens, cfg.sens + cfg.req]);
    let min = Math.floor((Math.min(...vals) - 8) / 10) * 10, max = Math.ceil((Math.max(...vals) + 5) / 10) * 10;
    const x = v => left + (v - min) / (max - min) * (W - left - right);
    const svg = svgRoot(W, H);
    ticks(min, max, 8).forEach(t => {
      svg.appendChild(s('line', { x1: x(t), x2: x(t), y1: top - 8, y2: H - 30, class: 'gridl' }));
      svg.appendChild(s('text', { x: x(t), y: H - 14, class: 'axt', 'text-anchor': 'middle' }, t));
    });
    svg.appendChild(s('text', { x: W - right, y: H - 1, class: 'axt', 'text-anchor': 'end' }, 'dBm'));
    // zonas de referência
    const ySens0 = top - 10, ySens1 = H - 30;
    svg.appendChild(s('rect', { x: x(min), y: ySens0, width: Math.max(0, x(cfg.sens) - x(min)), height: ySens1 - ySens0, class: 'z-sem' }));
    svg.appendChild(s('rect', { x: x(cfg.sens), y: ySens0, width: Math.max(0, x(cfg.sens + cfg.req) - x(cfg.sens)), height: ySens1 - ySens0, class: 'z-lim' }));
    rows.forEach((r, i) => {
      const y = top + i * rowH;
      const [a, b] = seg[i];
      const x0 = a == null ? x(min) : x(Math.min(a, b)), x1 = a == null ? x(b) : x(Math.max(a, b));
      if (r.parte) svg.appendChild(s('text', { x: 6, y: y + 21, class: 'wf-parte' }, r.parte));
      svg.appendChild(s('text', { x: left - 10, y: y + 15, class: 'wf-l', 'text-anchor': 'end' }, r.l));
      if (r.sub) svg.appendChild(s('text', { x: left - 10, y: y + 28, class: 'wf-sub', 'text-anchor': 'end' }, r.sub));
      let cls = r.tipo === 'mais' ? 'wf-mais' : r.tipo === 'menos' ? 'wf-menos' : 'wf-base';
      if (r.tipo === 'total') cls = 'wf-total ' + (b - cfg.sens >= cfg.req ? 'ok' : b >= cfg.sens ? 'lim' : 'sem');
      svg.appendChild(s('rect', { x: x0, y: y + 6, width: Math.max(2, x1 - x0), height: rowH - 12, rx: 3, class: cls }));
      if (a != null && i < rows.length - 1) {
        const yn = y + rowH + 6;
        svg.appendChild(s('line', { x1: x(b), x2: x(b), y1: y + rowH - 6, y2: yn, class: 'wf-con' }));
      }
      const txt = r.tipo === 'base' || r.tipo === 'total' ? `${nf1.format(b)} dBm` : `${r.tipo === 'mais' ? '+' : '−'}${nf1.format(Math.abs(r.v))} dB`;
      const tx = x1 + 6 > W - 90 ? x0 - 6 : x1 + 6;
      svg.appendChild(s('text', { x: tx, y: y + 21, class: 'wf-v', 'text-anchor': x1 + 6 > W - 90 ? 'end' : 'start' }, txt));
    });
    const lineV = (v, cls, lab) => {
      svg.appendChild(s('line', { x1: x(v), x2: x(v), y1: top - 12, y2: H - 30, class: cls }));
      svg.appendChild(s('text', { x: x(v) + 4, y: top - 16, class: 'wf-ref' }, lab));
    };
    lineV(cfg.sens, 'ref-sens', `Sensibilidade ${nf1.format(cfg.sens)}`);
    if (cfg.req > 0.5) lineV(cfg.sens + cfg.req, 'ref-folga', '');
    host.appendChild(svg);
  };

  /* Curva margem x distância (DL e UL) com faixas de cor */
  C.margem = (host, cfg) => {
    host.innerHTML = '';
    const W = Math.max(400, host.clientWidth || 720), H = 300, L = 48, Rt = 18, T = 26, B = 38;
    const xmax = cfg.xmax;
    const allY = cfg.series.flatMap(sr => sr.pts.map(p => p[1]));
    const ymin = Math.max(-40, Math.floor((Math.min(...allY, -10)) / 10) * 10);
    const ymax = Math.min(80, Math.ceil((Math.max(...allY, cfg.req + 10)) / 10) * 10);
    const x = d => L + d / xmax * (W - L - Rt);
    const y = m => T + (ymax - Math.max(ymin, Math.min(ymax, m))) / (ymax - ymin) * (H - T - B);
    const svg = svgRoot(W, H);
    svg.appendChild(s('rect', { x: L, y: y(ymax), width: W - L - Rt, height: y(cfg.req) - y(ymax), class: 'z-ok' }));
    svg.appendChild(s('rect', { x: L, y: y(cfg.req), width: W - L - Rt, height: y(0) - y(cfg.req), class: 'z-lim' }));
    svg.appendChild(s('rect', { x: L, y: y(0), width: W - L - Rt, height: y(ymin) - y(0), class: 'z-sem' }));
    ticks(ymin, ymax, 6).forEach(t => {
      svg.appendChild(s('line', { x1: L, x2: W - Rt, y1: y(t), y2: y(t), class: 'gridl' }));
      svg.appendChild(s('text', { x: L - 6, y: y(t) + 4, class: 'axt', 'text-anchor': 'end' }, t));
    });
    ticks(0, xmax, 8).forEach(t => {
      svg.appendChild(s('line', { x1: x(t), x2: x(t), y1: T, y2: H - B, class: 'gridl' }));
      svg.appendChild(s('text', { x: x(t), y: H - B + 16, class: 'axt', 'text-anchor': 'middle' }, nf2.format(t)));
    });
    svg.appendChild(s('text', { x: W - Rt, y: H - 4, class: 'axt', 'text-anchor': 'end' }, 'distância (km)'));
    svg.appendChild(s('text', { x: 4, y: 12, class: 'axt' }, 'margem (dB)'));
    svg.appendChild(s('text', { x: W - Rt - 6, y: y(ymax) + 14, class: 'zl ok', 'text-anchor': 'end' }, 'com folga'));
    svg.appendChild(s('text', { x: W - Rt - 6, y: y(cfg.req) + 14, class: 'zl lim', 'text-anchor': 'end' }, 'no limite'));
    svg.appendChild(s('text', { x: W - Rt - 6, y: y(0) + 14, class: 'zl sem', 'text-anchor': 'end' }, 'sem cobertura'));
    cfg.series.forEach(sr => {
      const d = sr.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
      svg.appendChild(s('path', { d, class: 'mc-line', stroke: sr.cor }));
      if (sr.rFolga > 0 && sr.rFolga / 1000 <= xmax) {
        svg.appendChild(s('circle', { cx: x(sr.rFolga / 1000), cy: y(cfg.req), r: 4.5, fill: sr.cor, class: 'mc-pt' }));
      }
    });
    if (cfg.marcador != null && cfg.marcador <= xmax) {
      svg.appendChild(s('line', { x1: x(cfg.marcador), x2: x(cfg.marcador), y1: T, y2: H - B, class: 'mc-marc' }));
    }
    // cursor interativo
    const cur = s('g', { class: 'mc-cur', style: 'display:none' });
    const cl = s('line', { y1: T, y2: H - B, class: 'mc-cl' });
    const box = s('rect', { width: 150, height: 18 + cfg.series.length * 16, rx: 6, class: 'mc-box' });
    const tt = cfg.series.map(() => s('text', { class: 'mc-tt' }));
    const td = s('text', { class: 'mc-tt b' });
    cur.append(cl, box, td, ...tt); svg.appendChild(cur);
    const hit = s('rect', { x: L, y: T, width: W - L - Rt, height: H - T - B, fill: 'transparent' });
    svg.appendChild(hit);
    hit.addEventListener('mousemove', ev => {
      const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const dk = Math.max(0, Math.min(xmax, (p.x - L) / (W - L - Rt) * xmax));
      cur.style.display = '';
      cl.setAttribute('x1', x(dk)); cl.setAttribute('x2', x(dk));
      const bx = x(dk) + 160 > W ? x(dk) - 158 : x(dk) + 8;
      box.setAttribute('x', bx); box.setAttribute('y', T + 4);
      td.setAttribute('x', bx + 8); td.setAttribute('y', T + 17); td.textContent = `${nf2.format(dk)} km`;
      cfg.series.forEach((sr, i) => {
        const m = sr.fn(dk * 1000);
        tt[i].setAttribute('x', bx + 8); tt[i].setAttribute('y', T + 33 + i * 16);
        tt[i].textContent = `${sr.nome}: ${nf1.format(m)} dB`;
        tt[i].setAttribute('fill', sr.cor);
      });
    });
    hit.addEventListener('mouseleave', () => { cur.style.display = 'none'; });
    host.appendChild(svg);
  };

  /* Alcance por faixa (mesmas condições) */
  C.faixas = (host, rows) => {
    host.innerHTML = '';
    const W = Math.max(400, host.clientWidth || 720), rowH = 30, L = 90, Rt = 150, T = 8;
    const H = T + rows.length * rowH + 26;
    const max = Math.max(...rows.map(r => r.limite), 0.1);
    const x = v => L + v / max * (W - L - Rt);
    const svg = svgRoot(W, H);
    ticks(0, max, 6).forEach(t => {
      svg.appendChild(s('line', { x1: x(t), x2: x(t), y1: T, y2: H - 22, class: 'gridl' }));
      svg.appendChild(s('text', { x: x(t), y: H - 6, class: 'axt', 'text-anchor': 'middle' }, nf2.format(t)));
    });
    rows.forEach((r, i) => {
      const y = T + i * rowH;
      svg.appendChild(s('text', { x: L - 10, y: y + 19, class: 'wf-l' + (r.sel ? ' sel' : ''), 'text-anchor': 'end' }, r.l));
      svg.appendChild(s('rect', { x: L, y: y + 6, width: Math.max(1, x(r.limite) - L), height: rowH - 12, rx: 3, class: 'fx-lim' + (r.sel ? ' sel' : '') }));
      svg.appendChild(s('rect', { x: L, y: y + 6, width: Math.max(1, x(r.folga) - L), height: rowH - 12, rx: 3, class: 'fx-ok' + (r.sel ? ' sel' : '') }));
      svg.appendChild(s('text', { x: x(r.limite) + 6, y: y + 19, class: 'wf-v' }, `${nf2.format(r.folga)} / ${nf2.format(r.limite)} km`));
    });
    host.appendChild(svg);
  };

  /* Demanda x capacidade */
  C.capacidade = (host, cfg) => {
    host.innerHTML = '';
    const W = Math.max(400, host.clientWidth || 720), H = 120, L = 90, Rt = 24;
    const svg = svgRoot(W, H);
    const max = Math.max(cfg.ulDem, cfg.ulCap * cfg.n, cfg.dlDem, cfg.dlCap * cfg.n, 1) * 1.1;
    const x = v => L + v / max * (W - L - Rt);
    [['Uplink', cfg.ulDem, cfg.ulCap * cfg.n, 18], ['Downlink', cfg.dlDem, cfg.dlCap * cfg.n, 68]].forEach(([l, dem, cap, y]) => {
      svg.appendChild(s('text', { x: L - 10, y: y + 16, class: 'wf-l', 'text-anchor': 'end' }, l));
      svg.appendChild(s('rect', { x: L, y, width: Math.max(1, x(cap) - L), height: 24, rx: 4, class: 'cap-cap' }));
      svg.appendChild(s('rect', { x: L, y: y + 6, width: Math.max(1, x(dem) - L), height: 12, rx: 3, class: dem > cap * 0.7 ? 'cap-dem warn' : 'cap-dem' }));
      svg.appendChild(s('line', { x1: x(cap * 0.7), x2: x(cap * 0.7), y1: y - 3, y2: y + 27, class: 'cap-70' }));
      svg.appendChild(s('text', { x: L + 6, y: y + 38, class: 'wf-sub' }, `demanda ${nf1.format(dem)} Mbps · capacidade estimada ${nf1.format(cap)} Mbps (${cfg.n} ${cfg.n > 1 ? 'estações' : 'estação'})`));
    });
    host.appendChild(svg);
  };

  TS.Charts = C;
})();
