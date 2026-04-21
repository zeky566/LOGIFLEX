// Invocamos a express y creamos una instancia de la aplicación
const express = require('express');
const app = express();
const path = require('path');
const XLSX = require('xlsx');
const multer = require('multer');


// capturar datos de formularios
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// dotenv
const dotenv = require('dotenv');
dotenv.config({ path: './env/.env' });

// carpeta public
app.use('/resources', express.static('public'));
app.use('/resources', express.static(__dirname + '/public'));

// motor de vistas
app.set('view engine', 'ejs');

// bcrypt
const bcrypt = require('bcryptjs');

// sesiones
const session = require('express-session');
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

// conexión base de datos
const connection = require('./database/db');

// Helper para consultas MySQL con Promesas
function queryDb(sql, params = []) {
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}
// Multer en memoria: permite recibir archivos Excel sin guardarlos en disco.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }
});

// Reglas rápidas de autorización para rutas exclusivas del panel admin.
function isAdmin(req) {
    return req.session.loggedin && req.session.rol === 'admin';
}

// Elimina función de consultas MySQL, ahora se usará MongoDB Atlas.

// Devuelve alias de identidad para comparar nombre visible y usuario interno.
async function getUserAliasesByRole(role, sessionName, sessionUser) {
    const aliases = new Set();
    const addAlias = (value) => {
        const raw = String(value || '').trim();
        if (raw) aliases.add(raw.toLowerCase());
    };

    addAlias(sessionName);
    addAlias(sessionUser);

    if (!role) {
        return Array.from(aliases);
    }

    const orFilters = [];
    const values = [role];

    if (String(sessionName || '').trim()) {
        orFilters.push('LOWER(TRIM(name)) = ?');
        values.push(String(sessionName).trim().toLowerCase());
    }

    if (String(sessionUser || '').trim()) {
        orFilters.push('LOWER(TRIM(user)) = ?');
        values.push(String(sessionUser).trim().toLowerCase());
    }

    if (orFilters.length > 0) {
        const rows = await queryDb(`
            SELECT user, name
            FROM users
            WHERE rol = ?
              AND (${orFilters.join(' OR ')})
            LIMIT 5
        `, values);

        (Array.isArray(rows) ? rows : []).forEach(row => {
            addAlias(row.user);
            addAlias(row.name);
        });
    }

    return Array.from(aliases);
}

