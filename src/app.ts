import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import conversationsRouter from './routes/conversations';
import chatRouter from './routes/chat';
import errorHandler from './middleware/errorHandler';
import dotenv from 'dotenv';
const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;


dotenv.config();

app.use(cors({
  origin: 'http://localhost:1420', // Allow requests from your frontend
  methods: ['GET', 'POST'], // Allow specific HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Allow specific headers
}));

app.use(express.json());

app.use('/api/conversations', conversationsRouter);
app.use('/api/chat', chatRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export { app, prisma };