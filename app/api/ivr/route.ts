import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const currentStepOrder = parseInt(searchParams.get('next_step') || '1');
  const lastAnswer = searchParams.get('ApiEnter'); // מה שהמשתמש הקיש

  // ניקוי ID
  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];

  if (!phone || !campaignId) return new Response('hangup=yes');

  // 1. שמירת התשובה מהשלב הקודם
  if (lastAnswer) {
    // נמצא איזה מפתח נתונים שייך לשלב שזה עתה הסתיים
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

  // 2. שליפת השלב הנוכחי
  const { data: step, error } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('step_order', currentStepOrder)
    .single();

  // אם סיימנו את כל השלבים
  if (error || !step) {
    return new Response('id_list_message=t-תודה רבה, הזמנתך התקבלה בהצלחה\nhangup=yes', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 3. יצירת פקודת ה-Read (זה הלב של המערכת)
  // הפקודה אומרת: תשמיע את הקובץ, ותחזור לאותו URL עם השלב הבא והתשובה
  const response = `read=${step.message_file}=no,1,1,1,7,#,yes&campaign_id=${campaignId}&next_step=${currentStepOrder + 1}`;

  return new Response(response, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}