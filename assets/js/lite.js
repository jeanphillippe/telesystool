/* Telesys · Link Budget rápido (Rascunho)
   Fluxo em 5 passos: cenário, planta, dispositivos, resultado e orçamento.
   A planta começa vazia: o integrador traça o contorno (sobre o satélite, se houver local),
   posiciona as small cells e desenha os obstáculos (com rotação).
   Reaproveita data.js, rf.js, charts.js e view3d.js. */
(function () {
  const RF = TS.RF;
  const K = 'telesys-lb-lite-v3';
  const KFULL = 'telesys-linkbudget-rascunho-v1';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (v, d = 1) => Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : 'n/d';
  const nint = v => Number.isFinite(v) ? Math.round(v).toLocaleString('pt-BR') : 'n/d';
  const dist = m => !Number.isFinite(m) || m <= 0 ? '0 m' : m < 1000 ? `${Math.round(m)} m` : `${nf(m / 1000, m < 10000 ? 1 : 0)} km`;
  const sgn = v => (v >= 0 ? '+' : '') + nf(v, 0);
  const sc = n => `${n} small cell${n === 1 ? '' : 's'}`;
  TS.fmt = TS.fmt || { nf, nint, dist, esc, sgn };

  /* ---------- Dados do fluxo ---------- */
  const DEV_CURTO = { maquina: 'Máquinas', sensor: 'Sensores IoT', camhd: 'Câmeras HD', cam4k: 'Câmeras 4K / IA', tablet: 'Tablets', coletor: 'Coletores de dados', robo: 'Robôs / AGV', ptt: 'Rádios PTT', cpe: 'CPEs / gateways' };
  const ATIV = { tablet: 50, ptt: 30, coletor: 60 };
  const PRESET = {
    agro: { amb: 'rural', area: 30, devs: { maquina: 10, sensor: 30, camhd: 2, tablet: 6 } },
    mineracao: { amb: 'industrial', area: 10, devs: { maquina: 15, sensor: 40, camhd: 6, ptt: 30, tablet: 10 } },
    oleogas: { amb: 'industrial', area: 5, devs: { sensor: 80, camhd: 6, ptt: 20, tablet: 10 } },
    utility: { amb: 'rural', area: 50, devs: { sensor: 150, coletor: 10, ptt: 10 } },
    industria: { amb: 'fabrica', area: 0.05, devs: { robo: 10, camhd: 8, coletor: 20, sensor: 60, tablet: 10 } },
    logistica: { amb: 'galpao', area: 0.03, devs: { coletor: 40, robo: 6, camhd: 10, tablet: 10 } },
    outro: { amb: 'industrial', area: 0.5, devs: { tablet: 20, camhd: 6, sensor: 30 } }
  };
  const SETOR_IC = { agro: '🌾', mineracao: '⛏️', oleogas: '🛢️', utility: '⚡', industria: '🏭', logistica: '📦', outro: '🏥' };
  const AMB_IC = { rural: ['🌾', 'Campo aberto', 'fazenda, lavoura, pasto'], industrial: ['🏗️', 'Externo com estruturas', 'planta, mina, porto'], galpao: ['🏬', 'Galpão', 'pouca obstrução interna'], fabrica: ['🏭', 'Fábrica densa', 'máquinas e metal'] };
  const TERM_CH = [['B28', '700 MHz'], ['B87', '410 MHz'], ['L15', '1,5 GHz'], ['B40', '2,3 GHz'], ['B43', '3,7 GHz LTE'], ['N77', '5G n77/n78'], ['NRMM', 'mmWave']];
  const TERM_IC = { modulo: '📱 Celular / módulo', camera: '📹 Câmera / sensor', maquina: '🚜 Máquina', cpe: '📶 CPE externo' };
  const PASSOS = ['Cenário', 'Planta', 'Dispositivos', 'Resultado', 'Orçamento'];
  const MAX_SC = 20;

  /* Obstáculos por cenário. mod: veg (Weissberger pela extensão atravessada),
     parede (3GPP TR 38.901: 5 + 4·f GHz por parede cruzada), fixo (dB ao atravessar). */
  const OBS = {
    veg: { l: 'Vegetação alta', ic: '🌳', forma: 'ret', mod: 'veg', cor: '#4f9d5d', alt: 4, z: 'vegetacao' },
    silo: { l: 'Silo / armazém metálico', ic: '🛢️', forma: 'ret', mod: 'fixo', db: 20, cor: '#9aa6b4', alt: 7, z: 'metal' },
    sede: { l: 'Construção', ic: '🏠', forma: 'ret', mod: 'parede', cor: '#c08a5b', alt: 3, z: 'predio' },
    morro: { l: 'Relevo / morro', ic: '⛰️', forma: 'ret', mod: 'fixo', db: 18, cor: '#8a6fb3', alt: 6, z: 'relevo' },
    metal: { l: 'Estrutura metálica', ic: '🔩', forma: 'ret', mod: 'fixo', db: 15, cor: '#9aa6b4', alt: 5, z: 'metal' },
    tanque: { l: 'Tanques', ic: '🛢️', forma: 'ret', mod: 'fixo', db: 20, cor: '#7f8b99', alt: 6, z: 'metal' },
    predio: { l: 'Prédio de concreto', ic: '🏢', forma: 'ret', mod: 'parede', cor: '#c08a5b', alt: 6, z: 'predio' },
    pilha: { l: 'Pilha de material', ic: '⛰️', forma: 'ret', mod: 'fixo', db: 18, cor: '#8a6fb3', alt: 5, z: 'relevo' },
    rack: { l: 'Porta-paletes', ic: '🗄️', forma: 'ret', mod: 'fixo', db: 10, cor: '#9aa6b4', alt: 4, z: 'metal' },
    parede: { l: 'Parede de concreto', ic: '🧱', forma: 'linha', mod: 'parede', cor: '#d08f5e', alt: 4, z: 'predio' },
    camara: { l: 'Câmara fria', ic: '❄️', forma: 'ret', mod: 'fixo', db: 25, cor: '#7fb3d5', alt: 4, z: 'metal' },
    mezanino: { l: 'Mezanino metálico', ic: '🪜', forma: 'ret', mod: 'fixo', db: 6, cor: '#a7b1bd', alt: 3, z: 'metal' },
    maquina: { l: 'Máquinas grandes', ic: '⚙️', forma: 'ret', mod: 'fixo', db: 12, cor: '#9aa6b4', alt: 3, z: 'metal' },
    sala: { l: 'Sala fechada', ic: '🚪', forma: 'ret', mod: 'parede', cor: '#c08a5b', alt: 3, z: 'predio' }
  };
  const OBS_AMB = { rural: ['veg', 'silo', 'sede', 'morro'], industrial: ['metal', 'tanque', 'predio', 'pilha', 'veg'], galpao: ['rack', 'parede', 'camara', 'mezanino'], fabrica: ['maquina', 'metal', 'parede', 'sala', 'camara'] };
  const TEMPL = {
    irregular: [[1, 0.2], [0.72, 0.78], [0.05, 1.02], [-0.66, 0.74], [-1.02, 0.12], [-0.7, -0.62], [0.02, -0.95], [0.75, -0.66]],
    ret: [[-1, -0.5], [1, -0.5], [1, 0.5], [-1, 0.5]],
    quad: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
    l: [[-1, -1], [1, -1], [1, 0], [0, 0], [0, 1], [-1, 1]]
  };
  const TEMPL_L = [['ret', '▭ Retângulo'], ['quad', '◻ Quadrado'], ['l', '⌐ Em L'], ['irregular', '⬠ Irregular']];
  const FERR = [['contorno', '⬠', 'Contorno'], ['estacao', '📡', 'Small cell'], ['obstaculo', '🧱', 'Obstáculo'], ['core', '🗄️', 'Core'], ['navegar', '✋', 'Mover'], ['apagar', '🗑', 'Apagar']];
  const ANT = [['omni', 'Omni', 1], ['setorial', 'Setorial', 1], ['tri', '3 setores', 3]];
  const celulas = e => e.ant === 'tri' ? 3 : 1;
  const TEMAS = { auto: 'automático', claro: 'claro', escuro: 'escuro' };

  const novo = () => ({
    step: 1, setor: 'agro', amb: 'rural', areaKm2: 30, quer5G: false, cresc: 30,
    devs: Object.assign({}, PRESET.agro.devs), bandas: [], term: 'maquina', conf: 90,
    glob: { cabine: false, interno: false }, faixa: 'auto', contato: { empresa: '', projeto: '', email: '', fone: '' }, mexeu: {},
    plano: null, modo: 'contorno', obsTipo: null, cob: true, geo: null, sat: true, tema: 'auto'
  });
  let S;
  const carregar = o => { const b = novo(); Object.assign(b, o || {}); b.contato = Object.assign(novo().contato, (o || {}).contato); b.glob = Object.assign(novo().glob, (o || {}).glob); return b; };
  try { S = carregar(JSON.parse(localStorage.getItem(K) || 'null')); } catch (e) { S = novo(); }
  const salvar = () => { try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) { /* ignora */ } };

  /* ---------- Tema claro / escuro ---------- */
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  const escuro = () => S.tema === 'escuro' || (S.tema === 'auto' && (!mq || mq.matches));
  const aplicarTema = () => {
    const e = escuro();
    document.documentElement.dataset.tema = e ? 'escuro' : 'claro';
    TS.View3D.fundo && TS.View3D.fundo(e ? 0x0d1020 : 0xe9edf4);
  };
  const corCv = () => escuro()
    ? { bg: '#0c0f1d', grade: 'rgba(255,255,255,.045)', linha: '#f2f5f8', txt: '#e8ecf1', caixa: 'rgba(12,15,29,.85)', est: '#4cc9e0', estTxt: '#06222a', dica: 'rgba(232,236,241,.7)' }
    : { bg: '#eef1f6', grade: 'rgba(20,30,70,.07)', linha: '#1d2340', txt: '#1d2340', caixa: 'rgba(255,255,255,.9)', est: '#1f8ea3', estTxt: '#ffffff', dica: 'rgba(29,35,64,.6)' };

  /* ---------- Geometria da planta (metros, x para leste, y para o norte) ---------- */
  const areaPoli = p => p.length < 3 ? 0 : Math.abs(p.reduce((a, q, i) => { const r = p[(i + 1) % p.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
  const centro = p => [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];
  const pipXY = (x, y, p) => { let ins = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; };
  const escalar = (pts, A, c0 = [0, 0]) => { const k = Math.sqrt(A / areaPoli(pts)), c = centro(pts); return pts.map(([x, y]) => [(x - c[0]) * k + c0[0], (y - c[1]) * k + c0[1]]); };
  const temPoli = () => S.plano.poli.length >= 3;
  const centroVista = () => ED.view ? [ED.view.cx, ED.view.cy] : [0, 0];
  const regiao = () => { if (temPoli()) return S.plano.poli; const c = centroVista(), h = Math.sqrt(S.areaKm2 * 1e6) / 2; return [[c[0] - h, c[1] - h], [c[0] + h, c[1] - h], [c[0] + h, c[1] + h], [c[0] - h, c[1] + h]]; };
  const span = () => { const p = regiao(), xs = p.map(q => q[0]), ys = p.map(q => q[1]); return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); };
  const ancora = () => S.geo ? [S.geo.lat, S.geo.lng] : [-15, -50];
  const ll = (x, y) => RF.offset(ancora(), x, y);
  const xy = (lat, lng) => { const a = ancora(), rad = Math.PI / 180, R = 6371008.8; return [(lng - a[1]) * rad * R * Math.cos(a[0] * rad), (lat - a[0]) * rad * R]; };

  /* Obstáculos retangulares podem girar: (x1,y1)-(x2,y2) é o retângulo antes da rotação, girado por ang em torno do centro */
  const rotP = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
  const cObs = o => [(o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2];
  const paraLocal = (o, x, y) => { if (!o.ang) return [x, y]; const [cx, cy] = cObs(o), [lx, ly] = rotP(x - cx, y - cy, -o.ang * Math.PI / 180); return [lx + cx, ly + cy]; };
  const deLocal = (o, x, y) => { if (!o.ang) return [x, y]; const [cx, cy] = cObs(o), [lx, ly] = rotP(x - cx, y - cy, o.ang * Math.PI / 180); return [lx + cx, ly + cy]; };
  const cantos = o => { const x0 = Math.min(o.x1, o.x2), x1 = Math.max(o.x1, o.x2), y0 = Math.min(o.y1, o.y2), y1 = Math.max(o.y1, o.y2); return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(p => deLocal(o, ...p)); };

  const garantirPlano = () => {
    if (!S.plano) { S.plano = { forma: 'vazio', poli: [], area: S.areaKm2, est: [], obs: [], core: null }; ED.view = null; }
    const P = S.plano;
    if (!('core' in P)) P.core = null;
    if (P.poli.length >= 3 && P.forma === 'livre') P.area = S.areaKm2 = areaPoli(P.poli) / 1e6;
    else if (P.poli.length >= 3 && Math.abs(P.area - S.areaKm2) / S.areaKm2 > 1e-6) {
      const k = Math.sqrt(S.areaKm2 / P.area), c = centro(P.poli), f = ([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k];
      P.poli = P.poli.map(f);
      P.est.forEach(e => { [e.x, e.y] = f([e.x, e.y]); });
      P.obs.forEach(o => { [o.x1, o.y1] = f([o.x1, o.y1]); [o.x2, o.y2] = f([o.x2, o.y2]); });
      if (P.core) [P.core.x, P.core.y] = f([P.core.x, P.core.y]);
      P.area = S.areaKm2; ED.view = null;
    } else if (P.poli.length < 3) P.area = S.areaKm2;
    if (!OBS_AMB[S.amb].includes(S.obsTipo)) S.obsTipo = OBS_AMB[S.amb][0];
  };

  const distribuir = n => {
    const P = S.plano, amb = TS.ambById(S.amb), reg = regiao();
    const xs = reg.map(p => p[0]), ys = reg.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const W = x1 - x0, H = y1 - y0, c = centro(reg);
    const cols = Math.max(1, Math.round(Math.sqrt(n * W / H))), rows = Math.ceil(n / cols);
    const out = [];
    for (let j = 0; j < rows; j++) {
      const nr = Math.min(cols, n - j * cols);
      for (let i = 0; i < nr; i++) {
        let x = n === 1 ? c[0] : x0 + W * (0.5 + ((i + 0.5) / nr - 0.5) * 0.82);
        let y = n === 1 ? c[1] : y1 - H * (0.5 + ((j + 0.5) / rows - 0.5) * 0.82);
        for (let t = 0; t < 12 && !pipXY(x, y, reg); t++) { x += (c[0] - x) * 0.2; y += (c[1] - y) * 0.2; }
        out.push({ x, y, h: amb.hBS, ant: 'omni', az: 0 });
      }
    }
    P.est = out;
  };

  /* Interseção do percurso small cell → ponto com cada obstáculo */
  const segInt = (ax, ay, bx, by, cx, cy, dx, dy) => {
    const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx); if (!d) return false;
    const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
    return t > 0 && t < 1 && u >= 0 && u <= 1;
  };
  const geomObs = (o, ax, ay, bx, by) => {
    if (o.forma === 'linha') return segInt(ax, ay, bx, by, o.x1, o.y1, o.x2, o.y2) ? { cross: 1, len: 0 } : null;
    if (o.ang) { [ax, ay] = paraLocal(o, ax, ay); [bx, by] = paraLocal(o, bx, by); }
    const xmin = Math.min(o.x1, o.x2), xmax = Math.max(o.x1, o.x2), ymin = Math.min(o.y1, o.y2), ymax = Math.max(o.y1, o.y2);
    const dx = bx - ax, dy = by - ay, p = [-dx, dx, -dy, dy], q = [ax - xmin, xmax - ax, ay - ymin, ymax - ay];
    let t0 = 0, t1 = 1;
    for (let k = 0; k < 4; k++) {
      if (p[k] === 0) { if (q[k] < 0) return null; }
      else { const t = q[k] / p[k]; if (p[k] < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; } }
    }
    return { cross: (t0 > 0 ? 1 : 0) + (t1 < 1 ? 1 : 0), len: (t1 - t0) * Math.hypot(dx, dy) };
  };
  const perdaObs = (o, g, fG) => {
    const d = OBS[o.tipo];
    if (d.mod === 'veg') return TS.weissberger(fG, g.len);
    if (d.mod === 'parede') return (5 + 4 * fG) * g.cross;
    return d.db;
  };
  const dentroObs = (o, x, y) => { if (o.forma !== 'ret') return false; [x, y] = paraLocal(o, x, y); return x >= Math.min(o.x1, o.x2) && x <= Math.max(o.x1, o.x2) && y >= Math.min(o.y1, o.y2) && y <= Math.max(o.y1, o.y2); };
  const perdaTipica = (tipo, band) => { const d = OBS[tipo], f = band.fDL / 1000; return d.mod === 'veg' ? TS.weissberger(f, 30) : d.mod === 'parede' ? 5 + 4 * f : d.db; };

  /* Avaliação de sinal em um ponto: melhor small cell, margem e potência recebida */
  const prepararAval = (r, band, gant) => ({
    r, band, fD: band.fDL / 1000, fU: band.fUL / 1000, pOmni: Math.min(0, 10 - gant),
    est: S.plano.est.map(x => ({ x: x.x, y: x.y, ant: x.ant, az: x.az || 0, ctx: Object.assign({}, r.ctx, { hBS: x.h }), obs: S.plano.obs.filter(o => !dentroObs(o, x.x, x.y)) }))
  });
  const avaliar = (A, x, y) => {
    let best = A.est.length ? -999 : -60, bi = -1, prx = -200, dB = 0;
    for (let k = 0; k < A.est.length; k++) {
      const t = A.est[k], dx = x - t.x, dy = y - t.y, d = Math.max(Math.hypot(dx, dy), 1);
      let att = A.pOmni;
      if (t.ant !== 'omni') {
        const b = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
        att = t.ant === 'setorial' ? RF.antAtt(RF.angDiff(b, t.az)) : Math.max(RF.antAtt(RF.angDiff(b, t.az)), RF.antAtt(RF.angDiff(b, t.az + 120)), RF.antAtt(RF.angDiff(b, t.az + 240)));
      }
      let oD = 0, oU = 0;
      for (const o of t.obs) { const g = geomObs(o, t.x, t.y, x, y); if (g && (g.cross || g.len > 0)) { oD += perdaObs(o, g, A.fD); oU += perdaObs(o, g, A.fU); } }
      const plD = RF.pathLoss(d, A.band.fDL, t.ctx);
      const m = Math.min(A.r.DL.mapl - plD - A.r.DL.obst - oD + att, A.r.UL.mapl - RF.pathLoss(d, A.band.fUL, t.ctx) - A.r.UL.obst - oU + att);
      if (m > best) { best = m; bi = k; prx = A.r.DL.sai - plD - A.r.DL.obst - oD + att + A.r.DL.grx; dB = d; }
    }
    return { m: best, i: bi, prx, d: dB };
  };

  /* Predição em grade sobre a planta */
  const limitesPlano = () => {
    const P = S.plano, pts = P.poli.concat(P.est.map(e => [e.x, e.y]));
    if (P.core) pts.push([P.core.x, P.core.y]);
    const minLado = Math.sqrt(S.areaKm2 * 1e6) * 1.2;
    if (!pts.length) { const h = minLado / 2; return { w: -h, e: h, s: -h, n: h }; }
    let w = Math.min(...pts.map(p => p[0])), e = Math.max(...pts.map(p => p[0])), s = Math.min(...pts.map(p => p[1])), n = Math.max(...pts.map(p => p[1]));
    if (!temPoli()) { const cx = (w + e) / 2, cy = (s + n) / 2, h = Math.max(e - w, n - s, minLado) / 2; w = cx - h; e = cx + h; s = cy - h; n = cy + h; }
    const pad = Math.max(e - w, n - s) * 0.1 + 10;
    return { w: w - pad, e: e + pad, s: s - pad, n: n + pad };
  };
  const cobertura = (r, band, gant, nx = 90) => {
    const box = limitesPlano(), { w, e, s, n } = box, P = S.plano;
    const A = prepararAval(r, band, gant);
    if (!P.est.length) return { vazio: true, box, nx: 0, ny: 0, stats: { folga: 0, limite: 0, sem: 0 }, A };
    const W = e - w, H = n - s, ny = Math.max(24, Math.min(170, Math.round(nx * H / W)));
    const N = nx * ny, margem = new Float32Array(N), cls = new Uint8Array(N), dentro = new Uint8Array(N);
    const poli = temPoli();
    const cont = { 3: 0, 2: 0, 1: 0 }; let tot = 0, pior = null;
    for (let j = 0; j < ny; j++) {
      const y = n - (j + 0.5) / ny * H;
      for (let i = 0; i < nx; i++) {
        const x = w + (i + 0.5) / nx * W, best = avaliar(A, x, y).m;
        const k = j * nx + i, c = best >= r.folgaReq ? 3 : best >= 0 ? 2 : 1;
        margem[k] = best; cls[k] = c;
        const ins = poli ? (pipXY(x, y, P.poli) ? 1 : 0) : 1; dentro[k] = ins;
        if (ins) { cont[c]++; tot++; if (!pior || best < pior.m) pior = { m: best, x, y }; }
      }
    }
    const pct = c => tot ? cont[c] / tot * 100 : 0;
    return { nx, ny, box, margem, cls, dentro, stats: { folga: pct(3), limite: pct(2), sem: pct(1) }, pior, A };
  };

  /* ---------- Motor de link budget ---------- */
  const demanda = () => {
    let ul = 0, dl = 0, n = 0, lat = 0, up = 0;
    for (const id in S.devs) {
      const q = S.devs[id] || 0; if (!q) continue;
      const d = TS.devById(id), a = (ATIV[id] ?? 100) / 100;
      ul += q * a * d.ul; dl += q * a * d.dl; n += q; if (d.lat) lat += q; if (d.upHeavy) up += q;
    }
    const g = 1 + S.cresc / 100;
    return { ul, dl, n, lat, up, ulF: ul * g, dlF: dl * g, nF: Math.ceil(n * g) };
  };
  const escolherEquip = (band, dem, amb) => {
    if (band.id === 'b37') { if (S.quer5G || dem.ulF > 40) return 'aurora243'; return amb.indoor ? 'nova430i' : 'nova436q'; }
    return TS.EQUIP_POR_FAIXA[band.id][0];
  };
  const estDef = (band, eq) => ({ ptx: band.limitePtx ? Math.min(eq.ptx, band.limitePtx) : eq.ptx, gant: eq.gant ?? band.gant, cabo: eq.antena === 'integrada' ? 0.5 : 2, sens: eq.sens });
  /* 5G NR em 3,7 GHz usa os 100 MHz da faixa; LTE fica no canal padrão da faixa */
  const bwDe = (band, eq) => eq.tech === 'NR' && band.id === 'b37' ? 100 : band.bw;
  const hMedia = amb => S.plano && S.plano.est.length ? S.plano.est.reduce((a, e) => a + e.h, 0) / S.plano.est.length : amb.hBS;
  const rfPara = (band, eq, amb) => {
    const t = TS.termById(S.term), est = estDef(band, eq), bw = bwDe(band, eq);
    const obst = { cabine: S.glob.cabine ? 6 : 0, concreto: S.glob.interno && !amb.indoor ? 1 : 0 };
    return {
      modelo: 'auto', visada: 'auto', hBS: hMedia(amb), hUT: amb.indoor ? 1.5 : t.h, conf: S.conf, sigma: null, interf: 2, obst, divDL: 0, divUL: 0,
      dl: { ptx: est.ptx, gant: est.gant, cabo: est.cabo, grx: t.g, div: 0, sens: RF.sensFormula(bw, 9, -1, eq.tech) },
      ul: { ptx: t.ptx, gtx: t.g, sens: est.sens, div: 0 }, est, bw
    };
  };
  /* Raio de uma small cell omni (antena omni de até 10 dBi): base da contagem por cobertura */
  const rOmni = (band, amb, rf) => RF.calcular({ band, amb, rf: Object.assign({}, rf, { dl: Object.assign({}, rf.dl, { gant: Math.min(rf.dl.gant, 10) }) }) });
  const nCobDe = (A, r) => r.rFolga > 0 ? Math.max(1, Math.ceil(A * 1e6 / (2.598 * r.rFolga ** 2))) : 99;

  const calcular = () => {
    garantirPlano();
    const amb = TS.ambById(S.amb), dem = demanda(), A = S.areaKm2;
    const P = S.plano;
    const setor = TS.SETORES.find(x => x.id === S.setor);
    const tb = S.bandas;
    const rank = TS.BANDS.map(b => {
      const eq = TS.EQUIP[escolherEquip(b, dem, amb)], rf = rfPara(b, eq, amb);
      const r = RF.calcular({ band: b, amb, rf });
      const cap = RF.capacidade(b, rf.bw, eq.tech, 'cfg1');
      const nCob = nCobDe(A, rOmni(b, amb, rf));
      let s = 50; const pro = [], con = [];
      if (setor.bonus[b.id]) { s += setor.bonus[b.id]; pro.push(b.uso); }
      const baixa = b.fDL < 1000, alta = b.fDL > 3000;
      if (A > 3) { if (baixa) { s += 14; pro.push('Área extensa: faixa baixa alcança mais longe e atravessa melhor obstáculos.'); } if (alta) { s -= 16; con.push('Alcance curto para uma área extensa.'); } }
      else if (A <= 1 && (alta || b.id === 'b24')) { s += 10; pro.push('Área menor: mais capacidade em pouco espaço.'); }
      if (amb.indoor && (alta || b.id === 'b24') && b.id !== 'b28g') s += 6;
      if (P.obs.length >= 3 && baixa) { s += 4; pro.push('Muitos obstáculos marcados: frequência baixa atravessa melhor.'); }
      if (nCob > 8 && nCob < 99) { s -= Math.min(22, (nCob - 8) * 2); con.push(`Cerca de ${sc(nCob)} só para cobrir a área.`); }
      if (nCob >= 99) { s -= 25; con.push('Sem alcance útil neste cenário.'); }
      const celCap = Math.ceil(Math.max(dem.ulF / (cap.ul * 0.7), dem.dlF / (cap.dl * 0.7)));
      if (celCap > nCob) { s -= Math.min(14, (celCap - nCob) * 2); con.push(`O tráfego pede ${sc(celCap)}, mais do que a cobertura (${nCob}).`); }
      else if (dem.ulF > 20 && b.bwOpts[b.bwOpts.length - 1] >= 20) { s += 8; pro.push('Canal largo para o uplink das câmeras.'); }
      const match = TS.BAND_TERM_MATCH[b.id] || [];
      if (tb.length) { if (match.some(k => tb.includes(k))) { s += 12; pro.push('Coincide com as bandas dos terminais.'); } else { s -= 30; con.push('Os terminais informados não suportam esta faixa.'); } }
      if (b.ecossistema === 'amplo') s += 6;
      if (b.ecossistema === 'restrito') { s -= 6; con.push('Poucos terminais disponíveis.'); }
      if (S.quer5G) { if (b.tech.includes('NR')) { s += 8; pro.push('Caminho para 5G.'); } else s -= 4; }
      if (b.status === 'restrita') { s -= 45; con.push('Só para outorgas existentes (faixa destinada à TV 3.0).'); }
      if (b.status === 'secundaria') con.push('Baixa potência; verificar estações terrenas de satélite.');
      if (b.id === 'b28g' && !(A < 0.3)) { s -= 20; con.push('Uso pontual, com visada.'); }
      return { band: b, s: Math.max(0, Math.min(100, Math.round(s))), pro, con, r, nCob };
    }).sort((a, b) => b.s - a.s);
    const band = S.faixa === 'auto' ? rank[0].band : TS.bandById(S.faixa);
    const rk = rank.find(x => x.band.id === band.id);
    const eqId = escolherEquip(band, dem, amb), eq = TS.EQUIP[eqId];
    const rf = rfPara(band, eq, amb);
    const r = RF.calcular({ band, amb, rf }); r.band = band;
    const rO = rOmni(band, amb, rf);
    const cap = RF.capacidade(band, rf.bw, eq.tech, dem.dl > 0 && dem.ul / dem.dl > 0.8 ? 'cfg0' : 'cfg1');
    /* Quantidade em small cells (rádios): cobertura com antena omni, capacidade a 70% de ocupação e limite de usuários por small cell */
    const nCob = nCobDe(A, rO);
    const nCap = Math.max(1, Math.ceil(Math.max(dem.ulF / (cap.ul * 0.7), dem.dlF / (cap.dl * 0.7))));
    const nUsr = Math.max(1, Math.ceil(dem.nF / eq.users));
    const nNec = Math.max(nCob, nCap, nUsr), nRec = Math.min(MAX_SC, nNec);
    const driver = nNec === nCob ? 'cobertura' : nNec === nCap ? 'capacidade' : 'usuários';
    const nCel = P.est.reduce((a, e) => a + celulas(e), 0);
    const cv = cobertura(r, band, rf.est.gant, window.innerWidth < 520 ? 76 : 96);
    return { amb, dem, band, rk, rank, eq, eqId, rf, r, rO, cap, nCob, nCap, nUsr, nNec, nRec, driver, nCel, nPts: P.est.length, cv };
  };
  const porQue = () => `Cobertura pede ${R.nCob} (raio de ${dist(R.rO.rFolga)} com antena omni), capacidade pede ${R.nCap} (uplink de ${nf(R.dem.ulF)} Mbps, ${nf(R.cap.ul)} Mbps por small cell) e usuários pedem ${R.nUsr} (${nint(R.dem.nF)} dispositivos, até ${nint(R.eq.users)} por small cell).${R.nNec > MAX_SC ? ` O cenário pede ${R.nNec}: detalhe no planejador completo.` : ''}`;
  const covTxt = () => R.cv.vazio ? 'sem small cells no croqui' : `${nf(R.cv.stats.folga, 0)}% com folga, ${nf(R.cv.stats.limite, 0)}% no limite, ${nf(R.cv.stats.sem, 0)}% sem cobertura`;

  /* Backhaul: distâncias reais small cell → sala técnica */
  const enlaces = () => {
    const P = S.plano; if (!P.core) return null;
    return P.est.map((e, i) => { const d = Math.hypot(e.x - P.core.x, e.y - P.core.y); return { i, d, fr: RF.fresnel(d / 1000, 5.8), radio: d > 150 }; });
  };

  /* Itens para orçamento (somente o que a Telesys fornece) */
  const itens = R => {
    const { eq, eqId, band, r, dem, amb } = R;
    const P = S.plano;
    const nCel = R.nCel || R.nRec, nPts = R.nPts || R.nRec;
    const pq = {
      nova249: 'Banda 28, a mesma das operadoras em 700 MHz: oferta ampla de terminais.',
      nova442i: 'Cobre 2.390 a 2.400 MHz (Banda 40) com antena integrada.',
      nova430i: 'Até 24 dBm por canal, compatível com a baixa potência de 3,7 GHz; antena integrada de 13 dBi.',
      nova436q: 'Antenas externas para setorizar a cobertura externa em 3,7 GHz.',
      aurora243: '5G NR em n77/n78 com os 100 MHz da faixa, para o uplink de câmeras e IA Física.'
    }[eqId] || 'Modelo a confirmar com a Telesys para esta faixa.';
    const L = [];
    L.push({ q: nCel, un: 'small cells', nome: eq.nome, why: [pq, R.nCel ? `${sc(nCel)} no croqui; indicado ${R.nRec} por ${R.driver}.` : `Indicado ${R.nRec} por ${R.driver}.`, r.limitante === 'UL' ? `O limite está no uplink (terminal de ${TS.termById(S.term).ptx} dBm): o raio útil é definido pelo terminal.` : 'O downlink limita: ganho e potência da small cell definem o raio.'], specs: eq.specs });
    if (eq.antena === 'externa') {
      const omni = P.est.length ? P.est.filter(e => e.ant === 'omni').length : R.nRec;
      const setor = P.est.reduce((a, e) => a + (e.ant === 'tri' ? 3 : e.ant === 'setorial' ? 1 : 0), 0);
      if (omni) L.push({ q: omni, un: 'antenas', nome: `Antena omni ${band.curto}`, why: ['Cobertura em 360° a partir de cada small cell.'], specs: [['Ganho de referência', 'até 10 dBi'], ['Abertura', '360°']] });
      if (setor) L.push({ q: setor, un: 'antenas', nome: `Antena setorial ${band.curto}, ±45°`, why: ['Concentra o sinal na direção de interesse; o ganho entra no que sai e na recepção do uplink.'], specs: [['Ganho de referência', `${nf(R.rf.est.gant)} dBi`], ['Abertura', '65°']] });
    }
    const coreLocal = nCel > 2 || dem.lat > 0;
    L.push({ q: 1, un: 'núcleo', nome: coreLocal ? `Core local (${eq.tech === 'NR' ? '5GC' : 'EPC'}) na sala técnica` : 'Core embarcado (HaloB Baicells)', why: [coreLocal ? 'Várias small cells ou dispositivos com latência crítica pedem core dedicado.' : 'Rede pequena: menos equipamentos.'], specs: [] });
    const en = enlaces();
    if (en) {
      const rad = en.filter(x => x.radio);
      if (rad.length) {
        const pmp = rad.length >= 3, bh = pmp ? TS.BACKHAUL.c6x : TS.BACKHAUL.b6x;
        L.push({ q: pmp ? rad.length + 1 : rad.length * 2, un: 'rádios', nome: `Backhaul ${bh.nome} (${pmp ? 'ponto a multiponto' : 'ponto a ponto'})`, why: [pmp ? `${rad.length} pontos convergem para a sala técnica.` : 'Enlace dedicado entre a small cell e a sala técnica.', 'Exige visada e altura para liberar 60% da 1ª zona de Fresnel.'], specs: [...bh.specs, ...rad.map(x => [`Enlace ponto ${x.i + 1}`, `${dist(x.d)} · Fresnel 60% no meio: ${nf(x.fr * 0.6)} m livres`])] });
      }
    } else if (!amb.indoor && nPts > 1) L.push({ q: '?', un: 'a definir', nome: 'Backhaul Mimosa (marque o core na planta)', why: ['Sem a sala técnica marcada, distância e visada ficam para a visita.'], specs: TS.BACKHAUL.b6x.specs });
    L.push({ q: nPts, un: 'kits', nome: 'GPS, proteção contra surto e fonte', why: ['Sincronismo entre small cells e proteção em pontos altos.'], specs: [] });
    L.push({ q: dem.nF, un: 'SIMs', nome: 'SIM / eSIM para os dispositivos', why: [`Terminais precisam suportar ${band.g3pp}.`], specs: [] });
    return L;
  };

  /* ---------- Satélite (Esri World Imagery) ---------- */
  const TILES = new Map();
  let tRedraw;
  const tile = (z, x, y) => {
    const k = `${z}/${x}/${y}`; let t = TILES.get(k);
    if (!t) {
      t = { img: new Image(), ok: false };
      t.img.crossOrigin = 'anonymous';
      t.img.onload = () => { t.ok = true; clearTimeout(tRedraw); tRedraw = setTimeout(() => { if (S.step === 2) telaPlanta(); }, 60); };
      t.img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
      TILES.set(k, t);
    }
    return t;
  };
  const tilesVisiveis = (v) => {
    if (!S.geo) return [];
    const a = ancora(), mpp = 1 / v.k;
    const z = Math.max(3, Math.min(19, Math.ceil(Math.log2(156543.03 * Math.cos(a[0] * Math.PI / 180) / mpp))));
    const c1 = toW(v, 0, 0), c2 = toW(v, v.W, v.H), p1 = ll(c1[0], c1[1]), p2 = ll(c2[0], c2[1]);
    const n = 2 ** z, tx = lng => Math.floor((lng + 180) / 360 * n), ty = lat => Math.floor((1 - RF.mercY(lat) / Math.PI) / 2 * n);
    const out = [];
    for (let x = tx(p1[1]); x <= tx(p2[1]); x++) for (let y = ty(p1[0]); y <= ty(p2[0]); y++) {
      if (out.length > 80) return out;
      const lngA = x / n * 360 - 180, lngB = (x + 1) / n * 360 - 180, latA = RF.invMercY(Math.PI * (1 - 2 * y / n)), latB = RF.invMercY(Math.PI * (1 - 2 * (y + 1) / n));
      out.push({ z, x, y, a: xy(latA, lngA), b: xy(latB, lngB) });
    }
    return out;
  };
  const esperarTiles = (v, ms = 5000) => Promise.race([
    Promise.all(tilesVisiveis(v).map(q => { const t = tile(q.z, q.x, q.y); return t.ok ? 1 : new Promise(res => { t.img.addEventListener('load', res, { once: true }); t.img.addEventListener('error', res, { once: true }); }); })),
    new Promise(res => setTimeout(res, ms))
  ]);

  /* ---------- Desenho da planta ---------- */
  const CORES = { 3: [47, 191, 113], 2: [242, 178, 51], 1: [229, 72, 77] };
  const imgCob = cv => {
    if (!cv || cv.vazio) return null;
    const c = document.createElement('canvas'); c.width = cv.nx; c.height = cv.ny;
    const g = c.getContext('2d'), im = g.createImageData(cv.nx, cv.ny);
    for (let k = 0; k < cv.nx * cv.ny; k++) { const col = CORES[cv.cls[k]]; im.data.set([col[0], col[1], col[2], cv.dentro[k] ? 165 : 45], k * 4); }
    g.putImageData(im, 0, 0); return c;
  };
  const ajustar = (box, W, H, f = 1) => ({ k: Math.min(W / (box.e - box.w), H / (box.n - box.s)) * f, cx: (box.w + box.e) / 2, cy: (box.s + box.n) / 2, W, H });
  const toS = (v, x, y) => [v.W / 2 + (x - v.cx) * v.k, v.H / 2 - (y - v.cy) * v.k];
  const toW = (v, sx, sy) => [v.cx + (sx - v.W / 2) / v.k, v.cy - (sy - v.H / 2) / v.k];
  /* Alças do obstáculo selecionado (tamanho e rotação), em pixels de tela */
  const alcas = (v, o) => {
    const res = toS(v, ...deLocal(o, o.x2, o.y2));
    if (o.forma === 'linha') return { res };
    const c = toS(v, ...cObs(o)), topo = toS(v, ...deLocal(o, (o.x1 + o.x2) / 2, Math.max(o.y1, o.y2)));
    let dx = topo[0] - c[0], dy = topo[1] - c[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    if (L < 2) { dx = 0; dy = -1; }
    return { res, rot: [topo[0] + dx * 26, topo[1] + dy * 26], topo };
  };

  const desenhar = (c, v, o = {}) => {
    const g = c.getContext('2d'), P = S.plano, cv = o.cv, W = v.W, H = v.H, C = corCv();
    g.save(); g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    let sat = false;
    if (S.geo && S.sat && !o.semSat) {
      for (const q of tilesVisiveis(v)) { const t = tile(q.z, q.x, q.y); if (!t.ok) continue; const [x0, y0] = toS(v, ...q.a), [x1, y1] = toS(v, ...q.b); g.drawImage(t.img, x0, y0, x1 - x0 + 0.6, y1 - y0 + 0.6); sat = true; }
      if (sat) { g.fillStyle = escuro() ? 'rgba(8,10,20,.28)' : 'rgba(255,255,255,.12)'; g.fillRect(0, 0, W, H); }
    }
    const alvo = 80 / v.k, base = Math.pow(10, Math.floor(Math.log10(alvo))), passo = [1, 2, 5, 10].map(m => m * base).find(x => x >= alvo) || base;
    if (!sat) {
      const [wx0, wy1] = toW(v, 0, 0), [wx1, wy0] = toW(v, W, H);
      g.strokeStyle = C.grade; g.lineWidth = 1;
      for (let x = Math.ceil(wx0 / passo) * passo; x < wx1; x += passo) { const [sx] = toS(v, x, 0); g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx, H); g.stroke(); }
      for (let y = Math.ceil(wy0 / passo) * passo; y < wy1; y += passo) { const [, sy] = toS(v, 0, y); g.beginPath(); g.moveTo(0, sy); g.lineTo(W, sy); g.stroke(); }
    }
    const im = o.img || imgCob(cv);
    if (cv && im && o.cob !== false) {
      const [x0, y0] = toS(v, cv.box.w, cv.box.n), [x1, y1] = toS(v, cv.box.e, cv.box.s);
      g.globalAlpha = sat ? 0.62 : 1; g.imageSmoothingEnabled = true; g.drawImage(im, x0, y0, x1 - x0, y1 - y0); g.globalAlpha = 1;
    }
    const linha = sat ? '#ffffff' : C.linha;
    if (P.poli.length >= 3) {
      g.beginPath(); P.poli.forEach((p, i) => { const [x, y] = toS(v, ...p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
      if (sat) { g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 4; }
      g.strokeStyle = linha; g.lineWidth = 2.2; g.stroke(); g.shadowBlur = 0;
      if (o.vertices) P.poli.forEach(p => { const [x, y] = toS(v, ...p); g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#1d2340'; g.lineWidth = 1.5; g.stroke(); });
    } else if (o.dica && !(o.traco && o.traco.length)) {
      g.fillStyle = sat ? 'rgba(0,0,0,.55)' : C.caixa; const t = 'Toque nos cantos da área para traçar o contorno';
      g.font = '600 13px IBM Plex Sans, sans-serif'; const tw = g.measureText(t).width; g.fillRect(W / 2 - tw / 2 - 12, H / 2 - 18, tw + 24, 36);
      g.fillStyle = sat ? '#fff' : C.txt; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, W / 2, H / 2);
    }
    if (P.core) {
      const [cx, cy] = toS(v, P.core.x, P.core.y);
      g.setLineDash([7, 5]); g.lineWidth = 2; g.strokeStyle = '#a58cff';
      P.est.forEach(e => { if (Math.hypot(e.x - P.core.x, e.y - P.core.y) > 1) { g.beginPath(); g.moveTo(...toS(v, e.x, e.y)); g.lineTo(cx, cy); g.stroke(); } });
      g.setLineDash([]);
    }
    // obstáculos
    P.obs.forEach((ob, i) => {
      const d = OBS[ob.tipo], sel = o.sel && o.sel.t === 'obs' && o.sel.i === i;
      if (ob.forma === 'linha') {
        const [ax, ay] = toS(v, ob.x1, ob.y1), [bx, by] = toS(v, ob.x2, ob.y2);
        g.strokeStyle = d.cor; g.lineWidth = sel ? 7 : 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        if (sel) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
      } else {
        const pts = cantos(ob).map(p => toS(v, ...p));
        g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(...p) : g.moveTo(...p)); g.closePath();
        g.fillStyle = d.cor + '77'; g.fill();
        g.strokeStyle = sel ? '#fff' : d.cor; g.lineWidth = sel ? 2.5 : 1.5; g.stroke();
        const w = Math.abs(ob.x2 - ob.x1) * v.k, h = Math.abs(ob.y2 - ob.y1) * v.k, [cx, cy] = toS(v, ...cObs(ob));
        if (w > 22 && h > 22) { g.font = `${Math.min(22, Math.min(w, h) * 0.5)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.ic, cx, cy); }
      }
      if (sel && o.alcas) {
        const a = alcas(v, ob);
        if (a.rot) {
          g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(...a.topo); g.lineTo(...a.rot); g.stroke();
          g.beginPath(); g.arc(...a.rot, 11, 0, 7); g.fillStyle = '#4cc9e0'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
          g.fillStyle = '#06222a'; g.font = '700 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⟳', a.rot[0], a.rot[1] + 0.5);
        }
        g.beginPath(); g.arc(...a.res, 10, 0, 7); g.fillStyle = '#e3a42a'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#1b1505'; g.font = '700 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⤡', a.res[0], a.res[1] + 0.5);
      }
    });
    if (o.temp) {
      const t = o.temp;
      g.strokeStyle = linha; g.setLineDash([6, 4]); g.lineWidth = t.forma === 'linha' ? 3 : 1.5;
      if (t.forma === 'linha') { g.beginPath(); g.moveTo(...toS(v, t.x1, t.y1)); g.lineTo(...toS(v, t.x2, t.y2)); g.stroke(); }
      else { const [ax, ay] = toS(v, t.x1, t.y1), [bx, by] = toS(v, t.x2, t.y2); g.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)); }
      g.setLineDash([]);
    }
    if (o.traco && o.traco.length) {
      g.strokeStyle = '#e3a42a'; g.lineWidth = 2.5; g.setLineDash([6, 4]); g.beginPath();
      o.traco.forEach((p, i) => { const [x, y] = toS(v, ...p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.setLineDash([]);
      o.traco.forEach((p, i) => { const [x, y] = toS(v, ...p); g.beginPath(); g.arc(x, y, i ? 5 : 10, 0, 7); g.fillStyle = i ? '#e3a42a' : 'rgba(227,164,42,.4)'; g.fill(); });
    }
    if (P.core) {
      const [x, y] = toS(v, P.core.x, P.core.y);
      g.fillStyle = '#a58cff'; g.beginPath(); if (g.roundRect) g.roundRect(x - 22, y - 10, 44, 20, 5); else g.rect(x - 22, y - 10, 44, 20); g.fill();
      g.fillStyle = '#16102e'; g.font = '700 10px IBM Plex Mono, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CORE', x, y + 0.5);
    }
    // small cells
    P.est.forEach((e, i) => {
      const [x, y] = toS(v, e.x, e.y), sel = o.sel && o.sel.t === 'est' && o.sel.i === i;
      if (e.ant !== 'omni') {
        g.strokeStyle = C.est; g.lineWidth = 2.5;
        (e.ant === 'tri' ? [0, 120, 240] : [0]).forEach(o2 => { const a = (e.az + o2) * Math.PI / 180; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * 24, y - Math.cos(a) * 24); g.stroke(); });
      }
      if (sel) { g.beginPath(); g.arc(x, y, 16, 0, 7); g.strokeStyle = '#e3a42a'; g.lineWidth = 3; g.stroke(); }
      g.beginPath(); g.arc(x, y, 10, 0, 7); g.fillStyle = C.est; g.fill(); g.lineWidth = 3; g.strokeStyle = sat ? '#fff' : C.bg; g.stroke();
      g.fillStyle = C.estTxt; g.font = '700 10px IBM Plex Mono, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(i + 1, x, y + 0.5);
    });
    if (o.sonda) {
      const [x, y] = toS(v, o.sonda.x, o.sonda.y);
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke();
      g.strokeStyle = '#e3a42a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 14, y); g.lineTo(x + 14, y); g.moveTo(x, y - 14); g.lineTo(x, y + 14); g.stroke();
    }
    const px = passo * v.k;
    g.fillStyle = C.caixa; g.fillRect(8, H - 34, px + 16, 26);
    g.fillStyle = C.txt; g.fillRect(16, H - 14, px, 3);
    g.font = '11px IBM Plex Mono, monospace'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(passo >= 1000 ? `${passo / 1000} km` : `${passo} m`, 16, H - 19);
    if (sat) { g.font = '10px IBM Plex Sans, sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)'; g.textAlign = 'right'; g.fillText('Imagens © Esri', W - 8, H - 8); }
    if (o.marca) { g.translate(W / 2, H / 2); g.rotate(-0.32); g.font = '800 64px IBM Plex Sans, sans-serif'; g.fillStyle = 'rgba(255,255,255,.1)'; g.textAlign = 'center'; g.fillText('RASCUNHO', 0, 0); }
    g.restore();
    return sat;
  };

  /* ---------- Editor da planta ---------- */
  const ED = { sel: null, drag: null, traco: [], img: null, view: null, undo: [], ptrs: new Map(), pinca: null, sonda: null, geoRes: null, buscando: false };
  const dims = () => { const c = $('#plano'); const W = c.clientWidth; return [W, Math.round(Math.max(260, Math.min(W * 0.95, window.innerHeight * 0.58, 600)))]; };
  const vistaAtual = () => { const [W, H] = dims(); if (!ED.view) { const f = ajustar(limitesPlano(), W, H); ED.view = { k: f.k, cx: f.cx, cy: f.cy }; } return { k: ED.view.k, cx: ED.view.cx, cy: ED.view.cy, W, H }; };
  let VW = null;
  const telaPlanta = () => {
    const c = $('#plano'); if (!c) return;
    VW = vistaAtual();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(VW.W * dpr) || c.height !== Math.round(VW.H * dpr)) { c.width = Math.round(VW.W * dpr); c.height = Math.round(VW.H * dpr); c.style.height = VW.H + 'px'; }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    desenhar(c, VW, { cv: R.cv, img: ED.img, cob: S.cob, sel: ED.sel, temp: ED.drag && ED.drag.temp, vertices: S.modo === 'contorno' || S.modo === 'navegar', traco: S.modo === 'contorno' ? ED.traco : null, alcas: true, sonda: ED.sonda, dica: S.modo === 'contorno' });
  };
  const zoom = (f, sx, sy) => {
    const v = vistaAtual(); sx = sx ?? v.W / 2; sy = sy ?? v.H / 2;
    const w = toW(v, sx, sy), fit = ajustar(limitesPlano(), v.W, v.H).k;
    const k = Math.max(fit / 12, Math.min(fit * 40, v.k * f));
    ED.view = { k, cx: w[0] - (sx - v.W / 2) / k, cy: w[1] + (sy - v.H / 2) / k };
    telaPlanta();
  };
  const guardar = () => { const s = JSON.stringify(S.plano); if (ED.undo[ED.undo.length - 1] !== s) { ED.undo.push(s); if (ED.undo.length > 40) ED.undo.shift(); } const u = $('[data-act="desfazer"]'); if (u) u.disabled = false; };
  const desfazer = () => { const s = ED.undo.pop(); if (!s) return toast('Nada para desfazer.'); S.plano = JSON.parse(s); S.areaKm2 = S.plano.area; ED.sel = null; ED.sonda = null; render(); };

  const posEv = ev => { const r = $('#plano').getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  const hitEst = (sx, sy) => { for (let i = S.plano.est.length - 1; i >= 0; i--) { const e = S.plano.est[i], [x, y] = toS(VW, e.x, e.y); if (Math.hypot(x - sx, y - sy) < 20) return i; } return -1; };
  const hitVtx = (sx, sy) => S.plano.poli.findIndex(p => { const [x, y] = toS(VW, ...p); return Math.hypot(x - sx, y - sy) < 16; });
  const hitCore = (sx, sy) => { const c = S.plano.core; if (!c) return false; const [x, y] = toS(VW, c.x, c.y); return Math.abs(sx - x) < 26 && Math.abs(sy - y) < 16; };
  const hitAlca = (sx, sy) => {
    if (!ED.sel || ED.sel.t !== 'obs') return null; const o = S.plano.obs[ED.sel.i]; if (!o) return null;
    const a = alcas(VW, o);
    if (a.rot && Math.hypot(a.rot[0] - sx, a.rot[1] - sy) < 18) return 'rot';
    if (Math.hypot(a.res[0] - sx, a.res[1] - sy) < 18) return 'res';
    return null;
  };
  const hitObs = (sx, sy) => {
    const w = toW(VW, sx, sy), tol = 6 / VW.k;
    for (let i = S.plano.obs.length - 1; i >= 0; i--) {
      const o = S.plano.obs[i];
      if (o.forma === 'linha') { const [ax, ay] = toS(VW, o.x1, o.y1), [bx, by] = toS(VW, o.x2, o.y2), L2 = (bx - ax) ** 2 + (by - ay) ** 2, t = Math.max(0, Math.min(1, ((sx - ax) * (bx - ax) + (sy - ay) * (by - ay)) / (L2 || 1))); if (Math.hypot(sx - ax - t * (bx - ax), sy - ay - t * (by - ay)) < 14) return i; }
      else { const [lx, ly] = paraLocal(o, ...w); if (lx >= Math.min(o.x1, o.x2) - tol && lx <= Math.max(o.x1, o.x2) + tol && ly >= Math.min(o.y1, o.y2) - tol && ly <= Math.max(o.y1, o.y2) + tol) return i; }
    }
    return -1;
  };
  const redimensionar = (o, A, p) => {
    const a = (o.ang || 0) * Math.PI / 180, [vx, vy] = rotP(p[0] - A[0], p[1] - A[1], -a);
    if (Math.abs(vx) < 0.5 || Math.abs(vy) < 0.5) return;
    const [hx, hy] = rotP(vx / 2, vy / 2, a), cx = A[0] + hx, cy = A[1] + hy;
    o.x1 = cx - vx / 2; o.x2 = cx + vx / 2; o.y1 = cy - vy / 2; o.y2 = cy + vy / 2;
  };
  let tRec;
  const recalcPlanta = () => { clearTimeout(tRec); tRec = setTimeout(() => { R = calcular(); ED.img = imgCob(R.cv); if (ED.sonda) medir(ED.sonda.x, ED.sonda.y); telaPlanta(); painelPlanta(); atualizarResumo(); atualizarRodapePlanta(); salvar(); }, 60); };
  const medir = (x, y) => { const a = avaliar(R.cv.A, x, y); ED.sonda = { x, y, ...a }; };

  const onDown = ev => {
    const c = $('#plano'); c.setPointerCapture(ev.pointerId);
    const [sx, sy] = posEv(ev);
    ED.ptrs.set(ev.pointerId, [sx, sy]);
    if (ED.ptrs.size === 2) {
      ED.drag = null; ED.press = null;
      const [a, b] = [...ED.ptrs.values()], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      ED.pinca = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]), k0: VW.k, w: toW(VW, ...m) };
      return telaPlanta();
    }
    const w = toW(VW, sx, sy), P = S.plano, m = S.modo;
    const ie = hitEst(sx, sy), io = hitObs(sx, sy), iv = (m === 'contorno' || m === 'navegar') ? hitVtx(sx, sy) : -1;
    ED.press = { sx, sy, w, ie, io, iv };
    if (m === 'apagar') return;
    if (m === 'contorno') { if (iv >= 0 && !ED.traco.length) { guardar(); ED.drag = { t: 'vtx', i: iv, s0: [sx, sy] }; } else ED.drag = { t: 'pan', s0: [sx, sy], v0: Object.assign({}, ED.view), toque: true }; return; }
    const al = hitAlca(sx, sy);
    if (al) { guardar(); const o = P.obs[ED.sel.i]; ED.drag = { t: al, i: ED.sel.i, s0: [sx, sy], o: [o.x2, o.y2], w0: w, A: deLocal(o, o.x1, o.y1) }; return; }
    if (iv >= 0) { guardar(); ED.drag = { t: 'vtx', i: iv, s0: [sx, sy] }; return; }
    if (hitCore(sx, sy)) { guardar(); ED.drag = { t: 'core', s0: [sx, sy], w0: w, o: [P.core.x, P.core.y] }; return; }
    if (ie >= 0) { guardar(); ED.sel = { t: 'est', i: ie }; ED.drag = { t: 'est', i: ie, w0: w, o: [P.est[ie].x, P.est[ie].y], s0: [sx, sy] }; telaPlanta(); painelPlanta(); return; }
    if (io >= 0 && (m === 'navegar' || m === 'obstaculo')) { guardar(); const o = P.obs[io]; ED.sel = { t: 'obs', i: io }; ED.drag = { t: 'obs', i: io, w0: w, o: [o.x1, o.y1, o.x2, o.y2], s0: [sx, sy] }; telaPlanta(); painelPlanta(); return; }
    if (m === 'obstaculo') { const d = OBS[S.obsTipo]; ED.drag = { t: 'novo', w0: w, s0: [sx, sy], temp: { forma: d.forma, x1: w[0], y1: w[1], x2: w[0], y2: w[1] } }; return; }
    ED.drag = { t: 'pan', s0: [sx, sy], v0: Object.assign({}, ED.view) };
  };
  const onMove = ev => {
    if (!ED.ptrs.has(ev.pointerId)) return;
    const [sx, sy] = posEv(ev); ED.ptrs.set(ev.pointerId, [sx, sy]);
    if (ED.pinca && ED.ptrs.size === 2) {
      const [a, b] = [...ED.ptrs.values()], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const fit = ajustar(limitesPlano(), VW.W, VW.H).k, k = Math.max(fit / 12, Math.min(fit * 40, ED.pinca.k0 * d / ED.pinca.d0));
      ED.view = { k, cx: ED.pinca.w[0] - (m[0] - VW.W / 2) / k, cy: ED.pinca.w[1] + (m[1] - VW.H / 2) / k };
      return telaPlanta();
    }
    const D = ED.drag; if (!D) return;
    const P = S.plano;
    D.moveu = D.moveu || Math.hypot(sx - D.s0[0], sy - D.s0[1]) > 8;
    if (!D.moveu) return;
    if (D.t === 'pan') { ED.view = { k: D.v0.k, cx: D.v0.cx - (sx - D.s0[0]) / D.v0.k, cy: D.v0.cy + (sy - D.s0[1]) / D.v0.k }; return telaPlanta(); }
    const w = toW(VW, sx, sy);
    if (D.t === 'est') { P.est[D.i].x = D.o[0] + w[0] - D.w0[0]; P.est[D.i].y = D.o[1] + w[1] - D.w0[1]; }
    else if (D.t === 'obs') { const dx = w[0] - D.w0[0], dy = w[1] - D.w0[1], o = P.obs[D.i]; o.x1 = D.o[0] + dx; o.y1 = D.o[1] + dy; o.x2 = D.o[2] + dx; o.y2 = D.o[3] + dy; }
    else if (D.t === 'res') { const o = P.obs[D.i]; if (o.forma === 'linha') { o.x2 = D.o[0] + w[0] - D.w0[0]; o.y2 = D.o[1] + w[1] - D.w0[1]; } else redimensionar(o, D.A, w); }
    else if (D.t === 'rot') { const o = P.obs[D.i], c = cObs(o), a = Math.atan2(w[1] - c[1], w[0] - c[0]) * 180 / Math.PI - 90; o.ang = ((Math.round(a / 5) * 5) % 360 + 360) % 360; }
    else if (D.t === 'core') { P.core.x = D.o[0] + w[0] - D.w0[0]; P.core.y = D.o[1] + w[1] - D.w0[1]; }
    else if (D.t === 'vtx') P.poli[D.i] = w;
    else if (D.t === 'novo') { D.temp.x2 = w[0]; D.temp.y2 = w[1]; }
    telaPlanta();
    if (D.t === 'rot' || D.t === 'res') painelPlanta();
  };
  const onUp = ev => {
    ED.ptrs.delete(ev.pointerId);
    if (ED.pinca) { if (ED.ptrs.size < 2) ED.pinca = null; ED.press = null; return; }
    const D = ED.drag, Pr = ED.press; ED.drag = null; ED.press = null;
    const P = S.plano, m = S.modo;
    if (D && D.moveu) {
      if (D.t === 'pan') return;
      if (D.t === 'novo') { guardar(); const t = D.temp; P.obs.push({ tipo: S.obsTipo, forma: t.forma, x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2, ang: 0 }); ED.sel = { t: 'obs', i: P.obs.length - 1 }; }
      if (D.t === 'vtx') { P.forma = 'livre'; P.area = S.areaKm2 = areaPoli(P.poli) / 1e6; S.mexeu.area = true; }
      return recalcPlanta();
    }
    if (!Pr) return;
    const w = Pr.w;
    if (m === 'apagar') {
      if (Pr.ie >= 0) { guardar(); P.est.splice(Pr.ie, 1); }
      else if (Pr.io >= 0) { guardar(); P.obs.splice(Pr.io, 1); }
      else if (hitCore(Pr.sx, Pr.sy)) { guardar(); P.core = null; }
      ED.sel = null; return recalcPlanta();
    }
    if (m === 'contorno') {
      if (ED.traco.length >= 3) { const [fx, fy] = toS(VW, ...ED.traco[0]); if (Math.hypot(fx - Pr.sx, fy - Pr.sy) < 22) return fecharTraco(); }
      ED.traco.push(w); if (ED.traco.length === 1 || ED.traco.length === 3) return render(); telaPlanta(); painelPlanta(); return;
    }
    if (D && ['est', 'obs', 'core', 'res', 'rot'].includes(D.t)) { telaPlanta(); painelPlanta(); return; }
    if (m === 'estacao') {
      const amb = TS.ambById(S.amb);
      if (R.nCel >= MAX_SC) return toast(`Limite de ${MAX_SC} small cells na versão rápida.`);
      guardar(); P.est.push({ x: w[0], y: w[1], h: amb.hBS, ant: 'omni', az: 0 });
      ED.sel = { t: 'est', i: P.est.length - 1 }; return recalcPlanta();
    }
    if (m === 'obstaculo') {
      const d = OBS[S.obsTipo], sp = span(); guardar();
      if (d.forma === 'linha') { const L = sp * 0.18; P.obs.push({ tipo: S.obsTipo, forma: 'linha', x1: w[0] - L / 2, y1: w[1], x2: w[0] + L / 2, y2: w[1], ang: 0 }); }
      else { const s = Math.max(sp * 0.08, 4); P.obs.push({ tipo: S.obsTipo, forma: 'ret', x1: w[0] - s / 2, y1: w[1] - s / 2, x2: w[0] + s / 2, y2: w[1] + s / 2, ang: 0 }); }
      ED.sel = { t: 'obs', i: P.obs.length - 1 }; return recalcPlanta();
    }
    if (m === 'core') { guardar(); P.core = { x: w[0], y: w[1] }; toast('Sala técnica marcada: backhaul calculado por small cell.'); return recalcPlanta(); }
    if (m === 'navegar') { ED.sel = null; medir(w[0], w[1]); telaPlanta(); painelPlanta(); }
  };
  const fecharTraco = () => {
    const P = S.plano;
    if (ED.traco.length < 3) return toast('Marque ao menos 3 cantos.');
    guardar(); P.poli = ED.traco.slice(); P.forma = 'livre'; ED.traco = [];
    P.area = S.areaKm2 = areaPoli(P.poli) / 1e6; S.mexeu.area = true;
    toast(`Contorno fechado: ${fmtArea(S.areaKm2)}. Agora toque nos pontos altos para colocar as small cells.`);
    S.modo = 'estacao'; render();
  };

  const painelPlanta = () => {
    const el = $('#selPainel'); if (!el) return;
    const P = S.plano, s = ED.sel, band = R.band;
    if (s && s.t === 'est' && P.est[s.i]) {
      const e = P.est[s.i];
      const en = enlaces(), bh = en && en[s.i] ? `<div class="sp-l"><span>Até o core: ${dist(en[s.i].d)}${en[s.i].radio ? ` · Fresnel 60%: ${nf(en[s.i].fr * 0.6)} m livres no meio` : ' · conexão local, sem rádio de backhaul'}</span></div>` : '';
      el.innerHTML = `<div class="sp-h"><b>📡 Ponto ${s.i + 1} · ${sc(celulas(e))}</b><button type="button" class="del" data-del="est">🗑 Remover</button></div>${bh}
        <div class="adj"><label>Altura <b id="selHtxt">${e.h} m</b></label><input type="range" class="rng" id="selH" min="4" max="60" step="1" value="${e.h}" aria-label="Altura da small cell"></div>
        <div class="seg">${ANT.map(([k, l]) => `<button type="button" class="${e.ant === k ? 'on' : ''}" data-ant="${k}">${l}</button>`).join('')}</div>
        ${e.ant !== 'omni' ? `<div class="adj"><label>Direção <b id="selAztxt">${e.az}°</b></label><input type="range" class="rng" id="selAz" min="0" max="355" step="5" value="${e.az}" aria-label="Direção da antena"></div>` : ''}
        ${e.ant === 'tri' ? '<small class="mut">3 setores no mesmo ponto = 3 small cells.</small>' : ''}`;
      return;
    }
    if (s && s.t === 'obs' && P.obs[s.i]) {
      const o = P.obs[s.i], d = OBS[o.tipo];
      const dim = o.forma === 'linha' ? `${dist(Math.hypot(o.x2 - o.x1, o.y2 - o.y1))} de comprimento` : `${dist(Math.abs(o.x2 - o.x1))} × ${dist(Math.abs(o.y2 - o.y1))}`;
      const perda = d.mod === 'veg' ? `≈ ${nf(TS.weissberger(band.fDL / 1000, Math.min(Math.abs(o.x2 - o.x1), Math.abs(o.y2 - o.y1))), 0)} dB ao atravessar a menor dimensão` : d.mod === 'parede' ? `≈ ${nf(5 + 4 * band.fDL / 1000, 0)} dB por parede atravessada` : `≈ ${d.db} dB ao atravessar`;
      el.innerHTML = `<div class="sp-h"><b>${d.ic} ${d.l}</b><button type="button" class="del" data-del="obs">🗑 Remover</button></div>
        <div class="sp-l"><span>${dim}</span><span>${perda} em ${band.curto}</span></div>
        ${o.forma === 'ret' ? `<div class="adj"><label>Rotação <b id="selRottxt">${o.ang || 0}°</b></label><input type="range" class="rng" id="selRot" min="0" max="175" step="5" value="${(o.ang || 0) % 180}" aria-label="Rotação do obstáculo"></div>` : ''}
        <small class="mut">Arraste para mover. Alça dourada: tamanho${o.forma === 'ret' ? '; alça azul: girar' : ' e direção'}.</small>`;
      return;
    }
    if (S.modo === 'navegar' && ED.sonda) {
      const q = ED.sonda, cl = q.m >= R.r.folgaReq ? ['ok', 'Com folga'] : q.m >= 0 ? ['lim', 'No limite'] : ['sem', 'Sem cobertura'];
      const nsc = R.rf.bw * 1e6 * (R.eq.tech === 'NR' ? 0.98 / 30e3 : 0.9 / 15e3);
      const rsrp = q.prx - 10 * Math.log10(nsc);
      el.innerHTML = `<div class="sp-h"><b class="c-${cl[0]}">📍 ${cl[1]}</b><button type="button" class="lnk" data-act="semSonda">limpar</button></div>
        <div class="sonda"><div><small>Margem</small><b>${sgn(q.m)} dB</b></div><div><small>RSRP estimado</small><b>${q.i >= 0 ? nf(rsrp, 0) + ' dBm' : 'n/d'}</b></div><div><small>Small cell mais forte</small><b>${q.i >= 0 ? `${q.i + 1} · ${dist(q.d)}` : 'nenhuma'}</b></div></div>`;
      return;
    }
    const dicas = {
      estacao: 'Toque em um ponto alto (torre, caixa d\'água, silo, telhado) para colocar uma small cell. Arraste para mover; arraste o fundo para navegar.',
      obstaculo: 'Escolha o tipo e arraste no croqui para desenhar. Um toque cria no tamanho padrão; depois é possível girar.',
      contorno: ED.traco.length ? `${ED.traco.length} canto(s). Toque no primeiro ponto ou em "Fechar" para concluir.` : (P.poli.length >= 3 ? 'Arraste os cantos brancos para ajustar, ou toque fora para traçar um novo contorno.' : (S.geo ? 'Toque nos cantos do terreno sobre a imagem. Arraste para navegar; dois dedos para zoom.' : 'Toque nos cantos da área ou escolha um modelo de contorno.')),
      core: 'Toque onde fica a sala técnica (core e servidor). O backhaul Mimosa é calculado até cada small cell.',
      navegar: 'Arraste o fundo para navegar, mova itens ou toque em um ponto para medir o sinal. Dois dedos para zoom.',
      apagar: 'Toque em uma small cell, obstáculo ou no core para apagar.'
    };
    el.innerHTML = `<small class="mut">${dicas[S.modo]}</small>`;
  };
  const rodapePlanta = () => `<div class="pl-acts">
        <button type="button" class="btn sm" data-act="sugerir">✨ Distribuir ${sc(R.nRec)}</button>
        ${S.plano.obs.length ? `<button type="button" class="btn sm ghost" data-act="limparObs">Limpar obstáculos (${S.plano.obs.length})</button>` : ''}
      </div>
      <p class="pq"><b>${R.nCel ? `${sc(R.nCel)} no croqui · ` : ''}indicado ${R.nRec}.</b> ${porQue()}</p>
      <small class="mut">${S.plano.core ? '' : 'Marque o core para dimensionar o backhaul. '}Obstáculos fazem sombra conforme a faixa; uma small cell sobre um obstáculo (silo, telhado) não é afetada por ele.</small>`;
  const atualizarRodapePlanta = () => { const el = $('#plRod'); if (el) el.innerHTML = rodapePlanta(); const lg = $('#plLeg'); if (lg) lg.innerHTML = legenda(); };
  const legenda = () => R.cv.vazio ? '<span class="mut">Posicione as small cells para ver a predição.</span>' : `<span class="ok"><i></i>${nf(R.cv.stats.folga, 0)}% com folga</span><span class="lim"><i></i>${nf(R.cv.stats.limite, 0)}% no limite</span><span class="sem"><i></i>${nf(R.cv.stats.sem, 0)}% sem cobertura</span>`;

  /* ---------- Busca de local (Brasil) ---------- */
  const buscarLocal = async () => {
    const q = ($('#geoQ')?.value || '').trim(); if (!q) return;
    ED.buscando = true; ED.geoQ = q; render();
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=br&limit=5&addressdetails=1&accept-language=pt-BR&q=${encodeURIComponent(q)}`);
      const j = await r.json();
      ED.geoRes = j.map(x => {
        const a = x.address || {}, cid = a.city || a.town || a.village || a.municipality || a.county || '', uf = (a['ISO3166-2-lvl4'] || '').replace('BR-', '');
        const nome = [x.name && x.name !== cid ? x.name : '', cid, uf].filter(Boolean).join(', ') || x.display_name.split(',').slice(0, 3).join(',');
        return { lat: +x.lat, lng: +x.lon, nome };
      });
      if (!ED.geoRes.length) toast('Nenhum local encontrado no Brasil.');
    } catch (e) { toast('Sem conexão com o serviço de busca.'); ED.geoRes = []; }
    ED.buscando = false; render();
  };
  const definirLocal = g => { S.geo = g; S.sat = true; ED.geoRes = null; ED.view = null; toast(`Local: ${g.nome}. Trace o contorno na planta.`); render(); };

  /* ---------- Telas ---------- */
  const fmtArea = k => k < 1 ? `${nint(k * 1e6)} m² · ${nf(k * 100, k < 0.1 ? 1 : 0)} ha` : `${nf(k, k < 10 ? 1 : 0)} km² · ${nint(k * 100)} ha`;
  const sl2km = v => Math.pow(10, -3 + v / 1000 * 5.3);
  const km2sl = k => Math.round((Math.log10(k) + 3) / 5.3 * 1000);
  const chip = (on, attrs, txt) => `<button type="button" class="ch${on ? ' on' : ''}" ${attrs}>${txt}</button>`;
  let R;

  const cardLocal = () => S.geo
    ? `<section class="l-card row"><div><h2>📍 ${esc(S.geo.nome)}</h2><small class="mut">Imagem de satélite por baixo do croqui · ${S.geo.lat.toFixed(4)}, ${S.geo.lng.toFixed(4)}</small></div><button type="button" class="btn sm ghost" data-act="semLocal">Trocar</button></section>`
    : `<section class="l-card"><h2>Onde fica? <small class="opc">opcional</small></h2><small class="mut">Com o local, o croqui é feito sobre a imagem de satélite.</small>
      <form class="srch-l" data-form="geo"><input id="geoQ" type="search" enterkeyhint="search" placeholder="Cidade, distrito ou endereço no Brasil" value="${esc(ED.geoQ || '')}" autocomplete="off" aria-label="Local no Brasil"><button type="submit" class="btn">${ED.buscando ? '…' : 'Buscar'}</button></form>
      ${ED.geoRes && ED.geoRes.length ? `<div class="geo-res">${ED.geoRes.map((g, i) => `<button type="button" data-geo="${i}">📍 ${esc(g.nome)}</button>`).join('')}</div>` : ''}
      <button type="button" class="btn sm gps" data-act="gps">🎯 Estou no local (usar GPS)</button></section>`;

  const cardArea = () => (S.plano && S.plano.forma === 'livre' && S.plano.poli.length >= 3)
    ? `<section class="l-card row"><div><h2>Área do contorno traçado</h2><div class="big">${fmtArea(S.areaKm2)}</div><small class="mut">Para mudar, edite o contorno na planta.</small></div><button type="button" class="btn sm ghost" data-act="apagarContorno">Apagar contorno</button></section>`
    : `<section class="l-card"><h2>Tamanho da área</h2><small class="mut">${S.geo ? 'Estimativa: ao traçar o contorno real na planta, a área é recalculada.' : 'Estimativa: ao traçar o contorno na planta, a área é recalculada.'}</small>
      <div class="big" id="areaTxt">${fmtArea(S.areaKm2)}</div>
      <input type="range" class="rng" id="areaRng" min="0" max="1000" step="1" value="${km2sl(S.areaKm2)}" aria-label="Tamanho da área">
      <div class="chips sm">${[[0.005, 'Galpão 5 mil m²'], [0.05, 'Planta 5 ha'], [1, '100 ha'], [10, '1 mil ha'], [50, '5 mil ha']].map(([k, l]) => chip(Math.abs(S.areaKm2 - k) / k < 0.02, `data-area="${k}"`, l)).join('')}</div></section>`;

  const passo1 = () => `
    <section class="l-card"><h2>Qual é a operação?</h2>
      <div class="chips">${TS.SETORES.map(s => chip(S.setor === s.id, `data-setor="${s.id}"`, `${SETOR_IC[s.id]} ${s.l.replace(/ \(.*\)/, '')}`)).join('')}</div></section>
    <section class="l-card"><h2>Como é o ambiente?</h2>
      <div class="tiles">${TS.AMBIENTES.map(a => { const [ic, t, d] = AMB_IC[a.id]; return `<button type="button" class="tile${S.amb === a.id ? ' on' : ''}" data-amb="${a.id}"><i>${ic}</i><b>${t}</b><small>${d}</small></button>`; }).join('')}</div></section>
    ${cardLocal()}
    ${cardArea()}
    <section class="l-card row"><div><h2>Pretende migrar para 5G?</h2><small class="mut">Favorece faixas com caminho para NR.</small></div>
      <button type="button" class="sw${S.quer5G ? ' on' : ''}" data-tog="quer5G" aria-pressed="${S.quer5G}" aria-label="Migrar para 5G"><i></i></button></section>`;

  const passo2 = () => {
    const pal = OBS_AMB[S.amb];
    return `
    <section class="l-card pl">
      <div class="pl-h"><div><h2>Croqui da área</h2><small class="mut">${temPoli() ? fmtArea(S.areaKm2) : 'sem contorno'} · ${AMB_IC[S.amb][1]}${S.geo ? ` · ${esc(S.geo.nome)}` : ''}</small></div>
        <div class="pl-sw"><label class="mini-sw"><input type="checkbox" id="chkCob"${S.cob ? ' checked' : ''}><span>Cobertura</span></label>${S.geo ? `<label class="mini-sw"><input type="checkbox" id="chkSat"${S.sat ? ' checked' : ''}><span>Satélite</span></label>` : ''}</div></div>
      <div class="tools-l">${FERR.map(([k, ic, l]) => `<button type="button" class="${S.modo === k ? 'on' : ''}" data-modo="${k}"><i>${ic}</i><span>${l}</span></button>`).join('')}</div>
      ${S.modo === 'obstaculo' ? `<div class="chips scroll">${pal.map(k => chip(S.obsTipo === k, `data-obs="${k}"`, `${OBS[k].ic} ${OBS[k].l} <em>${nf(perdaTipica(k, R.band), 0)} dB</em>`)).join('')}</div>` : ''}
      ${S.modo === 'contorno' ? `<div class="chips scroll">${ED.traco.length ? chip(false, 'data-act="fechar"', '✓ Fechar') + chip(false, 'data-act="cancelar"', '✕ Cancelar') : TEMPL_L.map(([k, l]) => chip(S.plano.forma === k, `data-templ="${k}"`, l)).join('')}</div>` : ''}
      <div class="cv-wrap"><canvas id="plano" class="plano" aria-label="Croqui da área"></canvas>
        <div class="cv-ov"><button type="button" data-act="zoomMais" aria-label="Aproximar">+</button><button type="button" data-act="zoomMenos" aria-label="Afastar">−</button><button type="button" data-act="enquadrar" aria-label="Enquadrar">⤢</button></div>
        <button type="button" class="cv-undo" data-act="desfazer"${ED.undo.length ? '' : ' disabled'}>↶ Desfazer</button></div>
      <div class="leg3" id="plLeg">${legenda()}</div>
      <div class="sel-p" id="selPainel"></div>
    </section>
    <section class="l-card" id="plRod">${rodapePlanta()}</section>`;
  };

  const passo3 = () => {
    const d = R.dem;
    return `
    <section class="l-card"><h2>O que vai se conectar?</h2><small class="mut">Toque em + e − para ajustar. Valores típicos de tráfego já incluídos.</small>
      <div class="devs">${Object.keys(DEV_CURTO).map(id => { const t = TS.devById(id), q = S.devs[id] || 0; return `<div class="dev${q ? ' on' : ''}"><i>${t.ic}</i><b>${DEV_CURTO[id]}</b>
        <div class="stp"><button type="button" data-dev="${id}" data-d="-1" aria-label="menos ${DEV_CURTO[id]}">−</button><span>${q}</span><button type="button" data-dev="${id}" data-d="1" aria-label="mais ${DEV_CURTO[id]}">+</button></div></div>`; }).join('')}</div>
      <div class="sum"><div><b>${nint(d.n)}</b><small>dispositivos</small></div><div><b>${nf(d.ulF)}</b><small>Mbps uplink*</small></div><div><b>${nf(d.dlF)}</b><small>Mbps downlink*</small></div></div>
      ${d.up ? '<div class="tip">Câmeras enviam mais do que recebem: o uplink tende a definir a capacidade.</div>' : ''}
      <small class="mut">* com crescimento previsto</small></section>
    <section class="l-card"><h2>Crescimento em 3 anos</h2><div class="seg">${[0, 30, 50, 100].map(v => `<button type="button" class="${S.cresc === v ? 'on' : ''}" data-cresc="${v}">${v ? '+' + v + '%' : 'nenhum'}</button>`).join('')}</div></section>
    <section class="l-card"><h2>Bandas que os terminais suportam</h2><small class="mut">A faixa do projeto precisa coincidir com elas.</small>
      <div class="chips">${chip(!S.bandas.length, 'data-band="nao"', 'Não sei')}${TERM_CH.map(([k, l]) => chip(S.bandas.includes(k), `data-band="${k}"`, l)).join('')}</div></section>
    <section class="l-card"><h2>Terminal de referência</h2><small class="mut">O pior caso do uplink.</small>
      <div class="seg wrap">${Object.entries(TERM_IC).map(([k, l]) => `<button type="button" class="${S.term === k ? 'on' : ''}" data-term="${k}">${l}</button>`).join('')}</div></section>`;
  };

  const passo4 = () => {
    const { band, rk, r, cv, rank } = R;
    const lim = r.limitante === 'UL', amb = R.amb;
    return `
    <section class="l-card hero"><div class="hero-t"><div><small>${S.faixa === 'auto' ? 'Faixa recomendada' : 'Faixa escolhida'}</small><h2>${band.curto} <span>${band.g3pp}</span></h2></div><div class="sc"><b>${rk.s}</b><small>aderência ao cenário</small></div></div>
      <p class="mut">${band.perfil}</p>
      <ul class="why">${rk.pro.slice(0, 3).map(t => `<li>${esc(t)}</li>`).join('')}${rk.con.slice(0, 2).map(t => `<li class="c">${esc(t)}</li>`).join('')}</ul>
      <div class="chips scroll">${chip(S.faixa === 'auto', 'data-faixa="auto"', 'Automática')}${rank.map(x => chip(S.faixa === x.band.id, `data-faixa="${x.band.id}"`, `${x.band.curto} <em>${x.s}</em>`)).join('')}</div></section>
    <section class="l-card vis">
      <div class="vis-h"><h2>Vista 3D</h2><button type="button" class="btn sm" data-go="2">✏️ Editar croqui</button></div>
      ${cv.vazio ? `<div class="vazio"><p>Nenhuma small cell no croqui.</p><button type="button" class="btn pri" data-act="sugerir">✨ Distribuir ${sc(R.nRec)}</button></div>` : `<div class="vis-box"><div id="l3d"></div></div>
      <div class="leg3">${legenda()}</div>
      <small class="mut">Altura da superfície = margem de sinal. ${S.plano.obs.length} obstáculo(s)${S.plano.core ? ', backhaul com zona de Fresnel' : ''}. Sem relevo do terreno.</small>`}</section>
    <section class="kpis">
      <div><small>Raio com folga</small><b>${dist(r.rFolga)}</b></div>
      <div><small>Small cells</small><b>${R.nCel || 0}</b><em>indicado ${R.nRec}</em></div>
      <div><small>Limita</small><b class="${lim ? 'ul' : 'dl'}">${lim ? 'Uplink' : 'Downlink'}</b></div>
      <div><small>Equipamento</small><b class="t">${esc(R.eq.nome.replace(/ \(.*\)/, ''))}</b></div></section>
    <p class="pq solta">${porQue()}</p>
    <section class="l-card"><h2>Link budget</h2>
      <div class="lb4">
        <div class="h"><span></span><span>DL</span><span>UL</span></div>
        <div><span><i>1</i>O que sai</span><b>${nf(r.DL.sai, 0)} dBm</b><b>${nf(r.UL.sai, 0)} dBm</b></div>
        <div><span><i>2</i>O que se perde <small>até ${dist(r.rFolga)}, sem obstáculos</small></span><b>${nf(r.plDL(r.rFolga || 1000) + r.DL.obst, 0)} dB</b><b>${nf(r.plUL(r.rFolga || 1000) + r.UL.obst, 0)} dB</b></div>
        <div><span><i>3</i>O que precisa chegar</span><b>${nf(r.DL.sens, 0)} dBm</b><b>${nf(r.UL.sens, 0)} dBm</b></div>
        <div><span><i>4</i>A folga <small>${nf(r.folgaReq, 1)} dB exigidos</small></span><b>${dist(r.DL.rFolga)}</b><b>${dist(r.UL.rFolga)}</b></div>
      </div>
      ${lim ? `<div class="tip">O terminal recebe bem a small cell, mas responde com menos folga (${TS.termById(S.term).ptx} dBm contra ${nf(R.rf.est.ptx, 0)} dBm da small cell).</div>` : ''}
      <details><summary>Ver margem por distância</summary><div id="lCurva"></div></details></section>
    <section class="l-card"><details><summary><b>Ajustar cenário</b> <small class="mut">confiabilidade e terminais</small></summary>
      <div class="adj"><label>Confiabilidade na borda</label><div class="seg">${[75, 90, 95].map(v => `<button type="button" class="${S.conf === v ? 'on' : ''}" data-conf="${v}">${v}%</button>`).join('')}</div></div>
      <div class="adj"><label>Onde ficam os terminais</label><div class="chips">${chip(S.glob.cabine, 'data-glob="cabine"', '🚜 Dentro de cabine ou veículo')}${amb.indoor ? '' : chip(S.glob.interno, 'data-glob="interno"', '🏠 Dentro de construções')}</div></div>
    </details></section>`;
  };

  const contatoTelesys = () => {
    const em = TS.CONFIG.emailTelesys, wa = TS.CONFIG.whatsTelesys, wat = TS.CONFIG.whatsTelesysTxt || wa;
    if (!em && !wa) return '';
    return `<div class="ctt"><b>Telesys Brasil · comercial</b>${wa ? `<a href="https://wa.me/${wa}" target="_blank" rel="noopener">💬 ${esc(wat)}</a>` : ''}${em ? `<a href="mailto:${esc(em)}">✉️ ${esc(em)}</a>` : ''}</div>`;
  };

  const passo5 = () => {
    const L = itens(R);
    return `
    <section class="l-card"><h2>Itens para orçamento</h2><small class="mut">Especificações de referência, sem preços. Toque para ver detalhes.</small>
      <div class="its">${L.map(i => `<details class="it"><summary><b class="q">${esc(i.q)}</b><div><b>${esc(i.nome)}</b><small>${esc(i.why[0])}</small></div></summary>
        ${i.why.length > 1 ? `<p>${esc(i.why.slice(1).join(' '))}</p>` : ''}${i.specs.length ? `<table>${i.specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}</details>`).join('')}</div></section>
    <section class="l-card"><h2>Seus dados</h2>
      <label class="in"><span>Empresa integradora</span><input data-c="empresa" value="${esc(S.contato.empresa)}" autocomplete="organization"></label>
      <label class="in"><span>Projeto ou cliente final</span><input data-c="projeto" value="${esc(S.contato.projeto)}"></label>
      <div class="in2"><label class="in"><span>E-mail</span><input data-c="email" type="email" inputmode="email" value="${esc(S.contato.email)}" autocomplete="email"></label>
      <label class="in"><span>WhatsApp</span><input data-c="fone" type="tel" inputmode="tel" value="${esc(S.contato.fone)}" autocomplete="tel" placeholder="(11) 9…"></label></div></section>
    <section class="acts">
      <button type="button" class="btn pri" data-act="pdf">📄 Gerar PDF do rascunho</button>
      <button type="button" class="btn wa" data-act="whats">💬 Enviar à Telesys pelo WhatsApp</button>
      <button type="button" class="btn" data-act="email">✉️ E-mail</button>
      <button type="button" class="btn" data-act="copiar">📋 Copiar resumo</button>
      <button type="button" class="btn" data-act="salvarProj">💾 Salvar projeto</button>
      <button type="button" class="btn" data-act="full">🧭 Planejador completo</button>
    </section>
    ${contatoTelesys()}
    <p class="aviso">Rascunho para pedir orçamento à Telesys. Não é proposta e não estabelece compromisso técnico ou comercial. Valores de modelos de referência e datasheets, a validar na visita técnica.</p>`;
  };

  const atualizarResumo = () => { $('#resumo').textContent = `${R.band.curto} · ${R.nCel ? sc(R.nCel) : 'sem small cells'}${R.cv.vazio ? '' : ` · ${nf(R.cv.stats.folga, 0)}% com folga`}`; };
  const render = rolar => {
    R = calcular(); ED.img = imgCob(R.cv);
    if (S.step !== 2) { ED.sel = null; ED.traco = []; ED.sonda = null; }
    else {
      if (!temPoli() && !S.plano.est.length && !ED.traco.length) S.modo = 'contorno';
      if (ED.sonda) medir(ED.sonda.x, ED.sonda.y);
    }
    const box0 = $('#lbox3d'); if (box0 && box0.parentElement.id !== 'parque') $('#parque').appendChild(box0);
    $('#prog').innerHTML = PASSOS.map((p, i) => `<button type="button" class="${i + 1 === S.step ? 'on' : i + 1 < S.step ? 'ok' : ''}" data-go="${i + 1}"${i + 1 === S.step ? ' aria-current="step"' : ''}><span>${p}</span></button>`).join('');
    $('#corpo').innerHTML = [passo1, passo2, passo3, passo4, passo5][S.step - 1]();
    $('#voltar').style.visibility = S.step > 1 ? 'visible' : 'hidden';
    $('#avancar').style.display = S.step < 5 ? '' : 'none';
    $('#avancar').textContent = ['Desenhar croqui', 'Dispositivos', 'Ver resultado', 'Montar orçamento'][S.step - 1] + ' →';
    $('#temaBtn').textContent = `Tema: ${TEMAS[S.tema]}`;
    atualizarResumo();
    TS.View3D.setAtivo(S.step === 4 && !R.cv.vazio);
    if (S.step === 2) {
      telaPlanta(); painelPlanta();
      const c = $('#plano');
      c.addEventListener('pointerdown', onDown); c.addEventListener('pointermove', onMove); c.addEventListener('pointerup', onUp); c.addEventListener('pointercancel', onUp);
      c.addEventListener('wheel', ev => { ev.preventDefault(); const [sx, sy] = posEv(ev); zoom(ev.deltaY < 0 ? 1.2 : 1 / 1.2, sx, sy); }, { passive: false });
    }
    if (S.step === 4) {
      if (!R.cv.vazio) { const box = $('#lbox3d'); $('#l3d').appendChild(box); }
      setTimeout(() => {
        if (!R.cv.vazio) { const g = geo3d(); TS.View3D.construir(g.st, R.r, g.cv); }
        const r = R.r, mx = Math.max(r.rLimite * 1.4, 300), ps = mx / 100;
        const sr = [['Downlink', '#4cc9e0', 'DL'], ['Uplink', escuro() ? '#f4efe6' : '#2b2f4e', 'UL']].map(([nome, cor, d]) => {
          const fn = x => RF.margem(r, d, x); const pts = []; for (let x = ps; x <= mx; x += ps) pts.push([x / 1000, fn(x)]);
          return { nome, cor, fn, pts, rFolga: r[d].rFolga };
        });
        const h = $('#lCurva'); if (h) { const det = h.closest('details'); det.addEventListener('toggle', () => det.open && TS.Charts.margem(h, { series: sr, req: r.folgaReq, xmax: mx / 1000 })); }
      }, 0);
    }
    if (rolar) window.scrollTo({ top: 0, behavior: 'smooth' });
    salvar();
  };

  /* Planta em coordenadas geográficas (reais quando há local) para a vista 3D e o planejador completo */
  const zonasGeo = () => S.plano.obs.map(o => {
    const d = OBS[o.tipo];
    if (o.forma === 'linha') return { forma: 'linha', a: ll(o.x1, o.y1), b: ll(o.x2, o.y2), cor: d.cor, alt: d.alt };
    const C = ll(...cObs(o));
    return { forma: 'ret', lat: C[0], lng: C[1], w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1), ang: o.ang || 0, cor: d.cor, alt: d.alt };
  });
  const geo3d = () => {
    const P = S.plano, cv = R.cv, a = ll(cv.box.w, cv.box.s), b = ll(cv.box.e, cv.box.n);
    const core = P.core ? (() => { const q = ll(P.core.x, P.core.y); return { lat: q[0], lng: q[1] }; })() : null;
    return {
      st: { area: { poligono: P.poli.map(p => ll(...p)), estacoes: P.est.map((e, i) => { const q = ll(e.x, e.y); return { nome: String(i + 1), lat: q[0], lng: q[1], h: e.h }; }), zonas: zonasGeo(), core } },
      cv: { nx: cv.nx, ny: cv.ny, bb: { s: a[0], w: a[1], n: b[0], e: b[1] }, margem: cv.margem, cls: cv.cls, dentro: cv.dentro, stats: cv.stats }
    };
  };

  /* ---------- Saídas ---------- */
  const contObs = () => { const c = {}; S.plano.obs.forEach(o => { c[o.tipo] = (c[o.tipo] || 0) + 1; }); return c; };
  const resumo = () => {
    const r = R.r, d = R.dem, l = [];
    l.push('SOLICITAÇÃO DE ORÇAMENTO · RASCUNHO (versão rápida)');
    l.push('Documento preliminar, sem valor de proposta.');
    l.push('');
    if (S.contato.projeto) l.push(`Projeto: ${S.contato.projeto}`);
    if (S.contato.empresa) l.push(`Integrador: ${[S.contato.empresa, S.contato.email, S.contato.fone].filter(Boolean).join(' · ')}`);
    if (S.geo) l.push(`Local: ${S.geo.nome} (${S.geo.lat.toFixed(5)}, ${S.geo.lng.toFixed(5)})`);
    l.push(`Cenário: ${TS.SETORES.find(s => s.id === S.setor).l} · ${R.amb.l} · ${fmtArea(S.areaKm2)}`);
    const co = contObs(); if (Object.keys(co).length) l.push(`Obstáculos no croqui: ${Object.entries(co).map(([k, n]) => `${n} ${OBS[k].l.toLowerCase()}`).join(', ')}`);
    l.push(`Dispositivos: ${nint(d.n)} hoje, ${nint(d.nF)} previstos · UL ${nf(d.ulF)} Mbps · DL ${nf(d.dlF)} Mbps`);
    l.push(`Faixa: ${R.band.nome} (${R.band.faixa})`);
    l.push(`Raio com folga ${dist(r.rFolga)}, limitado pelo ${r.limitante === 'UL' ? 'uplink' : 'downlink'} · ${R.nCel} small cell(s) no croqui, ${R.nRec} indicadas por ${R.driver}`);
    l.push(`Predição no croqui: ${covTxt()}`);
    l.push(''); l.push('Itens:');
    itens(R).forEach(i => l.push(`- ${i.q} ${i.un} · ${i.nome}`));
    l.push(''); l.push('A validar na visita técnica: contorno real, pontos altos, obstáculos, infraestrutura e vizinhança de espectro.');
    return l.join('\n');
  };

  const imagemCroqui = async () => {
    const W = 900, box = limitesPlano(), bw = box.e - box.w, bh = box.n - box.s, H = Math.round(Math.min(900, Math.max(420, W * bh / bw)));
    const v = ajustar(box, W, H), c = document.createElement('canvas'); c.width = W; c.height = H;
    if (S.geo && S.sat) await esperarTiles(v);
    desenhar(c, v, { cv: R.cv, cob: true, marca: true });
    try { return c.toDataURL('image/png'); }
    catch (e) { desenhar(c, v, { cv: R.cv, cob: true, marca: true, semSat: true }); try { return c.toDataURL('image/png'); } catch (e2) { return ''; } }
  };

  const folha = async () => {
    const r = R.r, d = R.dem, L = itens(R), co = contObs();
    const img = await imagemCroqui();
    const dt = new Date().toLocaleDateString('pt-BR');
    const em = TS.CONFIG.emailTelesys, wat = TS.CONFIG.whatsTelesysTxt;
    $('#folha').innerHTML = `<div class="f-mark">RASCUNHO</div>
      <header><div><img src="assets/img/telesys-logo.png" alt="Telesys" class="f-logo"><h1>Solicitação de orçamento</h1><p>${esc(S.contato.projeto || 'Projeto a definir')} · ${esc(S.contato.empresa || 'Integrador a definir')} · ${dt}</p></div><div class="f-stamp">RASCUNHO</div></header>
      <div class="f-aviso">Documento preliminar para pedir orçamento. Não é proposta nem compromisso técnico ou comercial. Sem preços.</div>
      <h2>Cenário</h2><table>
        <tr><th>Operação</th><td>${esc(TS.SETORES.find(s => s.id === S.setor).l)}</td></tr><tr><th>Ambiente</th><td>${esc(R.amb.l)}</td></tr>
        ${S.geo ? `<tr><th>Local</th><td>${esc(S.geo.nome)} · ${S.geo.lat.toFixed(5)}, ${S.geo.lng.toFixed(5)}</td></tr>` : ''}
        <tr><th>Área</th><td>${fmtArea(S.areaKm2)}${temPoli() ? '' : ' (estimativa, sem contorno traçado)'}</td></tr>
        <tr><th>Obstáculos marcados</th><td>${Object.keys(co).length ? Object.entries(co).map(([k, n]) => `${n} × ${OBS[k].l.toLowerCase()} (≈ ${nf(perdaTipica(k, R.band), 0)} dB)`).join(', ') : 'nenhum'}</td></tr>
        <tr><th>Dispositivos</th><td>${Object.keys(S.devs).filter(k => S.devs[k]).map(k => `${S.devs[k]} ${DEV_CURTO[k].toLowerCase()}`).join(', ')} · ${nint(d.nF)} previstos com crescimento</td></tr>
        <tr><th>Tráfego agregado</th><td>UL ${nf(d.ulF)} Mbps · DL ${nf(d.dlF)} Mbps</td></tr>
        <tr><th>Integrador</th><td>${esc([S.contato.empresa, S.contato.email, S.contato.fone].filter(Boolean).join(' · ') || 'a informar')}</td></tr></table>
      <h2>Faixa: ${esc(R.band.nome)}</h2><p>${esc(R.band.faixa)} · ${esc(R.band.g3pp)}</p><ul>${R.rk.pro.slice(0, 3).concat(R.band.notas).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <h2>Link budget</h2><table><tr><th></th><th>Downlink</th><th>Uplink</th></tr>
        <tr><th>1 · O que sai</th><td>${nf(r.DL.sai)} dBm</td><td>${nf(r.UL.sai)} dBm</td></tr>
        <tr><th>3 · O que precisa chegar</th><td>${nf(r.DL.sens)} dBm</td><td>${nf(r.UL.sens)} dBm</td></tr>
        <tr><th>4 · Raio com folga (${nf(r.folgaReq)} dB)</th><td>${dist(r.DL.rFolga)}</td><td>${dist(r.UL.rFolga)}</td></tr></table>
      <p>Limita: <b>${r.limitante === 'UL' ? 'uplink' : 'downlink'}</b> · ${sc(R.nCel)} no croqui, ${R.nRec} indicadas. ${esc(porQue())}</p>
      ${img ? `<div class="f-img"><img src="${img}" alt="Croqui com predição"><div class="f-leg">Croqui com predição: ${covTxt()}. Small cells numeradas; obstáculos fazem sombra conforme a faixa. Sem relevo.</div></div>` : ''}
      <h2>Itens para orçamento</h2><table><tr><th>Qtd.</th><th>Item</th><th>Por que</th></tr>${L.map(i => `<tr><td>${esc(i.q)}</td><td><b>${esc(i.nome)}</b>${i.specs.length ? `<br><small>${i.specs.slice(0, 6).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(' · ')}</small>` : ''}</td><td>${esc(i.why.join(' '))}</td></tr>`).join('')}</table>
      <h2>A validar na visita técnica</h2><ul><li>Contorno real da área, pontos altos e obstáculos confirmados em campo.</li><li>Bandas dos terminais, infraestrutura (energia, sala do core) e vizinhança de espectro.</li><li>Titularidade da autorização e onde os dados precisam ficar.</li></ul>
      ${em || wat ? `<p class="f-ctt"><b>Telesys Brasil · comercial:</b> ${[wat, em].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
      <footer>Rascunho gerado na versão rápida da ferramenta de link budget · ${dt} · sem valor de proposta</footer>`;
  };

  const abrirCompleto = () => {
    try { if (localStorage.getItem(KFULL) && !confirm('Substituir o projeto salvo no planejador completo por este cenário?')) return; } catch (e) { /* ignora */ }
    const amb = TS.ambById(S.amb), t = TS.termById(S.term), P = S.plano, real = !!S.geo;
    const zonas = real ? P.obs.map((o, i) => {
      const d = OBS[o.tipo], c = ll(...cObs(o));
      const raio = o.forma === 'linha' ? Math.hypot(o.x2 - o.x1, o.y2 - o.y1) / 2 : Math.sqrt(Math.abs((o.x2 - o.x1) * (o.y2 - o.y1)) / Math.PI);
      return { id: 'z' + i, tipo: d.z, lat: c[0], lng: c[1], raio: Math.max(5, Math.round(raio)), prof: Math.round(Math.min(Math.abs(o.x2 - o.x1), Math.abs(o.y2 - o.y1)) || 30), db: d.db || 10, paredes: o.forma === 'linha' ? 1 : 2 };
    }) : [];
    const full = {
      meta: { app: 'telesys-linkbudget', versao: 1, rev: 1, criado: new Date().toISOString(), atualizado: new Date().toISOString(), id: Math.random().toString(36).slice(2, 8).toUpperCase() },
      projeto: { nome: S.contato.projeto, setor: S.setor, local: S.geo ? S.geo.nome : '', obs: !real && Object.keys(contObs()).length ? `Croqui da versão rápida com: ${Object.entries(contObs()).map(([k, n]) => `${n} ${OBS[k].l.toLowerCase()}`).join(', ')}.` : '' },
      integrador: { empresa: S.contato.empresa, email: S.contato.email, fone: S.contato.fone },
      area: real ? {
        ambiente: S.amb, poligono: P.poli.map(p => ll(...p)),
        estacoes: P.est.map((e, i) => { const q = ll(e.x, e.y); return { id: 'e' + i, nome: 'SC' + (i + 1), lat: q[0], lng: q[1], h: e.h, antena: e.ant, az: e.az || 0 }; }),
        zonas, core: P.core ? (() => { const q = ll(P.core.x, P.core.y); return { lat: q[0], lng: q[1] }; })() : null
      } : { ambiente: S.amb, poligono: [], estacoes: [], zonas: [], core: null },
      dispositivos: Object.keys(S.devs).filter(k => S.devs[k]).map(k => { const d = TS.devById(k); return { tipo: k, qtd: S.devs[k], ativ: ATIV[k] ?? 100, ul: d.ul, dl: d.dl, mov: d.mov, lat: d.lat }; }),
      terminais: { bandas: S.bandas.slice(), ref: S.term, cresc: S.cresc, anos: 3, quer5G: S.quer5G },
      faixa: { auto: S.faixa === 'auto', sel: R.band.id, aplicada: null, equipAuto: true, equipAplicado: null, bw: R.band.bw, tdd: 'auto' },
      rf: { hBS: hMedia(amb), hUT: amb.indoor ? 1.5 : t.h, conf: S.conf, obst: { cabine: S.glob.cabine ? 6 : 0, concreto: S.glob.interno ? 1 : 0 }, term: { ptx: t.ptx, g: t.g, nf: 9, sinr: -1, sensAuto: true } },
      ui: { view: 'mapa', visitados: {} }
    };
    try { localStorage.setItem(KFULL, JSON.stringify(full)); } catch (e) { /* ignora */ }
    location.href = 'index.html#mapa';
  };

  const baixar = (txt, nome) => { const u = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); const a = document.createElement('a'); a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); };
  const nomeArq = () => `telesys-rascunho-${(S.contato.projeto || 'projeto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}.json`;

  let tT;
  const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tT); tT = setTimeout(() => t.classList.remove('on'), 3400); };

  /* ---------- Eventos ---------- */
  const mudou = () => render();
  document.addEventListener('submit', ev => { if (ev.target.dataset.form === 'geo') { ev.preventDefault(); buscarLocal(); } });
  document.addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b || b.type === 'submit') return;
    const ds = b.dataset;
    if (ds.go) { S.step = +ds.go; return render(true); }
    if (b.id === 'avancar') { S.step = Math.min(5, S.step + 1); return render(true); }
    if (b.id === 'voltar') { S.step = Math.max(1, S.step - 1); return render(true); }
    if (b.id === 'temaBtn') { S.tema = { auto: 'claro', claro: 'escuro', escuro: 'auto' }[S.tema]; aplicarTema(); return render(); }
    if (ds.setor) {
      S.setor = ds.setor; const p = PRESET[ds.setor];
      if (!S.mexeu.amb) S.amb = p.amb;
      if (!S.mexeu.area && !temPoliLivre()) S.areaKm2 = p.area;
      if (!S.mexeu.devs) S.devs = Object.assign({}, p.devs);
      return mudou();
    }
    if (ds.amb) { S.amb = ds.amb; S.mexeu.amb = true; if (TS.ambById(ds.amb).indoor && S.term === 'maquina') S.term = 'modulo'; return mudou(); }
    if (ds.area) { S.areaKm2 = +ds.area; S.mexeu.area = true; return mudou(); }
    if (ds.geo != null) return definirLocal(ED.geoRes[+ds.geo]);
    if (ds.tog) { S[ds.tog] = !S[ds.tog]; return mudou(); }
    if (ds.dev) { const q = S.devs[ds.dev] || 0, st = q >= 100 ? 10 : q >= 20 ? 5 : 1; S.devs[ds.dev] = Math.max(0, q + (+ds.d) * st); S.mexeu.devs = true; return mudou(); }
    if (ds.cresc) { S.cresc = +ds.cresc; return mudou(); }
    if (ds.band) { if (ds.band === 'nao') S.bandas = []; else { const i = S.bandas.indexOf(ds.band); i >= 0 ? S.bandas.splice(i, 1) : S.bandas.push(ds.band); } return mudou(); }
    if (ds.term) { S.term = ds.term; return mudou(); }
    if (ds.faixa) { S.faixa = ds.faixa; return mudou(); }
    if (ds.conf) { S.conf = +ds.conf; return mudou(); }
    if (ds.glob) { S.glob[ds.glob] = !S.glob[ds.glob]; return mudou(); }
    if (ds.modo) { S.modo = ds.modo; ED.sel = null; ED.sonda = null; if (ds.modo !== 'contorno') ED.traco = []; return mudou(); }
    if (ds.obs) { S.obsTipo = ds.obs; return mudou(); }
    if (ds.templ) { guardar(); const P = S.plano; P.poli = escalar(TEMPL[ds.templ], S.areaKm2 * 1e6, centroVista()); P.forma = ds.templ; P.area = S.areaKm2; ED.traco = []; return mudou(); }
    if (ds.ant) { guardar(); const e = S.plano.est[ED.sel.i]; e.ant = ds.ant; recalcPlanta(); return; }
    if (ds.del) { guardar(); const P = S.plano; if (ds.del === 'est') P.est.splice(ED.sel.i, 1); else P.obs.splice(ED.sel.i, 1); ED.sel = null; return render(); }
    const a = ds.act;
    if (a === 'fechar') return fecharTraco();
    if (a === 'cancelar') { ED.traco = []; return render(); }
    if (a === 'sugerir') {
      if (S.plano.est.length && !confirm(`Substituir as ${S.plano.est.length} small cells do croqui por ${R.nRec} distribuídas automaticamente?`)) return;
      guardar(); distribuir(R.nRec); ED.sel = null;
      toast(temPoli() ? 'Small cells distribuídas. Arraste cada uma para o ponto alto real.' : 'Distribuídas sobre uma área estimada. Trace o contorno para posicionar melhor.');
      return render();
    }
    if (a === 'apagarContorno') { if (confirm('Apagar o contorno traçado?')) { guardar(); S.plano.poli = []; S.plano.forma = 'vazio'; render(); } return; }
    if (a === 'limparObs') { if (confirm('Remover todos os obstáculos do croqui?')) { guardar(); S.plano.obs = []; ED.sel = null; render(); } return; }
    if (a === 'desfazer') return desfazer();
    if (a === 'zoomMais') return zoom(1.4);
    if (a === 'zoomMenos') return zoom(1 / 1.4);
    if (a === 'enquadrar') { ED.view = null; return telaPlanta(); }
    if (a === 'semSonda') { ED.sonda = null; telaPlanta(); return painelPlanta(); }
    if (a === 'semLocal') { S.geo = null; ED.view = null; return render(); }
    if (a === 'gps') {
      if (!navigator.geolocation) return toast('GPS indisponível neste navegador.');
      toast('Obtendo localização…');
      navigator.geolocation.getCurrentPosition(p => definirLocal({ lat: p.coords.latitude, lng: p.coords.longitude, nome: 'Local atual (GPS)' }), () => toast('Não foi possível obter a localização.'), { enableHighAccuracy: true, timeout: 12000 });
      return;
    }
    if (a === 'pdf') { toast('Gerando PDF…'); folha().then(() => setTimeout(() => window.print(), 200)); }
    if (a === 'copiar') navigator.clipboard.writeText(resumo()).then(() => toast('Resumo copiado.'), () => toast('Não foi possível copiar.'));
    if (a === 'email') {
      let corpo = resumo(); if (corpo.length > 1800) corpo = corpo.slice(0, 1800) + '\n(...)';
      location.href = `mailto:${encodeURIComponent(TS.CONFIG.emailTelesys || '')}?subject=${encodeURIComponent(`${TS.CONFIG.assuntoPadrao} · ${S.contato.projeto || 'Rede privativa'}`)}&body=${encodeURIComponent(corpo)}`;
      toast('Anexe o PDF gerado ao e-mail.');
    }
    if (a === 'whats') {
      let txt = resumo(); if (txt.length > 1800) txt = txt.slice(0, 1800) + '\n(...)';
      const num = String(TS.CONFIG.whatsTelesys || '').replace(/\D/g, '');
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(txt)}`, '_blank', 'noopener');
    }
    if (a === 'salvarProj') { baixar(JSON.stringify({ app: 'telesys-lb-lite', versao: 3, salvo: new Date().toISOString(), S }, null, 1), nomeArq()); toast('Projeto salvo. Use "Abrir projeto" no rodapé para retomar.'); }
    if (a === 'abrirProj') $('#projIn').click();
    if (a === 'full') abrirCompleto();
    if (a === 'reset') { if (confirm('Recomeçar do zero?')) { const tema = S.tema; S = novo(); S.tema = tema; ED.sel = null; ED.traco = []; ED.undo = []; ED.view = null; ED.sonda = null; render(true); } }
  });
  const temPoliLivre = () => S.plano && S.plano.forma === 'livre' && S.plano.poli.length >= 3;
  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.id === 'areaRng') { S.areaKm2 = +sl2km(+t.value).toPrecision(3); S.mexeu.area = true; $('#areaTxt').textContent = fmtArea(S.areaKm2); }
    if (t.id === 'selH' && ED.sel) { const e = S.plano.est[ED.sel.i]; e.h = +t.value; $('#selHtxt').textContent = `${e.h} m`; recalcPlanta(); }
    if (t.id === 'selAz' && ED.sel) { const e = S.plano.est[ED.sel.i]; e.az = +t.value; $('#selAztxt').textContent = `${e.az}°`; telaPlanta(); clearTimeout(t._t); t._t = setTimeout(recalcPlanta, 120); }
    if (t.id === 'selRot' && ED.sel) { const o = S.plano.obs[ED.sel.i]; o.ang = +t.value; $('#selRottxt').textContent = `${o.ang}°`; telaPlanta(); clearTimeout(t._t); t._t = setTimeout(recalcPlanta, 120); }
    if (t.dataset.c) { S.contato[t.dataset.c] = t.value; salvar(); }
  });
  document.addEventListener('pointerdown', ev => { if (['selH', 'selAz', 'selRot'].includes(ev.target.id)) guardar(); });
  document.addEventListener('change', ev => {
    const t = ev.target;
    if (t.id === 'areaRng') render();
    if (t.id === 'chkCob') { S.cob = t.checked; telaPlanta(); salvar(); }
    if (t.id === 'chkSat') { S.sat = t.checked; telaPlanta(); salvar(); }
    if (t.id === 'projIn' && t.files[0]) {
      const rd = new FileReader();
      rd.onload = () => { try { const o = JSON.parse(rd.result); if (o.app !== 'telesys-lb-lite') throw 0; const tema = S.tema; S = carregar(o.S); S.tema = tema; ED.undo = []; ED.view = null; ED.sel = null; aplicarTema(); render(true); toast('Projeto aberto.'); } catch (e) { toast('Arquivo inválido para a versão rápida.'); } };
      rd.readAsText(t.files[0]); t.value = '';
    }
  });
  if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (S.tema === 'auto') { aplicarTema(); render(); } });
  let tR;
  window.addEventListener('resize', () => { clearTimeout(tR); tR = setTimeout(() => { if (S.step === 2) telaPlanta(); }, 120); });

  document.documentElement.dataset.tema = escuro() ? 'escuro' : 'claro';
  window.addEventListener('DOMContentLoaded', () => { TS.View3D.init($('#lbox3d')); aplicarTema(); render(); });
})();