// Crea la tabla de vehículos solo si no existe (auto inicialización del módulo de flota).
async function ensureVehiclesTable() {
    await queryDb(`
        CREATE TABLE IF NOT EXISTS vehicles (
            id INT NOT NULL AUTO_INCREMENT,
            placas VARCHAR(30) NOT NULL,
            numero_unidad VARCHAR(50) DEFAULT '',
            marca VARCHAR(80) DEFAULT '',
            modelo VARCHAR(80) DEFAULT '',
            anio INT DEFAULT NULL,
            tipo_vehiculo VARCHAR(60) DEFAULT '',
            vin VARCHAR(50) DEFAULT '',
            capacidad_carga VARCHAR(60) DEFAULT '',
            tipo_combustible VARCHAR(40) DEFAULT '',
            kilometraje_actual INT DEFAULT NULL,
            estado_vehiculo VARCHAR(60) DEFAULT 'activo',
            tarjeta_circulacion VARCHAR(150) DEFAULT '',
            seguro VARCHAR(150) DEFAULT '',
            vencimiento_seguro DATE DEFAULT NULL,
            verificacion_vehicular VARCHAR(150) DEFAULT '',
            permisos_licencias VARCHAR(255) DEFAULT '',
            propietario_vehiculo VARCHAR(120) DEFAULT '',
            fecha_registro DATE DEFAULT NULL,
            fecha_ultimo_servicio DATE DEFAULT NULL,
            tipo_servicio VARCHAR(120) DEFAULT '',
            proximo_mantenimiento DATE DEFAULT NULL,
            historial_mantenimiento TEXT,
            cambio_aceite VARCHAR(120) DEFAULT '',
            cambio_llantas VARCHAR(120) DEFAULT '',
            costo_servicio DECIMAL(10,2) DEFAULT NULL,
            conductor_asignado VARCHAR(120) DEFAULT '',
            ruta_asignada VARCHAR(180) DEFAULT '',
            disponibilidad VARCHAR(60) DEFAULT '',
            ubicacion VARCHAR(180) DEFAULT '',
            historial_viajes TEXT,
            consumo_combustible VARCHAR(80) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_placas (placas)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

// Crea la tabla de viajes para control logístico extremo a extremo.
async function ensureTripsTable() {
    await queryDb(`
        CREATE TABLE IF NOT EXISTS trips (
            id INT NOT NULL AUTO_INCREMENT,
            trip_id VARCHAR(40) NOT NULL,
            fecha_salida DATE DEFAULT NULL,
            fecha_llegada_estimada DATE DEFAULT NULL,
            estado_viaje VARCHAR(40) DEFAULT 'programado',
            tipo_viaje VARCHAR(40) DEFAULT '',
            origen VARCHAR(150) DEFAULT '',
            destino VARCHAR(150) DEFAULT '',
            direccion_carga VARCHAR(255) DEFAULT '',
            direccion_entrega VARCHAR(255) DEFAULT '',
            distancia_estimada DECIMAL(10,2) DEFAULT NULL,
            tiempo_estimado VARCHAR(80) DEFAULT '',
            vehiculo_asignado VARCHAR(120) DEFAULT '',
            conductor VARCHAR(120) DEFAULT '',
            ayudante VARCHAR(120) DEFAULT '',
            capacidad_utilizada VARCHAR(80) DEFAULT '',
            tipo_mercancia VARCHAR(120) DEFAULT '',
            peso DECIMAL(10,2) DEFAULT NULL,
            volumen DECIMAL(10,2) DEFAULT NULL,
            cantidad_paquetes INT DEFAULT NULL,
            valor_mercancia DECIMAL(12,2) DEFAULT NULL,
            cliente VARCHAR(120) DEFAULT '',
            hora_salida VARCHAR(20) DEFAULT '',
            hora_llegada VARCHAR(20) DEFAULT '',
            ubicacion_actual VARCHAR(180) DEFAULT '',
            paradas TEXT,
            incidentes TEXT,
            observaciones TEXT,
            combustible DECIMAL(10,2) DEFAULT NULL,
            peajes DECIMAL(10,2) DEFAULT NULL,
            viaticos DECIMAL(10,2) DEFAULT NULL,
            costo_total DECIMAL(12,2) DEFAULT NULL,
            ganancia DECIMAL(12,2) DEFAULT NULL,
            orden_transporte VARCHAR(180) DEFAULT '',
            factura VARCHAR(180) DEFAULT '',
            carta_porte VARCHAR(180) DEFAULT '',
            comprobante_entrega VARCHAR(180) DEFAULT '',
            firma_cliente VARCHAR(180) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_trip_id (trip_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

// Crea tabla de gastos reportados por chofer para control operativo.
async function ensureDriverExpensesTable() {
    await queryDb(`
        CREATE TABLE IF NOT EXISTS driver_expenses (
            id INT NOT NULL AUTO_INCREMENT,
            chofer VARCHAR(120) NOT NULL,
            tipo_gasto VARCHAR(60) NOT NULL,
            monto DECIMAL(12,2) NOT NULL,
            descripcion VARCHAR(255) DEFAULT '',
            fecha DATE DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

// Crea tabla de calificaciones que clientes asignan a choferes por viaje.
async function ensureDriverRatingsTable() {
    await queryDb(`
        CREATE TABLE IF NOT EXISTS driver_ratings (
            id INT NOT NULL AUTO_INCREMENT,
            trip_id VARCHAR(40) NOT NULL,
            chofer VARCHAR(120) NOT NULL,
            cliente VARCHAR(120) NOT NULL,
            rating TINYINT NOT NULL,
            comentario VARCHAR(255) DEFAULT '',
            fecha DATE DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_trip_cliente (trip_id, cliente),
            KEY idx_chofer (chofer)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

// Asegura que la tabla users tenga columna telefono para altas desde registro web.
async function ensureUsersPhoneColumn() {
    const columns = await queryDb("SHOW COLUMNS FROM users LIKE 'telefono'");
    if (!Array.isArray(columns) || columns.length === 0) {
        await queryDb("ALTER TABLE users ADD COLUMN telefono VARCHAR(30) DEFAULT '' AFTER name");
    }
}

// Convierte valores numéricos de Excel a entero o null cuando vienen vacíos/no válidos.
function parseNullableInt(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const numberValue = Number(String(value).trim());
    return Number.isFinite(numberValue) ? Math.trunc(numberValue) : null;
}

// Convierte números decimales (incluye coma decimal) a Number o null.
function parseNullableDecimal(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const normalized = String(value).trim().replace(',', '.');
    const numberValue = Number(normalized);
    return Number.isFinite(numberValue) ? numberValue : null;
}

// Normaliza fechas recibidas desde Excel/string al formato YYYY-MM-DD o null.
function parseNullableDate(value) {
    if (!value && value !== 0) return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }

    const stringValue = String(value).trim();
    if (!stringValue) return null;

    const parsed = new Date(stringValue);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
}

function formatDateToYMD(dateValue) {
    const dt = new Date(dateValue);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
}

function generateTripId() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 900 + 100);
    return `TR-${y}${m}${d}-${h}${min}${sec}-${rand}`;
}


// ================= RUTAS =================

// login
app.get('/login', (req, res) => {
    res.render('login');
});

// registro
app.get('/register', (req, res) => {
    res.render('register');
});

// rutas generales
app.get('/ubicacion', (req, res) => {
    res.render('ubicacion');
});

app.get('/viajes', (req, res) => {
    res.render('viajes');
});

app.get('/gastos', (req, res) => {
    res.render('gastos');
});


// ================= PROTECCIÓN DE RUTAS =================

// admin
app.get('/admin', async (req, res) => {

    if (!isAdmin(req)) {
        return res.redirect('/');
    }

    // Mensajes de feedback para la importación/exportación de USUARIOS.
    const usersExcelStatus = String(req.query.usersExcelStatus || '').toLowerCase();
    const usersExcelSummary = String(req.query.usersExcelSummary || '');
    const usersExcelType = usersExcelStatus === 'ok' ? 'success' : (usersExcelStatus === 'error' ? 'error' : '');
    const usersExcelMessage = usersExcelSummary;

    // Mensajes de feedback para la importación/exportación de VEHICULOS.
    const vehiclesExcelStatus = String(req.query.vehiclesExcelStatus || '').toLowerCase();
    const vehiclesExcelSummary = String(req.query.vehiclesExcelSummary || '');
    const vehiclesExcelType = vehiclesExcelStatus === 'ok' ? 'success' : (vehiclesExcelStatus === 'error' ? 'error' : '');
    const vehiclesExcelMessage = vehiclesExcelSummary;

    // Mensajes de feedback para importación/exportación de VIAJES.
    const tripsExcelStatus = String(req.query.tripsExcelStatus || '').toLowerCase();
    const tripsExcelSummary = String(req.query.tripsExcelSummary || '');
    const tripsExcelType = tripsExcelStatus === 'ok' ? 'success' : (tripsExcelStatus === 'error' ? 'error' : '');
    const tripsExcelMessage = tripsExcelSummary;

    try {
        await ensureUsersPhoneColumn();
        // Garantiza que la tabla de vehículos exista antes de consultar.
        await ensureVehiclesTable();
        // Garantiza estructura de viajes.
        await ensureTripsTable();
        // Garantiza tabla de gastos de chofer para reportes financieros.
        await ensureDriverExpensesTable();

        // Obtiene usuarios para el dashboard (clientes, choferes y admins).
        const users = await queryDb(`
            SELECT user, name, rol, COALESCE(telefono, '') AS telefono
            FROM users
            WHERE rol IN ('cliente', 'chofer', 'admin')
            ORDER BY rol ASC, name ASC
        `);

        // Obtiene catálogo completo de vehículos para la tarjeta de flota.
        const vehicles = await queryDb(`
            SELECT *
            FROM vehicles
            ORDER BY conductor_asignado ASC, placas ASC
        `);

        // Obtiene viajes para el nuevo módulo de control logístico.
        const trips = await queryDb(`
            SELECT *
            FROM trips
            ORDER BY fecha_salida DESC, trip_id ASC
        `);

        const driverExpenses = await queryDb(`
            SELECT *
            FROM driver_expenses
            ORDER BY COALESCE(fecha, created_at) DESC, id DESC
        `);

        const usuarios = Array.isArray(users) ? users : [];
        const dbClientes = usuarios.filter(u => u.rol === 'cliente');
        const dbChoferes = usuarios.filter(u => u.rol === 'chofer');
        const dbAdmins = usuarios.filter(u => u.rol === 'admin');
        const dbVehiculos = Array.isArray(vehicles) ? vehicles : [];
        const dbViajes = Array.isArray(trips) ? trips : [];
        const dbDriverExpenses = Array.isArray(driverExpenses) ? driverExpenses : [];

        return res.render('admin', {
            name: req.session.name,
            userName: req.session.name,
            userRol: req.session.rol,
            dbClientes,
            dbChoferes,
            dbAdmins,
            dbVehiculos,
            dbViajes,
            dbDriverExpenses,
            usersExcelType,
            usersExcelMessage,
            vehiclesExcelType,
            vehiclesExcelMessage,
            tripsExcelType,
            tripsExcelMessage
        });
    } catch (error) {
        console.log('Error al cargar panel admin:', error);
        return res.render('admin', {
            name: req.session.name,
            userName: req.session.name,
            userRol: req.session.rol,
            dbClientes: [],
            dbChoferes: [],
            dbAdmins: [],
            dbVehiculos: [],
            dbViajes: [],
            dbDriverExpenses: [],
            usersExcelType,
            usersExcelMessage,
            vehiclesExcelType: 'error',
            vehiclesExcelMessage: 'No se pudieron cargar los datos de vehículos.',
            tripsExcelType: 'error',
            tripsExcelMessage: 'No se pudieron cargar los datos de viajes.'
        });
    }

});

app.get('/admin/vehicles-excel', async (req, res) => {

    if (!isAdmin(req)) {
        return res.redirect('/');
    }

    try {
        // Exporta el estado actual de la flota a Excel para edición masiva.
        await ensureVehiclesTable();
        const vehicles = await queryDb('SELECT * FROM vehicles ORDER BY conductor_asignado ASC, placas ASC');

        // Cada fila lleva accion=mantener por defecto para evitar cambios accidentales.
        const exportRows = (vehicles || []).map(v => ({
            accion: 'mantener',
            placas: v.placas || '',
            numero_unidad: v.numero_unidad || '',
            marca: v.marca || '',
            modelo: v.modelo || '',
            anio: v.anio || '',
            tipo_vehiculo: v.tipo_vehiculo || '',
            vin: v.vin || '',
            capacidad_carga: v.capacidad_carga || '',
            tipo_combustible: v.tipo_combustible || '',
            kilometraje_actual: v.kilometraje_actual || '',
            estado_vehiculo: v.estado_vehiculo || '',
            tarjeta_circulacion: v.tarjeta_circulacion || '',
            seguro: v.seguro || '',
            vencimiento_seguro: v.vencimiento_seguro || '',
            verificacion_vehicular: v.verificacion_vehicular || '',
            permisos_licencias: v.permisos_licencias || '',
            propietario_vehiculo: v.propietario_vehiculo || '',
            fecha_registro: v.fecha_registro || '',
            fecha_ultimo_servicio: v.fecha_ultimo_servicio || '',
            tipo_servicio: v.tipo_servicio || '',
            proximo_mantenimiento: v.proximo_mantenimiento || '',
            historial_mantenimiento: v.historial_mantenimiento || '',
            cambio_aceite: v.cambio_aceite || '',
            cambio_llantas: v.cambio_llantas || '',
            costo_servicio: v.costo_servicio || '',
            conductor_asignado: v.conductor_asignado || '',
            ruta_asignada: v.ruta_asignada || '',
            disponibilidad: v.disponibilidad || '',
            ubicacion: v.ubicacion || '',
            historial_viajes: v.historial_viajes || '',
            consumo_combustible: v.consumo_combustible || ''
        }));

        // Orden explícito de columnas en Excel.
        const headers = [
            'accion', 'placas', 'numero_unidad', 'marca', 'modelo', 'anio', 'tipo_vehiculo', 'vin',
            'capacidad_carga', 'tipo_combustible', 'kilometraje_actual', 'estado_vehiculo',
            'tarjeta_circulacion', 'seguro', 'vencimiento_seguro', 'verificacion_vehicular',
            'permisos_licencias', 'propietario_vehiculo', 'fecha_registro', 'fecha_ultimo_servicio',
            'tipo_servicio', 'proximo_mantenimiento', 'historial_mantenimiento', 'cambio_aceite',
            'cambio_llantas', 'costo_servicio', 'conductor_asignado', 'ruta_asignada',
            'disponibilidad', 'ubicacion', 'historial_viajes', 'consumo_combustible'
        ];

        // Hoja principal de datos + hoja de instrucciones.
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: headers });
        worksheet['!cols'] = headers.map(() => ({ wch: 22 }));
        XLSX.utils.book_append_sheet(workbook, worksheet, 'vehiculos');

        const helpSheet = XLSX.utils.aoa_to_sheet([
            ['Instrucciones'],
            ['accion: mantener | agregar | actualizar | borrar'],
            ['placas: obligatorio y único por vehículo'],
            ['Para agregar/actualizar: completa la información disponible'],
            ['Fechas: formato recomendado YYYY-MM-DD'],
            ['estado_vehiculo sugerido: activo | mantenimiento | fuera de servicio']
        ]);
        helpSheet['!cols'] = [{ wch: 90 }];
        XLSX.utils.book_append_sheet(workbook, helpSheet, 'instrucciones');

        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const fileName = `vehiculos_flota_${new Date().toISOString().slice(0, 10)}.xlsx`;

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);
    } catch (error) {
        console.log('Error al exportar Excel de vehículos:', error);
        res.redirect('/admin?vehiclesExcelStatus=error&vehiclesExcelSummary=' + encodeURIComponent('No se pudo generar el Excel de vehículos.'));
    }
});

app.post('/admin/vehicles-excel-import', upload.single('excelFile'), async (req, res) => {

    if (!isAdmin(req)) {
        return res.redirect('/');
    }

    if (!req.file) {
        return res.redirect('/admin?vehiclesExcelStatus=error&vehiclesExcelSummary=' + encodeURIComponent('Selecciona un archivo Excel de vehículos.'));
    }

    try {
        // Asegura estructura antes de aplicar altas/ediciones/bajas.
        await ensureVehiclesTable();

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            return res.redirect('/admin?vehiclesExcelStatus=error&vehiclesExcelSummary=' + encodeURIComponent('El archivo no contiene hojas válidas.'));
        }

        // Lee filas del Excel, dejando celdas vacías como string vacío.
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: '' });
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.redirect('/admin?vehiclesExcelStatus=error&vehiclesExcelSummary=' + encodeURIComponent('El Excel de vehículos está vacío.'));
        }

        let created = 0;
        let updated = 0;
        let deleted = 0;
        let skipped = 0;
        let invalid = 0;

        // Procesamiento fila por fila según accion: mantener/agregar/actualizar/borrar.
        for (const rawRow of rows) {
            // Normaliza encabezados para tolerar mayúsculas/minúsculas.
            const normalized = {};
            Object.keys(rawRow).forEach(key => {
                const normalizedKey = String(key)
                    .replace(/^\uFEFF/, '')
                    .trim()
                    .toLowerCase();
                normalized[normalizedKey] = rawRow[key];
            });

            const actionRaw = normalized.accion ?? normalized['acción'] ?? normalized.action ?? '';
            let action = String(actionRaw || '')
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            const placasRaw = normalized.placas ?? normalized.placa ?? normalized.matricula ?? normalized['no_placas'] ?? normalized['numero_placas'] ?? '';
            const placas = String(placasRaw || '').trim().toUpperCase();

            if (!placas) {
                skipped++;
                continue;
            }

            const existing = await queryDb('SELECT id FROM vehicles WHERE placas = ? LIMIT 1', [placas]);

            if (action === 'crear' || action === 'nuevo' || action === 'new' || action === 'alta') action = 'agregar';
            if (action === 'editar' || action === 'edit' || action === 'update' || action === 'guardar' || action === 'save') action = 'actualizar';
            if (action === 'remove' || action === 'del') action = 'borrar';
            if (!action) action = existing.length > 0 ? 'actualizar' : 'agregar';

            if (!['mantener', 'agregar', 'actualizar', 'borrar', 'eliminar', 'delete'].includes(action)) {
                action = existing.length > 0 ? 'actualizar' : 'agregar';
            }

            // Baja lógica por placas (clave única de vehículo).
            if (['borrar', 'eliminar', 'delete'].includes(action)) {
                const delResult = await queryDb('DELETE FROM vehicles WHERE placas = ?', [placas]);
                if (delResult.affectedRows > 0) deleted += delResult.affectedRows;
                else skipped++;
                continue;
            }

            if (action === 'mantener') {
                // Si las placas no existen aún en la BD, se inserta igual.
                if (existing.length === 0) {
                    action = 'agregar';
                } else {
                    skipped++;
                    continue;
                }
            }

            // Mapea columnas del Excel al modelo de tabla vehicles.
            const data = {
                placas,
                numero_unidad: String(normalized.numero_unidad || '').trim(),
                marca: String(normalized.marca || '').trim(),
                modelo: String(normalized.modelo || '').trim(),
                anio: parseNullableInt(normalized.anio),
                tipo_vehiculo: String(normalized.tipo_vehiculo || '').trim(),
                vin: String(normalized.vin || '').trim(),
                capacidad_carga: String(normalized.capacidad_carga || '').trim(),
                tipo_combustible: String(normalized.tipo_combustible || '').trim(),
                kilometraje_actual: parseNullableInt(normalized.kilometraje_actual),
                estado_vehiculo: String(normalized.estado_vehiculo || '').trim(),
                tarjeta_circulacion: String(normalized.tarjeta_circulacion || '').trim(),
                seguro: String(normalized.seguro || '').trim(),
                vencimiento_seguro: parseNullableDate(normalized.vencimiento_seguro),
                verificacion_vehicular: String(normalized.verificacion_vehicular || '').trim(),
                permisos_licencias: String(normalized.permisos_licencias || '').trim(),
                propietario_vehiculo: String(normalized.propietario_vehiculo || '').trim(),
                fecha_registro: parseNullableDate(normalized.fecha_registro),
                fecha_ultimo_servicio: parseNullableDate(normalized.fecha_ultimo_servicio),
                tipo_servicio: String(normalized.tipo_servicio || '').trim(),
                proximo_mantenimiento: parseNullableDate(normalized.proximo_mantenimiento),
                historial_mantenimiento: String(normalized.historial_mantenimiento || '').trim(),
                cambio_aceite: String(normalized.cambio_aceite || '').trim(),
                cambio_llantas: String(normalized.cambio_llantas || '').trim(),
                costo_servicio: parseNullableDecimal(normalized.costo_servicio),
                conductor_asignado: String(normalized.conductor_asignado || '').trim(),
                ruta_asignada: String(normalized.ruta_asignada || '').trim(),
                disponibilidad: String(normalized.disponibilidad || '').trim(),
                ubicacion: String(normalized.ubicacion || '').trim(),
                historial_viajes: String(normalized.historial_viajes || '').trim(),
                consumo_combustible: String(normalized.consumo_combustible || '').trim()
            };

            // Si ya existe la placa: update, si no existe: insert.

            if (existing.length > 0) {
                await queryDb(`
                    UPDATE vehicles SET
                        numero_unidad = ?, marca = ?, modelo = ?, anio = ?, tipo_vehiculo = ?, vin = ?,
                        capacidad_carga = ?, tipo_combustible = ?, kilometraje_actual = ?, estado_vehiculo = ?,
                        tarjeta_circulacion = ?, seguro = ?, vencimiento_seguro = ?, verificacion_vehicular = ?,
                        permisos_licencias = ?, propietario_vehiculo = ?, fecha_registro = ?, fecha_ultimo_servicio = ?,
                        tipo_servicio = ?, proximo_mantenimiento = ?, historial_mantenimiento = ?, cambio_aceite = ?,
                        cambio_llantas = ?, costo_servicio = ?, conductor_asignado = ?, ruta_asignada = ?,
                        disponibilidad = ?, ubicacion = ?, historial_viajes = ?, consumo_combustible = ?
                    WHERE placas = ?
                `, [
                    data.numero_unidad, data.marca, data.modelo, data.anio, data.tipo_vehiculo, data.vin,
                    data.capacidad_carga, data.tipo_combustible, data.kilometraje_actual, data.estado_vehiculo,
                    data.tarjeta_circulacion, data.seguro, data.vencimiento_seguro, data.verificacion_vehicular,
                    data.permisos_licencias, data.propietario_vehiculo, data.fecha_registro, data.fecha_ultimo_servicio,
                    data.tipo_servicio, data.proximo_mantenimiento, data.historial_mantenimiento, data.cambio_aceite,
                    data.cambio_llantas, data.costo_servicio, data.conductor_asignado, data.ruta_asignada,
                    data.disponibilidad, data.ubicacion, data.historial_viajes, data.consumo_combustible,
                    data.placas
                ]);
                updated++;
            } else {
                await queryDb('INSERT INTO vehicles SET ?', data);
                created++;
            }
        }

        const summary = `Importación de vehículos completada. Agregados: ${created}, actualizados: ${updated}, eliminados: ${deleted}, omitidos: ${skipped}, inválidos: ${invalid}.`;
        res.redirect('/admin?vehiclesExcelStatus=ok&vehiclesExcelSummary=' + encodeURIComponent(summary));
    } catch (error) {
        console.log('Error al importar vehículos:', error);
        res.redirect('/admin?vehiclesExcelStatus=error&vehiclesExcelSummary=' + encodeURIComponent('Error al procesar el Excel de vehículos.'));
    }
});

