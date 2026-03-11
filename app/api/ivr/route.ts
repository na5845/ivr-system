import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const lastAnswer = searchParams.get('ApiEnter');

  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  // 1. בדיקה אם המשתמש כבר קיים וסיים את השאלון
  const { data: existingLead } = await supabase
    .from('leads')
    .select('data, status')
    .eq('phone', phone)
    .eq('campaign_id', campaignId)
    .single();

  const { data: allSteps } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('step_order', { ascending: true });

  const currentData = existingLead?.data || {};
  
  // אם המשתמש כבר ענה על הכל (status יכול להיות 'completed')
  if (existingLead?.status === 'completed') {
    return new Response(`id_list_message=t-שלום רב המערכת כבר קיבלה את הפרטים שלך תודה ושלום&hangup=yes`, { 
      headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
    });
  }

  let confirmationText = ""; 

  // 2. שמירת התשובה האחרונה
  if (lastAnswer && lastAnswer !== 'null' && lastAnswer !== '') {
    const answeredStep = allSteps?.find(s => !currentData[s.data_key]);

    if (answeredStep) {
      const newData = { ...currentData, [answeredStep.data_key]: lastAnswer };
      
      // בדיקה אם זה הצעד האחרון
      const isLastStep = allSteps?.every(s => newData[s.data_key]);
      
      await supabase.from('leads').upsert({
        phone,
        campaign_id: campaignId,
        data: newData,
        status: isLastStep ? 'completed' : 'in_progress',
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone, campaign_id' });

      if (answeredStep.question_type === 'choice' && answeredStep.options && answeredStep.options[lastAnswer]) {
        confirmationText = `בחרת ${answeredStep.options[lastAnswer]} `; 
      }
      
      // עדכון הנתונים המקומיים להמשך הלוגיקה
      currentData[answeredStep.data_key] = lastAnswer;
    }
  }

  // 3. מציאת השאלה הבאה
  const currentQuestion = allSteps?.find(s => !currentData[s.data_key]);

  // הודעת סיום אם אין יותר שאלות
  if (!currentQuestion) {
    const finalMsg = confirmationText ? `t-${confirmationText} תודה רבה ההזמנה הושלמה בהצלחה` : `t-תודה רבה ההזמנה הושלמה בהצלחה`;
    return new Response(`id_list_message=${finalMsg}&hangup=yes`, { 
      headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
    });
  }

  // 4. בניית ההודעה עם הפסקה (3 שניות זה נצח בטלפון, נשים 1.5 שניות שזה מרגיש טבעי)
  const cleanQuestionContent = currentQuestion.message_content.replace(/[.,]/g, '');
  
  // הוספת הפסקה של שניה וחצי (סמל ה-comma פועל ב-TTS של ימות כהפסקה קלה, או שימוש ב-timeout)
  // ב-read אפשר להוסיף שקט לפני
  let msg = "";
  if (currentQuestion.is_audio) {
    msg = confirmationText ? `t-${confirmationText}.s-1.${currentQuestion.message_content}` : `${currentQuestion.message_content}`;
  } else {
    // הוספת s-1 נותן שנייה של שקט לפני השאלה הבאה
    msg = confirmationText ? `t-${confirmationText}.s-1.t-${cleanQuestionContent}` : `t-${cleanQuestionContent}`;
  }

  // 5. תיקון קליטת ספרות (ת"ז)
  // הוספת 'yes' בפרמטר הרביעי של read (המתנה לאישור) או הגדרת סוג הקלט
  // נשתמש בפורמט: read=msg=ApiEnter,yes,min,max,timeout,Digits
  const response = `read=${msg}=ApiEnter,yes,${currentQuestion.min_digits},${currentQuestion.max_digits},10,Digits,no`;
  
  return new Response(response, { 
    headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
  });
}