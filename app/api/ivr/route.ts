import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let campaignId = searchParams.get('campaign_id');
  if (campaignId?.includes('?')) campaignId = campaignId.split('?')[0];

  const { data: step } = await supabase
    .from('campaign_steps')
    .select('message_file')
    .eq('campaign_id', campaignId)
    .eq('step_order', 1)
    .single();

  const msg = step?.message_file || 't-no data';
  
  // מחזירים פקודה אחת פשוטה מאוד בשורה אחת
  return new Response(`id_list_message=${msg}&hangup=yes`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}