app.post('/admin/vehicles-inline-save', async (req, res) => {
    if (!isAdmin(req)) {
        return res.status(403).json({ ok: false, message: 'No autorizado.' });
    }

    try {
        await ensureVehiclesTable();
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

        if (!rows.length) {
            return res.json({ ok: true, message: 'No había cambios para guardar.' });
        }

        let created = 0;
        let updated = 0;
        let deleted = 0;
        let skipped = 0;

        for (const item of rows) {
            let action = String(item?.action || '').trim().toLowerCase();
            if (action === 'eliminar' || action === 'delete' || action === 'del') action = 'borrar';
            if (action !== 'borrar') action = 'actualizar';

            const originalPlacas = String(item?.originalPlacas || '').trim().toUpperCase();
            const placas = String(item?.placas || '').trim().toUpperCase();

            if (action === 'borrar') {
                const targetPlacas = originalPlacas || placas;
                if (!targetPlacas) {
                    skipped++;
                    continue;
                }
                const delResult = await queryDb('DELETE FROM vehicles WHERE placas = ?', [targetPlacas]);
                if (delResult.affectedRows > 0) deleted += delResult.affectedRows;
                else skipped++;
                continue;
            }

            if (!placas) {
                skipped++;
                continue;
            }

            const payload = {
                placas,
                numero_unidad: String(item?.numero_unidad || '').trim(),
                marca: String(item?.marca || '').trim(),
                modelo: String(item?.modelo || '').trim(),
                anio: parseNullableInt(item?.anio),
                tipo_vehiculo: String(item?.tipo_vehiculo || '').trim(),
                vin: String(item?.vin || '').trim(),
                capacidad_carga: String(item?.capacidad_carga || '').trim(),
                tipo_combustible: String(item?.tipo_combustible || '').trim(),
                conductor_asignado: String(item?.conductor_asignado || '').trim(),
                estado_vehiculo: String(item?.estado_vehiculo || '').trim(),
                kilometraje_actual: parseNullableInt(item?.kilometraje_actual),
                tarjeta_circulacion: String(item?.tarjeta_circulacion || '').trim(),
                seguro: String(item?.seguro || '').trim(),
                vencimiento_seguro: parseNullableDate(item?.vencimiento_seguro),
                verificacion_vehicular: String(item?.verificacion_vehicular || '').trim(),
                permisos_licencias: String(item?.permisos_licencias || '').trim(),
                propietario_vehiculo: String(item?.propietario_vehiculo || '').trim(),
                fecha_registro: parseNullableDate(item?.fecha_registro),
                fecha_ultimo_servicio: parseNullableDate(item?.fecha_ultimo_servicio),
                tipo_servicio: String(item?.tipo_servicio || '').trim(),
                proximo_mantenimiento: parseNullableDate(item?.proximo_mantenimiento),
                historial_mantenimiento: String(item?.historial_mantenimiento || '').trim(),
                cambio_aceite: String(item?.cambio_aceite || '').trim(),
                cambio_llantas: String(item?.cambio_llantas || '').trim(),
                costo_servicio: parseNullableDecimal(item?.costo_servicio),
                ruta_asignada: String(item?.ruta_asignada || '').trim(),
                disponibilidad: String(item?.disponibilidad || '').trim(),
                ubicacion: String(item?.ubicacion || '').trim(),
                historial_viajes: String(item?.historial_viajes || '').trim(),
                consumo_combustible: String(item?.consumo_combustible || '').trim()
            };

            const existsWithOriginal = originalPlacas
                ? await queryDb('SELECT id FROM vehicles WHERE placas = ? LIMIT 1', [originalPlacas])
                : [];

            if (existsWithOriginal.length > 0) {
                await queryDb(`
                    UPDATE vehicles SET
                        placas = ?,
                        numero_unidad = ?, marca = ?, modelo = ?, anio = ?, tipo_vehiculo = ?, vin = ?,
                        capacidad_carga = ?, tipo_combustible = ?, kilometraje_actual = ?, estado_vehiculo = ?,
                        tarjeta_circulacion = ?, seguro = ?, vencimiento_seguro = ?, verificacion_vehicular = ?,
                        permisos_licencias = ?, propietario_vehiculo = ?, fecha_registro = ?, fecha_ultimo_servicio = ?,
                        tipo_servicio = ?, proximo_mantenimiento = ?, historial_mantenimiento = ?, cambio_aceite = ?,
                        cambio_llantas = ?, costo_servicio = ?, conductor_asignado = ?, ruta_asignada = ?,
                        disponibilidad = ?, ubicacion = ?, historial_viajes = ?, consumo_combustible = ?
                    WHERE placas = ?
                `, [
                    payload.placas,
                    payload.numero_unidad, payload.marca, payload.modelo, payload.anio, payload.tipo_vehiculo, payload.vin,
                    payload.capacidad_carga, payload.tipo_combustible, payload.kilometraje_actual, payload.estado_vehiculo,
                    payload.tarjeta_circulacion, payload.seguro, payload.vencimiento_seguro, payload.verificacion_vehicular,
                    payload.permisos_licencias, payload.propietario_vehiculo, payload.fecha_registro, payload.fecha_ultimo_servicio,
                    payload.tipo_servicio, payload.proximo_mantenimiento, payload.historial_mantenimiento, payload.cambio_aceite,
                    payload.cambio_llantas, payload.costo_servicio, payload.conductor_asignado, payload.ruta_asignada,
                    payload.disponibilidad, payload.ubicacion, payload.historial_viajes, payload.consumo_combustible,
                    originalPlacas
                ]);
                updated++;
                continue;
            }

            const existsWithPlacas = await queryDb('SELECT id FROM vehicles WHERE placas = ? LIMIT 1', [placas]);
            if (existsWithPlacas.length > 0) {
                await queryDb(`
                    UPDATE vehicles SET
                        numero_unidad = ?, marca = ?, modelo = ?, anio = ?, tipo_vehiculo = ?, vin = ?,
                        capacidad_carga = ?, tipo_combustible = ?, kilometraje_actual = ?, estado_vehiculo = ?,
                        tarjeta_circulacion = ?, seguro = ?, vencimiento_seguro = ?, verificacion_vehicular = ?,
                        permisos_licencias = ?, propietario_vehiculo = ?, fecha_registro = ?, fecha_ultimo_servicio = ?,
                        tipo_servicio = ?, proximo_mantenimiento = ?, historial_mantenimiento = ?, cambio_aceite = ?,
                        cambio_llantas = ?, costo_servicio = ?, conductor_asignado = ?, ruta_asignada = ?,
                        disponibilidad = ?, ubicacion = ?, historial_viajes = ?, consumo_combustible = ?
                    WHERE placas = ?
                `, [
                    payload.numero_unidad, payload.marca, payload.modelo, payload.anio, payload.tipo_vehiculo, payload.vin,
                    payload.capacidad_carga, payload.tipo_combustible, payload.kilometraje_actual, payload.estado_vehiculo,
                    payload.tarjeta_circulacion, payload.seguro, payload.vencimiento_seguro, payload.verificacion_vehicular,
                    payload.permisos_licencias, payload.propietario_vehiculo, payload.fecha_registro, payload.fecha_ultimo_servicio,
                    payload.tipo_servicio, payload.proximo_mantenimiento, payload.historial_mantenimiento, payload.cambio_aceite,
                    payload.cambio_llantas, payload.costo_servicio, payload.conductor_asignado, payload.ruta_asignada,
                    payload.disponibilidad, payload.ubicacion, payload.historial_viajes, payload.consumo_combustible,
                    payload.placas
                ]);
                updated++;
            } else {
                await queryDb('INSERT INTO vehicles SET ?', payload);
                created++;
            }
        }

        const summary = `Flota guardada. Agregados: ${created}, actualizados: ${updated}, eliminados: ${deleted}, omitidos: ${skipped}.`;
        return res.json({ ok: true, message: summary });
    } catch (error) {
        console.log('Error en guardado inline de vehículos:', error);
        return res.status(500).json({ ok: false, message: 'Error al guardar cambios de flota.' });
    }
});

