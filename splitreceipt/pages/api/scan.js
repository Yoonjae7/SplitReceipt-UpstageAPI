import formidable from 'formidable';
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({ maxFileSize: 50 * 1024 * 1024 });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ error: 'Upload failed' });
    }

    const file = Array.isArray(files.document) ? files.document[0] : files.document;
    if (!file) {
      return res.status(400).json({ error: 'No file' });
    }

    try {
      const formData = new FormData();
      formData.append('document', fs.createReadStream(file.filepath), {
        filename: file.originalFilename || 'receipt.jpg',
        contentType: file.mimetype || 'image/jpeg',
      });
      formData.append('model', 'receipt-extraction-3.2.0');

      const upstageRes = await fetch('https://api.upstage.ai/v1/information-extraction', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTAGE_API_KEY}`,
          ...formData.getHeaders(),
        },
        body: formData,
      });

      const data = await upstageRes.json();

      if (!upstageRes.ok) {
        return res
          .status(upstageRes.status)
          .json({ error: data?.message || 'Upstage error' });
      }

      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });
}

