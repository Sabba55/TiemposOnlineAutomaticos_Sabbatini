window.UtilidadesCalculos = (function () {

    const { esDNF, tiempoASegundos, segundosATiempo } = window.UtilidadesTiempo;
    const { obtenerPeorTiempo, calcularTiempoDNF } = window.UtilidadesDNF;
    const { obtenerRutaLogoMarca } = window.UtilidadesIconos;
    const { ordenarCategorias } = window.UtilidadesCategorias;

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

    // ── Variantes filtradas por piloto ────────────────────────────────────────
    // Reutilizan las funciones de campo completo pasándoles un pool de un solo
    // piloto: como esas funciones ya buscan "el mejor dentro del pool", con un
    // pool de 1 devuelven directamente los datos propios de ese piloto.

    function _soloPiloto(nombrePiloto, pilotos) {
        return pilotos.filter(p => (p.Nombre || p.NOMBRE) === nombrePiloto);
    }

    function calcularVelocidadMaximaDePiloto(nombrePiloto, categoria, pilotos, tramos) {
        return calcularVelocidadMaxima(categoria, _soloPiloto(nombrePiloto, pilotos), tramos);
    }

    function calcularConsistenciaDePiloto(nombrePiloto, categoria, pilotos, tramos) {
        return calcularPilotoMasConsistente(categoria, _soloPiloto(nombrePiloto, pilotos), tramos);
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

    function calcularTramoMasDisputadoDePiloto(nombrePiloto, categoria, pilotos, tramos) {
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

            const idxPropio = ordenados.findIndex(p => p.nombre === nombrePiloto);
            if (idxPropio <= 0) return; // no participó en el tramo, o fue el ganador (dif. 0 no aporta)

            const ganador = ordenados[0];
            const propio = ordenados[idxPropio];
            const dif = propio.seg - ganador.seg;

            if (dif < menorDif) {
                menorDif = dif;
                resultado = {
                    pe,
                    kms: tramo.KMS || null,
                    nombre: tramo.Desde && tramo.Hasta
                        ? `${tramo.Desde} - ${tramo.Hasta}`
                        : `PE ${pe}`,
                    difSegundos: dif,
                    tiempo1: segundosATiempo(ganador.seg, 3),
                    tiempo2: segundosATiempo(propio.seg, 3),
                    piloto1: ganador.nombre,
                    piloto2: propio.nombre,
                    posicionPropio: idxPropio + 1
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

    function calcularRemontadaPorTiempoDePiloto(nombrePiloto, categoria, pilotos, tramos) {
        const ultimoPE = ultimoPEConDatos(categoria, pilotos, tramos);
        if (ultimoPE < 2) return null;

        const tiemposPorPE = Array.from({ length: ultimoPE }, (_, i) =>
            _tiemposAcumuladosPorPE(i + 1, categoria, pilotos, tramos)
        );

        const tiemposFinal = tiemposPorPE[ultimoPE - 1];
        if (tiemposFinal[nombrePiloto] === undefined) return null;

        const liderFinal = Math.min(...Object.values(tiemposFinal));
        const difFinal = tiemposFinal[nombrePiloto] - liderFinal;

        let peorDif = -Infinity;
        let peorPE = null;

        for (let pe = 1; pe < ultimoPE; pe++) {
            const mapa = tiemposPorPE[pe - 1];
            const propio = mapa[nombrePiloto];
            if (propio === undefined) continue;
            const lider = Math.min(...Object.values(mapa));
            const dif = propio - lider;
            if (dif > peorDif) { peorDif = dif; peorPE = pe; }
        }

        if (peorPE === null) return null;
        const recorte = peorDif - difFinal;

        return { nombre: nombrePiloto, peorDifSegundos: peorDif, difFinalSegundos: difFinal, recorteSegundos: recorte, desdePE: peorPE };
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

    function calcularRemontadaPorPosicionDePiloto(nombrePiloto, categoria, pilotos, tramos) {
        const ultimoPE = ultimoPEConDatos(categoria, pilotos, tramos);
        if (ultimoPE < 2) return null;

        const snapshots = Array.from({ length: ultimoPE }, (_, i) =>
            calcularPosicionesAcumuladas(categoria, i + 1, pilotos, tramos)
        );
        const posicionesFinal = snapshots[ultimoPE - 1];
        const posFin = posicionesFinal[nombrePiloto];
        if (!posFin) return null;

        let peorPos = -Infinity;
        let peorPE = null;

        for (let pe = 1; pe < ultimoPE; pe++) {
            const pos = snapshots[pe - 1][nombrePiloto];
            if (!pos) continue;
            if (pos > peorPos) { peorPos = pos; peorPE = pe; }
        }

        if (peorPE === null) return null;
        const ganancia = peorPos - posFin;

        return { nombre: nombrePiloto, posInicio: peorPos, posFin, ganancia, desdePE: peorPE };
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

    function calcularPosicionesPerdidasDePiloto(nombrePiloto, categoria, pilotos, tramos) {
        const ultimoPE = ultimoPEConDatos(categoria, pilotos, tramos);
        if (ultimoPE < 2) return null;

        const snapshots = Array.from({ length: ultimoPE }, (_, i) =>
            calcularPosicionesAcumuladas(categoria, i + 1, pilotos, tramos)
        );
        const posicionesFinal = snapshots[ultimoPE - 1];
        const posFin = posicionesFinal[nombrePiloto];
        if (!posFin) return null;

        let mejorPos = Infinity;
        let mejorPE = null;

        for (let pe = 1; pe < ultimoPE; pe++) {
            const pos = snapshots[pe - 1][nombrePiloto];
            if (!pos) continue;
            if (pos < mejorPos) { mejorPos = pos; mejorPE = pe; }
        }

        if (mejorPE === null) return null;
        const perdida = posFin - mejorPos;

        return { nombre: nombrePiloto, posMejor: mejorPos, posFin, perdida, desdePE: mejorPE };
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

    // ── Telemetría Visual (Radar Chart / Gráfico de Araña) ────────────────────
    function calcularTelemetriaPiloto(nombrePiloto, categoria, pilotos, tramos) {
        const poolCat = pilotosDeCat(categoria, pilotos, tramos);
        const piloto = poolCat.find(p => (p.Nombre || p.NOMBRE) === nombrePiloto);
        if (!piloto) return null;

        // 1. Ritmo de Carrera (Pace relativo al líder de categoría en cada PE sin DNF)
        let sumaRitmoRelativo = 0;
        let cantPEsRitmo = 0;
        tramos.forEach(t => {
            const col = `SS${t.PE}`;
            if (!piloto[col] || esDNF(piloto[col])) return;
            
            const segPropio = tiempoASegundos(piloto[col]);
            if (segPropio >= 999999) return;

            const tiemposPecat = poolCat
                .filter(p => p[col] && !esDNF(p[col]))
                .map(p => tiempoASegundos(p[col]))
                .filter(s => s < 999999);

            if (tiemposPecat.length === 0) return;
            const mejorSeg = Math.min(...tiemposPecat);

            // % de diferencia con el más rápido (0% = líder, a más % más lento)
            const difPct = mejorSeg > 0 ? ((segPropio - mejorSeg) / mejorSeg) * 100 : 0;
            sumaRitmoRelativo += difPct;
            cantPEsRitmo++;
        });

        // Mapeo: 0% de diferencia = 100 ptos; >=15% de diferencia = 0 ptos
        const ritmoPromedioPct = cantPEsRitmo > 0 ? (sumaRitmoRelativo / cantPEsRitmo) : 15;
        const ritmoPuntaje = Math.max(0, Math.min(100, Math.round(100 - (ritmoPromedioPct * 6.66))));

        // 2. Consistencia (basado en el Desvío Estándar / CV del piloto)
        const datosConsistencia = calcularConsistenciaDePiloto(nombrePiloto, categoria, pilotos, tramos);
        let consistenciaPuntaje = 50; // valor por defecto medio
        if (datosConsistencia && datosConsistencia.desvio) {
            const cv = parseFloat(datosConsistencia.desvio);
            // CV 0% = 100 ptos; CV >= 5% = 0 ptos
            consistenciaPuntaje = Math.max(0, Math.min(100, Math.round(100 - (cv * 20))));
        }

        // 3. Agresividad / Ataque (Evolución en Tramos Repetidos)
        const datosAtaque = calcularAtaquePiloto(nombrePiloto, categoria, pilotos, tramos);
        let ataquePuntaje = 50;
        if (datosAtaque && datosAtaque.mejoraPromedioPct !== null) {
            // Si mejoró un 3% o más = 100 ptos; Si empeoró un -3% o más = 0 ptos
            const pct = datosAtaque.mejoraPromedioPct;
            ataquePuntaje = Math.max(0, Math.min(100, Math.round(50 + (pct * 16.66))));
        }

        // 4. Eficiencia (Penalizaciones y % de DNFs)
        const penRaw = piloto.PENALIZACION || piloto.Penalizacion || '';
        const penSeg = tiempoASegundos(penRaw);
        const tienePenalizacion = penSeg > 0 && penSeg < 999999;

        let peTotales = 0;
        let peCompletados = 0;
        tramos.forEach(t => {
            const col = `SS${t.PE}`;
            if (piloto[col] && piloto[col].trim() !== '') {
                peTotales++;
                if (!esDNF(piloto[col])) peCompletados++;
            }
        });

        const pctCompletado = peTotales > 0 ? (peCompletados / peTotales) : 1;
        let eficienciaPuntaje = Math.round(pctCompletado * 100);
        if (tienePenalizacion) eficienciaPuntaje = Math.max(0, eficienciaPuntaje - 20);

        // 5. Capacidad de Remontada (Posiciones y tiempo recuperado)
        const remPos = calcularRemontadaPorPosicionDePiloto(nombrePiloto, categoria, pilotos, tramos);
        const remTie = calcularRemontadaPorTiempoDePiloto(nombrePiloto, categoria, pilotos, tramos);
        
        let gananciaPos = remPos ? remPos.ganancia : 0;
        let recorteSeg = remTie ? remTie.recorteSegundos : 0;

        // Base 50; +15 ptos por posición ganada y +5 ptos por cada 10s recortados
        let remontadaPuntaje = 50 + (gananciaPos * 15) + (recorteSeg / 2);
        remontadaPuntaje = Math.max(0, Math.min(100, Math.round(remontadaPuntaje)));

        return {
            ritmo: ritmoPuntaje,
            consistencia: consistenciaPuntaje,
            ataque: ataquePuntaje,
            eficiencia: eficienciaPuntaje,
            remontada: remontadaPuntaje
        };
    }

    // ── Métrica de "Ataque" (Evolución en Tramos Repetidos) ──────────────────

    function calcularAtaquePiloto(nombrePiloto, categoria, pilotos, tramos) {
        // Agrupar tramos repetidos por el mismo origen y destino (Desde -> Hasta)
        const gruposPorNombre = {};
        tramos.forEach(t => {
            const desde = (t.Desde || '').trim();
            const hasta = (t.Hasta || '').trim();
            if (!desde || !hasta) return;
            const clave = `${desde} - ${hasta}`;
            if (!gruposPorNombre[clave]) gruposPorNombre[clave] = [];
            gruposPorNombre[clave].push(t);
        });

        const piloto = pilotosDeCat(categoria, pilotos, tramos)
            .find(p => (p.Nombre || p.NOMBRE) === nombrePiloto);
        if (!piloto) return null;

        const comparaciones = [];
        let sumaPorcentajesMejora = 0;

        Object.entries(gruposPorNombre).forEach(([nombreBucle, pes]) => {
            if (pes.length < 2) return; // Se necesitan al menos 2 pasadas por el mismo tramo

            // Tomar la primera pasada y la última pasada del bucle
            const pe1 = pes[0];
            const pe2 = pes[pes.length - 1];

            const t1 = piloto[`SS${pe1.PE}`];
            const t2 = piloto[`SS${pe2.PE}`];

            if (!t1 || !t2 || esDNF(t1) || esDNF(t2)) return;

            const seg1 = tiempoASegundos(t1);
            const seg2 = tiempoASegundos(t2);

            if (seg1 >= 999999 || seg2 >= 999999) return;

            const difSeg = seg1 - seg2; // Si es > 0, mejoró (hizo menos tiempo en el 2° paso)
            const mejoraPct = (difSeg / seg1) * 100;

            sumaPorcentajesMejora += mejoraPct;
            comparaciones.push({
                nombreBucle,
                peInicial: pe1.PE,
                peFinal: pe2.PE,
                tiempoInicial: segundosATiempo(seg1, 2),
                tiempoFinal: segundosATiempo(seg2, 2),
                difSegundos: difSeg,
                mejoraPct: mejoraPct.toFixed(2),
                esMejora: difSeg > 0
            });
        });

        if (comparaciones.length === 0) return null;

        return {
            comparaciones,
            mejoraPromedioPct: (sumaPorcentajesMejora / comparaciones.length)
        };
    }

    // ── Pace / Ritmo Relativo (seg/km vs. Líder) ─────────────────────────────

    function calcularRitmoRelativoPiloto(nombrePiloto, categoria, pilotos, tramos) {
        const poolCat = pilotosDeCat(categoria, pilotos, tramos);
        const piloto = poolCat.find(p => (p.Nombre || p.NOMBRE) === nombrePiloto);
        if (!piloto) return null;

        // Determinar el ganador de la clasificación general de la categoría
        // (posición 1 en el acumulado final, no el más rápido de cada PE individual)
        const ultimoPE = ultimoPEConDatos(categoria, pilotos, tramos);
        if (ultimoPE === 0) return null;

        const posicionesFinales = calcularPosicionesAcumuladas(categoria, ultimoPE, pilotos, tramos);
        const nombreGanador = Object.entries(posicionesFinales).find(([, pos]) => pos === 1)?.[0];
        const ganador = nombreGanador ? poolCat.find(p => (p.Nombre || p.NOMBRE) === nombreGanador) : null;
        if (!ganador) return null;

        const esElGanador = nombrePiloto === (ganador.Nombre || ganador.NOMBRE || '');

        let totalSegDiferencia = 0;
        let totalKmsAnalizados = 0;
        const desglosePorPE = [];

        tramos.forEach(t => {
            const pe = t.PE;
            const col = `SS${pe}`;
            const kms = t.KMS ? parseFloat(t.KMS) : null;
            const tPropio = piloto[col];
            const tGanador = ganador[col];

            if (!kms || isNaN(kms) || kms <= 0 || !tPropio || esDNF(tPropio) || !tGanador || esDNF(tGanador)) {
                return;
            }

            const segPropio = tiempoASegundos(tPropio);
            const segGanador = tiempoASegundos(tGanador);
            if (segPropio >= 999999 || segGanador >= 999999) return;

            const difSeg = segPropio - segGanador; // Diferencia en segundos respecto al ganador de la general
            const segPorKm = difSeg / kms;

            totalSegDiferencia += difSeg;
            totalKmsAnalizados += kms;

            desglosePorPE.push({
                pe,
                kms,
                tiempoPropio: segundosATiempo(segPropio, 2),
                tiempoLider: segundosATiempo(segGanador, 2),
                difSegundos: difSeg,
                segPorKm: segPorKm.toFixed(3),
                esLiderPE: difSeg === 0
            });
        });

        if (totalKmsAnalizados === 0) return null;

        const ritmoGlobalSegKm = totalSegDiferencia / totalKmsAnalizados;

        return {
            nombreGanador: ganador.Nombre || ganador.NOMBRE || '',
            esElGanador,
            ritmoGlobalSegKm: ritmoGlobalSegKm.toFixed(3),
            totalKmsAnalizados: totalKmsAnalizados.toFixed(2),
            totalSegDiferencia: totalSegDiferencia.toFixed(2),
            desglosePorPE
        };
    }

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
        // variantes filtradas por piloto (filtro individual en la fila inferior)
        calcularVelocidadMaximaDePiloto,
        calcularConsistenciaDePiloto,
        calcularTramoMasDisputadoDePiloto,
        calcularRemontadaPorTiempoDePiloto,
        calcularRemontadaPorPosicionDePiloto,
        calcularPosicionesPerdidasDePiloto,

        // telemetría del piloto (panel debajo del filtro individual)
        calcularTelemetriaPiloto,
        calcularAtaquePiloto,
        calcularRitmoRelativoPiloto,

        // helpers reutilizables
        pilotosDeCat,
        ultimoPEConDatos,
    };

})();