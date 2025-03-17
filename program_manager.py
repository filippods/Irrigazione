import ujson
import time
import uasyncio as asyncio
from zone_manager import start_zone, stop_zone, stop_all_zones
from program_state import program_running, current_program_id, save_program_state, load_program_state
from settings_manager import load_user_settings, save_user_settings, reset_user_settings, reset_factory_data, factory_reset

PROGRAM_STATE_FILE = '/data/program_state.json'

# Carica i programmi
def load_programs():
    try:
        with open('/data/program.json', 'r') as f:
            return ujson.load(f)
    except OSError:
        return {}

# Funzione per salvare i programmi
def save_programs(programs):
    try:
        with open('/data/program.json', 'w') as f:
            ujson.dump(programs, f)
    except OSError as e:
        print(f"Errore durante il salvataggio dei programmi: {e}")

# Aggiornamento di un programma esistente
def update_program(program_id, updated_program):
    programs = load_programs()
    if program_id in programs:
        programs[program_id] = updated_program
        save_programs(programs)
        return True
    else:
        print(f"Errore: Programma con ID {program_id} non trovato.")
        return False

# Eliminazione di un programma
def delete_program(program_id):
    programs = load_programs()
    if program_id in programs:
        del programs[program_id]
        save_programs(programs)
        return True
    else:
        print(f"Errore: Programma con ID {program_id} non trovato.")
        return False

# Controlla se il programma è attivo nel mese corrente
def is_program_active_in_current_month(program):
    current_month = time.localtime()[1]
    months_map = {
        "Gennaio": 1, "Febbraio": 2, "Marzo": 3, "Aprile": 4,
        "Maggio": 5, "Giugno": 6, "Luglio": 7, "Agosto": 8,
        "Settembre": 9, "Ottobre": 10, "Novembre": 11, "Dicembre": 12
    }
    program_months = [months_map[month] for month in program['months']]
    return current_month in program_months

# Verifica se il programma è previsto per oggi
def is_program_due_today(program):
    current_day_of_year = time.localtime()[7]
    last_run_day = -1

    if 'last_run_date' in program:
        try:
            last_run_day = time.strptime(program['last_run_date'], '%Y-%m-%d')[7]
        except Exception as e:
            print(f"Errore nella conversione della data di esecuzione: {e}")

    if program['recurrence'] == 'giornaliero':
        return last_run_day != current_day_of_year
    elif program['recurrence'] == 'personalizzata':
        interval_days = program.get('interval_days', 1)
        return (current_day_of_year - last_run_day) >= interval_days
    return False


async def execute_program(program, manual=False):
    global program_running, current_program_id
    if program_running:
        print(f"Un altro programma è già in esecuzione: {current_program_id}.")
        return

    # Spegni tutte le zone prima di avviare un nuovo programma
    stop_all_zones()

    program_running = True
    current_program_id = program['id']
    save_program_state()

    settings = load_user_settings()
    activation_delay = settings.get('activation_delay', 0)

    try:
        for step in program['steps']:
            if not program_running:
                print("Programma interrotto dall'utente.")
                break

            zone_id = step['zone_id']
            duration = step['duration']
            print(f"Attivazione della zona {zone_id} per {duration} minuti.")
            await start_zone(zone_id, duration)
            await asyncio.sleep(duration * 60)

            await stop_zone(zone_id)
            print(f"Zona {zone_id} completata.")

            if not program_running:
                break

            if activation_delay > 0:
                await asyncio.sleep(activation_delay * 60)
    finally:
        program_running = False
        current_program_id = None
        save_program_state()
        update_last_run_date(program['id'])


# Ferma un programma
def stop_program():
    global program_running, current_program_id
    print("Interruzione del programma in corso.")
    program_running = False
    current_program_id = None
    save_program_state()  # Assicurati che lo stato venga salvato correttamente

    # Aggiungi il codice per fermare tutte le zone attualmente attive
    stop_all_zones()


def reset_program_state():
    global program_running, current_program_id
    program_running = False
    current_program_id = None
    save_program_state()


def stop_all_zones():
    # Qui puoi scorrere le zone attive e fermarle
    settings = load_user_settings()
    zones = settings.get('zones', [])
    for zone in zones:
        stop_zone(zone['id'])  # Assicurati di usare l'ID corretto delle zone

async def check_programs():
    settings = load_user_settings()
    if not settings.get('automatic_programs_enabled', True):
        print("Programmi automatici disabilitati, nessun programma verrà avviato automaticamente.")
        return

    programs = load_programs()
    current_time_str = time.strftime('%H:%M', time.localtime())

    for program_id, program in programs.items():
        if (current_time_str == program['activation_time'] and
            is_program_active_in_current_month(program) and
            is_program_due_today(program)):
            print(f"Avvio del programma pianificato: {program['name']}")
            asyncio.create_task(execute_program(program))
            update_last_run_date(program_id)


# Aggiorna la data dell'ultima esecuzione del programma
def update_last_run_date(program_id):
    current_date = time.strftime('%Y-%m-%d', time.localtime())
    programs = load_programs()
    if program_id in programs:
        programs[program_id]['last_run_date'] = current_date
        save_programs(programs)



