import network
import ujson
import time
import gc
import uos
from settings_manager import load_user_settings, save_user_settings
import uasyncio as asyncio

WIFI_RETRY_INTERVAL = 30
MAX_WIFI_RETRIES = 5
AP_SSID_DEFAULT = "IrrigationAP"
AP_PASSWORD_DEFAULT = "12345678"
wifi_scan_file = '/data/wifi_scan.json'


def reset_wifi_module():
    """Disattiva e riattiva il modulo WiFi per forzare un reset completo"""
    wlan_sta = network.WLAN(network.STA_IF)
    wlan_ap = network.WLAN(network.AP_IF)
    
    print("Resetting WiFi module...")
    wlan_sta.active(False)
    wlan_ap.active(False)
    
    time.sleep(1)
    wlan_sta.active(True)
    print("WiFi module reset completed.")

def save_wifi_scan_results(network_list):
    """Salva i risultati della scansione Wi-Fi nel file wifi_scan.json."""
    try:
        with open(wifi_scan_file, 'w') as f:
            ujson.dump(network_list, f)
        print(f"Risultati della scansione Wi-Fi salvati correttamente in {wifi_scan_file}")
    except OSError as e:
        print(f"Errore durante il salvataggio dei risultati della scansione Wi-Fi: {e}")

    
# Aggiungiamo una funzione per azzerare il file wifi_scan.json
def clear_wifi_scan_file():
    file_path = '/data/wifi_scan.json'
    try:
        with open(file_path, 'w') as f:
            ujson.dump([], f)  # Salviamo un array vuoto
            print(f"File {file_path} azzerato correttamente.")
    except Exception as e:
        print(f"Errore nell'azzerare il file {file_path}: {e}")
        
def connect_to_wifi(ssid, password):
    """Tenta di connettersi a una rete WiFi in modalità client"""
    wlan_sta = network.WLAN(network.STA_IF)
    print(f"Trying to connect to WiFi SSID: {ssid}...")

    wlan_sta.active(True)
    retries = 0

    while not wlan_sta.isconnected() and retries < MAX_WIFI_RETRIES:
        wlan_sta.connect(ssid, password)
        time.sleep(5)
        retries += 1

    if wlan_sta.isconnected():
        print(f"Connected successfully to WiFi: {wlan_sta.ifconfig()[0]}")
        return True
    else:
        print("Failed to connect to WiFi.")
        wlan_sta.active(False)
        return False

def start_access_point(ssid=None, password=None):
    settings = load_user_settings()  # Carica le impostazioni utente

    # Se SSID o password non sono passati come parametri, carica dalle impostazioni
    ap_config = settings.get('ap', {})
    ssid = ssid or ap_config.get('ssid', 'IrrigationAP')  # Default SSID se non presente
    password = password or ap_config.get('password', '12345678')  # Default password se non presente

    wlan_ap = network.WLAN(network.AP_IF)
    wlan_ap.active(True)

    try:
        # Configura l'AP con il SSID e la password
        if password and len(password) >= 8:
            wlan_ap.config(essid=ssid, password=password, authmode=3)  # 3 è WPA2
        else:
            wlan_ap.config(essid=ssid)  # AP sarà aperto se non è presente una password

        print(f"Access Point attivato con SSID: '{ssid}', sicurezza {'WPA2' if password else 'Nessuna'}")
    except Exception as e:
        print(f"Errore durante l'attivazione dell'Access Point: {e}")
        wlan_ap.active(False)


def initialize_network():
    gc.collect()  # Effettua la garbage collection per liberare memoria
    settings = load_user_settings()
    if not isinstance(settings, dict):
        print("Errore: impostazioni utente non disponibili.")
        return

    client_enabled = settings.get('client_enabled', False)

    if client_enabled:
        # Modalità client attiva
        ssid = settings.get('wifi', {}).get('ssid')
        password = settings.get('wifi', {}).get('password')

        if ssid and password:
            success = connect_to_wifi(ssid, password)
            if success:
                print("Modalità client attivata con successo.")
                return
            else:
                print("Connessione alla rete WiFi fallita, passando alla modalità AP.")
                # Se la connessione fallisce, disabilita la modalità client
                settings['client_enabled'] = False
                save_user_settings(settings)
        else:
            print("SSID o password non validi per il WiFi client.")

    # Se il client è disattivato o fallisce, avvia l'AP
    ap_ssid = settings.get('ap', {}).get('ssid', AP_SSID_DEFAULT)
    ap_password = settings.get('ap', {}).get('password', AP_PASSWORD_DEFAULT)
    start_access_point(ap_ssid, ap_password)



async def retry_client_connection():
    while True:
        await asyncio.sleep(WIFI_RETRY_INTERVAL)
        wlan_sta = network.WLAN(network.STA_IF)
        settings = load_user_settings()

        client_enabled = settings.get('client_enabled', False)

        if client_enabled:
            if not wlan_sta.isconnected():
                ssid = settings.get('wifi', {}).get('ssid')
                password = settings.get('wifi', {}).get('password')
                if ssid and password:
                    success = connect_to_wifi(ssid, password)
                    if not success:
                        print(f"Impossibile riconnettersi a '{ssid}'. Attivazione della rete AP.")
                        settings['client_enabled'] = False
                        save_user_settings(settings)
                        start_access_point()
                else:
                    print("SSID o password non validi. Impossibile riconnettersi.")
            else:
                print("Modalità client attiva.")
        else:
            if wlan_sta.active():
                print("Disattivazione della modalità client.")
                wlan_sta.active(False)





