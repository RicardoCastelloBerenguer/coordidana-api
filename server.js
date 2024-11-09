const express = require('express');
const app = express();
const port = 4000;
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // O usa '*' para permitir todos los orígenes
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204); // Responde a las solicitudes preflight
    }

    next();
});

const pool = mysql.createPool({
  host: 'localhost',         // Dirección del servidor de la base de datos
  user: 'root',              // Usuario de la base de datos
  password: 'root', // Contraseña de la base de datos
  database: 'coordidana', // Nombre de la base de datos
  port: 3306                 // Puerto del servidor MariaDB (por defecto es 3306)
});

const promisePool = pool.promise();

module.exports = promisePool;


const createDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Obtener el ID de la calle y la fecha actual
    const streetId = req.params.streetId;
    
    // Crear la ruta de destino dinámica: /uploads/streetId/fecha/
    const dirPath = path.join(__dirname, 'uploads', streetId);
    createDirectory(dirPath); // Crear la carpeta si no existe
    
    cb(null, dirPath);
  },
  filename: (req, file, cb) => {
    // Guardar el archivo con un nombre único para evitar colisiones
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = `${uniqueSuffix}${path.extname(file.originalname)}`;
    cb(null, fileName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Límite de tamaño de archivo: 10MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/; // Solo imágenes
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      return cb(new Error('Solo se permiten imágenes JPEG, JPG, PNG o GIF.'));
    }
  }
});

// Recupera las prioridades de las calles
app.get('/prioridades', async (req, res) => {

    try {
      const [rows] = await promisePool.query('SELECT ID as id, ID_TRAMO as id_tramo, PRIORIDAD as prioridad FROM tramo');

      const result = rows.reduce((acc, row) => {
        const { id_tramo, ...columns } = row; // Desestructurar la fila para obtener las columnas
        acc[id_tramo] = columns; // Agregar al diccionario
        return acc;
      }, {});
      
      res.status(200).json(result);
    } catch (err) {
      console.error('Error al ejecutar la consulta:', err);
      res.status(500).json({ message: 'Error en la consulta' });
    }
  });

// Recupera los comentarios de una calle
app.get('/comentarios/:id', async (req, res) => {

  try {
    const streetId = req.params.id;
    const [rows] = await promisePool.query('SELECT comentario as comentario FROM reportes WHERE ID_TRAMO = ?', [streetId]);
    
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error al ejecutar la consulta:', err);
    res.status(500).json({ message: 'Error en la consulta' });
  }
});

//ENDPOINT para registrar a un usuario
app.post('/register', async (req, res) => {

    try {
      const { usuario, pass, email } = req.body;

      const queryEmail = 'SELECT COUNT(1) as existe FROM usuario WHERE email = ?';
      
      const [resultEmail] = await promisePool.query(queryEmail, [email])
      
      const queryUsu = 'SELECT COUNT(1) as existe FROM usuario WHERE usuario = ?';
      
      const [resultUsu] = await promisePool.query(queryUsu, [usuario])
      if(resultEmail != undefined && resultEmail[0].existe != 0){

        res.status(401).json({ message: 'Email ya registrado'});
      } else if(resultUsu != undefined && resultUsu[0].existe != 0){

        res.status(401).json({ message: 'Nombre de usuario ya registrado'});
      }else {
        const query = 'INSERT INTO usuario(USUARIO, PASS, EMAIL) VALUES (?, ?, ?)';
        const [result] = await promisePool.query(query, [usuario, pass, email])
        res.status(200).json({ message: 'Registro completado correctamente'});
      }
    } catch (err) {
      console.error('Error al ejecutar la consulta:', err);
      res.status(500).json({ message: 'Error en la consulta' });
    }
  });

  app.post('/login', async (req, res) => {

    try {
      const { usuario, pass } = req.body;

      const query = 'SELECT ID as id FROM usuario WHERE (usuario = ? OR email = ?) and pass = ?';
      const [result] = await promisePool.query(query, [usuario, usuario, pass])
      console.log(result)
      if(result.length != 0 && result[0].id != undefined){

        res.status(200).json({ message: 'Login completado', usuario: result[0].id});
      } else {
        res.status(401).json({ message: 'Credenciales incorrectas'});
      }
    } catch (err) {
      console.error('Error al ejecutar la consulta:', err);
      res.status(500).json({ message: 'Error en la consulta' });
    }
  });

// Endpoint para guardar los datos de la calle
app.post('/reportes/:id', async (req, res) => {
  const streetId = req.params.id;
  const { nombre, comentario, transitable, coches, escombros, idUsuario, prioridad } = req.body;

  // Query para actualizar la calle en la base de datos
  const query = 'INSERT INTO reportes(NOMBRE, COMENTARIO, TRANSITABLE, COCHES, ESCOMBROS, ID_TRAMO, ID_USUARIO, PRIORIDAD, FECHA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())';
  try{
    const [result] = await promisePool.query(query, [nombre, comentario, transitable, coches, escombros, streetId, idUsuario, prioridad])

    const insertId = result.insertId;
    const [row] = await promisePool.query('SELECT * FROM reportes WHERE id = ?', [insertId]);

    res.status(200).json({ message: 'Reporte exitosamente', row });
  }catch (err) {
    console.error('Error al insertar los datos:', err);
    res.status(500).json({ error: 'Error al guardar los datos' });
  }
});

