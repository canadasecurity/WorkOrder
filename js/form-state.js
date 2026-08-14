/** Collect all form field values into a plain object. */
export function collectFormState(form) {
  const materials = [];
  for (let i = 1; i <= 10; i++) {
    materials.push({
      qty: form.querySelector(`[name="material_qty_${i}"]`)?.value.trim() || '',
      name:
        form.querySelector(`[name="material_name_${i}"]`)?.value.trim() || '',
    });
  }

  const addressSelectEl = form.querySelector('#addressSelect');
  const addressId =
    addressSelectEl?.tomselect?.getValue?.() || addressSelectEl?.value || '';
  let addressText = '';
  if (addressId && addressSelectEl?.tomselect) {
    const opt = addressSelectEl.tomselect.options[addressId];
    addressText = opt?.text || '';
  } else if (addressSelectEl?.selectedOptions?.[0]?.value) {
    addressText = addressSelectEl.selectedOptions[0].textContent.trim();
  }

  const corpSelectEl = form.querySelector('#corpNoSelect');
  const corporationNo =
    form.querySelector('#corporationNo')?.value.trim() ||
    corpSelectEl?.tomselect?.getValue?.() ||
    corpSelectEl?.value.trim() ||
    '';

  return {
    workOrderNumber:
      document.querySelector('#workOrderNumber')?.textContent?.trim() || '',
    clientName: form.querySelector('#clientName')?.value.trim() || '',
    customerId: addressId,
    corporationNo,
    address: addressText,
    poNumber: form.querySelector('#poNumber')?.value.trim() || '',
    date: form.querySelector('#formDate')?.value || '',
    recommendation: form.querySelector('#recommendation')?.value.trim() || '',
    jobDescription: form.querySelector('#jobDescription')?.value.trim() || '',
    materials,
    serviceDate: form.querySelector('#serviceDate')?.value || '',
    technician:
      form.querySelector('#technician')?.tomselect?.getValue?.() ||
      form.querySelector('#technician')?.value ||
      '',
    startTime: form.querySelector('#startTime')?.value || '',
    endTime: form.querySelector('#endTime')?.value || '',
    totalHours: form.querySelector('#totalHours')?.value || '',
    technicianSignature:
      document
        .getElementById('technicianSignatureCanvas')
        ?.getSignatureDataUrl?.() || '',
    customerName: form.querySelector('#customerName')?.value.trim() || '',
    customerSignature:
      document
        .getElementById('customerSignatureCanvas')
        ?.getSignatureDataUrl?.() || '',
  };
}

export function saveFormState(state) {
  sessionStorage.setItem('wo_form_state', JSON.stringify(state));
}

export function loadFormState() {
  const raw = sessionStorage.getItem('wo_form_state');
  return raw ? JSON.parse(raw) : null;
}
