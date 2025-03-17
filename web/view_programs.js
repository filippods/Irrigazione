// view_programs.js

// Verifica se debounceTimeout è già stato dichiarato
if (typeof debounceTimeout === 'undefined') {
    var debounceTimeout = null;
}

function debounce(callback, delay) {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(callback, delay);
}

// Funzione per caricare user_settings e program.json
function loadUserSettingsAndPrograms() {
    // Carica le impostazioni utente per ottenere i nomi delle zone
    fetch('/data/user_settings.json')
        .then(response => {
            if (!response.ok) throw new Error('Errore nel caricamento delle impostazioni utente');
            return response.json();
        })
        .then(userSettings => {
            const zones = userSettings.zones;

            // Carica anche i programmi
            return fetch('/data/program.json')
                .then(response => {
                    if (!response.ok) throw new Error('Errore nel caricamento dei programmi');
                    return response.json();
                })
                .then(programs => fetch('/get_program_state')
                    .then(response => {
                        if (!response.ok) throw new Error('Errore nel caricamento dello stato del programma');
                        return response.json();
                    })
                    .then(state => ({ programs, state, zones }))
                );
        })
        .then(({ programs, state, zones }) => {
            renderProgramCards(programs, state.current_program_id, zones);
        })
        .catch(error => console.error('Errore nel caricamento dei dati:', error));
}

function renderProgramCards(programs, currentProgramId, zones) {
    const container = document.getElementById('program-container');
    if (!container) {
        console.error("Elemento 'program-container' non trovato nel DOM.");
        return;
    }

    container.innerHTML = '';

    if (Object.keys(programs).length === 0) {
        const noProgramMessage = document.createElement('div');
        noProgramMessage.className = 'no-program-message';
        noProgramMessage.textContent = 'Nessun programma in memoria';
        container.appendChild(noProgramMessage);
        return;
    }

    Object.entries(programs).forEach(([programId, program]) => {
        if (!program.id) {
            program.id = programId;
        }

        const isActive = program.id === currentProgramId;

        const zoneNames = (program.steps || []).map(step => {
            const zone = zones.find(z => z.id === step.zone_id);
            const zoneName = zone ? zone.name : `Zona ${step.zone_id}`;
            return `<li class="active-zone">${zoneName} (${step.duration} min)</li>`;
        }).join('');

        const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
        const monthDisplay = months.map(month => {
            const isActiveMonth = (program.months || []).includes(month);
            return `<li class="${isActiveMonth ? 'active-zone' : 'inactive-zone'}">${month}</li>`;
        }).join('');

        const lastRunDate = program.last_run_date || 'Mai eseguito';

        const programCard = document.createElement('div');
        programCard.className = `program-card ${isActive ? 'active-program' : ''}`;
        programCard.setAttribute('data-program-id', program.id);  // Aggiunto qui
        programCard.innerHTML = `
            <h3 style="background: #0099ff; color: white; padding: 10px; border-radius: 8px;">${program.name}</h3>
            ${isActive ? '<div class="active-indicator">Programma in esecuzione</div>' : ''}
            <div class="section">
                <div class="section-title">Orario di Attivazione:</div>
                <div class="section-content">${program.activation_time}</div>
            </div>
            <div class="section">
                <div class="section-title">Cadenza:</div>
                <div class="section-content">${program.recurrence}</div>
            </div>
            <div class="section">
                <div class="section-title">Ultima Data di Avvio:</div>
                <div class="section-content">${lastRunDate}</div>
            </div>
            <div class="section">
                <div class="section-title">Mesi Attivi</div>
                <ul class="months-list">
                    ${monthDisplay}
                </ul>
            </div>
            <div class="section">
                <div class="section-title">Zone</div>
                <ul class="zone-list">
                    ${zoneNames}
                </ul>
            </div>
            <div class="btn-group">
                <div class="on-off-group">
                    <button class="on-btn ${isActive ? 'active' : 'inactive'}" onclick="startProgram('${program.id}')">ON</button>
                    <button class="off-btn ${isActive ? 'inactive' : 'active'}" onclick="stopProgram()">OFF</button>
                </div>
                <div class="edit-delete-group">
                    <button class="edit-btn" onclick="editProgram('${program.id}')">Modifica</button>
                    <button class="delete-btn" onclick="deleteProgram('${program.id}')">Elimina</button>
                </div>
            </div>
        `;
        container.appendChild(programCard);
    });
}

function initializeViewProgramsPage() {
    loadUserSettingsAndPrograms();
}

