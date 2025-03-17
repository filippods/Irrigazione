from microdot import Request, Microdot, Response, send_file
import uasyncio as asyncio
from zone_manager import start_zone, stop_zone


# Aggiungi subito dopo l'importazione queste stampe:
print(f"Tipo di 'start_zone' dopo l'importazione: {type(start_zone)}")
print(f"Tipo di 'stop_zone' dopo l'importazione: {type(stop_zone)}")

from settings_manager import (
    load_user_settings,
    save_user_settings,
    reset_user_settings,
    reset_factory_data,
    )
from program_manager import (
    load_programs,
    save_programs,
    stop_program,
    update_program,
    delete_program,
    execute_program,
    load_program_state,
    program_running
    )
from wifi_manager import start_access_point, clear_wifi_scan_file, save_wifi_scan_results

import network
import ujson
import uos
import time

html_base_path = '/web'
data_base_path = '/data'
wifi_scan_file = '/data/wifi_scan.json'


app = Microdot()
Request.max_content_length = 1024 * 1024

@app.route('/data/wifi_scan.json', methods=['GET'])
def get_wifi_scan_results(request):
    try:
        if uos.stat('/data/wifi_scan.json'):
            return send_file('/data/wifi_scan.json', content_type='application/json')
        else:
            return Response('File not found', status_code=404)
    except OSError:
        return Response('File not found', status_code=404)

