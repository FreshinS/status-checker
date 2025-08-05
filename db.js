require('dotenv').config();
const odbc = require('odbc');

let lastStatus;
let pool;

async function getConnection() {
  if (!pool) {
    pool = await odbc.connect(`DSN=MSSQL_Test;UID=${process.env.MSSQL_USER};PWD=${process.env.MSSQL_PASS}`);
    console.log('connected!')
  }
  return pool;
}

async function getEmployees() {
  const conn = await getConnection();
  // const query = `
  //   WITH LatestEvents AS (
  //     SELECT
  //       plog.HozOrgan AS id,
  //       employees.TabNumber AS tab_number,
  //       employees.Name + ' ' + employees.FirstName + ' ' + employees.MidName AS full_name,
  //       plog.TimeVal AS last_time,
  //       plog.Mode AS mode,
  //       ROW_NUMBER() OVER (PARTITION BY plog.HozOrgan ORDER BY plog.TimeVal DESC) AS rn
  //     FROM
  //       [ORIONSERVER\\SQLSERVER2012].[OrionNavigat].[dbo].[PLogData] AS plog
  //     LEFT JOIN
  //       [ORIONSERVER\\SQLSERVER2012].[OrionNavigat].[dbo].[PList] AS employees
  //       ON plog.HozOrgan = employees.ID
  //     WHERE
  //       plog.doorIndex IN (1, 2, 10, 14, 16, 18, 19, 20, 30, 31, 32, 34, 35, 36, 42, 45, 48, 49, 52)
  //       AND plog.TimeVal > CAST(GETDATE() AS date)
  //       AND plog.HozOrgan <> 0 AND employees.TabNumber <> ''
  //       AND employees.Section <> 62
  //       AND plog.Event = 32
  //   )
  //   SELECT
  //     id,
  //     tab_number,
  //     full_name,
  //     last_time,
  //     mode
  //   FROM
  //     LatestEvents
  //   WHERE
  //     rn = 1
  // `;

  const query = `
    SELECT
    plog.HozOrgan AS id,
    employees.TabNumber AS tab_number,
    employees.Name + ' ' + employees.FirstName + ' ' + employees.MidName AS full_name,
    MAX(plog.TimeVal) AS last_time,
    plog.Mode AS mode
  FROM
      [ORIONSERVER\\SQLSERVER2012].[OrionNavigat].[dbo].[PLogData] as plog
  LEFT JOIN
    [ORIONSERVER\\SQLSERVER2012].[OrionNavigat].[dbo].[PList] as employees
    ON plog.HozOrgan = employees.ID
  WHERE
    plog.doorIndex  in (1, 2, 10, 14, 16, 18, 19, 20, 30, 31, 32, 34, 35, 36, 42, 45, 48, 49, 52)
    AND plog.TimeVal > cast(GETDATE() as date)
    AND plog.HozOrgan <> 0 AND employees.TabNumber <> ''
    AND employees.Section <> 62
    AND plog.Event = 32
  GROUP BY
    employees.TabNumber,
    plog.HozOrgan,
    employees.Name + ' ' + employees.FirstName + ' ' + employees.MidName,
    plog.mode
  `;

  const result = await conn.query(query);

  const grouped = {};
  for (const row of result) {
    if (!grouped[row.tab_number]) grouped[row.tab_number] = [];
    grouped[row.tab_number].push(row);
  }

  const payload = Object.values(grouped).map((events) => {
    const [last, prev] = events;

    const is_present =
      !prev || new Date(last.last_time) > new Date(prev.last_time)
        ? last.mode === 1
        : prev.mode === 1;

    return {
      id: last.id,
      tab_number: last.tab_number,
      name: last.full_name,
      is_present,
      time: last.last_time,
      mode: last.mode,
    };
  });

  // const payload = result.map(emp => ({
  //   id: emp.id,
  //   tab_number: emp.tab_number,
  //   name: emp.full_name,
  //   is_present: emp.mode === 1,
  //   time: emp.last_time,
  //   mode: emp.mode
  // }))

  lastStatus = payload;

  return payload;
}

function getLastSatus() {
  return lastStatus;
}

module.exports = { getEmployees, getLastSatus };
