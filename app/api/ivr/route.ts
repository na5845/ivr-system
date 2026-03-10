import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const currentStep = parseInt(searchParams.get('next_step') || '1');
  const lastAnswer = searchParams.get('ApiEnter');

  // ניקוי ID
  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  console.log(`>>> Connection: Step ${currentStep}, Answer: ${lastAnswer}`);

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
    // הודעת סיום בקידוד URL
    const goodbye = encodeURIComponent('t-תודה רבה הבחירות שלך נשמרו בהצלחה');
    return new Response(`id_list_message=${goodbye}\nhangup=yes`, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 3. הכנת ההודעה בפורמט URL Encoded (לפי המדריך ב-F2)
  let msgText = step.message_file;
  if (!msgText.startsWith('t-') && !/^\d+$/.test(msgText)) msgText = 't-' + msgText;
  
  // הקידוד החשוב ביותר:
  const encodedMsg = encodeURIComponent(msgText);

  // 4. פקודת ה-read בפורמט המדויק
  // נשתמש ב-Digits (D גדולה) וב-7 פרמטרים בלבד
  const response = `read=${encodedMsg}=no,1,1,10,Digits,no,no&next_step=${currentStep + 1}`;
  
  console.log('>>> Sending Response:', response);

  return new Response(response, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}