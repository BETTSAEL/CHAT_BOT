// db.js
const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'mi_base_de_datos'
});

connection.connect(err => {
    if (err) {
        console.error('❌ Error al conectar a MySQL:', err);
    } else {
        console.log('✅ Conectado a MySQL');
    }
});

module.exports = connection;
