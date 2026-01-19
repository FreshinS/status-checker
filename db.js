require('dotenv').config();
const odbc = require('odbc');

const filteredEmployeeIds = ['28982', '29247', '13477']; // Массив сотрудников чьи статусы не нужно отображать

let lastStatus;
let pool;

async function getConnection() {
  try {
    if (!pool) {
      pool = await odbc.connect(`DSN=MSSQL_Test;UID=${process.env.MSSQL_USER};PWD=${process.env.MSSQL_PASS}`);
      console.log('connected!');
    }
    return pool;
  } catch (err) {
    console.error("Ошибка подключения к БД:", err);
    pool = null; // сброс — при следующем вызове пересоздастся
    throw err;
  }
}

async function getEmployees() {
  let conn;
  try {
    conn = await getConnection();

    const query = `
    SELECT
		plog.HozOrgan AS id,
		gid.value AS [guid],
		employees.TabNumber AS tab_number,
		employees.Name + ' ' + employees.FirstName + ' ' + employees.MidName AS full_name,
		MAX(plog.TimeVal) AS last_time,
		plog.Mode AS mode
	FROM
		[ORIONSERVER\\SQLSERVER2012].[OrionNavigat].[dbo].[PLogData] as plog
		LEFT JOIN [ORIONSERVER\\SQLSERVER2012].[OrionNavigat].[dbo].[PList] as employees
			ON plog.HozOrgan = employees.ID
		LEFT JOIN [ORIONSERVER\\SQLSERVER2012].[OrionNavigat].[dbo].[ClientFieldsValues] as gid
			ON gid.owner = plog.HozOrgan AND gid.field_id = 3
	WHERE
		plog.doorIndex  in (1, 2, 10, 14, 16, 18, 19, 20, 24, 30, 31, 32, 34, 35, 36, 42, 45, 48, 49, 52, 56, 58)
		AND plog.TimeVal > cast(GETDATE() as date)
		AND plog.HozOrgan <> 0 AND (gid.value is not NULL AND gid.value <> '')
		AND employees.Section <> 62
		AND plog.Event = 32
	GROUP BY
		employees.TabNumber,
		gid.value,
		plog.HozOrgan,
		employees.Name + ' ' + employees.FirstName + ' ' + employees.MidName,
		plog.mode
    `;

    const result = await conn.query(query);

    const grouped = {};
    for (const row of result) {
      if (!grouped[row.guid]) grouped[row.guid] = [];
      grouped[row.guid].push(row);
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
		guid: last.guid,
        name: last.full_name,
        is_present,
        time: last.last_time,
        mode: last.mode,
      };
    });

    const filteredPayload = payload.filter((emp) => !filteredEmployeeIds.includes(emp.tab_number));

    lastStatus = filteredPayload;

    return filteredPayload;
  } catch (err) {
    console.error("Ошибка при запросе сотрудников:", err);

    // если соединение сломалось — сбросим пул, чтобы восстановить на следующем запросе
    if (err.message.includes("connection is broken") || err.message.includes("unrecoverable")) {
      pool = null;
    }

    return []; // возвращаем пустой массив, чтобы не упал весь сервер
  }
}

function getLastSatus() {
  return lastStatus;
}

module.exports = { getEmployees, getLastSatus, filteredEmployeeIds };
