import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Ingredient {
  name: string;
  amount: number;
}

interface Recipe {
  title: string;
  ingredients: Ingredient[];
  methodSteps: string[];
}

export async function extractRecipeFromImage(imageBuffer: Buffer): Promise<Recipe> {
  const base64Image = imageBuffer.toString('base64');
  const response = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Extract the recipe ingredients and method steps from this image." },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    functions: [
      {
        name: "extract_recipe",
        description: "Extract recipe information from the image",
        parameters: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The title of the recipe",
            },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  amount: { type: "string" }
                },
                required: ["name", "amount"],
              },
              description: "List of ingredients with their amounts",
            },
            methodSteps: {
              type: "array",
              items: { type: "string" },
              description: "List of steps to prepare the recipe",
            },
          },
          required: ["title", "ingredients", "methodSteps"],
        },
      },
    ],
    function_call: { name: "extract_recipe" },
    max_tokens: 1000,
  });

  const functionCall = response.choices[0].message.function_call;
  if (functionCall && functionCall.name === "extract_recipe") {
    const extractedData = JSON.parse(functionCall.arguments);
    return extractedData as Recipe;
  } else {
    throw new Error("Failed to extract recipe information");
  }
}