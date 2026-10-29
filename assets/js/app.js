/* Telesys · Planejador de Link Budget (Rascunho)
   Estado, cálculo, navegação e renderização das seções. */
(function () {
  const RF = TS.RF;
  const CHAVE = 'telesys-linkbudget-rascunho-v1';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (v, d = 1) => Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : 'n/d';
  const nint = v => Number.isFinite(v) ? Math.round(v).toLocaleString('pt-BR') : 'n/d';
  const dist = m => !Number.isFinite(m) || m <= 0 ? '0 m' : m < 1000 ? `${Math.round(m)} m` : `${nf(m / 1000, m < 10000 ? 2 : 1)} km`;
  const sgn = v => (v >= 0 ? '+' : '') + nf(v);
  const hoje = () => new Date().toISOString();
  const rid = () => Math.random().toString(36).slice(2, 8).toUpperCase();
  TS.fmt = { nf, nint, dist, esc, sgn };

  /* ---------- Estado ---------- */
  const novoEstado = () => ({
    meta: { app: 'telesys-linkbudget', versao: 1, rev: 1, criado: hoje(), atualizado: hoje(), id: rid() },
    projeto: { nome: '', cliente: '', setor: 'agro', local: '', prazo: '', titularidade: 'indefinido', dados: 'indefinido', obs: '', outorga250: false },
    integrador: { empresa: '', contato: '', email: '', fone: '' },
    checklist: {},
    area: { poligono: [], ambiente: 'rural', estacoes: [], zonas: [], core: null },
    dispositivos: [],
    terminais: { bandas: [], ref: 'modulo', cresc: 30, anos: 3, quer5G: false },
    faixa: { auto: true, sel: 'b28', aplicada: null, equip: null, equipAuto: true, equipAplicado: null, bw: 5, tdd: 'auto' },
    rf: {
      modelo: 'auto', visada: 'auto', hBS: 30, hUT: 1.5, conf: 90, sigma: null, interf: 2,
      obst: { concreto: 0, madeira: 0, vidro: 0, irr: 0, vegetacao: 0, cabine: 0, metal: 0 },
      est: { ptx: 46, gant: 15, cabo: 2, sens: -102 },
      term: { ptx: 23, g: 0, nf: 9, sinr: -1, sensAuto: true, sens: -99.5 },
      divDL: 0, divUL: 0, dist: null
    },
    ui: { view: 'projeto', visitados: {} }
  });

  const exemplo = () => {
    const s = novoEstado();
    Object.assign(s.projeto, { nome: 'Fazenda Santa Clara: rede LTE privativa', cliente: 'Fazenda Santa Clara (exemplo)', setor: 'agro', local: 'Sorriso, MT', prazo: 'Safra 2027', titularidade: 'slp', dados: 'local' });
    Object.assign(s.integrador, { empresa: 'Integrador Exemplo Ltda.', contato: 'Responsável técnico', email: 'contato@integrador.com.br', fone: '' });
    s.area.poligono = [[-12.5262, -55.7655], [-12.5238, -55.7135], [-12.5455, -55.7032], [-12.5668, -55.7148], [-12.5702, -55.7486], [-12.5531, -55.7712]];
    s.area.estacoes = [
      { id: 'e1', nome: 'Silo sede', lat: -12.5452, lng: -55.7398, h: 35, antena: 'tri', az: 0 },
      { id: 'e2', nome: "Caixa d'água norte", lat: -12.5318, lng: -55.7505, h: 25, antena: 'tri', az: 0 },
      { id: 'e3', nome: 'Torre leste', lat: -12.5502, lng: -55.7158, h: 30, antena: 'tri', az: 0 }
    ];
    s.area.zonas = [{ id: 'z1', tipo: 'vegetacao', lat: -12.5335, lng: -55.7255, raio: 420, prof: 80, db: 10, paredes: 2 },
      { id: 'z2', tipo: 'metal', lat: -12.5468, lng: -55.7372, raio: 120, db: 12, prof: 60, paredes: 2 }];
    s.area.core = { lat: -12.5476, lng: -55.7431 };
    s.dispositivos = [
      { tipo: 'maquina', qtd: 12, ativ: 100, ul: 0.5, dl: 0.3, mov: true, lat: true },
      { tipo: 'sensor', qtd: 40, ativ: 100, ul: 0.02, dl: 0.01, mov: false, lat: false },
      { tipo: 'camhd', qtd: 2, ativ: 100, ul: 4, dl: 0.1, mov: false, lat: false },
      { tipo: 'tablet', qtd: 8, ativ: 50, ul: 1, dl: 3, mov: true, lat: false }
    ];
    s.terminais = { bandas: ['B28', 'B43'], ref: 'maquina', cresc: 30, anos: 3, quer5G: false };
    s.rf.hUT = 3; s.rf.term.g = 3;
    ['area', 'obst', 'altos', 'inv', 'mob', 'bandas'].forEach(k => s.checklist[k] = { ok: true, nota: '' });
    s.checklist.area.nota = 'Sede, silos e talhões ao norte. Sem subsolo.';
    s.checklist.obst.nota = 'Faixa de eucalipto a nordeste; galpão metálico junto ao silo.';
    s.checklist.altos.nota = 'Silo sede com 35 m, energia disponível e acesso por escada.';
    s.meta.exemplo = true;
    return s;
  };

  let S;
  const carregar = () => {
    try { const j = localStorage.getItem(CHAVE); if (j) return mesclar(JSON.parse(j)); } catch (e) { /* sem storage */ }
    return null;
  };
  const mesclar = o => {
    const b = novoEstado();
    const deep = (t, f) => { for (const k in f) { if (f[k] && typeof f[k] === 'object' && !Array.isArray(f[k]) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) deep(t[k], f[k]); else t[k] = f[k]; } return t; };
    return deep(b, o);
  };
  let tSalvar;
  const salvar = () => { clearTimeout(tSalvar); tSalvar = setTimeout(() => { S.meta.atualizado = hoje(); try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch (e) { /* ignora */ } }, 300); };

  const getP = (p, o = S) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
  const setP = (p, v, o = S) => { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; };

  /* ---------- Cálculo ---------- */
  const demanda = st => {
    let ul = 0, dl = 0, n = 0, mov = 0, lat = 0, up = 0;
    st.dispositivos.forEach(d => {
      const q = Number(d.qtd) || 0, a = (Number(d.ativ) || 0) / 100;
      ul += q * a * (Number(d.ul) || 0); dl += q * a * (Number(d.dl) || 0); n += q;
      if (d.mov) mov += q; if (d.lat) lat += q; if (TS.devById(d.tipo).upHeavy) up += q;
    });
    const g = 1 + (Number(st.terminais.cresc) || 0) / 100;
    return { ul, dl, n, mov, lat, up, g, ulF: ul * g, dlF: dl * g, nF: Math.ceil(n * g) };
  };

  const bwOpts = (band, eq) => eq && eq.tech === 'LTE' ? band.bwOpts.filter(b => b <= 20 || (b === 40 && band.id === 'b37')) : band.bwOpts;

  const escolherEquip = (band, st, dem, auto = st.faixa.equipAuto) => {
    const ops = TS.EQUIP_POR_FAIXA[band.id];
    if (!auto && ops.includes(st.faixa.equip)) return st.faixa.equip;
    if (band.id === 'b37') {
      if (st.terminais.quer5G || dem.ulF > 40) return 'aurora243';
      if (TS.ambById(st.area.ambiente).indoor) return 'nova430i';
      return 'nova436q';
    }
    return ops[0];
  };

  const estDefaults = (band, eq) => ({
    ptx: band.limitePtx ? Math.min(eq.ptx, band.limitePtx) : eq.ptx,
    gant: eq.gant ?? band.gant,
    cabo: eq.antena === 'integrada' ? 0.5 : 2,
    sens: eq.sens
  });

  const montarRF = (st, band, eq, est, bw) => {
    const t = st.rf.term;
    const sensT = t.sensAuto ? +RF.sensFormula(bw, t.nf, t.sinr, eq.tech).toFixed(1) : t.sens;
    return Object.assign({}, st.rf, {
      dl: { ptx: +est.ptx, gant: +est.gant, cabo: +est.cabo, grx: +t.g, div: +st.rf.divDL, sens: +sensT },
      ul: { ptx: +t.ptx, gtx: +t.g, sens: +est.sens, div: +st.rf.divUL },
      sensT
    });
  };

  const tddEfetivo = (st, dem) => {
    if (st.faixa.tdd !== 'auto') return st.faixa.tdd;
    const ratio = dem.dlF > 0 ? dem.ulF / dem.dlF : 1;
    return ratio > 0.8 ? 'cfg0' : ratio > 0.35 ? 'cfg1' : 'cfg2';
  };

  const celulasPorSite = (st, amb) => st.area.estacoes.length ? st.area.estacoes.reduce((a, e) => a + (e.antena === 'tri' ? 3 : 1), 0) / st.area.estacoes.length : (amb.indoor ? 1 : 3);

  const rankFaixas = (st, dem, areaKm2) => {
    const amb = TS.ambById(st.area.ambiente);
    const cps = celulasPorSite(st, amb);
    const setor = TS.SETORES.find(x => x.id === st.projeto.setor) || TS.SETORES[0];
    const tb = st.terminais.bandas;
    return TS.BANDS.map(b => {
      const eqId = escolherEquip(b, st, dem, true), eq = TS.EQUIP[eqId];
      const est = estDefaults(b, eq);
      const bw = b.bw;
      const r = RF.calcular({ band: b, amb, rf: montarRF(st, b, eq, est, bw) });
      const cap = RF.capacidade(b, Math.max(...bwOpts(b, eq)), eq.tech, tddEfetivo(st, dem));
      const nCob = areaKm2 > 0 && r.rFolga > 0 ? Math.ceil(areaKm2 * 1e6 / (2.598 * r.rFolga ** 2)) : (r.rFolga > 0 ? 1 : 99);
      let s = 50; const pro = [], con = [];
      const bon = setor.bonus[b.id] || 0;
      if (bon) { s += bon; pro.push(`Faixa de referência para ${setor.l.toLowerCase()}: ${b.uso}`); }
      const baixa = b.fDL < 1000, alta = b.fDL > 3000;
      if (areaKm2 > 3) {
        if (baixa) { s += 14; pro.push('Área extensa: faixas mais baixas cobrem distâncias maiores e atravessam melhor obstáculos.'); }
        if (alta) { s -= 16; con.push(`Área de ${nf(areaKm2)} km² para uma faixa de alcance curto.`); }
      } else if (areaKm2 > 0 && areaKm2 <= 1) {
        if (alta || b.id === 'b24') { s += 10; pro.push('Área menor: faixas mais altas oferecem mais capacidade em áreas menores.'); }
      }
      if (amb.indoor && (alta || b.id === 'b24') && b.id !== 'b28g') { s += 6; pro.push('Indicada para ambientes internos e galpões.'); }
      if (nCob > 6 && nCob < 99) { s -= Math.min(22, (nCob - 6) * 2); con.push(`Estimativa de ${nCob} estações só para cobrir a área.`); }
      if (nCob >= 99) { s -= 25; con.push('Sem alcance útil com os parâmetros atuais.'); }
      const capUL = cap.ul * cps * Math.max(1, Math.min(nCob, 20)) * 0.7;
      if (dem.ulF > 0) {
        if (dem.ulF > capUL) { s -= 8; con.push(`Uplink agregado de ${nf(dem.ulF)} Mbps pede mais estações do que a cobertura sozinha (${Math.min(nCob, 20)}): a capacidade passa a definir a quantidade.`); }
        else if (dem.ulF > 20 && b.bwOpts[b.bwOpts.length - 1] >= 20) { s += 8; pro.push('Largura de canal suficiente para o uplink das câmeras e sistemas de IA Física.'); }
      }
      const match = TS.BAND_TERM_MATCH[b.id] || [];
      if (tb.length) {
        if (match.some(k => tb.includes(k))) { s += 12; pro.push('Coincide com as bandas suportadas pelos terminais informados.'); }
        else { s -= 30; con.push('Nenhum terminal informado suporta esta faixa.'); }
      }
      if (b.ecossistema === 'amplo') { s += 6; if (b.id === 'b28') pro.push('Mesma banda das operadoras em 700 MHz: oferta ampla de terminais.'); }
      if (b.ecossistema === 'restrito') { s -= 6; con.push('Ecossistema de terminais mais restrito.'); }
      if (st.terminais.quer5G) {
        if (b.tech.includes('NR')) { s += 8; pro.push('Permite caminho para 5G NR.'); } else { s -= 4; con.push('Sem caminho direto para 5G nesta faixa.'); }
      }
      if (b.status === 'restrita') {
        if (st.projeto.outorga250) { s += 8; pro.push('O cliente já possui outorga SLP nesta subfaixa.'); }
        else { s -= 45; con.push('Faixa destinada à TV 3.0: só para outorgas existentes ou licenciamento excepcional.'); }
      }
      if (b.status === 'secundaria') con.push('Caráter secundário e baixa potência; verificar estações terrenas de satélite no entorno.');
      if (b.id === 'b28g') { if (!(areaKm2 > 0 && areaKm2 < 0.3)) { s -= 20; con.push('Alcance curto e necessidade de visada limitam o uso a aplicações pontuais.'); } }
      return { id: b.id, band: b, s: Math.max(0, Math.min(100, Math.round(s))), pro, con, r, nCob, eqId };
    }).sort((a, b) => b.s - a.s);
  };

  let R = null, CV = null, CVC = null;
  const computar = () => {
    const st = S;
    const amb = TS.ambById(st.area.ambiente);
    const dem = demanda(st);
    const areaM2 = RF.areaM2(st.area.poligono);
    const ranking = rankFaixas(st, dem, areaM2 / 1e6);
    const bandId = st.faixa.auto ? ranking[0].id : st.faixa.sel;
    const band = TS.bandById(bandId);
    let precisaForm = false;
    if (st.faixa.aplicada !== band.id) {
      st.faixa.aplicada = band.id; st.faixa.sel = band.id; st.faixa.equipAplicado = null;
      if (!band.bwOpts.includes(Number(st.faixa.bw))) st.faixa.bw = band.bw;
      precisaForm = true;
    }
    const eqId = escolherEquip(band, st, dem);
    const eq = TS.EQUIP[eqId];
    if (st.faixa.equipAplicado !== eqId) {
      st.faixa.equipAplicado = eqId; st.faixa.equip = eqId;
      Object.assign(st.rf.est, estDefaults(band, eq));
      const ops = bwOpts(band, eq);
      if (!ops.includes(Number(st.faixa.bw))) st.faixa.bw = ops.includes(band.bw) ? band.bw : ops[ops.length - 1];
      precisaForm = true;
    }
    const bw = Number(st.faixa.bw);
    const rfIn = montarRF(st, band, eq, st.rf.est, bw);
    if (st.rf.term.sensAuto) st.rf.term.sens = rfIn.sensT;
    const r = RF.calcular({ band, amb, rf: rfIn });
    r.band = band;
    const tdd = tddEfetivo(st, dem);
    const cap = RF.capacidade(band, bw, eq.tech, tdd);
    const nCob = areaM2 > 0 ? (r.rFolga > 0 ? Math.ceil(areaM2 / (2.598 * r.rFolga ** 2)) : Infinity) : 1;
    const cps = celulasPorSite(st, amb);
    const celCap = Math.max(1, Math.ceil(Math.max(dem.ulF / (cap.ul * 0.7 || 1), dem.dlF / (cap.dl * 0.7 || 1))));
    const celUsr = Math.max(1, Math.ceil(dem.nF / eq.users));
    const nCap = Math.ceil(celCap / cps), nUsr = Math.ceil(celUsr / cps);
    const nRec = Math.max(1, Number.isFinite(nCob) ? nCob : 1, nCap, nUsr);
    const driver = nRec === nCob ? 'cobertura' : nRec === nCap ? 'capacidade' : 'número de usuários';
    const nSites = Math.max(nRec, st.area.estacoes.length);
    const nCel = st.area.estacoes.length >= nRec ? st.area.estacoes.reduce((a, e) => a + (e.antena === 'tri' ? 3 : 1), 0) : Math.round(nRec * cps);
    const rk = ranking.find(x => x.id === band.id);
    R = { st, amb, band, eq, eqId, r, dem, cap, tdd, bw, nCob, nCap, nUsr, nRec, driver, cps, celCap, celUsr, nSites, nCel, ranking, rk, areaM2, perim: RF.perimetro(st.area.poligono) };
    // cobertura
    CV = TS.Cover.calcular(st, r);
    CVC = TS.Cover.canvas(CV);
    R.cv = CV;
    R.pend = pendencias();
    salvar();
    return precisaForm;
  };

  /* ---------- Pendências (o que falta validar) ---------- */
  const pendencias = () => {
    const st = S, p = [];
    TS.CHECKLIST.forEach(g => g.itens.forEach(i => { if (!st.checklist[i.id]?.ok) p.push({ t: `Checklist: ${i.t}`, v: 'checklist' }); }));
    if (st.area.poligono.length < 3) p.push({ t: 'Desenhar ou importar (KML) o polígono da área a cobrir.', v: 'mapa' });
    if (!st.area.estacoes.length) p.push({ t: 'Posicionar ao menos uma estação em um ponto alto.', v: 'mapa' });
    if (!st.dispositivos.length) p.push({ t: 'Informar o inventário de dispositivos.', v: 'dispositivos' });
    if (!st.terminais.bandas.length) p.push({ t: 'Informar as bandas suportadas pelos terminais.', v: 'dispositivos' });
    if (!st.area.core) p.push({ t: 'Marcar a sala técnica (core e servidor) no mapa para dimensionar o backhaul.', v: 'mapa' });
    if (R) {
      if (R.st.area.estacoes.length && R.st.area.estacoes.length < R.nRec) p.push({ t: `O dimensionamento indica ${R.nRec} estações e o mapa tem ${R.st.area.estacoes.length}.`, v: 'mapa' });
      if (CV && CV.stats.sem > 5 && CV.pior) p.push({ t: `${nf(CV.stats.sem)}% da área sem cobertura. Avaliar estação adicional perto de ${CV.pior.lat.toFixed(5)}, ${CV.pior.lng.toFixed(5)}.`, v: 'mapa' });
      if (R.band.id === 'b37') p.push({ t: 'Verificar estações terrenas de satélite no entorno e as distâncias mínimas de separação.', v: 'faixa' });
      if (R.band.limitePtx && R.st.rf.est.ptx > R.band.limitePtx) p.push({ t: `Potência configurada acima da referência regulatória de ${R.band.limitePtx} dBm por transmissor.`, v: 'link' });
      if (R.eq.generico) p.push({ t: 'Confirmar com a Telesys o modelo de estação para a faixa escolhida.', v: 'equip' });
      if (R.band.status === 'restrita') p.push({ t: 'Confirmar situação da outorga em 250 MHz.', v: 'faixa' });
      R.r.avisos.forEach(a => p.push({ t: a, v: 'link' }));
    }
    if (st.projeto.titularidade === 'indefinido') p.push({ t: 'Definir titularidade da autorização (SLP próprio ou espectro de operadora).', v: 'projeto' });
    return p;
  };

  /* ---------- Itens de equipamento (sem preços) ---------- */
  const itensEquip = () => {
    const { band, eq, eqId, r, dem, nRec, driver, st } = R;
    const nEst = R.nSites;
    const itens = [];
    const pq = [];
    if (eqId === 'nova249') {
      pq.push('Opera na Banda 28, a mesma usada pelas operadoras em 700 MHz, o que amplia a oferta de terminais.');
      pq.push('2 × 40 W por porta sustentam o downlink em áreas extensas e externas.');
    } else if (eqId === 'nova442i') {
      pq.push('Cobre o recorte de 2.390 a 2.400 MHz (Banda 40) com antena integrada, sem perdas de cabo e conectores.');
      pq.push('Alcance intermediário adequado a áreas menores e ambientes internos.');
    } else if (eqId === 'nova430i') {
      pq.push('Potência de até 24 dBm por canal, compatível com a operação em baixa potência da faixa de 3,7 GHz.');
      pq.push('Antena integrada de 13 dBi e consumo típico de 20 W simplificam a instalação em galpões, postes e fachadas.');
    } else if (eqId === 'nova436q') {
      pq.push('Antenas externas permitem setorizar a cobertura externa limitada da faixa de 3,7 GHz.');
      pq.push('Potência configurável, ajustada ao limite regulatório da faixa.');
    } else if (eqId === 'aurora243') {
      pq.push('5G NR SA em n77/n78 com canais de até 100 MHz, para a demanda de uplink de câmeras e IA Física.');
      pq.push('Até 1.200 usuários simultâneos, com folga para o crescimento previsto.');
    } else {
      pq.push('Faixa sem modelo de catálogo confirmado neste rascunho: a Telesys indica o equipamento disponível e os parâmetros reais.');
    }
    if (r.limitante === 'UL') pq.push(`O limite da cobertura está no uplink (terminal de ${nf(st.rf.term.ptx, 0)} dBm). O raio útil é definido pelo terminal; a potência da estação garante folga no downlink.`);
    else pq.push('O downlink é o sentido limitante neste cenário: o ganho de antena e a potência da estação definem o raio útil.');
    pq.push(`${nint(dem.nF)} dispositivos previstos (com crescimento) frente a ${nint(eq.users)} usuários por setor.`);
    itens.push({ g: 'Acesso rádio', nome: eq.nome, tipo: eq.tipo, qtd: R.nCel, un: 'unidade(s), 1 por setor', specs: eq.specs, porque: [`${nEst} estação(ões) com ${nf(R.cps, 0)} setor(es) em média; quantidade definida por ${driver}.`, ...pq], fonte: eq.fonte, nota: eq.sensNota });

    if (eq.antena === 'externa') {
      const setores = R.nCel;
      itens.push({
        g: 'Antenas', nome: `Antena setorial ${band.curto} com dupla polarização`, tipo: 'Antena externa', qtd: setores, un: 'antena(s)',
        specs: [['Ganho de referência', `${nf(st.rf.est.gant)} dBi`], ['Abertura horizontal', '65° (setorial)'], ['Polarização', '±45°, para MIMO 2×2'], ['Faixa', band.faixa]],
        porque: ['O ganho da antena entra na parte 1 do link budget (o que sai) e na recepção do uplink.', 'Setores de 65° concentram energia na área de interesse e reduzem interferência fora dela.']
      });
      itens.push({ g: 'Antenas', nome: 'Cabos coaxiais de baixa perda e conectores N', tipo: 'Acessório', qtd: setores * 2, un: 'jumper(s)', specs: [['Perda considerada', `${nf(st.rf.est.cabo)} dB por percurso`]], porque: ['Cada dB perdido em cabos sai diretamente da folga do enlace.'] });
    }

    const nE = Math.max(st.area.estacoes.length, nEst);
    const coreLocal = nE > 2 || st.projeto.dados === 'local' || dem.lat > 0;
    itens.push({
      g: 'Core', nome: coreLocal ? `Core de rede local (${eq.tech === 'NR' ? '5GC' : 'EPC'}) em servidor na sala técnica` : 'Core embarcado na eNodeB (HaloB Baicells)',
      tipo: 'Núcleo de rede', qtd: 1, un: 'núcleo',
      specs: coreLocal ? [['Função', 'autenticação de SIM, mobilidade, sessões e políticas'], ['Instalação', 'servidor na sala técnica'], ['Integração', 'rede local e sistemas da operação']] : [['Função', 'core distribuído na própria estação'], ['Escala', 'indicado para redes pequenas, com poucas estações']],
      porque: coreLocal
        ? [st.projeto.dados === 'local' ? 'Os dados precisam ficar no local: o tráfego não sai da planta.' : 'Várias estações ou aplicações sensíveis a latência pedem um core dedicado.', dem.lat ? `${nint(dem.lat)} dispositivos exigem latência baixa e previsível.` : 'Facilita a integração com a rede local e com os sistemas da operação.']
        : ['Rede pequena: o core embarcado reduz equipamentos e pontos de falha.', 'Pode migrar para core dedicado se a rede crescer.']
    });

    // backhaul
    if (st.area.core && st.area.estacoes.length) {
      const enl = st.area.estacoes.map(e => {
        const d = RF.dist([e.lat, e.lng], [st.area.core.lat, st.area.core.lng]);
        return { e, d, fr: RF.fresnel(d / 1000, 5.8), fs: RF.fspl(d, 5800) };
      });
      const radio = enl.filter(x => x.d > 150);
      const loc = enl.length - radio.length;
      if (loc) itens.push({ g: 'Backhaul', nome: 'Cabo ou fibra local até a sala técnica', tipo: 'Conexão cabeada', qtd: loc, un: 'enlace(s)', specs: enl.filter(x => x.d <= 150).map(x => [x.e.nome, `${dist(x.d)} da sala técnica`]), porque: ['Estação próxima da sala técnica: não precisa de rádio de backhaul.'] });
      if (radio.length) {
        const pmp = radio.length >= 3;
        const bh = pmp ? TS.BACKHAUL.c6x : TS.BACKHAUL.b6x;
        itens.push({
          g: 'Backhaul', nome: bh.nome, tipo: bh.tipo, qtd: pmp ? radio.length + 1 : radio.length * 2, un: 'rádio(s)',
          specs: [...bh.specs, ...radio.map(x => [`Enlace ${x.e.nome}`, `${dist(x.d)} · 1ª zona de Fresnel no meio do enlace: ${nf(x.fr)} m (manter ao menos 60%: ${nf(x.fr * 0.6)} m livres)`])],
          porque: [pmp ? `${radio.length} estações convergem para a sala técnica: o C6x atende ponto a multiponto a partir de um mesmo ponto.` : 'Enlace dedicado ponto a ponto entre a estação e a sala do core.', 'Exige visada entre as pontas e altura suficiente para liberar a zona de Fresnel.'],
          fonte: bh.fonte
        });
      }
    } else {
      itens.push({ g: 'Backhaul', nome: 'Backhaul a definir', tipo: 'Pendente', qtd: '', un: '', specs: [['Pendência', 'marcar a sala técnica no mapa para calcular distância e visada']], porque: ['Sem a posição do core não é possível escolher entre cabo, fibra ou rádio (linha Mimosa).'] });
    }
    itens.push({ g: 'Sincronismo e proteção', nome: 'Antena GPS, supressores de surto, aterramento e fonte/PoE', tipo: 'Infraestrutura', qtd: nE, un: 'kit(s)', specs: [['GPS', 'sincronismo de tempo e frequência entre estações'], ['Proteção', 'surto e aterramento por estação']], porque: [band.duplex === 'TDD' ? 'Em TDD, estações vizinhas precisam transmitir e receber nos mesmos instantes.' : 'Sincronismo GPS previsto nas estações da linha.', 'Instalações em pontos altos ficam expostas a descargas atmosféricas.'] });
    const tbOk = (TS.BAND_TERM_MATCH[band.id] || []).filter(k => st.terminais.bandas.includes(k));
    itens.push({ g: 'Terminais', nome: 'SIM cards / eSIM e terminais compatíveis', tipo: 'Acesso dos dispositivos', qtd: dem.nF, un: 'SIM(s)', specs: [['Banda exigida', band.g3pp], ['Compatibilidade informada', tbOk.length ? tbOk.map(k => TS.TERM_BANDS.find(t => t.k === k).l).join(', ') : 'não informada']], porque: ['A faixa do projeto precisa coincidir com as bandas dos módulos e terminais.', `Inclui o crescimento previsto de ${nint(st.terminais.cresc)}% em ${nint(st.terminais.anos)} anos.`] });
    return itens;
  };

  /* ---------- Por que esta faixa ---------- */
  const porqueFaixa = () => {
    const { rk, band, r } = R;
    const out = [];
    out.push(`${band.perfil} ${band.uso}`);
    rk.pro.slice(0, 4).forEach(t => out.push(t));
    out.push(`Com os parâmetros do rascunho, cada estação cobre até ${dist(r.rFolga)} com folga e até ${dist(r.rLimite)} no limite.`);
    return { pro: out, con: rk.con.concat(band.notas) };
  };

  /* ---------- Renderização ---------- */
  const VIEWS = ['projeto', 'checklist', 'mapa', 'dispositivos', 'faixa', 'link', 'v3d', 'equip', 'solicitacao'];
  const fld = {
    num: (l, p, o = {}) => `<label class="fld${o.cls ? ' ' + o.cls : ''}"><span>${l}</span><div class="inp"><input type="number" inputmode="decimal" data-bind="${p}" data-t="num" step="${o.step ?? 0.1}"${o.min != null ? ` min="${o.min}"` : ''}${o.max != null ? ` max="${o.max}"` : ''} value="${esc(getP(p))}"${o.dis ? ' disabled' : ''}>${o.un ? `<em>${o.un}</em>` : ''}</div>${o.h ? `<small>${o.h}</small>` : ''}</label>`,
    txt: (l, p, o = {}) => `<label class="fld${o.cls ? ' ' + o.cls : ''}"><span>${l}</span><div class="inp"><input type="${o.type || 'text'}" data-bind="${p}" data-t="str" value="${esc(getP(p))}" placeholder="${esc(o.ph || '')}"></div></label>`,
    sel: (l, p, ops, o = {}) => `<label class="fld${o.cls ? ' ' + o.cls : ''}"><span>${l}</span><div class="inp"><select data-bind="${p}" data-t="${o.t || 'str'}">${ops.map(([v, t]) => `<option value="${esc(v)}"${String(getP(p)) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>${o.h ? `<small>${o.h}</small>` : ''}</label>`,
    chk: (l, p, o = {}) => `<label class="chk"><input type="checkbox" data-bind="${p}" data-t="bool"${getP(p) ? ' checked' : ''}><span>${l}</span></label>`,
    area: (l, p, o = {}) => `<label class="fld wide"><span>${l}</span><textarea data-bind="${p}" data-t="str" rows="${o.rows || 3}" placeholder="${esc(o.ph || '')}">${esc(getP(p))}</textarea></label>`
  };

  const head = (t, d, extra = '') => `<div class="vh"><div><h2>${t}</h2>${d ? `<p>${d}</p>` : ''}</div>${extra}</div>`;

  const render = {};

  render.projeto = () => {
    const st = S;
    const passos = [
      ['checklist', '2', 'Checklist da visita técnica', `${contChecklist()}/${TS.CHECK_IDS.length} itens`],
      ['mapa', '3', 'Área, pontos altos e obstáculos', st.area.poligono.length >= 3 ? `${nf(R.areaM2 / 1e6, 2)} km²` : 'pendente'],
      ['dispositivos', '4', 'Dispositivos e bandas dos terminais', st.dispositivos.length ? `${nint(R.dem.n)} dispositivos` : 'pendente'],
      ['faixa', '5', 'Escolha da faixa', R.band.curto],
      ['link', '6', 'Link budget DL e UL', `${dist(R.r.rFolga)} com folga`],
      ['v3d', '7', 'Vista 3D para apresentar', CV ? `${nf(CV.stats.folga, 0)}% com folga` : 'sem estações'],
      ['equip', '8', 'Equipamentos e justificativas', `${R.nRec} estação(ões)`],
      ['solicitacao', '9', 'Solicitação de orçamento', 'Rascunho']
    ];
    $('#v-projeto').innerHTML = head('Projeto', 'Dados do integrador e do cliente final. Tudo fica salvo neste navegador e pode ser exportado em arquivo.') + `
      ${st.meta.exemplo ? `<div class="banner">Projeto de exemplo carregado para mostrar a ferramenta. Use <b>Novo</b> no topo para começar do zero.</div>` : ''}
      <div class="grid2">
        <div class="card"><h3>Projeto e cliente final</h3><div class="fgrid">
          ${fld.txt('Nome do projeto', 'projeto.nome', { cls: 'wide', ph: 'Ex.: Rede LTE privativa da planta X' })}
          ${fld.txt('Cliente final', 'projeto.cliente')}
          ${fld.sel('Setor', 'projeto.setor', TS.SETORES.map(x => [x.id, x.l]))}
          ${fld.txt('Município / UF', 'projeto.local')}
          ${fld.txt('Prazo desejado', 'projeto.prazo', { ph: 'Ex.: 1º semestre de 2027' })}
          ${fld.sel('Titularidade da autorização', 'projeto.titularidade', [['indefinido', 'A definir'], ['slp', 'SLP próprio do cliente'], ['operadora', 'Espectro de operadora']])}
          ${fld.sel('Onde os dados precisam ficar', 'projeto.dados', [['indefinido', 'A definir'], ['local', 'No local (on-premises)'], ['nuvem', 'Pode usar nuvem']])}
          ${fld.chk('O cliente já possui outorga SLP em 250 MHz', 'projeto.outorga250')}
        </div></div>
        <div class="card"><h3>Integrador</h3><div class="fgrid">
          ${fld.txt('Empresa', 'integrador.empresa', { cls: 'wide' })}
          ${fld.txt('Responsável', 'integrador.contato')}
          ${fld.txt('E-mail', 'integrador.email', { type: 'email' })}
          ${fld.txt('Telefone / WhatsApp', 'integrador.fone')}
        </div>
        <div class="note">Esta ferramenta gera um <b>rascunho</b> para pedir orçamento à Telesys. Não substitui o dimensionamento final, não contém preços e não estabelece compromisso técnico ou comercial.</div>
        </div>
      </div>
      <div class="card">${fld.area('Observações gerais', 'projeto.obs', { ph: 'Contexto da operação, restrições, janelas de instalação, contatos no local...' })}</div>
      <div class="card"><h3>Roteiro</h3><div class="steps">${passos.map(([v, n, t, s]) => `<button type="button" class="step" data-go="${v}"><b>${n}</b><span>${t}</span><em>${esc(s)}</em></button>`).join('')}</div></div>`;
  };

  const contChecklist = () => TS.CHECK_IDS.filter(id => S.checklist[id]?.ok).length;

  render.checklist = () => {
    const st = S;
    const ir = { area: 'mapa', obst: 'mapa', altos: 'mapa', inv: 'dispositivos', mob: 'dispositivos', bandas: 'dispositivos', cresc: 'dispositivos', infra: 'mapa', viz: 'faixa', tit: 'projeto' };
    $('#v-checklist').innerHTML = head('Checklist da primeira visita técnica', 'O que levantar em campo antes de orçar. A parte 2 do link budget (o que se perde) depende destes dados.',
      `<div class="pill-prog"><b data-out="ckCount">${contChecklist()}/${TS.CHECK_IDS.length}</b><div class="bar"><i style="width:${contChecklist() / TS.CHECK_IDS.length * 100}%"></i></div></div>`) +
      TS.CHECKLIST.map(g => `<div class="card"><h3>${g.g}</h3><div class="ck-list">${g.itens.map(i => {
        if (!st.checklist[i.id]) st.checklist[i.id] = { ok: false, nota: '' };
        return `<div class="ck-item${st.checklist[i.id].ok ? ' done' : ''}">
          <label class="ck-box"><input type="checkbox" data-bind="checklist.${i.id}.ok" data-t="bool" data-full="1"${st.checklist[i.id].ok ? ' checked' : ''}><i></i></label>
          <div class="ck-body"><div class="ck-t">${i.t} <button type="button" class="lnk" data-go="${ir[i.id]}">abrir seção</button></div><div class="ck-d">${i.d}</div>
          <textarea rows="2" data-bind="checklist.${i.id}.nota" data-t="str" placeholder="Anotações de campo">${esc(st.checklist[i.id].nota)}</textarea></div></div>`;
      }).join('')}</div></div>`).join('');
  };

  render.mapaSide = () => {
    const st = S;
    $('#mapSide').innerHTML = `
      <div class="ms-sec"><div class="srch"><input id="mapBusca" placeholder="Buscar local ou lat, lng"><button type="button" class="btn sm" id="btnBusca">Ir</button></div></div>
      <div class="ms-sec"><div class="ms-t">Ferramentas</div>
        <div class="tools">
          <button type="button" data-modo="nav" class="${TS.Map.modo === 'nav' ? 'active' : ''}">✋ Navegar</button>
          <button type="button" data-modo="area" class="${TS.Map.modo === 'area' ? 'active' : ''}">⬠ Área</button>
          <button type="button" data-modo="estacao" class="${TS.Map.modo === 'estacao' ? 'active' : ''}">📡 Estação</button>
          <button type="button" data-modo="zona" class="${TS.Map.modo === 'zona' ? 'active' : ''}">🌳 Obstáculo</button>
          <button type="button" data-modo="core" class="${TS.Map.modo === 'core' ? 'active' : ''}">🗄️ Core</button>
        </div>
        <label class="fld"><span>Tipo de obstáculo a marcar</span><div class="inp"><select id="zonaTipo">${TS.ZONAS.map(z => `<option value="${z.id}">${z.l}</option>`).join('')}</select></div></label>
        <div class="row-btns">
          <button type="button" class="btn sm" data-act="concluirArea">Concluir área</button>
          <button type="button" class="btn sm" data-act="sugerir">Sugerir estações</button>
          <button type="button" class="btn sm" data-act="enquadrar">Enquadrar</button>
        </div>
        <div class="row-btns">
          <label class="btn sm file">Importar KML<input type="file" accept=".kml,application/vnd.google-earth.kml+xml" id="kmlIn" hidden></label>
          <button type="button" class="btn sm" data-act="kml">Exportar KML</button>
          <button type="button" class="btn sm ghost" data-act="limparArea">Limpar área</button>
        </div>
      </div>
      <div class="ms-sec">
        ${fld.sel('Ambiente predominante', 'area.ambiente', TS.AMBIENTES.map(a => [a.id, a.l]), { h: 'Define o modelo de propagação e as alturas de referência.' })}
        <div class="row-chk"><label class="chk"><input type="checkbox" id="chkCob" checked><span>Mapa de predição</span></label><label class="chk"><input type="checkbox" id="chkAneis" checked><span>Anéis de alcance</span></label></div>
      </div>
      <div class="ms-sec" data-out="mapaStats"></div>
      <div class="ms-sec"><div class="ms-t">Estações <small>${st.area.estacoes.length}</small></div><div id="listaEst">${listaEst()}</div></div>
      <div class="ms-sec"><div class="ms-t">Zonas de obstáculo <small>${st.area.zonas.length}</small></div><div>${listaZonas()}</div></div>
      <div class="ms-sec"><div class="ms-t">Sala técnica (core)</div>${st.area.core ? `<div class="mini">${st.area.core.lat.toFixed(5)}, ${st.area.core.lng.toFixed(5)} <button type="button" class="lnk" data-act="semCore">remover</button></div>` : '<div class="mini mut">Não marcada. Use a ferramenta Core.</div>'}</div>`;
  };
  const listaEst = () => S.area.estacoes.map((e, i) => `<div class="li${TS.Map.sel === i ? ' sel' : ''}">
      <div class="li-h"><input class="nm" data-bind="area.estacoes.${i}.nome" data-t="str" value="${esc(e.nome)}"><button type="button" class="x" data-del-est="${i}" title="Remover">✕</button></div>
      <div class="li-g">
        ${fld.num('Altura', `area.estacoes.${i}.h`, { un: 'm', step: 1, min: 2 })}
        ${fld.sel('Antena', `area.estacoes.${i}.antena`, [['tri', 'Trissetorial'], ['setorial', 'Setorial'], ['omni', 'Omni']])}
        ${e.antena !== 'omni' ? fld.num('Azimute', `area.estacoes.${i}.az`, { un: '°', step: 5, min: 0, max: 359 }) : ''}
      </div><div class="mini mut">${e.lat.toFixed(5)}, ${e.lng.toFixed(5)}</div></div>`).join('') || '<div class="mini mut">Nenhuma estação. Use a ferramenta Estação ou "Sugerir estações".</div>';
  const listaZonas = () => S.area.zonas.map((z, i) => {
    const t = TS.ZONAS.find(x => x.id === z.tipo) || TS.ZONAS[0];
    const par = z.tipo === 'vegetacao' ? fld.num('Profundidade', `area.zonas.${i}.prof`, { un: 'm', step: 5 }) : z.tipo === 'predio' ? fld.num('Paredes', `area.zonas.${i}.paredes`, { step: 1, min: 1 }) : fld.num('Perda', `area.zonas.${i}.db`, { un: 'dB', step: 1 });
    return `<div class="li"><div class="li-h"><span class="dot" style="background:${t.cor}"></span><b>${t.l}</b><button type="button" class="x" data-del-zona="${i}">✕</button></div>
      <div class="li-g">${fld.num('Raio', `area.zonas.${i}.raio`, { un: 'm', step: 10, min: 10 })}${par}</div></div>`;
  }).join('') || '<div class="mini mut">Marque vegetação alta, estruturas metálicas, edificações ou sombras de relevo.</div>';

  const out = {};
  out.mapaStats = () => {
    const a = R.areaM2;
    return `<div class="ms-t">Resultado da predição</div>
      <div class="kv"><span>Área</span><b>${a ? nf(a / 1e6, 2) + ' km²' : 'sem polígono'}</b></div>
      <div class="kv"><span>Perímetro</span><b>${a ? dist(R.perim) : 'n/d'}</b></div>
      <div class="kv"><span>Faixa</span><b>${R.band.curto} · ${R.bw} MHz</b></div>
      <div class="kv"><span>Raio com folga / limite</span><b>${dist(R.r.rFolga)} / ${dist(R.r.rLimite)}</b></div>
      <div class="kv"><span>Estações indicadas</span><b>${R.nRec} <small>(${R.driver})</small></b></div>
      ${CV ? `<div class="cov3">
        <div class="c3 ok"><b>${nf(CV.stats.folga, 0)}%</b><span>com folga</span></div>
        <div class="c3 lim"><b>${nf(CV.stats.limite, 0)}%</b><span>no limite</span></div>
        <div class="c3 sem"><b>${nf(CV.stats.sem, 0)}%</b><span>sem cobertura</span></div></div>
        ${!CV.temPoli ? '<div class="mini mut">Sem polígono: percentuais calculados sobre a janela do mapa.</div>' : ''}` : '<div class="mini mut">Posicione estações para gerar o mapa de predição.</div>'}`;
  };
  out.legenda = () => `<div class="lg"><i class="ok"></i>Com folga</div><div class="lg"><i class="lim"></i>No limite</div><div class="lg"><i class="sem"></i>Sem cobertura</div><div class="lg-n">Predição preliminar · não considera relevo · RASCUNHO</div>`;

  render.dispositivos = () => {
    const st = S;
    $('#v-dispositivos').innerHTML = head('Dispositivos', 'Inventário do que vai se conectar. Câmeras e sistemas de IA Física enviam mais do que recebem e pesam no uplink.') + `
      <div class="card"><h3>Inventário</h3>
        <div class="chips">${TS.DISPOSITIVOS.map(d => `<button type="button" class="chipb" data-add-dev="${d.id}">${d.ic} ${d.l}</button>`).join('')}</div>
        <div class="tbl-wrap"><table class="tbl dev">
          <thead><tr><th>Tipo</th><th class="n">Qtd.</th><th class="n">Atividade</th><th class="n">UL Mbps/un.</th><th class="n">DL Mbps/un.</th><th>Móvel</th><th>Latência crítica</th><th></th></tr></thead>
          <tbody>${st.dispositivos.map((d, i) => `<tr>
            <td><select data-bind="dispositivos.${i}.tipo" data-t="str" data-full="1">${TS.DISPOSITIVOS.map(t => `<option value="${t.id}"${t.id === d.tipo ? ' selected' : ''}>${t.ic} ${t.l}</option>`).join('')}</select></td>
            <td class="n"><input type="number" min="0" step="1" data-bind="dispositivos.${i}.qtd" data-t="num" value="${d.qtd}"></td>
            <td class="n"><div class="inp sm"><input type="number" min="0" max="100" step="5" data-bind="dispositivos.${i}.ativ" data-t="num" value="${d.ativ}"><em>%</em></div></td>
            <td class="n"><input type="number" min="0" step="0.01" data-bind="dispositivos.${i}.ul" data-t="num" value="${d.ul}"></td>
            <td class="n"><input type="number" min="0" step="0.01" data-bind="dispositivos.${i}.dl" data-t="num" value="${d.dl}"></td>
            <td><input type="checkbox" data-bind="dispositivos.${i}.mov" data-t="bool"${d.mov ? ' checked' : ''}></td>
            <td><input type="checkbox" data-bind="dispositivos.${i}.lat" data-t="bool"${d.lat ? ' checked' : ''}></td>
            <td><button type="button" class="x" data-del-dev="${i}" title="Remover">✕</button></td></tr>`).join('') || `<tr><td colspan="8" class="empty">Adicione dispositivos pelos botões acima.</td></tr>`}</tbody>
        </table></div>
        <div data-out="demanda"></div>
      </div>
      <div class="grid2">
        <div class="card"><h3>Bandas suportadas pelos terminais</h3><p class="mut sm">A faixa do projeto precisa coincidir com elas. Marque o que os módulos e terminais existentes ou previstos suportam.</p>
          <div class="chk-grid">${TS.TERM_BANDS.map(t => `<label class="chk"><input type="checkbox" data-band-term="${t.k}"${st.terminais.bandas.includes(t.k) ? ' checked' : ''}><span>${t.l}</span></label>`).join('')}</div></div>
        <div class="card"><h3>Crescimento e terminal de referência</h3><div class="fgrid">
          ${fld.num('Crescimento de dispositivos', 'terminais.cresc', { un: '%', step: 5, min: 0 })}
          ${fld.num('Horizonte', 'terminais.anos', { un: 'anos', step: 1, min: 1 })}
          ${fld.chk('Há intenção de migrar para 5G', 'terminais.quer5G')}
          ${fld.sel('Terminal de referência (pior caso no uplink)', 'terminais.ref', TS.TERMINAIS.map(t => [t.id, `${t.l} · ${t.ptx} dBm, ${t.g} dBi`]), { cls: 'wide', h: 'O link budget usa este terminal. Um terminal LTE comum transmite com até 23 dBm, cerca de 200 mW.' })}
        </div></div>
      </div>`;
  };
  out.demanda = () => {
    const d = R.dem;
    if (!d.n) return '';
    const ratio = d.dl > 0 ? d.ul / d.dl : 0;
    return `<div class="stats4">
      <div class="st"><span>Dispositivos hoje</span><b>${nint(d.n)}</b><small>${nint(d.nF)} com crescimento</small></div>
      <div class="st"><span>Uplink agregado</span><b>${nf(d.ul)} <em>Mbps</em></b><small>${nf(d.ulF)} Mbps com crescimento</small></div>
      <div class="st"><span>Downlink agregado</span><b>${nf(d.dl)} <em>Mbps</em></b><small>${nf(d.dlF)} Mbps com crescimento</small></div>
      <div class="st"><span>Relação UL/DL</span><b>${nf(ratio, 2)}</b><small>${ratio > 0.8 ? 'tráfego pesa no uplink' : ratio > 0.35 ? 'tráfego equilibrado' : 'tráfego pesa no downlink'}</small></div>
    </div>
    ${d.up ? `<div class="note">${nint(d.up)} câmera(s) no inventário: o uplink tende a definir a capacidade. Em faixas TDD, a configuração de quadro sugerida é <b>${TS.TDD[R.tdd].l}</b>.</div>` : ''}
    ${d.mov || d.lat ? `<div class="note">${nint(d.mov)} dispositivo(s) móveis e ${nint(d.lat)} com latência crítica: considerar sobreposição entre células e core próximo da operação.</div>` : ''}`;
  };

  render.faixa = () => {
    const st = S;
    const rows = R.ranking.map(x => ({ l: x.band.curto, folga: x.r.rFolga / 1000, limite: x.r.rLimite / 1000, sel: x.id === R.band.id }));
    const pq = porqueFaixa();
    $('#v-faixa').innerHTML = head('Faixa', 'Faixas disponíveis para redes privadas no Brasil. Faixas mais baixas cobrem distâncias maiores e atravessam melhor obstáculos; faixas mais altas oferecem mais capacidade em áreas menores.',
      `<label class="chk"><input type="checkbox" data-bind="faixa.auto" data-t="bool" data-full="1"${st.faixa.auto ? ' checked' : ''}><span>Usar a recomendação automática</span></label>`) + `
      <div class="card hl"><div class="sel-head"><div><small>Faixa selecionada${st.faixa.auto ? ' (recomendação)' : ' (manual)'}</small><h3>${R.band.nome}</h3><div class="mut">${R.band.faixa} · ${R.band.g3pp} · ${R.band.duplex}</div></div>
        <div class="score big"><b>${R.rk.s}</b><small>aderência</small></div></div>
        <div class="grid2 tight"><div><div class="ms-t">Por que esta faixa</div><ul class="why">${pq.pro.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
        <div><div class="ms-t">Pontos de atenção</div><ul class="why warn">${pq.con.map(t => `<li>${esc(t)}</li>`).join('') || '<li>Nenhum ponto crítico com os dados atuais.</li>'}</ul></div></div>
      </div>
      <div class="card"><h3>Alcance por faixa nas mesmas condições <small>raio com folga / no limite, equipamento de referência de cada faixa</small></h3><div class="chart-host" id="chFaixas"></div>
        <p class="mut sm">${frequenciaNota()}</p></div>
      <div class="bands">${R.ranking.map(x => `<div class="band${x.id === R.band.id ? ' on' : ''}">
        <div class="band-h"><div><b>${x.band.nome}</b><small>${x.band.faixa}</small></div><div class="score"><b>${x.s}</b></div></div>
        <div class="bar"><i style="width:${x.s}%"></i></div>
        <div class="band-p">${x.band.perfil}</div><div class="band-u">${x.band.uso}</div>
        <div class="tags">${x.band.status === 'restrita' ? '<span class="tag red">restrita</span>' : ''}${x.band.status === 'secundaria' ? '<span class="tag amb">secundária</span>' : ''}<span class="tag">${x.band.duplex}</span><span class="tag">${x.band.tech}</span><span class="tag">≈ ${x.nCob >= 99 ? 'sem alcance' : x.nCob + ' estação(ões)'}</span></div>
        <ul class="pc">${x.pro.slice(0, 3).map(t => `<li class="p">${esc(t)}</li>`).join('')}${x.con.slice(0, 3).map(t => `<li class="c">${esc(t)}</li>`).join('')}</ul>
        <button type="button" class="btn sm${x.id === R.band.id ? ' pri' : ''}" data-sel-faixa="${x.id}">${x.id === R.band.id ? 'Selecionada' : 'Selecionar'}</button>
      </div>`).join('')}</div>
      <p class="mut sm">Fonte das faixas: Mapa de Redes Celulares Privativas no Brasil, Mobile Time, agosto de 2026, e artigo Telesys sobre a primeira visita técnica.</p>`;
    TS.Charts.faixas($('#chFaixas'), rows);
  };
  const frequenciaNota = () => {
    const f = R.band.fDL, d = 20 * Math.log10(f / 700);
    if (R.band.id === 'b28') return 'Só pela frequência, em espaço livre, um sinal em 3,75 GHz perde cerca de 14,6 dB a mais que em 700 MHz na mesma distância. Cada 6 dB a mais de perda corresponde a reduzir o alcance à metade.';
    return `Só pela frequência, em espaço livre, ${R.band.curto} ${d > 0 ? 'perde' : 'ganha'} cerca de ${nf(Math.abs(d))} dB ${d > 0 ? 'a mais' : 'a menos'} que 700 MHz na mesma distância. Cada 6 dB a mais de perda corresponde a reduzir o alcance à metade.`;
  };

  render.link = () => {
    const st = S, band = R.band, eq = R.eq;
    const eqOps = TS.EQUIP_POR_FAIXA[band.id].map(id => [id, TS.EQUIP[id].nome]);
    $('#v-link').innerHTML = head('Link budget', 'A conta que diz se o sinal chega a cada ponto da área com folga suficiente, nos dois sentidos.') + `
      <div data-out="partes"></div>
      <div class="lb">
        <div class="lb-form">
          <div class="card"><h3>Canal e estação</h3><div class="fgrid">
            <label class="fld wide"><span>Equipamento</span><div class="inp"><select id="selEquip">${eqOps.map(([v, l]) => `<option value="${v}"${v === R.eqId ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div><small>${eq.fonte}${eq.generico ? ' · confirmar com a Telesys' : ''}</small></label>
            ${fld.sel('Largura do canal', 'faixa.bw', bwOpts(band, eq).map(b => [b, `${nf(b, b % 1 ? 1 : 0)} MHz${b === 40 && eq.tech === 'LTE' ? ' (agregação)' : ''}`]), { t: 'num' })}
            ${band.duplex !== 'FDD' ? fld.sel('Quadro TDD', 'faixa.tdd', [['auto', `Automático (${TS.TDD[R.tdd].l})`], ...Object.entries(TS.TDD).map(([k, v]) => [k, v.l])]) : `<div class="fld"><span>Duplexação</span><div class="ro">FDD, UL e DL em blocos separados</div></div>`}
            ${fld.num('Potência por porta', 'rf.est.ptx', { un: 'dBm', step: 1, h: band.limitePtx ? `Referência regulatória: ${band.limitePtx} dBm por transmissor` : 'Do datasheet' })}
            ${fld.num('Ganho da antena', 'rf.est.gant', { un: 'dBi', step: 0.5 })}
            ${fld.num('Cabos e conectores', 'rf.est.cabo', { un: 'dB', step: 0.5 })}
            ${fld.num('Sensibilidade do receptor', 'rf.est.sens', { un: 'dBm', step: 0.5, h: 'Uplink, do datasheet da estação' })}
            ${fld.num('Altura de referência', 'rf.hBS', { un: 'm', step: 1, h: 'Para os gráficos; no mapa vale a altura de cada estação' })}
          </div></div>
          <div class="card"><h3>Terminal</h3><div class="fgrid">
            ${fld.num('Potência do terminal', 'rf.term.ptx', { un: 'dBm', step: 1 })}
            ${fld.num('Ganho da antena', 'rf.term.g', { un: 'dBi', step: 0.5 })}
            ${fld.num('Altura do terminal', 'rf.hUT', { un: 'm', step: 0.5 })}
            ${fld.num('Figura de ruído', 'rf.term.nf', { un: 'dB', step: 0.5 })}
            ${fld.num('SINR exigida na borda', 'rf.term.sinr', { un: 'dB', step: 0.5 })}
            ${fld.num('Sensibilidade (downlink)', 'rf.term.sens', { un: 'dBm', step: 0.5, dis: st.rf.term.sensAuto, h: st.rf.term.sensAuto ? '-174 + 10·log(B) + NF + SINR' : 'valor manual' })}
            ${fld.chk('Calcular a sensibilidade do terminal', 'rf.term.sensAuto')}
          </div></div>
          <div class="card"><h3>Propagação e folga</h3><div class="fgrid">
            ${fld.sel('Modelo', 'rf.modelo', Object.entries(TS.MODELOS))}
            ${fld.sel('Condição de visada', 'rf.visada', [['auto', 'Automática pelo ambiente'], ['prob', 'Probabilística (3GPP)'], ['los', 'Com visada (LOS)'], ['nlos', 'Sem visada (NLOS)']])}
            ${fld.sel('Confiabilidade na borda', 'rf.conf', [[50, '50%'], [75, '75%'], [90, '90%'], [95, '95%'], [98, '98%']], { t: 'num' })}
            ${fld.num('Desvio de sombreamento', 'rf.sigma', { un: 'dB', step: 0.5, h: `vazio = ${nf(R.amb.sigma)} dB do ambiente` })}
            ${fld.num('Margem de interferência', 'rf.interf', { un: 'dB', step: 0.5 })}
            ${fld.num('Ganho de diversidade UL', 'rf.divUL', { un: 'dB', step: 0.5 })}
          </div></div>
          <div class="card"><h3>Obstáculos entre a estação e o terminal típico</h3><div class="fgrid">
            ${TS.OBSTACULOS.map(o => fld.num(o.l, `rf.obst.${o.id}`, { un: o.un === 'paredes' ? 'paredes' : o.un === 'camadas' ? 'camadas' : o.veg ? 'm' : 'dB', step: o.veg ? 5 : 1, min: 0 })).join('')}
          </div><small class="mut">Paredes e vidros: 3GPP TR 38.901 (perda cresce com a frequência). Vegetação: modelo de Weissberger. Zonas desenhadas no mapa somam perdas locais.</small></div>
        </div>
        <div class="lb-out" data-out="lbOut"></div>
      </div>`;
  };
  out.partes = () => {
    const r = R.r;
    const card = (n, t, d, dl, ul) => `<div class="part"><div class="part-n">${n}</div><div><b>${t}</b><small>${d}</small><div class="part-v"><span>DL <b>${dl}</b></span><span>UL <b>${ul}</b></span></div></div></div>`;
    const pDL = r.plDL(R.st.rf.dist || r.rFolga || 1000) + r.DL.obst, pUL = r.plUL(R.st.rf.dist || r.rFolga || 1000) + r.UL.obst;
    return `<div class="parts">
      ${card(1, 'O que sai', 'Potência somada ao ganho da antena', `${nf(r.DL.sai)} dBm`, `${nf(r.UL.sai)} dBm`)}
      ${card(2, 'O que se perde', `Distância, frequência, obstáculos e cabos (em ${dist(R.st.rf.dist || r.rFolga || 1000)})`, `${nf(pDL)} dB`, `${nf(pUL + r.UL.cabos)} dB`)}
      ${card(3, 'O que precisa chegar', 'Sensibilidade do receptor', `${nf(r.DL.sens)} dBm`, `${nf(r.UL.sens)} dBm`)}
      ${card(4, 'A folga', `Margem exigida: ${nf(r.folgaReq)} dB (sombreamento ${nf(r.fade)} + interferência)`, `${dist(r.DL.rFolga)}`, `${dist(r.UL.rFolga)}`)}
    </div>`;
  };
  out.lbOut = () => {
    const r = R.r, st = S;
    const dRef = st.rf.dist || Math.round(r.rFolga) || 1000;
    const maxD = Math.max(r.rLimite * 1.4, dRef * 1.2, 200);
    const passo = maxD / 120;
    const sDL = { nome: 'Downlink', cor: '#4cc9e0', fn: d => RF.margem(r, 'DL', d), rFolga: r.DL.rFolga };
    const sUL = { nome: 'Uplink', cor: '#f4efe6', fn: d => RF.margem(r, 'UL', d), rFolga: r.UL.rFolga };
    [sDL, sUL].forEach(sr => { sr.pts = []; for (let d = passo; d <= maxD; d += passo) sr.pts.push([d / 1000, sr.fn(d)]); });
    setTimeout(() => {
      const pl = r.plDL(dRef), pu = r.plUL(dRef);
      TS.Charts.waterfall($('#wfDL'), {
        sens: r.DL.sens, req: r.folgaReq, rows: [
          { l: 'Potência da estação', sub: 'por porta', v: r.DL.ptx, tipo: 'base', parte: '1' },
          { l: 'Ganho da antena', v: r.DL.gtx, tipo: 'mais' },
          { l: 'Cabos e conectores', v: r.DL.cabos, tipo: 'menos' },
          { l: 'Perda de percurso', sub: `${dist(dRef)} · ${nf(R.band.fDL, 0)} MHz`, v: pl, tipo: 'menos', parte: '2' },
          { l: 'Obstáculos', v: r.DL.obst, tipo: 'menos' },
          { l: 'Ganho do terminal', sub: 'antena e diversidade', v: r.DL.grx, tipo: r.DL.grx >= 0 ? 'mais' : 'menos' },
          { l: 'Sinal recebido', sub: 'no terminal', tipo: 'total', parte: '3·4' }
        ].map(x => x.tipo === 'mais' || x.tipo === 'menos' ? Object.assign(x, { v: Math.abs(x.v) }) : x)
      });
      TS.Charts.waterfall($('#wfUL'), {
        sens: r.UL.sens, req: r.folgaReq, rows: [
          { l: 'Potência do terminal', v: r.UL.ptx, tipo: 'base', parte: '1' },
          { l: 'Ganho do terminal', v: Math.abs(r.UL.gtx), tipo: r.UL.gtx >= 0 ? 'mais' : 'menos' },
          { l: 'Perda de percurso', sub: `${dist(dRef)} · ${nf(R.band.fUL, 0)} MHz`, v: pu, tipo: 'menos', parte: '2' },
          { l: 'Obstáculos', v: r.UL.obst, tipo: 'menos' },
          { l: 'Ganho da antena', sub: 'estação', v: st.rf.est.gant, tipo: 'mais' },
          { l: 'Cabos e conectores', v: st.rf.est.cabo, tipo: 'menos' },
          ...(st.rf.divUL ? [{ l: 'Diversidade', v: st.rf.divUL, tipo: 'mais' }] : []),
          { l: 'Sinal recebido', sub: 'na estação', tipo: 'total', parte: '3·4' }
        ]
      });
      TS.Charts.margem($('#chMargem'), { series: [sDL, sUL], req: r.folgaReq, xmax: maxD / 1000, marcador: dRef / 1000 });
      TS.Charts.capacidade($('#chCap'), { ulDem: R.dem.ulF, dlDem: R.dem.dlF, ulCap: R.cap.ul, dlCap: R.cap.dl, n: R.nCel });
    }, 0);
    const lim = r.limitante;
    return `<div class="card"><div class="res-h">
        <div class="res-big"><small>Raio com folga</small><b>${dist(r.rFolga)}</b><span>limitado pelo <b class="${lim === 'UL' ? 'ul' : 'dl'}">${lim === 'UL' ? 'uplink' : 'downlink'}</b></span></div>
        <div class="res-big"><small>Raio no limite</small><b>${dist(r.rLimite)}</b><span>margem zero</span></div>
        <div class="res-big"><small>Desbalanço DL − UL</small><b>${sgn(r.desbalanco)} dB</b><span>${r.desbalanco > 3 ? 'o terminal limita a cobertura' : r.desbalanco < -3 ? 'a estação limita a cobertura' : 'enlace equilibrado'}</span></div>
        <div class="res-big"><small>Modelo</small><b class="sm">${esc(TS.MODELOS[r.modelo])}</b><span>${nf(R.band.fDL, 0)} MHz · hBS ${nf(st.rf.hBS, 0)} m · hUT ${nf(st.rf.hUT, 1)} m</span></div>
      </div>
      ${r.avisos.map(a => `<div class="note warn">${esc(a)}</div>`).join('')}
      ${lim === 'UL' ? `<div class="note">O sensor ou a câmera recebe bem o sinal da estação, mas não consegue responder com a mesma folga: o terminal transmite com ${nf(st.rf.term.ptx, 0)} dBm, enquanto a estação usa ${nf(st.rf.est.ptx, 0)} dBm e antenas maiores.</div>` : ''}
      </div>
      <div class="card"><h3>Margem por distância <small>passe o mouse para ler os valores</small></h3><div class="chart-host" id="chMargem"></div>
        <div class="legend-inline"><span><i style="background:var(--dl)"></i>Downlink</span><span><i style="background:var(--ul)"></i>Uplink</span><span><i class="dash"></i>ponto analisado</span></div>
        <label class="fld slider"><span>Ponto analisado na cascata: <b>${dist(dRef)}</b></span><input type="range" id="rngDist" min="20" max="${Math.round(maxD)}" step="10" value="${Math.round(dRef)}"></label>
      </div>
      <div class="grid2 tight">
        <div class="card"><h3>Downlink <small>estação → terminal</small></h3><div class="chart-host" id="wfDL"></div></div>
        <div class="card"><h3>Uplink <small>terminal → estação</small></h3><div class="chart-host" id="wfUL"></div></div>
      </div>
      <div class="card"><h3>Capacidade e número de estações <small>estimativa grosseira para o rascunho</small></h3><div class="chart-host" id="chCap"></div>
        <div class="stats4">
          <div class="st"><span>Por cobertura</span><b>${Number.isFinite(R.nCob) ? R.nCob : 'n/d'}</b><small>${R.areaM2 ? `${nf(R.areaM2 / 1e6, 2)} km² ÷ célula hexagonal de ${dist(r.rFolga)}` : 'sem polígono'}</small></div>
          <div class="st"><span>Por capacidade</span><b>${R.nCap}</b><small>${R.celCap} setor(es) de ${nf(R.cap.ul)} Mbps UL e ${nf(R.cap.dl)} Mbps DL, 70% de ocupação</small></div>
          <div class="st"><span>Por usuários</span><b>${R.nUsr}</b><small>${nint(R.dem.nF)} dispositivos ÷ ${nint(R.eq.users)} por setor</small></div>
          <div class="st hl"><span>Estações indicadas</span><b>${R.nRec}</b><small>${nf(R.cps, 0)} setor(es) por estação · definido por ${R.driver}</small></div>
        </div>
        <p class="mut sm">Eficiência espectral média de referência: ${nf(R.cap.seDL)} bit/s/Hz (DL) e ${nf(R.cap.seUL)} bit/s/Hz (UL)${R.band.duplex !== 'FDD' ? `, quadro TDD ${TS.TDD[R.tdd].l}` : ''}. Valores para conversa inicial; a Telesys confirma no dimensionamento.</p>
      </div>`;
  };

  render.equip = () => {
    const its = itensEquip();
    $('#v-equip').innerHTML = head('Equipamentos', 'Especificações de referência e o motivo de cada escolha. Sem preços: a Telesys responde com o orçamento.') +
      `<div class="card hl"><div class="sel-head"><div><small>Resumo</small><h3>${R.nSites} estação(ões) · ${R.nCel} setor(es) ${R.eq.nome}</h3><div class="mut">${R.band.nome} · ${R.bw} MHz · raio com folga ${dist(R.r.rFolga)} · ${R.driver} define a quantidade</div></div></div></div>` +
      its.map(i => `<div class="card eq"><div class="eq-h"><div><small>${esc(i.g)}</small><h3>${esc(i.nome)}</h3><div class="mut">${esc(i.tipo)}</div></div>${i.qtd !== '' ? `<div class="qty"><b>${esc(i.qtd)}</b><small>${esc(i.un)}</small></div>` : ''}</div>
        <div class="grid2 tight"><table class="spec">${i.specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
        <div><div class="ms-t">Por que</div><ul class="why">${i.porque.map(t => `<li>${esc(t)}</li>`).join('')}</ul>${i.nota ? `<p class="mut sm">${esc(i.nota)}</p>` : ''}${i.fonte ? `<p class="mut sm">Fonte: ${esc(i.fonte)}. Confirmar variante e disponibilidade com a Telesys.</p>` : ''}</div></div></div>`).join('');
  };

  render.solicitacao = () => {
    $('#v-solicitacao').innerHTML = head('Solicitação de orçamento', 'Documento em rascunho para enviar à Telesys. Revise as pendências antes de enviar.',
      `<div class="row-btns">
        <button type="button" class="btn pri" data-act="imprimir">🖨️ Imprimir / PDF</button>
        <button type="button" class="btn" data-act="email">✉️ Enviar por e-mail</button>
        <button type="button" class="btn" data-act="copiar">📋 Copiar resumo</button>
        <button type="button" class="btn" data-act="json">💾 Baixar projeto</button>
        <button type="button" class="btn" data-act="kml">🗺️ KML</button>
        <button type="button" class="btn" data-act="png">🖼️ Imagem do mapa</button>
      </div>`) + `<div class="pend card" data-out="pend"></div><div class="doc-wrap"><div id="relatorio" class="doc">Gerando rascunho...</div></div>`;
    TS.Report.gerar(R, S, itensEquip(), porqueFaixa());
  };
  out.pend = () => R.pend.length ? `<h3>Pendências <small>${R.pend.length}</small></h3><ul class="pend-l">${R.pend.map(p => `<li><span>${esc(p.t)}</span><button type="button" class="lnk" data-go="${p.v}">resolver</button></li>`).join('')}</ul>` : '<h3>Sem pendências</h3><p class="mut">O rascunho tem os dados mínimos para a Telesys avaliar.</p>';

  render.v3d = () => {};
  out.leg3d = () => CV ? `<div class="lg"><i class="ok"></i>Com folga ${nf(CV.stats.folga, 0)}%</div><div class="lg"><i class="lim"></i>No limite ${nf(CV.stats.limite, 0)}%</div><div class="lg"><i class="sem"></i>Sem cobertura ${nf(CV.stats.sem, 0)}%</div><div class="lg-n">Altura da superfície = margem de sinal (dB). Torres com altura ilustrativa. Elipsoide lilás: 1ª zona de Fresnel do backhaul (exagerada 3×).</div>` : '';

  /* ---------- Topo e barra lateral ---------- */
  const completude = () => {
    const st = S, itens = [
      !!(st.projeto.nome && st.integrador.empresa), contChecklist() >= 7, st.area.poligono.length >= 3, st.area.estacoes.length > 0,
      st.dispositivos.length > 0, st.terminais.bandas.length > 0, !!st.area.core, !!st.ui.visitados.link, !!st.ui.visitados.equip
    ];
    return Math.round(itens.filter(Boolean).length / itens.length * 100);
  };
  const atualizarChrome = () => {
    const c = completude();
    $('#hud').innerHTML = `<div class="hud-top"><div class="hud-ring" style="--p:${c}"><b>${c}%</b></div><div><div class="hud-t">Rascunho v${S.meta.rev}</div><div class="hud-s">${R.pend.length} pendência(s)</div></div></div><div class="hud-bar"><i style="width:${c}%"></i></div>`;
    const bd = {
      checklist: `${contChecklist()}/${TS.CHECK_IDS.length}`, mapa: S.area.estacoes.length ? `${S.area.estacoes.length}` : '', dispositivos: R.dem.n ? nint(R.dem.n) : '',
      faixa: R.band.curto, link: R.r.limitante, equip: `${R.nRec}`, solicitacao: R.pend.length ? `${R.pend.length}` : '✓'
    };
    $$('.sb-item').forEach(b => { const e = b.querySelector('em'); if (e) e.textContent = bd[b.dataset.view] || ''; });
    $('#tbNome').textContent = S.projeto.nome || 'Projeto sem nome';
    $('#tbSub').textContent = [S.projeto.cliente, S.projeto.local].filter(Boolean).join(' · ') || 'Cliente e local a definir';
    $('#tbChips').innerHTML = `<span class="chip"><i>Faixa</i>${R.band.curto}</span><span class="chip"><i>Estações</i>${R.nRec}</span><span class="chip"><i>Raio</i>${dist(R.r.rFolga)}</span>${CV ? `<span class="chip ok"><i>Folga</i>${nf(CV.stats.folga, 0)}%</span>` : ''}<span class="chip ${R.r.limitante === 'UL' ? 'ul' : 'dl'}"><i>Limita</i>${R.r.limitante}</span>`;
  };

  const atualizarSaidas = (jaRenderizou) => {
    if (!jaRenderizou && (S.ui.view === 'faixa' || S.ui.view === 'equip' || S.ui.view === 'solicitacao')) render[S.ui.view]();
    $$(`#v-${S.ui.view} [data-out]`).forEach(el => { const f = out[el.dataset.out]; if (f) el.innerHTML = f(); });
    if (S.ui.view === 'checklist') $$('.ck-item').forEach((el, i) => el.classList.toggle('done', !!S.checklist[TS.CHECK_IDS[i]]?.ok));
    if (S.ui.view === 'mapa') TS.Map.desenhar(S, R.r, CV, CVC);
    if (S.ui.view === 'v3d') { TS.View3D.construir(S, R.r, CV); $('#leg3d').innerHTML = out.leg3d(); }
    atualizarChrome();
  };

  let pendenteForm = false;
  const renderView = () => {
    const v = S.ui.view;
    if (v === 'mapa') render.mapaSide(); else if (render[v]) render[v]();
    atualizarSaidas(true);
  };

  const ir = v => {
    if (!VIEWS.includes(v)) v = 'projeto';
    S.ui.view = v; S.ui.visitados[v] = true;
    $$('.view').forEach(el => el.classList.toggle('on', el.id === 'v-' + v));
    $$('.sb-item').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    try { history.replaceState(null, '', '#' + v); } catch (e) { /* file:// */ }
    TS.View3D.setAtivo(v === 'v3d');
    computar();
    renderView();
    if (v === 'mapa') { TS.Map.invalidar(); if (!TS.Map.fitted) setTimeout(() => TS.Map.enquadrar(), 120); }
    document.querySelector('.main').scrollTop = 0;
    document.body.classList.remove('sb-open');
    salvar();
  };

  let tCalc;
  const recalcular = (full) => {
    clearTimeout(tCalc);
    tCalc = setTimeout(() => {
      const precisa = computar() || full;
      if (precisa) {
        if (document.activeElement && document.activeElement.matches('input[type=number],input[type=text],textarea')) pendenteForm = true;
        else renderView();
      } else atualizarSaidas();
    }, 90);
  };

  /* ---------- Eventos ---------- */
  const onBind = ev => {
    const el = ev.target;
    if (!el.dataset || !el.dataset.bind) return;
    const t = el.dataset.t;
    let v;
    if (t === 'bool') v = el.checked;
    else if (t === 'num') { if (el.value === '' && el.dataset.bind === 'rf.sigma') v = null; else { v = parseFloat(String(el.value).replace(',', '.')); if (!Number.isFinite(v)) return; } }
    else v = el.value;
    setP(el.dataset.bind, v);
    const p = el.dataset.bind;
    if (p === 'area.ambiente') { const a = TS.ambById(v); S.rf.hBS = a.hBS; S.rf.hUT = TS.termById(S.terminais.ref).h || a.hUT; if (a.indoor) S.rf.hUT = 1.5; }
    if (p === 'terminais.ref') { const tt = TS.termById(v); S.rf.term.ptx = tt.ptx; S.rf.term.g = tt.g; S.rf.hUT = tt.h; }
    if (p === 'faixa.auto' && v === true) S.faixa.equipAuto = true;
    if (p.startsWith('dispositivos.') && p.endsWith('.tipo')) { const i = +p.split('.')[1], d = TS.devById(v); Object.assign(S.dispositivos[i], { ul: d.ul, dl: d.dl, mov: d.mov, lat: d.lat }); }
    if (S.meta.exemplo && ev.type === 'change' && p.startsWith('projeto.')) S.meta.exemplo = false;
    const full = el.dataset.full === '1' || el.tagName === 'SELECT' || t === 'bool' || p === 'area.ambiente';
    recalcular(full);
  };
  document.addEventListener('input', ev => { if (ev.target.type === 'range' && ev.target.id === 'rngDist') { S.rf.dist = +ev.target.value; atualizarSaidas(); return; } if (ev.target.tagName !== 'SELECT' && ev.target.type !== 'checkbox') onBind(ev); });
  document.addEventListener('change', ev => {
    const el = ev.target;
    if (el.tagName === 'SELECT' || el.type === 'checkbox') onBind(ev);
    if (el.id === 'selEquip') { S.faixa.equip = el.value; S.faixa.equipAuto = false; S.faixa.equipAplicado = null; recalcular(true); }
    if (el.dataset.bandTerm) { const k = el.dataset.bandTerm, a = S.terminais.bandas; if (el.checked) { if (!a.includes(k)) a.push(k); } else a.splice(a.indexOf(k), 1); recalcular(); }
    if (el.id === 'chkCob' || el.id === 'chkAneis') TS.Map.desenhar(S, R.r, CV, CVC);
    if (el.id === 'kmlIn' && el.files[0]) importarKML(el.files[0]);
    if (el.id === 'jsonIn' && el.files[0]) importarJSON(el.files[0]);
  });
  document.addEventListener('focusout', () => { if (pendenteForm) { pendenteForm = false; setTimeout(() => { if (!document.activeElement || !document.activeElement.matches('input,textarea')) renderView(); }, 30); } });

  document.addEventListener('click', ev => {
    const b = ev.target.closest('button, [data-go]');
    if (!b) return;
    if (b.dataset.view) return ir(b.dataset.view);
    if (b.dataset.go) return ir(b.dataset.go);
    if (b.dataset.modo) { TS.Map.setModo(b.dataset.modo); return; }
    if (b.dataset.addDev) { const d = TS.devById(b.dataset.addDev); S.dispositivos.push({ tipo: d.id, qtd: 1, ativ: 100, ul: d.ul, dl: d.dl, mov: d.mov, lat: d.lat }); computar(); renderView(); return; }
    if (b.dataset.delDev != null) { S.dispositivos.splice(+b.dataset.delDev, 1); computar(); renderView(); return; }
    if (b.dataset.delEst != null) { S.area.estacoes.splice(+b.dataset.delEst, 1); TS.Map.sel = null; computar(); renderView(); return; }
    if (b.dataset.delZona != null) { S.area.zonas.splice(+b.dataset.delZona, 1); computar(); renderView(); return; }
    if (b.dataset.selFaixa) { S.faixa.auto = false; S.faixa.sel = b.dataset.selFaixa; S.faixa.equipAuto = true; computar(); renderView(); toast(`Faixa ${TS.bandById(b.dataset.selFaixa).curto} selecionada. Parâmetros do datasheet aplicados.`); return; }
    const a = b.dataset.act;
    if (!a) return;
    ({
      concluirArea: () => TS.Map.concluirArea(),
      enquadrar: () => TS.Map.enquadrar(),
      limparArea: () => { if (confirm('Remover o polígono da área?')) { S.area.poligono = []; computar(); renderView(); } },
      semCore: () => { S.area.core = null; computar(); renderView(); },
      sugerir: sugerirEstacoes,
      kml: exportarKML, json: exportarJSON,
      imprimir: () => { S.meta.rev++; salvar(); TS.Report.gerar(R, S, itensEquip(), porqueFaixa()).then(() => setTimeout(() => window.print(), 150)); },
      email: enviarEmail, copiar: copiarResumo,
      png: async () => { const u = await TS.Report.snapshot(R, S, 1400, 900); if (u) baixar(u, nomeArq('mapa') + '.png'); },
      novo: () => { if (confirm('Começar um projeto novo? O atual fica salvo só se você baixar o arquivo.')) { S = novoEstado(); TS.Map.sel = null; TS.Map.fitted = false; ir('projeto'); } },
      exemplo: () => { if (confirm('Carregar o projeto de exemplo? O projeto atual será substituído.')) { S = exemplo(); TS.Map.fitted = false; ir('mapa'); } },
      abrir: () => $('#jsonIn').click(),
      menu: () => document.body.classList.toggle('sb-open'),
      mini: () => document.body.classList.toggle('sb-mini'),
      cam: () => TS.View3D.camera(b.dataset.cam),
      busca: () => buscar()
    }[a] || (() => {}))();
  });
  document.addEventListener('keydown', ev => {
    if (ev.target.matches('input,textarea,select')) { if (ev.key === 'Enter' && ev.target.id === 'mapBusca') buscar(); return; }
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const n = parseInt(ev.key, 10);
    if (n >= 1 && n <= 9) ir(VIEWS[n - 1]);
    if (ev.key === 'Escape' && S.ui.view === 'mapa') TS.Map.setModo('nav');
  });
  document.addEventListener('click', ev => { if (ev.target.id === 'btnBusca') buscar(); });
  const buscar = async () => { const q = $('#mapBusca')?.value; if (q && !(await TS.Map.buscar(q))) toast('Local não encontrado.'); };

  /* ---------- Ações ---------- */
  const sugerirEstacoes = () => {
    const st = S, poly = st.area.poligono;
    if (poly.length < 3) return toast('Desenhe a área antes de sugerir estações.');
    const r = R.r.rFolga;
    if (!r) return toast('Sem alcance útil com os parâmetros atuais.');
    if (st.area.estacoes.length && !confirm('Substituir as estações atuais por uma sugestão automática? Ajuste depois para pontos altos reais.')) return;
    const c = RF.centroide(poly), bb = RF.bbox(poly);
    const sp = Math.sqrt(3) * r * 0.92, dy = sp * Math.sqrt(3) / 2;
    const W = RF.dist([c[0], bb.w], [c[0], bb.e]), H = RF.dist([bb.s, c[1]], [bb.n, c[1]]);
    let pts = [];
    for (let y = -H / 2 - dy, row = 0; y <= H / 2 + dy; y += dy, row++) for (let x = -W / 2 - sp; x <= W / 2 + sp; x += sp) {
      const p = RF.offset(c, x + (row % 2 ? sp / 2 : 0), y);
      if (RF.pip(p, poly)) pts.push(p);
    }
    if (!pts.length || R.nCob <= 1) pts = [RF.pip(c, poly) ? c : poly[0]];
    if (pts.length > 40) return toast(`Seriam ${pts.length} estações. Revise a faixa ou os parâmetros.`);
    const amb = TS.ambById(st.area.ambiente);
    st.area.estacoes = pts.map((p, i) => ({ id: 'e' + Date.now() + i, nome: 'E' + (i + 1), lat: p[0], lng: p[1], h: st.rf.hBS || amb.hBS, antena: amb.indoor ? 'omni' : 'tri', az: 0 }));
    computar(); renderView(); TS.Map.enquadrar();
    toast(`${pts.length} posição(ões) sugerida(s). Arraste cada estação para o ponto alto real mais próximo.`);
  };

  const nomeArq = suf => `telesys-rascunho-${(S.projeto.nome || 'projeto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${suf}`;
  const baixar = (href, nome) => { const a = document.createElement('a'); a.href = href; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); };
  const baixarTxt = (txt, nome, tipo) => { const u = URL.createObjectURL(new Blob([txt], { type: tipo })); baixar(u, nome); setTimeout(() => URL.revokeObjectURL(u), 2000); };

  const exportarJSON = () => {
    S.meta.rev++;
    const o = Object.assign({}, S, { meta: Object.assign({}, S.meta, { exportado: hoje(), rascunho: true, aviso: 'Rascunho para solicitação de orçamento. Não constitui proposta.' }) });
    baixarTxt(JSON.stringify(o, null, 2), nomeArq('v' + S.meta.rev) + '.json', 'application/json');
    salvar(); atualizarChrome();
  };
  const importarJSON = f => {
    const rd = new FileReader();
    rd.onload = () => {
      try { const o = JSON.parse(rd.result); if (o.meta?.app !== 'telesys-linkbudget') throw new Error('arquivo'); S = mesclar(o); S.faixa.aplicada = S.faixa.sel; S.faixa.equipAplicado = S.faixa.equip; TS.Map.fitted = false; ir('projeto'); toast('Projeto carregado.'); }
      catch (e) { toast('Arquivo inválido para esta ferramenta.'); }
    };
    rd.readAsText(f);
  };

  const exportarKML = () => {
    const st = S, x = esc;
    const pm = [];
    if (st.area.poligono.length >= 3) pm.push(`<Placemark><name>Área a cobrir</name><styleUrl>#area</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${[...st.area.poligono, st.area.poligono[0]].map(p => `${p[1]},${p[0]},0`).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`);
    st.area.estacoes.forEach(e => pm.push(`<Placemark><name>${x(e.nome)}</name><description>Estação · altura ${e.h} m · antena ${e.antena}${e.antena !== 'omni' ? ' · azimute ' + e.az + '°' : ''}</description><Point><coordinates>${e.lng},${e.lat},${e.h}</coordinates></Point></Placemark>`));
    if (st.area.core) pm.push(`<Placemark><name>Sala técnica (core)</name><Point><coordinates>${st.area.core.lng},${st.area.core.lat},0</coordinates></Point></Placemark>`);
    st.area.zonas.forEach(z => pm.push(`<Placemark><name>Obstáculo: ${x((TS.ZONAS.find(t => t.id === z.tipo) || {}).l)}</name><description>raio ${z.raio} m</description><Point><coordinates>${z.lng},${z.lat},0</coordinates></Point></Placemark>`));
    const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(st.projeto.nome || 'Projeto')} (Rascunho)</name><Style id="area"><LineStyle><color>ffe0c94c</color><width>2</width></LineStyle><PolyStyle><color>334cc9e0</color></PolyStyle></Style>${pm.join('')}</Document></kml>`;
    baixarTxt(kml, nomeArq('area') + '.kml', 'application/vnd.google-earth.kml+xml');
  };
  const importarKML = f => {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const doc = new DOMParser().parseFromString(rd.result, 'text/xml');
        const parse = t => t.trim().split(/\s+/).map(c => c.split(',').map(Number)).filter(c => c.length >= 2 && Number.isFinite(c[0])).map(c => [c[1], c[0]]);
        const pol = doc.querySelector('Polygon outerBoundaryIs coordinates, Polygon coordinates') || doc.querySelector('LineString coordinates');
        let n = 0;
        if (pol) { let pts = parse(pol.textContent); if (pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop(); S.area.poligono = pts; n++; }
        const pts = Array.from(doc.querySelectorAll('Placemark')).filter(p => p.querySelector('Point coordinates'));
        if (pts.length && confirm(`O arquivo tem ${pts.length} ponto(s). Usar como estações candidatas?`)) {
          const amb = TS.ambById(S.area.ambiente);
          S.area.estacoes = pts.map((p, i) => { const c = parse(p.querySelector('Point coordinates').textContent)[0]; return { id: 'k' + i, nome: (p.querySelector('name')?.textContent || 'E' + (i + 1)).slice(0, 24), lat: c[0], lng: c[1], h: S.rf.hBS || amb.hBS, antena: 'tri', az: 0 }; });
          n++;
        }
        if (!n) throw new Error('vazio');
        S.checklist.area = Object.assign(S.checklist.area || {}, { ok: true });
        computar(); renderView(); TS.Map.enquadrar(); toast('KML importado.');
      } catch (e) { toast('Não foi possível ler polígono ou pontos neste KML.'); }
    };
    rd.readAsText(f);
  };

  const resumoTexto = () => {
    const st = S, r = R.r;
    const l = [];
    l.push(`SOLICITAÇÃO DE ORÇAMENTO · RASCUNHO v${st.meta.rev}`);
    l.push('Documento preliminar, sem valor de proposta e sem compromisso técnico ou comercial.');
    l.push('');
    l.push(`Projeto: ${st.projeto.nome || 'a definir'}`);
    l.push(`Cliente final: ${st.projeto.cliente || 'a definir'} · ${(TS.SETORES.find(s => s.id === st.projeto.setor) || {}).l} · ${st.projeto.local || 'local a definir'}`);
    l.push(`Integrador: ${st.integrador.empresa || 'a definir'} · ${st.integrador.contato} · ${st.integrador.email} ${st.integrador.fone}`);
    l.push('');
    l.push(`Área: ${R.areaM2 ? nf(R.areaM2 / 1e6, 2) + ' km²' : 'sem polígono'} · ambiente: ${R.amb.l}`);
    l.push(`Dispositivos: ${nint(R.dem.n)} hoje, ${nint(R.dem.nF)} com crescimento · UL ${nf(R.dem.ulF)} Mbps · DL ${nf(R.dem.dlF)} Mbps`);
    l.push(`Faixa sugerida: ${R.band.nome} (${R.band.faixa}), canal de ${R.bw} MHz`);
    l.push(`Link budget: raio com folga ${dist(r.rFolga)}, no limite ${dist(r.rLimite)}, limitado pelo ${r.limitante === 'UL' ? 'uplink' : 'downlink'}`);
    if (CV) l.push(`Predição: ${nf(CV.stats.folga, 0)}% com folga, ${nf(CV.stats.limite, 0)}% no limite, ${nf(CV.stats.sem, 0)}% sem cobertura`);
    l.push('');
    l.push('Itens para orçamento:');
    itensEquip().forEach(i => l.push(`- ${i.qtd !== '' ? i.qtd + ' × ' : ''}${i.nome}`));
    if (R.pend.length) { l.push(''); l.push('Pendências a validar:'); R.pend.slice(0, 8).forEach(p => l.push(`- ${p.t}`)); }
    l.push('');
    l.push('Anexos sugeridos: PDF do rascunho e arquivo .json do projeto.');
    return l.join('\n');
  };
  const copiarResumo = async () => { try { await navigator.clipboard.writeText(resumoTexto()); toast('Resumo copiado.'); } catch (e) { toast('Não foi possível copiar automaticamente.'); } };
  const enviarEmail = () => {
    const assunto = `${TS.CONFIG.assuntoPadrao} · ${S.projeto.nome || 'Rede privativa'}`;
    let corpo = resumoTexto();
    if (corpo.length > 1800) corpo = corpo.slice(0, 1800) + '\n(...)';
    const href = `mailto:${encodeURIComponent(TS.CONFIG.emailTelesys || '')}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    window.location.href = href;
    toast('Anexe o PDF (Imprimir > Salvar como PDF) e o arquivo do projeto.');
  };

  let tT;
  const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tT); tT = setTimeout(() => t.classList.remove('on'), 3600); };

  /* ---------- Início ---------- */
  const iniciar = () => {
    S = carregar() || exemplo();
    S.faixa.aplicada = S.faixa.aplicada || null;
    TS.Map.init($('#map'), (o) => {
      if (o === 'sel') { render.mapaSide(); atualizarSaidas(); return; }
      computar(); render.mapaSide(); atualizarSaidas();
    }, () => S);
    TS.View3D.init($('#view3d'));
    $('#rngExag').addEventListener('input', e => TS.View3D.setExag(+e.target.value));
    $('#chkRelevo').addEventListener('change', e => TS.View3D.setRelevo(e.target.checked));
    const h = (location.hash || '').slice(1);
    ir(VIEWS.includes(h) ? h : (S.meta.exemplo ? 'projeto' : S.ui.view));
  };
  window.addEventListener('DOMContentLoaded', iniciar);
  TS.App = { get S() { return S; }, get R() { return R; }, itensEquip, porqueFaixa, resumoTexto };
})();
