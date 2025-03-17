
function initializeModifyProgramPage() {
    let editingProgram = null;  // Variabile locale, non globale
    fetch('/data/user_settings.json')
        .then(response => response.json())
        .then(userData => {
            const zones = userData.zones;
            const monthsContainer = document.getElementById('months-list');
            const zoneContainer = document.getElementById('zone-list');

            const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
            months.forEach(month => {
                const monthItem = document.createElement('div');
                monthItem.className = 'month-item';
                monthItem.textContent = month;
                monthItem.addEventListener('click', () => {
                    monthItem.classList.toggle('selected');
                });
                monthsContainer.appendChild(monthItem);
            });

            zones.forEach(zone => {
                if (zone.status === "show") {
                    const zoneItem = document.createElement('div');
                    zoneItem.className = 'zone-item';
                    zoneItem.innerHTML = `
                        <span>${zone.name}</span>
                        <input type="number" class="zone-duration" placeholder="Durata (min)" data-zone-id="${zone.id}">
                    `;
                    zoneItem.addEventListener('click', () => {
                        zoneItem.classList.toggle('selected');
                    });
                    zoneContainer.appendChild(zoneItem);
                }
            });

            const programId = localStorage.getItem('editProgramId');
            if (programId) {
                loadProgramForEditing(programId);
            }
        })
        .catch(error => console.error('Errore nel caricamento dei dati utente:', error));
}

function loadProgramForEditing(programId) {
    fetch('/data/program.json')
        .then(response => response.json())
        .then(programs => {
            const program = programs[programId];
            if (!program) return;

            document.getElementById('program-name').value = program.name;
            document.getElementById('start-time').value = program.activation_time;
            document.getElementById('recurrence').value = program.recurrence;

            if (program.recurrence === 'personalizzata') {
                document.getElementById('custom-days-interval').value = program.interval_days;
                toggleDaysSelection();
            }

            // Seleziona i mesi
            program.months.forEach(month => {
                const monthItems = Array.from(document.querySelectorAll('.month-item'));
                const monthItem = monthItems.find(item => item.textContent === month);
                if (monthItem) {
                    monthItem.classList.add('selected');
                }
            });

            // Seleziona le zone e imposta le durate
            program.steps.forEach(step => {
                const zoneItems = Array.from(document.querySelectorAll('.zone-item'));
                const zoneItem = zoneItems.find(item => parseInt(item.querySelector('.zone-duration').dataset.zoneId) === step.zone_id);
                if (zoneItem) {
                    zoneItem.classList.add('selected');
                    zoneItem.querySelector('.zone-duration').value = step.duration;
                }
            });

            editingProgram = programId;
        })
        .catch(error => console.error('Errore nel caricamento del programma:', error));
}

function saveProgram() {
    const programName = document.getElementById('program-name').value.trim();
    const startTime = document.getElementById('start-time').value;
    const recurrence = document.getElementById('recurrence').value;

    // Validazione della lunghezza del nome del programma
    if (programName.length > 16) {
        alert('Il nome del programma non può superare 16 caratteri.');
        return;
    }

    const selectedMonths = Array.from(document.querySelectorAll('.month-item.selected')).map(item => item.textContent);
    const selectedZones = Array.from(document.querySelectorAll('.zone-item.selected')).map(item => {
        const duration = parseInt(item.querySelector('.zone-duration').value);
        if (isNaN(duration) || duration <= 0) {
            alert('Inserisci una durata valida per tutte le zone selezionate.');
            throw new Error('Invalid zone duration');
        }
        return {
            zone_id: parseInt(item.querySelector('.zone-duration').dataset.zoneId),
            duration: duration
        };
    });

    if (!programName || !startTime || selectedMonths.length === 0 || selectedZones.length === 0) {
        alert('Compila tutti i campi e seleziona almeno un mese e una zona.');
        return;
    }

    const updatedProgram = {
        id: editingProgram,
        name: programName,
        activation_time: startTime,
        recurrence: recurrence,
        months: selectedMonths,
        steps: selectedZones
    };

    fetch('/update_program', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProgram)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Programma aggiornato con successo!');
            localStorage.removeItem('editProgramId');
            window.location.href = 'main.html';
        } else {
            alert('Errore durante l\'aggiornamento del programma: ' + data.error);
        }
    })
    .catch(error => console.error('Errore durante l\'aggiornamento:', error));
}

function toggleDaysSelection() {
    const recurrence = document.getElementById('recurrence').value;
    const daysContainer = document.getElementById('days-container');
    daysContainer.style.display = (recurrence === 'personalizzata') ? 'block' : 'none';
}
