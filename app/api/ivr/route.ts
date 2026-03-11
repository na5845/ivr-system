import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');

  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  // 1. שליפת השלבים והליד הקיים
  const { data: allSteps } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('step_order', { ascending: true });

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('phone', phone)
    .eq('campaign_id', campaignId)
    .single();

  // 2. בדיקה אם המשתמש כבר סיים בעבר
  if (lead?.status === 'completed') {
    return new Response(`id_list_message=t-שלום רב המערכת כבר קיבלה את הפרטים שלך תודה ושלום&hangup=yes`, { 
      headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
    });
  }

  // 3. איסוף תשובות חדשות - הגדרת סוגים ל-TypeScript
  const currentData = lead?.data || {};
  let newlyAnsweredStepKey: string | null = null;
  let lastValueReceived: string | null = null;

  allSteps?.forEach(step => {
    const answerFromUrl = searchParams.get(`ans_${step.step_order}`);
    // אם קיבלנו תשובה ב-URL והיא עוד לא רשומה במסד הנתונים
    if (answerFromUrl && !currentData[step.data_key]) {
      currentData[step.data_key] = answerFromUrl;
      newlyAnsweredStepKey = step.data_key;
      lastValueReceived = answerFromUrl;
    }
  });

  // 4. אם יש תשובות חדשות - שמירה למסד הנתונים
  if (newlyAnsweredStepKey) {
    const isLastStep = allSteps?.every(s => currentData[s.data_key]);
    
    await supabase.from('leads').upsert({
      phone,
      campaign_id: campaignId,
      data: currentData,
      status: isLastStep ? 'completed' : 'in_progress',
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone, campaign_id' });
  }

  // 5. מציאת השאלה הבאה שטרם נענתה
  const nextQuestion = allSteps?.find(s => !currentData[s.data_key]);

  // 6. בניית התגובה לימות המשיח
  if (!nextQuestion) {
    return new Response(`id_list_message=t-תודה רבה ההזמנה הושלמה בהצלחה&hangup=yes`, { 
      headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
    });
  }

  // הכנת טקסט אישור (אם התשובה האחרונה הייתה בחירה)
  let confirmationPrefix = "";
  if (newlyAnsweredStepKey && lastValueReceived) {
    const lastStepObj = allSteps?.find(s => s.data_key === newlyAnsweredStepKey);
    if (lastStepObj?.question_type === 'choice' && lastStepObj.options && lastStepObj.options[lastValueReceived]) {
      confirmationPrefix = `בחרת ${lastStepObj.options[lastValueReceived]}. `;
    }
  }

  const cleanMsg = nextQuestion.message_content.replace(/[.,]/g, '');
  
  // בניית הפקודה עם משתנה ייחודי ans_{order}
  const varName = `ans_${nextQuestion.step_order}`;
  const audioPrefix = nextQuestion.is_audio ? '' : 't-';
  const fullMsg = confirmationPrefix ? `t-${confirmationPrefix}s-1.${audioPrefix}${cleanMsg}` : `${audioPrefix}${cleanMsg}`;

  // שימוש ב-yes בפרמטר ה-7 כדי להכריח את ימות המשיח לשאול שוב
  const response = `read=${fullMsg}=${varName},no,${nextQuestion.min_digits},${nextQuestion.max_digits},10,Digits,yes`;

  return new Response(response, { 
    headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
  });
}