import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const lastAnswer = searchParams.get('ApiEnter');

  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  let confirmationText = ""; // הטקסט שהרובוט יקריא כאישור

  // 1. שמירת התשובה הקודמת
  if (lastAnswer && lastAnswer !== 'null') {
    const { data: lead } = await supabase.from('leads').select('data').eq('phone', phone).eq('campaign_id', campaignId).single();
    const { data: steps } = await supabase.from('campaign_steps').select('*').eq('campaign_id', campaignId).order('step_order', { ascending: true });
    
    const currentData = lead?.data || {};
    const answeredStep = steps?.find(s => !currentData[s.data_key]);

    if (answeredStep) {
      await supabase.rpc('update_lead_data', {
        p_phone: phone, p_campaign_id: campaignId, p_key: answeredStep.data_key, p_value: lastAnswer
      });

      // אם זו שאלת בחירה ויש לה תרגום מוגדר ב-options, נכין טקסט אישור להשמעה!
      if (answeredStep.question_type === 'choice' && answeredStep.options && answeredStep.options[lastAnswer]) {
        confirmationText = `בחרת ${answeredStep.options[lastAnswer]}. `;
      }
    }
  }

  // 2. שליפת השאלה הבאה
  const { data: leadAfter } = await supabase.from('leads').select('data').eq('phone', phone).eq('campaign_id', campaignId).single();
  const { data: allSteps } = await supabase.from('campaign_steps').select('*').eq('campaign_id', campaignId).order('step_order', { ascending: true });

  const currentData = leadAfter?.data || {};
  const currentQuestion = allSteps?.find(s => !currentData[s.data_key]);

  if (!currentQuestion) {
    // השמעת אישור גם בשלב האחרון אם צריך
    const finalMsg = confirmationText ? `t-${confirmationText}תודה רבה ההזמנה הושלמה` : `t-תודה רבה ההזמנה הושלמה`;
    return new Response(`id_list_message=${finalMsg}&hangup=yes`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // חיבור של מילת האישור (אם קיימת) לתחילת השאלה הבאה
  const prefix = currentQuestion.is_audio ? '' : 't-';
  
  // אם השאלה הבאה היא שמע (audio), אנחנו לא יכולים לערבב אותה עם טקסט רובוטי בקלות באותה פקודה.
  // אז נקריא את האישור רק אם השאלה הבאה היא גם טקסט (t-).
  let msg = `${prefix}${currentQuestion.message_content}`;
  if (!currentQuestion.is_audio && confirmationText) {
    msg = `t-${confirmationText}${currentQuestion.message_content}`;
  }

  const response = `read=${msg}=ApiEnter,no,${currentQuestion.min_digits},${currentQuestion.max_digits},10,Digits,no`;

  return new Response(response, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}