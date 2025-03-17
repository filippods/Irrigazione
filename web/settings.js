let pollingInterval;  // Variabile globale per gestire il polling
let isPollingActive = false;  // Flag per evitare polling multipli

// Funzione per eseguire il polling dello stato della connessione
function startConnectionStatusPolling() {
    if (!isPollingActive) {
        stopConnectionStatusPolling();  // Ferma eventuali polling precedenti
        pollingInterval = setInterval(() => {
            if (typeof fetchConnectionStatus === 'function') {
                fetchConnectionStatus();
            }
        }, 30000);  // Polling ogni 30 secondi per evitare chiamate troppo frequenti
        isPollingActive = true;
        console.log("Polling avviato");
    }
}

function loadScannedNetworks() {
    fetch('/data/wifi_scan.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('File non trovato');
            }
            return response.json();
        })
        .then(networks => {
            const wifiSelect = document.getElementById('wifi-list');
            wifiSelect.innerHTML = '';  // Svuota il menu a tendina

            if (networks.length === 0) {
                wifiSelect.innerHTML = '<option value="">Nessuna rete trovata</option>';
            } else {
                networks.forEach(network => {
                    const option = document.createElement('option');
                    option.value = network.ssid;
                    option.text = `${network.ssid} (${network.signal})`;
                    wifiSelect.appendChild(option);
                });
            }
        })
        .catch(error => {
            console.error('Errore durante il caricamento delle reti scansionate:', error);
        });
}


function scanWifiNetworks() {
    alert("La connessione verrà temporaneamente interrotta per eseguire la scansione delle reti Wi-Fi.");

    fetch('/scan_wifi', { method: 'GET' })
        .then(response => response.json())
        .then(networks => {
            if (!Array.isArray(networks)) {
                throw new Error('Risposta della scansione Wi-Fi non valida.');
            }

            const wifiSelect = document.getElementById('wifi-list');
            wifiSelect.innerHTML = networks.map(network => 
                `<option value="${network.ssid}">${network.ssid} (${network.signal})</option>`
            ).join('');

            alert("Scansione completata!");
        })
        .catch(error => {
            console.error('Errore durante la scansione delle reti WiFi:', error);
            alert('Errore durante la scansione delle reti WiFi');
        });

    let attempts = 0;
    const maxAttempts = 30; // Tempo totale di 30 secondi
    let scanCompleted = false; // Variabile per tenere traccia del completamento della scansione

    const checkInterval = setInterval(() => {
        if (scanCompleted || attempts >= maxAttempts) {
            clearInterval(checkInterval); // Ferma il ciclo una volta completato
            if (attempts >= maxAttempts) {
                console.error("Tempo esaurito. Non è possibile connettersi all'AP.");
                alert('Tempo esaurito. Non è possibile connettersi all\'AP.');
            }
            return;
        }

        // Tenta di eseguire il fetch di wifi_scan.json
        fetch('/data/wifi_scan.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('File wifi_scan.json non trovato.');
                }
                return response.json();
            })
            .then(networks => {
                // Se riusciamo a fare il fetch, aggiorna la lista
                const wifiSelect = document.getElementById('wifi-list');
                wifiSelect.innerHTML = '';  // Svuota il menu a tendina

                if (networks.length === 0) {
                    wifiSelect.innerHTML = '<option value="">Nessuna rete trovata</option>';
                } else {
                    networks.forEach(network => {
                        const option = document.createElement('option');
                        option.value = network.ssid;
                        option.text = `${network.ssid} (${network.signal})`;
                        wifiSelect.appendChild(option);
                    });
                }

                clearInterval(checkInterval); // Ferma il tentativo di riconnessione una volta riuscito
                scanCompleted = true; // Imposta la bandiera per evitare ulteriori tentativi
                console.log("AP riattivato e reti Wi-Fi scansionate.");
                alert("AP riattivato e reti Wi-Fi scansionate.");
            })
            .catch(() => {
                console.log("Ritento la connessione all'AP...");
                attempts++;
            });
    }, 1000);  // Verifica ogni secondo se l'AP è attivo
}






// Azzera il file wifi_scan.json
function clearWifiScanFile() {
    fetch('/clear_wifi_scan_file', { method: 'POST' })
        .then(response => console.log('File wifi_scan.json azzerato'))
        .catch(error => console.error('Errore durante l\'azzeramento del file wifi_scan.json:', error));
}

// Funzione per fermare il polling dello stato della connessione
function stopConnectionStatusPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;  // Resetta la variabile
        isPollingActive = false;  // Imposta il flag a falso
        console.log("Polling fermato");
    }
}

