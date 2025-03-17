if (typeof maxActiveZones === 'undefined') {
    var maxActiveZones = 0;
}

if (typeof activeZonesCount === 'undefined') {
    var activeZonesCount = 0;
}

if (typeof progressIntervals === 'undefined') {
    var progressIntervals = {};
}




// Carica il valore massimo di zone attive da user_settings.json
fetch('/data/user_settings.json')
    .then(response => {
        if (!response.ok) {
            throw new Error('Errore nel caricamento delle impostazioni utente');
        }
        return response.json();
    })
    .then(data => {
        maxActiveZones = data.max_active_zones || 0;
    })
    .catch(error => console.error('Errore nel caricamento delle impostazioni utente:', error));

function initializeManualPage(userData) {
    const zones = userData.zones;
    const container = document.getElementById('zone-container');

    container.innerHTML = '';

    zones.forEach(zone => {
        if (zone.status === "show") {
            const zoneCard = document.createElement('div');
            zoneCard.className = 'zone-card';
            zoneCard.id = `zone-${zone.id}`;
            zoneCard.innerHTML = `
                <h3>${zone.name}</h3>
                <div class="input-container">
                    <input type="number" id="duration-${zone.id}" placeholder="Durata (minuti)" max="300">
                    <div class="toggle-switch">
                        <label class="switch">
                            <input type="checkbox" id="toggle-${zone.id}" class="zone-toggle" data-zone-id="${zone.id}">
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div class="progress-wrapper">
                    <progress id="progress-${zone.id}" value="0" max="100"></progress>
                    <div class="progress-timer" id="timer-${zone.id}">00:00</div>
                </div>
            `;
            container.appendChild(zoneCard);
        }
    });

    // Attach event listeners after elements are added to the DOM
    attachZoneToggleFunctions();
}




    document.querySelectorAll('.stop-btn').forEach(button => {
        button.addEventListener('click', () => stopZone(button.dataset.zoneId));
    });

function startProgressBar(zoneId, duration) {
    const progressBar = document.getElementById(`progress-${zoneId}`);
    const timerDisplay = document.getElementById(`timer-${zoneId}`);
    const totalTime = duration * 60;
    let elapsedTime = 0;

    if (progressIntervals[zoneId]) {
        clearInterval(progressIntervals[zoneId]);
    }

    updateTimerDisplay(totalTime, timerDisplay); // Mostra il tempo iniziale in mm:ss

    progressIntervals[zoneId] = setInterval(() => {
        elapsedTime++;
        progressBar.value = (elapsedTime / totalTime) * 100;
        const remainingTime = totalTime - elapsedTime;
        updateTimerDisplay(remainingTime, timerDisplay); // Aggiorna il display in formato mm:ss

        if (elapsedTime >= totalTime) {
            clearInterval(progressIntervals[zoneId]);
            progressBar.value = 0;
            timerDisplay.textContent = '00:00';
            updateButtonState(zoneId, false);
        }
    }, 1000);
}

function updateTimerDisplay(timeInSeconds, displayElement) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    displayElement.textContent = formattedTime;
}

function resetProgressBar(zoneId) {
    const progressBar = document.getElementById(`progress-${zoneId}`);
    const timerDisplay = document.getElementById(`timer-${zoneId}`);

    if (progressIntervals[zoneId]) {
        clearInterval(progressIntervals[zoneId]);
    }

    progressBar.value = 0;
    timerDisplay.textContent = '00:00';
}

function updateButtonState(zoneId, isActive) {
    const toggle = document.getElementById(`toggle-${zoneId}`);
    toggle.checked = isActive;
}

function startZone(zoneId, duration) {
    console.log(`Avvio zona ${zoneId} per ${duration} minuti`);

    fetch('/start_zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId, duration: duration })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.status === 'Zona avviata') {
            console.log(`Zona ${zoneId} avviata per ${duration} minuti.`);
        } else {
            console.error('Errore durante l\'avvio della zona:', data.error);
            alert('Errore durante l\'avvio della zona.');
        }
    })
    .catch(error => {
        console.error('Errore durante l\'avvio della zona:', error);
        alert(`Errore durante l'avvio della zona: ${error.message}`);
    });
}



function stopZone(zoneId) {
    fetch('/stop_zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'Zona arrestata') {
            console.log(`Zona ${zoneId} arrestata.`);
            resetProgressBar(zoneId);
        } else {
            alert('Errore durante l\'arresto della zona.');
            startProgressBar(zoneId, 0); // Aggiorna correttamente lo stato
        }
    })
    .catch(error => {
        console.error('Errore:', error);
        startProgressBar(zoneId, 0);
    });
}





document.addEventListener('DOMContentLoaded', () => {
    // Load user settings and initialize the page
    fetch('/data/user_settings.json')
        .then(response => response.json())
        .then(userData => {
            maxActiveZones = userData.max_active_zones || 0;
            initializeManualPage(userData);
        })
        .catch(error => console.error('Errore nel caricamento delle impostazioni utente:', error));
});




function attachZoneToggleFunctions() {
    const zoneToggles = document.querySelectorAll('.zone-toggle');
    console.log('Number of zone toggles found:', zoneToggles.length);

    zoneToggles.forEach(toggle => {
        toggle.addEventListener('change', event => {
            console.log('Toggle changed:', event.target);
            const zoneId = event.target.getAttribute('data-zone-id');
            if (event.target.checked) {
                // Get duration from associated input
                const durationInput = document.getElementById(`duration-${zoneId}`);
                const duration = parseInt(durationInput.value);

                if (isNaN(duration) || duration <= 0) {
                    alert('Inserisci una durata valida in minuti.');
                    event.target.checked = false;
                    return;
                }

                // Start the zone
                startZone(zoneId, duration);
                // Start the progress bar
                startProgressBar(zoneId, duration);
            } else {
                // Stop the zone
                stopZone(zoneId);
                // Reset the progress bar
                resetProgressBar(zoneId);
            }
        });
    });
}





