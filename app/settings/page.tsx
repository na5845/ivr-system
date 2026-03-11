import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

export const revalidate = 0;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const CAMPAIGN_ID = '11111111-1111-1111-1111-111111111111';

export default async function SettingsPage() {
  // 1. משיכת השאלות
  const { data: steps } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('step_order', { ascending: true });

  // 2. הוספת שאלה (עם מזהה אוטומטי!)
  async function addStep(formData: FormData) {
    'use server';
    const isAudio = formData.get('isAudio') === 'true';
    const messageContent = formData.get('messageContent') as string;
    const inputType = formData.get('inputType') as string;
    const maxDigits = Number(formData.get('maxDigits') || 1);

    const stepOrder = (steps?.length || 0) + 1;
    
    // יצירת המזהה באופן אוטומטי לפי מספר השלב
    const autoDataKey = `step_${stepOrder}`; 
    
    const minD = 1;
    const maxD = inputType === 'choice' ? 1 : maxDigits;

    await supabase.from('campaign_steps').insert([
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

    revalidatePath('/settings');
  }

  // 3. מחיקת שאלה
  async function deleteStep(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    await supabase.from('campaign_steps').delete().eq('id', id);
    
    // הערה: כשמוחקים שאלה באמצע, כדאי בעתיד לסדר מחדש את המספרים (step_order),
    // אבל כרגע למערכת פשוטה זה מספיק טוב כדי לעבוד.
    revalidatePath('/settings');
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 rtl" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">ניהול שאלות מערכת</h1>
          <a href="/" className="text-blue-600 font-medium hover:underline">חזרה לדאשבורד הזמנות</a>
        </div>

        {/* טופס הוספת שאלה (קצר ונוח יותר) */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <h2 className="text-xl font-bold mb-4 text-gray-700">הוספת שאלה חדשה (שלב {(steps?.length || 0) + 1})</h2>
          
          <form action={addStep} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סוג הודעה</label>
                <select name="isAudio" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500">
                  <option value="false">הקראת טקסט (רובוט)</option>
                  <option value="true">קובץ שמע (הקלטה בשלוחה)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סוג תגובה מצופה</label>
                <select name="inputType" className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500">
                  <option value="choice">בחירה (ספרה אחת, למשל 1 או 2)</option>
                  <option value="input">קלט חופשי (כמה ספרות ברצף)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  טקסט להקראה או מספר קובץ (ללא סימני פיסוק)
                </label>
                <input name="messageContent" required type="text"
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מקסימום ספרות (רלוונטי רק לקלט חופשי)</label>
                <input name="maxDigits" required type="number" min="1" max="20" defaultValue="1"
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <button type="submit" className="mt-4 bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition">
              שמור שאלה למערכת
            </button>
          </form>
        </div>

        {/* רשימת השאלות */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <h2 className="text-xl font-bold mb-4 text-gray-700">סדר השאלות הנוכחי ({(steps?.length || 0)})</h2>
          <div className="space-y-3">
            {steps?.map((step) => (
              <div key={step.id} className="flex justify-between items-center p-3 bg-gray-50 border rounded hover:bg-gray-100 transition">
                <div>
                  <span className="font-bold mr-2 text-gray-700">שלב {step.step_order}:</span>
                  <span className="text-gray-600">
                    {step.is_audio ? `🔊 קובץ: ${step.message_content}` : `💬 טקסט: ${step.message_content}`}
                  </span>
                  <span className="text-sm text-gray-400 mr-4">
                    ({step.max_digits === 1 ? 'ספרה אחת' : `עד ${step.max_digits} ספרות`})
                  </span>
                  <span className="text-xs text-gray-400 font-mono bg-gray-200 px-1 rounded mr-2" dir="ltr">Key: {step.data_key}</span>
                </div>
                <form action={deleteStep}>
                  <input type="hidden" name="id" value={step.id} />
                  <button type="submit" className="text-red-500 hover:text-red-700 font-medium bg-red-50 px-3 py-1 rounded">מחק</button>
                </form>
              </div>
            ))}
            {(!steps || steps.length === 0) && <p className="text-gray-500">לא הוגדרו שאלות. התחל להוסיף שאלות בטופס מעל.</p>}
          </div>
        </div>

      </div>
    </div>
  );
}