app.get('/admin/trips-excel', async (req, res) => {

    if (!isAdmin(req)) {
        return res.redirect('/');
    }

    try {
        await ensureTripsTable();
        const trips = await queryDb('SELECT * FROM trips ORDER BY fecha_salida DESC, trip_id ASC');

        const exportRows = (trips || []).map(t => ({
            accion: 'mantener',
            trip_id: t.trip_id || '',
            fecha_salida: t.fecha_salida || '',
            fecha_llegada_estimada: t.fecha_llegada_estimada || '',
            estado_viaje: t.estado_viaje || '',
            tipo_viaje: t.tipo_viaje || '',
            origen: t.origen || '',
            destino: t.destino || '',
            direccion_carga: t.direccion_carga || '',
            direccion_entrega: t.direccion_entrega || '',
            distancia_estimada: t.distancia_estimada || '',
            tiempo_estimado: t.tiempo_estimado || '',
            vehiculo_asignado: t.vehiculo_asignado || '',
            conductor: t.conductor || '',
            ayudante: t.ayudante || '',
            capacidad_utilizada: t.capacidad_utilizada || '',
            tipo_mercancia: t.tipo_mercancia || '',
            peso: t.peso || '',
            volumen: t.volumen || '',
            cantidad_paquetes: t.cantidad_paquetes || '',
            valor_mercancia: t.valor_mercancia || '',
            cliente: t.cliente || '',
            hora_salida: t.hora_salida || '',
            hora_llegada: t.hora_llegada || '',
            ubicacion_actual: t.ubicacion_actual || '',
            paradas: t.paradas || '',
            incidentes: t.incidentes || '',
            observaciones: t.observaciones || '',
            combustible: t.combustible || '',
            peajes: t.peajes || '',
            viaticos: t.viaticos || '',
            costo_total: t.costo_total || '',
            ganancia: t.ganancia || '',
            orden_transporte: t.orden_transporte || '',
            factura: t.factura || '',
            carta_porte: t.carta_porte || '',
            comprobante_entrega: t.comprobante_entrega || '',
            firma_cliente: t.firma_cliente || ''
        }));

        const headers = [
            'accion', 'trip_id', 'fecha_salida', 'fecha_llegada_estimada', 'estado_viaje', 'tipo_viaje',
            'origen', 'destino', 'direccion_carga', 'direccion_entrega', 'distancia_estimada', 'tiempo_estimado',
            'vehiculo_asignado', 'conductor', 'ayudante', 'capacidad_utilizada', 'tipo_mercancia', 'peso',
            'volumen', 'cantidad_paquetes', 'valor_mercancia', 'cliente', 'hora_salida', 'hora_llegada',
            'ubicacion_actual', 'paradas', 'incidentes', 'observaciones', 'combustible', 'peajes', 'viaticos',
            'costo_total', 'ganancia', 'orden_transporte', 'factura', 'carta_porte', 'comprobante_entrega',
            'firma_cliente'
        ];

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: headers });
        worksheet['!cols'] = headers.map(() => ({ wch: 22 }));
        XLSX.utils.book_append_sheet(workbook, worksheet, 'viajes');

        const helpSheet = XLSX.utils.aoa_to_sheet([
            ['Instrucciones'],
            ['accion: mantener | agregar | actualizar | borrar'],
            ['trip_id: obligatorio y único por viaje'],
            ['estado_viaje sugerido: programado | en carga | en ruta | entregado | cancelado'],
            ['fechas en formato recomendado: YYYY-MM-DD']
        ]);
        helpSheet['!cols'] = [{ wch: 90 }];
        XLSX.utils.book_append_sheet(workbook, helpSheet, 'instrucciones');

        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const fileName = `viajes_logistica_${new Date().toISOString().slice(0, 10)}.xlsx`;

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);
    } catch (error) {
        console.log('Error al exportar Excel de viajes:', error);
        res.redirect('/admin?tripsExcelStatus=error&tripsExcelSummary=' + encodeURIComponent('No se pudo generar el Excel de viajes.'));
    }
});

app.post('/admin/trips-excel-import', upload.single('excelFile'), async (req, res) => {

    if (!isAdmin(req)) {
        return res.redirect('/');
    }

    if (!req.file) {
        return res.redirect('/admin?tripsExcelStatus=error&tripsExcelSummary=' + encodeURIComponent('Selecciona un archivo Excel de viajes.'));
    }

    try {
        await ensureTripsTable();

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            return res.redirect('/admin?tripsExcelStatus=error&tripsExcelSummary=' + encodeURIComponent('El archivo no contiene hojas válidas.'));
        }

        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: '' });
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.redirect('/admin?tripsExcelStatus=error&tripsExcelSummary=' + encodeURIComponent('El Excel de viajes está vacío.'));
        }

        let created = 0;
        let updated = 0;
        let deleted = 0;
        let skipped = 0;
        let invalid = 0;

        for (const rawRow of rows) {
            const normalized = {};
            Object.keys(rawRow).forEach(key => {
                normalized[String(key).trim().toLowerCase()] = rawRow[key];
            });

            const action = String(normalized.accion || 'actualizar').trim().toLowerCase();
            const tripId = String(normalized.trip_id || '').trim().toUpperCase();

            if (!tripId) {
                skipped++;
                continue;
            }

            if (!['mantener', 'agregar', 'actualizar', 'borrar', 'eliminar', 'delete'].includes(action)) {
                invalid++;
                continue;
            }

            if (['borrar', 'eliminar', 'delete'].includes(action)) {
                const delResult = await queryDb('DELETE FROM trips WHERE trip_id = ?', [tripId]);
                if (delResult.affectedRows > 0) deleted += delResult.affectedRows;
                else skipped++;
                continue;
            }

            if (action === 'mantener') {
                // Si el trip_id no existe aún, se inserta igual.
                const existsTrip = await queryDb('SELECT id FROM trips WHERE trip_id = ? LIMIT 1', [tripId]);
                if (existsTrip.length === 0) {
                    action = 'agregar';
                } else {
                    skipped++;
                    continue;
                }
            }

            const data = {
                trip_id: tripId,
                fecha_salida: parseNullableDate(normalized.fecha_salida),
                fecha_llegada_estimada: parseNullableDate(normalized.fecha_llegada_estimada),
                estado_viaje: String(normalized.estado_viaje || '').trim().toLowerCase(),
                tipo_viaje: String(normalized.tipo_viaje || '').trim().toLowerCase(),
                origen: String(normalized.origen || '').trim(),
                destino: String(normalized.destino || '').trim(),
                direccion_carga: String(normalized.direccion_carga || '').trim(),
                direccion_entrega: String(normalized.direccion_entrega || '').trim(),
                distancia_estimada: parseNullableDecimal(normalized.distancia_estimada),
                tiempo_estimado: String(normalized.tiempo_estimado || '').trim(),
                vehiculo_asignado: String(normalized.vehiculo_asignado || '').trim(),
                conductor: String(normalized.conductor || '').trim(),
                ayudante: String(normalized.ayudante || '').trim(),
                capacidad_utilizada: String(normalized.capacidad_utilizada || '').trim(),
                tipo_mercancia: String(normalized.tipo_mercancia || '').trim(),
                peso: parseNullableDecimal(normalized.peso),
                volumen: parseNullableDecimal(normalized.volumen),
                cantidad_paquetes: parseNullableInt(normalized.cantidad_paquetes),
                valor_mercancia: parseNullableDecimal(normalized.valor_mercancia),
                cliente: String(normalized.cliente || '').trim(),
                hora_salida: String(normalized.hora_salida || '').trim(),
                hora_llegada: String(normalized.hora_llegada || '').trim(),
                ubicacion_actual: String(normalized.ubicacion_actual || '').trim(),
                paradas: String(normalized.paradas || '').trim(),
                incidentes: String(normalized.incidentes || '').trim(),
                observaciones: String(normalized.observaciones || '').trim(),
                combustible: parseNullableDecimal(normalized.combustible),
                peajes: parseNullableDecimal(normalized.peajes),
                viaticos: parseNullableDecimal(normalized.viaticos),
                costo_total: parseNullableDecimal(normalized.costo_total),
                ganancia: parseNullableDecimal(normalized.ganancia),
                orden_transporte: String(normalized.orden_transporte || '').trim(),
                factura: String(normalized.factura || '').trim(),
                carta_porte: String(normalized.carta_porte || '').trim(),
                comprobante_entrega: String(normalized.comprobante_entrega || '').trim(),
                firma_cliente: String(normalized.firma_cliente || '').trim()
            };

            const existing = await queryDb('SELECT id FROM trips WHERE trip_id = ? LIMIT 1', [tripId]);

            if (existing.length > 0) {
                await queryDb(`
                    UPDATE trips SET
                        fecha_salida = ?, fecha_llegada_estimada = ?, estado_viaje = ?, tipo_viaje = ?,
                        origen = ?, destino = ?, direccion_carga = ?, direccion_entrega = ?, distancia_estimada = ?,
                        tiempo_estimado = ?, vehiculo_asignado = ?, conductor = ?, ayudante = ?, capacidad_utilizada = ?,
                        tipo_mercancia = ?, peso = ?, volumen = ?, cantidad_paquetes = ?, valor_mercancia = ?, cliente = ?,
                        hora_salida = ?, hora_llegada = ?, ubicacion_actual = ?, paradas = ?, incidentes = ?, observaciones = ?,
                        combustible = ?, peajes = ?, viaticos = ?, costo_total = ?, ganancia = ?, orden_transporte = ?,
                        factura = ?, carta_porte = ?, comprobante_entrega = ?, firma_cliente = ?
                    WHERE trip_id = ?
                `, [
                    data.fecha_salida, data.fecha_llegada_estimada, data.estado_viaje, data.tipo_viaje,
                    data.origen, data.destino, data.direccion_carga, data.direccion_entrega, data.distancia_estimada,
                    data.tiempo_estimado, data.vehiculo_asignado, data.conductor, data.ayudante, data.capacidad_utilizada,
                    data.tipo_mercancia, data.peso, data.volumen, data.cantidad_paquetes, data.valor_mercancia, data.cliente,
                    data.hora_salida, data.hora_llegada, data.ubicacion_actual, data.paradas, data.incidentes, data.observaciones,
                    data.combustible, data.peajes, data.viaticos, data.costo_total, data.ganancia, data.orden_transporte,
                    data.factura, data.carta_porte, data.comprobante_entrega, data.firma_cliente,
                    data.trip_id
                ]);
                updated++;
            } else {
                await queryDb('INSERT INTO trips SET ?', data);
                created++;
            }
        }

        const summary = `Importación de viajes completada. Agregados: ${created}, actualizados: ${updated}, eliminados: ${deleted}, omitidos: ${skipped}, inválidos: ${invalid}.`;
        res.redirect('/admin?tripsExcelStatus=ok&tripsExcelSummary=' + encodeURIComponent(summary));
    } catch (error) {
        console.log('Error al importar viajes:', error);
        res.redirect('/admin?tripsExcelStatus=error&tripsExcelSummary=' + encodeURIComponent('Error al procesar el Excel de viajes.'));
    }
});

