import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log('TicketRush API chạy tại http://localhost:' + env.port + '/api/health');
});
