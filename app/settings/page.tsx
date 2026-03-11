async function addStep(formData: FormData) {
    'use server';
    
    const type = formData.get('type') as string;
    const isAudio = formData.get('isAudio') === 'true';
    const messageContent = formData.get('messageContent') as string;
    const rawOptions = formData.get('options') as string;
    
    console.log('>>> ADD STEP INITIATED');
    console.log(`Type: ${type}, Raw Options: "${rawOptions}"`);

    // תרגום הטקסט (למשל "1:שבתי, 2:חול") לאובייקט JSON תקין
    let optionsObj: Record<string, string> = {};
    
    if (type === 'choice' && rawOptions && rawOptions.trim() !== '') {
      rawOptions.split(',').forEach(pair => {
        const parts = pair.split(':');
        if (parts.length === 2) {
          const key = parts[0].trim();
          const val = parts[1].trim();
          if (key && val) {
            optionsObj[key] = val;
          }
        }
      });
      console.log('>>> Parsed Options:', optionsObj);
    }

    const stepOrder = (steps?.length || 0) + 1;
    const autoDataKey = `step_${stepOrder}`; 

    let minD = 1, maxD = 1;
    if (type === 'id') { minD = 9; maxD = 9; }
    else if (type === 'phone') { minD = 10; maxD = 10; }
    else if (type === 'date') { minD = 8; maxD = 8; } 
    else if (type === 'number' || type === 'digits') { minD = 1; maxD = 15; }

    const payload = {
      campaign_id: CAMPAIGN_ID,
      step_order: stepOrder,
      data_key: autoDataKey,
      message_content: messageContent,
      is_audio: isAudio,
      question_type: type,
      min_digits: minD,
      max_digits: maxD,
      options: optionsObj // שליחת האובייקט (או אובייקט ריק אם לא הוזן כלום)
    };

    console.log('>>> DB Payload:', JSON.stringify(payload, null, 2));

    const { error } = await supabase.from('campaign_steps').insert([payload]);
    
    if (error) {
      console.error('>>> DB INSERT ERROR:', error);
    } else {
      console.log('>>> STEP ADDED SUCCESSFULLY');
    }

    revalidatePath('/settings');
  }