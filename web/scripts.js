// scripts.js

let isLoadingPage = false;
let userData = {};

// Funzione per caricare i dati da user_settings.json una sola volta
function loadUserData(callback) {
    fetch('/data/user_settings.json')
        .then(response => {
            if (!response.ok) throw new Error('Errore nel caricamento dei dati di user_settings');
            return response.json();
        })
        .then(data => {
            userData = data;
            if (callback) callback();
        })
        .catch(error => console.error('Errore nel caricamento dei dati di user_settings:', error));
}

function loadPage(page, callback) {
    if (isLoadingPage) return;
    isLoadingPage = true;

    fetch(page)
        .then(response => {
            if (!response.ok) throw new Error('Errore nel caricamento della pagina');
            return response.text();
        })
        .then(html => {
            const contentElement = document.getElementById('content');
            if (contentElement) {
                contentElement.innerHTML = html;

                // Ferma il polling prima di caricare qualsiasi altra pagina
                if (typeof stopConnectionStatusPolling === 'function') {
                    stopConnectionStatusPolling();  // Ferma il polling se la funzione è definita
                }

                // Carica gli script associati alla pagina
                switch (page) {
                    case 'manual.html':
                        loadScript('manual.js', () => {
                            if (typeof initializeManualPage === 'function') {
                                initializeManualPage(userData);
                            }
                        });
                        break;
                    case 'create_program.html':
                        loadScript('create_program.js', () => {
                            if (typeof initializeCreateProgramPage === 'function') {
                                initializeCreateProgramPage();
                            }
                        });
                        break;
                    case 'modify_program.html':
                        loadScript('modify_program.js', () => {
                            if (typeof initializeModifyProgramPage === 'function') {
                                initializeModifyProgramPage();
                            }
                        });
                        break;
                    case 'settings.html':
                        loadScript('settings.js', () => {
                            if (typeof initializeSettingsPage === 'function') {
                                initializeSettingsPage(userData);
                            }
                            // Avvia il polling dello stato della connessione solo se sei nella pagina Impostazioni
                            if (typeof startConnectionStatusPolling === 'function') {
                                startConnectionStatusPolling();
                            }
                        });
                        break;
                    case 'view_programs.html':
                        loadScript('view_programs.js', () => {
                            if (typeof initializeViewProgramsPage === 'function') {
                                initializeViewProgramsPage();
                            }
                        });
                        break;
                }

                if (callback && typeof callback === 'function') {
                    callback();
                }
            } else {
                console.error("Elemento con ID 'content' non trovato.");
            }
        })
        .catch(error => console.error('Errore nel caricamento della pagina:', error))
        .finally(() => {
            isLoadingPage = false;
        });
}


// Funzione per caricare uno script
function loadScript(url, callback) {
    const script = document.createElement('script');
    script.src = url;
    script.onload = callback;
    document.head.appendChild(script);
}

function toggleMenu() {
    const menu = document.getElementById('menu');
    menu.classList.toggle('active');
}

function closeMenu() {
    const menu = document.getElementById('menu');
    menu.classList.remove('active');
}

function updateDateTime() {
    const dateElement = document.getElementById('date');
    const timeElement = document.getElementById('time');

    const now = new Date();
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const formattedDate = now.toLocaleDateString('it-IT', options);
    const formattedTime = now.toLocaleTimeString('it-IT');

    if (dateElement) dateElement.textContent = formattedDate;
    if (timeElement) timeElement.textContent = formattedTime;
}

function initializePage() {
    updateDateTime();
    setInterval(updateDateTime, 1000);

    loadUserData(() => {
        loadPage('manual.html');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Inizializza la pagina principale
    initializePage();

    // Gestisci i click sui link di navigazione dopo che il DOM è completamente caricato
    const navCreate = document.getElementById('nav-create');
    const navView = document.getElementById('nav-view');

    // Verifica che gli elementi esistano prima di aggiungere il listener
    if (navCreate) {
        navCreate.addEventListener('click', (e) => {
            e.preventDefault();
            loadPage('create_program.html');
        });
    }

    if (navView) {
        navView.addEventListener('click', (e) => {
            e.preventDefault();
            loadPage('view_programs.html');
        });
    }

    // Gestisci il menù
    document.querySelectorAll('.menu li').forEach(item => {
        item.addEventListener('click', (event) => {
            const targetPage = event.target.dataset.page;
            loadPage(targetPage);
            closeMenu();
        });
    });

    // Aggiungi listener per chiudere il menu quando si clicca altrove
    document.body.addEventListener('click', (e) => {
        const menu = document.getElementById('menu');
        const menuIcon = document.querySelector('.menu-icon');

        // Chiudi il menu solo se è attivo e il clic non è sul menu o sull'icona del menu
        if (menu.classList.contains('active') && !menu.contains(e.target) && !menuIcon.contains(e.target)) {
            closeMenu();
        }
    });
});

// Funzione per fermare tutti i programmi in esecuzione
function stopAllPrograms() {
    fetch('/stop_program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Arresto totale eseguito con successo.');
        } else {
            alert(`Errore durante l'arresto totale: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Errore di rete durante l\'arresto totale:', error);
        alert('Errore di rete durante l\'arresto totale.');
    });
}