app.post('/admin/trip/update', async (req, res) => {

    if (!isAdmin(req)) {
        return res.status(403).json({ ok: false, message: 'No autorizado.' });
    }

    const tripId = String(req.body.trip_id || '').trim();
    const estadoViaje = String(req.body.estado_viaje || '').trim().toLowerCase();
    const origen = String(req.body.origen || '').trim();
    const destino = String(req.body.destino || '').trim();
    let conductor = String(req.body.conductor || '').trim();
    const cliente = String(req.body.cliente || '').trim();
    const vehiculoAsignado = String(req.body.vehiculo_asignado || '').trim();
    const ubicacionActual = String(req.body.ubicacion_actual || '').trim();
    const estadosPermitidos = ['programado', 'en carga', 'en ruta', 'entregado', 'cancelado', 'pendiente', 'en curso', 'finalizado'];

    if (!tripId) {
        return res.status(400).json({ ok: false, message: 'trip_id es obligatorio.' });
    }

    if (estadoViaje && !estadosPermitidos.includes(estadoViaje)) {
        return res.status(400).json({ ok: false, message: 'Estado de viaje no válido.' });
    }

    try {
        await ensureTripsTable();

        if (conductor) {
            const conductorNorm = conductor.toLowerCase();
            const choferRows = await queryDb(`
                SELECT user, name
                FROM users
                WHERE rol = 'chofer'
                  AND (LOWER(TRIM(user)) = ? OR LOWER(TRIM(name)) = ?)
                LIMIT 1
            `, [conductorNorm, conductorNorm]);

            if (Array.isArray(choferRows) && choferRows.length > 0) {
                // Guardar nombre visible para evitar desalineación con sesión del chofer.
                conductor = String(choferRows[0].name || choferRows[0].user || conductor).trim();
            }
        }

        const exists = await queryDb('SELECT id FROM trips WHERE trip_id = ? LIMIT 1', [tripId]);
        if (!Array.isArray(exists) || exists.length === 0) {
            return res.status(404).json({ ok: false, message: 'El viaje no existe.' });
        }

        await queryDb(`
            UPDATE trips
            SET
                estado_viaje = COALESCE(NULLIF(?, ''), estado_viaje),
                origen = COALESCE(NULLIF(?, ''), origen),
                destino = COALESCE(NULLIF(?, ''), destino),
                conductor = COALESCE(NULLIF(?, ''), conductor),
                cliente = COALESCE(NULLIF(?, ''), cliente),
                vehiculo_asignado = COALESCE(NULLIF(?, ''), vehiculo_asignado),
                ubicacion_actual = COALESCE(NULLIF(?, ''), ubicacion_actual)
            WHERE trip_id = ?
        `, [
            estadoViaje,
            origen,
            destino,
            conductor,
            cliente,
            vehiculoAsignado,
            ubicacionActual,
            tripId
        ]);

        return res.json({ ok: true, message: 'Viaje actualizado correctamente.' });
    } catch (error) {
        console.log('Error al actualizar viaje desde admin:', error);
        return res.status(500).json({ ok: false, message: 'No se pudo actualizar el viaje.' });
    }
});

app.post('/admin/trip/delete', async (req, res) => {

    if (!isAdmin(req)) {
        return res.status(403).json({ ok: false, message: 'No autorizado.' });
    }

    const tripId = String(req.body.trip_id || '').trim();
    if (!tripId) {
        return res.status(400).json({ ok: false, message: 'trip_id es obligatorio.' });
    }

    try {
        await ensureTripsTable();

        const result = await queryDb('DELETE FROM trips WHERE trip_id = ?', [tripId]);
        if (!result || !result.affectedRows) {
            return res.status(404).json({ ok: false, message: 'No se encontró el viaje a eliminar.' });
        }

        return res.json({ ok: true, message: 'Viaje eliminado correctamente.' });
    } catch (error) {
        console.log('Error al eliminar viaje desde admin:', error);
        return res.status(500).json({ ok: false, message: 'No se pudo eliminar el viaje.' });
    }
});

app.get('/admin/users-excel', async (req, res) => {

    if (!isAdmin(req)) {
        return res.redirect('/');
    }

    try {
        await ensureUsersPhoneColumn();

        // Exporta usuarios (cliente/chofer/admin) para mantenimiento masivo desde Excel.
        const users = await queryDb(`
            SELECT user, name, rol, COALESCE(telefono, '') AS telefono
            FROM users
            WHERE rol IN ('cliente', 'chofer', 'admin')
            ORDER BY rol ASC, name ASC
        `);

        // La acción por defecto es mantener para no alterar datos al importar.
        const exportRows = (users || []).map(u => ({
            accion: 'mantener',
            user: u.user || '',
            name: u.name || '',
            telefono: u.telefono || '',
            rol: u.rol || '',
            pass: ''
        }));

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(exportRows, {
            header: ['accion', 'user', 'name', 'telefono', 'rol', 'pass']
        });

        worksheet['!cols'] = [
            { wch: 14 },
            { wch: 22 },
            { wch: 30 },
            { wch: 18 },
            { wch: 14 },
            { wch: 20 }
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'usuarios');

        const helpSheet = XLSX.utils.aoa_to_sheet([
            ['Instrucciones'],
            [''],
            ['PARA AGREGAR un usuario nuevo:'],
            ['  - Agrega una fila nueva al final del Excel con todos los campos llenos.'],
            ['  - Escribe "agregar" en la columna accion (o deja la columna accion vacía, se detecta automáticamente).'],
            ['  - El campo pass (contraseña) es obligatorio para nuevos usuarios.'],
            ['  - El campo telefono es opcional, pero recomendado para contacto.'],
            [''],
            ['PARA EDITAR un usuario existente:'],
            ['  - Usa accion "actualizar" (la contraseña es opcional).'],
            [''],
            ['PARA ELIMINAR un usuario:'],
            ['  - Usa accion "borrar" o "eliminar".'],
            [''],
            ['Valores válidos para accion: mantener | agregar | actualizar | borrar'],
            ['Valores válidos para rol: cliente | chofer | admin'],
        ]);
        helpSheet['!cols'] = [{ wch: 80 }];
        XLSX.utils.book_append_sheet(workbook, helpSheet, 'instrucciones');

        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const fileName = `usuarios_clientes_choferes_${new Date().toISOString().slice(0, 10)}.xlsx`;

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);
    } catch (error) {
        console.log('Error al exportar Excel:', error);
        res.redirect('/admin?usersExcelStatus=error&usersExcelSummary=' + encodeURIComponent('No se pudo generar el archivo Excel.'));
    }
});

