import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export const app = express();

// Sau proxy của Render/Railway: để req.ip và giao thức đúng
app.set('trust proxy', 1);

app.use(cors({ origin: env.corsOrigins.length === 1 ? env.corsOrigins[0] : env.corsOrigins }));
app.use(express.json());
app.use(morgan('dev'));

// Kiểm tra sống nhẹ (không đụng cơ sở dữ liệu): dùng cho health check của nơi host và để đánh thức máy chủ đang "ngủ"
app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);
