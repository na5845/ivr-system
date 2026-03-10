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

  console.log(`--- New Request: Phone: ${phone}, Campaign: ${campaignId}, Step: ${currentStepOrder} ---`);

  if (!phone || !campaignId) {
    return new Response('hangup=yes', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  if (campaignId.includes('?')) {
    campaignId = campaignId.split('?')[0];
  }

  // 1. שמירת תשובה
  if (lastAnswer && currentStepOrder > 1) {
    try {
      await supabase.rpc('update_lead_data', {
        p_phone: phone,
        p_campaign_id: campaignId,
        p_key: 'step_' + (currentStepOrder - 1),
        p_value: lastAnswer
      });
      console.log(`Saved answer: ${lastAnswer}`);
    } catch (e) {
      console.error('Error saving to DB:', e);
    }
  }

  // 2. שליפת השלב
  const { data: step, error } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('step_order', currentStepOrder)
    .single();

  let finalResponse = 'hangup=yes';

  if (error || !step) {
    console.log('No more steps found or error:', error?.message);
  } else {
    if (step.step_type === 'play') {
      finalResponse = `id_list_message=${step.message_file}&next_step=${currentStepOrder + 1}`;
    } else if (step.step_type === 'read_digits') {
      finalResponse = `read=${step.message_file}=no,1,1,1,7,#,yes&next_step=${currentStepOrder + 1}`;
    }
  }

  // הדפסת התגובה ללוגים של Vercel כדי שנוכל לראות אותה!
  console.log('Final Response to Yemot:', finalResponse);

  return new Response(finalResponse, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}