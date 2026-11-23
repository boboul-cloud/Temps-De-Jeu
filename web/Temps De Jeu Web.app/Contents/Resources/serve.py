# Petit serveur local de Temps De Jeu (version web) : sert le dossier courant,
# sans laisser le navigateur garder d'anciens fichiers.
import http.server
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', 8658), H).serve_forever()
