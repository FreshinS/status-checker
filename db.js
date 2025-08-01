require('dotenv').config();
const odbc = require('odbc');

let pool;

async function getConnection() {
  if (!pool) {
    pool = await await odbc.connect(`DSN=MSSQL_Test;UID=${process.env.MSSQL_USER};PWD=${process.env.MSSQL_PASS}`);
  }
  return pool;
}

async function getEmployees() {
  const conn = await getConnection();
  const result = await conn.query(`
    SELECT
      plog.HozOrgan AS id,
      employees.TabNumber AS tab_number,
      employees.Name + ' ' + employees.FirstName + ' ' + employees.MidName AS full_name,
      MAX(plog.TimeVal) AS last_time,
      plog.Mode AS mode
    FROM
      OrionNavigat.dbo.PLogData AS plog
    LEFT JOIN
      OrionNavigat.dbo.PList AS employees
      ON plog.HozOrgan = employees.ID
    WHERE
      plog.doorIndex IN (1, 2, 10, 14, 16, 18, 19, 20, 30, 31, 32, 34, 35, 36, 42, 45, 48, 49, 52)
      AND plog.TimeVal > CAST(GETDATE() AS date)
      AND plog.HozOrgan <> 0
      AND employees.TabNumber <> ''
      AND employees.Section <> 62
      AND plog.Mode = 1
      AND plog.Event = 32
    GROUP BY
      employees.TabNumber,
      plog.HozOrgan,
      employees.Name + ' ' + employees.FirstName + ' ' + employees.MidName,
      plog.Mode
  `);

  // Формируем структуру с is_present = true (так как Mode=1 в WHERE)
  return result.map(emp => ({
    id: emp.id,
    name: emp.full_name,
    is_present: true, // можно дополнить позже Mode'ом, если нужно оба направления
    time: emp.last_time
  }));
}

module.exports = { getEmployees };
