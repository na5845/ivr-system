import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const currentStep = parseInt(searchParams.get('next_step') || '1');
  const lastAnswer = searchParams.get('ApiEnter'); // התשובה שהמשתמש הקיש כרגע

  // 1. ניקוי ID
  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  console.log(`>>> Processing Step ${currentStep} for phone ${phone}`);

  // 2. שמירת התשובה מהשלב הקודם (אם יש כזו)
  if (lastAnswer) {
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

  // 3. שליפת השלב הבא להשמעה
  const { data: step, error } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('step_order', currentStep)
    .single();

  // אם אין יותר שלבים - הודעת סיום וניתוק
  if (error || !step) {
    return new Response('id_list_message=t-תודה רבה, הבחירות שלך נשמרו במערכת\nhangup=yes', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 4. בניית פקודת ה-Read (השמעת טקסט והמתנה להקשה)
  // הפקודה אומרת: השמע את message_file, חכה להקשה אחת (1,1), ואז תחזור לכאן עם next_step הבא
  const finalResponse = `read=${step.message_file}=no,1,1,1,10,#,no&campaign_id=${campaignId}&next_step=${currentStep + 1}`;
  
  console.log('>>> Final Response:', finalResponse);

  return new Response(finalResponse, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}