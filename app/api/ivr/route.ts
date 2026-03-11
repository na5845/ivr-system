import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');

  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  const { data: allSteps } = await supabase.from('campaign_steps').select('*').eq('campaign_id', campaignId).order('step_order', { ascending: true });
  const { data: lead } = await supabase.from('leads').select('*').eq('phone', phone).eq('campaign_id', campaignId).single();

  if (lead?.status === 'completed') {
    return new Response(`id_list_message=t-שלום רב המערכת כבר קיבלה את הפרטים שלך תודה ושלום&hangup=yes`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  let currentData = lead?.data || {};
  let canceledText = "";
  let isDataChanged = false;

  // 1. בדיקת אישור (האם אנחנו במצב המתנה לאישור מהקשה קודמת?)
  const awaitingStepOrder = currentData['_awaiting_confirm_step'];
  if (awaitingStepOrder) {
    const confirmVal = searchParams.get(`Confirm_${awaitingStepOrder}`);
    if (confirmVal) {
      if (confirmVal === '1') {
        // אושר!
        const stepObj = allSteps?.find(s => s.step_order === awaitingStepOrder);
        if (stepObj) {
          currentData[stepObj.data_key] = currentData['_temp_val'];
        }
      } else {
        // בוטל! (הקיש משהו אחר מ-1)
        canceledText = "הביטול נקלט. ";
      }
      // מנקים את מצב ההמתנה כדי להמשיך הלאה
      delete currentData['_awaiting_confirm_step'];
      delete currentData['_temp_val'];
      isDataChanged = true;
    }
  } 
  // 2. קליטת תשובות רגילות חדשות
  else {
    allSteps?.forEach(step => {
      // אנחנו מחפשים משתנה ייחודי לכל שאלה (Val_1, Val_2 וכו')
      const val = searchParams.get(`Val_${step.step_order}`);
      
      // אם קיבלנו ערך, והוא עדיין לא שמור אצלנו באופן סופי
      if (val && !currentData[step.data_key]) {
        if (step.question_type === 'choice' && step.options && step.options[val]) {
          // זו שאלת בחירה ויש לה תרגום - עוברים למצב המתנה לאישור
          currentData['_awaiting_confirm_step'] = step.step_order;
          currentData['_temp_val'] = val;
          isDataChanged = true;
        } else {
          // שאלה רגילה (כמו תעודת זהות) - שומרים ישירות
          currentData[step.data_key] = val;
          isDataChanged = true;
        }
      }
    });
  }

  // 3. שמירה למסד נתונים רק אם משהו השתנה
  if (isDataChanged) {
    const isLast = allSteps?.every(s => currentData[s.data_key] !== undefined) && !currentData['_awaiting_confirm_step'];
    await supabase.from('leads').upsert({
      phone, campaign_id: campaignId, data: currentData, status: isLast ? 'completed' : 'in_progress', updated_at: new Date().toISOString()
    }, { onConflict: 'phone, campaign_id' });
  }

  // --- 4. בניית התגובה לימות המשיח ---

  // אם אנחנו עכשיו צריכים לבקש אישור:
  if (currentData['_awaiting_confirm_step']) {
    const stepObj = allSteps?.find(s => s.step_order === currentData['_awaiting_confirm_step']);
    const optionName = stepObj?.options[currentData['_temp_val']];
    
    const confirmMsg = `t-בחרת ${optionName} לאישור הקש 1 לביטול הקש 2`;
    // מזהה הפקודה הפעם יהיה Confirm_X - ואנחנו שמים הכל על no כדי שימות המשיח ישתוק
    return new Response(`read=${confirmMsg}=Confirm_${stepObj?.step_order},no,1,1,10,Digits,no`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // אחרת, מוצאים את השאלה הבאה
  const nextQuestion = allSteps?.find(s => !currentData[s.data_key]);

  if (!nextQuestion) {
    return new Response(`id_list_message=t-תודה רבה ההזמנה הושלמה בהצלחה&hangup=yes`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const cleanContent = nextQuestion.message_content.replace(/[.,]/g, '');
  const prefix = nextQuestion.is_audio ? '' : 't-';
  
  let msg = "";
  if (canceledText) {
     msg = `t-${canceledText}s-1.${prefix}${cleanContent}`; // אם בוטל, אומרים "הביטול נקלט" ואז שואלים שוב
  } else {
     msg = `${prefix}${cleanContent}`;
  }

  // מזהה הפקודה הרגיל יהיה Val_X
  const response = `read=${msg}=Val_${nextQuestion.step_order},no,${nextQuestion.min_digits},${nextQuestion.max_digits},10,Digits,no`;

  return new Response(response, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}