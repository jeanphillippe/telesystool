/* Telesys · Planejador de Link Budget (Rascunho)
   Dados de referência: faixas, setores, dispositivos, obstáculos e catálogo.
   Fonte das faixas: artigo Telesys "O que levantar na primeira visita técnica"
   e Mapa de Redes Celulares Privativas no Brasil (Mobile Time, ago/2026).
   Especificações de equipamentos: datasheets públicos dos fabricantes.
   Tudo aqui é referência para rascunho e deve ser confirmado com a Telesys. */
window.TS = window.TS || {};

/* ---------- Configuração geral ---------- */
TS.CONFIG = {
  // E-mail que recebe as solicitações. Preencha antes de publicar no GitHub Pages.
  emailTelesys: 'comercial@telesystembrasil.com.br',
  // WhatsApp comercial com DDI e DDD, só números (ex.: 5511999999999). Vazio: o integrador escolhe o contato.
  whatsTelesys: '5511976388175',
  whatsTelesysTxt: '(11) 97638-8175',
  assuntoPadrao: 'Solicitação de orçamento (Rascunho)',
  versaoApp: '1.0'
};

/* ---------- Faixas disponíveis para redes privadas no Brasil ---------- */
TS.BANDS = [
  {
    id: 'b250', curto: '250 MHz', nome: '250 MHz (legado SLP)',
    faixa: '250 a 268,75 MHz', fDL: 259, fUL: 259,
    duplex: 'Canal estreito', g3pp: 'Fora das bandas LTE/NR usuais', tech: 'Legado',
    bwOpts: [1.4], bw: 1.4, total: 'Canais estreitos',
    perfil: 'Longo alcance, canais estreitos.',
    uso: 'Já usada por utilities. A faixa de 250 a 322 MHz foi destinada à TV 3.0.',
    notas: [
      'Na transição para a TV 3.0, sistemas SLP já autorizados entre 250 e 268,75 MHz podem seguir operando até o fim das outorgas, sob condições de coexistência.',
      'Novos licenciamentos nessa subfaixa são possíveis apenas de forma excepcional, conforme a regulamentação aplicável.'
    ],
    status: 'restrita', ecossistema: 'restrito', termKey: 'L250',
    equip: 'gen250', ptx: 40, gant: 9, sens: -106, users: 200
  },
  {
    id: 'b87', curto: '410 MHz', nome: '410 MHz (Banda 87)',
    faixa: '410 a 415 MHz (UL) e 420 a 425 MHz (DL)', fDL: 422.5, fUL: 412.5,
    duplex: 'FDD', g3pp: 'Banda 87 (3GPP)', tech: 'LTE',
    bwOpts: [1.4, 3, 5], bw: 5, total: '5 + 5 MHz',
    perfil: 'Banda 87 do 3GPP, LTE com longo alcance.',
    uso: 'Preferência para utilities de energia, água e gás.',
    notas: ['Ecossistema de terminais mais restrito que 700 MHz: confirmar módulos e terminais com suporte à Banda 87.'],
    status: 'ok', ecossistema: 'restrito', termKey: 'B87',
    equip: 'gen87', ptx: 43, gant: 11, sens: -102, users: 256
  },
  {
    id: 'b28', curto: '700 MHz', nome: '700 MHz (Banda 28)',
    faixa: '703 a 708 MHz (UL) e 758 a 763 MHz (DL)', fDL: 760.5, fUL: 705.5,
    duplex: 'FDD', g3pp: 'Banda 28 (3GPP)', tech: 'LTE',
    bwOpts: [5], bw: 5, total: 'Bloco de 5 + 5 MHz',
    perfil: 'Bloco de 5+5 MHz na banda 28, a mesma usada pelas operadoras em 700 MHz, o que amplia a oferta de terminais.',
    uso: 'Fazendas, áreas extensas e cobertura externa.',
    notas: ['No agronegócio, a maioria das redes privativas opera em 4G na faixa de 700 MHz, escolhida pela cobertura mais ampla.'],
    status: 'ok', ecossistema: 'amplo', termKey: 'B28',
    equip: 'nova249', ptx: 46, gant: 15, sens: -102, users: 256
  },
  {
    id: 'b15', curto: '1,5 GHz', nome: '1.487 a 1.517 MHz',
    faixa: '1.487 a 1.517 MHz', fDL: 1502, fUL: 1502,
    duplex: 'A confirmar', g3pp: 'Banda 3GPP e terminais a confirmar', tech: 'LTE/NR',
    bwOpts: [5, 10, 15, 20], bw: 20, total: '30 MHz',
    perfil: '30 MHz com prioridade para SLP, sem restrição geográfica.',
    uso: 'Pensada pela Anatel para IoT industrial em mineração e petróleo.',
    notas: ['Ecossistema de equipamentos e terminais em formação: validar disponibilidade com a Telesys antes de fechar a faixa.'],
    status: 'ok', ecossistema: 'restrito', termKey: 'L15',
    equip: 'gen15', ptx: 40, gant: 14, sens: -100, users: 128
  },
  {
    id: 'b24', curto: '2,4 GHz', nome: '2.390 a 2.400 e 2.485 a 2.495 MHz',
    faixa: '2.390 a 2.400 MHz (Banda 40) e 2.485 a 2.495 MHz (Banda 53)', fDL: 2395, fUL: 2395,
    duplex: 'TDD', g3pp: 'Bandas 40 e 53 (3GPP)', tech: 'LTE',
    bwOpts: [5, 10], bw: 10, total: 'Dois recortes de 10 MHz',
    perfil: 'Dois recortes de 10 MHz, alcance intermediário.',
    uso: 'Áreas menores e ambientes internos.',
    notas: ['O recorte de 2.485 a 2.495 MHz corresponde à Banda 53: confirmar equipamento e terminais para esse trecho.'],
    status: 'ok', ecossistema: 'moderado', termKey: 'B40',
    equip: 'nova442i', ptx: 36, gant: 12, sens: -100, users: 128
  },
  {
    id: 'b37', curto: '3,7 GHz', nome: '3.700 a 3.800 MHz',
    faixa: '3.700 a 3.800 MHz', fDL: 3750, fUL: 3750,
    duplex: 'TDD', g3pp: 'LTE Banda 43 / NR n77 e n78', tech: 'LTE/NR',
    bwOpts: [10, 20, 40, 60, 80, 100], bw: 20, total: '100 MHz',
    perfil: '100 MHz, baixa potência, caráter secundário.',
    uso: 'Fábricas e galpões, com estações internas ou cobertura externa limitada.',
    notas: [
      'Exige verificar estações terrenas de satélite no entorno e aplicar as distâncias mínimas de separação.',
      'Referência regulatória: o Ato Anatel 8.991/2022 previa até 250 mW por transmissor (24 dBm). Confirmar o limite vigente.'
    ],
    status: 'secundaria', ecossistema: 'amplo', termKey: 'B43',
    limitePtx: 24,
    equip: 'nova430i', ptx: 24, gant: 13, sens: -100, users: 128
  },
  {
    id: 'b28g', curto: '27,5 GHz', nome: '27,5 a 27,9 GHz (mmWave)',
    faixa: '27,5 a 27,9 GHz', fDL: 27700, fUL: 27700,
    duplex: 'TDD', g3pp: 'NR n257 / n261', tech: 'NR',
    bwOpts: [100, 200, 400], bw: 200, total: '400 MHz',
    perfil: 'Ondas milimétricas, capacidade alta e alcance curto.',
    uso: 'Aplicações pontuais em plantas industriais, com visada entre estação e terminal.',
    notas: ['Requer visada direta entre estação e terminal. Equipamentos sob consulta.'],
    status: 'ok', ecossistema: 'restrito', termKey: 'NRMM',
    equip: 'genmm', ptx: 30, gant: 22, sens: -88, users: 256
  }
];
TS.bandById = id => TS.BANDS.find(b => b.id === id);

