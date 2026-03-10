import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// יצירת החיבור למסד הנתונים
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  // חילוץ הפרמטרים מהבקשה שימות המשיח שולחים אלינו
  const { searchParams } = new URL(request.url);

  const phone = searchParams.get('ApiPhone');
  const campaignId = searchParams.get('campaign_id'); // פרמטר שאנחנו נוסיף בהגדרות השלוחה בימות
  const currentStepOrder = parseInt(searchParams.get('next_step') || '1');
  const lastAnswer = searchParams.get('ApiEnter'); // מה שהמשתמש הקיש כרגע בטלפון

  // אם חסרים נתונים קריטיים כמו מספר טלפון או מזהה קמפיין, ננתק את השיחה
  if (!phone || !campaignId) {
    return new NextResponse('hangup=yes');
  }

  // 1. שמירת התשובה מהשלב הקודם (אם המשתמש הקיש משהו)
  if (lastAnswer && currentStepOrder > 1) {
    const { data: prevStep } = await supabase
      .from('campaign_steps')
      .select('data_key')
      .eq('campaign_id', campaignId)
      .eq('step_order', currentStepOrder - 1)
      .single();

    if (prevStep?.data_key) {
      await supabase.rpc('update_lead_data', {
        p_phone: phone,
        p_campaign_id: campaignId,
        p_key: prevStep.data_key,
        p_value: lastAnswer
      });
    }
  }

  // 2. שליפת השלב הנוכחי כדי לדעת מה להשמיע עכשיו
  const { data: step, error } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('step_order', currentStepOrder)
    .single();

  // אם אין יותר שלבים (סיימנו את העץ), נגיד תודה וננתק
  if (error || !step) {
    return new NextResponse('id_list_message=t-thank_you&hangup=yes');
  }

  // 3. בניית התגובה לימות המשיח לפי סוג השלב שמוגדר במסד הנתונים
  let response = '';
  
  if (step.step_type === 'play') {
    // להשמיע קובץ ולהמשיך מיד לשלב הבא בלי להמתין להקשה
    response = `play=t-${step.message_file}&go_to_query=next_step=${currentStepOrder + 1}`;
  } else if (step.step_type === 'read_digits') {
    // להשמיע קובץ ולהמתין שהמשתמש יקיש נתונים (המערכת תחזור אלינו שוב עם התוצאה)
    response = `read=t-${step.message_file}=no,1,1,1,7,#,yes&next_step=${currentStepOrder + 1}`;
  }

  // מחזירים את הפקודה למערכת הטלפונית
  return new NextResponse(response);
}