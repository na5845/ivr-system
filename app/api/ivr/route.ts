import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('ApiPhone');
    let campaignId = searchParams.get('campaign_id');
    const currentStepOrder = parseInt(searchParams.get('next_step') || '1');
    const lastAnswer = searchParams.get('ApiEnter');

    if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];

    console.log(`Checking Step ${currentStepOrder} for Campaign ${campaignId}`);

    if (!phone || !campaignId) return new Response('id_list_message=t-missing parameters\nhangup=yes');

    // שמירה (רק אם יש תשובה)
    if (lastAnswer && currentStepOrder > 1) {
      const { data: prevStep } = await supabase
        .from('campaign_steps')
        .select('data_key')
        .eq('campaign_id', campaignId)
        .eq('step_order', currentStepOrder - 1)
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

    // שליפת השלב
    const { data: step, error } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('step_order', currentStepOrder)
      .single();

    if (error || !step) {
      console.log('Step not found in DB');
      return new Response('id_list_message=t-לא נמצא שלב תואם במסד הנתונים\nhangup=yes', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    const response = `read=${step.message_file}=no,1,1,1,7,#,yes&campaign_id=${campaignId}&next_step=${currentStepOrder + 1}`;
    return new Response(response, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  } catch (err: any) {
    console.error('Crash error:', err.message);
    return new Response(`id_list_message=t-שגיאת קוד ${err.message}\nhangup=yes`, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}