import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

const router = express.Router();
const prisma = new PrismaClient();


// AI chat route with conversation history
router.post('/', async (req: Request, res: Response) => {
    const { input, conversationId } = req.body;

    let { conversation, conversationIdToUse } = await getOrCreateConversation(conversationId);

    if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
    }

    const model = new ChatOpenAI({
        model: "gpt-3.5-turbo",
        temperature: 0
    });

    const messages = [
        new SystemMessage("You are a helpful assistant."),
        ...conversation.messages.map(msg =>
            msg.role === 'human' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
        ),
        new HumanMessage(input),
    ];

    const result = await model.invoke(messages);

    // Save the new messages
    await prisma.message.createMany({
        data: [
            { content: input, role: 'human', conversationId: conversationIdToUse },
            { content: result.content, role: 'ai', conversationId: conversationIdToUse },
        ],
    });

    res.json({ text: result.content, conversationId: conversationIdToUse });
});

async function getOrCreateConversation(conversationId: any) {
    let conversationIdToUse = conversationId;
    let conversation;

    if (!conversationId) {
        // Generate a new ID and create a new conversation
        conversationIdToUse = generateNewConversationId();
        conversation = await prisma.conversation.create({
            data: {
                id: conversationIdToUse,
                name: 'New Conversation', // You can customize this default name
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
function generateNewConversationId() {
    // Generate a random UUID using the crypto module
    const crypto = require('crypto');
    return crypto.randomUUID();
}


export default router;