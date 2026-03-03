import formidable from 'formidable';
import fs from 'fs';
import OpenAI from 'openai';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const form = formidable({ maxFileSize: 50 * 1024 * 1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: 'Upload failed' });
    const file = Array.isArray(files.document) ? files.document[0] : files.document;
    if (!file) return res.status(400).json({ error: 'No file' });

    try {
      const base64Image = fs.readFileSync(file.filepath, 'base64');
      const mimeType = file.mimetype || 'image/jpeg';

      const openai = new OpenAI({
        apiKey: process.env.UPSTAGE_API_KEY,
        baseURL: 'https://api.upstage.ai/v1/information-extraction',
      });

      const response = await openai.chat.completions.create({
        model: 'receipt-extraction-3.2.0',
        messages: [{
          role: 'user',
          content: [{
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          }],
        }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'receipt_schema',
            schema: {
              type: 'object',
              properties: {
                menu: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      nm: { type: 'string', description: 'Item name' },
                      price: { type: 'number', description: 'Item price' },
                    }
                  }
                },
                total_price: { type: 'number', description: 'Total price' },
                tax_price: { type: 'number', description: 'Tax amount' },
                service_price: { type: 'number', description: 'Service charge' },
              }
            }
          }
        }
      });

      // response 그대로 프론트로 보내서 구조 확인
      return res.status(200).json(response);

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });
}