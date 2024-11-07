# Usa la imagen oficial de MariaDB como base
FROM mariadb:latest

# Copia un archivo de configuración personalizado (opcional)
# COPY my-custom.cnf /etc/mysql/conf.d/

# Copia scripts de inicialización al contenedor (opcional)
# Los scripts .sql o .sh en /docker-entrypoint-initdb.d se ejecutan automáticamente al iniciar
COPY coordidanabbdd.sql  /docker-entrypoint-initdb.d/

# Expone el puerto 3306 para las conexiones de la base de datos
EXPOSE 3307