app.post('/admin/users-excel-import', upload.single('excelFile'), async (req, res) => {

    if (!isAdmin(req)) {
        return res.redirect('/');
    }

    if (!req.file) {
        return res.redirect('/admin?usersExcelStatus=error&usersExcelSummary=' + encodeURIComponent('Selecciona un archivo Excel para importar.'));
    }

    try {
        await ensureUsersPhoneColumn();

        // Importa archivo enviado y toma la primera hoja como fuente de datos.
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
            return res.redirect('/admin?usersExcelStatus=error&usersExcelSummary=' + encodeURIComponent('El archivo no contiene hojas válidas.'));
        }

        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!Array.isArray(rows) || rows.length === 0) {
            return res.redirect('/admin?usersExcelStatus=error&usersExcelSummary=' + encodeURIComponent('El Excel no tiene registros para procesar.'));
        }

        let created = 0;
        let updated = 0;
        let deleted = 0;
        let skipped = 0;
        let invalid = 0;

        // Reglas de importación por fila: validar, insertar, actualizar o borrar.
        for (const rawRow of rows) {
            const normalized = {};
            Object.keys(rawRow).forEach(key => {
                const normalizedKey = String(key)
                    .replace(/^\uFEFF/, '')
                    .trim()
                    .toLowerCase();
                normalized[normalizedKey] = rawRow[key];
            });

            const actionRaw = normalized.accion ?? normalized['acción'] ?? normalized.action ?? '';
            const user = String(normalized.user || '').trim();
            const name = String(normalized.name || '').trim();
            const rolRaw = normalized.rol ?? normalized.role ?? normalized.perfil ?? normalized.tipo ?? '';
            const telefonoRaw = normalized.telefono ?? normalized['teléfono'] ?? normalized['numero'] ?? normalized['número'] ?? normalized.numero_telefono ?? normalized.phone ?? '';
            const passRaw = normalized.pass ?? normalized.password ?? normalized.contrasena ?? normalized['contraseña'] ?? '';
            const rol = String(rolRaw).trim().toLowerCase();
            const telefono = String(telefonoRaw || '').trim();
            const pass = String(passRaw || '').trim();

            if (!user) {
                skipped++;
                continue;
            }

            const existing = await queryDb('SELECT user FROM users WHERE user = ? LIMIT 1', [user]);

            let action = String(actionRaw || '').trim().toLowerCase();
            if (action === 'crear' || action === 'nuevo' || action === 'new') action = 'agregar';

            // Si accion viene vacía, se infiere según exista o no el usuario.
            if (!action) {
                action = existing.length > 0 ? 'actualizar' : 'agregar';
            }

            if (action === 'editar' || action === 'edit' || action === 'update') action = 'actualizar';
            if (action === 'eliminar' || action === 'delete') action = 'borrar';

            if (!['mantener', 'agregar', 'actualizar', 'borrar'].includes(action)) {
                invalid++;
                continue;
            }

            if (action === 'borrar') {
                const delResult = await queryDb('DELETE FROM users WHERE user = ? AND rol IN (\'cliente\', \'chofer\', \'admin\')', [user]);
                if (delResult.affectedRows > 0) {
                    deleted += delResult.affectedRows;
                } else {
                    skipped++;
                }
                continue;
            }

            if (action === 'mantener') {
                // Conveniencia: si la fila es nueva y completa, se agrega aunque diga mantener.
                if (existing.length === 0 && name && ['cliente', 'chofer', 'admin'].includes(rol) && pass) {
                    const hashedPass = await bcrypt.hash(pass, 8);
                    await queryDb('INSERT INTO users SET ?', { user, name, telefono, rol, pass: hashedPass });
                    created++;
                } else {
                    skipped++;
                }
                continue;
            }

            if (!name || !['cliente', 'chofer', 'admin'].includes(rol)) {
                invalid++;
                continue;
            }

            if (action === 'agregar') {
                if (!pass) {
                    invalid++;
                    continue;
                }

                if (existing.length > 0) {
                    skipped++;
                } else {
                    const hashedPass = await bcrypt.hash(pass, 8);
                    await queryDb('INSERT INTO users SET ?', { user, name, telefono, rol, pass: hashedPass });
                    created++;
                }
                continue;
            }

            if (action === 'actualizar') {
                if (existing.length === 0) {
                    if (!pass) {
                        invalid++;
                        continue;
                    }
                    const hashedPass = await bcrypt.hash(pass, 8);
                    await queryDb('INSERT INTO users SET ?', { user, name, telefono, rol, pass: hashedPass });
                    created++;
                } else {
                    if (pass) {
                        const hashedPass = await bcrypt.hash(pass, 8);
                        await queryDb('UPDATE users SET name = ?, telefono = ?, rol = ?, pass = ? WHERE user = ?', [name, telefono, rol, hashedPass, user]);
                    } else {
                        await queryDb('UPDATE users SET name = ?, telefono = ?, rol = ? WHERE user = ?', [name, telefono, rol, user]);
                    }
                    updated++;
                }
                continue;
            }
        }

        const summary = `Importación completada. Agregados: ${created}, actualizados: ${updated}, eliminados: ${deleted}, omitidos: ${skipped}, inválidos: ${invalid}.`;
        res.redirect('/admin?usersExcelStatus=ok&usersExcelSummary=' + encodeURIComponent(summary));
    } catch (error) {
        console.log('Error al importar Excel:', error);
        res.redirect('/admin?usersExcelStatus=error&usersExcelSummary=' + encodeURIComponent('Error al procesar el Excel. Verifica formato y columnas.'));
    }
});

app.post('/admin/users-inline-save', async (req, res) => {

    if (!isAdmin(req)) {
        return res.status(403).json({ ok: false, message: 'No autorizado.' });
    }

    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (rows.length === 0) {
        return res.status(400).json({ ok: false, message: 'No hay cambios para guardar.' });
    }

    try {
        await ensureUsersPhoneColumn();

        let created = 0;
        let updated = 0;
        let deleted = 0;
        let skipped = 0;
        let invalid = 0;

        for (const rawRow of rows) {
            const originalUser = String(rawRow.originalUser || '').trim();
            const user = String(rawRow.user || '').trim();
            const name = String(rawRow.name || '').trim();
            const telefono = String(rawRow.telefono || '').trim();
            const rol = String(rawRow.rol || '').trim().toLowerCase();
            const pass = String(rawRow.pass || '').trim();
            const action = String(rawRow.action || '').trim().toLowerCase();
            const lookupUser = originalUser || user;

            if (!lookupUser && !user) {
                skipped++;
                continue;
            }

            if (action === 'borrar') {
                const deleteResult = await queryDb(
                    'DELETE FROM users WHERE user = ? AND rol IN (\'cliente\', \'chofer\', \'admin\')',
                    [lookupUser]
                );

                if (deleteResult && deleteResult.affectedRows > 0) {
                    deleted += deleteResult.affectedRows;
                } else {
                    skipped++;
                }
                continue;
            }

            if (!user || !name || !['cliente', 'chofer', 'admin'].includes(rol)) {
                invalid++;
                continue;
            }

            const existing = await queryDb('SELECT user FROM users WHERE user = ? LIMIT 1', [lookupUser]);
            const userChanged = Boolean(originalUser) && originalUser !== user;

            if (userChanged) {
                const duplicate = await queryDb('SELECT user FROM users WHERE user = ? LIMIT 1', [user]);
                if (Array.isArray(duplicate) && duplicate.length > 0) {
                    invalid++;
                    continue;
                }
            }

            if (!Array.isArray(existing) || existing.length === 0) {
                if (!pass) {
                    invalid++;
                    continue;
                }

                const duplicate = await queryDb('SELECT user FROM users WHERE user = ? LIMIT 1', [user]);
                if (Array.isArray(duplicate) && duplicate.length > 0) {
                    invalid++;
                    continue;
                }

                const hashedPass = await bcrypt.hash(pass, 8);
                await queryDb('INSERT INTO users SET ?', { user, name, telefono, rol, pass: hashedPass });
                created++;
                continue;
            }

            if (pass) {
                const hashedPass = await bcrypt.hash(pass, 8);
                await queryDb(
                    'UPDATE users SET user = ?, name = ?, telefono = ?, rol = ?, pass = ? WHERE user = ?',
                    [user, name, telefono, rol, hashedPass, lookupUser]
                );
            } else {
                await queryDb(
                    'UPDATE users SET user = ?, name = ?, telefono = ?, rol = ? WHERE user = ?',
                    [user, name, telefono, rol, lookupUser]
                );
            }

            updated++;
        }

        const summary = `Cambios guardados. Agregados: ${created}, actualizados: ${updated}, eliminados: ${deleted}, omitidos: ${skipped}, inválidos: ${invalid}.`;
        return res.json({ ok: true, message: summary });
    } catch (error) {
        console.log('Error al guardar usuarios desde tabla:', error);
        return res.status(500).json({ ok: false, message: 'No se pudieron guardar los cambios de usuarios.' });
    }
});

// chofer
app.get('/chofer', async (req, res) => {
    if (!(req.session.loggedin && req.session.rol === 'chofer')) {
        return res.redirect('/');
    }

    const choferName = String(req.session.name || '').trim();
    const choferUser = String(req.session.user || '').trim();
    const feedbackType = String(req.query.feedbackType || '').toLowerCase();
    const feedbackMessage = String(req.query.feedbackMessage || '').trim();

    try {
        await ensureTripsTable();
        await ensureDriverExpensesTable();
        await ensureDriverRatingsTable();

        const choferAliases = await getUserAliasesByRole('chofer', choferName, choferUser);
        if (choferAliases.length === 0) {
            return res.render('chofer', {
                name: choferName,
                user: {
                    id: req.session.id,
                    user: choferName
                },
                driverTrips: [],
                activeTrip: null,
                driverExpenses: [],
                feedbackType: 'error',
                feedbackMessage: 'No se pudo identificar tu cuenta de chofer para cargar viajes asignados.',
                stats: {
                    viajesAsignados: 0,
                    kilometrajeMes: 0,
                    horasMes: 0,
                    calificacion: 0
                }
            });
        }

        const aliasMarks = choferAliases.map(() => '?').join(', ');

        const trips = await queryDb(`
            SELECT *
            FROM trips
            WHERE LOWER(TRIM(conductor)) IN (${aliasMarks})
            ORDER BY COALESCE(fecha_salida, created_at) DESC, trip_id ASC
        `, choferAliases);

        const expenses = await queryDb(`
            SELECT *
            FROM driver_expenses
            WHERE LOWER(TRIM(chofer)) IN (${aliasMarks})
            ORDER BY COALESCE(fecha, created_at) DESC, id DESC
            LIMIT 12
        `, choferAliases);

        const ratingRows = await queryDb(`
            SELECT AVG(rating) AS promedio, COUNT(*) AS total
            FROM driver_ratings
            WHERE LOWER(TRIM(chofer)) IN (${aliasMarks})
        `, choferAliases);

        const driverTrips = Array.isArray(trips) ? trips : [];
        const month = new Date().getMonth();
        const year = new Date().getFullYear();

        const monthlyTrips = driverTrips.filter(t => {
            const dt = new Date(t.fecha_salida || t.created_at);
            return !Number.isNaN(dt.getTime()) && dt.getMonth() === month && dt.getFullYear() === year;
        });

        const kilometrajeMes = monthlyTrips.reduce((acc, t) => acc + (Number(t.distancia_estimada) || 0), 0);
        const horasMes = monthlyTrips.reduce((acc, t) => {
            const text = String(t.tiempo_estimado || '');
            const numeric = Number(text.replace(',', '.').match(/\d+(\.\d+)?/)?.[0] || 0);
            return acc + (Number.isFinite(numeric) ? numeric : 0);
        }, 0);

        const estadoActivo = ['en ruta', 'en carga', 'programado'];
        const activeTrip = driverTrips.find(t => estadoActivo.includes(String(t.estado_viaje || '').toLowerCase())) || null;
        const avgRatingRaw = Array.isArray(ratingRows) && ratingRows[0] ? Number(ratingRows[0].promedio) : 0;
        const avgRating = Number.isFinite(avgRatingRaw) && avgRatingRaw > 0 ? avgRatingRaw : 0;

        return res.render('chofer', {
            name: choferName,
            user: {
                id: req.session.id,
                user: choferName
            },
            driverTrips,
            activeTrip,
            driverExpenses: Array.isArray(expenses) ? expenses : [],
            feedbackType,
            feedbackMessage,
            stats: {
                viajesAsignados: driverTrips.length,
                kilometrajeMes,
                horasMes,
                calificacion: avgRating
            }
        });
    } catch (error) {
        console.log('Error al cargar panel de chofer:', error);
        return res.render('chofer', {
            name: choferName,
            user: {
                id: req.session.id,
                user: choferName
            },
            driverTrips: [],
            activeTrip: null,
            driverExpenses: [],
            feedbackType: 'error',
            feedbackMessage: feedbackMessage || 'No se pudo cargar el panel de chofer.',
            stats: {
                viajesAsignados: 0,
                kilometrajeMes: 0,
                horasMes: 0,
                calificacion: 0
            }
        });
    }
});

