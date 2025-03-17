# settings_manager.py
import ujson

def load_user_settings():
    """Carica le impostazioni da user_settings.json, garantendo valori di default se mancano."""
    try:
        with open('/data/user_settings.json', 'r') as f:
            settings = ujson.load(f)
            # Garantisce che tutte le chiavi necessarie siano presenti
            settings.setdefault('zones', [])
            settings.setdefault('max_active_zones', 1)
            settings.setdefault('activation_delay', 0)
            settings.setdefault('safety_relay', {"pin": None})
            settings.setdefault('ap', {"ssid": "IrrigationAP", "password": "12345678"})
            settings.setdefault('wifi', {"ssid": "", "password": ""})
            settings.setdefault('automatic_programs_enabled', False)
            settings.setdefault('client_enabled', False)
            return settings
    except OSError as e:
        print(f"Error loading user settings: {e}")
        return {
            "client_enabled": False,
            "wifi": {"ssid": "", "password": ""},
            "ap": {"ssid": "IrrigationAP", "password": "12345678"},
            "zones": [],
            "max_active_zones": 1,
            "activation_delay": 0,
            "safety_relay": {"pin": None},
            "automatic_programs_enabled": False
        }

def save_user_settings(settings):
    """Salva le impostazioni su user_settings.json"""
    try:
        with open('/data/user_settings.json', 'w') as f:
            ujson.dump(settings, f)
            print("Settings saved successfully.")
    except OSError as e:
        print(f"Error saving user settings: {e}")

        
        
# Funzione per il ripristino delle impostazioni utente
def reset_user_settings():
    try:
        with open('/data/factory_settings.json', 'r') as f:
            factory_settings = ujson.load(f)
        save_user_settings(factory_settings)
        print("Impostazioni di fabbrica ripristinate.")
    except Exception as e:
        print(f"Errore durante il ripristino delle impostazioni: {e}")
        raise e

# Funzione per il ripristino dei dati di fabbrica
def reset_factory_data():
    try:
        reset_user_settings()
        with open('/data/empty.json', 'r') as f:
            empty_programs = ujson.load(f)
        with open('/data/program.json', 'w') as f:
            ujson.dump(empty_programs, f)
        print("Dati di fabbrica ripristinati.")
    except Exception as e:
        print(f"Errore durante il ripristino dei dati di fabbrica: {e}")
        raise e

# Funzione per il ripristino delle impostazioni di fabbrica
def factory_reset():
    try:
        with open('/data/factory_settings.json', 'r') as f:
            factory_settings = ujson.load(f)
        save_user_settings(factory_settings)
        print("Impostazioni di fabbrica ripristinate.")
    except Exception as e:
        print(f"Errore durante il ripristino delle impostazioni di fabbrica: {e}")

