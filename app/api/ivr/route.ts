import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('ApiPhone');
    let campaignId = searchParams.get('campaign_id');
    const currentStep = parseInt(searchParams.get('next_step') || '1');
    const lastAnswer = searchParams.get('ApiEnter');

    if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
    
    // בדיקת בסיס
    if (!phone || !campaignId) return new Response('hangup=yes');

    console.log(`>>> LOG: Step ${currentStep} | Phone ${phone} | Answer ${lastAnswer}`);

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
      const finishMsg = "read=t-תודה רבה בחירתך נשמרה=no,1,1,1,digits,no,no&hangup=yes";
      return new Response(finishMsg, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // 3. הכנת ההודעה - ניקוי אגרסיבי של תווים מיוחדים
    let msg = step.message_file;
    if (!msg.startsWith('t-') && !/^\d+$/.test(msg)) msg = 't-' + msg;
    
    // הסרת פסיקים, נקודות וסימני שאלה שמשגעים את ימות המשיח בתוך read
    const safeMsg = msg.replace(/[.,?=]/g, '');

    // 4. בניית הפקודה - שים לב: הכל בשורה אחת, בלי רווחים מיותרים בפרמטרים
    const responseBody = `read=${safeMsg}=no,1,1,10,Digits,no,no&next_step=${currentStep + 1}`;
    
    console.log(`>>> SENDING TO YEMOT: ${responseBody}`);

    return new Response(responseBody, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (err: any) {
    console.error('>>> CRITICAL ERROR:', err.message);
    return new Response(`id_list_message=t-שגיאה בשרת ${err.message}&hangup=yes`);
  }
}