/* Bandas que podem aparecer nos terminais (para o cruzamento com a faixa) */
TS.TERM_BANDS = [
  { k: 'B28', l: 'Banda 28 (700 MHz)' },
  { k: 'B87', l: 'Banda 87 (410 MHz)' },
  { k: 'L15', l: '1,5 GHz' },
  { k: 'B40', l: 'Banda 40 (2,3 a 2,4 GHz)' },
  { k: 'B53', l: 'Banda 53 (2,49 GHz)' },
  { k: 'B43', l: 'Banda 43 (3,6 a 3,8 GHz)' },
  { k: 'N77', l: 'NR n77 / n78' },
  { k: 'NRMM', l: 'NR n257 / n261 (mmWave)' },
  { k: 'L250', l: '250 MHz (legado)' }
];
/* Para cada faixa, quais chaves de terminal servem */
TS.BAND_TERM_MATCH = {
  b250: ['L250'], b87: ['B87'], b28: ['B28'], b15: ['L15'],
  b24: ['B40', 'B53'], b37: ['B43', 'N77'], b28g: ['NRMM']
};

/* ---------- Setores ---------- */
TS.SETORES = [
  { id: 'agro', l: 'Agronegócio', bonus: { b28: 14, b87: 2 } },
  { id: 'mineracao', l: 'Mineração', bonus: { b15: 12, b28: 6, b37: 2 } },
  { id: 'oleogas', l: 'Petróleo e gás', bonus: { b15: 12, b28: 4 } },
  { id: 'utility', l: 'Utilities (energia, água, gás)', bonus: { b87: 14, b250: 4, b28: 4 } },
  { id: 'industria', l: 'Indústria e fábricas', bonus: { b37: 12, b24: 6, b28g: 3 } },
  { id: 'logistica', l: 'Logística, armazéns e portos', bonus: { b37: 8, b24: 6, b28: 4 } },
  { id: 'outro', l: 'Campus, hospitais e outros', bonus: { b37: 6, b24: 4, b28: 4 } }
];