document.addEventListener('DOMContentLoaded', initializeViewProgramsPage);

document.addEventListener('DOMContentLoaded', () => {
    // Seleziona tutti i pulsanti ON/OFF dei programmi
    const programToggles = document.querySelectorAll('.program-toggle');

    programToggles.forEach(toggle => {
        toggle.addEventListener('click', event => {
            const programId = event.target.getAttribute('data-program-id');
            const action = event.target.checked ? 'start' : 'stop';

            fetch(`/program/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ program_id: programId })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log(`Programma ${action} con successo.`);
                    // Aggiorna l'interfaccia utente, ad esempio:
                    if (action === 'start') {
                        event.target.classList.add('active');
                    } else {
                        event.target.classList.remove('active');
                    }
                } else {
                    alert(`Errore durante l'${action} del programma.`);
                }
            })
            .catch(error => console.error('Errore:', error));
        });
    });
});

async function startProgram(programId) {
    try {
        // Effettua la richiesta POST per avviare il programma
        const response = await fetch('/start_program', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ program_id: programId })
        });
        const data = await response.json();

        if (!data.success) {
            alert(`Errore nell'avvio del programma: ${data.error}`);
        } else {
            console.log(`Programma ${programId} avviato con successo.`);
            // Aggiorna l'interfaccia utente
            await fetchUpdatedData();
        }
    } catch (error) {
        console.error("Errore di rete durante l'avvio del programma:", error);
        alert("Errore di rete durante l'avvio del programma.");
    }
}


async function fetchUpdatedData() {
    try {
        const userSettingsResponse = await fetch('/data/user_settings.json');
        if (!userSettingsResponse.ok) throw new Error('Errore nel caricamento dei dati di user_settings');
        const userSettings = await userSettingsResponse.json();

        const programsResponse = await fetch('/data/program.json');
        if (!programsResponse.ok) throw new Error('Errore nel caricamento dei programmi');
        const programs = await programsResponse.json();

        const stateResponse = await fetch('/get_program_state');
        if (!stateResponse.ok) throw new Error('Errore nel caricamento dello stato del programma');
        const state = await stateResponse.json();

        renderProgramCards(programs, state.current_program_id, userSettings.zones);
    } catch (error) {
        console.error("Errore durante l'aggiornamento dei dati:", error);
    }
}

function stopProgram() {
    debounce(() => {
        updateUIForProgramStop();

        fetch('/stop_program', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                alert(`Errore nell'arresto del programma: ${data.error}`);
            } else {
                console.log('Programma interrotto con successo.');
            }
            loadUserSettingsAndPrograms();
        })
        .catch(error => {
            console.error("Errore di rete durante l'arresto del programma:", error);
            alert("Errore di rete durante l'arresto del programma.");
        });
    }, 1000);
}

function deleteProgram(programId) {
    if (confirm(`Sei sicuro di voler eliminare il programma ${programId}?`)) {
        fetch('/delete_program', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: programId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadUserSettingsAndPrograms();
            } else {
                alert(`Errore nell'eliminazione del programma: ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Errore di rete durante l\'eliminazione del programma:', error);
            alert('Errore di rete durante l\'eliminazione del programma.');
        });
    }
}

function editProgram(programId) {
    localStorage.setItem('editProgramId', programId);
    loadPage('modify_program.html');
}

function updateUIForProgramStart(programId) {
    document.querySelectorAll('.program-card').forEach(card => {
        const cardProgramId = card.getAttribute('data-program-id');

        if (cardProgramId === programId) {
            card.classList.add('active-program');
            card.querySelector('.on-btn').classList.add('active');
            card.querySelector('.off-btn').classList.remove('active');

            if (!card.querySelector('.active-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'active-indicator';
                indicator.innerText = 'Programma in esecuzione';
                card.prepend(indicator);
            }
        } else {
            card.classList.remove('active-program');
            card.querySelector('.on-btn').classList.remove('active');
            card.querySelector('.off-btn').classList.add('active');

            const indicator = card.querySelector('.active-indicator');
            if (indicator) {
                indicator.remove();
            }
        }
    });
}


function updateUIForProgramStop() {
    document.querySelectorAll('.program-card').forEach(card => {
        card.classList.remove('active-program');
        card.querySelector('.on-btn').classList.remove('active');
        card.querySelector('.off-btn').classList.add('active');

        const indicator = card.querySelector('.active-indicator');
        if (indicator) {
            indicator.remove();
        }
    });
}
