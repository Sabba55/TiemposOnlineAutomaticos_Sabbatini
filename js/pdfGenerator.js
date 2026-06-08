// ─── pdfGenerator.js ──────────────────────────────────────────────────────────
// Genera la Clasificación Final por Categoría en PDF usando jsPDF (browser).
// Se activa con Ctrl+Shift+P desde index.html.
// Requiere que pilotosData y tramosData estén cargados globalmente.
// ──────────────────────────────────────────────────────────────────────────────

(function () {

  // ─── COLORES (basados en el sitio web) ──────────────────────────────────────
  const COLORES = {
    encabezadoTabla: [15, 23, 42],       // --color-azul-principal (#0f172a)
    bannerCategoria: [0, 36, 83],        // --color-categoria (#002453)
    filaImpar:       [240, 243, 246],    // #f0f3f6
    filaPar:         [255, 255, 255],    // #ffffff
    borde:           [215, 221, 229],    // --color-borde-suave
    texto:           [22, 28, 37],       // --color-texto
    textoClaro:      [232, 237, 243],    // --color-texto-claro
    textoGris:       [90, 100, 114],     // --color-texto-suave
    rojo:            [220, 38, 38],      // #dc2626
  };

  // ─── DIMENSIONES ─────────────────────────────────────────────────────────────
  // A4 portrait: 210 x 297 mm
  const MARGEN_H     = 8;
  const MARGEN_V     = 3;
  const ANCHO_PAGINA = 210;
  const ALTO_PAGINA  = 297;
  const ANCHO_UTIL   = ANCHO_PAGINA - MARGEN_H * 2;

  const ALTO_FILA         = 7;
  const ALTO_ENC_TABLA    = 8;
  const ALTO_BANNER_CLASE = 7;
  const FONT_SIZE_HEADER  = 7;
  const FONT_SIZE_FILA    = 6.5;
  const FONT_SIZE_BANNER  = 7;

  // Anchos fijos de columnas (mm)
  const ANCHO_POS   = 8;
  const ANCHO_PENAL = 16;
  const ANCHO_DIF   = 17;
  const ANCHO_PROM  = 11;

  // Logo — ajustá estos valores a gusto
  const ALTO_LOGO  = 7;
  const ANCHO_LOGO = 35;

  // ─── HELPERS DE TIEMPO ───────────────────────────────────────────────────────
  const { tiempoASegundos, esDNF, obtenerTiempoEtapa } = window.UtilidadesTiempo;
  const { obtenerPeorTiempo, calcularTiempoDNF } = window.UtilidadesDNF;

  function esFilaShakedownTramo(tramo) {
    if (!tramo) return false;

    const pe = String(tramo.PE || '').trim();
    const desde = String(tramo.Desde || '').trim();
    const hasta = String(tramo.Hasta || '').trim();

    return pe === '0' && /shakedown/i.test(desde) && (!hasta || /shakedown/i.test(hasta));
  }

  function obtenerTramosCarrera() {
    return tramosData.filter(tramo => !esFilaShakedownTramo(tramo));
  }

  function segundosATiempoConDecimales(segundos, decimales) {
    if (!segundos || segundos >= 999999) return '-';
    const h   = Math.floor(segundos / 3600);
    const m   = Math.floor((segundos % 3600) / 60);
    const s   = (segundos % 60).toFixed(decimales);
    const pad = decimales + 3;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(pad, '0')}`;
    }
    return `${m}:${String(s).padStart(pad, '0')}`;
  }

  function formatearTiempo(seg) {
    return segundosATiempoConDecimales(seg, 3);
  }

  function formatearDiferencia(seg) {
    if (!seg || seg <= 0) return '-';
    return '+' + segundosATiempoConDecimales(seg, 3);
  }

  // ─── ORDEN DE CATEGORÍAS (igual que el frontend) ─────────────────────────────
  function obtenerPrioridad(categoria) {
    const c = (categoria || '').trim().toUpperCase();
    if (c === 'RC2' || c === 'RALLY2') return 0;
    if (c === 'RCMR') return 1;
    return 2;
  }

  function ordenarCategorias(cats) {
    return [...cats].sort((a, b) => {
      const pa = obtenerPrioridad(a);
      const pb = obtenerPrioridad(b);
      if (pa !== pb) return pa - pb;
      return a.localeCompare(b, 'es');
    });
  }

  // ─── CÁLCULO DE CLASIFICACIÓN ────────────────────────────────────────────────
  function calcularClasifPorCategorias() {
    const tramosCarrera = obtenerTramosCarrera();
    const totalPEs = tramosCarrera.length;
    const pilotos  = window.pilotosData;

    const peoresPorTramoYCategoria = {};
    for (let i = 1; i <= totalPEs; i++) {
      const col  = `PE${i}`;
      const cats = [...new Set(pilotos.map(p => p.Categoria || p.CATEGORIA))].filter(Boolean);
      cats.forEach(cat => {
        const tiemposTramo = pilotos
          .filter(p => (p.Categoria || p.CATEGORIA) === cat && p[col])
          .map(p => ({
            tiempoSegundos: tiempoASegundos(p[col]),
            tieneDNF:       esDNF(p[col]),
          }))
          .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);
        peoresPorTramoYCategoria[`${i}_${cat}`] = obtenerPeorTiempo(tiemposTramo);
      });
    }

    const categorias = ordenarCategorias(
      [...new Set(pilotos.map(p => p.Categoria || p.CATEGORIA))].filter(Boolean)
    );

    const resultado = {};

    categorias.forEach(cat => {
      const pilotosCat = pilotos
        .filter(p => (p.Categoria || p.CATEGORIA) === cat)
        .map(p => {
          let totalSegundos = 0;
          let tuvoDNF       = false;

          for (let i = 1; i <= totalPEs; i++) {
            const col    = `PE${i}`;
            const tiempo = p[col];

            if (!tiempo || tiempo === '') return null;

            if (esDNF(tiempo)) {
              const peor = peoresPorTramoYCategoria[`${i}_${cat}`] || 0;
              totalSegundos += calcularTiempoDNF(peor);
              tuvoDNF = true;
            } else {
              const seg = tiempoASegundos(tiempo);
              if (seg >= 999999) return null;
              totalSegundos += seg;
            }
          }

          const penalizacion    = tiempoASegundos(p.PENALIZACION || p.Penalizacion || '');
          const penalizSegundos = penalizacion < 999999 ? penalizacion : 0;
          const totalConPenal   = totalSegundos + penalizSegundos;

          let distanciaTotal = 0;
          tramosCarrera.forEach(t => {
            if (t.KMS) {
              const d = parseFloat(t.KMS);
              if (!isNaN(d)) distanciaTotal += d;
            }
          });
          const prom = distanciaTotal > 0
            ? (distanciaTotal / (totalConPenal / 3600)).toFixed(0)
            : '-';

          return {
            nombre:          p.Nombre   || p.NOMBRE   || '',
            vehiculo:        p.Vehiculo || p.VEHICULO || p.vehiculo || '-',
            tiempoNeto:      totalSegundos,
            penalizSegundos: penalizSegundos,
            totalConPenal:   totalConPenal,
            tuvoDNF:         tuvoDNF,
            prom:            prom,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.totalConPenal - b.totalConPenal);

      if (pilotosCat.length > 0) {
        resultado[cat] = pilotosCat;
      }
    });

    return resultado;
  }

  // ─── CONSTRUCCIÓN DE COLUMNAS ────────────────────────────────────────────────
  function construirColumnas(doc, todosLosPilotos) {
    const medirTexto = (texto, size) => {
      doc.setFontSize(size);
      return doc.getStringUnitWidth(texto) * size / doc.internal.scaleFactor;
    };

    let maxPiloto   = medirTexto('PILOTO',   FONT_SIZE_HEADER);
    let maxVehiculo = medirTexto('VEHÍCULO', FONT_SIZE_HEADER);

    todosLosPilotos.forEach(p => {
      const wP = medirTexto(p.nombre   || '', FONT_SIZE_FILA);
      const wV = medirTexto(p.vehiculo || '', FONT_SIZE_FILA);
      if (wP > maxPiloto)   maxPiloto   = wP;
      if (wV > maxVehiculo) maxVehiculo = wV;
    });

    const PADDING       = 3;
    const anchoPiloto   = Math.ceil(maxPiloto)   + PADDING * 2;
    const anchoVehiculo = Math.ceil(maxVehiculo) + PADDING * 2;

    let maxTiempo = medirTexto('0:00.000', FONT_SIZE_FILA);
    todosLosPilotos.forEach(p => {
      const wT  = medirTexto(formatearTiempo(p.tiempoNeto),    FONT_SIZE_FILA);
      const wTT = medirTexto(formatearTiempo(p.totalConPenal), FONT_SIZE_FILA);
      if (wT  > maxTiempo) maxTiempo = wT;
      if (wTT > maxTiempo) maxTiempo = wTT;
    });
    const anchoTiempo = Math.ceil(maxTiempo) + PADDING * 2;

    const fijos  = ANCHO_POS + anchoPiloto + anchoVehiculo + anchoTiempo * 2 +
                   ANCHO_PENAL + ANCHO_DIF * 2 + ANCHO_PROM;
    const escala = fijos > ANCHO_UTIL ? ANCHO_UTIL / fijos : 1;
    const esc    = v => v * escala;

    return [
      { label: 'POS',       campo: '_pos',      ancho: esc(ANCHO_POS),      align: 'center', bold: true  },
      { label: 'PILOTO',    campo: '_piloto',   ancho: esc(anchoPiloto),    align: 'center', bold: true  },
      { label: 'VEHÍCULO',  campo: '_vehiculo', ancho: esc(anchoVehiculo),  align: 'center', bold: false },
      { label: 'TIEMPO',    campo: '_tiempo',   ancho: esc(anchoTiempo),    align: 'center', bold: false },
      { label: 'PENAL.',    campo: '_penal',    ancho: esc(ANCHO_PENAL),    align: 'center', bold: false },
      { label: 'T.TOTAL',   campo: '_total',    ancho: esc(anchoTiempo),    align: 'center', bold: true  },
      { label: 'DIF. 1º',   campo: '_dif1',     ancho: esc(ANCHO_DIF),      align: 'center', bold: false },
      { label: 'DIF. ANT.', campo: '_difAnt',   ancho: esc(ANCHO_DIF),      align: 'center', bold: false },
      { label: 'PROM.',     campo: '_prom',     ancho: esc(ANCHO_PROM),     align: 'center', bold: false },
    ];
  }

  // ─── CARGAR LOGO UNA SOLA VEZ ────────────────────────────────────────────────
  async function cargarLogo() {
    try {
      const img = await new Promise((resolve, reject) => {
        const el   = new Image();
        el.onload  = () => resolve(el);
        el.onerror = reject;
        el.src     = '/assets/logoSabbatiniblack.png';
      });
      const canvas  = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    } catch (_) {
      return null;
    }
  }

  // ─── DIBUJAR ENCABEZADO DE PÁGINA ────────────────────────────────────────────
  function dibujarEncabezadoPagina(doc, nombreRally, logoData) {
    const xL = MARGEN_H;
    const xR = ANCHO_PAGINA - MARGEN_H;

    const ALTO_HEADER = 18;
    const yLogo       = MARGEN_V + (ALTO_HEADER - ALTO_LOGO) / 2;

    if (logoData) {
      doc.addImage(logoData, 'PNG', xL, yLogo, ANCHO_LOGO, ALTO_LOGO);
    }

    // Texto centrado en el espacio a la derecha del logo
    const xTexto     = xL;
    const anchoTexto = ANCHO_UTIL;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORES.texto);
    doc.text(
      'CLASIFICACIÓN FINAL POR CATEGORÍA',
      xTexto + anchoTexto / 2,
      MARGEN_V + 6,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORES.textoGris);
    doc.text(
      nombreRally || 'Rally',
      xTexto + anchoTexto / 2,
      MARGEN_V + 11,
      { align: 'center' }
    );

    // Línea separadora
    const yLinea = MARGEN_V + ALTO_HEADER + 2;
    doc.setDrawColor(...COLORES.borde);
    doc.setLineWidth(0.4);
    doc.line(xL, yLinea, xR, yLinea);

    return yLinea + 3;
  }

  // ─── DIBUJAR ENCABEZADO DE TABLA ─────────────────────────────────────────────
  function dibujarEncabezadoTabla(doc, y, columnas) {
    const anchoReal = columnas.reduce((s, c) => s + c.ancho, 0);
    const xBase     = (ANCHO_PAGINA - anchoReal) / 2;

    doc.setFillColor(...COLORES.encabezadoTabla);
    doc.rect(xBase, y, anchoReal, ALTO_ENC_TABLA, 'F');

    let x = xBase;
    columnas.forEach((col, i) => {
      if (i > 0) {
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.2);
        doc.line(x, y, x, y + ALTO_ENC_TABLA);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FONT_SIZE_HEADER);
      doc.setTextColor(...COLORES.textoClaro);
      doc.text(
        col.label,
        x + col.ancho / 2,
        y + ALTO_ENC_TABLA / 2 + FONT_SIZE_HEADER * 0.35 / 2,
        { align: 'center' }
      );
      x += col.ancho;
    });

    return y + ALTO_ENC_TABLA;
  }

  // ─── DIBUJAR BANNER DE CATEGORÍA ─────────────────────────────────────────────
  function dibujarBannerCategoria(doc, nombreCategoria, columnas, y) {
    const anchoReal = columnas.reduce((s, c) => s + c.ancho, 0);
    const xBase     = (ANCHO_PAGINA - anchoReal) / 2;

    doc.setFillColor(...COLORES.bannerCategoria);
    doc.rect(xBase, y, anchoReal, ALTO_BANNER_CLASE, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT_SIZE_BANNER);
    doc.setTextColor(...COLORES.textoClaro);
    doc.text(
      `CATEGORÍA: ${nombreCategoria.toUpperCase()}`,
      xBase + 4,
      y + ALTO_BANNER_CLASE / 2 + FONT_SIZE_BANNER * 0.35 / 2
    );

    return y + ALTO_BANNER_CLASE;
  }

  // ─── DIBUJAR FILA ─────────────────────────────────────────────────────────────
  function dibujarFila(doc, valores, columnas, y, esImpar) {
    const anchoReal = columnas.reduce((s, c) => s + c.ancho, 0);
    const xBase     = (ANCHO_PAGINA - anchoReal) / 2;

    doc.setFillColor(...(esImpar ? COLORES.filaImpar : COLORES.filaPar));
    doc.rect(xBase, y, anchoReal, ALTO_FILA, 'F');

    // Bordes externos
    doc.setDrawColor(...COLORES.borde);
    doc.setLineWidth(0.2);
    doc.line(xBase, y + ALTO_FILA, xBase + anchoReal, y + ALTO_FILA);
    doc.line(xBase, y, xBase, y + ALTO_FILA);
    doc.line(xBase + anchoReal, y, xBase + anchoReal, y + ALTO_FILA);

    let x = xBase;
    columnas.forEach((col, i) => {
      if (i > 0) {
        doc.setDrawColor(...COLORES.borde);
        doc.setLineWidth(0.2);
        doc.line(x, y, x, y + ALTO_FILA);
      }

      const valor  = valores[col.campo] || '-';
      const yTexto = y + ALTO_FILA / 2 + FONT_SIZE_FILA * 0.35 / 2;

      // Rojo para PENAL. si tiene valor
      if (col.campo === '_penal' && valor !== '-') {
        doc.setTextColor(...COLORES.rojo);
      } else {
        doc.setTextColor(...COLORES.texto);
      }

      doc.setFont('helvetica', col.bold ? 'bold' : 'normal');
      doc.setFontSize(FONT_SIZE_FILA);
      doc.text(valor, x + col.ancho / 2, yTexto, { align: 'center', maxWidth: col.ancho - 2 });

      x += col.ancho;
    });
  }

  // ─── PIE DE PÁGINA ────────────────────────────────────────────────────────────
  function dibujarPieDePagina(doc, totalPaginas) {
    const ahora = new Date().toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });

    for (let i = 1; i <= totalPaginas; i++) {
      doc.setPage(i);
      const yLinea = ALTO_PAGINA - MARGEN_V - 4;
      const yTexto = ALTO_PAGINA - MARGEN_V;

      doc.setDrawColor(...COLORES.borde);
      doc.setLineWidth(0.3);
      doc.line(MARGEN_H, yLinea, ANCHO_PAGINA - MARGEN_H, yLinea);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...COLORES.textoGris);
      doc.text(`Página ${i} / ${totalPaginas}`, MARGEN_H, yTexto);
      doc.text(`Generado el ${ahora}`, ANCHO_PAGINA - MARGEN_H, yTexto, { align: 'right' });
    }
  }

  // ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────
  async function generarPDF() {
    if (typeof window.pilotosData === 'undefined' || window.pilotosData.length === 0) {
      alert('Los datos aún no están cargados. Esperá un momento e intentá de nuevo.');
      return;
    }
    if (typeof window.tramosData === 'undefined' || window.tramosData.length === 0) {
      alert('No hay datos de tramos cargados.');
      return;
    }

    // Cargar jsPDF dinámicamente si no está disponible
    if (typeof window.jspdf === 'undefined') {
      await new Promise((resolve, reject) => {
        const script   = document.createElement('script');
        script.src     = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload  = resolve;
        script.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
        document.head.appendChild(script);
      });
    }

    const { jsPDF } = window.jspdf;

    const clasificacion       = calcularClasifPorCategorias();
    const categoriasOrdenadas = Object.keys(clasificacion);

    if (categoriasOrdenadas.length === 0) {
      alert('No hay pilotos con todos los tramos completados para generar la clasificación final.');
      return;
    }

    const todosLosPilotos = categoriasOrdenadas.flatMap(c => clasificacion[c]);
    const logoData        = await cargarLogo();
    const nombreRally     = document.getElementById('rallyName')?.textContent || 'Rally';

    const doc = new jsPDF({
      orientation: 'portrait',
      unit:        'mm',
      format:      'a4',
    });

    const columnas = construirColumnas(doc, todosLosPilotos);
    const yLimite  = ALTO_PAGINA - MARGEN_V - 8;

    let y = dibujarEncabezadoPagina(doc, nombreRally, logoData);
    y     = dibujarEncabezadoTabla(doc, y, columnas);

    for (const cat of categoriasOrdenadas) {
      const pilotos = clasificacion[cat];
      const mejor   = pilotos[0]?.totalConPenal || 0;

      if (y + ALTO_BANNER_CLASE + ALTO_FILA > yLimite) {
        doc.addPage();
        y = dibujarEncabezadoPagina(doc, nombreRally, logoData);
        y = dibujarEncabezadoTabla(doc, y, columnas);
      }

      y = dibujarBannerCategoria(doc, cat, columnas, y);

      for (const [idx, p] of pilotos.entries()) {
        if (y + ALTO_FILA > yLimite) {
          doc.addPage();
          y = dibujarEncabezadoPagina(doc, nombreRally, logoData);
          y = dibujarEncabezadoTabla(doc, y, columnas);
        }

        const anterior = idx > 0 ? pilotos[idx - 1].totalConPenal : p.totalConPenal;

        dibujarFila(doc, {
          _pos:      String(idx + 1),
          _piloto:   p.nombre   || '-',
          _vehiculo: p.vehiculo || '-',
          _tiempo:   formatearTiempo(p.tiempoNeto),
          _penal:    p.penalizSegundos > 0 ? formatearTiempo(p.penalizSegundos) : '-',
          _total:    formatearTiempo(p.totalConPenal),
          _dif1:     formatearDiferencia(p.totalConPenal - mejor),
          _difAnt:   formatearDiferencia(p.totalConPenal - anterior),
          _prom:     String(p.prom),
        }, columnas, y, idx % 2 === 0);

        y += ALTO_FILA;
      }
    }

    const totalPaginas = doc.getNumberOfPages();
    dibujarPieDePagina(doc, totalPaginas);

    const hoy = new Date().toISOString().split('T')[0];
    doc.save(`clasif-final-categorias-${hoy}.pdf`);
  }

  // ─── ATAJO DE TECLADO: Ctrl+Shift+P ──────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      generarPDF().catch(err => {
        console.error('Error al generar PDF:', err);
        alert('Ocurrió un error al generar el PDF. Revisá la consola.');
      });
    }
  });

  // Exponer por si se quiere llamar manualmente desde la consola
  window.generarPDFClasificacion = generarPDF;

})();
