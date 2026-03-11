import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('ApiPhone');
  let campaignId = searchParams.get('campaign_id');
  const lastAnswer = searchParams.get('ApiEnter');

  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  if (!phone || !campaignId) return new Response('hangup=yes');

  console.log(`>>> Phone: ${phone} | ApiEnter: ${lastAnswer}`);

  // 1. שמירת ההקשה ב-DB
  if (lastAnswer && lastAnswer !== 'null' && lastAnswer !== '') {
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
    console.log(`>>> Saved: ${keyToSave} = ${lastAnswer}`);
  }

  // 2. בדיקה מול ה-DB לדעת מה חסר
  const { data: checkLead } = await supabase
    .from('leads')
    .select('data')
    .eq('phone', phone)
    .eq('campaign_id', campaignId)
    .single();

  const leadData = checkLead?.data || {};
  
  // 3. פקודת read מושלמת - 7 פרמטרים חוקיים בלבד!
  let responseText = "";
  if (!leadData.map_type) {
    responseText = "read=t-לבחירת מפה ליום חול הקש 1 לבחירת מפה לשבת הקש 2=no,1,1,10,no,no,no";
  } else if (!leadData.map_size) {
    responseText = "read=t-לבחירת מטר הקש 1 למטר וחצי הקש 2 לשני מטר הקש 3=no,1,1,10,no,no,no";
  } else {
    // שלב הסיום
    responseText = "id_list_message=t-תודה רבה בחירתך נשמרה בהצלחה&hangup=yes";
  }

  console.log(`>>> Sending: ${responseText}`);

  return new Response(responseText, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}