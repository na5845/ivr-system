import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const lastAnswer = searchParams.get('ApiEnter');

  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  let confirmationText = ""; 

  // 1. שמירת התשובה הקודמת
  if (lastAnswer && lastAnswer !== 'null' && lastAnswer !== '') {
    const { data: lead } = await supabase.from('leads').select('data').eq('phone', phone).eq('campaign_id', campaignId).single();
    const { data: steps } = await supabase.from('campaign_steps').select('*').eq('campaign_id', campaignId).order('step_order', { ascending: true });
    
    const currentData = lead?.data || {};
    const answeredStep = steps?.find(s => !currentData[s.data_key]);

    if (answeredStep) {
      await supabase.rpc('update_lead_data', {
        p_phone: phone, p_campaign_id: campaignId, p_key: answeredStep.data_key, p_value: lastAnswer
      });

      // ניקוי סימני פיסוק מהאישור כדי לא לשבור את המערכת
      if (answeredStep.question_type === 'choice' && answeredStep.options && answeredStep.options[lastAnswer]) {
        confirmationText = `בחרת ${answeredStep.options[lastAnswer]} `; 
      }
    }
  }

  // 2. שליפת השאלה הבאה
  const { data: leadAfter } = await supabase.from('leads').select('data').eq('phone', phone).eq('campaign_id', campaignId).single();
  const { data: allSteps } = await supabase.from('campaign_steps').select('*').eq('campaign_id', campaignId).order('step_order', { ascending: true });

  const currentData = leadAfter?.data || {};
  const currentQuestion = allSteps?.find(s => !currentData[s.data_key]);

  // 3. בניית התגובה
  if (!currentQuestion) {
    const finalTxt = confirmationText ? `t-${confirmationText} תודה רבה ההזמנה הושלמה` : `t-תודה רבה ההזמנה הושלמה`;
    return new Response(`id_list_message=${finalTxt}\nhangup=yes`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // בנייה זהירה של ההודעה:
  // אם יש אישור קולי, הוא תמיד יתחיל ב-t-
  // אנחנו ננקה את תוכן השאלה מנקודות ופסיקים
  const cleanQuestionContent = currentQuestion.message_content.replace(/[.,]/g, '');
  let msg = "";

  if (currentQuestion.is_audio) {
    // אם השאלה היא קובץ, נשמיע קודם את האישור (אם יש) ואז את הקובץ
    msg = confirmationText ? `t-${confirmationText}.${currentQuestion.message_content}` : `${currentQuestion.message_content}`;
  } else {
    // אם השאלה היא טקסט, נחבר הכל תחת t- אחד נקי
    msg = `t-${confirmationText}${cleanQuestionContent}`;
  }

  // פקודת read נקייה לחלוטין
  const response = `read=${msg}=ApiEnter,no,${currentQuestion.min_digits},${currentQuestion.max_digits},10,Digits,no`;
  
  console.log(`>>> Sending to Yemot: ${response}`);

  return new Response(response, { 
    headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
  });
}