@app.route('/scan_wifi', methods=['GET'])
def scan_wifi(request):
    try:
        print("Avvio della scansione Wi-Fi")
        clear_wifi_scan_file()  # Cancella eventuali vecchi dati della scansione
        wlan = network.WLAN(network.STA_IF)
        wlan.active(True)
        networks = wlan.scan()
        network_list = []

        for net in networks:
            ssid = net[0].decode('utf-8')
            rssi = net[3]
            signal_quality = "Buono" if rssi > -60 else "Sufficiente" if rssi > -80 else "Scarso"
            network_list.append({"ssid": ssid, "signal": signal_quality})

        # Salva i risultati nel file JSON
        save_wifi_scan_results(network_list)

        return Response(
            body=ujson.dumps(network_list),
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        print(f"Errore durante la scansione delle reti WiFi: {e}")
        return Response(
            body=ujson.dumps({'error': 'Errore durante la scansione delle reti WiFi'}),
            status_code=500,
            headers={'Content-Type': 'application/json'}
        )


@app.route('/clear_wifi_scan_file', methods=['POST'])
def clear_wifi_scan(request):
    try:
        clear_wifi_scan_file()
        return Response(
            body=ujson.dumps({'success': True}),
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        return Response(
            body=ujson.dumps({'error': str(e)}),
            status_code=500,
            headers={'Content-Type': 'application/json'}
        )

    
@app.route('/get_connection_status', methods=['GET'])
def get_connection_status(request):
    print("Richiesta GET /get_connection_status ricevuta")
    try:
        wlan_sta = network.WLAN(network.STA_IF)
        wlan_ap = network.WLAN(network.AP_IF)
        response_data = {}

        if wlan_sta.isconnected():
            ip = wlan_sta.ifconfig()[0]
            response_data['mode'] = 'client'
            response_data['ip'] = ip
            response_data['ssid'] = wlan_sta.config('essid')
        elif wlan_ap.active():
            ip = wlan_ap.ifconfig()[0]
            response_data['mode'] = 'AP'
            response_data['ip'] = ip
            response_data['ssid'] = wlan_ap.config('essid')
        else:
            response_data['mode'] = 'none'
            response_data['ip'] = 'N/A'
            response_data['ssid'] = 'N/A'

        return Response(body=ujson.dumps(response_data), headers={'Content-Type': 'application/json'})
    except Exception as e:
        print(f"Errore durante l'ottenimento dello stato della connessione: {e}")
        return Response(body=ujson.dumps({'error': str(e)}), headers={'Content-Type': 'application/json'}, status_code=500)



@app.route('/activate_ap', methods=['POST'])
def activate_ap(request):
    try:
        start_access_point()  # Attiva l'AP con le impostazioni salvate
        return Response(body=ujson.dumps({'success': True}), headers={'Content-Type': 'application/json'})
    except Exception as e:
        print(f"Error starting AP: {e}")
        return Response(body=ujson.dumps({'success': False, 'error': str(e)}), status_code=500)


# Funzione per verificare se un file esiste
def file_exists(path):
    try:
        uos.stat(path)
        return True
    except OSError:
        return False


@app.route('/data/user_settings.json', methods=['GET'])
def get_user_settings(request):
    try:
        if file_exists(data_base_path + '/user_settings.json'):
            # Ritorna il file di configurazione utente
            with open(data_base_path + '/user_settings.json', 'r') as f:
                settings = ujson.load(f)
            
            # Aggiungi queste stampe per verificare il tipo di 'settings'
            print(f"Tipo di 'settings' caricato da 'user_settings.json': {type(settings)}")
            print(f"Contenuto di 'settings': {settings}")
            
            return Response(body=ujson.dumps(settings), headers={'Content-Type': 'application/json'})
        else:
            # Creazione di un file di configurazione vuoto se non esiste
            default_settings = {
                "client_enabled": False,
                "wifi": {"ssid": "", "password": ""},
                "ap": {"ssid": "IrrigationAP", "password": "12345678"},
                "zones": [{"id": 0, "status": "show", "pin": 14, "name": "Zona 1"}, {"id": 1, "status": "show", "pin": 15, "name": "Zona 2"}],
                "max_active_zones": 1,
                "activation_delay": 0,
                "safety_relay": {"pin": None},
                "automatic_programs_enabled": False
            }
            with open(data_base_path + '/user_settings.json', 'w') as f:
                ujson.dump(default_settings, f)
            return Response(body=ujson.dumps(default_settings), headers={'Content-Type': 'application/json'})
    except Exception as e:
        print(f"Errore durante il caricamento di user_settings.json: {e}")
        return Response('Errore interno del server', status_code=500)



# Route per ottenere program.json
@app.route('/data/program.json', methods=['GET'])
def get_programs(request):
    try:
        return send_file('/data/program.json', content_type='application/json')
    except Exception as e:
        print(f"Errore durante il caricamento di program.json: {e}")
        return Response('Errore interno del server', status_code=500)

# Route per abilitare/disabilitare i programmi automatici
@app.route('/toggle_automatic_programs', methods=['POST'])
def toggle_automatic_programs(request):
    try:
        data = request.json or ujson.loads(request.body.decode('utf-8'))
        enable = data.get('enable', False)
        
        # Salva l'impostazione in un file
        settings = load_user_settings()
        settings['automatic_programs_enabled'] = enable
        save_user_settings(settings)
        
        return Response(
            body=ujson.dumps({'success': True}),
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        print(f"Errore durante la modifica dell'impostazione dei programmi automatici: {e}")
        return Response(
            body=ujson.dumps({'success': False, 'error': str(e)}),
            headers={'Content-Type': 'application/json'},
            status_code=500
        )


# Endpoint per ottenere la lista delle zone
@app.route('/get_zones', methods=['GET'])
def get_zones(request):
    try:
        settings = load_user_settings()
        zones = settings.get('zones', [])
        return Response(body=ujson.dumps(zones), headers={'Content-Type': 'application/json'})
    except Exception as e:
        print(f"Errore durante il caricamento delle zone: {e}")
        return Response(
            body=ujson.dumps({'error': 'Errore nel caricamento delle zone'}),
            status_code=500,
            headers={'Content-Type': 'application/json'}
        )

# Endpoint per avviare una zona
@app.route('/start_zone', methods=['POST'])
def handle_start_zone(request):
    try:
        data = request.json or ujson.loads(request.body.decode('utf-8'))

        zone_id = data.get('zone_id')
        duration = data.get('duration')

        if zone_id is None or duration is None:
            return Response(
                body=ujson.dumps({'error': 'Parametri mancanti'}),
                status_code=400,
                headers={'Content-Type': 'application/json'}
            )

        zone_id = int(zone_id)
        duration = int(duration)

        print(f"Avvio della zona {zone_id} per {duration} minuti")
        start_zone(zone_id, duration)
        return Response(body=ujson.dumps({"status": "Zona avviata"}), headers={'Content-Type': 'application/json'})
    except Exception as e:
        print(f"Errore durante l'avvio della zona: {e}")
        return Response(
            body=ujson.dumps({'error': 'Errore durante l\'avvio della zona'}),
            status_code=500,
            headers={'Content-Type': 'application/json'}
        )

# Endpoint per fermare una zona
@app.route('/stop_zone', methods=['POST'])
def handle_stop_zone(request):
    try:
        data = request.json or ujson.loads(request.body.decode('utf-8'))

        zone_id = data.get('zone_id')

        if zone_id is None:
            return Response(
                body=ujson.dumps({'error': 'Parametro zone_id mancante'}),
                status_code=400,
                headers={'Content-Type': 'application/json'}
            )

        zone_id = int(zone_id)

        print(f"Arresto della zona {zone_id}")
        stop_zone(zone_id)
        return Response(body=ujson.dumps({"status": "Zona arrestata"}), headers={'Content-Type': 'application/json'})
    except Exception as e:
        print(f"Errore durante l'arresto della zona: {e}")
        return Response(
            body=ujson.dumps({'error': 'Errore durante l\'arresto della zona'}),
            status_code=500,
            headers={'Content-Type': 'application/json'}
        )


@app.route('/stop_program', methods=['POST'])
def stop_program_route(request):
    try:
        print("Richiesta di interruzione ricevuta.")
        stop_program()  # Arresta il programma in esecuzione
        return Response(
            body=ujson.dumps({'success': True, 'message': 'Programma interrotto'}),
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        print(f"Errore nell'arresto del programma: {e}")
        return Response(
            body=ujson.dumps({'success': False, 'error': str(e)}),
            headers={'Content-Type': 'application/json'},
            status_code=500
        )


# Route per salvare un nuovo programma
@app.route('/save_program', methods=['POST'])
def save_program_route(request):
    try:
        program_data = request.json or ujson.loads(request.body.decode('utf-8'))

        # Validazione della lunghezza del nome del programma
        if len(program_data.get('name', '')) > 16:
            return Response(
                body=ujson.dumps({'success': False, 'error': 'Il nome del programma non può superare 16 caratteri'}),
                headers={'Content-Type': 'application/json'},
                status_code=400
            )

        # Carica i programmi esistenti
        programs = load_programs()

        # Verifica se esiste un programma con lo stesso nome
        for existing_program in programs.values():
            if existing_program['name'] == program_data['name']:
                return Response(
                    body=ujson.dumps({'success': False, 'error': 'Esiste già un programma con questo nome'}),
                    headers={'Content-Type': 'application/json'},
                    status_code=400
                )

        # Genera un nuovo ID per il programma
        new_id = str(max([int(pid) for pid in programs.keys()] + [0]) + 1)
        program_data['id'] = new_id  # Assicurati che l'ID sia una stringa

        # Aggiungi il nuovo programma al dizionario
        programs[new_id] = program_data

        # Salva i programmi aggiornati
        save_programs(programs)

        return Response(
            body=ujson.dumps({'success': True, 'message': 'Programma salvato con successo', 'program_id': new_id}),
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        print(f"Errore durante il salvataggio del programma: {e}")
        return Response(
            body=ujson.dumps({'success': False, 'error': str(e)}),
            headers={'Content-Type': 'application/json'},
            status_code=500
        )

# Route per aggiornare un programma esistente
@app.route('/update_program', methods=['PUT'])
def update_program_route(request):
    try:
        updated_program_data = request.json or ujson.loads(request.body.decode('utf-8'))
        program_id = updated_program_data.get('id')

        if program_id is None:
            return Response(
                body=ujson.dumps({'success': False, 'error': 'ID del programma mancante'}),
                headers={'Content-Type': 'application/json'},
                status_code=400
            )

        # Validazione della lunghezza del nome del programma
        if len(updated_program_data.get('name', '')) > 16:
            return Response(
                body=ujson.dumps({'success': False, 'error': 'Il nome del programma non può superare 16 caratteri'}),
                headers={'Content-Type': 'application/json'},
                status_code=400
            )

        # Aggiorna il programma esistente
        success = update_program(program_id, updated_program_data)

        if success:
            return Response(
                body=ujson.dumps({'success': True, 'message': 'Programma aggiornato con successo'}),
                headers={'Content-Type': 'application/json'}
            )
        else:
            return Response(
                body=ujson.dumps({'success': False, 'error': 'Programma non trovato'}),
                headers={'Content-Type': 'application/json'},
                status_code=404
            )
    except Exception as e:
        print(f"Errore durante l'aggiornamento del programma: {e}")
        return Response(
            body=ujson.dumps({'success': False, 'error': str(e)}),
            headers={'Content-Type': 'application/json'},
            status_code=500
        )

# Route per eliminare un programma
@app.route('/delete_program', methods=['POST'])
def delete_program_route(request):
    try:
        program_data = request.json or ujson.loads(request.body.decode('utf-8'))
        program_id = program_data.get('id')

        if program_id is None:
            return Response(
                body=ujson.dumps({'success': False, 'error': 'ID del programma mancante'}),
                headers={'Content-Type': 'application/json'},
                status_code=400
            )

        # Elimina il programma
        success = delete_program(program_id)

        if success:
            return Response(
                body=ujson.dumps({'success': True, 'message': f'Programma {program_id} eliminato'}),
                headers={'Content-Type': 'application/json'}
            )
        else:
            return Response(
                body=ujson.dumps({'success': False, 'error': 'Programma non trovato'}),
                headers={'Content-Type': 'application/json'},
                status_code=404
            )
    except Exception as e:
        print(f"Errore nell'eliminazione del programma: {e}")
        return Response(
            body=ujson.dumps({'success': False, 'error': str(e)}),
            headers={'Content-Type': 'application/json'},
            status_code=500
        )


# Route per riavviare il sistema
@app.route('/restart_system', methods=['POST'])
def restart_system_route(request):
    try:
        import machine
        machine.reset()
        return Response(
            body=ujson.dumps({'success': True, 'message': 'Sistema in riavvio'}),
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        print(f"Errore durante il riavvio del sistema: {e}")
        return Response(
            body=ujson.dumps({'success': False, 'error': str(e)}),
            headers={'Content-Type': 'application/json'},
            status_code=500
        )




# Route per resettare le impostazioni
@app.route('/reset_settings', methods=['POST'])
def reset_settings_route(request):
    try:
        reset_user_settings()
        return Response(
            body=ujson.dumps({'success': True, 'message': 'Impostazioni resettate con successo'}),
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        print(f"Errore durante il reset delle impostazioni: {e}")
        return Response(
            body=ujson.dumps({'success': False, 'error': str(e)}),
            headers={'Content-Type': 'application/json'},
            status_code=500
        )

# Route per resettare i dati di fabbrica
@app.route('/reset_factory_data', methods=['POST'])
def reset_factory_data_route(request):
    try:
        reset_factory_data()
        return Response(
            body=ujson.dumps({'success': True, 'message': 'Dati di fabbrica resettati con successo'}),
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        print(f"Errore durante il reset dei dati di fabbrica: {e}")
        return Response(
            body=ujson.dumps({'success': False, 'error': str(e)}),
            headers={'Content-Type': 'application/json'},
            status_code=500
        )

@app.route('/start_program', methods=['POST'])
@app.route('/start_program', methods=['POST'])
async def start_program_route(request):
    try:
        data = await request.json
        if data is None:
            data = ujson.loads(await request.body())
        program_id = str(data.get('program_id'))

        if program_id is None:
            return Response(
                body=ujson.dumps({'success': False, 'error': 'ID del programma mancante'}),
                headers={'Content-Type': 'application/json'},
                status_code=400
            )

        programs = load_programs()
        program = programs.get(program_id)

        if program is None:
            return Response(
                body=ujson.dumps({'success': False, 'error': 'Programma non trovato'}),
                headers={'Content-Type': 'application/json'},
                status_code=404
            )

        # Controlla se un altro programma è già in esecuzione
        load_program_state()
        if program_running:
            return Response(
                body=ujson.dumps({'success': False, 'error': 'Un altro programma è già in esecuzione'}),
                headers={'Content-Type': 'application/json'},
                status_code=400
            )

        # Avvia il programma manualmente
        await execute_program(program, manual=True)
        return Response(
            body=ujson.dumps({'success': True, 'message': 'Programma avviato manualmente'}),
            headers={'Content-Type': 'application/json'}
        )
    except Exception as e:
        print(f"Errore nell'avvio del programma: {e}")
        return Response(
            body=ujson.dumps({'success': False, 'error': str(e)}),
            headers={'Content-Type': 'application/json'},
            status_code=500
        )




@app.route('/get_program_state', methods=['GET'])
def get_program_state(request):
    try:
        with open('/data/program_state.json', 'r') as f:
            state = ujson.load(f)
        return Response(body=ujson.dumps(state), headers={'Content-Type': 'application/json'})
    except Exception as e:
        print(f"Errore durante il caricamento dello stato del programma: {e}")
        return Response(body=ujson.dumps({'program_running': False, 'current_program_id': None}), headers={'Content-Type': 'application/json'})

# Route per servire la pagina principale
@app.route('/', methods=['GET'])
def index(request):
    try:
        return send_file('/web/main.html')
    except Exception as e:
        print(f"Errore durante il caricamento di main.html: {e}")
        return Response('Errore interno del server', status_code=500)

# Route per servire i file statici (CSS, JS, immagini)
@app.route('/<path:path>', methods=['GET'])
def static_files(request, path):
    try:
        # Evita di intercettare percorsi che iniziano con 'data/'
        if path.startswith('data/'):
            return Response('Not Found', status_code=404)

        file_path = '/web/' + path
        if file_exists(file_path):
            # Determina il tipo di contenuto in base all'estensione del file
            if file_path.endswith('.html'):
                content_type = 'text/html'
            elif file_path.endswith('.css'):
                content_type = 'text/css'
            elif file_path.endswith('.js'):
                content_type = 'application/javascript'
            elif file_path.endswith('.json'):
                content_type = 'application/json'
            elif file_path.endswith('.png'):
                content_type = 'image/png'
            elif file_path.endswith('.jpg') or file_path.endswith('.jpeg'):
                content_type = 'image/jpeg'
            elif file_path.endswith('.ico'):
                content_type = 'image/x-icon'
            else:
                content_type = 'text/plain'
            return send_file(file_path, content_type=content_type)
        else:
            return Response('File non trovato', status_code=404)
    except Exception as e:
        print(f"Errore durante il caricamento del file {path}: {e}")
        return Response('Errore interno del server', status_code=500)

@app.route('/connect_wifi', methods=['POST'])
def connect_wifi(request):
    try:
        # Ottieni i dati della richiesta
        data = request.json or ujson.loads(request.body.decode('utf-8'))

        # Estrai SSID e password
        ssid = data.get('ssid')
        password = data.get('password')

        if not ssid or not password:
            return Response(
                body=ujson.dumps({'success': False, 'error': 'SSID o password mancanti'}),
                status_code=400,
                headers={'Content-Type': 'application/json'}
            )

        # Attiva il WiFi in modalità client e connessione alla rete
        wlan = network.WLAN(network.STA_IF)
        wlan.active(True)
        wlan.connect(ssid, password)

        # Attendere la connessione (timeout 15 secondi)
        timeout = 15
        while not wlan.isconnected() and timeout > 0:
            print("Tentativo di connessione...")
            time.sleep(1)
            timeout -= 1

        # Se la connessione è riuscita, salvare le nuove impostazioni WiFi
        if wlan.isconnected():
            ip = wlan.ifconfig()[0]
            print(f"Connesso alla rete WiFi con IP: {ip}")

            # Carica le impostazioni esistenti
            existing_settings = load_user_settings()
            if not isinstance(existing_settings, dict):
                existing_settings = {}

            # Aggiorna solo le impostazioni WiFi e salva il file
            existing_settings['wifi'] = {'ssid': ssid, 'password': password}
            existing_settings['client_enabled'] = True

            # Salva le impostazioni aggiornate
            save_user_settings(existing_settings)

            # Restituisci una risposta di successo
            return Response(
                body=ujson.dumps({'success': True, 'ip': ip, 'mode': 'client'}),
                headers={'Content-Type': 'application/json'}
            )
        else:
            # Connessione fallita
            print("Connessione WiFi fallita")
            return Response(
                body=ujson.dumps({'success': False, 'error': 'Connessione WiFi fallita'}),
                status_code=500,
                headers={'Content-Type': 'application/json'}
            )

    except Exception as e:
        print(f"Errore durante la connessione alla rete WiFi: {e}")
        return Response(
            body=ujson.dumps({'success': False, 'error': str(e)}),
            headers={'Content-Type': 'application/json'},
            status_code=500
        )


@app.route('/save_user_settings', methods=['POST'])
def save_user_settings_route(request):
    try:
        # Ricevi i dati delle impostazioni dal client e assicurati che siano validi
        settings_data = request.json
        if settings_data is None:
            settings_data = ujson.loads(request.body.decode('utf-8'))

        # Controlla che 'settings_data' sia un dizionario
        if not isinstance(settings_data, dict):
            raise ValueError("I dati delle impostazioni devono essere un oggetto JSON valido")

        # Stampa di debug delle impostazioni ricevute
        print("Dati ricevuti per le impostazioni:", ujson.dumps(settings_data))

        # Carica le impostazioni esistenti dal file
        existing_settings = load_user_settings()
        if not isinstance(existing_settings, dict):
            existing_settings = {}

        # Aggiorna le impostazioni esistenti con le nuove impostazioni ricevute
        for key, value in settings_data.items():
            if isinstance(value, dict) and key in existing_settings:
                # Se il valore è un dizionario, aggiorna in modo ricorsivo
                existing_settings[key].update(value)
            else:
                # Se il valore non è un dizionario, sovrascrivi direttamente
                existing_settings[key] = value

        # Salva le impostazioni aggiornate in 'user_settings.json'
        file_path = data_base_path + '/user_settings.json'
        try:
            with open(file_path, 'w') as file:
                ujson.dump(existing_settings, file)
                print(f"Impostazioni salvate con successo in {file_path}")
        except OSError as e:
            print(f"Errore durante la scrittura del file {file_path}: {e}")
            return Response(body=ujson.dumps({'success': False, 'error': 'File write error'}), headers={'Content-Type': 'application/json'})

        # Verifica se client_enabled è stato impostato su False
        client_enabled = existing_settings.get('client_enabled', True)
        wlan_sta = network.WLAN(network.STA_IF)

        if not client_enabled:
            # Se il client Wi-Fi è attivo, disattivalo
            if wlan_sta.active() or wlan_sta.isconnected():
                wlan_sta.active(False)
                print("Modalità client disattivata poiché 'client_enabled' è False.")
        else:
            print("Modalità client attivata o già attiva.")

        # Restituisce una risposta di successo
        return Response(body=ujson.dumps({'success': True}), headers={'Content-Type': 'application/json'})

    except ValueError as e:
        print(f"Errore nella decodifica del JSON: {e}")
        return Response(body=ujson.dumps({'success': False, 'error': 'JSON syntax error'}), headers={'Content-Type': 'application/json'})
    except Exception as e:
        print(f"Errore durante il salvataggio delle impostazioni: {e}")
        return Response(body=ujson.dumps({'success': False, 'error': str(e)}), headers={'Content-Type': 'application/json'})

@app.route('/disconnect_wifi', methods=['POST'])
def disconnect_wifi(request):
    try:
        wlan_sta = network.WLAN(network.STA_IF)
        if wlan_sta.isconnected():
            wlan_sta.disconnect()
            wlan_sta.active(False)
            print("WiFi client disconnesso.")
        return Response(body=ujson.dumps({'success': True}), headers={'Content-Type': 'application/json'})
    except Exception as e:
        print(f"Errore durante la disconnessione del WiFi client: {e}")
        return Response(body=ujson.dumps({'success': False, 'error': str(e)}), status_code=500)


async def start_web_server():
    try:
        print("Avvio del server web.")
        await app.start_server(host='0.0.0.0', port=80)
    except Exception as e:
        print(f"Errore durante l'avvio del server web: {e}")


