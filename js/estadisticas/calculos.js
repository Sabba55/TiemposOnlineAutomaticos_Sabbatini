window.UtilidadesCalculos = (function () {

    const { esDNF, tiempoASegundos, segundosATiempo } = window.UtilidadesTiempo;
    const { obtenerPeorTiempo, calcularTiempoDNF } = window.UtilidadesDNF;
    const { obtenerRutaLogoMarca } = window.UtilidadesIconos;

    // ── Helpers internos ──────────────────────────────────────────────────────

    function pilotoParticipo(piloto, tramos) {
        return tramos.some(t => {
            const tiempo = piloto[`SS${t.PE}`];
            return tiempo && tiempo.trim() !== '';
        });
    }

    function pilotosDeCat(categoria, pilotos, tramos) {
        return pilotos.filter(p =>
            (p.Categoria || p.CATEGORIA) === categoria && pilotoParticipo(p, tramos)
        );
    }

    function ultimoPEConDatos(categoria, pilotos, tramos) {
        for (let i = tramos.length; i >= 1; i--) {
            const col = `SS${i}`;
            const hay = pilotosDeCat(categoria, pilotos, tramos)
                .some(p => p[col] && p[col].trim() !== '');
            if (hay) return i;
        }
        return 0;
    }

    function calcularTotalAcumulado(piloto, hastaPE, categoria, pilotos, tramos) {
        let total = 0;
        for (let i = 1; i <= hastaPE; i++) {
            const col = `SS${i}`;
            const tiempo = piloto[col];
            if (!tiempo || tiempo.trim() === '') return null;

            if (esDNF(tiempo)) {
                const grupo = pilotosDeCat(categoria, pilotos, tramos)
                    .filter(p => p[col])
                    .map(p => ({ tiempoSegundos: tiempoASegundos(p[col]), tieneDNF: esDNF(p[col]) }));
                total += calcularTiempoDNF(obtenerPeorTiempo(grupo));
            } else {
                const seg = tiempoASegundos(tiempo);
                if (seg >= 999999) return null;
                total += seg;
            }
        }
        return total;
    }

    // ── Categorías ────────────────────────────────────────────────────────────

    function obtenerPrioridadCategoria(categoria) {
        const cat = (categoria || '').trim().toUpperCase();
        if (cat === 'RC2' || cat === 'RALLY2') return 0;
        if (cat === 'RCMR') return 1;
        return 2;
    }

    function ordenarCategorias(categorias) {
        return [...categorias].sort((a, b) => {
            const diff = obtenerPrioridadCategoria(a) - obtenerPrioridadCategoria(b);
            return diff !== 0 ? diff : a.localeCompare(b, 'es');
        });
    }

    function obtenerCategoriasConTiempos(pilotos, tramos) {
        const cats = new Set();
        pilotos.forEach(piloto => {
            const categoria = piloto.Categoria || piloto.CATEGORIA;
            if (!categoria) return;
            if (tramos.some(t => {
                const tiempo = piloto[`SS${t.PE}`];
                return tiempo && tiempo.trim() !== '';
            })) {
                cats.add(categoria);
            }
        });
        return ordenarCategorias([...cats]);
    }

    function hayTiemposRegistrados(pilotos, tramos) {
        return pilotos.some(piloto =>
            tramos.some(t => {
                const tiempo = piloto[`SS${t.PE}`];
                return tiempo && tiempo.trim() !== '';
            })
        );
    }

    // ── Posiciones acumuladas ─────────────────────────────────────────────────

    function calcularPosicionesAcumuladas(categoria, hastaPE, pilotos, tramos) {
        const ordenados = pilotosDeCat(categoria, pilotos, tramos)
            .map(piloto => {
                const total = calcularTotalAcumulado(piloto, hastaPE, categoria, pilotos, tramos);
                if (total === null) return null;

                const pen = tiempoASegundos(piloto.PENALIZACION || piloto.Penalizacion || '');
                const penSeg = pen < 999999 ? pen : 0;

                return {
                    nombre: piloto.Nombre || piloto.NOMBRE || '',
                    total: total + penSeg
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.total - b.total);

        const posiciones = {};
        ordenados.forEach((p, i) => { posiciones[p.nombre] = i + 1; });
        return posiciones;
    }

    // ── Resumen ───────────────────────────────────────────────────────────────

    function calcularTotalInscriptos(categoria, pilotos, inscriptos = []) {
        const fuente = Array.isArray(inscriptos) && inscriptos.length > 0 ? inscriptos : pilotos;
        return fuente.filter(p => (p.Categoria || p.CATEGORIA) === categoria).length;
    }

    function calcularInscriptos(categoria, pilotos, tramos) {
        return pilotosDeCat(categoria, pilotos, tramos).length;
    }

    function calcularDNFs(categoria, pilotos, tramos) {
        return pilotosDeCat(categoria, pilotos, tramos).filter(piloto =>
            tramos.some(t => {
                const tiempo = piloto[`SS${t.PE}`];
                return tiempo && esDNF(tiempo);
            })
        ).length;
    }

    function calcularPorcentajeSinDNF(categoria, pilotos, tramos) {
        const lista = pilotosDeCat(categoria, pilotos, tramos);
        if (lista.length === 0) return null;

        const sinDNF = lista.filter(piloto =>
            !tramos.some(t => {
                const tiempo = piloto[`SS${t.PE}`];
                return tiempo && esDNF(tiempo);
            })
        ).length;

        return {
            porcentaje: Math.round((sinDNF / lista.length) * 100),
            sinDNF,
            total: lista.length
        };
    }

    // ── Ganadores por tramo ───────────────────────────────────────────────────

    function calcularGanadoresPorTramo(categoria, pilotos, tramos) {
        return tramos
            .map(tramo => {
                const pe = tramo.PE;
                const col = `SS${pe}`;
                const distancia = tramo.KMS ? parseFloat(tramo.KMS) : null;

                const ordenados = pilotosDeCat(categoria, pilotos, tramos)
                    .filter(p => p[col] && p[col].trim() !== '')
                    .map(p => ({
                        nombre: p.Nombre || p.NOMBRE || '',
                        tiempoSegundos: tiempoASegundos(p[col]),
                        esDNF: esDNF(p[col])
                    }))
                    .filter(p => !p.esDNF && p.tiempoSegundos < 999999)
                    .sort((a, b) => a.tiempoSegundos - b.tiempoSegundos);

                if (ordenados.length === 0) return null;

                const ganador = ordenados[0];
                const velocidad = distancia && !isNaN(distancia) && distancia > 0
                    ? (distancia / (ganador.tiempoSegundos / 3600)).toFixed(0)
                    : '-';

                return {
                    pe,
                    nombre: tramo.Desde && tramo.Hasta
                        ? `${tramo.Desde} - ${tramo.Hasta}`
                        : `PE ${pe}`,
                    ganador: ganador.nombre,
                    tiempo: segundosATiempo(ganador.tiempoSegundos, 2),
                    velocidad
                };
            })
            .filter(Boolean);
    }

    function calcularMayorGanador(ganadoresPorTramo) {
        const conteo = {};
        ganadoresPorTramo.forEach(({ ganador }) => {
            conteo[ganador] = (conteo[ganador] || 0) + 1;
        });

        const ordenados = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
        if (ordenados.length === 0) return null;

        const maxVictorias = ordenados[0][1];
        const todosDistintos = maxVictorias === 1 && ordenados.length > 1;
        const lideres = ordenados
            .filter(([, v]) => v === maxVictorias)
            .map(([nombre, victorias]) => ({ nombre, victorias }));

        return { lideres, todosDistintos };
    }

    function calcularMarcaMasGanadora(ganadoresPorTramo, categoria, pilotos, tramos) {
        const conteo = {};
        ganadoresPorTramo.forEach(({ ganador }) => {
            const piloto = pilotosDeCat(categoria, pilotos, tramos)
                .find(p => (p.Nombre || p.NOMBRE) === ganador);
            if (!piloto) return;

            const vehiculo = piloto.Vehiculo || piloto.VEHICULO || piloto.vehiculo || '';
            const marca = vehiculo.trim().split(' ')[0];
            if (!marca) return;

            conteo[marca] = (conteo[marca] || 0) + 1;
        });

        const ordenados = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
        if (ordenados.length === 0) return null;

        const maxVictorias = ordenados[0][1];
        const marcasLideres = ordenados
            .filter(([, v]) => v === maxVictorias)
            .map(([marca, victorias]) => ({ marca, victorias }));

        return { marcasLideres, todosDistintos: maxVictorias === 1 && ordenados.length > 1 };
    }

    // ── Velocidad máxima ──────────────────────────────────────────────────────

    function calcularVelocidadMaxima(categoria, pilotos, tramos) {
        let maxVelocidad = 0;
        let resultado = null;

        tramos.forEach(tramo => {
            const pe = tramo.PE;
            const col = `SS${pe}`;
            const distancia = tramo.KMS ? parseFloat(tramo.KMS) : null;
            if (!distancia || isNaN(distancia) || distancia <= 0) return;

            pilotosDeCat(categoria, pilotos, tramos)
                .filter(p => p[col] && !esDNF(p[col]))
                .forEach(piloto => {
                    const seg = tiempoASegundos(piloto[col]);
                    if (seg >= 999999) return;

                    const velocidad = distancia / (seg / 3600);
                    if (velocidad > maxVelocidad) {
                        maxVelocidad = velocidad;
                        resultado = {
                            velocidad: velocidad.toFixed(0),
                            piloto: piloto.Nombre || piloto.NOMBRE || '',
                            pe: `PE ${pe}`,
                            kms: tramo.KMS,
                            tiempo: segundosATiempo(seg, 2)
                        };
                    }
                });
        });

        return resultado;
    }

    // ── Tramo más disputado ───────────────────────────────────────────────────

    function calcularTramoMasDisputado(categoria, pilotos, tramos) {
        let menorDif = Infinity;
        let resultado = null;

        tramos.forEach(tramo => {
            const pe = tramo.PE;
            const col = `SS${pe}`;

            const ordenados = pilotosDeCat(categoria, pilotos, tramos)
                .filter(p => p[col] && p[col].trim() !== '' && !esDNF(p[col]))
                .map(p => ({
                    nombre: p.Nombre || p.NOMBRE || '',
                    seg: tiempoASegundos(p[col])
                }))
                .filter(p => p.seg < 999999)
                .sort((a, b) => a.seg - b.seg);

            if (ordenados.length < 2) return;

            const dif = ordenados[1].seg - ordenados[0].seg;
            if (dif < menorDif) {
                menorDif = dif;
                resultado = {
                    pe,
                    kms: tramo.KMS || null,
                    nombre: tramo.Desde && tramo.Hasta
                        ? `${tramo.Desde} - ${tramo.Hasta}`
                        : `PE ${pe}`,
                    difSegundos: dif,
                    tiempo1: segundosATiempo(ordenados[0].seg, 3),
                    tiempo2: segundosATiempo(ordenados[1].seg, 3),
                    piloto1: ordenados[0].nombre,
                    piloto2: ordenados[1].nombre
                };
            }
        });

        return resultado;
    }

    // ── Piloto más consistente ────────────────────────────────────────────────

    function calcularPilotoMasConsistente(categoria, pilotos, tramos) {
        const gruposPorNombre = {};
        tramos.forEach(tramo => {
            const desde = (tramo.Desde || '').trim();
            const hasta  = (tramo.Hasta  || '').trim();
            if (!desde || !hasta) return;
            const clave = `${desde} - ${hasta}`;
            if (!gruposPorNombre[clave]) gruposPorNombre[clave] = [];
            gruposPorNombre[clave].push(tramo.PE);
        });

        const gruposRepetidos = Object.entries(gruposPorNombre)
            .filter(([, pes]) => pes.length >= 2);

        if (gruposRepetidos.length === 0) return null;

        const candidatos = pilotosDeCat(categoria, pilotos, tramos)
            .map(piloto => {
                const cvsPorGrupo = [];

                gruposRepetidos.forEach(([, pes]) => {
                    const tiemposDelGrupo = pes
                        .map(pe => {
                            const tiempo = piloto[`SS${pe}`];
                            if (!tiempo || tiempo.trim() === '' || esDNF(tiempo)) return null;
                            const seg = tiempoASegundos(tiempo);
                            return seg < 999999 ? seg : null;
                        })
                        .filter(Boolean);

                    if (tiemposDelGrupo.length < 2) return;

                    const promedio = tiemposDelGrupo.reduce((a, b) => a + b, 0) / tiemposDelGrupo.length;
                    const varianza = tiemposDelGrupo.reduce((s, t) => s + Math.pow(t - promedio, 2), 0) / tiemposDelGrupo.length;
                    const cv = promedio > 0 ? (Math.sqrt(varianza) / promedio) * 100 : 0;
                    cvsPorGrupo.push(cv);
                });

                if (cvsPorGrupo.length === 0) return null;

                return {
                    nombre: piloto.Nombre || piloto.NOMBRE || '',
                    cv: cvsPorGrupo.reduce((a, b) => a + b, 0) / cvsPorGrupo.length
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.cv - b.cv);

        if (candidatos.length === 0) return null;

        return {
            nombre: candidatos[0].nombre,
            desvio: candidatos[0].cv.toFixed(2)
        };
    }

    // ── Remontadas ────────────────────────────────────────────────────────────

    function _tiemposAcumuladosPorPE(hastaPE, categoria, pilotos, tramos) {
        const mapa = {};
        pilotosDeCat(categoria, pilotos, tramos).forEach(piloto => {
            let total = 0;
            for (let i = 1; i <= hastaPE; i++) {
                const col = `SS${i}`;
                const t = piloto[col];
                if (!t || t.trim() === '') return;
                if (esDNF(t)) {
                    const grupo = pilotosDeCat(categoria, pilotos, tramos)
                        .filter(p => p[col])
                        .map(p => ({ tiempoSegundos: tiempoASegundos(p[col]), tieneDNF: esDNF(p[col]) }));
                    total += calcularTiempoDNF(obtenerPeorTiempo(grupo));
                } else {
                    const seg = tiempoASegundos(t);
                    if (seg >= 999999) return;
                    total += seg;
                }
            }
            const pen = tiempoASegundos(piloto.PENALIZACION || piloto.Penalizacion || '');
            mapa[piloto.Nombre || piloto.NOMBRE || ''] = total + (pen < 999999 ? pen : 0);
        });
        return mapa;
    }

    function calcularRemontadaPorTiempo(categoria, pilotos, tramos) {
        const ultimoPE = ultimoPEConDatos(categoria, pilotos, tramos);
        if (ultimoPE < 2) return null;

        const tiemposPorPE = Array.from({ length: ultimoPE }, (_, i) =>
            _tiemposAcumuladosPorPE(i + 1, categoria, pilotos, tramos)
        );

        const tiemposFinal = tiemposPorPE[ultimoPE - 1];
        const liderFinal = Math.min(...Object.values(tiemposFinal));

        let mejorRemontada = null;
        let mejorRecorte = -Infinity;

        Object.entries(tiemposFinal).forEach(([nombre, tiempoFinal]) => {
            const difFinal = tiempoFinal - liderFinal;

            let peorDif = -Infinity;
            let peorPE = null;

            for (let pe = 1; pe < ultimoPE; pe++) {
                const mapa = tiemposPorPE[pe - 1];
                const propio = mapa[nombre];
                if (propio === undefined) continue;
                const lider = Math.min(...Object.values(mapa));
                const dif = propio - lider;
                if (dif > peorDif) { peorDif = dif; peorPE = pe; }
            }

            if (peorPE === null) return;
            const recorte = peorDif - difFinal;
            if (recorte > mejorRecorte) {
                mejorRecorte = recorte;
                mejorRemontada = { nombre, peorDifSegundos: peorDif, difFinalSegundos: difFinal, recorteSegundos: recorte, desdePE: peorPE };
            }
        });

        return mejorRemontada?.recorteSegundos > 0 ? mejorRemontada : null;
    }

    function calcularRemontadaPorPosicion(categoria, pilotos, tramos) {
        const ultimoPE = ultimoPEConDatos(categoria, pilotos, tramos);
        if (ultimoPE < 2) return null;

        const snapshots = Array.from({ length: ultimoPE }, (_, i) =>
            calcularPosicionesAcumuladas(categoria, i + 1, pilotos, tramos)
        );
        const posicionesFinal = snapshots[ultimoPE - 1];

        let mejorRemontada = null;
        let mejorGanancia = -Infinity;

        Object.keys(posicionesFinal).forEach(nombre => {
            const posFin = posicionesFinal[nombre];
            let peorPos = -Infinity;
            let peorPE = null;

            for (let pe = 1; pe < ultimoPE; pe++) {
                const pos = snapshots[pe - 1][nombre];
                if (!pos) continue;
                if (pos > peorPos) { peorPos = pos; peorPE = pe; }
            }

            if (peorPE === null || peorPos <= posFin) return;
            const ganancia = peorPos - posFin;
            if (ganancia > mejorGanancia) {
                mejorGanancia = ganancia;
                mejorRemontada = { nombre, posInicio: peorPos, posFin, ganancia, desdePE: peorPE };
            }
        });

        return mejorRemontada;
    }

    function calcularPilotoMasPosicionesPerdidas(categoria, pilotos, tramos) {
        const ultimoPE = ultimoPEConDatos(categoria, pilotos, tramos);
        if (ultimoPE < 2) return null;

        const snapshots = Array.from({ length: ultimoPE }, (_, i) =>
            calcularPosicionesAcumuladas(categoria, i + 1, pilotos, tramos)
        );
        const posicionesFinal = snapshots[ultimoPE - 1];

        let peorCaso = null;
        let mayorPerdida = -Infinity;

        Object.keys(posicionesFinal).forEach(nombre => {
            const posFin = posicionesFinal[nombre];
            let mejorPos = Infinity;
            let mejorPE = null;

            for (let pe = 1; pe < ultimoPE; pe++) {
                const pos = snapshots[pe - 1][nombre];
                if (!pos) continue;
                if (pos < mejorPos) { mejorPos = pos; mejorPE = pe; }
            }

            if (mejorPE === null || mejorPos >= posFin) return;
            const perdida = posFin - mejorPos;
            if (perdida > mayorPerdida) {
                mayorPerdida = perdida;
                peorCaso = { nombre, posMejor: mejorPos, posFin, perdida, desdePE: mejorPE };
            }
        });

        return peorCaso;
    }

    // ── Evolución Top 5 ───────────────────────────────────────────────────────

    function calcularEvolucionTop5(categoria, pilotos, tramos) {
        const ultimoPE = ultimoPEConDatos(categoria, pilotos, tramos);
        if (ultimoPE === 0) return null;

        const snapshots = Array.from({ length: ultimoPE }, (_, i) =>
            calcularPosicionesAcumuladas(categoria, i + 1, pilotos, tramos)
        );

        const pilotosEnTop5 = new Set();
        snapshots.forEach(snap => {
            Object.entries(snap)
                .filter(([, pos]) => pos <= 5)
                .forEach(([nombre]) => pilotosEnTop5.add(nombre));
        });

        if (pilotosEnTop5.size === 0) return null;

        const series = [...pilotosEnTop5].map(nombre => {
            const puntos = [];
            for (let pe = 1; pe <= ultimoPE; pe++) {
                const pos = snapshots[pe - 1][nombre];
                if (pos !== undefined && pos <= 5) puntos.push({ pe, pos });
            }
            const posFinal = snapshots[ultimoPE - 1][nombre] ?? null;
            return { nombre, puntos, posFinal };
        });

        series.sort((a, b) => (a.posFinal ?? 999) - (b.posFinal ?? 999));

        return { series, totalPEs: ultimoPE };
    }

    // ── Heatmap ───────────────────────────────────────────────────────────────

    function calcularDatosHeatmap(categoria, pilotos, tramos) {
        const ultimoPE = ultimoPEConDatos(categoria, pilotos, tramos);
        if (ultimoPE === 0) return null;

        const listaPilotos = pilotosDeCat(categoria, pilotos, tramos);
        if (listaPilotos.length === 0) return null;

        const posicionesFinales = calcularPosicionesAcumuladas(categoria, ultimoPE, pilotos, tramos);

        const pilotosOrdenados = Object.entries(posicionesFinales)
            .sort((a, b) => a[1] - b[1])
            .map(([nombre]) => listaPilotos.find(p => (p.Nombre || p.NOMBRE) === nombre))
            .filter(Boolean);

        const ganadorFinal = pilotosOrdenados[0];
        if (!ganadorFinal) return null;

        return { pilotosOrdenados, ganadorFinal, posicionesFinales, ultimoPE };
    }

    // ── Extras ───────────────────────────────────────────────────────────────

    function calcularKmsTotales(tramos) {
        let total = 0;
        tramos.forEach(t => {
            const kms = parseFloat(t.KMS);
            if (!isNaN(kms) && kms > 0) total += kms;
        });
        return total > 0 ? total.toFixed(2) : null;
    }

    function calcularResumenGeneral(pilotos, tramos, inscriptos = []) {
        const participaron = pilotos.filter(p =>
            tramos.some(t => {
                const tiempo = p[`SS${t.PE}`];
                return tiempo && tiempo.trim() !== '';
            })
        );

        const totalInscriptos = Array.isArray(inscriptos) && inscriptos.length > 0
            ? inscriptos.length
            : pilotos.length;
        const largaron = participaron.length;

        const dnfs = participaron.filter(p =>
            tramos.some(t => {
                const tiempo = p[`SS${t.PE}`];
                return tiempo && esDNF(tiempo);
            })
        ).length;

        const sinDNF = participaron.filter(p =>
            !tramos.some(t => {
                const tiempo = p[`SS${t.PE}`];
                return tiempo && esDNF(tiempo);
            })
        ).length;

        const porcentaje = largaron > 0 ? Math.round((sinDNF / largaron) * 100) : null;

        return { totalInscriptos, largaron, dnfs, sinDNF, porcentaje };
    }

    function calcularTramoMasRapidoGeneral(pilotos, tramos) {
        let maxVelocidad = 0;
        let resultado = null;

        tramos.forEach(tramo => {
            const pe = tramo.PE;
            const col = `SS${pe}`;
            const distancia = tramo.KMS ? parseFloat(tramo.KMS) : null;
            if (!distancia || isNaN(distancia) || distancia <= 0) return;

            pilotos
                .filter(p => p[col] && !esDNF(p[col]))
                .forEach(piloto => {
                    const seg = tiempoASegundos(piloto[col]);
                    if (seg >= 999999) return;

                    const velocidad = distancia / (seg / 3600);
                    if (velocidad > maxVelocidad) {
                        maxVelocidad = velocidad;
                        resultado = {
                            velocidad: velocidad.toFixed(0),
                            piloto: piloto.Nombre || piloto.NOMBRE || '',
                            categoria: piloto.Categoria || piloto.CATEGORIA || '',
                            pe: `PE ${pe}`,
                            kms: tramo.KMS,
                            tiempo: segundosATiempo(seg, 2)
                        };
                    }
                });
        });

        return resultado;
    }

    function calcularTramoMasDisputadoGeneral(pilotos, tramos) {
        let menorDif = Infinity;
        let resultado = null;

        tramos.forEach(tramo => {
            const pe = tramo.PE;
            const col = `SS${pe}`;

            const ordenados = pilotos
                .filter(p => p[col] && p[col].trim() !== '' && !esDNF(p[col]))
                .map(p => ({
                    nombre: p.Nombre || p.NOMBRE || '',
                    seg: tiempoASegundos(p[col])
                }))
                .filter(p => p.seg < 999999)
                .sort((a, b) => a.seg - b.seg);

            if (ordenados.length < 2) return;

            const dif = ordenados[1].seg - ordenados[0].seg;
            if (dif < menorDif) {
                menorDif = dif;
                resultado = {
                    pe,
                    nombre: tramo.Desde && tramo.Hasta
                        ? `${tramo.Desde} - ${tramo.Hasta}`
                        : `PE ${pe}`,
                    difSegundos: dif,
                    tiempo1: segundosATiempo(ordenados[0].seg, 3),
                    tiempo2: segundosATiempo(ordenados[1].seg, 3),
                    piloto1: ordenados[0].nombre,
                    piloto2: ordenados[1].nombre
                };
            }
        });

        return resultado;
    }

    function calcularPilotoMayoresSanciones(pilotos, tramos) {
        const candidatos = pilotos
            .filter(p => tramos.some(t => {
                const tiempo = p[`SS${t.PE}`];
                return tiempo && tiempo.trim() !== '';
            }))
            .map(p => {
                const pen = tiempoASegundos(p.PENALIZACION || p.Penalizacion || '');
                const penSeg = pen < 999999 ? pen : 0;
                return {
                    nombre: p.Nombre || p.NOMBRE || '',
                    categoria: p.Categoria || p.CATEGORIA || '',
                    penSeg,
                    penDisplay: penSeg > 0 ? segundosATiempo(penSeg, 2) : null
                };
            })
            .filter(p => p.penSeg > 0)
            .sort((a, b) => b.penSeg - a.penSeg);

        return candidatos.length > 0 ? candidatos[0] : null;
    }

    function calcularPilotoMasConsistenteGeneral(pilotos, tramos) {
        const gruposPorNombre = {};
        tramos.forEach(tramo => {
            const desde = (tramo.Desde || '').trim();
            const hasta  = (tramo.Hasta  || '').trim();
            if (!desde || !hasta) return;
            const clave = `${desde} - ${hasta}`;
            if (!gruposPorNombre[clave]) gruposPorNombre[clave] = [];
            gruposPorNombre[clave].push(tramo.PE);
        });

        const gruposRepetidos = Object.entries(gruposPorNombre)
            .filter(([, pes]) => pes.length >= 2);

        if (gruposRepetidos.length === 0) return null;

        const participaron = pilotos.filter(p =>
            tramos.some(t => {
                const tiempo = p[`SS${t.PE}`];
                return tiempo && tiempo.trim() !== '';
            })
        );

        const candidatos = participaron
            .map(piloto => {
                const cvsPorGrupo = [];

                gruposRepetidos.forEach(([, pes]) => {
                    const tiemposDelGrupo = pes
                        .map(pe => {
                            const tiempo = piloto[`SS${pe}`];
                            if (!tiempo || tiempo.trim() === '' || esDNF(tiempo)) return null;
                            const seg = tiempoASegundos(tiempo);
                            return seg < 999999 ? seg : null;
                        })
                        .filter(Boolean);

                    if (tiemposDelGrupo.length < 2) return;

                    const promedio = tiemposDelGrupo.reduce((a, b) => a + b, 0) / tiemposDelGrupo.length;
                    const varianza = tiemposDelGrupo.reduce((s, t) => s + Math.pow(t - promedio, 2), 0) / tiemposDelGrupo.length;
                    const cv = promedio > 0 ? (Math.sqrt(varianza) / promedio) * 100 : 0;
                    cvsPorGrupo.push(cv);
                });

                if (cvsPorGrupo.length === 0) return null;

                return {
                    nombre: piloto.Nombre || piloto.NOMBRE || '',
                    categoria: piloto.Categoria || piloto.CATEGORIA || '',
                    cv: cvsPorGrupo.reduce((a, b) => a + b, 0) / cvsPorGrupo.length
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.cv - b.cv);

        if (candidatos.length === 0) return null;

        return {
            nombre: candidatos[0].nombre,
            categoria: candidatos[0].categoria,
            desvio: candidatos[0].cv.toFixed(2)
        };
    }

    function calcularTablasMarcas(pilotos, tramos) {
        const categorias = [...new Set(pilotos.map(p => p.Categoria || p.CATEGORIA).filter(Boolean))];
        const marcas = {};

        const participaron = pilotos.filter(p =>
            tramos.some(t => {
                const tiempo = p[`SS${t.PE}`];
                return tiempo && tiempo.trim() !== '';
            })
        );

        participaron.forEach(piloto => {
            const vehiculo = piloto.Vehiculo || piloto.VEHICULO || piloto.vehiculo || '';
            const marca = vehiculo.trim().split(' ')[0];
            if (!marca) return;

            if (!marcas[marca]) {
                marcas[marca] = {
                    marca,
                    largaron: 0,
                    finalizaron: 0,
                    victoriasPE: 0,
                    victoriasPorCategoria: {}
                };
            }
            marcas[marca].largaron++;

            const finalizo = tramos.every(t => {
                const tiempo = piloto[`SS${t.PE}`];
                return tiempo && tiempo.trim() !== '' && !esDNF(tiempo);
            });
            if (finalizo) marcas[marca].finalizaron++;
        });

        categorias.forEach(categoria => {
            tramos.forEach(tramo => {
                const pe = tramo.PE;
                const col = `SS${pe}`;

                const ordenados = participaron
                    .filter(p => (p.Categoria || p.CATEGORIA) === categoria)
                    .filter(p => p[col] && p[col].trim() !== '' && !esDNF(p[col]))
                    .map(p => ({
                        vehiculo: p.Vehiculo || p.VEHICULO || p.vehiculo || '',
                        seg: tiempoASegundos(p[col])
                    }))
                    .filter(p => p.seg < 999999)
                    .sort((a, b) => a.seg - b.seg);

                if (ordenados.length === 0) return;

                const marcaGanadora = ordenados[0].vehiculo.trim().split(' ')[0];
                if (!marcaGanadora || !marcas[marcaGanadora]) return;
                marcas[marcaGanadora].victoriasPE++;

                const vc = marcas[marcaGanadora].victoriasPorCategoria;
                vc[categoria] = (vc[categoria] || 0) + 1;
            });
        });

        return Object.values(marcas)
            .sort((a, b) => b.victoriasPE - a.victoriasPE || b.largaron - a.largaron);
    }

    function calcularTramoConMasDNFs(pilotos, tramos) {
        let maxDNFs = 0;
        let resultado = null;

        tramos.forEach(tramo => {
            const pe = tramo.PE;
            const col = `SS${pe}`;

            const dnfs = pilotos.filter(p => {
                const tiempo = p[col];
                return tiempo && esDNF(tiempo);
            }).length;

            if (dnfs > maxDNFs) {
                maxDNFs = dnfs;
                resultado = {
                    pe,
                    nombre: tramo.Desde && tramo.Hasta
                        ? `${tramo.Desde} - ${tramo.Hasta}`
                        : `PE ${pe}`,
                    dnfs,
                    kms: tramo.KMS || null
                };
            }
        });

        return resultado?.dnfs > 0 ? resultado : null;
    }

    // ─────────────────────────────────────────────────────────────────────────

    return {
        obtenerCategoriasConTiempos,
        calcularPosicionesAcumuladas,
        calcularTotalInscriptos,
        calcularInscriptos,
        calcularDNFs,
        calcularPorcentajeSinDNF,
        calcularGanadoresPorTramo,
        calcularMayorGanador,
        calcularMarcaMasGanadora,
        calcularVelocidadMaxima,
        calcularTramoMasDisputado,
        calcularPilotoMasConsistente,
        calcularRemontadaPorTiempo,
        calcularRemontadaPorPosicion,
        calcularPilotoMasPosicionesPerdidas,
        calcularEvolucionTop5,
        calcularDatosHeatmap,
        hayTiemposRegistrados,
        calcularKmsTotales,
        calcularResumenGeneral,
        calcularTramoMasRapidoGeneral,
        calcularTramoMasDisputadoGeneral,
        calcularPilotoMayoresSanciones,
        calcularPilotoMasConsistenteGeneral,
        calcularTablasMarcas,
        calcularTramoConMasDNFs,
        // helpers reutilizables
        pilotosDeCat,
        ultimoPEConDatos,
    };

})();
