import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const currentStepOrder = parseInt(searchParams.get('next_step') || '1');
  const lastAnswer = searchParams.get('ApiEnter');

  // 1. ניקוי אגרסיבי של ה-ID (הלוגים הראו שזה עדיין נדבק)
  if (campaignId && campaignId.includes('?')) {
    campaignId = campaignId.split('?')[0];
  }

  console.log(`--- IVR Request: Phone: ${phone}, Campaign: ${campaignId}, Step: ${currentStepOrder} ---`);

  if (!phone || !campaignId) {
    return new Response('hangup=yes', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // 2. שמירת התשובה ב-Supabase (אם הגיעה כזו)
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
      console.log(`Saved ${prevStep.data_key}: ${lastAnswer}`);
    }
  }

  // 3. שליפת השלב הנוכחי
  const { data: step, error } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('step_order', currentStepOrder)
    .single();

  if (error || !step) {
    // אם אין יותר שלבים - הודעת סיום בעברית נקייה
    return new Response('id_list_message=t-תודה רבה בחירתך נשמרה בהצלחה&hangup=yes', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 4. יצירת התגובה לימות המשיח (התיקון הקריטי כאן)
  let finalResponse = '';

  if (step.step_type === 'play') {
    // "טריק" המעבר: אנחנו משתמשים ב-read עם המתנה של אפס זמן כדי לעבור לשלב הבא מיד
    finalResponse = `id_list_message=${step.message_file}&read=t-wait=no,1,1,1,1,#,no&campaign_id=${campaignId}&next_step=${currentStepOrder + 1}`;
  } 
  else if (step.step_type === 'read_digits') {
    // קבלת נתונים: ימות המשיח יחזרו אלינו עם הערך ב-ApiEnter
    finalResponse = `read=${step.message_file}=no,1,1,1,7,#,yes&campaign_id=${campaignId}&next_step=${currentStepOrder + 1}`;
  }

  console.log('Final Response:', finalResponse);

  return new Response(finalResponse, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}