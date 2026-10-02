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
  // A4 portrait: 210 x 297 mm  |  A4 landscape: 297 x 210 mm
  // Se ajustan con configurarPagina() según la orientación del PDF a generar.
  const MARGEN_H     = 8;
  const MARGEN_V     = 3;
  let ANCHO_PAGINA = 210;
  let ALTO_PAGINA  = 297;
  let ANCHO_UTIL   = ANCHO_PAGINA - MARGEN_H * 2;

  function configurarPagina(orientacion) {
    const horizontal = orientacion === 'landscape';
    ANCHO_PAGINA = horizontal ? 297 : 210;
    ALTO_PAGINA  = horizontal ? 210 : 297;
    ANCHO_UTIL   = ANCHO_PAGINA - MARGEN_H * 2;
  }

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

  // [PUNTOS-K DESACTIVADO] Tablas de puntos (solo se usaban en Ctrl+Shift+K)
  // const PUNTOS_GENERAL     = [30, 24, 21, 19, 17, 15, 13, 11, 9, 7, 5, 4, 3, 2, 1];
  // const PUNTOS_POWER_STAGE = [5, 4, 3, 2, 1];

  // Logo — ajustá estos valores a gusto
  const ALTO_LOGO  = 7;
  const ANCHO_LOGO = 35;

  // ─── HELPERS DE TIEMPO ───────────────────────────────────────────────────────
  const { tiempoASegundos, esDNF, obtenerTiempoEtapa, segundosATiempo } = window.UtilidadesTiempo;
  const { obtenerPeorTiempo, calcularTiempoDNF } = window.UtilidadesDNF;
  const { ordenarCategorias } = window.UtilidadesCategorias;

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

  // [PUNTOS-K DESACTIVADO] Solo la usaba el cálculo de puntos de campeonato
  // function obtenerPowerStagePE() {
  //   const powerStage = obtenerTramosCarrera().filter(t => (t['Power Stage'] || '').trim().toLowerCase() === 'si');
  //   if (powerStage.length !== 1) return null;
  //   return powerStage[0].PE || null;
  // }

  function contarDNFsHastaPE(piloto, peLimite) {
    let dnfs = 0;

    for (let i = 1; i <= peLimite; i++) {
      const tiempo = piloto[`PE${i}`];
      if (esDNF(tiempo)) {
        dnfs++;
      }
    }

    return dnfs;
  }

  function pilotoSigueActivoEnPE(piloto, peActual) {
    return contarDNFsHastaPE(piloto, peActual - 1) < 3;
  }

  // [PUNTOS-K DESACTIVADO] Conversión de posición a puntos
  // function obtenerPuntosGeneral(posicion) {
  //   return PUNTOS_GENERAL[posicion - 1] || 0;
  // }
  //
  // function obtenerPuntosPowerStage(posicion) {
  //   return PUNTOS_POWER_STAGE[posicion - 1] || 0;
  // }

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
          .filter(p => {
            if ((p.Categoria || p.CATEGORIA) !== cat || !p[col]) return false;
            return pilotoSigueActivoEnPE(p, i);
          })
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
          let dnfsAcumulados = 0;

          for (let i = 1; i <= totalPEs; i++) {
            const col    = `PE${i}`;
            const tiempo = p[col];

            if (!tiempo || tiempo === '') return null;

            if (dnfsAcumulados >= 3) {
              return null;
            }

            if (esDNF(tiempo)) {
              const peor = peoresPorTramoYCategoria[`${i}_${cat}`] || 0;
              totalSegundos += calcularTiempoDNF(peor);
              tuvoDNF = true;
              dnfsAcumulados++;
            } else {
              const seg = tiempoASegundos(tiempo);
              if (seg >= 999999) return null;
              totalSegundos += seg;
            }
          }

          if (dnfsAcumulados >= 3) {
            return null;
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
  function dibujarEncabezadoPagina(doc, nombreRally, logoData, tituloPrincipal = 'CLASIFICACIÓN FINAL POR CATEGORÍA') {
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
      tituloPrincipal,
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

  // ─── PUNTOS CAMPEONATO (Ctrl+Shift+K) — DESACTIVADO ──────────────────────────
  // [PUNTOS-K DESACTIVADO] Columnas de la tabla de puntos
  // function construirColumnasPuntos(doc, todosLosPilotos) {
  //   const medirTexto = (texto, size) => {
  //     doc.setFontSize(size);
  //     return doc.getStringUnitWidth(texto) * size / doc.internal.scaleFactor;
  //   };
  //
  //   let maxPiloto   = medirTexto('PILOTO', FONT_SIZE_HEADER);
  //   let maxVehiculo = medirTexto('VEHICULO', FONT_SIZE_HEADER);
  //
  //   todosLosPilotos.forEach(p => {
  //     const wP = medirTexto(p.nombre || '', FONT_SIZE_FILA);
  //     const wV = medirTexto(p.vehiculo || '', FONT_SIZE_FILA);
  //     if (wP > maxPiloto) maxPiloto = wP;
  //     if (wV > maxVehiculo) maxVehiculo = wV;
  //   });
  //
  //   const PADDING = 3;
  //   const anchoPiloto = Math.ceil(maxPiloto) + PADDING * 2;
  //   const anchoVehiculo = Math.ceil(maxVehiculo) + PADDING * 2;
  //   const anchoGeneral = Math.max(medirTexto('GENERAL', FONT_SIZE_HEADER) + PADDING * 2, 16);
  //   const anchoPower = Math.max(medirTexto('POWER ST.', FONT_SIZE_HEADER) + PADDING * 2, 18);
  //   const anchoTotal = Math.max(medirTexto('TOTAL', FONT_SIZE_HEADER) + PADDING * 2, 14);
  //
  //   const fijos = ANCHO_POS + anchoPiloto + anchoVehiculo + anchoGeneral + anchoPower + anchoTotal;
  //   const escala = fijos > ANCHO_UTIL ? ANCHO_UTIL / fijos : 1;
  //   const esc = v => v * escala;
  //
  //   return [
  //     { label: 'POS',       campo: '_pos',      ancho: esc(ANCHO_POS),      align: 'center', bold: true  },
  //     { label: 'PILOTO',    campo: '_piloto',   ancho: esc(anchoPiloto),    align: 'center', bold: true  },
  //     { label: 'VEHICULO',  campo: '_vehiculo', ancho: esc(anchoVehiculo),  align: 'center', bold: false },
  //     { label: 'GENERAL',   campo: '_general',  ancho: esc(anchoGeneral),   align: 'center', bold: false },
  //     { label: 'POWER ST.', campo: '_power',    ancho: esc(anchoPower),     align: 'center', bold: false },
  //     { label: 'TOTAL',     campo: '_totalPts', ancho: esc(anchoTotal),     align: 'center', bold: true  },
  //   ];
  // }

  // [PUNTOS-K DESACTIVADO] Cálculo de puntos general + power stage
  // function calcularPuntosCampeonatoPorCategorias() {
  //   const clasificacion = calcularClasifPorCategorias();
  //   const categoriasOrdenadas = Object.keys(clasificacion);
  //   const pePowerStage = obtenerPowerStagePE();
  //   const hayPowerStage = Boolean(pePowerStage);
  //   const resultado = {};
  //
  //   categoriasOrdenadas.forEach(cat => {
  //     const pilotosBase = clasificacion[cat].map((p, idx) => ({
  //       ...p,
  //       posicionFinal: idx + 1,
  //       puntosGeneral: obtenerPuntosGeneral(idx + 1),
  //       puntosPower: 0,
  //       totalPuntos: 0,
  //     }));
  //
  //     if (hayPowerStage) {
  //       const campoPS = `PE${pePowerStage}`;
  //       const ordenPowerStage = pilotosBase
  //         .map(p => {
  //           const tiempoPS = p.registro ? p.registro[campoPS] : '';
  //           if (!tiempoPS || esDNF(tiempoPS)) return null;
  //           const segPS = tiempoASegundos(tiempoPS);
  //           if (segPS >= 999999) return null;
  //           return {
  //             clave: p.clave,
  //             segPS,
  //           };
  //         })
  //         .filter(Boolean)
  //         .sort((a, b) => a.segPS - b.segPS);
  //
  //       const puntosPorClave = new Map();
  //       ordenPowerStage.forEach((item, idx) => {
  //         puntosPorClave.set(item.clave, obtenerPuntosPowerStage(idx + 1));
  //       });
  //
  //       pilotosBase.forEach(p => {
  //         p.puntosPower = puntosPorClave.get(p.clave) || 0;
  //         p.totalPuntos = p.puntosGeneral + p.puntosPower;
  //       });
  //     } else {
  //       pilotosBase.forEach(p => {
  //         p.puntosPower = '';
  //         p.totalPuntos = p.puntosGeneral;
  //       });
  //     }
  //
  //     resultado[cat] = pilotosBase;
  //   });
  //
  //   return { resultado, categoriasOrdenadas, hayPowerStage };
  // }

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

    configurarPagina('portrait');

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

  // [PUNTOS-K DESACTIVADO] Generación del PDF de puntos de campeonato
  // async function generarPDFPuntosCampeonato() {
  //   if (typeof window.pilotosData === 'undefined' || window.pilotosData.length === 0) {
  //     alert('Los datos aun no estan cargados. Espera un momento e intenta de nuevo.');
  //     return;
  //   }
  //   if (typeof window.tramosData === 'undefined' || window.tramosData.length === 0) {
  //     alert('No hay datos de tramos cargados.');
  //     return;
  //   }
  //
  //   if (typeof window.jspdf === 'undefined') {
  //     await new Promise((resolve, reject) => {
  //       const script = document.createElement('script');
  //       script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  //       script.onload = resolve;
  //       script.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
  //       document.head.appendChild(script);
  //     });
  //   }
  //
  //   const { jsPDF } = window.jspdf;
  //   const calculo = calcularPuntosCampeonatoPorCategorias();
  //   const categoriasOrdenadas = calculo.categoriasOrdenadas;
  //
  //   if (categoriasOrdenadas.length === 0) {
  //     alert('No hay pilotos con clasificacion valida para generar el PDF de puntos.');
  //     return;
  //   }
  //
  //   const todosLosPilotos = categoriasOrdenadas.flatMap(c => calculo.resultado[c]);
  //   const logoData = await cargarLogo();
  //   const nombreRally = document.getElementById('rallyName')?.textContent || 'Rally';
  //
  //   const doc = new jsPDF({
  //     orientation: 'portrait',
  //     unit: 'mm',
  //     format: 'a4',
  //   });
  //
  //   const columnas = construirColumnasPuntos(doc, todosLosPilotos);
  //   const yLimite = ALTO_PAGINA - MARGEN_V - 8;
  //
  //   let y = dibujarEncabezadoPagina(doc, nombreRally, logoData, 'PUNTOS CAMPEONATO POR CATEGORIA');
  //   y = dibujarEncabezadoTabla(doc, y, columnas);
  //
  //   for (const cat of categoriasOrdenadas) {
  //     const pilotos = calculo.resultado[cat];
  //
  //     if (y + ALTO_BANNER_CLASE + ALTO_FILA > yLimite) {
  //       doc.addPage();
  //       y = dibujarEncabezadoPagina(doc, nombreRally, logoData, 'PUNTOS CAMPEONATO POR CATEGORIA');
  //       y = dibujarEncabezadoTabla(doc, y, columnas);
  //     }
  //
  //     y = dibujarBannerCategoria(doc, cat, columnas, y);
  //
  //     for (const [idx, p] of pilotos.entries()) {
  //       if (y + ALTO_FILA > yLimite) {
  //         doc.addPage();
  //         y = dibujarEncabezadoPagina(doc, nombreRally, logoData, 'PUNTOS CAMPEONATO POR CATEGORIA');
  //         y = dibujarEncabezadoTabla(doc, y, columnas);
  //       }
  //
  //       dibujarFila(doc, {
  //         _pos:      String(idx + 1),
  //         _piloto:   p.nombre || '-',
  //         _vehiculo: p.vehiculo || '-',
  //         _general:  String(p.puntosGeneral),
  //         _power:    calculo.hayPowerStage ? String(p.puntosPower) : ' ',
  //         _totalPts: String(p.totalPuntos),
  //       }, columnas, y, idx % 2 === 0);
  //
  //       y += ALTO_FILA;
  //     }
  //   }
  //
  //   const totalPaginas = doc.getNumberOfPages();
  //   dibujarPieDePagina(doc, totalPaginas);
  //
  //   const hoy = new Date().toISOString().split('T')[0];
  //   doc.save(`puntos-campeonato-${hoy}.pdf`);
  // }

  // ─── LIBRO DE CÓMPUTOS (Ctrl+Shift+K) ────────────────────────────────────────
  // PDF horizontal con una hoja por cada PE (si un PE tiene muchos pilotos ocupa
  // varias hojas, y el siguiente PE siempre arranca en hoja nueva).
  // Replica la lógica de /pages/tramoGeneral.html?pe=N:
  //   · Tabla izquierda → Clasificación P.E.
  //       Pos | Piloto | Tiempo | Dif. 1° | PROM
  //   · Tabla derecha   → Clasificación General hasta ese PE
  //       Pos | Piloto | Clase | Tiempo | Penal. | T. Total | Dif. 1° | Dif. Ant. | PROM
  // Las dos tablas van pegadas (sin espacio) dentro de un contenedor con su header:
  //   [ "PE # | Tramo | kms"                              "Hoja: (n/total)" ]
  //   [ tabla P.E.                | tabla General                         ]
  const TITULO_LIBRO        = 'LIBRO DE CÓMPUTOS - CLASIFICACIÓN PARCIAL Y GENERAL';
  const TEXTO_HEADER_LIBRO  = 'CLASIFICACIÓN PARCIAL Y GENERAL';
  const ALTO_HEADER_LIBRO   = 8;
  const ALTO_FILA_LIBRO_MAX = 6;    // altura de fila cuando hay pocos pilotos
  const ALTO_FILA_LIBRO_MIN = 3.8;  // altura mínima antes de pasar a otra hoja
  const PADDING_LIBRO       = 3;

  const hexARgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

  // Mismos colores que css/tramoGeneral.css
  const COLORES_LIBRO = {
    primeroNro:   hexARgb('#ffab1a'),
    primeroResto: hexARgb('#e7edf5'),
    dnfNro:       hexARgb('#fee2e2'),
    // Fondo del chip de la columna POS. CL. (1°, 2° y 3° de la clase)
    posClase: {
      1: hexARgb('#000000'), // negro
      2: hexARgb('#4b4b4b'), // gris oscuro
      3: hexARgb('#8c8c8c'), // gris claro
    },
    categorias: {
      1:  hexARgb('#ffc988'), // Naranja
      2:  hexARgb('#ffa3a3'), // Rojo
      3:  hexARgb('#ffeb77'), // Amarillo
      4:  hexARgb('#9fc7ff'), // Azul
      5:  hexARgb('#af90ff'), // Violeta
      6:  hexARgb('#6ee0ff'), // Celeste
      7:  hexARgb('#a0f0e1'), // Celeste agua
      8:  hexARgb('#deff97'), // Verde limón
      9:  hexARgb('#eed186'), // Amarillo caramelo
      10: hexARgb('#f2f0e8'), // Blanco
      11: hexARgb('#fca8e3'), // Genérico rosa
      12: hexARgb('#dcdcd5'), // Genérico gris
      13: hexARgb('#c7f5f7'), // Genérico agua
    },
  };

  // Columnas (mismas que tramoGeneral). "min" = ancho mínimo en mm.
  const COLUMNAS_LIBRO_PE = [
    { label: 'POS',     campo: 'pos',    min: 5 },
    { label: 'PILOTO',  campo: 'piloto', min: 0 },
    { label: 'TIEMPO',  campo: 'tiempo', min: 0 },
    { label: 'DIF. 1°', campo: 'dif1',   min: 0 },
    { label: 'PROM',    campo: 'prom',   min: 7 },
  ];
  const COLUMNAS_LIBRO_GENERAL = [
    { label: 'POS',       campo: 'pos',      min: 5 },
    { label: 'PILOTO',    campo: 'piloto',   min: 0 },
    { label: 'CLASE',     campo: 'clase',    min: 0 },
    { label: 'POS. CL.',  campo: 'posClase', min: 5 },
    { label: 'NETO',    campo: 'tiempo',   min: 0 },
    { label: 'PENAL.',    campo: 'penal',    min: 0 },
    { label: 'TOTAL',  campo: 'total',    min: 0 },
    { label: 'DIF. 1°',   campo: 'dif1',     min: 0 },
    { label: 'DIF. ANT.', campo: 'difAnt',   min: 0 },
    { label: 'PROM',      campo: 'prom',     min: 7 },
  ];

  // ── Helpers copiados de js/tramoGeneral.js (misma lógica) ────────────────────
  function obtenerColorCategoriaLibro(categoria) {
    const c = (categoria || '').trim().toUpperCase();

    if (c === 'RC1' || c === 'RALLY1') return 1;
    if (c === 'RC2' || c === 'RALLY2') return 2;
    if (c === 'RCMR') return 3;
    if (c === 'RC4') return 4;
    if (c === 'RC3' || c === 'JUNIOR') return 5;
    if (c === 'RC5') return 6;
    if (c === 'RC6') return 7;
    if (c === 'S1600') return 8;
    if (c === 'WRC' || c === 'WRC 2.0') return 9;
    if (c === 'A' || c === 'GR. A') return 10;

    return null;
  }

  function crearMapaColoresLibro(categorias) {
    const disponibles = [11, 12, 13];
    let siguiente = 0;
    const mapa = {};

    categorias.forEach(cat => {
      const predeterminado = obtenerColorCategoriaLibro(cat);
      if (predeterminado !== null) {
        mapa[cat] = predeterminado;
        return;
      }
      mapa[cat] = disponibles[siguiente % disponibles.length];
      siguiente++;
    });

    return mapa;
  }

  function formatearDifLibro(segundos) {
    if (segundos === 0) return '-';
    const texto = segundosATiempo(segundos, 2).replace(/(\.\d)\d+/, '$1');
    return '+' + texto;
  }

  function velocidadPELibro(segundos, km) {
    if (segundos >= 999999 || !km || km === '') return '-';
    const distancia = parseFloat(km);
    if (isNaN(distancia) || distancia <= 0) return '-';
    return (distancia / (segundos / 3600)).toFixed(0);
  }

  function velocidadTotalLibro(segundos, peNumero, tramos) {
    if (segundos >= 999999) return '-';

    let distanciaTotal = 0;
    for (let i = 1; i <= peNumero; i++) {
      const tramo = tramos.find(t => t.PE === i.toString());
      if (tramo && tramo.KMS) {
        const d = parseFloat(tramo.KMS);
        if (!isNaN(d) && d > 0) distanciaTotal += d;
      }
    }

    if (distanciaTotal === 0) return '-';
    return (distanciaTotal / (segundos / 3600)).toFixed(0);
  }

  function nombreTramoLibro(tramo) {
    if (!tramo) return '';
    const desde = tramo.Desde || '';
    const hasta = tramo.Hasta || '';
    if (desde && hasta) return `${desde} - ${hasta}`;
    return tramo.Nombre || tramo.NOMBRE || '';
  }

  // ── Cálculo de datos por PE (igual que renderizarResultados de tramoGeneral) ─
  function calcularDatosLibro() {
    const pilotos = window.pilotosData;
    const tramos  = window.tramosData.filter(t =>
      String(t.PE || '').trim() !== '' && !esFilaShakedownTramo(t)
    );

    const categorias = ordenarCategorias(
      [...new Set(pilotos.map(p => p.Categoria || p.CATEGORIA))].filter(c => c)
    );
    const mapaColores = crearMapaColoresLibro(categorias);

    const peNumeros = [...new Set(
      tramos
        .map(t => parseInt(String(t.PE).trim(), 10))
        .filter(n => Number.isInteger(n) && n >= 1)
    )].sort((a, b) => a - b);

    // Peor tiempo (sin DNF) de una categoría en un PE — se usa para valuar los DNF
    const cachePeor = {};
    const peorTiempo = (pe, categoria) => {
      const clave = `${pe}_${categoria}`;
      if (!(clave in cachePeor)) {
        const lista = pilotos
          .filter(x => obtenerTiempoEtapa(x, pe) && (x.Categoria || x.CATEGORIA) === categoria)
          .map(x => {
            const valor = obtenerTiempoEtapa(x, pe);
            return { tiempoSegundos: tiempoASegundos(valor), tieneDNF: esDNF(valor) };
          })
          .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);
        cachePeor[clave] = obtenerPeorTiempo(lista);
      }
      return cachePeor[clave];
    };

    return peNumeros.map(peNumero => {
      const peTexto = String(peNumero);
      const tramo   = tramos.find(t => t.PE === peTexto);
      const kms     = tramo ? tramo.KMS : null;

      // ─ Clasificación P.E. (tabla izquierda) ─
      const listaPE = pilotos
        .filter(p => obtenerTiempoEtapa(p, peTexto))
        .map(p => {
          const valor     = obtenerTiempoEtapa(p, peTexto);
          const categoria = p.Categoria || p.CATEGORIA || '';
          return {
            nombre:         p.Nombre || p.NOMBRE || '',
            categoria:      categoria,
            colorIdx:       mapaColores[categoria] || 1,
            tiempo:         valor,
            tiempoSegundos: tiempoASegundos(valor),
            tieneDNF:       esDNF(valor),
          };
        })
        .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

      const peorPorCategoria = {};
      categorias.forEach(cat => { peorPorCategoria[cat] = peorTiempo(peTexto, cat); });

      listaPE.forEach(p => {
        if (p.tieneDNF) {
          p.tiempoSegundos = calcularTiempoDNF(peorPorCategoria[p.categoria] || 0);
          p.tiempo         = segundosATiempo(p.tiempoSegundos, 2);
        }
      });
      listaPE.sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

      const mejorPE = listaPE.length > 0 ? listaPE[0].tiempoSegundos : 0;

      const filasPE = listaPE.map((p, i) => ({
        valores: {
          pos:    String(i + 1),
          piloto: p.nombre,
          tiempo: p.tieneDNF ? 'DNF' : p.tiempo,
          dif1:   formatearDifLibro(p.tiempoSegundos - mejorPE),
          prom:   velocidadPELibro(p.tiempoSegundos, kms),
        },
        estilo: {
          tipo:     i === 0 ? 'pos1' : (p.tieneDNF ? 'dnf' : 'categoria'),
          colorIdx: p.colorIdx,
        },
      }));

      // ─ Clasificación General hasta este PE (tabla derecha) ─
      const listaGeneral = pilotos
        .map(p => {
          const categoria = p.Categoria || p.CATEGORIA;
          let total    = 0;
          let tuvoDNF  = false;

          for (let i = 1; i <= peNumero; i++) {
            const tiempo = obtenerTiempoEtapa(p, i);
            if (!tiempo || tiempo === '') return null;

            if (esDNF(tiempo)) {
              total  += calcularTiempoDNF(peorTiempo(i, categoria));
              tuvoDNF = true;
            } else {
              const seg = tiempoASegundos(tiempo);
              if (seg >= 999999) return null;
              total += seg;
            }
          }

          const penal    = tiempoASegundos(p.PENALIZACION || p.Penalizacion || '');
          const penalSeg = penal < 999999 ? penal : 0;

          return {
            nombre:     p.Nombre || p.NOMBRE || '',
            categoria:  p.Categoria || p.CATEGORIA || '',
            total:      total,
            penalSeg:   penalSeg,
            totalFinal: total + penalSeg,
            tieneDNF:   tuvoDNF,
          };
        })
        .filter(p => p !== null)
        .sort((a, b) => a.totalFinal - b.totalFinal);

      const mejorGeneral = listaGeneral.length > 0 ? listaGeneral[0].totalFinal : 0;

      const posicionesPorClase = {};

      listaGeneral.forEach(p => {
        if (!posicionesPorClase[p.categoria]) {
          posicionesPorClase[p.categoria] = 0;
        }

        posicionesPorClase[p.categoria]++;
        p.posClase = posicionesPorClase[p.categoria];
      });

      const filasGeneral = listaGeneral.map((p, i) => {
        const difAnt = i > 0 ? p.totalFinal - listaGeneral[i - 1].totalFinal : 0;
        return {
          valores: {
            pos:    String(i + 1),
            piloto: p.nombre,
            clase:  p.categoria,
            posClase: String(p.posClase),
            tiempo: segundosATiempo(p.total, 3),
            penal:  p.penalSeg > 0 ? segundosATiempo(p.penalSeg, 2) : '-',
            total:  segundosATiempo(p.totalFinal, 3),
            dif1:   formatearDifLibro(p.totalFinal - mejorGeneral),
            difAnt: formatearDifLibro(difAnt),
            prom:   velocidadTotalLibro(p.totalFinal, peNumero, tramos),
          },
          estilo: {
            tipo:        i === 0 ? 'pos1' : (p.tieneDNF ? 'dnf' : 'normal'),
            penalActiva: p.penalSeg > 0,
          },
        };
      });

      const kmsTexto = kms && String(kms).trim() !== '' ? `${String(kms).trim()} km` : '';
      const tituloPE = [`PE ${peNumero}`, nombreTramoLibro(tramo), kmsTexto]
        .filter(Boolean)
        .join(' | ');

      return { peNumero, tituloPE, filasPE, filasGeneral };
    }).filter(d => d.filasPE.length > 0 || d.filasGeneral.length > 0);
  }

  // ── Columnas: ancho automático según contenido, escalado al ancho útil ───────
  function construirColumnasLibro(doc, datos) {
    const medir = (texto, size, bold) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      return doc.getStringUnitWidth(String(texto)) * size / doc.internal.scaleFactor;
    };

    const anchoNatural = (espec, filas) => {
      let max = medir(espec.label, FONT_SIZE_HEADER, true);
      filas.forEach(f => {
        const w = medir(f.valores[espec.campo] ?? '', FONT_SIZE_FILA, true);
        if (w > max) max = w;
      });
      return Math.max(espec.min, Math.ceil(max) + PADDING_LIBRO * 2);
    };

    const filasPE      = datos.flatMap(d => d.filasPE);
    const filasGeneral = datos.flatMap(d => d.filasGeneral);

    const izq = COLUMNAS_LIBRO_PE.map(e => ({ ...e, ancho: anchoNatural(e, filasPE) }));
    const der = COLUMNAS_LIBRO_GENERAL.map(e => ({ ...e, ancho: anchoNatural(e, filasGeneral) }));

    // La columna PILOTO tiene el mismo ancho en las dos tablas
    const anchoPiloto = Math.max(
      izq.find(c => c.campo === 'piloto').ancho,
      der.find(c => c.campo === 'piloto').ancho
    );
    izq.find(c => c.campo === 'piloto').ancho = anchoPiloto;
    der.find(c => c.campo === 'piloto').ancho = anchoPiloto;

    // Escalar para que las dos tablas juntas ocupen todo el ancho útil
    const suma  = [...izq, ...der].reduce((s, c) => s + c.ancho, 0);
    const k     = ANCHO_UTIL / suma;
    izq.forEach(c => { c.ancho *= k; });
    der.forEach(c => { c.ancho *= k; });

    return {
      izq,
      der,
      anchoIzq: izq.reduce((s, c) => s + c.ancho, 0),
    };
  }

  // ── Dibujo ───────────────────────────────────────────────────────────────────
  function dibujarHeaderContenedorLibro(doc, y, textoIzq, textoDer) {
    doc.setFillColor(...COLORES.bannerCategoria);
    doc.rect(MARGEN_H, y, ANCHO_UTIL, ALTO_HEADER_LIBRO, 'F');

    const yTexto = y + ALTO_HEADER_LIBRO / 2 + 8 * 0.35 / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORES.textoClaro);
    doc.text(textoIzq, MARGEN_H + 4, yTexto);
    if (textoDer) doc.text(textoDer, MARGEN_H + ANCHO_UTIL - 4, yTexto, { align: 'right' });
  }

  function dibujarEncabezadoTablaLibro(doc, x0, y, columnas) {
    const anchoTabla = columnas.reduce((s, c) => s + c.ancho, 0);

    doc.setFillColor(...COLORES.encabezadoTabla);
    doc.rect(x0, y, anchoTabla, ALTO_ENC_TABLA, 'F');

    let x = x0;
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
  }

  function dibujarFilaLibro(doc, x0, y, altoFila, fontSize, columnas, fila, indice) {
    const { valores, estilo } = fila;
    const impar = indice % 2 === 0;
    const rellenoBase = impar ? COLORES.filaImpar : COLORES.filaPar;

    let x = x0;
    columnas.forEach((col, i) => {
      // Fondo de la celda
      let relleno = rellenoBase;
      if (estilo.tipo === 'pos1') {
        relleno = COLORES_LIBRO.categorias[estilo.colorIdx] || rellenoBase;
      } else if (estilo.tipo === 'dnf' && i === 0) {
        relleno = COLORES_LIBRO.dnfNro;
      } else if (estilo.tipo === 'categoria') {
        relleno = COLORES_LIBRO.categorias[estilo.colorIdx] || rellenoBase;
      }
      doc.setFillColor(...relleno);
      doc.rect(x, y, col.ancho, altoFila, 'F');

      // Bordes de la celda
      doc.setDrawColor(...COLORES.borde);
      doc.setLineWidth(0.10);
      doc.line(x, y + altoFila, x + col.ancho, y + altoFila);
      if (i < columnas.length - 1) doc.line(x + col.ancho, y, x + col.ancho, y + altoFila);

      // Texto
      const valor = String(valores[col.campo] ?? '-');
      const negrita = estilo.tipo !== 'dnf' && (
        col.campo === 'pos' ||
        estilo.tipo === 'pos1' ||
        (col.campo === 'penal' && estilo.penalActiva)
      );
      const rojo = estilo.tipo === 'dnf' || (col.campo === 'penal' && estilo.penalActiva);

      doc.setFont('helvetica', negrita ? 'bold' : 'normal');
      let fs = fontSize;
      doc.setFontSize(fs);
      const ancho = doc.getStringUnitWidth(valor) * fs / doc.internal.scaleFactor;
      if (ancho > col.ancho - 1) {
        fs = Math.max(4.5, fs * (col.ancho - 1) / ancho);
        doc.setFontSize(fs);
      }

      let colorTexto = rojo ? COLORES.rojo : COLORES.texto;
      let yTexto     = y + altoFila / 2 + fs * 0.35 / 2;

      // POS. CL.: "chip" cuadrado según posición en la clase (1° negro, 2° gris oscuro, 3° gris claro, resto solo borde)
      if (col.campo === 'posClase' && /^\d+$/.test(valor)) {
        const posCl   = parseInt(valor, 10);
        const altoChip  = Math.min(altoFila - 0.8, 4.6);
        const anchoChip = Math.min(col.ancho - 0.8, Math.max(altoChip, ancho + 1.6));
        const xChip     = x + (col.ancho - anchoChip) / 2;
        const yChip     = y + (altoFila - altoChip) / 2;
        const fondoChip = COLORES_LIBRO.posClase[posCl];

        if (fondoChip) {
          doc.setFillColor(...fondoChip);
          doc.rect(xChip, yChip, anchoChip, altoChip, 'F');
          colorTexto = [255, 255, 255];
        } else {
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.08);
          doc.rect(xChip, yChip, anchoChip, altoChip, 'S');
        }

        // Centrado vertical exacto del dígito dentro del chip (alto de cifra ≈ 0.72 × fuente)
        yTexto = yChip + altoChip / 2 + (fs * 0.3528 * 0.72) / 2;
      }

      doc.setTextColor(...colorTexto);
      doc.text(valor, x + col.ancho / 2, yTexto, { align: 'center' });

      x += col.ancho;
    });
  }

  async function asegurarJsPDF() {
    if (typeof window.jspdf === 'undefined') {
      await new Promise((resolve, reject) => {
        const script   = document.createElement('script');
        script.src     = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload  = resolve;
        script.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
        document.head.appendChild(script);
      });
    }
    return window.jspdf.jsPDF;
  }

  // ── Función principal ────────────────────────────────────────────────────────
  async function generarPDFLibroComputos() {
    if (typeof window.pilotosData === 'undefined' || window.pilotosData.length === 0) {
      alert('Los datos aún no están cargados. Esperá un momento e intentá de nuevo.');
      return;
    }
    if (typeof window.tramosData === 'undefined' || window.tramosData.length === 0) {
      alert('No hay datos de tramos cargados.');
      return;
    }

    const datos = calcularDatosLibro();
    if (datos.length === 0) {
      alert('Todavía no hay tiempos cargados para generar el Libro de Cómputos.');
      return;
    }

    const jsPDF       = await asegurarJsPDF();
    const logoData    = await cargarLogo();
    const nombreRally = document.getElementById('rallyName')?.textContent || 'Rally';

    configurarPagina('landscape');

    const doc = new jsPDF({
      orientation: 'landscape',
      unit:        'mm',
      format:      'a4',
    });

    const columnas = construirColumnasLibro(doc, datos);
    const xIzq     = MARGEN_H;
    const xDer     = xIzq + columnas.anchoIzq;

    // Página 1: encabezado de siempre (logo + título + rally + línea)
    const yHeader   = dibujarEncabezadoPagina(doc, nombreRally, logoData, TITULO_LIBRO);
    const yEncTabla = yHeader + ALTO_HEADER_LIBRO;
    const yFilas0   = yEncTabla + ALTO_ENC_TABLA;
    const yLimite   = ALTO_PAGINA - MARGEN_V - 8;
    const disponible = yLimite - yFilas0;

    let paginaLista = true; // la página 1 ya tiene su encabezado
    const abrirPagina = () => {
      if (!paginaLista) {
        doc.addPage();
        dibujarEncabezadoPagina(doc, nombreRally, logoData, TITULO_LIBRO);
      }
      paginaLista = false;
    };

    for (const d of datos) {
      const maxFilas      = Math.max(d.filasPE.length, d.filasGeneral.length);
      const maxPorHoja    = Math.max(1, Math.floor(disponible / ALTO_FILA_LIBRO_MIN));
      const totalHojas    = Math.max(1, Math.ceil(maxFilas / maxPorHoja));
      const filasPorHoja  = Math.max(1, Math.ceil(maxFilas / totalHojas));
      const altoFila      = Math.min(ALTO_FILA_LIBRO_MAX, disponible / filasPorHoja);
      const fontFila      = Math.min(FONT_SIZE_FILA, Math.max(5.5, altoFila * 1.4));

      for (let hoja = 0; hoja < totalHojas; hoja++) {
        abrirPagina();

        const desde    = hoja * filasPorHoja;
        const hasta    = desde + filasPorHoja;
        const filasIzq = d.filasPE.slice(desde, hasta);
        const filasDer = d.filasGeneral.slice(desde, hasta);
        const n        = Math.max(filasIzq.length, filasDer.length);
        const yFin     = yFilas0 + n * altoFila;

        // Header del contenedor: "PE # | Tramo | kms" a la izquierda, "Hoja: (n/total)" a la derecha
        const textoHoja = totalHojas > 1 ? `Hoja: (${hoja + 1}/${totalHojas})` : '';
        dibujarHeaderContenedorLibro(doc, yHeader, d.tituloPE, textoHoja);

        // Las dos tablas, pegadas
        dibujarEncabezadoTablaLibro(doc, xIzq, yEncTabla, columnas.izq);
        dibujarEncabezadoTablaLibro(doc, xDer, yEncTabla, columnas.der);

        filasIzq.forEach((fila, i) => {
          dibujarFilaLibro(doc, xIzq, yFilas0 + i * altoFila, altoFila, fontFila, columnas.izq, fila, desde + i);
        });
        filasDer.forEach((fila, i) => {
          dibujarFilaLibro(doc, xDer, yFilas0 + i * altoFila, altoFila, fontFila, columnas.der, fila, desde + i);
        });

        // Divisoria entre las dos tablas
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.6);
        doc.line(xDer, yEncTabla, xDer, yFilas0);
        doc.setDrawColor(...COLORES.encabezadoTabla);
        doc.setLineWidth(0.5);
        doc.line(xDer, yFilas0, xDer, yFin);

        // Borde del contenedor
        doc.setDrawColor(...COLORES.encabezadoTabla);
        doc.setLineWidth(0.4);
        doc.rect(MARGEN_H, yHeader, ANCHO_UTIL, yFin - yHeader, 'S');
      }
    }

    dibujarPieDePagina(doc, doc.getNumberOfPages());

    const hoy = new Date().toISOString().split('T')[0];
    doc.save(`libro-de-computos-${hoy}.pdf`);
  }

  // ─── ATAJOS DE TECLADO: Ctrl+Shift+P / Ctrl+Shift+K ──────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      generarPDF().catch(err => {
        console.error('Error al generar PDF:', err);
        alert('Ocurrió un error al generar el PDF. Revisá la consola.');
      });
    }
    // Ctrl+Shift+K → Libro de Cómputos (PDF horizontal, una hoja por PE)
    else if (e.ctrlKey && e.shiftKey && e.key === 'K') {
      e.preventDefault();
      generarPDFLibroComputos().catch(err => {
        console.error('Error al generar el Libro de Cómputos:', err);
        alert('Ocurrió un error al generar el Libro de Cómputos. Revisá la consola.');
      });
    }
  });

  // Exponer por si se quiere llamar manualmente desde la consola
  window.generarPDFClasificacion = generarPDF;
  window.generarPDFLibroComputos = generarPDFLibroComputos;
  // [PUNTOS-K DESACTIVADO]
  // window.generarPDFPuntosCampeonato = generarPDFPuntosCampeonato;

})();