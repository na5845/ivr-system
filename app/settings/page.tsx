import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// ביטול מטמון (Cache) כדי לראות שינויים מיד
export const revalidate = 0;

// חיבור ל-Supabase
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const CAMPAIGN_ID = '11111111-1111-1111-1111-111111111111';

export default async function SettingsPage() {
  // 1. שליפת השאלות הקיימות (עם טיפול בשגיאות)
  const { data: steps, error: fetchError } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('step_order', { ascending: true });

  if (fetchError) {
    console.error('>>> Error fetching steps:', fetchError);
  }

  // 2. פונקציית שרת (Server Action) להוספת שאלה
  async function addStep(formData: FormData) {
    'use server';
    
    const isAudio = formData.get('isAudio') === 'true';
    const messageContent = formData.get('messageContent') as string;
    const inputType = formData.get('inputType') as string;
    const maxDigits = Number(formData.get('maxDigits') || 1);

    // חישוב הסדר והמזהה (Key)
    const stepOrder = (steps?.length || 0) + 1;
    const autoDataKey = `step_${stepOrder}`; 
    
    const minD = 1;
    const maxD = inputType === 'choice' ? 1 : maxDigits;

    // הוספה למסד הנתונים
    const { error: insertError } = await supabase.from('campaign_steps').insert([
      {
        campaign_id: CAMPAIGN_ID,
        step_order: stepOrder,
        data_key: autoDataKey,
        message_content: messageContent,
        is_audio: isAudio,
        min_digits: minD,
        max_digits: maxD
      }
    ]);

    // הדפסת שגיאה אם יש בעיה בהכנסה
    if (insertError) {
      console.error('>>> DB INSERT ERROR:', insertError);
    } else {
      console.log(`>>> SUCCESS: Step ${stepOrder} added (${autoDataKey})`);
    }

    // רענון העמוד כדי להציג את השאלה החדשה
    revalidatePath('/settings');
  }

  // 3. פונקציית שרת (Server Action) למחיקת שאלה
  async function deleteStep(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    
    const { error: deleteError } = await supabase.from('campaign_steps').delete().eq('id', id);
    
    if (deleteError) {
      console.error('>>> DB DELETE ERROR:', deleteError);
    }
    
    revalidatePath('/settings');
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 rtl" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">ניהול שאלות מערכת</h1>
          <a href="/" className="text-blue-600 font-medium hover:underline">חזרה לדאשבורד הזמנות</a>
        </div>

        {/* הצגת שגיאת שליפה אם קיימת */}
        {fetchError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            שגיאה בטעינת הנתונים: {fetchError.message}. אנא ודא שהטבלה campaign_steps קיימת ב-Supabase.
          </div>
        )}

        {/* טופס הוספת שאלה */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <h2 className="text-xl font-bold mb-4 text-gray-700">הוספת שאלה חדשה (שלב {(steps?.length || 0) + 1})</h2>
          
          <form action={addStep} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* סוג הודעה */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סוג הודעה</label>
                <select name="isAudio" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500">
                  <option value="false">הקראת טקסט (רובוט TTS)</option>
                  <option value="true">קובץ שמע (הקלטה בשלוחה, למשל 000)</option>
                </select>
              </div>

              {/* סוג תגובה */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סוג תגובה מצופה מהלקוח</label>
                <select name="inputType" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500">
                  <option value="choice">בחירה בודדת (ספרה אחת, למשל 1 או 2)</option>
                  <option value="input">קלט מספרי (מספר ספרות ברצף, למשל ת.ז.)</option>
                </select>
              </div>

              {/* תוכן ההודעה */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  טקסט להקראה או מספר קובץ להשמעה (ללא סימני פיסוק כמו נקודה או פסיק)
                </label>
                <input name="messageContent" required type="text" placeholder="למשל: אנא הקישו תעודת זהות"
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* מקסימום ספרות */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מקסימום ספרות (רק עבור קלט מספרי)</label>
                <input name="maxDigits" required type="number" min="1" max="20" defaultValue="1"
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <button type="submit" className="mt-4 bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition">
              הוסף שאלה למערכת
            </button>
          </form>
        </div>

        {/* רשימת השאלות */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <h2 className="text-xl font-bold mb-4 text-gray-700">סדר השאלות הנוכחי ({(steps?.length || 0)})</h2>
          <div className="space-y-3">
            {steps?.map((step) => (
              <div key={step.id} className="flex justify-between items-center p-3 bg-gray-50 border rounded hover:bg-gray-100 transition">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="font-bold text-gray-700 min-w-[60px]">שלב {step.step_order}:</span>
                  <span className="text-gray-600 flex-1">
                    {step.is_audio ? `🔊 קובץ מס': ${step.message_content}` : `💬 יקריא: ${step.message_content}`}
                  </span>
                  <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                    {step.max_digits === 1 ? 'ספרה 1' : `עד ${step.max_digits} ספרות`}
                  </span>
                  <span className="text-xs text-gray-400 font-mono bg-blue-50 px-2 py-1 rounded border border-blue-100" dir="ltr">
                    Key: {step.data_key}
                  </span>
                </div>
                
                {/* כפתור מחיקה */}
                <form action={deleteStep}>
                  <input type="hidden" name="id" value={step.id} />
                  <button type="submit" className="text-red-500 hover:text-white hover:bg-red-500 font-medium border border-red-500 px-3 py-1 rounded transition ml-2">
                    מחק
                  </button>
                </form>
              </div>
            ))}
            
            {(!steps || steps.length === 0) && (
              <p className="text-gray-500 text-center py-4">לא הוגדרו עדיין שאלות. התחל להוסיף שאלות בטופס למעלה.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}