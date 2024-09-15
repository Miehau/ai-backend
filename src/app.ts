import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: 'http://localhost:1420', // Allow requests from your frontend
  methods: ['GET', 'POST'], // Allow specific HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'] // Allow specific headers
}));
app.use(express.json());

const STREAM_ENABLED = false; // Configuration flag for streaming

// Basic route
app.get('/', (req: Request, res: Response) => {
  res.send('Meal Planning and AI Chat Backend');
});

// Meal planning route (placeholder)
app.get('/api/meal-plan', (req: Request, res: Response) => {
  res.json({ message: 'Meal planning endpoint' });
});


// AI chat route with optional streaming
app.post('/api/chat', async (req: Request, res: Response) => {
  const { input } = req.body;
  console.log(input);

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0
  });

  const messages = [
    new SystemMessage("You are a helpful assistant."),
    new HumanMessage(input),
  ];

  const result = await model.invoke(messages); // Pass input directly as a string
  res.json({ text: result.content });

});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});