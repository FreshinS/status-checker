require('dotenv').config();
const cron = require('node-cron');
const WebSocket = require('ws');
const { getEmployees, getLastSatus, filteredEmployeeIds } = require('./db');

const wss = new WebSocket.Server({ port: process.env.PORT || 3000 });
console.log(`WebSocket сервер запущен на порту ${process.env.PORT}`);

let previousStatus = new Map();

wss.on('connection', async (ws) => {
  console.log('Клиент подключился');

  ws.send(JSON.stringify({ type: 'hide', data: filteredEmployeeIds }))
  ws.send(JSON.stringify({ type: 'initial_status', data: getLastSatus() }))
});

cron.schedule('0 0 * * *', () => {
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'reset'
      }))
    }
  })
})

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

    if (changed.length > 0) {
      console.log(`Обнаружено ${changed.length} изменений. Рассылаем.`);

      console.log(changed);

      // рассылка

      const payload = JSON.stringify({
        type: 'status_update',
        data: changed
      });

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    }
  } catch (err) {
    console.error('Ошибка при опросе БД:', err);
  }
}

setInterval(pollAndBroadcast, parseInt(process.env.POLL_INTERVAL_MS));

// setInterval(pollAndBroadcast, 30000);