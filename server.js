require('dotenv').config();
const WebSocket = require('ws');
const { getEmployees } = require('./db');
const fs = require('fs')

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });
console.log(`WebSocket сервер запущен на порту ${process.env.PORT}`);

let previousStatus = new Map();

wss.on('connection', (ws) => {
  console.log('Клиент подключился');
});

async function pollAndBroadcast() {
  try {
    const employees = await getEmployees();

    const changed = [];

    for (const emp of employees) {
      const prev = previousStatus.get(emp.id);
      if (prev === undefined || prev !== emp.is_present) {
        changed.push({
          id: emp.id,
          tab_number: emp.tab_number,
          name: emp.name,
          is_present: emp.is_present,
          time: emp.time,
          mode: emp.mode
        });
      }
      previousStatus.set(emp.id, emp.is_present); // обновляем
    }

    let id = 0;
    if (changed.length > 0) {
      console.log(`Обнаружено ${changed.length} изменений. Рассылаем.`);

      console.log(changed);
      id += 1;
      fs.writeFileSync(`change-${id}.txt`, JSON.stringify(changed), 'utf8')

      console.log(changed.find((emp) => emp.name.includes('Громов') || emp.name === 'Громов Илья Николаевич'))

    //   const payload = JSON.stringify({
    //     type: 'status_update',
    //     data: changed
    //   });

    //   wss.clients.forEach((client) => {
    //     if (client.readyState === WebSocket.OPEN) {
    //       client.send(payload);
    //     }
    //   });
    }
  } catch (err) {
    console.error('Ошибка при опросе БД:', err);
  }
}

setInterval(pollAndBroadcast, parseInt(process.env.POLL_INTERVAL_MS));

// setInterval(pollAndBroadcast, 30000);