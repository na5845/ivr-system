import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

export const revalidate = 0;
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const CAMPAIGN_ID = '11111111-1111-1111-1111-111111111111';

export default async function SettingsPage() {
  const { data: steps } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('step_order', { ascending: true });

  async function addStep(formData: FormData) {
    'use server';
    const type = formData.get('type') as string;
    const isAudio = formData.get('isAudio') === 'true';
    const messageContent = formData.get('messageContent') as string;
    
    const stepOrder = (steps?.length || 0) + 1;
    const autoDataKey = `step_${stepOrder}`; 

    // הגדרת הגבלות ספרות אוטומטיות לפי סוג
    let minD = 1;
    let maxD = 1;

    if (type === 'id') { minD = 9; maxD = 9; }
    else if (type === 'phone') { minD = 10; maxD = 10; }
    else if (type === 'date') { minD = 8; maxD = 8; } // DDMMYYYY
    else if (type === 'number' || type === 'digits') { minD = 1; maxD = 15; }
    else { minD = 1; maxD = 1; } // choice, yes_no

    await supabase.from('campaign_steps').insert([{
      campaign_id: CAMPAIGN_ID,
      step_order: stepOrder,
      data_key: autoDataKey,
      message_content: messageContent,
      is_audio: isAudio,
      question_type: type,
      min_digits: minD,
      max_digits: maxD
    }]);
    revalidatePath('/settings');
  }

  async function deleteStep(formData: FormData) {
    'use server';
    await supabase.from('campaign_steps').delete().eq('id', formData.get('id'));
    revalidatePath('/settings');
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 rtl" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">הגדרת שאלות חכמה</h1>
        
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <form action={addStep} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1">סוג השאלה</label>
              <select name="type" className="w-full border p-2 rounded bg-gray-50">
                <option value="choice">בחירה (1-9)</option>
                <option value="yes_no">כן/לא (1=כן, 2=לא)</option>
                <option value="id">מספר תעודת זהות (9 ספרות)</option>
                <option value="phone">מספר טלפון (10 ספרות)</option>
                <option value="date">תאריך (8 ספרות - למשל 01012024)</option>
                <option value="number">כמות / מספר (עד 15 ספרות)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">צורת השמעה</label>
              <select name="isAudio" className="w-full border p-2 rounded bg-gray-50">
                <option value="false">טקסט (רובוט TTS)</option>
                <option value="true">קובץ שמע (מספר קובץ)</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold mb-1">תוכן השאלה (טקסט או מספר קובץ)</label>
              <input name="messageContent" required className="w-full border p-2 rounded" placeholder="למשל: אנא הקישו מספר תעודת זהות" />
            </div>
            <button className="md:col-span-2 bg-green-600 text-white p-3 rounded-lg font-bold hover:bg-green-700 transition">הוסף שאלה למערכת</button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg overflow-hidden">
          <h2 className="text-xl font-bold mb-4">סדר השאלות</h2>
          <div className="space-y-4">
            {steps?.map((step) => (
              <div key={step.id} className="flex items-center justify-between p-4 bg-gray-50 border-r-4 border-blue-500 rounded shadow-sm">
                <div>
                  <div className="font-bold text-gray-800">שלב {step.step_order} - {step.question_type}</div>
                  <div className="text-gray-600">{step.is_audio ? `🔊 קובץ: ` : `💬 `}{step.message_content}</div>
                </div>
                <form action={deleteStep}>
                  <input type="hidden" name="id" value={step.id} />
                  <button className="text-red-500 font-bold px-3 py-1 border border-red-200 rounded hover:bg-red-50">מחק</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}