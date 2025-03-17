from wifi_manager import initialize_network, reset_wifi_module, retry_client_connection
from web_server import start_web_server
from zone_manager import initialize_pins
from program_manager import check_programs, reset_program_state
import uasyncio as asyncio

async def program_check_loop():
    while True:
        try:
            await check_programs()  # Usa await qui
            await asyncio.sleep(30)
        except Exception as e:
            print(f"Errore durante il controllo dei programmi: {e}")
            await asyncio.sleep(30)  # Attende 30 secondi prima del prossimo controllo

async def main():
    try:
        print("Disattivazione Bluetooth, se presente...")
        import bluetooth
        bt = bluetooth.BLE()
        bt.active(False)
    except ImportError:
        print("Modulo Bluetooth non presente.")
    
    # Inizializza la rete
    try:
        print("Inizializzazione della rete WiFi...")
        initialize_network()
    except Exception as e:
        print(f"Errore durante l'inizializzazione della rete WiFi: {e}")
        return

    # Resetta lo stato del programma all'avvio
    reset_program_state()
    if not initialize_pins():
        print("Errore: Nessuna zona inizializzata correttamente.")
    else:
        print("Zone inizializzate correttamente.")
    # Avvia i task asincroni
    print("Avvio del web server...")
    asyncio.create_task(start_web_server())
    print("Avvio del controllo dei programmi...")
    asyncio.create_task(program_check_loop())

    # Mantiene il loop in esecuzione
    while True:
        await asyncio.sleep(1)


if __name__ == '__main__':
    asyncio.run(main())