app.get('/cliente', async (req, res) => {
    if (!(req.session.loggedin && req.session.rol === 'cliente')) {
        return res.redirect('/');
    }

    const clientName = String(req.session.name || '').trim();
    const feedbackType = String(req.query.feedbackType || '').toLowerCase();
    const feedbackMessage = String(req.query.feedbackMessage || '').trim();

    try {
        await ensureTripsTable();
        await ensureDriverRatingsTable();

        const trips = await queryDb(`
            SELECT *
            FROM trips
            WHERE cliente = ?
            ORDER BY COALESCE(fecha_salida, created_at) DESC, trip_id ASC
        `, [clientName]);

        const rateableTrips = await queryDb(`
            SELECT
                t.trip_id,
                t.origen,
                t.destino,
                t.conductor,
                dr.rating AS rating_actual,
                dr.comentario AS comentario_actual,
                dr.fecha AS fecha_calificacion
            FROM trips t
            LEFT JOIN driver_ratings dr
                ON dr.trip_id = t.trip_id
                AND dr.cliente = ?
            WHERE t.cliente = ?
              AND LOWER(COALESCE(t.estado_viaje, '')) = 'entregado'
              AND COALESCE(TRIM(t.conductor), '') <> ''
            ORDER BY COALESCE(t.fecha_llegada_estimada, t.fecha_salida, t.created_at) DESC
            LIMIT 30
        `, [clientName, clientName]);

        const clientTrips = Array.isArray(trips) ? trips : [];
        const total = clientTrips.length;
        const inTransit = clientTrips.filter(t => ['en ruta', 'en carga', 'programado'].includes(String(t.estado_viaje || '').toLowerCase())).length;
        const delivered = clientTrips.filter(t => String(t.estado_viaje || '').toLowerCase() === 'entregado').length;
        const invoices = clientTrips.filter(t => String(t.factura || '').trim() !== '').length;

        return res.render('cliente', {
            name: clientName,
            userName: clientName,
            clientTrips,
            rateableTrips: Array.isArray(rateableTrips) ? rateableTrips : [],
            feedbackType,
            feedbackMessage,
            stats: {
                total,
                inTransit,
                delivered,
                invoices
            }
        });
    } catch (error) {
        console.log('Error al cargar panel de cliente:', error);
        return res.render('cliente', {
            name: clientName,
            userName: clientName,
            clientTrips: [],
            rateableTrips: [],
            feedbackType: 'error',
            feedbackMessage: feedbackMessage || 'No se pudo cargar el panel de cliente.',
            stats: {
                total: 0,
                inTransit: 0,
                delivered: 0,
                invoices: 0
            }
        });
    }
});

app.post('/solicitar-envio', async (req, res) => {
    if (!(req.session.loggedin && req.session.rol === 'cliente')) {
        return res.redirect('/');
    }

    const origen = String(req.body.origen || '').trim();
    const destino = String(req.body.destino || '').trim();
    const direccionCarga = String(req.body.direccion_carga || '').trim();
    const direccionEntrega = String(req.body.direccion_entrega || '').trim();
    const distanciaEstimada = parseNullableDecimal(req.body.distancia_estimada);
    const tiempoEstimado = String(req.body.tiempo_estimado || '').trim();
    const tipoMercancia = String(req.body.tipo_mercancia || req.body.carga || '').trim();
    const peso = parseNullableDecimal(req.body.peso);
    const volumen = parseNullableDecimal(req.body.volumen);
    const cantidadPaquetes = parseNullableInt(req.body.cantidad_paquetes);
    const valorMercancia = parseNullableDecimal(req.body.valor_mercancia);
    const cliente = String(req.body.cliente || req.session.name || '').trim();
    const telefonoCliente = String(req.body.telefono_cliente || '').trim();
    const horaSalida = String(req.body.hora_salida || '').trim();
    const horaLlegada = String(req.body.hora_llegada || '').trim();
    const ubicacionActual = String(req.body.ubicacion_actual || '').trim();
    const paradas = String(req.body.paradas || '').trim();
    const incidentes = String(req.body.incidentes || '').trim();
    const observaciones = String(req.body.observaciones || '').trim();

    if (!origen || !destino || !tipoMercancia || !cliente) {
        return res.redirect('/cliente?feedbackType=error&feedbackMessage=' + encodeURIComponent('Completa los campos obligatorios para solicitar el envío.') + '#cliente-solicitud-envio');
    }

    try {
        await ensureTripsTable();

        const nowYmd = formatDateToYMD(new Date());
        const tripId = generateTripId();

        await queryDb('INSERT INTO trips SET ?', {
            trip_id: tripId,
            fecha_salida: nowYmd,
            estado_viaje: 'programado',
            tipo_viaje: 'cliente',
            origen,
            destino,
            direccion_carga: direccionCarga,
            direccion_entrega: direccionEntrega,
            distancia_estimada: distanciaEstimada,
            tiempo_estimado: tiempoEstimado,
            tipo_mercancia: tipoMercancia,
            peso,
            volumen,
            cantidad_paquetes: cantidadPaquetes,
            valor_mercancia: valorMercancia,
            cliente,
            hora_salida: horaSalida,
            hora_llegada: horaLlegada,
            ubicacion_actual: ubicacionActual,
            paradas,
            incidentes,
            observaciones: observaciones || 'Solicitud creada desde panel de cliente.',
            firma_cliente: telefonoCliente
        });

        return res.redirect('/cliente?feedbackType=success&feedbackMessage=' + encodeURIComponent('Solicitud de envío registrada correctamente.') + '#cliente-solicitud-envio');
    } catch (error) {
        console.log('Error al solicitar envio:', error);
        return res.redirect('/cliente?feedbackType=error&feedbackMessage=' + encodeURIComponent('No se pudo registrar la solicitud de envío.') + '#cliente-solicitud-envio');
    }
});

app.post('/cliente/editar-envio', async (req, res) => {
    if (!(req.session.loggedin && req.session.rol === 'cliente')) {
        return res.redirect('/');
    }

    const tripId = String(req.body.trip_id || '').trim();
    const origen = String(req.body.origen || '').trim();
    const destino = String(req.body.destino || '').trim();
    const direccionCarga = String(req.body.direccion_carga || '').trim();
    const direccionEntrega = String(req.body.direccion_entrega || '').trim();
    const distanciaEstimada = parseNullableDecimal(req.body.distancia_estimada);
    const tiempoEstimado = String(req.body.tiempo_estimado || '').trim();
    const tipoMercancia = String(req.body.tipo_mercancia || req.body.carga || '').trim();
    const peso = parseNullableDecimal(req.body.peso);
    const volumen = parseNullableDecimal(req.body.volumen);
    const cantidadPaquetes = parseNullableInt(req.body.cantidad_paquetes);
    const valorMercancia = parseNullableDecimal(req.body.valor_mercancia);
    const cliente = String(req.session.name || '').trim();
    const telefonoCliente = String(req.body.telefono_cliente || '').trim();
    const horaSalida = String(req.body.hora_salida || '').trim();
    const horaLlegada = String(req.body.hora_llegada || '').trim();
    const ubicacionActual = String(req.body.ubicacion_actual || '').trim();
    const paradas = String(req.body.paradas || '').trim();
    const incidentes = String(req.body.incidentes || '').trim();
    const observaciones = String(req.body.observaciones || '').trim();

    if (!tripId) {
        return res.redirect('/cliente?feedbackType=error&feedbackMessage=' + encodeURIComponent('No se recibió el identificador del envío para editar.') + '#cliente-solicitud-envio');
    }

    if (!origen || !destino || !tipoMercancia) {
        return res.redirect('/cliente?feedbackType=error&feedbackMessage=' + encodeURIComponent('Completa los campos obligatorios para actualizar el envío.') + '#cliente-solicitud-envio');
    }

    try {
        await ensureTripsTable();

        const tripRows = await queryDb(`
            SELECT id, estado_viaje
            FROM trips
            WHERE trip_id = ? AND cliente = ?
            LIMIT 1
        `, [tripId, cliente]);

        if (!Array.isArray(tripRows) || tripRows.length === 0) {
            return res.redirect('/cliente?feedbackType=error&feedbackMessage=' + encodeURIComponent('No puedes editar un envío que no pertenece a tu cuenta.') + '#cliente-solicitud-envio');
        }

        const estadoActual = String(tripRows[0].estado_viaje || '').toLowerCase();
        if (['entregado', 'cancelado'].includes(estadoActual)) {
            return res.redirect('/cliente?feedbackType=error&feedbackMessage=' + encodeURIComponent('Este envío ya no se puede editar por su estado actual.') + '#cliente-solicitud-envio');
        }

        await queryDb(`
            UPDATE trips SET
                origen = ?,
                destino = ?,
                direccion_carga = ?,
                direccion_entrega = ?,
                distancia_estimada = ?,
                tiempo_estimado = ?,
                tipo_mercancia = ?,
                peso = ?,
                volumen = ?,
                cantidad_paquetes = ?,
                valor_mercancia = ?,
                hora_salida = ?,
                hora_llegada = ?,
                ubicacion_actual = ?,
                paradas = ?,
                incidentes = ?,
                observaciones = ?,
                firma_cliente = ?
            WHERE trip_id = ? AND cliente = ?
        `, [
            origen,
            destino,
            direccionCarga,
            direccionEntrega,
            distanciaEstimada,
            tiempoEstimado,
            tipoMercancia,
            peso,
            volumen,
            cantidadPaquetes,
            valorMercancia,
            horaSalida,
            horaLlegada,
            ubicacionActual,
            paradas,
            incidentes,
            observaciones,
            telefonoCliente,
            tripId,
            cliente
        ]);

        return res.redirect('/cliente?feedbackType=success&feedbackMessage=' + encodeURIComponent('Envío actualizado correctamente.') + '#cliente-solicitud-envio');
    } catch (error) {
        console.log('Error al editar envío desde cliente:', error);
        return res.redirect('/cliente?feedbackType=error&feedbackMessage=' + encodeURIComponent('No se pudo actualizar el envío.') + '#cliente-solicitud-envio');
    }
});

