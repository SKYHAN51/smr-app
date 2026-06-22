(async function () {
  // 1. Get patient UUID from URL ?p= parameter
  const patientId = new URLSearchParams(window.location.search).get('p');

  // 2. show(id) helper: hide all screens, then show the requested one
  function show(id) {
    ['loading', 'error', 'app'].forEach(function (screenId) {
      var el = document.getElementById(screenId);
      if (el) el.classList.add('hidden');
    });
    var target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
  }

  if (typeof CONFIG === 'undefined') { show('error'); return; }

  // 3. If no patientId → show error and bail
  if (!patientId) {
    show('error');
    return;
  }

  // 4. Fetch patient data from Supabase
  var url = CONFIG.supabaseUrl + '/rest/v1/smr_patients'
    + '?id=eq.' + encodeURIComponent(patientId)
    + '&select=naam,start_datum,sigaretten_per_dag,non_response_count';

  var response;
  try {
    response = await fetch(url, {
      headers: {
        'apikey': CONFIG.supabaseAnonKey,
        'Authorization': 'Bearer ' + CONFIG.supabaseAnonKey
      }
    });
  } catch (e) {
    show('error');
    return;
  }

  if (!response.ok) { show('error'); return; }

  var data;
  try {
    data = await response.json();
  } catch (e) {
    show('error');
    return;
  }

  if (!Array.isArray(data) || data.length === 0) {
    show('error');
    return;
  }

  var patient = data[0];

  // 5. Calculate stats
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var startDate = new Date(patient.start_datum);
  startDate.setHours(0, 0, 0, 0);
  var days = Math.max(0, Math.floor((today - startDate) / 86400000));
  var cigarettes = days * patient.sigaretten_per_dag;
  var moneyRaw = (cigarettes * 0.45).toFixed(2);
  // Format as Dutch: dots for thousands, comma for decimal
  var moneyFormatted = '€' + parseFloat(moneyRaw).toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  // 6. Render to DOM
  var firstName = (patient.naam || '').split(' ')[0] || 'daar';
  document.getElementById('naam').textContent = firstName;
  document.getElementById('days').textContent = days;
  document.getElementById('cigarettes').textContent = cigarettes.toLocaleString('nl-NL');
  document.getElementById('money').textContent = moneyFormatted;

  // 7. Next contact calculation
  var followUpDays = [7, 14, 30, 60, 90];
  var nextDay = null;
  for (var i = 0; i < followUpDays.length; i++) {
    if (followUpDays[i] > days) {
      nextDay = followUpDays[i];
      break;
    }
  }
  var nextContactEl = document.getElementById('next-contact');
  if (nextDay !== null) {
    var daysUntil = nextDay - days;
    nextContactEl.textContent = '📅 Volgende contact: dag ' + nextDay + ' · over ' + daysUntil + ' dag' + (daysUntil === 1 ? '' : 'en');
  } else {
    nextContactEl.textContent = '✅ Programma voltooid — gefeliciteerd!';
  }

  // 8. Show the app
  show('app');

  // 9. Mood button interaction
  var selectedMood = null;
  var moodButtons = document.querySelectorAll('.mood-btn');
  var submitBtn = document.getElementById('submit-btn');

  moodButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      moodButtons.forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      selectedMood = btn.dataset.mood;
      submitBtn.classList.remove('hidden');
    });
  });

  // 10. Submit handler
  submitBtn.addEventListener('click', async function () {
    if (!selectedMood) return;

    var messageEl = document.getElementById('message');
    var message = messageEl ? messageEl.value.trim() : '';

    submitBtn.disabled = true;
    var originalText = submitBtn.textContent.trim();
    submitBtn.textContent = 'Versturen...';

    var errMsg = document.getElementById('submit-error');
    if (errMsg) errMsg.classList.add('hidden');

    // POST mood event to Supabase
    var eventBody = JSON.stringify({
      patient_id: patientId,
      event_type: 'patient_mood',
      notes: selectedMood + '|' + message
    });

    try {
      var eventResponse = await fetch(CONFIG.supabaseUrl + '/rest/v1/smr_events', {
        method: 'POST',
        headers: {
          'apikey': CONFIG.supabaseAnonKey,
          'Authorization': 'Bearer ' + CONFIG.supabaseAnonKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: eventBody
      });

      if (!eventResponse.ok) {
        throw new Error('Supabase error: ' + eventResponse.status);
      }

      // Non-blocking: fire n8n mood webhook for risk score update
      fetch(CONFIG.moodWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          mood: selectedMood,
          message: message
        })
      }).catch(function () {});

      // Success: hide mood card, show success card
      var moodCard = document.querySelector('.mood-card');
      if (moodCard) moodCard.classList.add('hidden');
      var successCard = document.getElementById('success-card');
      if (successCard) successCard.classList.remove('hidden');

    } catch (err) {
      const errMsgEl = document.getElementById('submit-error');
      if (errMsgEl) errMsgEl.classList.remove('hidden');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });

})();
