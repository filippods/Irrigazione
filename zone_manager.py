import ujson
import time
import machine
import uasyncio as asyncio
from uasyncio import core
from machine import Pin, Timer
from program_state import program_running  # Importa la variabile per verificare lo stato del programma
from settings_manager import load_user_settings

# Definisci active_tasks come variabile globale
active_timers = {}
zone_pins = {}
safety_relay = None

# Inizializza i pin dei relè
def initialize_pins():
    settings = load_user_settings()
    if not settings:
        print("Errore: Impossibile caricare le impostazioni utente.")
        return {}, None

    zones = settings['zones']
    pins = {}

    # Inizializza i pin per le zone
    for zone in zones:
        pin_number = zone['pin']
        try:
            pin = Pin(pin_number, Pin.OUT)
            pin.value(1)  # Assicura che il relè sia spento all'avvio (logica attiva bassa)
            pins[zone['id']] = pin
            print(f"Zona {zone['id']} inizializzata sul pin {pin_number}.")
        except Exception as e:
            print(f"Errore durante l'inizializzazione del pin per la zona {zone['id']}: {e}")

    # Inizializza il pin per il relè di sicurezza
    safety_relay_pin = settings['safety_relay']['pin']
    try:
        safety_relay = Pin(safety_relay_pin, Pin.OUT)
        safety_relay.value(1)  # Assicura che il relè di sicurezza sia spento all'avvio
        print(f"Relè di sicurezza inizializzato sul pin {safety_relay_pin}.")
    except Exception as e:
        print(f"Errore durante l'inizializzazione del relè di sicurezza: {e}")
        safety_relay = None

    return pins, safety_relay

# Inizializzazione dei pin per ogni zona e del relè di sicurezza
zone_pins, safety_relay = initialize_pins()
active_timers = {}

# Avvia una zona per una durata specificata
def start_zone(zone_id, duration):
    global program_running, active_timers
    if program_running:
        print(f"Impossibile avviare la zona {zone_id} poiché un programma è già in esecuzione.")
        return

    zone_id = int(zone_id)
    duration = int(duration)

    if zone_id not in zone_pins:
        print(f"Errore: Zona {zone_id} non trovata.")
        return

    # Accende il relè di sicurezza se non è già acceso
    if safety_relay and not any(active_timers.values()):
        safety_relay.value(0)  # Attiva il relè di sicurezza (logica attiva bassa)
        print("Relè di sicurezza attivato.")

    # Attiva il relè per la zona specificata
    try:
        zone_pins[zone_id].value(0)  # Attiva la zona (logica attiva bassa)
        print(f"Zona {zone_id} avviata per {duration} minuti.")
    except Exception as e:
        print(f"Errore durante l'attivazione della zona {zone_id}: {e}")
        return

    # Crea un timer per arrestare la zona dopo la durata specificata
    try:
        timer = Timer(-1)
        timer.init(period=duration * 60 * 1000, mode=Timer.ONE_SHOT, callback=lambda t: stop_zone(zone_id))
        active_timers[zone_id] = timer
    except Exception as e:
        print(f"Errore durante la creazione del timer per la zona {zone_id}: {e}")

# Ferma una zona
def stop_zone(zone_id):
    global active_timers

    zone_id = int(zone_id)

    if zone_id not in zone_pins:
        print(f"Errore: Zona {zone_id} non trovata.")
        return

    # Disattiva il relè della zona
    try:
        zone_pins[zone_id].value(1)  # Disattiva la zona (logica attiva bassa)
        print(f"Zona {zone_id} arrestata.")
    except Exception as e:
        print(f"Errore durante l'arresto della zona {zone_id}: {e}")
        return

    # Cancella il timer attivo per la zona
    if zone_id in active_timers:
        active_timers[zone_id].deinit()
        del active_timers[zone_id]

    # Spegne il relè di sicurezza se non ci sono altre zone attive
    if safety_relay and not active_timers:
        try:
            safety_relay.value(1)  # Disattiva il relè di sicurezza (logica attiva bassa)
            print("Relè di sicurezza disattivato.")
        except Exception as e:
            print(f"Errore durante lo spegnimento del relè di sicurezza: {e}")

# Funzione di emergenza per arrestare tutte le zone
def stop_all_zones():
    for zone_id in list(active_timers.keys()):
        stop_zone(zone_id)

# Assicurati che le funzioni siano pronte all'uso
print("Zone e relè di sicurezza inizializzati correttamente.")
