import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// חיבור ל-Supabase באמצעות משתני הסביבה שהגדרת ב-Vercel
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // חילוץ פרמטרים בסיסיים מימות המשיח
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  
  // ניהול שלבים ותשובות
  const currentStepOrder = parseInt(searchParams.get('next_step') || '1');
  const lastAnswer = searchParams.get('ApiEnter');

  // בדיקה בסיסית - אם אין טלפון או קמפיין, ננתק
  if (!phone || !campaignId) {
    return new NextResponse('hangup=yes');
  }

  // --- תיקון קריטי: ניקוי ה-campaignId מסימני שאלה מיותרים שימות המשיח מוסיפים ---
  if (campaignId.includes('?')) {
    campaignId = campaignId.split('?')[0];
  }

  // 1. אם יש תשובה משלב קודם - נשמור אותה בטבלת הלידים (leads)
  if (lastAnswer && currentStepOrder > 1) {
    const { data: prevStep } = await supabase
      .from('campaign_steps')
      .select('data_key')
      .eq('campaign_id', campaignId)
      .eq('step_order', currentStepOrder - 1)
      .single();

    if (prevStep?.data_key) {
      // עדכון הנתונים ב-JSONB באמצעות פונקציית ה-RPC שיצרנו ב-SQL
      await supabase.rpc('update_lead_data', {
        p_phone: phone,
        p_campaign_id: campaignId,
        p_key: prevStep.data_key,
        p_value: lastAnswer
      });
    }
  }

  // 2. שליפת השלב הנוכחי מהדאטה-בייס
  const { data: step, error } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('step_order', currentStepOrder)
    .single();

  // אם קרתה שגיאה או שאין יותר שלבים - נסיים את השיחה בברכה
  if (error || !step) {
    return new NextResponse('id_list_message=t-תודה רבה ולהתראות&hangup=yes');
  }

  // 3. בניית התגובה לימות המשיח לפי סוג השלב
  let response = '';

  if (step.step_type === 'play') {
    // השמעת קובץ ומעבר אוטומטי לשלב הבא
    // אם זה השלב האחרון (אין שלב 2), זה פשוט ישמיע וינתק בזכות התנאי למעלה בסיבוב הבא
    response = `id_list_message=${step.message_file}&go_to_query=next_step=${currentStepOrder + 1}`;
  } 
  else if (step.step_type === 'read_digits') {
    // בקשת הקשה מהמשתמש (השמעת קובץ והמתנה להקשה)
    // הפקודה read מחזירה את המשתמש ל-URL שלנו עם התשובה בפרמטר ApiEnter
    response = `read=${step.message_file}=no,1,1,1,7,#,yes&next_step=${currentStepOrder + 1}`;
  }

  // שליחת הפקודה הסופית לימות המשיח
  return new NextResponse(response);
}