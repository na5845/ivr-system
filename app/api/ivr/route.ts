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

  console.log(`>>> Step ${currentStep} | Phone ${phone} | Answer ${lastAnswer}`);

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
    return new Response('id_list_message=t-תודה רבה הבחירה נשמרה\nhangup=yes', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 3. הכנת ההודעה להשמעה (הוספת t- אם חסר)
  let message = step.message_file;
  if (!message.startsWith('t-') && !/^\d+$/.test(message)) {
    message = 't-' + message;
  }

  // 4. פקודת ה-read בפורמט הכי בסיסי שעובד תמיד
  // הוספנו תמיכה ב-next_step ו-campaign_id כפרמטרים שיחזרו אלינו
  const response = `read=${message}=no,1,1,7,Digits,no,no,heb&campaign_id=${campaignId}&next_step=${currentStep + 1}`;
  
  console.log('>>> Final Response:', response);

  return new Response(response, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}