# program_state.py

# Variabili globali per gestire lo stato del programma
program_running = False
current_program_id = None
PROGRAM_STATE_FILE = '/data/program_state.json'


# Funzioni per leggere e salvare lo stato del programma
def save_program_state():
    import ujson
    try:
        with open('/data/program_state.json', 'w') as f:
            ujson.dump({'program_running': program_running, 'current_program_id': current_program_id}, f)
        print(f"Stato del programma salvato: program_running={program_running}, current_program_id={current_program_id}")
    except OSError as e:
        print(f"Errore durante il salvataggio dello stato del programma: {e}")

def load_program_state():
    global program_running, current_program_id
    try:
        with open(PROGRAM_STATE_FILE, 'r') as f:
            state = ujson.load(f)
            program_running = state.get('program_running', False)
            current_program_id = state.get('current_program_id', None)
    except OSError:
        # Resetta lo stato se il file non esiste o c'è un errore
        print("Nessuno stato salvato trovato, avvio da zero.")
        program_running = False
        current_program_id = None
        save_program_state()  # Salva il nuovo stato inizializzato


