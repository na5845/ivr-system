import { createClient } from '@supabase/supabase-js';

// פקודה שמורה ל-Next.js לא לשמור את העמוד בזיכרון (Cache) 
// כדי שבכל פעם שתרענן את העמוד תראה את הנתונים הכי מעודכנים
export const revalidate = 0;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export default async function Home() {
  // משיכת כל הלידים (הזמנות) ממסד הנתונים, מסודרים מהחדש לישן
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return <div className="p-10 text-red-500 text-center text-2xl">שגיאה בטעינת נתונים: {error.message}</div>;
  }

  // פונקציות עזר לתרגום ההקשות לטקסט קריא
  const getMapType = (val: string) => {
    if (val === '1') return 'יום חול';
    if (val === '2') return 'שבת';
    return val || 'טרם נבחר';
  };

  const getMapSize = (val: string) => {
    if (val === '1') return '1 מטר';
    if (val === '2') return '1.5 מטר';
    if (val === '3') return '2 מטר';
    return val || 'טרם נבחר';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 rtl" dir="rtl">
      <div className="max-w-5xl mx-auto">
        
        {/* כותרת הדאשבורד */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">מערכת הזמנות - מפות</h1>
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold">
            סה"כ הזמנות: {leads?.length || 0}
          </div>
        </div>
        
        {/* טבלת הנתונים */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-4 font-semibold text-sm">מספר טלפון</th>
                  <th className="p-4 font-semibold text-sm">סוג מפה</th>
                  <th className="p-4 font-semibold text-sm">מידה</th>
                  <th className="p-4 font-semibold text-sm">תאריך ושעת הזמנה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leads?.map((lead) => (
                  <tr key={lead.id} className="hover:bg-blue-50 transition duration-150 ease-in-out">
                    <td className="p-4 font-medium text-gray-900" dir="ltr">{lead.phone}</td>
                    <td className="p-4 text-gray-700">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        lead.data?.map_type === '1' ? 'bg-amber-100 text-amber-800' : 
                        lead.data?.map_type === '2' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {getMapType(lead.data?.map_type)}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700 font-medium">
                      {getMapSize(lead.data?.map_size)}
                    </td>
                    <td className="p-4 text-gray-500 text-sm">
                      {new Date(lead.created_at).toLocaleString('he-IL', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                  </tr>
                ))}
                
                {/* מצב שבו אין נתונים עדיין */}
                {(!leads || leads.length === 0) && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-gray-400 text-lg">
                      עדיין אין הזמנות במערכת. חייג לשלוחה כדי ליצור הזמנה ראשונה!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}