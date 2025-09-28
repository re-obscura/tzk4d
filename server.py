import http.server
import ssl

# Адрес и порт сервера
server_address = ('localhost', 4443)

# Создаем контекст SSL/TLS
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
# Загружаем наш самоподписанный сертификат
context.load_cert_chain(certfile='cert.pem', keyfile='key.pem')

# Создаем базовый HTTP-сервер
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)

# Оборачиваем сокет сервера с использованием созданного контекста
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"Сервер запущен на https://{server_address[0]}:{server_address[1]}")

# Запускаем сервер
httpd.serve_forever()