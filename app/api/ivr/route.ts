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

  // ניקוי ה-ID
  if (campaignId && campaignId.includes('?')) {
    campaignId = campaignId.split('?')[0];
  }

  if (!phone || !campaignId) {
    return new Response('hangup=yes', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // 1. שמירת תשובה
  if (lastAnswer && currentStepOrder > 1) {
    await supabase.rpc('update_lead_data', {
      p_phone: phone,
      p_campaign_id: campaignId,
      p_key: 'step_' + (currentStepOrder - 1),
      p_value: lastAnswer
    });
  }

  // 2. שליפת השלב
  const { data: step, error } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('step_order', currentStepOrder)
    .single();

  if (error || !step) {
    return new Response('id_list_message=t-תודה רבה ולהתראות\nhangup=yes', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 3. בניית התגובה עם ירידת שורה (\n) בין הפקודות
  let finalResponse = '';

  if (step.step_type === 'play') {
    // משמיע קובץ ואז עובר מיד לשלב הבא (באמצעות read ריק של שניה)
    finalResponse = `id_list_message=${step.message_file}\nread=t-none=no,1,1,1,1,#,no&campaign_id=${campaignId}&next_step=${currentStepOrder + 1}`;
  } 
  else if (step.step_type === 'read_digits') {
    // השמעת קובץ והמתנה להקשה
    finalResponse = `read=${step.message_file}=no,1,1,1,7,#,yes&campaign_id=${campaignId}&next_step=${currentStepOrder + 1}`;
  }

  console.log('Final Response Sent:\n', finalResponse);

  return new Response(finalResponse, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}