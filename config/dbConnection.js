const mysql = require('mysql');
const dotenv = require('dotenv');

dotenv.config();
var connection;

function handleDisconnect() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,  // Changed from PORT to DB_PORT
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME,
        insecureAuth: false,
        dateStrings: true,
        connectionLimit: 10,
    };

    console.log('🔌 Connecting to database...');
    console.log('   Host:', dbConfig.host);
    console.log('   Port:', dbConfig.port);
    console.log('   User:', dbConfig.user);
    console.log('   Database:', dbConfig.database);

    connection = mysql.createPool(dbConfig);

    connection.on('connection', function (conn) {
        console.log('✅ DB Connection established');

        conn.on('error', function (err) {
            console.error('❌', new Date(), 'MySQL error', err.code);
        });
        
        conn.on('close', function (err) {
            console.error('⚠️ ', new Date(), 'MySQL close', err);
        });
    });

    connection.on('error', function(err) {
        console.error('❌ Database pool error:', err.code, err.message);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log('🔄 Reconnecting to database...');
            handleDisconnect();
        }
    });
}

handleDisconnect();

module.exports = connection;