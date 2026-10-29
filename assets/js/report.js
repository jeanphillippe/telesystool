/* Telesys · Planejador de Link Budget (Rascunho)
   Solicitação de orçamento em rascunho: documento imprimível e imagem do mapa. */
window.TS = window.TS || {};
(function () {
  const Rep = {};
  const RF = () => TS.RF;

  /* Imagem do mapa: satélite + predição + elementos, com marca RASCUNHO */
  Rep.snapshot = async (R, S, W = 1100, H = 680) => {
    const cv = R.cv;
    const pts = [...S.area.poligono, ...S.area.estacoes.map(e => [e.lat, e.lng])];
    if (!pts.length) return null;
    const bb = cv ? cv.bb : (() => { const b = RF().bbox(pts); return { s: b.s - 0.005, n: b.n + 0.005, w: b.w - 0.005, e: b.e + 0.005 }; })();
    const wx = (lng, z) => (lng + 180) / 360 * 256 * 2 ** z;
    const wy = (lat, z) => (1 - RF().mercY(lat) / Math.PI) / 2 * 256 * 2 ** z;
    let z = 18;
    while (z > 2 && (wx(bb.e, z) - wx(bb.w, z) > W * 0.96 || wy(bb.s, z) - wy(bb.n, z) > H * 0.96)) z--;
    const cx = (wx(bb.w, z) + wx(bb.e, z)) / 2, cy = (wy(bb.n, z) + wy(bb.s, z)) / 2;
    const ox = cx - W / 2, oy = cy - H / 2;
    const P = (lat, lng) => [wx(lng, z) - ox, wy(lat, z) - oy];
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const fundo = () => { g.fillStyle = '#10151b'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(255,255,255,.05)'; for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } };
    fundo();
    // tiles
    const t0x = Math.floor(ox / 256), t1x = Math.floor((ox + W) / 256), t0y = Math.floor(oy / 256), t1y = Math.floor((oy + H) / 256);
    const jobs = [];
    for (let tx = t0x; tx <= t1x; tx++) for (let ty = t0y; ty <= t1y; ty++) {
      jobs.push(new Promise(res => {
        const im = new Image(); im.crossOrigin = 'anonymous';
        const to = setTimeout(() => res(null), 6000);
        im.onload = () => { clearTimeout(to); res({ im, tx, ty }); };
        im.onerror = () => { clearTimeout(to); res(null); };
        im.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`;
      }));
    }
    const tiles = (await Promise.all(jobs)).filter(Boolean);
    tiles.forEach(t => g.drawImage(t.im, t.tx * 256 - ox, t.ty * 256 - oy));
    try { c.toDataURL(); } catch (e) { fundo(); }
    g.fillStyle = 'rgba(8,10,13,.28)'; g.fillRect(0, 0, W, H);
    // predição
    if (cv) {
      const cc = TS.Cover.canvas(cv, { alphaIn: 170, alphaOut: 60 });
      const [x0, y0] = P(cv.bb.n, cv.bb.w), [x1, y1] = P(cv.bb.s, cv.bb.e);
      g.imageSmoothingEnabled = true; g.globalAlpha = 0.85; g.drawImage(cc, x0, y0, x1 - x0, y1 - y0); g.globalAlpha = 1;
    }
    // zonas
    (S.area.zonas || []).forEach(zn => {
      const t = TS.ZONAS.find(x => x.id === zn.tipo) || TS.ZONAS[0];
      const [x, y] = P(zn.lat, zn.lng), [x2] = P(zn.lat, RF().offset([zn.lat, zn.lng], zn.raio, 0)[1]);
      g.beginPath(); g.arc(x, y, Math.abs(x2 - x), 0, Math.PI * 2); g.strokeStyle = t.cor; g.lineWidth = 2; g.setLineDash([6, 4]); g.stroke(); g.setLineDash([]);
    });
    // polígono
    if (S.area.poligono.length >= 3) {
      g.beginPath(); S.area.poligono.forEach((p, i) => { const [x, y] = P(...p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
      g.strokeStyle = '#f2f5f8'; g.lineWidth = 2.5; g.stroke();
    }
    // backhaul
    if (S.area.core) {
      const [cx2, cy2] = P(S.area.core.lat, S.area.core.lng);
      S.area.estacoes.forEach(e => { const [x, y] = P(e.lat, e.lng); g.beginPath(); g.moveTo(x, y); g.lineTo(cx2, cy2); g.strokeStyle = '#c7b8ff'; g.lineWidth = 2; g.setLineDash([8, 6]); g.stroke(); g.setLineDash([]); });
      g.fillStyle = '#c7b8ff'; g.fillRect(cx2 - 22, cy2 - 10, 44, 20); g.fillStyle = '#16121f'; g.font = '700 11px IBM Plex Sans, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CORE', cx2, cy2 + 1);
    }
    // estações
    S.area.estacoes.forEach(e => {
      const [x, y] = P(e.lat, e.lng);
      g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fillStyle = '#4cc9e0'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#0b0e12'; g.stroke();
      g.font = '600 13px IBM Plex Sans, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
      const tw = g.measureText(e.nome).width;
      g.fillStyle = 'rgba(11,14,18,.85)'; g.fillRect(x + 13, y - 11, tw + 12, 22);
      g.fillStyle = '#e8ecf1'; g.fillText(e.nome, x + 19, y + 1);
    });
    // legenda
    const st = cv ? cv.stats : null;
    g.fillStyle = 'rgba(11,14,18,.88)'; g.fillRect(16, H - 112, 270, 96);
    g.font = '600 12px IBM Plex Sans, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    [['Com folga', '#2fbf71', st && st.folga], ['No limite', '#f2b233', st && st.limite], ['Sem cobertura', '#e5484d', st && st.sem]].forEach(([l, cor, v], i) => {
      g.fillStyle = cor; g.fillRect(28, H - 100 + i * 24, 14, 14);
      g.fillStyle = '#e8ecf1'; g.fillText(`${l}${v != null ? ': ' + TS.fmt.nf(v, 0) + '% da área' : ''}`, 50, H - 93 + i * 24);
    });
    // escala
    const mpp = 156543.03392 * Math.cos(((bb.s + bb.n) / 2) * Math.PI / 180) / 2 ** z;
    const alvo = mpp * 160, base = Math.pow(10, Math.floor(Math.log10(alvo)));
    const sc = [1, 2, 5, 10].map(m => m * base).filter(v => v <= alvo).pop() || base;
    const px = sc / mpp;
    g.fillStyle = 'rgba(11,14,18,.88)'; g.fillRect(W - px - 46, H - 44, px + 30, 28);
    g.fillStyle = '#e8ecf1'; g.fillRect(W - px - 32, H - 26, px, 4);
    g.textAlign = 'center'; g.fillText(sc >= 1000 ? `${sc / 1000} km` : `${sc} m`, W - px / 2 - 32, H - 35);
    // norte
    g.fillStyle = 'rgba(11,14,18,.88)'; g.beginPath(); g.arc(W - 34, 34, 18, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8ecf1'; g.font = '700 13px IBM Plex Sans, sans-serif'; g.fillText('N', W - 34, 35);
    // marca
    g.save(); g.translate(W / 2, H / 2); g.rotate(-0.32);
    g.font = '800 120px IBM Plex Sans, sans-serif'; g.fillStyle = 'rgba(255,255,255,.09)'; g.textAlign = 'center'; g.fillText('RASCUNHO', 0, 0);
    g.restore();
    g.font = '500 11px IBM Plex Sans, sans-serif'; g.fillStyle = 'rgba(232,236,241,.75)'; g.textAlign = 'left';
    g.fillText(tiles.length ? 'Imagens © Esri · Predição preliminar, não considera relevo' : 'Predição preliminar, não considera relevo', 16, 18);
    try { return c.toDataURL('image/png'); } catch (e) { return null; }
  };

  const tab = (cab, linhas, cls = '') => cls === 'kv' ? `<table class="rt rkv"><tbody>${linhas.map(l => `<tr><th>${l[0]}</th><td>${l[1]}</td></tr>`).join('')}</tbody></table>` : `<table class="rt ${cls}"><thead><tr>${cab.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  Rep.gerar = async (R, S, itens, pq) => {
    const el = document.getElementById('relatorio'); if (!el) return;
    const { nf, nint, dist, esc } = TS.fmt;
    const r = R.r, cv = R.cv;
    const data = new Date();
    const dstr = data.toLocaleDateString('pt-BR');
    const num = `RASC-${data.toISOString().slice(0, 10).replace(/-/g, '')}-${S.meta.id}`;
    const setor = (TS.SETORES.find(s => s.id === S.projeto.setor) || {}).l;
    const tit = { indefinido: 'A definir', slp: 'SLP próprio do cliente', operadora: 'Espectro de operadora' }[S.projeto.titularidade];
    const dados = { indefinido: 'A definir', local: 'No local (on-premises)', nuvem: 'Pode usar nuvem' }[S.projeto.dados];
    const ck = TS.CHECKLIST.flatMap(g => g.itens.map(i => [esc(i.t), S.checklist[i.id]?.ok ? '<span class="ok">levantado</span>' : '<span class="pend">pendente</span>', esc(S.checklist[i.id]?.nota || '')]));
    const devs = S.dispositivos.map(d => { const t = TS.devById(d.tipo); return [esc(t.l), nint(d.qtd), nf(d.ativ, 0) + '%', nf(d.ul, 2), nf(d.dl, 2), [d.mov ? 'móvel' : '', d.lat ? 'latência crítica' : ''].filter(Boolean).join(', ') || 'fixo']; });
    const bandas = S.terminais.bandas.map(k => TS.TERM_BANDS.find(t => t.k === k)?.l).filter(Boolean).join(', ') || 'não informadas';
    const alt = R.ranking.filter(x => x.id !== R.band.id).slice(0, 3);
    const est = S.area.estacoes.map(e => [esc(e.nome), `${e.lat.toFixed(5)}, ${e.lng.toFixed(5)}`, `${nint(e.h)} m`, { tri: 'trissetorial', setorial: `setorial, ${e.az}°`, omni: 'omni' }[e.antena]]);
    const frases = cv ? [
      `Onde a cobertura chega com folga: <b>${nf(cv.stats.folga, 0)}%</b> da área.`,
      `Onde chega no limite: <b>${nf(cv.stats.limite, 0)}%</b> da área.`,
      `Onde não chega: <b>${nf(cv.stats.sem, 0)}%</b> da área${cv.stats.sem > 5 && cv.pior ? `, com o pior ponto perto de ${cv.pior.lat.toFixed(4)}, ${cv.pior.lng.toFixed(4)} (avaliar estação adicional)` : ''}.`
    ] : ['Sem estações posicionadas: mapa de predição não gerado.'];
    const lb = [
      ['<b>1 · O que sai</b>', 'Potência de transmissão', `${nf(r.DL.ptx)} dBm`, `${nf(r.UL.ptx)} dBm`],
      ['', 'Ganho da antena do transmissor', `${nf(r.DL.gtx)} dBi`, `${nf(r.UL.gtx)} dBi`],
      ['', 'Cabos e conectores', `${nf(r.DL.cabos)} dB`, `${nf(S.rf.est.cabo)} dB (na recepção)`],
      ['<b>2 · O que se perde</b>', 'Modelo de propagação', esc(TS.MODELOS[r.modelo]), esc(TS.MODELOS[r.modelo])],
      ['', 'Frequência central', `${nf(R.band.fDL, 1)} MHz`, `${nf(R.band.fUL, 1)} MHz`],
      ['', 'Obstáculos típicos', `${nf(r.DL.obst)} dB`, `${nf(r.UL.obst)} dB`],
      ['', 'Ganho da antena do receptor', `${nf(r.DL.grx)} dBi`, `${nf(S.rf.est.gant)} dBi`],
      ['<b>3 · O que precisa chegar</b>', 'Sensibilidade do receptor', `${nf(r.DL.sens)} dBm`, `${nf(r.UL.sens)} dBm`],
      ['', 'Perda máxima admissível', `${nf(r.DL.mapl - r.DL.obst)} dB`, `${nf(r.UL.mapl - r.UL.obst)} dB`],
      ['<b>4 · A folga</b>', `Margem exigida (${S.rf.conf}% na borda, σ ${nf(r.sigma)} dB, interferência ${nf(+S.rf.interf)} dB)`, `${nf(r.folgaReq)} dB`, `${nf(r.folgaReq)} dB`],
      ['', 'Raio com folga', `<b>${dist(r.DL.rFolga)}</b>`, `<b>${dist(r.UL.rFolga)}</b>`],
      ['', 'Raio no limite', dist(r.DL.rLimite), dist(r.UL.rLimite)]
    ];

    el.innerHTML = `
      <div class="d-mark" aria-hidden="true">RASCUNHO</div>
      <header class="d-head">
        <div><div class="d-brand">Telesys <span>Redes privativas</span></div><h1>Solicitação de orçamento</h1><div class="d-proj">${esc(S.projeto.nome || 'Projeto sem nome')}</div></div>
        <div class="d-stamp"><b>RASCUNHO</b><span>v${S.meta.rev}</span></div>
      </header>
      <div class="d-meta">
        <div><span>Número</span><b>${num}</b></div><div><span>Data</span><b>${dstr}</b></div>
        <div><span>Integrador</span><b>${esc(S.integrador.empresa || 'a definir')}</b></div><div><span>Cliente final</span><b>${esc(S.projeto.cliente || 'a definir')}</b></div>
      </div>
      <div class="d-aviso"><b>Documento preliminar.</b> Este rascunho serve para solicitar orçamento e dimensionamento à Telesys. Não é proposta, especificação final nem compromisso técnico ou comercial. Os valores vêm de modelos de propagação de referência e de datasheets públicos, sujeitos a validação. Não contém preços.</div>

      <section><h2>1. Projeto</h2>${tab(['Campo', 'Informação'], [
        ['Cliente final', esc(S.projeto.cliente || 'a definir')], ['Setor', esc(setor)], ['Local', esc(S.projeto.local || 'a definir')], ['Prazo desejado', esc(S.projeto.prazo || 'a definir')],
        ['Titularidade da autorização', esc(tit)], ['Dados', esc(dados)],
        ['Integrador', `${esc(S.integrador.empresa)} · ${esc(S.integrador.contato)} · ${esc(S.integrador.email)} ${esc(S.integrador.fone)}`]
      ], 'kv')}${S.projeto.obs ? `<p class="d-obs">${esc(S.projeto.obs)}</p>` : ''}</section>

      <section><h2>2. Levantamento da visita técnica</h2>${tab(['Item', 'Situação', 'Anotação'], ck)}</section>

      <section class="brk"><h2>3. Área e mapa de predição</h2>
        <div class="d-kpis"><div><span>Área</span><b>${R.areaM2 ? nf(R.areaM2 / 1e6, 2) + ' km²' : 'n/d'}</b></div><div><span>Ambiente</span><b>${esc(R.amb.l)}</b></div><div><span>Estações no mapa</span><b>${S.area.estacoes.length}</b></div><div><span>Estações indicadas</span><b>${R.nRec}</b></div></div>
        <div class="d-map" id="dMap"><div class="mut">Gerando imagem do mapa...</div></div>
        <ul class="d-frases">${frases.map(f => `<li>${f}</li>`).join('')}</ul>
        ${est.length ? tab(['Estação', 'Coordenadas', 'Altura', 'Antena'], est) : ''}
      </section>

      <section><h2>4. Dispositivos e demanda</h2>
        ${devs.length ? tab(['Tipo', 'Qtd.', 'Atividade', 'UL Mbps/un.', 'DL Mbps/un.', 'Perfil'], devs) : '<p class="mut">Inventário não informado.</p>'}
        <div class="d-kpis"><div><span>Dispositivos</span><b>${nint(R.dem.n)} hoje · ${nint(R.dem.nF)} previstos</b></div><div><span>Uplink agregado</span><b>${nf(R.dem.ulF)} Mbps</b></div><div><span>Downlink agregado</span><b>${nf(R.dem.dlF)} Mbps</b></div><div><span>Intenção 5G</span><b>${S.terminais.quer5G ? 'sim' : 'não informada'}</b></div></div>
        <p><b>Bandas suportadas pelos terminais:</b> ${esc(bandas)}.</p>
      </section>

      <section class="brk"><h2>5. Faixa sugerida e por que</h2>
        <div class="d-band"><b>${esc(R.band.nome)}</b><span>${esc(R.band.faixa)} · ${esc(R.band.g3pp)} · ${esc(R.band.duplex)} · canal de ${R.bw} MHz</span></div>
        <div class="d-2"><div><h3>Motivos</h3><ul>${pq.pro.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div><div><h3>Pontos de atenção</h3><ul>${pq.con.map(t => `<li>${esc(t)}</li>`).join('') || '<li>Nenhum com os dados atuais.</li>'}</ul></div></div>
        <h3>Alternativas consideradas</h3>
        ${tab(['Faixa', 'Aderência', 'Raio com folga', 'Principal ressalva'], alt.map(x => [esc(x.band.nome), `${x.s}/100`, dist(x.r.rFolga), esc(x.con[0] || x.pro[0] || '')]))}
      </section>

      <section><h2>6. Link budget</h2>
        ${tab(['Parte', 'Parâmetro', 'Downlink', 'Uplink'], lb, 'rlb')}
        <p>Limitante: <b>${r.limitante === 'UL' ? 'uplink' : 'downlink'}</b>. Desbalanço DL − UL de ${TS.fmt.sgn(r.desbalanco)} dB. ${r.limitante === 'UL' ? 'O terminal recebe bem a estação, mas responde com menos folga: a cobertura útil é definida pelo terminal.' : ''}</p>
        <p class="mut">Capacidade estimada por estação: ${nf(R.cap.dl)} Mbps DL e ${nf(R.cap.ul)} Mbps UL${R.band.duplex !== 'FDD' ? ` (${esc(TS.TDD[R.tdd].l)})` : ''}. Estações por cobertura: ${Number.isFinite(R.nCob) ? R.nCob : 'n/d'} · por capacidade: ${R.nCap} · por usuários: ${R.nUsr}.</p>
      </section>

      <section class="brk"><h2>7. Equipamentos para orçamento</h2><p class="mut">Especificações de referência para a Telesys orçar. Sem preços.</p>
        ${itens.map(i => `<div class="d-item"><div class="d-item-h"><div><small>${esc(i.g)}</small><b>${esc(i.nome)}</b><span>${esc(i.tipo)}</span></div>${i.qtd !== '' ? `<div class="d-qty">${esc(i.qtd)} <small>${esc(i.un)}</small></div>` : ''}</div>
          <div class="d-2"><table class="rt rkv">${i.specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table><div><h4>Por que</h4><ul>${i.porque.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div></div></div>`).join('')}
      </section>

      <section><h2>8. Pendências e pontos a validar com a Telesys</h2>
        <ul>${R.pend.map(p => `<li>${esc(p.t)}</li>`).join('') || '<li>Sem pendências registradas.</li>'}</ul>
      </section>

      <section><h2>9. Premissas</h2><ul class="mut">
        <li>Perda de percurso por ${esc(TS.MODELOS[r.modelo])}; paredes e vidros pelo 3GPP TR 38.901; vegetação pelo modelo de Weissberger.</li>
        <li>O mapa de predição não considera relevo nem edificações além das zonas marcadas; serve para a conversa inicial com o cliente.</li>
        <li>Potências, ganhos e sensibilidades de referência vêm de datasheets públicos; variantes de banda e disponibilidade devem ser confirmadas com a Telesys.</li>
        <li>Faixas conforme o Mapa de Redes Celulares Privativas no Brasil (Mobile Time, agosto de 2026). Requisitos regulatórios a confirmar na regulamentação vigente da Anatel.</li>
      </ul></section>
      <footer class="d-foot">Rascunho ${num} · v${S.meta.rev} · gerado em ${dstr} · sem valor de proposta</footer>`;
    const img = await Rep.snapshot(R, S);
    const box = document.getElementById('dMap');
    if (box) box.innerHTML = img ? `<img src="${img}" alt="Mapa de predição de cobertura (rascunho)">` : '<div class="mut">Mapa indisponível: desenhe a área e posicione estações.</div>';
  };

  TS.Report = Rep;
})();
