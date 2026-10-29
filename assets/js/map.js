/* Telesys · Planejador de Link Budget (Rascunho)
   Mapa 2D (Leaflet): área, estações, zonas de obstáculo, sala do core e predição. */
window.TS = window.TS || {};
(function () {
  const M = { modo: 'nav', temp: [], sel: null };
  let map, layers = {}, onChange = () => {}, getState = () => null;

  const iconEst = (n, sel) => L.divIcon({
    className: 'mk-est' + (sel ? ' sel' : ''),
    html: `<div class="mk-est-in"><svg viewBox="0 0 24 24"><path d="M12 3v18M7 21h10M8.5 7.5a5 5 0 0 1 7 0M6 5a8.5 8.5 0 0 1 12 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div><b>${n}</b>`,
    iconSize: [30, 30], iconAnchor: [15, 15]
  });
  const iconCore = () => L.divIcon({ className: 'mk-core', html: '<div>CORE</div>', iconSize: [44, 20], iconAnchor: [22, 10] });
  const iconVtx = () => L.divIcon({ className: 'mk-vtx', iconSize: [12, 12], iconAnchor: [6, 6] });

  M.init = (el, cbChange, cbState) => {
    onChange = cbChange; getState = cbState;
    map = L.map(el, { zoomControl: true, attributionControl: true, doubleClickZoom: false }).setView([-15.78, -47.93], 4);
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagens © Esri' });
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© OpenStreetMap © CARTO' });
    sat.addTo(map);
    L.control.layers({ 'Satélite': sat, 'Ruas': osm, 'Escuro': dark }, null, { position: 'topright' }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    layers.cov = null;
    layers.area = L.layerGroup().addTo(map);
    layers.rings = L.layerGroup().addTo(map);
    layers.zonas = L.layerGroup().addTo(map);
    layers.bh = L.layerGroup().addTo(map);
    layers.est = L.layerGroup().addTo(map);
    layers.temp = L.layerGroup().addTo(map);
    map.on('click', clique);
    map.on('dblclick', () => { if (M.modo === 'area') M.concluirArea(); });
    M.map = map;
  };

  M.setModo = m => {
    M.modo = m; M.temp = [];
    layers.temp.clearLayers();
    document.querySelectorAll('[data-modo]').forEach(b => b.classList.toggle('active', b.dataset.modo === m));
    map.getContainer().style.cursor = m === 'nav' ? '' : 'crosshair';
    const dica = {
      nav: 'Arraste para navegar. Selecione uma ferramenta para editar.',
      area: 'Clique para marcar os vértices da área. Duplo clique ou "Concluir" para fechar o polígono.',
      estacao: 'Clique no ponto alto onde a estação será instalada (torre, caixa d\'água, silo, telhado).',
      zona: 'Clique sobre a região do obstáculo. Ajuste tipo e raio na lista ao lado.',
      core: 'Clique na sala técnica onde ficam o core e o servidor.'
    }[m];
    const d = document.getElementById('mapDica'); if (d) d.textContent = dica;
    M.desenharArea();
  };

  function clique(ev) {
    const st = getState(); const p = [ev.latlng.lat, ev.latlng.lng];
    if (M.modo === 'area') {
      M.temp.push(p);
      layers.temp.clearLayers();
      L.polyline(M.temp, { color: '#4cc9e0', weight: 2, dashArray: '4 4' }).addTo(layers.temp);
      M.temp.forEach(q => L.circleMarker(q, { radius: 4, color: '#4cc9e0', fillOpacity: 1 }).addTo(layers.temp));
    } else if (M.modo === 'estacao') {
      const n = st.area.estacoes.length + 1;
      const amb = TS.ambById(st.area.ambiente);
      st.area.estacoes.push({ id: 'e' + Date.now(), nome: 'E' + n, lat: p[0], lng: p[1], h: st.rf.hBS || amb.hBS, antena: amb.indoor ? 'omni' : 'tri', az: 0 });
      M.sel = st.area.estacoes.length - 1;
      onChange('estacoes');
    } else if (M.modo === 'zona') {
      const tipo = document.getElementById('zonaTipo')?.value || 'vegetacao';
      const z = TS.ZONAS.find(x => x.id === tipo);
      st.area.zonas.push({ id: 'z' + Date.now(), tipo, lat: p[0], lng: p[1], raio: 150, prof: z.prof || 60, db: z.db || 10, paredes: z.paredes || 2 });
      onChange('zonas');
    } else if (M.modo === 'core') {
      st.area.core = { lat: p[0], lng: p[1] };
      onChange('core');
    }
  }

  M.concluirArea = () => {
    const st = getState();
    if (M.temp.length >= 3) { st.area.poligono = M.temp.slice(); M.temp = []; layers.temp.clearLayers(); M.setModo('nav'); onChange('area'); M.enquadrar(); }
  };

  M.desenharArea = () => {
    const st = getState(); if (!st || !map) return;
    layers.area.clearLayers();
    const poly = st.area.poligono;
    if (poly.length >= 3) {
      L.polygon(poly, { color: '#e8ecf1', weight: 2, fill: false, dashArray: M.modo === 'area' ? '6 4' : null }).addTo(layers.area);
      if (M.modo === 'area' || M.modo === 'nav') {
        poly.forEach((q, i) => {
          const mk = L.marker(q, { icon: iconVtx(), draggable: true }).addTo(layers.area);
          mk.on('dragend', e => { const ll = e.target.getLatLng(); poly[i] = [ll.lat, ll.lng]; onChange('area'); });
        });
      }
    }
  };

  M.desenhar = (st, r, cv, cvCanvas) => {
    if (!map) return;
    M.desenharArea();
    // estações
    layers.est.clearLayers(); layers.rings.clearLayers(); layers.zonas.clearLayers(); layers.bh.clearLayers();
    st.area.estacoes.forEach((e, i) => {
      const mk = L.marker([e.lat, e.lng], { icon: iconEst(e.nome, M.sel === i), draggable: true, zIndexOffset: 500 }).addTo(layers.est);
      mk.on('dragend', ev => { const ll = ev.target.getLatLng(); e.lat = ll.lat; e.lng = ll.lng; onChange('estacoes'); });
      mk.on('click', () => { M.sel = i; onChange('sel'); });
      if (r && document.getElementById('chkAneis')?.checked !== false) {
        L.circle([e.lat, e.lng], { radius: r.rFolga, color: '#2fbf71', weight: 1.2, fill: false, dashArray: '5 5', interactive: false }).addTo(layers.rings);
        L.circle([e.lat, e.lng], { radius: r.rLimite, color: '#f2b233', weight: 1, fill: false, dashArray: '2 6', interactive: false }).addTo(layers.rings);
      }
      if (e.antena === 'setorial') {
        const tip = TS.RF.offset([e.lat, e.lng], Math.sin(e.az * Math.PI / 180) * (r ? r.rFolga * 0.35 : 200), Math.cos(e.az * Math.PI / 180) * (r ? r.rFolga * 0.35 : 200));
        L.polyline([[e.lat, e.lng], tip], { color: '#4cc9e0', weight: 2, interactive: false }).addTo(layers.rings);
      }
      if (st.area.core) {
        L.polyline([[e.lat, e.lng], [st.area.core.lat, st.area.core.lng]], { color: '#c7b8ff', weight: 1.6, dashArray: '8 6', interactive: false }).addTo(layers.bh);
      }
    });
    (st.area.zonas || []).forEach((z, i) => {
      const t = TS.ZONAS.find(x => x.id === z.tipo) || TS.ZONAS[0];
      const c = L.circle([z.lat, z.lng], { radius: z.raio, color: t.cor, weight: 1.5, fillOpacity: 0.18 }).addTo(layers.zonas);
      c.bindTooltip(t.l, { direction: 'top' });
      const h = L.marker([z.lat, z.lng], { icon: L.divIcon({ className: 'mk-zona', iconSize: [10, 10], iconAnchor: [5, 5] }), draggable: true }).addTo(layers.zonas);
      h.on('dragend', ev => { const ll = ev.target.getLatLng(); z.lat = ll.lat; z.lng = ll.lng; onChange('zonas'); });
    });
    if (st.area.core) {
      const mk = L.marker([st.area.core.lat, st.area.core.lng], { icon: iconCore(), draggable: true, zIndexOffset: 400 }).addTo(layers.bh);
      mk.on('dragend', ev => { const ll = ev.target.getLatLng(); st.area.core = { lat: ll.lat, lng: ll.lng }; onChange('core'); });
    }
    // cobertura
    if (layers.cov) { map.removeLayer(layers.cov); layers.cov = null; }
    if (cv && cvCanvas && document.getElementById('chkCob')?.checked !== false) {
      layers.cov = L.imageOverlay(cvCanvas.toDataURL(), [[cv.bb.s, cv.bb.w], [cv.bb.n, cv.bb.e]], { opacity: 0.85, interactive: false, className: 'cov-img' }).addTo(map);
      layers.cov.bringToBack();
    }
  };

  M.enquadrar = () => {
    const st = getState(); if (!st || !map) return;
    const el = map.getContainer(); if (!el.offsetWidth) { M.fitted = false; return; }
    map.invalidateSize(); M.fitted = true;
    const pts = [...st.area.poligono, ...st.area.estacoes.map(e => [e.lat, e.lng])];
    if (st.area.core) pts.push([st.area.core.lat, st.area.core.lng]);
    if (pts.length === 1) map.setView(pts[0], 15);
    else if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.15));
  };

  M.buscar = async q => {
    if (!q) return;
    const m = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m) { map.setView([+m[1], +m[2]], 15); return true; }
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=pt-BR&q=' + encodeURIComponent(q));
      const j = await r.json();
      if (j[0]) { map.setView([+j[0].lat, +j[0].lon], 14); return true; }
    } catch (e) { /* sem rede */ }
    return false;
  };

  M.invalidar = () => map && setTimeout(() => map.invalidateSize(), 60);

  TS.Map = M;
})();
