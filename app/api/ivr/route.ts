import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const lastAnswer = searchParams.get('ApiEnter'); // התשובה שהתקבלה מהקשה קודמת

  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  console.log(`>>> Incoming: Phone: ${phone}, Answer: ${lastAnswer}`);

  // 1. אם המשתמש הקיש משהו, נשמור אותו לשדה הבא שחסר
  if (lastAnswer) {
    // נשלוף את הליד הקיים
    const { data: lead } = await supabase
      .from('leads')
      .select('data')
      .eq('phone', phone)
      .eq('campaign_id', campaignId)
      .single();

    let keyToSave = 'map_type'; // כברירת מחדל נשמור לסוג מפה
    if (lead?.data?.map_type) keyToSave = 'map_size'; // אם כבר יש סוג, נשמור למידה

    await supabase.rpc('update_lead_data', {
      p_phone: phone,
      p_campaign_id: campaignId,
      p_key: keyToSave,
      p_value: lastAnswer
    });
    console.log(`>>> Saved ${keyToSave}: ${lastAnswer}`);
  }

  // 2. נבדוק שוב מה חסר עכשיו כדי לדעת מה לשאול
  const { data: updatedLead } = await supabase
    .from('leads')
    .select('data')
    .eq('phone', phone)
    .eq('campaign_id', campaignId)
    .single();

  let question = "";
  if (!updatedLead?.data?.map_type) {
    question = "t-לבחירת מפה ליום חול הקש 1 לבחירת מפה לשבת הקש 2";
  } else if (!updatedLead?.data?.map_size) {
    question = "t-לבחירת מטר הקש 1 למטר וחצי הקש 2 לשני מטר הקש 3";
  }

  // 3. אם סיימנו את כל השאלות
  if (!question) {
    return new Response('id_list_message=t-תודה רבה בחירתך נשמרה בהצלחה&hangup=yes', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  // 4. התגובה הכי נקייה בעולם (בלי תווים מיותרים בסוף)
  // אנחנו משתמשים ב-id_list_message לדיבור וב-read שקט להקשה - זה השילוב הכי יציב
  const finalResponse = `id_list_message=${question}&read=t- =no,1,1,10,digits,no,no`;
  
  console.log('>>> Sending Clean Response:', finalResponse);

  return new Response(finalResponse, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}