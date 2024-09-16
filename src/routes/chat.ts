import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

const router = express.Router();
const prisma = new PrismaClient();

// Hardcoded streaming flag
const ENABLE_STREAMING = true;

// AI chat route with conversation history
router.post('/', async (req: Request, res: Response) => {
    const { input, conversationId, model } = req.body;
    console.log(req.body);

    let { conversation, conversationIdToUse } = await getOrCreateConversation(conversationId);

    if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
    }

    const chatModel = new ChatOpenAI({
        model: model || "gpt-3.5-turbo",
        temperature: 0,
        streaming: ENABLE_STREAMING
    });

    const messages = [
        new SystemMessage("You are a helpful assistant."),
        ...conversation.messages.map(msg =>
            msg.role === 'human' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
        ),
        new HumanMessage(input),
    ];

    if (ENABLE_STREAMING) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        let fullResponse = '';
        const stream = await chatModel.stream(messages);

        for await (const chunk of stream) {
            fullResponse += chunk.content;
            res.write(`data: ${JSON.stringify({ type: 'message', content: chunk.content })}\n\n`);
        }

        // Save the full response after streaming is complete
        await saveMessages(input, fullResponse, conversationIdToUse);

        res.write(`data: ${JSON.stringify({ type: 'end', conversationId: conversationIdToUse })}\n\n`);
        res.end();
    } else {
        const result = await chatModel.invoke(messages);
        const responseContent = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        await saveMessages(input, responseContent, conversationIdToUse);
        res.json({ text: responseContent, conversationId: conversationIdToUse });
    }
});

async function saveMessages(input: string, aiResponse: string, conversationId: string) {
    await prisma.message.createMany({
        data: [
            { content: input, role: 'human', conversationId: conversationId },
            { content: aiResponse, role: 'ai', conversationId: conversationId },
        ],
    });
}

async function getOrCreateConversation(conversationId: string | null) {
    let conversationIdToUse = conversationId || generateNewConversationId();
    let conversation;

    if (!conversationId) {
        conversation = await prisma.conversation.create({
            data: {
                id: conversationIdToUse,
                name: 'New Conversation',
            },
            include: { messages: true },
        });
    } else {
        // Find existing conversation
        conversation = await prisma.conversation.findUnique({
            where: { id: conversationIdToUse },
            include: {
                messages: {
                    orderBy: {
                        createdAt: 'asc'
                    }
                }
            },
        });
    }
    return { conversation, conversationIdToUse };
}

// Function to generate a new conversation ID
function generateNewConversationId() : string {
    // Generate a random UUID using the crypto module
    const crypto = require('crypto');
    return crypto.randomUUID();
}

export default router;