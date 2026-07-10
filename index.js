import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI;

async function getCompaniesCollection() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI missing!");
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client.db().collection('companies');
}

// 1. رابط جلب البيانات (GET)
app.get('/api/companies', async (req, res) => {
  try {
    const collection = await getCompaniesCollection();
    const companies = await collection.find({}).sort({ id: 1 }).toArray();
    res.status(200).json({ status: "success", count: companies.length, companies });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// 2. رابط حفظ ومزامنة البيانات (POST)
app.post('/api/sync', async (req, res) => {
  try {
    const { companies } = req.body || {};
    if (!Array.isArray(companies)) return res.status(400).json({ error: 'companies must be an array' });
    
    const collection = await getCompaniesCollection();
    if (companies.length === 0) return res.status(200).json({ ok: true, message: 'No companies to sync' });

    const operations = companies.map((company) => ({
      updateOne: {
        filter: { id: company.id },
        update: {
          $set: {
            id: company.id,
            company_name: company.company_name,
            company_location: company.company_location,
            mobile_number: company.mobile_number,
            specialization: company.specialization,
            website_or_page_link: company.website_or_page_link || '',
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    }));

    const result = await collection.bulkWrite(operations, { ordered: false });
    res.status(200).json({ ok: true, upserted: result.upsertedCount, total: companies.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
