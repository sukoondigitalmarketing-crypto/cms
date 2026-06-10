(async()=>{
  const fetch = globalThis.fetch || (await import('node-fetch')).default;
  const token = '2f11076d587ee8b35976aee5e1e10e649e144b8c102c0ffbde677778b40dc5c9';
  const ids = [20,25];
  for (const id of ids) {
    const r = await fetch('http://localhost:3000/api/procurement/po/' + id, { headers: { 'Authorization': 'Bearer ' + token } });
    const obj = await r.json();
    console.log('--- PO', id, '---');
    const projectName = obj.project_name || 'General Inventory';
    let message = `Project: ${projectName}\n\n`;
    message += `PO Number: ${obj.po_number}\n\n`;
    message += `Required Materials:\n\n`;
    if (obj.items && obj.items.length > 0) {
      obj.items.forEach(it => {
        const unit = it.unit || 'Nos';
        message += `• ${it.item_name} - ${it.quantity} ${unit}\n`;
      });
    }
    message += `\nKindly confirm availability and delivery schedule.`;
    console.log(message);
    console.log('ENCODED:', encodeURIComponent(message));
  }
})();
