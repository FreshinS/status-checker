require('dotenv').config();
// const sql = require('mssql');
const odbc = require('odbc');

// const config = {
//   user: process.env.MSSQL_USER,
//   password: process.env.MSSQL_PASS,
//   server: process.env.MSSQL_SERVER,
//   database: process.env.MSSQL_DATABASE,
//   port: parseInt(process.env.MSSQL_PORT),
//   options: {
//     encrypt: false,
//     trustServerCertificate: true,
//   },
// };

let pool;

async function getConnection() {
  if (!pool) {
    pool = await await odbc.connect(`DSN=MSSQL_Test;UID=${process.env.MSSQL_USER};PWD=${process.env.MSSQL_PASS}`);
  }
  return pool;
}

async function getEmployees() {
  const pool = await getConnection();
  const result = await pool.request().query(`
    SELECT id, name, is_present FROM Employees
  `);
  return result.recordset;
}

module.exports = { getEmployees };
