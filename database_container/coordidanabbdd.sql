-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Versión del servidor:         11.5.2-MariaDB - mariadb.org binary distribution
-- SO del servidor:              Win64
-- HeidiSQL Versión:             11.3.0.6295
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Volcando estructura de base de datos para coordidana
CREATE DATABASE IF NOT EXISTS `coordidana` /*!40100 DEFAULT CHARACTER SET latin1 COLLATE latin1_swedish_ci */;
USE `coordidana`;

-- Volcando estructura para evento coordidana.actualizar_prioridades
DELIMITER //
CREATE EVENT `actualizar_prioridades` ON SCHEDULE EVERY 1 DAY STARTS '2024-11-07 14:34:52' ON COMPLETION NOT PRESERVE ENABLE DO BEGIN
DECLARE nueva_prioridad DECIMAL(10, 2);
  DECLARE suma_prioridades DECIMAL(10, 2);
  
  -- Recalcular las prioridades para todos los tramos
  FOR tramo_record IN (SELECT DISTINCT id_tramo FROM reportes) DO
    -- Calcular la suma ponderada de las prioridades de los reportes, con el peso exponencial de la antigüedad
     SELECT SUM(prioridad_ponderada) / SUM(peso_fecha) INTO nueva_prioridad
	FROM (
	SELECT
        id_tramo,
        prioridad,
        DATEDIFF(CURRENT_DATE, fecha) AS dias_desde_reporte,
        (1.0 / (1.0 + DATEDIFF(CURRENT_DATE, fecha))) AS peso_fecha,
        prioridad * (1.0 / (1.0 + DATEDIFF(CURRENT_DATE, fecha))) AS prioridad_ponderada
    FROM
        reportes WHERE id_tramo = tramo_record.id_tramo) AS ponderado;
   
    UPDATE tramo
    SET prioridad = nueva_prioridad
    WHERE id_tramo = tramo_record.id_tramo;

  END FOR;
END//
DELIMITER ;


-- Volcando estructura para tabla coordidana.tramo
CREATE TABLE IF NOT EXISTS `tramo` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `ID_TRAMO` varchar(50) NOT NULL DEFAULT '',
  `PRIORIDAD` int(11) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para tabla coordidana.usuario
CREATE TABLE IF NOT EXISTS `usuario` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `USUARIO` varchar(50) NOT NULL DEFAULT '',
  `PASS` varchar(50) NOT NULL DEFAULT '',
  `EMAIL` varchar(100) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- La exportación de datos fue deseleccionada.


-- Volcando estructura para tabla coordidana.reportes
CREATE TABLE IF NOT EXISTS `reportes` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `NOMBRE` varchar(100) NOT NULL DEFAULT '',
  `COMENTARIO` varchar(400) DEFAULT '',
  `TRANSITABLE` int(11) NOT NULL,
  `COCHES` int(11) NOT NULL DEFAULT 0,
  `ESCOMBROS` int(11) NOT NULL DEFAULT 0,
  `ID_TRAMO` varchar(50) DEFAULT NULL,
  `ID_USUARIO` int(11) NOT NULL,
  `PRIORIDAD` int(11) NOT NULL,
  `FECHA` date DEFAULT NULL,
  PRIMARY KEY (`ID`),
  KEY `FK_ID_USUARIO` (`ID_USUARIO`),
  CONSTRAINT `FK_ID_USUARIO` FOREIGN KEY (`ID_USUARIO`) REFERENCES `usuario` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=71 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- La exportación de datos fue deseleccionada.

-- Volcando estructura para disparador coordidana.actualizar_prioridad
SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `actualizar_prioridad` AFTER INSERT ON `reportes` FOR EACH ROW BEGIN
	DECLARE nueva_prioridad DECIMAL(10, 2);
	DECLARE total_reportes DECIMAL(10, 2);    

   SELECT SUM(prioridad_ponderada) / SUM(peso_fecha) INTO nueva_prioridad
	FROM (
	SELECT
        id_tramo,
        prioridad,
        DATEDIFF(CURRENT_DATE, fecha) AS dias_desde_reporte,
        -- Ponderación inversa de la fecha, cuanto más reciente, más peso tiene
        (1.0 / (1.0 + DATEDIFF(CURRENT_DATE, fecha))) AS peso_fecha,
        -- Multiplicamos la prioridad por el peso de la fecha
        prioridad * (1.0 / (1.0 + DATEDIFF(CURRENT_DATE, fecha))) AS prioridad_ponderada
    FROM
        reportes WHERE id_tramo = NEW.id_tramo) AS ponderado;

	SELECT COUNT(*)
	INTO total_reportes
	FROM tramo
	WHERE id_tramo = NEW.ID_TRAMO;
	
 	IF total_reportes = 0 THEN
    SET nueva_prioridad = NEW.PRIORIDAD;  -- O el valor que consideres adecuado si no hay reportes
  END IF;

  -- Verificar si el tramo ya existe
  IF EXISTS (SELECT 1 FROM tramo WHERE id = NEW.id_tramo) THEN
    -- Si existe, actualizar la prioridad
    UPDATE tramo
    SET prioridad = nueva_prioridad
    WHERE id = NEW.id_tramo;
  ELSE
    -- Si no existe, insertar el nuevo tramo con la prioridad calculada
    INSERT INTO tramo (id_TRAMO, prioridad)
    VALUES (NEW.id_tramo, nueva_prioridad);
  END IF;
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
