import sql from 'mssql';

const dbConfig = {
    user: 'sa', // Replace with your MSSQL username
    password: 'root123', // Replace with your MSSQL password
    server: 'DEDSWIN', // Replace with your MSSQL server name
    database: 'hunar_database',
    options: {
        encrypt: false, // Set to true if using Azure
        trustServerCertificate: true, // Required for self-signed certificates
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
};

const pool = new sql.ConnectionPool(dbConfig);
const db = pool.connect()
    .then(pool => {
        console.log("Connected to MSSQL");
        return pool;
    })
    .catch(err => {
        console.error("Database connection failed:", err);
        process.exit(1);
    });

export default db;
export { sql };
