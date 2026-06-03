window.UtilidadesEstado = (function () {

    // ── Categoría activa ──────────────────────────────────────────────────────
    let _categoriaActiva = null;

    function getCategoriaActiva() {
        return _categoriaActiva;
    }

    function setCategoriaActiva(categoria) {
        _categoriaActiva = categoria;
        sessionStorage.setItem('categoriaActiva', categoria);
    }

    function getCategoriaGuardada() {
        return sessionStorage.getItem('categoriaActiva');
    }

    // ── Heatmap ───────────────────────────────────────────────────────────────
    const _heatmapFilas = {};   // { tbodyId: string[] }
    const _estadoHeatmap = {};  // { tbodyId: { visible: number } }

    function getHeatmapFilas(tbodyId) {
        return _heatmapFilas[tbodyId] ?? null;
    }

    function setHeatmapFilas(tbodyId, filas) {
        _heatmapFilas[tbodyId] = filas;
    }

    function getEstadoHeatmap(tbodyId) {
        return _estadoHeatmap[tbodyId] ?? null;
    }

    function setEstadoHeatmap(tbodyId, estado) {
        _estadoHeatmap[tbodyId] = estado;
    }

    function deleteEstadoHeatmap(tbodyId) {
        delete _estadoHeatmap[tbodyId];
    }

    return {
        getCategoriaActiva,
        setCategoriaActiva,
        getCategoriaGuardada,
        getHeatmapFilas,
        setHeatmapFilas,
        getEstadoHeatmap,
        setEstadoHeatmap,
        deleteEstadoHeatmap,
    };

})();