import { createClient } from '@supabase/supabase-js';

export const revalidate = 0;
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const CAMPAIGN_ID = '11111111-1111-1111-1111-111111111111';

// הפונקציה עכשיו מקבלת את כל אובייקט השאלה (step) ולא רק את הסוג
function formatAnswer(value: string, step: any) {
  if (!value) return null;

  if (step.question_type === 'choice' && step.options && step.options[value]) {
    return step.options[value]; // מחזיר "שבתי" במקום "1"
  }

  switch (step.question_type) {
    case 'yes_no': return value === '1' ? '✅ כן' : value === '2' ? '❌ לא' : value;
    case 'date': return value.length === 8 ? `${value.substring(0, 2)}/${value.substring(2, 4)}/${value.substring(4)}` : value;
    case 'phone': return value.length === 10 ? `${value.substring(0, 3)}-${value.substring(3)}` : value;
    default: return value;
  }
}

export default async function Home() {
  const { data: steps } = await supabase.from('campaign_steps').select('*').eq('campaign_id', CAMPAIGN_ID).order('step_order', { ascending: true });
  const { data: leads } = await supabase.from('leads').select('*').eq('campaign_id', CAMPAIGN_ID).order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50 p-8 rtl" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">דאשבורד הזמנות חכם</h1>
          <a href="/settings" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">ניהול שאלות</a>
        </div>
        
        <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-4 font-semibold text-sm">טלפון</th>
                {steps?.map((step) => (
                  <th key={step.id} className="p-4 font-semibold text-sm">{step.message_content.substring(0,20)}...</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leads?.map((lead) => (
                <tr key={lead.id} className="hover:bg-blue-50">
                  <td className="p-4 font-bold" dir="ltr">{lead.phone}</td>
                  {steps?.map((step) => {
                    // שימוש בפונקציה המעודכנת שמתרגמת את הערך
                    const formattedAnswer = formatAnswer(lead.data?.[step.data_key], step);
                    return (
                      <td key={step.id} className="p-4">
                        {formattedAnswer ? <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">{formattedAnswer}</span> : <span className="text-gray-300">טרם נענה</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}