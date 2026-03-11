import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const lastAnswer = searchParams.get('ApiEnter');

  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  // 1. שמירת התשובה הקודמת (אם קיימת)
  if (lastAnswer && lastAnswer !== 'null') {
    const { data: lead } = await supabase.from('leads').select('data').eq('phone', phone).eq('campaign_id', campaignId).single();
    const { data: steps } = await supabase.from('campaign_steps').select('data_key').eq('campaign_id', campaignId).order('step_order', { ascending: true });
    
    // מציאת השדה הבא שצריך למלא
    const currentData = lead?.data || {};
    const nextStepToSave = steps?.find(s => !currentData[s.data_key]);

    if (nextStepToSave) {
      await supabase.rpc('update_lead_data', {
        p_phone: phone, p_campaign_id: campaignId, p_key: nextStepToSave.data_key, p_value: lastAnswer
      });
    }
  }

  // 2. שליפת השאלה הבאה מה-DB
  const { data: leadAfter } = await supabase.from('leads').select('data').eq('phone', phone).eq('campaign_id', campaignId).single();
  const { data: allSteps } = await supabase.from('campaign_steps').select('*').eq('campaign_id', campaignId).order('step_order', { ascending: true });

  const currentData = leadAfter?.data || {};
  const currentQuestion = allSteps?.find(s => !currentData[s.data_key]);

  // 3. בניית תגובה לימות המשיח
  if (!currentQuestion) {
    return new Response('id_list_message=t-תודה רבה ההזמנה הושלמה&hangup=yes', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const prefix = currentQuestion.is_audio ? '' : 't-';
  const msg = `${prefix}${currentQuestion.message_content}`;
  
  // פקודת ה-read המדויקת עם הפרמטרים מה-DB
  const response = `read=${msg}=ApiEnter,no,${currentQuestion.min_digits},${currentQuestion.max_digits},10,Digits,no`;

  return new Response(response, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}