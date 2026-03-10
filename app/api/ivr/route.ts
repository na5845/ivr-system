import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const currentStep = parseInt(searchParams.get('next_step') || '1');
  const lastAnswer = searchParams.get('ApiEnter');

  // ניקוי campaignId
  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  console.log(`>>> Step ${currentStep} | Answer: ${lastAnswer}`);

  // 1. שמירת תשובה משלב קודם
  if (lastAnswer && currentStep > 1) {
    const { data: prevStep } = await supabase
      .from('campaign_steps')
      .select('data_key')
      .eq('campaign_id', campaignId)
      .eq('step_order', currentStep - 1)
      .single();

    if (prevStep?.data_key) {
      await supabase.rpc('update_lead_data', {
        p_phone: phone,
        p_campaign_id: campaignId,
        p_key: prevStep.data_key,
        p_value: lastAnswer
      });
      console.log(`>>> DB Updated: ${prevStep.data_key} = ${lastAnswer}`);
    }
  }

  // 2. שליפת השלב הנוכחי
  const { data: step, error } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('step_order', currentStep)
    .single();

  if (error || !step) {
    return new Response('id_list_message=t-תודה רבה בחירתך נשמרה בהצלחה\nhangup=yes', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 3. הכנת הטקסט - הסרת נקודות ופסיקים שעלולים לשבור את הפקודה!
  let msg = step.message_file;
  if (!msg.startsWith('t-') && !/^\d+$/.test(msg)) msg = 't-' + msg;
  
  // הסרת כל סימן שאינו אות או מספר כדי שהפקודה לא תישבר
  const cleanMsg = msg.replace(/[.,]/g, '');

  // 4. פקודת ה-read הכי פשוטה בשורה אחת
  // חשוב: לא שמים campaign_id בתגובה כי הוא כבר נמצא ב-URL המקורי של השלוחה
  const response = `read=${cleanMsg}=no,1,1,10,digits,no,no&next_step=${currentStep + 1}`;
  
  console.log('>>> Sending Clean Response:', response);

  return new Response(response, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}