app.post('/cliente/calificar-chofer', async (req, res) => {
    if (!(req.session.loggedin && req.session.rol === 'cliente')) {
        return res.redirect('/');
    }

    const cliente = String(req.session.name || '').trim();
    const tripId = String(req.body.trip_id || '').trim();
    const comentario = String(req.body.comentario || '').trim();
    const rating = parseNullableInt(req.body.rating);

    if (!tripId || rating === null || rating < 1 || rating > 5) {
        return res.redirect('/cliente?feedbackType=error&feedbackMessage=' + encodeURIComponent('Selecciona un viaje y una calificación válida de 1 a 5.') + '#cliente-calificar-chofer');
    }

    try {
        await ensureTripsTable();
        await ensureDriverRatingsTable();

        const tripRows = await queryDb(`
            SELECT trip_id, conductor, cliente, estado_viaje
            FROM trips
            WHERE trip_id = ? AND cliente = ?
            LIMIT 1
        `, [tripId, cliente]);

        if (!Array.isArray(tripRows) || tripRows.length === 0) {
            return res.redirect('/cliente?feedbackType=error&feedbackMessage=' + encodeURIComponent('El viaje seleccionado no pertenece a tu cuenta.') + '#cliente-calificar-chofer');
        }

        const trip = tripRows[0];
        const estado = String(trip.estado_viaje || '').toLowerCase();
        const chofer = String(trip.conductor || '').trim();

        if (estado !== 'entregado' || !chofer) {
            return res.redirect('/cliente?feedbackType=error&feedbackMessage=' + encodeURIComponent('Solo puedes calificar viajes entregados con chofer asignado.') + '#cliente-calificar-chofer');
        }

        await queryDb(`
            INSERT INTO driver_ratings (trip_id, chofer, cliente, rating, comentario, fecha)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                chofer = VALUES(chofer),
                rating = VALUES(rating),
                comentario = VALUES(comentario),
                fecha = VALUES(fecha)
        `, [
            tripId,
            chofer,
            cliente,
            rating,
            comentario,
            formatDateToYMD(new Date())
        ]);

        return res.redirect('/cliente?feedbackType=success&feedbackMessage=' + encodeURIComponent('Calificación guardada correctamente.') + '#cliente-calificar-chofer');
    } catch (error) {
        console.log('Error al guardar calificación del chofer:', error);
        return res.redirect('/cliente?feedbackType=error&feedbackMessage=' + encodeURIComponent('No se pudo guardar la calificación.') + '#cliente-calificar-chofer');
    }
});

app.post('/registrar-gasto', async (req, res) => {
    if (!(req.session.loggedin && req.session.rol === 'chofer')) {
        return res.redirect('/');
    }

    const tipoGasto = String(req.body.tipo_gasto || '').trim().toLowerCase();
    const descripcion = String(req.body.descripcion || '').trim();
    const monto = parseNullableDecimal(req.body.monto);
    const tiposPermitidos = ['combustible', 'peaje', 'comida', 'mantenimiento', 'otros'];

    if (!tiposPermitidos.includes(tipoGasto) || monto === null || monto <= 0 || !descripcion) {
        return res.redirect('/chofer?feedbackType=error&feedbackMessage=' + encodeURIComponent('Verifica tipo, monto y descripción del gasto.') + '#chofer-registrar-gastos');
    }

    try {
        await ensureDriverExpensesTable();

        await queryDb('INSERT INTO driver_expenses SET ?', {
            chofer: String(req.session.name || '').trim(),
            tipo_gasto: tipoGasto,
            monto,
            descripcion,
            fecha: formatDateToYMD(new Date())
        });

        return res.redirect('/chofer?feedbackType=success&feedbackMessage=' + encodeURIComponent('Gasto registrado correctamente.') + '#chofer-registrar-gastos');
    } catch (error) {
        console.log('Error al registrar gasto:', error);
        return res.redirect('/chofer?feedbackType=error&feedbackMessage=' + encodeURIComponent('No se pudo registrar el gasto.') + '#chofer-registrar-gastos');
    }
});

app.post('/chofer/actualizar-viaje', async (req, res) => {
    if (!(req.session.loggedin && req.session.rol === 'chofer')) {
        return res.redirect('/');
    }

    const chofer = String(req.session.name || '').trim();
    const choferUser = String(req.session.user || '').trim();
    const tripId = String(req.body.trip_id || '').trim();
    const estadoViaje = String(req.body.estado_viaje || '').trim().toLowerCase();
    const horaSalida = String(req.body.hora_salida || '').trim();
    const horaLlegada = String(req.body.hora_llegada || '').trim();
    const ubicacionActual = String(req.body.ubicacion_actual || '').trim();
    const paradas = String(req.body.paradas || '').trim();
    const incidentes = String(req.body.incidentes || '').trim();
    const observaciones = String(req.body.observaciones || '').trim();
    const combustible = parseNullableDecimal(req.body.combustible);
    const peajes = parseNullableDecimal(req.body.peajes);
    const viaticos = parseNullableDecimal(req.body.viaticos);
    const estadosPermitidos = ['programado', 'en carga', 'en ruta', 'entregado', 'cancelado'];

    if (!tripId || !estadosPermitidos.includes(estadoViaje)) {
        return res.redirect('/chofer?feedbackType=error&feedbackMessage=' + encodeURIComponent('Selecciona un viaje y un estado válido.') + '#chofer-actualizar-viaje');
    }

    try {
        await ensureTripsTable();

        const choferAliases = await getUserAliasesByRole('chofer', chofer, choferUser);
        if (choferAliases.length === 0) {
            return res.redirect('/chofer?feedbackType=error&feedbackMessage=' + encodeURIComponent('No se pudo validar tu usuario de chofer.') + '#chofer-actualizar-viaje');
        }

        const aliasMarks = choferAliases.map(() => '?').join(', ');
        const tripRows = await queryDb(`
            SELECT id
            FROM trips
            WHERE trip_id = ?
              AND LOWER(TRIM(conductor)) IN (${aliasMarks})
            LIMIT 1
        `, [tripId, ...choferAliases]);
        if (!Array.isArray(tripRows) || tripRows.length === 0) {
            return res.redirect('/chofer?feedbackType=error&feedbackMessage=' + encodeURIComponent('No puedes actualizar un viaje que no está asignado a tu usuario.') + '#chofer-actualizar-viaje');
        }

        const tripDbId = Number(tripRows[0].id || 0);
        if (!Number.isFinite(tripDbId) || tripDbId <= 0) {
            return res.redirect('/chofer?feedbackType=error&feedbackMessage=' + encodeURIComponent('No se pudo identificar el viaje a actualizar.') + '#chofer-actualizar-viaje');
        }

        const combustibleVal = combustible || 0;
        const peajesVal = peajes || 0;
        const viaticosVal = viaticos || 0;
        const costoTotal = combustibleVal + peajesVal + viaticosVal;

        await queryDb(`
            UPDATE trips SET
                estado_viaje = ?,
                hora_salida = ?,
                hora_llegada = ?,
                ubicacion_actual = ?,
                paradas = ?,
                incidentes = ?,
                observaciones = ?,
                combustible = ?,
                peajes = ?,
                viaticos = ?,
                costo_total = ?
            WHERE id = ?
        `, [
            estadoViaje,
            horaSalida,
            horaLlegada,
            ubicacionActual,
            paradas,
            incidentes,
            observaciones,
            combustible,
            peajes,
            viaticos,
            costoTotal,
            tripDbId
        ]);

        return res.redirect('/chofer?feedbackType=success&feedbackMessage=' + encodeURIComponent('Viaje actualizado correctamente.') + '#chofer-actualizar-viaje');
    } catch (error) {
        console.log('Error al actualizar viaje desde chofer:', error);
        return res.redirect('/chofer?feedbackType=error&feedbackMessage=' + encodeURIComponent('No se pudo actualizar el viaje.') + '#chofer-actualizar-viaje');
    }
});


// ================= REGISTRO =================

app.post('/register', async (req, res) => {

    const user = String(req.body.user || '').trim();
    const name = String(req.body.name || '').trim();
    const rol = String(req.body.rol || '').trim();
    const pass = String(req.body.pass || '');
    const telefono = String(req.body.telefono || '').trim();

    if (!user || !name || !rol || !pass || !telefono) {
        return res.render('register', {
            alert: {
                Title: "Campos incompletos",
                Text: "Completa todos los campos, incluyendo el número de teléfono.",
                Icon: "warning",
                showConfirmButton: true,
                timer: 4000
            },
            ruta: '/register'
        });
    }

    let passwordHash = await bcrypt.hash(pass, 8);

    try {
        await ensureUsersPhoneColumn();

        const payload = {
            user: user,
            name: name,
            rol: rol,
            pass: passwordHash,
            telefono: telefono
        };

        try {
            await queryDb('INSERT INTO users SET ?', payload);
        } catch (insertError) {
            const msg = String((insertError && insertError.message) || '');
            if (msg.includes("Unknown column 'telefono'")) {
                await queryDb('INSERT INTO users SET ?', {
                    user: user,
                    name: name,
                    rol: rol,
                    pass: passwordHash
                });
            } else {
                throw insertError;
            }
        }

        // crear sesión automáticamente
        req.session.loggedin = true;
        req.session.user = user;
        req.session.name = name;
        req.session.rol = rol;

        let destino = "/";

        if (rol === "admin") {
            destino = "/admin";
        }
        else if (rol === "cliente") {
            destino = "/cliente";
        }
        else if (rol === "chofer") {
            destino = "/chofer";
        }

        return res.render('register', {
            alert: {
                Title: "Registro exitoso",
                Text: "El usuario se ha registrado correctamente",
                Icon: "success",
                showConfirmButton: false,
                timer: 1500
            },
            ruta: destino
        });
    } catch (error) {
        console.log(error);
        return res.render('register', {
            alert: {
                Title: "No se pudo registrar",
                Text: "Verifica si el usuario ya existe e intenta nuevamente.",
                Icon: "error",
                showConfirmButton: true,
                timer: 4500
            },
            ruta: '/register'
        });
    }

});


// ================= LOGIN =================

app.post('/auth', async (req, res) => {

    const user = req.body.user;
    const pass = req.body.pass;

    if (user && pass) {

        connection.query('SELECT * FROM users WHERE user = ?', [user], async (error, results) => {

            if (results.length == 0 || !(await bcrypt.compare(pass, results[0].pass))) {

                res.render('login', {
                    alert: true,
                    alertTitle: "Error",
                    alertMessage: "Usuario y/o contraseña incorrectos",
                    alertIcon: 'error',
                    showConfirmButton: true,
                    timer: false,
                    ruta: 'login'
                });

            } else {

                req.session.loggedin = true;
                req.session.user = results[0].user;
                req.session.name = results[0].name;
                req.session.rol = results[0].rol;

                let destino = "/" + results[0].rol;

                res.render('login', {
                    alert: true,
                    alertTitle: "Bienvenido",
                    alertMessage: "Has ingresado correctamente",
                    alertIcon: 'success',
                    showConfirmButton: false,
                    timer: 1500,
                    ruta: destino
                });

            }

        });

    } else {

        res.render('login', {
            alert: true,
            alertTitle: "Advertencia",
            alertMessage: "Por favor ingrese un usuario y/o contraseña",
            alertIcon: 'warning',
            showConfirmButton: true,
            timer: false,
            ruta: 'login'
        });

    }

});


// ================= INDEX =================

app.get('/', (req, res) => {

    if (req.session.loggedin) {

        res.render('index', {
            login: true,
            name: req.session.name
        });

    } else {

        res.render('index', {
            login: false,
            name: '“ LOGÍSTICA INTELIGENTE SOLUCIONES EN MOVIMIENTO ” '
        });

    }

});


// ================= LOGOUT =================

app.get('/logout', (req, res) => {

    req.session.destroy((err) => {

        if (err) {
            console.log(err);
        }

        res.redirect('/');

    });

});


// ================= SERVER =================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});