// Funzione per mostrare o nascondere le impostazioni WiFi Client
function toggleWifiClientSettings(enable) {
    const wifiSettingsElement = document.getElementById('wifi-settings');
    if (enable) {
        wifiSettingsElement.style.display = 'block';  // Mostra le impostazioni client
    } else {
        wifiSettingsElement.style.display = 'none';  // Nascondi le impostazioni client
    }
}


// Rimuovi o commenta queste linee se gli elementi non esistono
// document.getElementById('settings-tab').addEventListener('click', () => {
//     loadUserSettings();
//     startConnectionStatusPolling();
// });

// document.getElementById('other-tab').addEventListener('click', () => {
//     stopConnectionStatusPolling();
// });


document.getElementById('other-tab').addEventListener('click', () => {
    stopConnectionStatusPolling();  // Ferma il polling quando esci dalla scheda
});

document.addEventListener("DOMContentLoaded", () => {
    loadUserSettings();
    document.getElementById('scan-wifi-button').addEventListener('click', scanWifiNetworks);
    console.log("Eseguo fetchConnectionStatus per la prima volta");
    fetchConnectionStatus();
    setTimeout(fetchConnectionStatus, 1000);
    addEventListeners();
    startConnectionStatusPolling();
});

// Listener per il toggle switch del Wi-Fi client
document.getElementById('client-enabled').addEventListener('change', event => {
    const clientEnabled = event.target.checked;

    // Mostra o nascondi le impostazioni WiFi in base al valore del toggle
    toggleWifiClientSettings(clientEnabled);

    // Invio aggiornamento al server
    fetch('/save_user_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_enabled: clientEnabled })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Errore nel salvataggio delle impostazioni.');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log("Impostazione client_enabled salvata con successo.");
            if (clientEnabled) {
                // Chiamata per riconnettere il WiFi se il client è abilitato
                connectToSelectedWifi();
            } else {
                // Disattiva la modalità client
                disconnectWifiClient();
            }
        } else {
            console.error("Errore durante il salvataggio di client_enabled:", data.error);
        }
    })
    .catch(error => {
        console.error('Errore nella richiesta di salvataggio:', error);
    });
});

// Funzione per disconnettere il client Wi-Fi
function disconnectWifiClient() {
    fetch('/disconnect_wifi', { method: 'POST' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Errore nella disconnessione del Wi-Fi client.');
            }
            console.log("Modalità client disattivata.");
        })
        .catch(error => console.error('Errore durante la disattivazione della modalità client:', error));
}

// Event Listeners
function addEventListeners() {
    document.getElementById('client-enabled').addEventListener('change', event => {
        const clientEnabled = event.target.checked;
        toggleWifiClientSettings(clientEnabled);
    });

    document.getElementById('settings-tab').addEventListener('click', () => {
        loadUserSettings();
        startConnectionStatusPolling();  // Avvia il polling quando entri nella scheda Impostazioni
    });

    document.getElementById('other-tab').addEventListener('click', () => {
        stopConnectionStatusPolling();  // Ferma il polling quando esci dalla scheda Impostazioni
    });

    document.getElementById('scan-wifi-button').addEventListener('click', scanWifiNetworks);
    document.getElementById('connect-wifi-button').addEventListener('click', connectToSelectedWifi);
    document.getElementById('save-settings-button').addEventListener('click', saveSettings);

    document.getElementById('restart-button').addEventListener('click', () => {
        if (confirm('Sei sicuro di voler riavviare il dispositivo?')) {
            fetch('/restart_system', { method: 'POST' })
                .then(handleResponse)
                .then(() => alert('Riavvio del sistema in corso...'))
                .catch(error => console.error('Errore durante il riavvio del sistema:', error));
        }
    });

    document.getElementById('reset-settings-button').addEventListener('click', () => {
        if (confirm('Sei sicuro di voler resettare le impostazioni?')) {
            fetch('/reset_settings', { method: 'POST' })
                .then(handleResponse)
                .then(() => window.location.reload())
                .catch(error => console.error('Errore durante il reset delle impostazioni:', error));
        }
    });

    document.getElementById('reset-factory-button').addEventListener('click', () => {
        if (confirm('Sei sicuro di voler resettare i dati di fabbrica? Tutti i programmi verranno cancellati.')) {
            fetch('/reset_factory_data', { method: 'POST' })
                .then(handleResponse)
                .then(() => window.location.reload())
                .catch(error => console.error('Errore durante il reset dei dati di fabbrica:', error));
        }
    });
}

