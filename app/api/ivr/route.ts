import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const currentStep = parseInt(searchParams.get('next_step') || '1');
  const lastAnswer = searchParams.get('ApiEnter');

  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  console.log(`>>> Step ${currentStep} | Answer: ${lastAnswer}`);

  // 1. שמירת תשובה (אם קיימת)
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
    }
  }

  // 2. שליפת השלב
  const { data: step, error } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('step_order', currentStep)
    .single();

  if (error || !step) {
    return new Response('id_list_message=t-תודה רבה הבחירות נשמרו\nhangup=yes', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 3. בניית התגובה - שים לב: אין שורה ריקה לפני id_list_message
  let msg = step.message_file;
  if (!msg.startsWith('t-') && !/^\d+$/.test(msg)) msg = 't-' + msg;

  // הפקודה id_list_message משמיעה את הטקסט
  // הפקודה read מחכה להקשה אחת (1,1) במשך 10 שניות
  const response = `id_list_message=${msg}\nread=t-.=no,1,1,10,digits,no,no&next_step=${currentStep + 1}`;
  
  // אנחנו מדפיסים ללוג בלי ירידת שורה מקדימה כדי שתוכל לראות שזה נקי
  console.log('>>> Final Response Sending...');

  return new Response(response.trim(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}