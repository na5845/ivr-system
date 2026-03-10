import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  console.log(">>> [START] New request received");
  
  const { searchParams } = new URL(request.url);
  let campaignId = searchParams.get('campaign_id');
  const currentStep = searchParams.get('next_step') || '1';

  // ניקוי ה-ID
  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];
  
  console.log(`>>> [INFO] Campaign: ${campaignId}, Step: ${currentStep}`);

  // בדיקת קיום משתני סביבה (בלי להדפיס את המפתח עצמו)
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.log(">>> [ERROR] Supabase Keys are missing in Vercel!");
    return new Response('id_list_message=t-Environment variables missing\nhangup=yes');
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  try {
    console.log(">>> [DB] Attempting to fetch step...");
    
    const { data, error } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('step_order', parseInt(currentStep))
      .single();

    if (error) {
      console.log(`>>> [DB ERROR] ${error.message}`);
      return new Response(`id_list_message=t-Database error ${error.message}\nhangup=yes`);
    }

    if (!data) {
      console.log(">>> [DB] No data found for this campaign/step");
      return new Response('id_list_message=t-Step not found\nhangup=yes');
    }

    console.log(">>> [SUCCESS] Step found:", data.message_file);
    
    const response = `id_list_message=${data.message_file}\nhangup=yes`;
    console.log(">>> [FINAL] Sending to Yemot:", response);
    
    return new Response(response, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  } catch (err: any) {
    console.log(`>>> [CRASH] Fatal error: ${err.message}`);
    return new Response(`id_list_message=t-Server crash ${err.message}\nhangup=yes`);
  }
}