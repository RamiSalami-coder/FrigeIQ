import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 5000;

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

app.use(express.json({ limit: "20mb" }));
app.use(express.static(__dirname));

app.post("/api/analyze", async (req, res) => {
  const { imageBase64, mode } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: "No image provided" });
  }

  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`,
              },
            },
            {
              type: "text",
              text: `You are a professional chef and nutritionist analyzing a fridge photo.

Analyze this image and respond with ONLY valid JSON in this exact format:
{
  "ingredients": ["ingredient1", "ingredient2", ...],
  "score": <number 40-98>,
  "rating": "<one of: Excellent Fridge!, Great Variety!, Decent Stock., Could Be Better., Bare Minimum.>",
  "roast": "<one witty sentence about the fridge's overall state>",
  "recipes": [
    {
      "name": "<recipe name>",
      "time": "<X min>",
      "desc": "<one sentence description>",
      "steps": ["step 1", "step 2", "step 3", "step 4"]
    }
  ]
}

Rules:
- List every visible food ingredient you can identify (10-18 items)
- Score reflects variety and freshness (40=sparse, 98=excellent)
- Generate exactly 2 recipes tailored to the "${mode}" cooking style
- For "Budget Meals": cheap, simple recipes
- For "High Protein": protein-focused meals  
- For "Quick Meals": under 15 minutes
- For "Late Night": snack-style comfort food
- For "Microwave Only": no stove or oven required
- For "Creative Mode": unexpected but delicious combos
- Use only ingredients actually visible in the photo
- Each recipe must have exactly 4 steps`,
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      return res.status(500).json({ error: "Failed to parse AI response" });
    }

    res.json(parsed);
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({ error: err.message || "AI analysis failed" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`FridgeIQ server running at http://0.0.0.0:${PORT}`);
});