// Endpoint para cargar los datos de la calle
app.get('/tramo/:id', async (req, res) => {
  const streetId = req.params.id;

  // Query para actualizar la calle en la base de datosº
  const query = 'SELECT PRIORIDAD AS prioridad from tramo WHERE id_tramo = ?';
  try{
    const [row]  = await promisePool.query(query, [streetId])

    if(row.length > 0){
      res.status(200).json( row[0] );
    } else {
      res.status(403).json( {error: "No se ha encontrado el tramo"} );
    }
  }catch (err) {
    console.error('Error al insertar los datos:', err);
    res.status(500).json({ error: 'Error al guardar los datos' });
  }
});

// Endpoint para RECOGER los datos del garaje
app.get('/garaje/:id', async (req, res) => {
  const garajeId = req.params.id;

  // Query para actualizar la calle en la base de datos
  const query = 'SELECT ID as id, ID_USUARIO AS id_usuario, FECHA AS fecha, CODIGO as codigo, ESTADO as estado, COMENTARIO as comentario FROM garaje WHERE codigo = ? ORDER BY FECHA DESC LIMIT 1';
  try{
    const [row]  = await promisePool.query(query, [garajeId])

    if(row.length > 0){
      res.status(200).json( row[0] );
    } else {
      res.status(200).json( {mensaje: "No se ha encontrado el garaje"} );
    }
  }catch (err) {
    console.error('Error al realizar la consulta:', err);
    res.status(500).json({ error: 'Error al realizar la consulta' });
  }
});

// Endpoint para RECOGER los datos del garaje
app.get('/colores-garajes', async (req, res) => {
  const garajeId = req.params.id;

  // Query para actualizar la calle en la base de datos
  const query = 'SELECT t1.id, t1.codigo, t1.estado, t1.fecha FROM garaje t1 JOIN ( SELECT codigo, MAX(fecha) AS max_fecha FROM garaje  GROUP BY codigo ) t2 ON t1.codigo = t2.codigo AND t1.fecha = t2.max_fecha';
  try{
    const [rows]  = await promisePool.query(query)

    const result = rows.reduce((acc, row) => {
      const { codigo, ...columns } = row; // Desestructurar la fila para obtener las columnas
      acc[codigo] = columns; // Agregar al diccionario
      return acc;
    }, {});
    if(rows.length > 0){
      res.status(200).json( result );
    } else {
      res.status(200).json( {mensaje: "No se han encontrado datos de garajes"} );
    }
  }catch (err) {
    console.error('Error al realizar la consulta:', err);
    res.status(500).json({ error: 'Error al realizar la consulta' });
  }
});

// Endpoint para guardar los datos de la calle
app.post('/garaje', async (req, res) => {
  const { idUsuario, codigo, estado, comentario } = req.body;

  // Query para actualizar la calle en la base de datos
  const query = 'INSERT INTO garaje(ID_USUARIO, CODIGO, ESTADO, COMENTARIO) VALUES ( ?, ?, ?, ?)';
  try{
    const [result] = await promisePool.query(query, [idUsuario, codigo, estado, comentario])

    const insertId = result.insertId;
    const [row] = await promisePool.query('SELECT * FROM garaje WHERE id = ?', [insertId]);

    res.status(200).json({ message: 'Estado del garaje guardado exitosamente', row });
  }catch (err) {
    console.error('Error al insertar los datos:', err);
    res.status(500).json({ error: 'Error al guardar los datos' });
  }
});


// Endpoint para actualizar los datos de la calle
app.put('/update-street/:id', async (req, res) => {
  const streetId = req.params.id;
  const { nombre, comentario, transitable, coches, escombros, idUsuario } = req.body;

  // Query para actualizar la calle en la base de datos
  const query = 'UPDATE tramo SET NOMBRE = ?, COMENTARIO = ?, TRANSITABLE = ?, COCHES = ?, ESCOMBROS = ?, ID_USUARIO = ? WHERE ID = ?';
  try{
    const [result] = await promisePool.query(query, [nombre, comentario, transitable, coches, escombros, idUsuario, streetId])
    
    const [row] = await promisePool.query('SELECT * FROM tramo WHERE id = ?', [streetId]);

    res.status(200).json({ message: 'Calle actualizada exitosamente', row });
  }catch (err) {
    console.error('Error al insertar los datos:', err);
    res.status(500).json({ error: 'Error al guardar los datos' });
  }
});

//endpoint para actalizar una foto
  app.post('/upload-photo/:streetId', upload.single('photo'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ninguna imagen' });
    }
  
    // Construir la URL de la foto subida
    const photoUrl = `/uploads/${req.params.streetId}/${req.file.filename}`;
    res.json({ message: 'Foto subida con éxito', photoUrl: photoUrl });
  });
  

  //endpoint para recuperar las fotos de una calle
  app.get('/photos/:streetId', (req, res) => {
    const streetId = req.params.streetId;
    const dirPath = path.join(__dirname, 'uploads', streetId);
    // Verificar si la carpeta existe
    if (!fs.existsSync(dirPath)) {
      return res.json([]);  // Si no hay fotos, devolver un array vacío
    }
  
    // Buscar fotos en todas las subcarpetas de streetId
    const photoUrls = [];
      if (fs.lstatSync(dirPath).isDirectory()) {
        fs.readdirSync(dirPath).forEach(file => {
          photoUrls.push(`/uploads/${streetId}/${file}`);
        });
      }
  
    res.json(photoUrls); // Devolver todas las URLs de fotos encontradas
  });

  // Hacer que los archivos estáticos sean accesibles
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