// Funzione per connettersi alla rete Wi-Fi selezionata
function connectToSelectedWifi() {
    const ssid = document.getElementById('wifi-list').value;
    const password = document.getElementById('wifi-password').value;

    if (!ssid || !password) {
        alert('Inserisci SSID e password.');
        return;
    }

    fetch('/connect_wifi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid, password })
    })
    .then(handleResponse)
    .then(data => {
        if (data.success) {
            alert(`Connesso alla rete WiFi con IP: ${data.ip}`);
            fetchConnectionStatus(); // Aggiorna lo stato della connessione dopo il tentativo di connessione
        } else {
            alert('Errore durante la connessione: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Errore durante la connessione Wi-Fi:', error);
        alert('Errore durante la connessione Wi-Fi');
    });
}

// Funzione per gestire le risposte del server
function handleResponse(response) {
    if (!response.ok) {
        throw new Error('Errore nel caricamento dei dati dal server');
    }
    return response.json();
}



// Funzione per caricare le impostazioni utente dal server
function loadUserSettings() {
    fetch('/data/user_settings.json')
        .then(handleResponse)
        .then(userData => {
            // Popola il toggle switch basandosi su client_enabled
            const clientEnabledCheckbox = document.getElementById('client-enabled');
            clientEnabledCheckbox.checked = userData.client_enabled || false;  // imposta il valore del toggle

            // Aggiorna la visibilità delle impostazioni Wi-Fi
            toggleWifiClientSettings(userData.client_enabled);
            
            // Popola le altre impostazioni (SSID, password, ecc.)
            document.getElementById('wifi-list').value = userData.wifi?.ssid || '';
            document.getElementById('wifi-password').value = userData.wifi?.password || '';
            document.getElementById('ap-ssid').value = userData.ap?.ssid || '';
            document.getElementById('ap-password').value = userData.ap?.password || '';
        })
        .catch(error => console.error('Errore nel caricamento delle impostazioni utente:', error));
}

function fetchConnectionStatus() {
    setTimeout(() => {
        fetch('/get_connection_status')
            .then(handleResponse)
            .then(updateConnectionStatus)
            .catch(error => {
                console.error("Errore durante l'ottenimento dello stato della connessione:", error);
                alert("Impossibile ottenere lo stato della connessione. Verifica la connessione al server.");
            });
    }, 15000);  // Imposta un timeout di 15 secondi
}




// Funzione per gestire le risposte del server
function handleResponse(response) {
    if (!response.ok) {
        throw new Error('Errore nel caricamento dei dati dal server');
    }
    return response.json();
}


// Funzione per inizializzare la pagina delle impostazioni
function initializeSettingsPage(userData) {
    // Popola le impostazioni WiFi Client e AP
    const clientEnabledCheckbox = document.getElementById('client-enabled');
    clientEnabledCheckbox.checked = userData.client_enabled || false;
    toggleWifiClientSettings(userData.client_enabled);

    document.getElementById('wifi-list').value = userData.wifi?.ssid || '';
    document.getElementById('wifi-password').value = userData.wifi?.password || '';
    document.getElementById('ap-ssid').value = userData.ap?.ssid || '';
    document.getElementById('ap-password').value = userData.ap?.password || '';

    // Popola le impostazioni delle zone
    initializeZoneSettings(userData.zones);

    // Popola le impostazioni avanzate
    document.getElementById('max-active-zones').value = userData.max_active_zones || 1;
    document.getElementById('activation-delay').value = userData.activation_delay || 0;
    document.getElementById('safety-relay-pin').value = userData.safety_relay?.pin || '';
    document.getElementById('automatic-programs-enabled').checked = userData.automatic_programs_enabled || false;
}

// Funzione per inizializzare le impostazioni delle zone
function initializeZoneSettings(zones = []) {
    const zoneList = document.getElementById('zone-list');
    zoneList.innerHTML = '';

    zones.forEach((zone, index) => {
        const zoneCard = document.createElement('div');
        zoneCard.className = 'zone-card';
        zoneCard.innerHTML = `
            <h4 style="text-align: center; font-weight: bold;">Zona ${index + 1}</h4>
            <div class="input-group">
                <label>Nome:</label>
                <input type="text" value="${zone.name || ''}" data-zone-id="${zone.id || ''}" class="zone-name" maxlength="16">
            </div>
            <div class="input-group">
                <label>PIN:</label>
                <input type="number" value="${zone.pin || ''}" data-zone-id="${zone.id || ''}" class="zone-pin">
            </div>
            <div class="input-group">
                <select data-zone-id="${zone.id || ''}" class="zone-status">
                    <option value="show" ${zone.status === 'show' ? 'selected' : ''}>Mostra</option>
                    <option value="hide" ${zone.status === 'hide' ? 'selected' : ''}>Nascondi</option>
                </select>
            </div>
        `;
        zoneList.appendChild(zoneCard);
    });
}