/* ---------- Ambientes e modelos de propagação ---------- */
TS.AMBIENTES = [
  { id: 'rural', l: 'Externo aberto (fazenda, campo, lavoura)', modelo: 'rma', visada: 'prob', hBS: 30, hUT: 1.5, sigma: 6, indoor: false },
  { id: 'industrial', l: 'Externo com estruturas (planta, mina, porto)', modelo: 'uma', visada: 'nlos', hBS: 25, hUT: 1.5, sigma: 7, indoor: false },
  { id: 'galpao', l: 'Interno: galpão com pouca obstrução', modelo: 'inf-sl', visada: 'nlos', hBS: 8, hUT: 1.5, sigma: 5.7, indoor: true },
  { id: 'fabrica', l: 'Interno: fábrica densa (máquinas, metal)', modelo: 'inf-dl', visada: 'nlos', hBS: 8, hUT: 1.5, sigma: 7.2, indoor: true }
];
TS.ambById = id => TS.AMBIENTES.find(a => a.id === id) || TS.AMBIENTES[0];

TS.MODELOS = {
  auto: 'Automático pelo ambiente',
  fspl: 'Espaço livre (referência)',
  hata: 'Okumura-Hata / COST-231',
  rma: '3GPP TR 38.901 RMa (rural)',
  uma: '3GPP TR 38.901 UMa',
  'inf-sl': '3GPP TR 38.901 InF-SL (indoor, pouca obstrução)',
  'inf-dl': '3GPP TR 38.901 InF-DL (indoor, obstrução densa)'
};

/* ---------- Obstáculos (perdas dependentes da frequência) ----------
   Paredes e vidros: 3GPP TR 38.901, Tabela 7.4.3-1 (f em GHz).
   Vegetação: modelo de Weissberger (profundidade em metros). */
