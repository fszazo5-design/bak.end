import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const app = express();

// 🌐 إعدادات الـ CORS للسماح لتطبيق الديسكتوب بالاتصال بالسيرفر دون قيود
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// 🔌 سحب رابط الـ MongoDB السري من متغيرات البيئة الآمنة
const MONGODB_URI = process.env.MONGODB_URI;

let dbClient = null;

// دالة الاتصال بقاعدة البيانات وضمان عدم تكرار فتح الاتصال
async function getCompaniesCollection() {
  if (!MONGODB_URI) {
    throw new Error("⚠️ خطأ: متغير البيئة MONGODB_URI مفقود في إعدادات السيرفر!");
  }
  
  if (!dbClient) {
    dbClient = new MongoClient(MONGODB_URI);
    await dbClient.connect();
    console.log("🔌 تم الاتصال بنجاح بسحابة MongoDB Atlas");
  }
  
  // يقوم تلقائياً باستهداف اسم قاعدة البيانات الموجودة في الرابط والـ collection المطلوب
  return dbClient.db().collection('companies');
}

// -------------------------------------------------------------------
// 🎯 المسار الأول: جلب واستعراض الشركات (GET)
// الرابط: /api/companies
// -------------------------------------------------------------------
app.get('/api/companies', async (req, res) => {
  try {
    const collection = await getCompaniesCollection();
    const companies = await collection.find({}).sort({ id: 1 }).toArray();

    return res.status(200).json({
      status: "success",
      message: "تم جلب البيانات بنجاح من الباك اند سحابة MongoDB",
      count: companies.length,
      companies: companies,
      code: 200
    });
  } catch (err) {
    console.error('Fetch error:', err);
    return res.status(500).json({ 
      status: "error",
      message: "حدث خطأ داخل السيرفر أثناء جلب البيانات",
      error_details: err.message,
      code: 500
    });
  }
});

// -------------------------------------------------------------------
// 🎯 المسار الثاني: المزامنة وحفظ البيانات القادمة من الديسكتوب (POST)
// الرابط: /api/sync
// -------------------------------------------------------------------
app.post('/api/sync', async (req, res) => {
  try {
    const { companies } = req.body || {};

    if (!Array.isArray(companies)) {
      return res.status(400).json({ 
        status: "error", 
        message: "يجب أن تكون البيانات المرسلة عبارة عن مصفوفة (Array)" 
      });
    }

    const collection = await getCompaniesCollection();

    if (companies.length === 0) {
      return res.status(200).json({ 
        ok: true, 
        upserted: 0, 
        message: 'لا توجد شركات جديدة للمزامنة' 
      });
    }

    // بناء عمليات الحفظ والتحديث الضخمة (Bulk Upsert) بناءً على معرف الشركة المتغير id
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
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await collection.bulkWrite(operations, { ordered: false });

    return res.status(200).json({
      ok: true,
      status: "success",
      upserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
      total: companies.length,
      message: "تمت المزامنة وحفظ البيانات السحابية بنجاح"
    });

  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ 
      status: "error", 
      message: "فشلت عملية المزامنة السحابية", 
      error_details: err.message 
    });
  }
});

// تشغيل السيرفر المحلي للاختبار
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل الآن بنجاح على المنفذ ${PORT}`);
});
