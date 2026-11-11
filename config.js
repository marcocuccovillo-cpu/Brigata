// Brigata — configurazione del database Supabase
// Supabase → Project Settings → API (o "Connect"): copia qui "Project URL" e la chiave "anon / publishable".
// La chiave anon è pubblica per natura: i dati sono protetti dalle regole del database (schema.sql).
// Lasciando vuoti i due campi, Brigata funziona solo sul telefono, senza account.
window.BRIGATA_CONFIG = {
  supabaseUrl: '',
  supabaseKey: ''
};
