import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const lastAnswer = searchParams.get('ApiEnter');

  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  console.log(`>>> Incoming Request | Phone: ${phone} | Answer: ${lastAnswer}`);

  // 1. שמירת הנתונים לפי מה שחסר ב-DB
  if (lastAnswer && lastAnswer !== 'null') {
    const { data: lead } = await supabase
      .from('leads')
      .select('data')
      .eq('phone', phone)
      .eq('campaign_id', campaignId)
      .single();

    const currentData = lead?.data || {};
    let keyToSave = !currentData.map_type ? 'map_type' : 'map_size';

    await supabase.rpc('update_lead_data', {
      p_phone: phone,
      p_campaign_id: campaignId,
      p_key: keyToSave,
      p_value: lastAnswer
    });
    console.log(`>>> DB Updated: ${keyToSave} = ${lastAnswer}`);
  }

  // 2. בדיקה מה השאלה הבאה שצריך לשאול
  const { data: checkLead } = await supabase
    .from('leads')
    .select('data')
    .eq('phone', phone)
    .eq('campaign_id', campaignId)
    .single();

  const leadData = checkLead?.data || {};
  let question = "";

  if (!leadData.map_type) {
    question = "t-לבחירת מפה ליום חול הקש 1 לבחירת מפה לשבת הקש 2";
  } else if (!leadData.map_size) {
    question = "t-לבחירת מטר הקש 1 למטר וחצי הקש 2 לשני מטר הקש 3";
  }

  // 3. בניית התגובה - ירידת שורה נקייה בלבד בין הפקודות
  let responseText = "";
  if (question) {
    // פקודה 1: השמעת השאלה | פקודה 2: המתנה להקשה (על טקסט קצר כדי שלא יישבר)
    responseText = `id_list_message=${question}\nread=t- . =no,1,1,10,digits,no,no`;
  } else {
    responseText = `id_list_message=t-תודה רבה בחירתך נשמרה בהצלחה\nhangup=yes`;
  }

  console.log(">>> Final Clean Response:\n", responseText);

  // החזרה של הטקסט ללא שום רווחים מיותרים בהתחלה או בסוף
  return new Response(responseText.trim(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}