TS.OBSTACULOS = [
  { id: 'concreto', l: 'Parede de concreto', un: 'paredes', f: g => 5 + 4 * g },
  { id: 'madeira', l: 'Parede de madeira ou drywall', un: 'paredes', f: g => 4.85 + 0.12 * g },
  { id: 'vidro', l: 'Vidro comum', un: 'camadas', f: g => 2 + 0.2 * g },
  { id: 'irr', l: 'Vidro metalizado (película IRR)', un: 'camadas', f: g => 23 + 0.3 * g },
  { id: 'vegetacao', l: 'Vegetação alta (cana, eucalipto)', un: 'm de profundidade', veg: true },
  { id: 'cabine', l: 'Terminal dentro de cabine ou veículo', un: 'dB fixos', fixo: true },
  { id: 'metal', l: 'Estruturas metálicas e máquinas grandes', un: 'dB fixos', fixo: true }
];
TS.weissberger = (fGHz, d) => {
  if (!d || d <= 0) return 0;
  if (d < 14) return 0.45 * Math.pow(fGHz, 0.284) * d;
  return 1.33 * Math.pow(fGHz, 0.284) * Math.pow(Math.min(d, 400), 0.588);
};
/* Zonas de obstáculo desenhadas no mapa */
TS.ZONAS = [
  { id: 'vegetacao', l: 'Vegetação alta', cor: '#5fae6b', prof: 60 },
  { id: 'metal', l: 'Estruturas metálicas', cor: '#a7b1bd', db: 12 },
  { id: 'predio', l: 'Edificação de concreto', cor: '#c08a5b', paredes: 2 },
  { id: 'relevo', l: 'Relevo / sombra', cor: '#8a6fb3', db: 15 }
];

/* ---------- Dispositivos ----------
   ul / dl em Mbps por unidade (referência editável). */
TS.DISPOSITIVOS = [
  { id: 'sensor', l: 'Sensor IoT (telemetria)', ic: '📡', ul: 0.02, dl: 0.01, mov: false, lat: false },
  { id: 'camhd', l: 'Câmera IP Full HD', ic: '📹', ul: 4, dl: 0.1, mov: false, lat: false, upHeavy: true },
  { id: 'cam4k', l: 'Câmera 4K / IA Física', ic: '🎥', ul: 12, dl: 0.2, mov: false, lat: false, upHeavy: true },
  { id: 'tablet', l: 'Tablet ou smartphone operacional', ic: '📱', ul: 1, dl: 3, mov: true, lat: false },
  { id: 'coletor', l: 'Coletor de dados (handheld)', ic: '📟', ul: 0.3, dl: 0.5, mov: true, lat: false },
  { id: 'maquina', l: 'Máquina agrícola (telemetria e RTK)', ic: '🚜', ul: 0.5, dl: 0.3, mov: true, lat: true },
  { id: 'robo', l: 'Robô móvel / AGV / AMR', ic: '🤖', ul: 2, dl: 1, mov: true, lat: true },
  { id: 'ptt', l: 'Voz e PTT sobre LTE', ic: '🎙️', ul: 0.1, dl: 0.1, mov: true, lat: true },
  { id: 'cpe', l: 'CPE / gateway (Wi-Fi local)', ic: '📶', ul: 5, dl: 20, mov: false, lat: false },
  { id: 'outro', l: 'Outro (personalizado)', ic: '⚙️', ul: 1, dl: 1, mov: false, lat: false }
];
TS.devById = id => TS.DISPOSITIVOS.find(d => d.id === id) || TS.DISPOSITIVOS[TS.DISPOSITIVOS.length - 1];

/* Terminal de referência para o uplink (pior caso) */
TS.TERMINAIS = [
  { id: 'modulo', l: 'Terminal LTE comum (smartphone ou módulo)', ptx: 23, g: 0, h: 1.5 },
  { id: 'camera', l: 'Câmera ou sensor com antena externa', ptx: 23, g: 3, h: 4 },
  { id: 'maquina', l: 'Máquina com antena no teto', ptx: 23, g: 3, h: 3 },
  { id: 'cpe', l: 'CPE externo com antena direcional', ptx: 23, g: 12, h: 5 }
];
TS.termById = id => TS.TERMINAIS.find(t => t.id === id) || TS.TERMINAIS[0];

