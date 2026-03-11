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

  const currentData = lead?.data || {};

  // 2. בדיקה אם המשתמש כבר סיים
  if (lead?.status === 'completed') {
    return new Response(`id_list_message=t-שלום רב המערכת כבר קיבלה את הפרטים שלך תודה ושלום&hangup=yes`, { 
      headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
    });
  }

  // 3. טיפול באישור (Confirmation) - האם המשתמש הקיש 1 לאישור?
  const isConfirming = searchParams.get('confirm_step');
  const confirmValue = searchParams.get('ApiEnter'); // הקלט של ה-1 לאישור

  if (isConfirming && confirmValue === '1') {
    // המשתמש אישר את השלב שצוין ב-confirm_step
    const stepToConfirm = allSteps?.find(s => s.step_order.toString() === isConfirming);
    if (stepToConfirm) {
      // כאן אנחנו באמת מסמנים שהשלב עבר (כרגע זה פשוט אומר שנעבור לשאלה הבאה)
      // אם יש צורך בלוגיקה נוספת לשמירה סופית, זה המקום.
    }
  } else if (isConfirming && confirmValue !== '1') {
    // המשתמש לא הקיש 1 - אנחנו צריכים למחוק את התשובה האחרונה ולשאול שוב
    const stepToReset = allSteps?.find(s => s.step_order.toString() === isConfirming);
    if (stepToReset) {
      delete currentData[stepToReset.data_key];
      await supabase.from('leads').update({ data: currentData }).eq('phone', phone).eq('campaign_id', campaignId);
    }
  }

  // 4. איסוף תשובות חדשות מה-URL
  let newlyAnsweredStep: any = null;
  let lastVal: string | null = null;

  allSteps?.forEach(step => {
    const val = searchParams.get(`ans_${step.step_order}`);
    if (val && !currentData[step.data_key]) {
      currentData[step.data_key] = val;
      newlyAnsweredStep = step;
      lastVal = val;
    }
  });

  if (newlyAnsweredStep) {
    const isLast = allSteps?.every(s => currentData[s.data_key]);
    await supabase.from('leads').upsert({
      phone, campaign_id: campaignId, data: currentData,
      status: isLast ? 'completed' : 'in_progress'
    }, { onConflict: 'phone, campaign_id' });

    // אם זו שאלת בחירה, אנחנו עוצרים כאן ומבקשים אישור!
    if (newlyAnsweredStep.question_type === 'choice' && newlyAnsweredStep.options && lastVal && newlyAnsweredStep.options[lastVal]) {
      const optionName = newlyAnsweredStep.options[lastVal];
      const confirmMsg = `t-בחרת ${optionName} לאישור הקש 1 לביטול הקש 2`;
      // אנחנו קוראים ל-API של עצמנו שוב עם הפרמטר confirm_step
      return new Response(`read=${confirmMsg}=ApiEnter,no,1,1,10,Digits,no&confirm_step=${newlyAnsweredStep.step_order}`, { 
        headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
      });
    }
  }

  // 5. מציאת השאלה הבאה
  const nextQuestion = allSteps?.find(s => !currentData[s.data_key]);

  if (!nextQuestion) {
    return new Response(`id_list_message=t-תודה רבה ההזמנה הושלמה בהצלחה&hangup=yes`, { 
      headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
    });
  }

  // בניית פקודת השאלה הבאה
  const audioPrefix = nextQuestion.is_audio ? '' : 't-';
  const cleanContent = nextQuestion.message_content.replace(/[.,]/g, '');
  const varName = `ans_${nextQuestion.step_order}`;
  
  // הוספת s-1 להפסקה קלה לפני השאלה
  const response = `read=s-1.${audioPrefix}${cleanContent}=${varName},no,${nextQuestion.min_digits},${nextQuestion.max_digits},10,Digits,yes`;

  return new Response(response, { 
    headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
  });
}