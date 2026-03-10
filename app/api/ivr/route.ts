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

  console.log(`>>> Processing Step ${currentStep} for ${phone}`);

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
      console.log(`>>> Saved ${prevStep.data_key}: ${lastAnswer}`);
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
    return new Response('id_list_message=t-תודה רבה בחירתך נשמרה\nhangup=yes', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 3. בניית התגובה בשתי שורות נפרדות (למניעת שגיאות)
  // שורה 1: השמעת ההודעה
  // שורה 2: המתנה להקשה (ה-t-. הוא צליל שקט קצרצר)
  const cleanMessage = step.message_file.replace(/[.,]/g, ''); // הסרת נקודות ופסיקים מהטקסט
  
  const finalResponse = `id_list_message=${cleanMessage}\nread=t-.=no,1,1,10,Digits,yes,no&campaign_id=${campaignId}&next_step=${currentStep + 1}`;
  
  console.log('>>> Sending Response:\n', finalResponse);

  return new Response(finalResponse, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}