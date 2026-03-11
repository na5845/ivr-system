import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const apiEnter = searchParams.get('ApiEnter'); // חזרנו להשתמש במשתנה הראשי!

  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  // 1. שליפת השלבים והליד הקיים
  const { data: allSteps } = await supabase.from('campaign_steps').select('*').eq('campaign_id', campaignId).order('step_order', { ascending: true });
  const { data: lead } = await supabase.from('leads').select('*').eq('phone', phone).eq('campaign_id', campaignId).single();

  if (lead?.status === 'completed') {
    return new Response(`id_list_message=t-שלום רב המערכת כבר קיבלה את הפרטים שלך תודה ושלום&hangup=yes`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  let currentData = lead?.data || {};
  let canceledText = "";

  // 2. עיבוד התשובה שהתקבלה מהלקוח
  if (apiEnter && apiEnter !== 'null' && apiEnter !== '') {
    
    // האם אנחנו כרגע במצב "המתנה לאישור"?
    const awaitingStepOrder = currentData['_awaiting_confirm_step'];
    
    if (awaitingStepOrder) {
      // ---- מצב אישור (1 לאישור, 2 לביטול) ----
      if (apiEnter === '1') {
        // המשתמש אישר! שומרים את הערך האמיתי
        const stepObj = allSteps?.find(s => s.step_order === awaitingStepOrder);
        if (stepObj) {
           currentData[stepObj.data_key] = currentData['_temp_val'];
        }
        // מנקים את מצב ההמתנה
        delete currentData['_awaiting_confirm_step'];
        delete currentData['_temp_val'];
      } else {
        // המשתמש ביטל (הקיש 2 או משהו אחר)
        delete currentData['_awaiting_confirm_step'];
        delete currentData['_temp_val'];
        canceledText = "הביטול נקלט "; // נוסיף את זה לתחילת השאלה החוזרת
      }
    } else {
      // ---- מצב רגיל (מענה לשאלה) ----
      const nextStep = allSteps?.find(s => !currentData[s.data_key]);
      
      if (nextStep) {
        if (nextStep.question_type === 'choice' && nextStep.options && nextStep.options[apiEnter]) {
          // זו שאלת בחירה ויש לה תרגום! נכנסים למצב "המתנה לאישור"
          currentData['_awaiting_confirm_step'] = nextStep.step_order;
          currentData['_temp_val'] = apiEnter;
        } else {
          // שאלה רגילה (כמו ת"ז), שומרים ישירות
          currentData[nextStep.data_key] = apiEnter;
        }
      }
    }

    // שמירה למסד הנתונים
    const isLast = allSteps?.every(s => currentData[s.data_key] !== undefined) && !currentData['_awaiting_confirm_step'];
    await supabase.from('leads').upsert({
      phone, campaign_id: campaignId, data: currentData, status: isLast ? 'completed' : 'in_progress', updated_at: new Date().toISOString()
    }, { onConflict: 'phone, campaign_id' });
  }

  // 3. החלטה מה לשדר עכשיו ללקוח בטלפון

  // אם אנחנו ממתינים לאישור עכשיו - משדרים את שאלת האישור!
  if (currentData['_awaiting_confirm_step']) {
    const stepObj = allSteps?.find(s => s.step_order === currentData['_awaiting_confirm_step']);
    const optionName = stepObj?.options[currentData['_temp_val']];
    
    // פקודת קריאה לאישור (בלי נקודות כדי לא לשבור את ימות המשיח)
    const confirmMsg = `t-בחרת ${optionName} לאישור הקש 1 לביטול הקש 2`;
    return new Response(`read=${confirmMsg}=ApiEnter,no,1,1,10,Digits,yes`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // אחרת, מוצאים את השאלה הבאה הרגילה
  const nextQuestion = allSteps?.find(s => !currentData[s.data_key]);

  if (!nextQuestion) {
    return new Response(`id_list_message=t-תודה רבה ההזמנה הושלמה בהצלחה&hangup=yes`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const cleanContent = nextQuestion.message_content.replace(/[.,]/g, '');
  const prefix = nextQuestion.is_audio ? '' : 't-';
  
  let msg = "";
  if (canceledText) {
     msg = `t-${canceledText}s-1.${prefix}${cleanContent}`; // הוספת שניה הפסקה
  } else {
     msg = `${prefix}${cleanContent}`;
  }

  // הפקודה הקלאסית (עם yes בסוף כדי להכריח את המערכת לקלוט שוב)
  const response = `read=${msg}=ApiEnter,no,${nextQuestion.min_digits},${nextQuestion.max_digits},10,Digits,yes`;

  return new Response(response, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}