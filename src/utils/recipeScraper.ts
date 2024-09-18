import * as cheerio from 'cheerio';
import axios from 'axios';
import { OpenAI } from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Ingredient {
  name: string | undefined;
  amount: string | undefined;
}

interface ExtractedRecipe {
  title: string;
  ingredients: Ingredient[];
  methodSteps: string[];
  imageUrl: string;
  tags: string[];
}

async function extractRecipeInfo(htmlContent: string): Promise<ExtractedRecipe> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that extracts recipe information from HTML content and generates relevant tags. Try to be as accurate as possible. Ingredients should be parsed separately into name and amount."
        },
        {
          role: "user",
          content: `Extract the recipe information from the following HTML content. Generate up to 5 relevant tags for this recipe based on its ingredients, method, and overall theme.\n\nHTML content:\n${htmlContent}`
        }
      ],
      functions: [
        {
          name: "extract_recipe_info",
          description: "Extracts recipe information from HTML content. Try to extract the title, ingredients, method steps, image URL, and tags from the HTML content.",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "The title of the recipe"
              },
              ingredients: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    amount: { type: "string" }
                  },
                  required: ["name"]
                },
                description: "List of ingredients"
              },
              methodSteps: {
                type: "array",
                items: { type: "string" },
                description: "List of method steps"
              },
              imageUrl: {
                type: "string",
                description: "URL of the main recipe image"
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Up to 5 relevant tags for the recipe"
              }
            },
            required: ["title", "ingredients", "methodSteps", "imageUrl", "tags"]
          }
        }
      ],
      function_call: { name: "extract_recipe_info" }
    });

    const toolCall = response.choices[0].message.function_call;
    if (toolCall && toolCall.name === "extract_recipe_info") {
      const extractedInfo = JSON.parse(toolCall.arguments || '{}');
      
      const validatedInfo: ExtractedRecipe = {
        title: extractedInfo.title || '',
        ingredients: extractedInfo.ingredients || [],
        methodSteps: Array.isArray(extractedInfo.methodSteps) ? extractedInfo.methodSteps : [],
        imageUrl: typeof extractedInfo.imageUrl === 'string' ? extractedInfo.imageUrl : '',
        tags: Array.isArray(extractedInfo.tags) ? extractedInfo.tags.slice(0, 5) : [],
      };

      return validatedInfo;
    } else {
      console.log('Unexpected response format from OpenAI:', JSON.stringify(response.choices[0].message, null, 2));
      throw new Error('Unexpected response format from OpenAI');
    }
  } catch (error) {
    console.error('Error extracting recipe info:', error);
    throw new Error('Failed to extract recipe information');
  }
}

export async function scrapeRecipe(url: string): Promise<ExtractedRecipe & { imageBuffer?: Buffer | undefined }> {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    }
  });

  if (response.status !== 200) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const html = response.data;
  const $ = cheerio.load(html as string);

  // Remove script and style tags
  $('script, style').remove();
  // Remove all classes from tags
  $('*').removeAttr('class');
  // Remove all attributes from tags using wildcard
  $('*:not(img)').each(function(this: cheerio.Element) {
    const attributes = $(this).attr();  // Get all attributes
    for (const attr in attributes) {
      $(this).removeAttr(attr);  // Remove each attribute
    }
  });

  // Remove all anchor tags
  $('a').each((_, el) => {
    const $el = $(el);
    $el.replaceWith('');
  });

  // Extract HTML content
  const htmlContent = $('body').html() || '';
  const extractedRecipe = await extractRecipeInfo(htmlContent);
  
  let imageBuffer;
  const imageUrl = extractedRecipe.imageUrl;
  if (imageUrl) {
    const imageResponse = await axios.get<ArrayBuffer>(imageUrl, { responseType: 'arraybuffer' });
    imageBuffer = Buffer.from(imageResponse.data);
  }

  return { ...extractedRecipe, imageBuffer };
}