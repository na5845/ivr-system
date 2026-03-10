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

  // ניקוי יסודי של ה-campaignId מכל הבלאגן שימות המשיח מדביקים
  if (campaignId && campaignId.includes('?')) {
    campaignId = campaignId.split('?')[0];
  }

  console.log(`--- Request for Campaign: ${campaignId}, Step: ${currentStepOrder} ---`);

  if (!phone || !campaignId) {
    return new Response('hangup=yes', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // 1. שמירת תשובה משלב קודם
  if (lastAnswer && currentStepOrder > 1) {
    await supabase.rpc('update_lead_data', {
      p_phone: phone,
      p_campaign_id: campaignId,
      p_key: 'step_' + (currentStepOrder - 1),
      p_value: lastAnswer
    });
  }

  // 2. שליפת השלב הנוכחי
  const { data: step, error } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('step_order', currentStepOrder)
    .single();

  if (error || !step) {
    return new Response('id_list_message=t-תודה רבה ולהתראות&hangup=yes', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  // 3. בניית התגובה - כאן היה השינוי הקריטי!
  let finalResponse = '';
  
  if (step.step_type === 'play') {
    // השמעת קובץ ואז פקודה לחזור ל-API לשלב הבא עם ה-ID של הקמפיין
    finalResponse = `id_list_message=${step.message_file}&go_to_query=campaign_id=${campaignId}&next_step=${currentStepOrder + 1}`;
  } 
  else if (step.step_type === 'read_digits') {
    // בקשת הקשה - הפרמטרים של ה-API עוברים בתוך ה-read
    finalResponse = `read=${step.message_file}=no,1,1,1,7,#,yes&campaign_id=${campaignId}&next_step=${currentStepOrder + 1}`;
  }

  console.log('Sending to Yemot:', finalResponse);

  return new Response(finalResponse, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}