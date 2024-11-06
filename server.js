const express = require('express');
const app = express();
const port = 3000;
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
app.use(cors());

// Simulación de base de datos (puedes usar una base de datos real, como MongoDB, MySQL, etc.)
const pool = mysql.createPool({
  host: 'localhost',         // Dirección del servidor de la base de datos
  user: 'root',              // Usuario de la base de datos
  password: 'root', // Contraseña de la base de datos
  database: 'coordidana', // Nombre de la base de datos
  port: 3307                 // Puerto del servidor MariaDB (por defecto es 3306)
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


// API para obtener el color de una calle
app.get('/get-all-street-colors', async (req, res) => {
    //res.json(streetsData);  // Devuelve todos los colores de las calles en un solo objeto

    try {
      const [rows] = await promisePool.query('SELECT * FROM tramo');
      const result = rows.reduce((acc, row) => {
        const { ID_TRAMO, ...columns } = row; // Desestructurar la fila para obtener las columnas
        acc[ID_TRAMO] = columns; // Agregar al diccionario
        return acc;
      }, {});
      res.status(200).json(result);
    } catch (err) {
      console.error('Error al ejecutar la consulta:', err);
      res.status(500).json({ message: 'Error en la consulta' });
    }
  });


  app.use(bodyParser.json());

// Endpoint para actualizar los datos de la calle
app.post('/post-street/:id', async (req, res) => {
  const streetId = req.params.id;
  const { nombre, comentario, transitable, coches, escombros } = req.body;

  // Query para actualizar la calle en la base de datos
  const query = 'INSERT INTO tramo(NOMBRE, COMENTARIO, TRANSITABLE, COCHES, ESCOMBROS, ID_TRAMO) VALUES (?, ?, ?, ?, ?, ?)';
  try{
    const [result] = await promisePool.query(query, [nombre, comentario, transitable, coches, escombros, streetId])

    const insertId = result.insertId;
    const [row] = await promisePool.query('SELECT * FROM tramo WHERE id = ?', [insertId]);

    res.status(200).json({ message: 'Calle agregada exitosamente', row });
  }catch (err) {
    console.error('Error al insertar los datos:', err);
    res.status(500).json({ error: 'Error al guardar los datos' });
  }
});

app.put('/update-street/:id', async (req, res) => {
  const streetId = req.params.id;
  const { nombre, comentario, transitable, coches, escombros } = req.body;

  // Query para actualizar la calle en la base de datos
  const query = 'UPDATE tramo SET NOMBRE = ?, COMENTARIO = ?, TRANSITABLE = ?, COCHES = ?, ESCOMBROS = ? WHERE ID = ?';
  try{
    const [result] = await promisePool.query(query, [nombre, comentario, transitable, coches, escombros, streetId])
    
    const [row] = await promisePool.query('SELECT * FROM tramo WHERE id = ?', [streetId]);

    res.status(200).json({ message: 'Calle actualizada exitosamente', row });
  }catch (err) {
    console.error('Error al insertar los datos:', err);
    res.status(500).json({ error: 'Error al guardar los datos' });
  }
});

  app.post('/upload-photo/:streetId', upload.single('photo'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ninguna imagen' });
    }
  
    // Construir la URL de la foto subida
    const photoUrl = `/uploads/${req.params.streetId}/${new Date().toISOString().split('T')[0]}/${req.file.filename}`;
    res.json({ message: 'Foto subida con éxito', photoUrl: photoUrl });
  });
  

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
