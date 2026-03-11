import { createClient } from '@supabase/supabase-js';

export const revalidate = 0;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
const CAMPAIGN_ID = '11111111-1111-1111-1111-111111111111';

export default async function Home() {
  // 1. שליפת השאלות (כדי לדעת אילו עמודות להציג)
  const { data: steps } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('step_order', { ascending: true });

  // 2. שליפת הלידים (התשובות של האנשים)
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('created_at', { ascending: false });

  if (error) {
    return <div className="p-10 text-red-500 text-center">שגיאה בטעינת נתונים: {error.message}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 rtl" dir="rtl">
      <div className="max-w-7xl mx-auto">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">דאשבורד הזמנות חכם</h1>
            <p className="text-gray-500">נתונים בזמן אמת מהמערכת הטלפונית</p>
          </div>
          <div className="flex gap-4">
            <a href="/settings" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
              ניהול שאלות
            </a>
            <div className="bg-white border px-4 py-2 rounded-lg font-bold text-blue-600 shadow-sm">
              סה"כ: {leads?.length || 0}
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-4 font-semibold text-sm border-b border-slate-700">טלפון</th>
                  <th className="p-4 font-semibold text-sm border-b border-slate-700">תאריך</th>
                  
                  {/* יצירת עמודות דינמיות לפי השאלות שהגדרת */}
                  {steps?.map((step) => (
                    <th key={step.id} className="p-4 font-semibold text-sm border-b border-slate-700 min-w-[120px]">
                      {step.is_audio ? `שאלה ${step.step_order} (קובץ)` : step.message_content}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leads?.map((lead) => (
                  <tr key={lead.id} className="hover:bg-blue-50 transition">
                    <td className="p-4 font-bold text-gray-900" dir="ltr">{lead.phone}</td>
                    <td className="p-4 text-gray-500 text-xs">
                      {new Date(lead.created_at).toLocaleString('he-IL', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>

                    {/* הצגת התשובות לפי המפתחות הדינמיים (step_1, step_2 וכו') */}
                    {steps?.map((step) => {
                      const answer = lead.data?.[step.data_key];
                      return (
                        <td key={step.id} className="p-4">
                          {answer ? (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">
                              {answer}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">טרם נענה</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {(!leads || leads.length === 0) && (
              <div className="p-20 text-center text-gray-400">
                אין עדיין נתונים במערכת.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}