// Funzione per attivare la modalità AP
function activateAccessPoint() {
    fetch('/activate_ap', { method: 'POST' })
    .then(handleResponse)
    .then(() => {
        console.log("Modalità Access Point attivata.");
    })
    .catch(error => {
        console.error('Errore durante l\'attivazione della modalità AP:', error);
    });
}


// Funzione per connettersi alla rete WiFi selezionata
function connectToSelectedWifi() {
    const ssid = document.getElementById('wifi-list').value;
    const password = document.getElementById('wifi-password').value;

    if (!ssid || !password) {
        alert('Inserisci SSID e password.');
        return;
    }

    fetch('/connect_wifi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid, password })
    })
    .then(handleResponse)
    .then(data => {
        if (data.success) {
            alert(`Connesso alla rete WiFi con IP: ${data.ip}`);
            fetchConnectionStatus(); // Aggiorna lo stato della connessione dopo il tentativo di connessione
        } else {
            alert('Errore durante la connessione: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Errore durante la connessione Wi-Fi:', error);
        alert('Errore durante la connessione Wi-Fi');
    });
}

// Funzione per aggiornare lo stato della connessione
function updateConnectionStatus(status) {
    const connectionStatusElement = document.getElementById('connection-status');
    let connectionInfo = '';

    if (status.mode === 'client') {
        connectionInfo = `
            <strong>Modalità di connessione attuale:</strong> Client<br>
            <strong>SSID:</strong> ${status.ssid}<br>
            <strong>IP:</strong> ${status.ip}`;
    } else if (status.mode === 'AP') {
        connectionInfo = `
            <strong>Modalità di connessione attuale:</strong> Access Point (AP)<br>
            <strong>SSID:</strong> ${status.ssid}<br>
            <strong>IP:</strong> ${status.ip}`;
    } else {
        connectionInfo = 'Nessuna connessione attiva.';
    }

    connectionStatusElement.innerHTML = connectionInfo;
    connectionStatusElement.style.display = 'block';
}





// Funzione per salvare tutte le impostazioni
function saveSettings() {
    try {
        const zones = Array.from(document.querySelectorAll('.zone-card')).map(zoneCard => {
            const name = zoneCard.querySelector('.zone-name').value.trim();
            if (name.length > 16) {
                throw new Error('Il nome della zona non può superare 16 caratteri.');
            }
            return {
                id: parseInt(zoneCard.querySelector('.zone-pin').getAttribute('data-zone-id')),
                pin: parseInt(zoneCard.querySelector('.zone-pin').value),
                status: zoneCard.querySelector('.zone-status').value,
                name: name
            };
        });

        const settings = {
            client_enabled: document.getElementById('client-enabled').checked,
            wifi: {
                ssid: document.getElementById('wifi-list').value,
                password: document.getElementById('wifi-password').value
            },
            ap: {
                ssid: document.getElementById('ap-ssid').value,
                password: document.getElementById('ap-password').value
            },
            zones: zones,
            max_active_zones: parseInt(document.getElementById('max-active-zones').value),
            activation_delay: parseInt(document.getElementById('activation-delay').value),
            safety_relay: {
                pin: parseInt(document.getElementById('safety-relay-pin').value)
            },
            automatic_programs_enabled: document.getElementById('automatic-programs-enabled').checked
        };

        fetch('/save_user_settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        })
        .then(handleResponse)
        .then(() => {
            alert('Impostazioni salvate con successo!');
            fetchConnectionStatus(); // Aggiorna lo stato della connessione dopo aver salvato le impostazioni
        })
        .catch(error => console.error('Errore durante il salvataggio delle impostazioni:', error));
    } catch (error) {
        console.error('Errore durante la validazione delle impostazioni:', error);
    }
}


// Aggiungi questo chiamando la funzione per aggiornare il menu a tendina
document.getElementById('scan-wifi-button').addEventListener('click', function() {
    clearWifiScanFile(); // Azzera il file prima di scansionare
    scanWifiNetworks(); // Chiama la funzione per scansionare
    setTimeout(loadScannedNetworks, 5000);  // Ricarica il menu dopo 5 secondi
});