/* ---------- Catálogo de equipamentos (sem preços) ---------- */
TS.EQUIP = {
  nova249: {
    nome: 'Baicells Nova249 (Banda 28)', tipo: 'eNodeB LTE FDD externa', bandas: ['b28'],
    ptx: 46, gant: null, antena: 'externa', sens: -102, users: 256, tech: 'LTE',
    specs: [
      ['Banda', 'LTE FDD Banda 28 (variantes 3, 5 e 8 na linha)'],
      ['Potência', '2 × 40 W (46 dBm por porta)'],
      ['MIMO', '2×2 no downlink'],
      ['Largura de canal', '5, 10, 15 ou 20 MHz (B28)'],
      ['Sensibilidade do receptor', '-102 dBm'],
      ['Usuários simultâneos', 'até 256'],
      ['Proteção', 'IP66, uso externo'],
      ['Consumo', 'típico abaixo de 300 W, máximo abaixo de 360 W'],
      ['Antenas', 'externas (setoriais ou omni de 700 MHz)']
    ],
    fonte: 'Datasheet Baicells Nova-249'
  },
  nova442i: {
    nome: 'Baicells Nova442i (Banda 40)', tipo: 'eNodeB LTE TDD externa com antena integrada', bandas: ['b24'],
    ptx: 36, gant: 12, antena: 'integrada', sens: -100, users: 128, tech: 'LTE',
    specs: [
      ['Banda', 'LTE TDD Banda 40 (2.300 a 2.400 MHz); variante Banda 48'],
      ['Potência', 'até 36 dBm por canal, máximo combinado de +42 dBm (configurável)'],
      ['Antena', 'integrada 4T4R, 12 dBi (conforme datasheet)'],
      ['MIMO', '2×2 no downlink'],
      ['Largura de canal', '5, 10, 15 ou 20 MHz por portadora'],
      ['Sensibilidade do receptor', '-100 dBm por canal'],
      ['Usuários', 'até 128 conectados (RRC) por portadora'],
      ['Proteção', 'IP65'],
      ['Consumo', 'típico 70 W, máximo 90 W']
    ],
    fonte: 'Datasheet Baicells Nova442i'
  },
  nova430i: {
    nome: 'Baicells Nova430i (variante Banda 43)', tipo: 'eNodeB LTE TDD externa de baixa potência, antena integrada', bandas: ['b37'],
    ptx: 24, gant: 13, antena: 'integrada', sens: -100, users: 128, tech: 'LTE',
    specs: [
      ['Banda', 'LTE TDD 3,5 GHz (linha com variantes Bandas 42, 43 e 48)'],
      ['Potência', '0 a 24 dBm por canal, até +30 dBm combinado (configurável)'],
      ['Antena', 'integrada 4T4R, 13 ± 1 dBi'],
      ['MIMO', '2×2 no downlink'],
      ['Largura de canal', '5, 10, 15 ou 20 MHz; até 40 MHz com agregação de portadoras'],
      ['Sensibilidade do receptor', '-100 dBm por canal'],
      ['Usuários', 'até 128 conectados (RRC) por portadora, 128+128 em portadora dupla'],
      ['Proteção', 'IP65'],
      ['Consumo', 'típico 20 W, máximo 25 W'],
      ['Peso', '4,85 kg sem suporte']
    ],
    fonte: 'Datasheet Baicells Nova430i'
  },
  nova436q: {
    nome: 'Baicells Nova436Q', tipo: 'eNodeB LTE TDD externa, antenas externas', bandas: ['b37'],
    ptx: 24, gant: 17, antena: 'externa', sens: -100, users: 128, tech: 'LTE',
    specs: [
      ['Banda', 'LTE TDD 3,5 GHz (variantes conforme banda)'],
      ['Potência', '0 a 30 dBm por canal (configurar dentro do limite regulatório da faixa)'],
      ['Antenas', 'externas, conectores N (duas antenas de 2 portas ou uma de 4 portas)'],
      ['MIMO', '2×2 no downlink'],
      ['Largura de canal', '5, 10, 15 ou 20 MHz; até 40 MHz com agregação'],
      ['Sensibilidade do receptor', '-100 dBm por canal'],
      ['Usuários', 'até 128 conectados (RRC) por célula'],
      ['Proteção', 'IP66'],
      ['Consumo', 'típico 60 W, máximo 100 W']
    ],
    fonte: 'Datasheet Baicells Nova436Q'
  },
  aurora243: {
    nome: 'Baicells Aurora243 (5G NR n77/n78)', tipo: 'gNodeB 5G NR externa', bandas: ['b37'],
    ptx: 24, gant: 14, antena: 'integrada', sens: -103, users: 1200, tech: 'NR',
    specs: [
      ['Banda', 'NR n77 / n78 (linha com n41, n48 e n79)'],
      ['Potência', 'até 2 × 3 W em n77/n78 (configurar dentro do limite regulatório da faixa)'],
      ['Antena', 'painel integrado 2T2R, 13,5 a 14,5 dBi conforme banda'],
      ['MIMO', '2×2'],
      ['Largura de canal', '10 a 100 MHz'],
      ['Usuários', 'até 1.200 simultâneos'],
      ['Modo', 'SA (standalone)'],
      ['Proteção', 'IP65'],
      ['Consumo', 'máximo 150 W']
    ],
    fonte: 'Especificações públicas Baicells Aurora243',
    sensNota: 'Sensibilidade não publicada no material consultado; valor calculado (ruído térmico, NF 5 dB, alocação de borda de 5 MHz).'
  },
  gen87: {
    nome: 'eNodeB LTE Banda 87 (sob consulta)', tipo: 'eNodeB LTE FDD 410 MHz', bandas: ['b87'],
    ptx: 43, gant: 11, antena: 'externa', sens: -102, users: 256, tech: 'LTE', generico: true,
    specs: [['Banda', 'LTE FDD Banda 87'], ['Parâmetros', 'valores genéricos de referência para o rascunho'], ['Disponibilidade', 'confirmar modelo com a Telesys']],
    fonte: 'Parâmetros genéricos'
  },
  gen15: {
    nome: 'Estação LTE/NR 1,5 GHz (sob consulta)', tipo: 'Estação para a faixa de 1.487 a 1.517 MHz', bandas: ['b15'],
    ptx: 40, gant: 14, antena: 'externa', sens: -100, users: 128, tech: 'LTE', generico: true,
    specs: [['Faixa', '1.487 a 1.517 MHz'], ['Parâmetros', 'valores genéricos de referência para o rascunho'], ['Disponibilidade', 'confirmar modelo e terminais com a Telesys']],
    fonte: 'Parâmetros genéricos'
  },
  gen250: {
    nome: 'Sistema de canal estreito 250 MHz (sob consulta)', tipo: 'Somente para outorgas existentes', bandas: ['b250'],
    ptx: 40, gant: 9, antena: 'externa', sens: -106, users: 200, tech: 'Legado', generico: true,
    specs: [['Faixa', '250 a 268,75 MHz'], ['Situação', 'apenas para quem já tem outorga SLP ou licenciamento excepcional'], ['Parâmetros', 'valores genéricos de referência']],
    fonte: 'Parâmetros genéricos'
  },
  genmm: {
    nome: 'gNodeB mmWave 28 GHz (sob consulta)', tipo: 'gNodeB 5G NR FR2', bandas: ['b28g'],
    ptx: 30, gant: 22, antena: 'integrada', sens: -88, users: 256, tech: 'NR', generico: true,
    specs: [['Banda', 'NR n257 / n261'], ['Antena', 'arranjo com beamforming (ganho genérico)'], ['Parâmetros', 'valores genéricos de referência'], ['Disponibilidade', 'sob consulta']],
    fonte: 'Parâmetros genéricos'
  }
};
/* Equipamentos possíveis por faixa */
TS.EQUIP_POR_FAIXA = {
  b250: ['gen250'], b87: ['gen87'], b28: ['nova249'], b15: ['gen15'],
  b24: ['nova442i'], b37: ['nova430i', 'nova436q', 'aurora243'], b28g: ['genmm']
};

