'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// חיבור ל-Supabase בצד לקוח (יש לוודא שהמשתנים האלו קיימים ב-.env)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CAMPAIGN_ID = '11111111-1111-1111-1111-111111111111'; // מזהה הקמפיין שלנו

export default function SettingsPage() {
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // מצבי הטופס
  const [dataKey, setDataKey] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [isAudio, setIsAudio] = useState(false);
  const [inputType, setInputType] = useState('choice'); // 'choice' | 'input'
  const [maxDigits, setMaxDigits] = useState(1);

  // משיכת השאלות הקיימות
  const fetchSteps = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', CAMPAIGN_ID)
      .order('step_order', { ascending: true });
    
    setSteps(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSteps();
  }, []);

  // שמירת שאלה חדשה
  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    const stepOrder = steps.length + 1;
    const minD = 1;
    const maxD = inputType === 'choice' ? 1 : maxDigits;

    const { error } = await supabase.from('campaign_steps').insert([
      {
        campaign_id: CAMPAIGN_ID,
        step_order: stepOrder,
        data_key: dataKey,
        message_content: messageContent,
        is_audio: isAudio,
        min_digits: minD,
        max_digits: maxD
      }
    ]);

    if (!error) {
      alert('השאלה נוספה בהצלחה!');
      setDataKey('');
      setMessageContent('');
      fetchSteps(); // רענון הרשימה
    } else {
      alert('שגיאה בהוספת השאלה: ' + error.message);
    }
  };

  // מחיקת שאלה
  const handleDelete = async (id: string) => {
    if (confirm('למחוק שאלה זו?')) {
      await supabase.from('campaign_steps').delete().eq('id', id);
      fetchSteps();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 rtl" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">ניהול שאלות מערכת</h1>
          <a href="/" className="text-blue-600 hover:underline">חזרה לדאשבורד הזמנות</a>
        </div>

        {/* טופס הוספת שאלה */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <h2 className="text-xl font-bold mb-4 text-gray-700">הוספת שאלה חדשה (שלב {steps.length + 1})</h2>
          
          <form onSubmit={handleAddStep} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* שם משתנה */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מזהה נתון באנגלית (למשל: age, map_type)</label>
                <input required type="text" value={dataKey} onChange={e => setDataKey(e.target.value)} dir="ltr"
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500" placeholder="e.g. user_id" />
              </div>

              {/* סוג השמעה */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סוג הודעה</label>
                <select value={isAudio ? 'true' : 'false'} onChange={e => setIsAudio(e.target.value === 'true')}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500">
                  <option value="false">הקראת טקסט (רובוט)</option>
                  <option value="true">קובץ שמע (הקלטה בשלוחה)</option>
                </select>
              </div>

              {/* תוכן ההודעה */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isAudio ? 'מספר קובץ (למשל: 001)' : 'טקסט להקראה (ללא סימני פיסוק)'}
                </label>
                <input required type="text" value={messageContent} onChange={e => setMessageContent(e.target.value)}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* סוג קלט */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סוג תגובה מצופה</label>
                <select value={inputType} onChange={e => setInputType(e.target.value)}
                  className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500">
                  <option value="choice">בחירה (ספרה אחת, למשל 1 או 2)</option>
                  <option value="input">קלט חופשי (כמה ספרות ברצף)</option>
                </select>
              </div>

              {/* מקסימום ספרות לקלט */}
              {inputType === 'input' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">מקסימום ספרות לקליטה</label>
                  <input required type="number" min="1" max="20" value={maxDigits} onChange={e => setMaxDigits(Number(e.target.value))}
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
            </div>

            <button type="submit" className="mt-4 bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 transition">
              שמור שאלה למערכת
            </button>
          </form>
        </div>

        {/* רשימת השאלות */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <h2 className="text-xl font-bold mb-4 text-gray-700">סדר השאלות הנוכחי ({steps.length})</h2>
          {loading ? <p>טוען...</p> : (
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step.id} className="flex justify-between items-center p-3 bg-gray-50 border rounded">
                  <div>
                    <span className="font-bold mr-2 text-gray-700">שלב {step.step_order}:</span>
                    <span className="text-blue-600 font-medium mr-2" dir="ltr">{step.data_key}</span>
                    <span className="text-gray-600">
                      {step.is_audio ? `🔊 קובץ: ${step.message_content}` : `💬 טקסט: ${step.message_content}`}
                    </span>
                    <span className="text-sm text-gray-400 mr-4">
                      ({step.max_digits === 1 ? 'ספרה אחת' : `עד ${step.max_digits} ספרות`})
                    </span>
                  </div>
                  <button onClick={() => handleDelete(step.id)} className="text-red-500 hover:text-red-700 font-medium">מחק</button>
                </div>
              ))}
              {steps.length === 0 && <p className="text-gray-500">לא הוגדרו שאלות. המערכת תשתמש בשאלות ברירת המחדל.</p>}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}