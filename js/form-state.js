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

  const technicianRows = [...form.querySelectorAll('.technician-row')].map((row) => ({
    serviceDate: row.querySelector('[name^="serviceDate"]')?.value || '',
    technician:
      row.querySelector('.technician-select')?.tomselect?.getValue?.() ||
      row.querySelector('.technician-select')?.value ||
      '',
    startTime: row.querySelector('[name^="startTime"]')?.value || '',
    endTime: row.querySelector('[name^="endTime"]')?.value || '',
    totalHours: row.querySelector('[name^="totalHours"]')?.value || '',
  }));

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
    technicianRows,
    serviceDate: technicianRows[0]?.serviceDate || '',
    technician: technicianRows.map((row) => row.technician).filter(Boolean).join(', '),
    startTime: technicianRows[0]?.startTime || '',
    endTime: technicianRows[0]?.endTime || '',
    totalHours: technicianRows[0]?.totalHours || '',
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
