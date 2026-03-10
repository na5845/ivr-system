import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const phone = searchParams.get('ApiPhone');
  const campaignId = searchParams.get('campaign_id'); 
  const currentStepOrder = parseInt(searchParams.get('next_step') || '1');
  const lastAnswer = searchParams.get('ApiEnter'); 

  if (!phone || !campaignId) {
    return new NextResponse('hangup=yes');
  }

  // 1. שמירת התשובה מהשלב הקודם (אם המשתמש הקיש משהו)
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

  // 2. שליפת השלב הנוכחי
  const { data: step, error } = await supabase
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('step_order', currentStepOrder)
    .single();

  // אם אין יותר שלבים, ננתק את השיחה
  if (error || !step) {
    return new NextResponse('hangup=yes');
  }

  // 3. בניית התגובה לימות המשיח בפקודות תקינות!
  let response = '';
  
  if (step.step_type === 'play') {
    // הפקודה הנכונה להשמעת קובץ רגיל וניתוק (כי זה שלב יחיד בטסט)
    response = `id_list_message=${step.message_file}&hangup=yes`;
  } else if (step.step_type === 'read_digits') {
    // הפקודה לבקשת הקשה - הורדנו את ה t- כדי שישמיע קובץ רגיל
    response = `read=${step.message_file}=no,1,1,1,7,#,yes&next_step=${currentStepOrder + 1}`;
  }

  return new NextResponse(response);
}