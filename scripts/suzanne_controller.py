import imu
import utime
import wifiCfg
import socket
from machine import Pin
from m5stack import btnA, btnB, btnC, lcd
from uosc.client import Client

# conexión wifi
wifiCfg.connect("GTDM", "12345678", 30000, True)

# nos aseguramos que esté conectado a la red wifi
if wifiCfg.wlan_sta.isconnected():
    print("Conectado con IP:", wifiCfg.wlan_sta.ifconfig()[0])
else:
    print("No conectado")

# config del servidor y puerto de osc
server_ip = "192.168.0.154"  
tx_port = 9009  # puerto de recepción osc

# creamos un socket udp para enviar el mensaje osc
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

# config touch osc
touchOSC_port = 22200
osc = Client(server_ip, touchOSC_port)

# mensaje del funcionamiento (interfaz)
lcd.font(lcd.FONT_DejaVu24)
lcd.print("SUZANNE CONTROLLER", lcd.CENTER, 10, lcd.CYAN)
lcd.print("btnA: modo color", lcd.CENTER, 70, lcd.CYAN)
lcd.print("btnB: modo tamaño", lcd.CENTER, 100, lcd.CYAN)
lcd.print("btnC: modo girar", lcd.CENTER, 130, lcd.CYAN)
lcd.print("btnA       btnB       btnC", lcd.CENTER, 210, lcd.CYAN)

# config de los botones
button_A_state = None  
button_B_state = None  
button_C_state = None  

# inicializamos el imu
mpu = imu.IMU()

# modo actual
mode = None

# enviar un mensaje OSC al servidor
def send_osc_message(address, message):
    osc_message = "{} {}".format(address, message)
    sock.sendto(osc_message.encode(), (server_ip, tx_port))
    print("Enviado OSC:", osc_message)

# resetea el objeto al estado inicial
def reset_object():
    send_osc_message("/reset", "reset")

# manejo de los botones
def check_buttons():
    global button_A_state, button_B_state, button_C_state, mode
    
    current_state_A = btnA.isPressed()
    if current_state_A and button_A_state != "pressed":
        print("Botón A presionado - Modo Color")
        mode = 'color'
        reset_object()
        button_A_state = "pressed"
    elif not current_state_A and button_A_state != "released":
        button_A_state = "released"

    current_state_B = btnB.isPressed()
    if current_state_B and button_B_state != "pressed":
        print("Botón B presionado - Modo Tamaño")
        mode = 'size'
        reset_object()
        button_B_state = "pressed"
    elif not current_state_B and button_B_state != "released":
        button_B_state = "released"

    current_state_C = btnC.isPressed()
    if current_state_C and button_C_state != "pressed":
        print("Botón C presionado - Modo Girar")
        mode = 'rotate'
        reset_object()
        button_C_state = "pressed"
    elif not current_state_C and button_C_state != "released":
        button_C_state = "released"

# actualizar según el movimiento
def update_based_on_movement():
    ypr = mpu.ypr
    yaw, pitch, roll = ypr
    
    # normalizamos los valores de yaw, pitch y roll entre 0 y 1 --> touch osc
    normalized_yaw = yaw / 180  
    normalized_pitch = (pitch + 90) / 180  
    normalized_roll = (roll + 90) / 180  
    
    if mode == 'color':
        send_osc_message("/color", "{}".format(yaw))
        osc.send("/color", normalized_yaw)
    elif mode == 'size':
        send_osc_message("/size", str(roll))
        osc.send("/size", normalized_roll)
    elif mode == 'rotate':
        send_osc_message("/rotate", str(pitch))
        osc.send("/rotate", normalized_pitch)

while True:
    check_buttons()
    if mode:
        update_based_on_movement()
    utime.sleep(0.1)