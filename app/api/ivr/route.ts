import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const currentStep = parseInt(searchParams.get('next_step') || '1');
  const lastAnswer = searchParams.get('ApiEnter');

  // 1. ניקוי campaignId
  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  console.log(`>>> Step ${currentStep} | Answer: ${lastAnswer}`);

  // 2. שמירת תשובה (אם קיימת)
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

  // 3. שליפת השלב
  const { data: step, error } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('step_order', currentStep)
    .single();

  if (error || !step) {
    return new Response('id_list_message=t-תודה+רבה+הבחירות+נשמרו\nhangup=yes', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 4. הכנת ההודעה: החלפת רווחים ב-+ והוספת t-
  let msg = step.message_file;
  if (!msg.startsWith('t-') && !/^\d+$/.test(msg)) msg = 't-' + msg;
  const encodedMsg = msg.replace(/\s+/g, '+'); // מחליף כל רווח ב-+

  // 5. פקודת ה-read בפורמט "הבטון"
  // הודעה=no(בלי חזרה), 1(מינימום), 1(מקסימום), 10(שניות), digits(סוג)
  const response = `read=${encodedMsg}=no,1,1,10,digits,no,no&campaign_id=${campaignId}&next_step=${currentStep + 1}`;
  
  console.log('>>> Final Response:', response);

  return new Response(response, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}