/* Backhaul Mimosa (linha 6) */
TS.BACKHAUL = {
  b6x: {
    nome: 'Mimosa B6x', tipo: 'Backhaul ponto a ponto', fGHz: 5.8,
    specs: [['Frequência', '5,15 a 6,425 GHz'], ['Capacidade', 'até 3,0 Gbps agregados'], ['Antenas', '8 a 30 dBi'], ['Uso', 'backhaul dedicado entre a estação e a sala do core']],
    fonte: 'mimosa.co, linha 6'
  },
  c6x: {
    nome: 'Mimosa C6x', tipo: 'Rádio cliente ou backhaul (PtP / PtMP)', fGHz: 5.8,
    specs: [['Frequência', '5,15 a 7,125 GHz'], ['Capacidade', 'até 2,0 Gbps'], ['Antenas', '8 a 30 dBi'], ['Uso', 'várias estações convergindo para um mesmo ponto']],
    fonte: 'mimosa.co, linha 6'
  }
};

/* ---------- Checklist da primeira visita técnica (do artigo) ---------- */
TS.CHECKLIST = [
  { g: 'O terreno e o ambiente', itens: [
    { id: 'area', t: 'Área a cobrir', d: 'Polígono em mapa ou arquivo KML, separando o que é interno, externo e eventual subsolo.' },
    { id: 'obst', t: 'Obstáculos', d: 'Estruturas metálicas, paredes de concreto, relevo, vegetação alta como cana e eucalipto, máquinas grandes que mudam de lugar.' },
    { id: 'altos', t: 'Pontos altos', d: "Torres, caixas d'água, silos e telhados, com altura aproximada, energia disponível e acesso para manutenção." }
  ] },
  { g: 'O que vai se conectar', itens: [
    { id: 'inv', t: 'Inventário de dispositivos', d: 'Quantidade e tipo: sensores, câmeras, tablets, coletores, máquinas agrícolas, robôs móveis. Câmeras e sistemas de IA Física enviam mais do que recebem e pesam no uplink.' },
    { id: 'mob', t: 'Mobilidade e tempo de resposta', d: 'O que se move durante a operação e o que exige latência baixa e previsível.' },
    { id: 'bandas', t: 'Bandas dos terminais', d: 'Quais bandas os módulos e terminais existentes ou previstos suportam. A faixa do projeto precisa coincidir com elas.' },
    { id: 'cresc', t: 'Crescimento', d: 'Quantos dispositivos devem entrar nos próximos anos e se há intenção de migrar para 5G.' }
  ] },
  { g: 'O que já existe', itens: [
    { id: 'infra', t: 'Infraestrutura', d: 'Fibra, rede local, energia e espaço para o núcleo e o servidor. Se a estação ficar longe dessa sala, anotar distância e visada para um enlace de backhaul.' },
    { id: 'viz', t: 'Vizinhança de espectro', d: 'Redes e estações existentes na região, exigências de coordenação e coexistência da faixa escolhida, inclusive estações terrenas de satélite.' },
    { id: 'tit', t: 'Titularidade e dados', d: 'Quem será titular da autorização, SLP próprio ou espectro de operadora, e onde os dados precisam ficar.' }
  ] }
];
TS.CHECK_IDS = TS.CHECKLIST.flatMap(g => g.itens.map(i => i.id));

/* Configurações TDD (participação aproximada no tempo) */
TS.TDD = {
  cfg0: { l: 'Prioriza uplink (LTE config. 0)', dl: 0.34, ul: 0.6 },
  cfg1: { l: 'Equilibrado (LTE config. 1)', dl: 0.54, ul: 0.4 },
  cfg2: { l: 'Prioriza downlink (LTE config. 2)', dl: 0.74, ul: 0.2 }
};
