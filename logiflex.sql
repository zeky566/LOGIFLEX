-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 20-04-2026 a las 21:48:11
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `logiflex`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `driver_expenses`
--

CREATE TABLE `driver_expenses` (
  `id` int(11) NOT NULL,
  `chofer` varchar(120) NOT NULL,
  `tipo_gasto` varchar(60) NOT NULL,
  `monto` decimal(12,2) NOT NULL,
  `descripcion` varchar(255) DEFAULT '',
  `fecha` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `driver_ratings`
--

CREATE TABLE `driver_ratings` (
  `id` int(11) NOT NULL,
  `trip_id` varchar(40) NOT NULL,
  `chofer` varchar(120) NOT NULL,
  `cliente` varchar(120) NOT NULL,
  `rating` tinyint(4) NOT NULL,
  `comentario` varchar(255) DEFAULT '',
  `fecha` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `trips`
--

CREATE TABLE `trips` (
  `id` int(11) NOT NULL,
  `trip_id` varchar(40) NOT NULL,
  `fecha_salida` date DEFAULT NULL,
  `fecha_llegada_estimada` date DEFAULT NULL,
  `estado_viaje` varchar(40) DEFAULT 'programado',
  `tipo_viaje` varchar(40) DEFAULT '',
  `origen` varchar(150) DEFAULT '',
  `destino` varchar(150) DEFAULT '',
  `direccion_carga` varchar(255) DEFAULT '',
  `direccion_entrega` varchar(255) DEFAULT '',
  `distancia_estimada` decimal(10,2) DEFAULT NULL,
  `tiempo_estimado` varchar(80) DEFAULT '',
  `vehiculo_asignado` varchar(120) DEFAULT '',
  `conductor` varchar(120) DEFAULT '',
  `ayudante` varchar(120) DEFAULT '',
  `capacidad_utilizada` varchar(80) DEFAULT '',
  `tipo_mercancia` varchar(120) DEFAULT '',
  `peso` decimal(10,2) DEFAULT NULL,
  `volumen` decimal(10,2) DEFAULT NULL,
  `cantidad_paquetes` int(11) DEFAULT NULL,
  `valor_mercancia` decimal(12,2) DEFAULT NULL,
  `cliente` varchar(120) DEFAULT '',
  `hora_salida` varchar(20) DEFAULT '',
  `hora_llegada` varchar(20) DEFAULT '',
  `ubicacion_actual` varchar(180) DEFAULT '',
  `paradas` text DEFAULT NULL,
  `incidentes` text DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `combustible` decimal(10,2) DEFAULT NULL,
  `peajes` decimal(10,2) DEFAULT NULL,
  `viaticos` decimal(10,2) DEFAULT NULL,
  `costo_total` decimal(12,2) DEFAULT NULL,
  `ganancia` decimal(12,2) DEFAULT NULL,
  `orden_transporte` varchar(180) DEFAULT '',
  `factura` varchar(180) DEFAULT '',
  `carta_porte` varchar(180) DEFAULT '',
  `comprobante_entrega` varchar(180) DEFAULT '',
  `firma_cliente` varchar(180) DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `trips`
--

INSERT INTO `trips` (`id`, `trip_id`, `fecha_salida`, `fecha_llegada_estimada`, `estado_viaje`, `tipo_viaje`, `origen`, `destino`, `direccion_carga`, `direccion_entrega`, `distancia_estimada`, `tiempo_estimado`, `vehiculo_asignado`, `conductor`, `ayudante`, `capacidad_utilizada`, `tipo_mercancia`, `peso`, `volumen`, `cantidad_paquetes`, `valor_mercancia`, `cliente`, `hora_salida`, `hora_llegada`, `ubicacion_actual`, `paradas`, `incidentes`, `observaciones`, `combustible`, `peajes`, `viaticos`, `costo_total`, `ganancia`, `orden_transporte`, `factura`, `carta_porte`, `comprobante_entrega`, `firma_cliente`, `created_at`) VALUES
(6, 'TR-20260324-130045-886', '2026-03-24', NULL, 'programado', 'cliente', 'El Carmen Tequexquitla. tlaxcala', 'Oriental. puebla.', 'aejgvadjlgvadhj', 'ejgvajlvblabj', NULL, 'No aplica', '', '-', '', '', 'pesada', 39999.00, 28181365.00, 323, 5000000.00, 'Jonathan Silva Galeote', '13:05', '19:06', 'No aplica', 'No aplica', 'No aplica', 'hlejadvbhaj f blJRFB', NULL, NULL, NULL, NULL, NULL, '', '', '', '', '2345678899', '2026-03-24 19:00:45'),
(7, 'TR-20260324-130328-826', '2026-03-24', NULL, 'programado', 'cliente', 'Libres. puebla.', 'Oriental. puebla.', 'sdfhgljksfghaslh', 'jbadlvbajld', 45235634.00, 'No aplica', '', '', '', '', 'pesada', 99999999.99, 45.00, 24, 4635623.00, 'Jonathan Silva Galeote', '18:03', '19:03', 'No aplica', 'No aplica', 'No aplica', 'sdbvLJBVÑJwbvbajvb', NULL, NULL, NULL, NULL, NULL, '', '', '', '', '4134634613473', '2026-03-24 19:03:28'),
(8, 'TR-20260324-133449-966', '2026-03-24', NULL, 'programado', 'cliente', 'Libres. puebla.', 'Oriental. puebla.', 'tetela', 'la coco', NULL, '18', '', '', '', '', 'juguetes', 5000.00, NULL, NULL, 50000.00, 'Jonathan Silva Galeote', '16:00', '16:15', 'No aplica', 'No aplica', 'No aplica', 'nunguno', NULL, NULL, NULL, NULL, NULL, '', '', '', '', '2761378507', '2026-03-24 19:34:49');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `user` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `telefono` varchar(30) DEFAULT '',
  `rol` varchar(50) NOT NULL,
  `pass` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `users`
--

INSERT INTO `users` (`id`, `user`, `name`, `telefono`, `rol`, `pass`) VALUES
(35, 'SOPORTEC´S', 'Ezequiel Suarez Calle', '', 'admin', '$2b$08$ItNDqnroxG03ECJIsOuSDO92Rm7MceroNRsaDmzpqPB9jmVdq7NHK'),
(36, 'Brócoli', 'Jonathan Silva Galeote', '', 'cliente', '$2b$08$5JhqnF3eusxMuTyVaCIyLeaaymj3FOLk1YL9HG9KQ23O0GCqK5nMq'),
(37, 'Carnal´s', 'Roberto Carlos Reyes Bautista', '', 'chofer', '$2b$08$gKWodOhowIRSDV4pn4aw3.70AIfLJTzJ4leBVXPKR2dhZUob5dPU2');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `vehicles`
--

CREATE TABLE `vehicles` (
  `id` int(11) NOT NULL,
  `placas` varchar(30) NOT NULL,
  `numero_unidad` varchar(50) DEFAULT '',
  `marca` varchar(80) DEFAULT '',
  `modelo` varchar(80) DEFAULT '',
  `anio` int(11) DEFAULT NULL,
  `tipo_vehiculo` varchar(60) DEFAULT '',
  `vin` varchar(50) DEFAULT '',
  `capacidad_carga` varchar(60) DEFAULT '',
  `tipo_combustible` varchar(40) DEFAULT '',
  `kilometraje_actual` int(11) DEFAULT NULL,
  `estado_vehiculo` varchar(60) DEFAULT 'activo',
  `tarjeta_circulacion` varchar(150) DEFAULT '',
  `seguro` varchar(150) DEFAULT '',
  `vencimiento_seguro` date DEFAULT NULL,
  `verificacion_vehicular` varchar(150) DEFAULT '',
  `permisos_licencias` varchar(255) DEFAULT '',
  `propietario_vehiculo` varchar(120) DEFAULT '',
  `fecha_registro` date DEFAULT NULL,
  `fecha_ultimo_servicio` date DEFAULT NULL,
  `tipo_servicio` varchar(120) DEFAULT '',
  `proximo_mantenimiento` date DEFAULT NULL,
  `historial_mantenimiento` text DEFAULT NULL,
  `cambio_aceite` varchar(120) DEFAULT '',
  `cambio_llantas` varchar(120) DEFAULT '',
  `costo_servicio` decimal(10,2) DEFAULT NULL,
  `conductor_asignado` varchar(120) DEFAULT '',
  `ruta_asignada` varchar(180) DEFAULT '',
  `disponibilidad` varchar(60) DEFAULT '',
  `ubicacion` varchar(180) DEFAULT '',
  `historial_viajes` text DEFAULT NULL,
  `consumo_combustible` varchar(80) DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `driver_expenses`
--
ALTER TABLE `driver_expenses`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `driver_ratings`
--
ALTER TABLE `driver_ratings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_trip_cliente` (`trip_id`,`cliente`),
  ADD KEY `idx_chofer` (`chofer`);

--
-- Indices de la tabla `trips`
--
ALTER TABLE `trips`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_trip_id` (`trip_id`);

--
-- Indices de la tabla `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `vehicles`
--
ALTER TABLE `vehicles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_placas` (`placas`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `driver_expenses`
--
ALTER TABLE `driver_expenses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `driver_ratings`
--
ALTER TABLE `driver_ratings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `trips`
--
ALTER TABLE `trips`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT de la tabla `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40;

--
-- AUTO_INCREMENT de la tabla `vehicles`
--
ALTER TABLE `vehicles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
