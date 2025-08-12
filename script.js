// FUNZIONI DI UTILITY - DEVONO ESSERE DEFINITE PER PRIME
function updateConnectionStatus(status, message) {
    const indicator = document.getElementById('connectionStatus');
    const text = document.getElementById('connectionText');
    
    if (indicator) {
        indicator.className = 'status-indicator status-' + status;
    }
    
    if (text) {
        text.textContent = message;
    }
    
    console.log(`📡 Status: ${status} - ${message}`);
    
    switch(status) {
        case 'online':
            isConnected = true;
            break;
        case 'offline':
        case 'error':
            isConnected = false;
            gapi_loaded = false;
            break;
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications-container');
    if (!container) {
        // Crea container se non esiste
        const newContainer = document.createElement('div');
        newContainer.id = 'notifications-container';
        newContainer.className = 'notifications-container';
        document.body.appendChild(newContainer);
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Icone per tipo
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    // Titoli per tipo
    const titles = {
        success: 'Successo!',
        error: 'Errore',
        warning: 'Attenzione',
        info: 'Info'
    };
    
    notification.innerHTML = `
        <div class="notification-icon">${icons[type]}</div>
        <div class="notification-content">
            <div class="notification-title">${titles[type]}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.classList.add('removing'); setTimeout(() => this.parentElement.remove(), 300)">×</button>
    `;
    
    container.appendChild(notification);
    
    // Auto-remove dopo 5 secondi
    setTimeout(() => {
        notification.classList.add('removing');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}
// SISTEMA DI AUTENTICAZIONE - DEVE ESSERE GLOBALE
const CORRECT_PASSWORD = "hubris2020";

// Funzioni globali per il login
window.checkPassword = function() {
    const inputPassword = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('loginError');
    
    if (inputPassword === CORRECT_PASSWORD) {
        document.getElementById('loginOverlay').style.display = 'none';
        localStorage.setItem('hubris_authenticated', 'true');
        showNotification('✅ Accesso autorizzato!');
    } else {
        errorDiv.style.display = 'block';
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordInput').focus();
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }
}

window.checkEnter = function(event) {
    if (event.key === 'Enter') {
        checkPassword();
    }
}

window.logout = function() {
    localStorage.removeItem('hubris_authenticated');
    location.reload();
}
// FIX CONFIG BUTTON - DEVE ESSERE PRIMA DI TUTTO
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'saveConfigBtn') {
        const apiKey = document.getElementById('apiKeyInput').value.trim();
        const sheetsId = document.getElementById('sheetsIdInput').value.trim();
        
        if (!apiKey || !sheetsId) {
            alert('Inserisci API Key e Sheets ID');
            return;
        }
        
        CONFIG.API_KEY = apiKey;
        CONFIG.SHEETS_ID = sheetsId;
        localStorage.setItem('hubris_api_key', apiKey);
        localStorage.setItem('hubris_sheets_id', sheetsId);
        
        document.getElementById('configModal').classList.remove('active');
        alert('✅ Configurazione salvata!');
        
        // Invece di ricaricare, inizializza direttamente le API
        CONFIG.API_KEY = apiKey;
        CONFIG.SHEETS_ID = sheetsId;
        setTimeout(() => {
            initializeGoogleAPI();
        }, 1000);
    }
});
// CONFIGURAZIONE GLOBALE - CON I TUOI DATI
let CONFIG = {
    API_KEY: '',
    SHEETS_ID: '',
    DATABASE_RANGE: 'Database!A:H',
    QUOTES_RANGE: 'Preventivi_Completi!A:R',
    GITHUB_TOKEN: '', // Configurato via localStorage
    GITHUB_OWNER: 'HubrisRental',
    GITHUB_REPO: 'Hubris-CaricoPreventivi'
};
const savedApiKey = localStorage.getItem('hubris_api_key');
const savedSheetsId = localStorage.getItem('hubris_sheets_id');

if (savedApiKey && savedSheetsId) {
    CONFIG.API_KEY = savedApiKey;
    CONFIG.SHEETS_ID = savedSheetsId;
    console.log('✅ Configurazione caricata da localStorage');
} else {
    CONFIG.API_KEY = 'AIzaSyAbcQrfJiXQMIbBAb5ZOLvm_9tEz73d1DY';
    CONFIG.SHEETS_ID = '1gzjiGiZkyKeaE6f0iBKoeUNW7bbhemdQiipGknnd6Pc';
    localStorage.setItem('hubris_api_key', CONFIG.API_KEY);
    localStorage.setItem('hubris_sheets_id', CONFIG.SHEETS_ID);
    console.log('💾 Configurazione di default salvata in localStorage');
}
// Gestione sicura del GitHub Token
function getGitHubToken() {
    let token = localStorage.getItem('hubris_github_token');
    if (!token) {
        // Se non c'è, chiedi all'utente
        token = prompt('Inserisci il GitHub Token (verrà salvato localmente):');
        if (token && token.startsWith('ghp_')) {
            localStorage.setItem('hubris_github_token', token);
            showNotification('✅ Token GitHub salvato!', 'success');
        } else if (token) {
            showNotification('❌ Token non valido (deve iniziare con ghp_)', 'error');
            return null;
        }
    }
    return token;
}

// Funzione per verificare/aggiornare il token
window.updateGitHubToken = function() {
    const currentToken = localStorage.getItem('hubris_github_token');
    const newToken = prompt('Inserisci il nuovo GitHub Token:', currentToken || '');
    if (newToken && newToken.startsWith('ghp_')) {
        localStorage.setItem('hubris_github_token', newToken);
        showNotification('✅ Token GitHub aggiornato!', 'success');
        location.reload();
    } else if (newToken) {
        showNotification('❌ Token non valido', 'error');
    }
}
// AUTO-INIZIALIZZAZIONE
let autoInitAttempts = 0;
const maxAutoInitAttempts = 3;

function autoInitializeSystem() {
    if (localStorage.getItem('hubris_authenticated') !== 'true') {
        console.log('⏸️ Auto-init: In attesa di autenticazione...');
        return;
    }
    
    if (!CONFIG.API_KEY || !CONFIG.SHEETS_ID) {
        console.log('⚠️ Auto-init: Configurazione mancante');
        return;
    }
    
    // Controlla sia gapi che window.gapiLoaded
    if (typeof gapi === 'undefined' || !window.gapiLoaded) {
        autoInitAttempts++;
        if (autoInitAttempts < maxAutoInitAttempts) {
            console.log(`⏳ Auto-init: Google API non ancora caricata, riprovo... (${autoInitAttempts}/${maxAutoInitAttempts})`);
            setTimeout(autoInitializeSystem, 3000);
        } else {
            console.error('❌ Auto-init: Google API non si carica dopo 3 tentativi');
            showNotification('❌ Impossibile caricare Google API. Ricarica la pagina.', 'error');
        }
        return;
    }
    
    console.log('🚀 Auto-init: Avvio inizializzazione automatica API...');
    initializeGoogleAPI();
}

// Avvia auto-inizializzazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    
    // Aspetta un po' poi prova auto-init
    setTimeout(autoInitializeSystem, 2000);
});

// FIX per eliminare gli avvisi della console
document.addEventListener('DOMContentLoaded', function() {
    // Aggiungi name attribute a tutti gli input senza name o id
    document.querySelectorAll('input:not([id]):not([name])').forEach((input, index) => {
        input.setAttribute('name', 'input-field-' + index);
    });
    
    // Silenzia l'errore 404 di GitHub per cartelle non esistenti
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        return originalFetch.apply(this, args).catch(error => {
            // Se è un 404 su GitHub per le cartelle, ignoralo silenziosamente
            if (args[0] && args[0].includes('api.github.com') && error.status === 404) {
                console.log('📁 Cartella non ancora creata su GitHub - normale per nuovi mesi');
                return Promise.resolve({ ok: false, status: 404 });
            }
            throw error;
        });
    };
});
function checkAuthentication() {
    const isAuthenticated = localStorage.getItem('hubris_authenticated');
    if (isAuthenticated === 'true') {
        document.getElementById('loginOverlay').style.display = 'none';
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
        if (document.getElementById('passwordInput')) {
            document.getElementById('passwordInput').focus();
        }
    }
}

// STATO GLOBALE
let equipmentDatabase = {};
let savedQuotes = [];
let isConnected = false;
let gapi_loaded = false;
let rowCounter = 0;
let currentQuoteId = null;
let isEditMode = false;


    
// CONFIGURATION MODAL FUNCTIONS
// CONFIGURATION MODAL FUNCTIONS - GLOBALI
window.showConfigModal = function() {
    console.log('Opening config modal...');
    const modal = document.getElementById('configModal');
    if (modal) {
        document.getElementById('apiKeyInput').value = CONFIG.API_KEY || '';
        document.getElementById('sheetsIdInput').value = CONFIG.SHEETS_ID || '';
        modal.classList.add('active');
    } else {
        console.error('Config modal not found!');
    }
}

window.closeConfigModal = function() {
    const modal = document.getElementById('configModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

window.saveConfig = function() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const sheetsId = document.getElementById('sheetsIdInput').value.trim();
    
        // Validazione input
    if (!apiKey || !sheetsId) {
        showNotification('❌ Inserisci API Key e Sheets ID', 'error');
        return;
    }
    
    // Validazione formato API Key (deve iniziare con AIza)
    if (!apiKey.startsWith('AIza') || apiKey.length < 39) {
        showNotification('❌ API Key non valida (deve iniziare con AIza e avere 39 caratteri)', 'error');
        console.log('💡 Genera una nuova API Key da Google Cloud Console', 'info');
        return;
    }
    
    // Validazione formato Sheets ID (lunghezza minima)
    if (sheetsId.length < 20 || sheetsId.includes(' ')) {
        showNotification('❌ Sheets ID non valido (controlla di non avere spazi)', 'error');
        return;
    }
    
    console.log('💾 Salvataggio nuova configurazione...');
    
    try {
        // Reset stato precedente
        isConnected = false;
        gapi_loaded = false;
        
        // Salva nuova configurazione
        CONFIG.API_KEY = apiKey;
        CONFIG.SHEETS_ID = sheetsId;
        localStorage.setItem('hubris_api_key', apiKey);
        localStorage.setItem('hubris_sheets_id', sheetsId);
        
        closeConfigModal();
        console.log('⚙️ Configurazione salvata. Test connessione...', 'info');
        
        // Test immediato della configurazione
        if (typeof gapi !== 'undefined' && gapi.client) {
            // Se gapi è già caricato, reinizializza
            gapi.client.init({
                apiKey: CONFIG.API_KEY,
                discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
            }).then(() => {
                showNotification('🔄 Reinizializzazione API completata');
                initializeGoogleAPI();
            }).catch((error) => {
                console.error('❌ Errore reinizializzazione:', error);
                showNotification('❌ Errore: API Key non valida', 'error');
            });
        } else {
            // Altrimenti inizializza normalmente
            setTimeout(() => {
                showNotification('🔄 Avvio test connessione con nuova configurazione...');
                initializeGoogleAPI();
            }, 1500);
        }
        
    } catch (error) {
        console.error('❌ Errore salvataggio configurazione:', error);
        showNotification('❌ Errore nel salvataggio della configurazione', 'error');
    }

}

// GOOGLE SHEETS API INITIALIZATION
function initializeGoogleAPI() {
    if (!CONFIG.API_KEY || !CONFIG.SHEETS_ID) {
        console.log('⚙️ Configurazione API mancante - Clicca su Config');
        return;
    }
 if (typeof gapi === 'undefined') {
        console.error('❌ Google API non definita, attendo...');
        setTimeout(initializeGoogleAPI, 2000);
        return;
    }
    if (typeof updateConnectionStatus !== 'undefined') {
}
    
    // Verifica se gapi è disponibile
    if (typeof gapi === 'undefined') {
        console.error('Google API non caricata');
        showNotification('❌ Google API non caricata. Ricaricare la pagina.', 'error');
        return;
    }

    gapi.load('client', {
        callback: async () => {
            try {
                await gapi.client.init({
                    apiKey: CONFIG.API_KEY,
                    discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
                });
                
                gapi_loaded = true;
                isConnected = true;
                try {
                    // Prima verifica che il foglio esista
                    const testResponse = await gapi.client.sheets.spreadsheets.get({
                        spreadsheetId: CONFIG.SHEETS_ID
                    });
                    
                    if (testResponse && testResponse.result) {
                        showNotification('✅ Google Sheet verificato:', testResponse.result.properties.title);
                        await loadDatabaseFromSheets();
                        await loadQuotesFromGitHub();
                        showNotification('✅ Connessione Google Sheets stabilita!', 'success');
                    }
                } catch (loadError) {
                    console.error('Errore caricamento dati:', loadError);
                    
                    if (loadError.status === 403) {
                        showNotification('❌ API Key non valida o senza permessi', 'error');
                        console.log('💡 Genera una nuova API Key da Google Cloud Console', 'info');
                    } else if (loadError.status === 404) {
                        showNotification('❌ Google Sheet non trovato o non condiviso', 'error');
                    } else {
                        showNotification('⚠️ Connesso ma errore nel caricamento dati', 'warning');
                    }
                }
                
            } catch (error) {
                console.error('Errore inizializzazione API:', error);
                gapi_loaded = false;
                isConnected = false;
                console.log('Stato: offline - Errore connessione');
                
                // Messaggi di errore più specifici
                if (error.error && error.error.code === 400) {
                    showNotification('❌ API Key non valida - Verificare configurazione', 'error');
                    console.log('💡 Vai su Config e inserisci una API Key valida', 'info');
                } else if (error.message && error.message.includes('API key not valid')) {
                    showNotification('❌ API Key non valida o disabilitata', 'error');
                } else {
                    showNotification('❌ Errore connessione: ' + (error.message || 'Sconosciuto'), 'error');
                }
            }
        },
        onerror: (error) => {
            console.error('Errore caricamento gapi:', error);
            showNotification('❌ Errore nel caricamento delle API Google', 'error');
        }
    });
}
// GOOGLE SHEETS DATA LOADING
async function loadDatabaseFromSheets() {
    if (!gapi_loaded || !isConnected) {
        showNotification('⚠️ API non inizializzate, skippo caricamento database');
        return;
    }

    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SHEETS_ID,
            range: CONFIG.DATABASE_RANGE
        });

        console.log('📊 Risposta API ricevuta:', response);

        if (!response || !response.result) {
            throw new Error('Risposta API vuota');
        }

        const values = response.result.values;
        console.log('📋 Dati ricevuti:', values ? values.length + ' righe' : 'nessun dato');

        if (!values || values.length === 0) {
            throw new Error('Nessun dato trovato nel database. Verificare il range: ' + CONFIG.DATABASE_RANGE);
        }

        if (values.length < 2) {
            throw new Error('Database troppo piccolo (solo ' + values.length + ' righe)');
        }

        processEquipmentData(values);
        updateSyncTime();
        
        const categoriesCount = Object.keys(equipmentDatabase).length;
        let itemsCount = 0;
        Object.values(equipmentDatabase).forEach(cat => {
            itemsCount += Object.keys(cat).length;
        });

        console.log(`✅ Database caricato: ${categoriesCount} categorie, ${itemsCount} articoli`, 'success');

    } catch (error) {
        console.error('❌ Errore dettagliato caricamento database:', error);
        
        // Messaggi di errore più specifici
        if (error.status === 403) {
            showNotification('❌ Accesso negato. Verificare:', 'error');
            console.log('1️⃣ API Key abilitata per Sheets API', 'info');
            console.log('2️⃣ Google Sheet condiviso pubblicamente', 'info');
        } else if (error.status === 404) {
            showNotification('❌ Google Sheet non trovato. Verificare ID.', 'error');
        } else if (error.status === 400) {
            showNotification('❌ Richiesta non valida. Verificare range: ' + CONFIG.DATABASE_RANGE, 'error');
        } else if (error.message && error.message.includes('API key not valid')) {
            showNotification('❌ API Key non valida o disabilitata', 'error');
            console.log('💡 Genera una nuova API Key da Google Cloud Console', 'info');
        } else {
            showNotification('❌ Errore database: ' + (error.message || 'Sconosciuto'), 'error');
        }
    }
}

async function saveQuoteToGitHub(quote) {
    try {
        const token = getGitHubToken();
        if (!token) {
            showNotification('⚠️ Token GitHub mancante!', 'warning');
            return false;
        }

        // Crea struttura con anno/mese
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const fileName = `${year}/${month}/preventivo_${quote.id}.json`;
        
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(quote, null, 2))));
        
        let sha = null;
        try {
            const checkResponse = await fetch(
                `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${fileName}`,
                {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (checkResponse.ok) {
                const fileData = await checkResponse.json();
                sha = fileData.sha;
            }
        } catch (e) {
            console.log('File non esiste, verrà creato');
        }
        
        const response = await fetch(
            `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${fileName}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: `${sha ? 'Aggiorna' : 'Crea'} preventivo: ${quote.name}`,
                    content: content,
                    sha: sha
                })
            }
        );
        
        if (response.ok) {
            console.log('✅ Salvato su GitHub:', fileName);
            return true;
        } else {
            const error = await response.text();
            console.error('❌ Errore GitHub:', error);
            
            if (response.status === 401) {
                showNotification('❌ Token non valido o scaduto!', 'error');
                localStorage.removeItem('hubris_github_token');
            } else if (response.status === 404) {
                showNotification('❌ Repository non trovato o non accessibile', 'error');
            } else {
                showNotification('❌ Errore salvataggio: ' + response.status, 'error');
            }
            return false;
        }
    } catch (error) {
        console.error('❌ Errore connessione:', error);
        showNotification('❌ Errore di connessione a GitHub', 'error');
        return false;
    }
}

// DATA PROCESSING
function processEquipmentData(values) {
    if (!values || !Array.isArray(values) || values.length < 2) {
        console.error('❌ Dati non validi per processamento');
        showNotification('❌ Formato dati database non valido', 'error');
        return;
    }
    
    equipmentDatabase = {};
    const processedData = [];
    let currentCategory = '';
    let processedRows = 0;
    let skippedRows = 0;
    
    // Salta l'header (riga 0)
    for (let i = 1; i < values.length; i++) {
        const row = values[i];
        
        // Salta righe vuote o incomplete
        if (!row || row.length === 0) {
            skippedRows++;
            continue;
        }
        
        const name = (row[0] || '').toString().trim();
        const price1 = parseFloat(row[1]) || 0;
        const price3 = parseFloat(row[2]) || 0;
        const price7 = parseFloat(row[3]) || 0;
        const insurance = parseFloat(row[4]) || 0;
        const kit = (row[5] || '').toString().trim();
        const notes = (row[6] || '').toString().trim();
        const serial = (row[7] || '').toString().trim(); 
        
        // Logica migliorata per identificare categorie vs articoli
        if (name) {
            // È una categoria se ha solo nome e nessun prezzo
            if (!price1 && !price3 && !price7 && !insurance && !kit) {
                currentCategory = name;
                if (!equipmentDatabase[currentCategory]) {
                    equipmentDatabase[currentCategory] = {};
                }
                console.log('📁 Nuova categoria:', currentCategory);
            } 
            // È un articolo se ha almeno un prezzo E una categoria corrente
            else if (currentCategory && (price1 > 0 || price3 > 0 || price7 > 0)) {
                equipmentDatabase[currentCategory][name] = {
                    price1, price3, price7, insurance, kit, notes, serial
                };
                processedData.push({
                    category: currentCategory, 
                    name, 
                    price1, 
                    price3, 
                    price7, 
                    insurance, 
                    kit, 
                    notes
                });
                processedRows++;
            } else {
                skippedRows++;
            }
        } else {
            skippedRows++;
        }
    }
    
    console.log(`✅ Processamento completato: ${processedRows} articoli, ${skippedRows} righe saltate`);
    console.log(`📊 Categorie create: ${Object.keys(equipmentDatabase).length}`);
    
    // Verifica che ci siano dati processati
    if (processedRows === 0) {
        console.error('❌ Nessun articolo processato dal database');
        showNotification('❌ Nessun articolo trovato nel database', 'error');
        return;
    }
    
    // Aggiorna l'interfaccia
    renderDatabase(processedData);
    updateCategoryFilter();
    updateDbStats();
    
    console.log('🎯 Database processato e renderizzato con successo');
}

function parseQuotesData(values) {
    const quotes = [];
    for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (row && row.length >= 12) {
            quotes.push({
                id: parseInt(row[0]) || Date.now(),
                name: row[1] || '',
                cliente: row[2] || '',
                clientePiva: row[3] || '',
                contatti: row[4] || '',
                carico: row[5] || '',
                scarico: row[6] || '',
                durata: parseInt(row[7]) || 1,
                sconto: parseFloat(row[8]) || 0,
                total: parseFloat(row[9]) || 0,
                status: row[10] || 'draft',
                createdAt: row[11] || '',
                equipment: JSON.parse(row[12] || '[]')
            });
        }
    }
    return quotes;
}

// NUOVA FUNZIONE PER AGGIUNGERE SERVIZI
function addServiceRow() {
    rowCounter++;
    const tbody = document.getElementById('equipmentRows');
    const row = document.createElement('tr');
    row.className = 'equipment-row service-row';
    row.id = 'row-' + rowCounter;
    
    row.innerHTML = `
        <td style="width: 40px; padding: 12px 8px;">
            <span class="drag-handle">☰</span>
        </td>
        <td style="color: #f57c00; font-weight: bold; padding: 12px 8px;">🔧 SERVIZIO</td>
        <td style="padding: 12px 8px;">
            <input type="text" class="form-input" placeholder="Nome del servizio" 
                   id="service-name-${rowCounter}" style="width: 100%; margin-bottom: 8px;">
            <textarea class="form-input" placeholder="Note servizio..." 
                      id="service-notes-${rowCounter}" style="width: 100%; height: 50px; resize: vertical;"></textarea>
        </td>
        <td style="padding: 12px 8px; text-align: center;">
            <input type="number" class="form-input" value="1" min="1" 
       onchange="updateRowTotal(${rowCounter})" id="qty-${rowCounter}" 
       style="width: 80px; height: 40px; text-align: center; font-size: 16px; font-weight: bold; padding: 8px;">
        </td>
        <td style="padding: 12px 8px;">
          <input type="number" class="form-input" placeholder="0.00" min="0" step="0.01" 
           onchange="updateRowTotal(${rowCounter})" id="service-price-${rowCounter}" 
           style="width: 100%; height: 42px; text-align: right; font-size: 16px; font-weight: bold; padding: 10px;">
        </td>
        <td style="text-align: right; font-weight: bold; color: #f57c00; padding: 12px 8px;" id="total-${rowCounter}">€ 0.00</td>
        <td style="padding: 12px 8px;">
            <button class="btn btn-danger" onclick="removeRow(${rowCounter})" 
                    style="padding: 6px 12px; font-size: 12px;">✕</button>
        </td>
    `;
    tbody.appendChild(row);
    setupDragAndDrop(row);
}
// NUOVA FUNZIONE PER ATTREZZATURE CUSTOM
function addCustomEquipmentRow() {
    rowCounter++;
    const tbody = document.getElementById('equipmentRows');
    const row = document.createElement('tr');
    row.className = 'equipment-row custom-row';
    row.id = 'row-' + rowCounter;
    row.style.background = '#fffbf0'; // Colore leggermente diverso per distinguerle
    
    row.innerHTML = `
        <td style="width: 40px; padding: 12px 8px;">
            <span class="drag-handle">☰</span>
        </td>
        <td style="padding: 12px 8px;">
            <input type="text" class="form-input" placeholder="Categoria custom..." 
                   id="custom-category-${rowCounter}" 
                   value="CUSTOM"
                   style="width: 100%; background: #fff3cd; border: 2px solid #ffc107;">
        </td>
        <td style="padding: 12px 8px;">
            <input type="text" class="form-input" placeholder="Nome attrezzatura..." 
                   id="custom-equipment-${rowCounter}" 
                   style="width: 100%; margin-bottom: 8px;">
            <textarea class="form-input" placeholder="Kit/Note..." 
                      id="custom-kit-${rowCounter}" 
                      style="width: 100%; height: 50px; resize: vertical;"></textarea>
        </td>
        <td style="padding: 12px 8px; text-align: center;">
            <input type="number" class="form-input" value="1" min="1" 
                   onchange="updateCustomRowTotal(${rowCounter})" 
                   id="custom-qty-${rowCounter}" 
                   style="width: 80px; height: 40px; text-align: center; font-size: 16px; font-weight: bold;">
        </td>
        <td style="padding: 12px 8px;">
            <input type="number" class="form-input" placeholder="0.00" min="0" step="0.01" 
                   onchange="updateCustomRowTotal(${rowCounter})" 
                   id="custom-price-${rowCounter}" 
                   style="width: 100%; height: 42px; text-align: right; font-size: 16px; font-weight: bold;">
        </td>
        <td style="text-align: right; font-weight: bold; color: #ff9800; padding: 12px 8px;" 
            id="custom-total-${rowCounter}">€ 0.00</td>
        <td style="padding: 12px 8px;">
            <button class="btn btn-danger" onclick="removeRow(${rowCounter})" 
                    style="padding: 6px 12px; font-size: 12px;">✕</button>
        </td>
    `;
    
    tbody.appendChild(row);
    setupDragAndDrop(row);
    
    // Focus sul campo nome attrezzatura
    setTimeout(() => {
        document.getElementById('custom-equipment-' + rowCounter).focus();
    }, 100);
    
    showNotification('📦 Riga custom aggiunta - Compila tutti i campi manualmente', 'info');
}

// FUNZIONE PER AGGIORNARE TOTALE RIGA CUSTOM
function updateCustomRowTotal(rowId) {
    const quantity = parseFloat(document.getElementById('custom-qty-' + rowId).value) || 0;
    const price = parseFloat(document.getElementById('custom-price-' + rowId).value) || 0;
    const total = quantity * price;
    
    document.getElementById('custom-total-' + rowId).textContent = '€ ' + total.toFixed(2);
    updateTotals();
}

// UI RENDERING
function renderDatabase(data) {
    const tbody = document.getElementById('databaseBody');
    tbody.innerHTML = '';
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #666;">Nessun dato disponibile. Configura le API per caricare il database.</td></tr>';
        return;
    }
    let currentCategory = '';
    data.forEach((item, index) => {
        if (item.category !== currentCategory) {
            const categoryRow = document.createElement('tr');
            categoryRow.className = 'category-row';
            categoryRow.innerHTML = '<td colspan="7" style="text-align: center; font-weight: bold;">📁 ' + item.category + '</td>';
            tbody.appendChild(categoryRow);
            currentCategory = item.category;
        }
        const row = document.createElement('tr');
       row.innerHTML = '<td style="font-weight: 500;">' + item.name + '</td>' +
    '<td>€ ' + item.price1.toFixed(2) + '</td>' +
    '<td>€ ' + item.price3.toFixed(2) + '</td>' +
    '<td>€ ' + item.price7.toFixed(2) + '</td>' +
    '<td>€ ' + item.insurance.toLocaleString() + '</td>' +
    '<td style="font-size: 12px; color: #666; max-width: 200px;">' + (item.kit || '') + '</td>' +  // AGGIUNGI || '' QUI
    '<td style="font-size: 12px; color: #999;">' + (item.serial || '-') + '</td>' +
    '<td><button class="btn btn-warning" onclick="editEquipment(\'' + item.category + '\', \'' + item.name + '\')" style="padding: 6px 12px; font-size: 12px;">✏️</button></td>';
        tbody.appendChild(row);
    });
}

function updateCategoryFilter() {
    const filter = document.getElementById('categoryFilter');
    filter.innerHTML = '<option value="">Tutte le categorie</option>';
    Object.keys(equipmentDatabase).forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        filter.appendChild(option);
    });
}

function updateDbStats() {
    const totalCategories = Object.keys(equipmentDatabase).length;
    let totalItems = 0;
    Object.values(equipmentDatabase).forEach(category => {
        totalItems += Object.keys(category).length;
    });
    document.getElementById('dbStats').textContent = totalCategories + ' categorie, ' + totalItems + ' attrezzature';
}
    function renderSavedQuotes() {
    const container = document.getElementById('savedQuotes');
    container.innerHTML = '';
    if (savedQuotes.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666; grid-column: 1/-1;"><h3>Nessun preventivo salvato</h3><p>Crea il tuo primo preventivo nella sezione "Nuovo Preventivo"</p></div>';
        return;
    }
    savedQuotes.forEach(quote => {
        const div = document.createElement('div');
        div.className = 'quote-card';
        div.innerHTML = '<div class="quote-title">' + quote.name + '</div>' +
                       '<div class="quote-meta">' +
                       '<strong>Cliente:</strong> ' + quote.cliente + 
                       (quote.clientePiva ? '<br><strong>P.IVA:</strong> ' + quote.clientePiva : '') + 
                       '<br><strong>Durata:</strong> ' + quote.durata + ' giorni' +
                       '<br><strong>Totale:</strong> € ' + quote.total.toFixed(2) + 
                       '<br><strong>Creato:</strong> ' + quote.createdAt + '</div>' +
                       '<div style="margin-top: 15px;">' +
                       '<span class="status-badge status-' + quote.status + '">' + 
                       (quote.status === 'draft' ? 'Bozza' : quote.status === 'sent' ? 'Inviato' : 'Confermato') + 
                       '</span>' +
                       '<div style="margin-top: 10px;">' +
                       '<button class="btn btn-primary" onclick="loadQuoteById(' + quote.id + ')" style="padding: 6px 12px; font-size: 12px;">📂</button> ' +
                       '<button class="btn btn-info" onclick="generateQuotePDF(' + quote.id + ')" style="padding: 6px 12px; font-size: 12px;">📄</button> ' +
                       '<button class="btn btn-warning" onclick="generateDDTFromQuote(' + quote.id + ')" style="padding: 6px 12px; font-size: 12px;">🚛</button> ' +
                        '<button class="btn btn-info" onclick="openInsuranceForQuote(' + quote.id + ')" style="padding: 6px 12px; font-size: 12px;" title="Gestione Assicurazione">🛡️</button> ' +
                       '<button class="btn btn-warning" onclick="duplicateQuoteById(' + quote.id + ')" style="padding: 6px 12px; font-size: 12px;">📄</button> ' +
                       '<button class="btn btn-danger" onclick="deleteQuote(' + quote.id + ')" style="padding: 6px 12px; font-size: 12px;">🗑️</button>' +
                       '</div></div>';
        container.appendChild(div);
    });
}

// TAB MANAGEMENT
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    if (tabName === 'analytics') {
        updateAnalytics();
    }
}
    
async function loadQuotesFromGitHub() {
    try {
        const token = getGitHubToken();
        if (!token) {
            console.log('⚠️ Token GitHub mancante, uso solo localStorage');
            const stored = localStorage.getItem('hubris_quotes');
            if (stored) {
                try {
                    savedQuotes = JSON.parse(stored);
                    renderSavedQuotes();
                } catch (e) {
                    console.error('Errore parsing localStorage:', e);
                    savedQuotes = [];
                    renderSavedQuotes();
                }
            }
            return;
        }
        
        console.log('📂 Caricamento preventivi da GitHub...');
        
        // Funzione ricorsiva per leggere cartelle
        async function readDirectory(path = '') {
            try {
                const response = await fetch(
                    `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${path}`,
                    {
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                
                if (!response.ok) {
                    if (response.status === 404) {
                        console.log('📁 Cartella non trovata:', path);
                        return [];
                    }
                    if (response.status === 401) {
                        throw new Error('Token non valido');
                    }
                    console.error('Errore risposta:', response.status);
                    return [];
                }
                
                const items = await response.json();
                const jsonFiles = [];
                
                for (const item of items) {
                    if (item.type === 'dir') {
                        // Se è una cartella, leggila ricorsivamente
                        const subFiles = await readDirectory(item.path);
                        jsonFiles.push(...subFiles);
                    } else if (item.name.startsWith('preventivo_') && item.name.endsWith('.json')) {
                        jsonFiles.push(item);
                    }
                }
                
                return jsonFiles;
            } catch (error) {
                console.error('Errore lettura directory:', path, error);
                return [];
            }
        }
        
        const files = await readDirectory();
        const preventivi = [];
        let erroriCaricamento = 0;
        
// Carica ogni file con gestione errori migliorata
for (const file of files) {
    try {
        console.log('📄 Caricamento file:', file.name);
        const fileResponse = await fetch(file.download_url);
        
        if (!fileResponse.ok) {
            console.warn('⚠️ Impossibile scaricare:', file.name);
            continue;
        }
        
        const fileText = await fileResponse.text();
        
        // Prova a parsare il JSON
        try {
            const quote = JSON.parse(fileText);
            
            // Valida che abbia i campi minimi necessari
            if (quote && quote.id) {
                // Pulisci eventuali caratteri problematici
                if (quote.name) quote.name = quote.name.replace(/'/g, "'");
                if (quote.cliente) quote.cliente = quote.cliente.replace(/'/g, "'");
                
                preventivi.push(quote);
                console.log('✅ Caricato:', quote.name || 'Senza nome');
            } else {
                console.warn('⚠️ Preventivo senza ID:', file.name);
            }
        } catch (parseError) {
            console.error('❌ Errore parsing JSON per', file.name, ':', parseError.message);
            console.log('Primi 200 caratteri:', fileText.substring(0, 200));
            erroriCaricamento++;
            
            // NON bloccare il caricamento degli altri
            continue;
        }
    } catch (e) {
        console.error('❌ Errore caricamento file:', file.name, e);
        erroriCaricamento++;
        continue; // Continua con il prossimo file
    }
}
        
        if (erroriCaricamento > 0) {
            showNotification(`⚠️ ${erroriCaricamento} preventivi con errori non caricati`, 'warning');
        }
        
        // Salva i preventivi validi
        if (preventivi.length > 0) {
            savedQuotes = preventivi.sort((a, b) => (b.id || 0) - (a.id || 0));
            localStorage.setItem('hubris_quotes', JSON.stringify(savedQuotes));
            renderSavedQuotes();
            console.log(`✅ Caricati ${preventivi.length} preventivi da GitHub`);
            showNotification(`✅ Caricati ${preventivi.length} preventivi`, 'success');
        } else {
            console.log('⚠️ Nessun preventivo valido trovato su GitHub');
            
            // Prova il fallback su localStorage
            const stored = localStorage.getItem('hubris_quotes');
            if (stored) {
                try {
                    savedQuotes = JSON.parse(stored);
                    renderSavedQuotes();
                    showNotification('📂 Caricati preventivi da backup locale', 'info');
                } catch (e) {
                    savedQuotes = [];
                    renderSavedQuotes();
                }
            } else {
                savedQuotes = [];
                renderSavedQuotes();
            }
        }
        
    } catch (error) {
        console.error('❌ Errore caricamento da GitHub:', error);
        
        if (error.message === 'Token non valido') {
            showNotification('❌ Token GitHub non valido!', 'error');
            localStorage.removeItem('hubris_github_token');
        } else {
            showNotification('❌ Errore connessione GitHub', 'error');
        }
        
        // Fallback su localStorage
        const stored = localStorage.getItem('hubris_quotes');
        if (stored) {
            try {
                savedQuotes = JSON.parse(stored);
                renderSavedQuotes();
                showNotification('⚠️ Caricamento da backup locale', 'warning');
            } catch (e) {
                savedQuotes = [];
                renderSavedQuotes();
            }
        } else {
            savedQuotes = [];
            renderSavedQuotes();
        }
    }
}

// NUOVA FUNZIONE - TEST CONNESSIONE
async function testConnection() {
    if (!CONFIG.API_KEY || !CONFIG.SHEETS_ID) {
        console.log('⚙️ Configurazione mancante per il test', 'warning');
        return false;
    }
    
    console.log('🧪 Test connessione Google Sheets...');
    
    try {
        // Test semplice: prova a leggere una cella qualsiasi
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SHEETS_ID,
            range: 'A1:A1' // Solo una cella per test veloce
        });
        
        if (response && response.result) {
            showNotification('✅ Test connessione riuscito');
            showNotification('✅ Connessione Google Sheets verificata!', 'success');
            return true;
        } else {
            throw new Error('Risposta vuota dal test');
        }
        
    } catch (error) {
        console.error('❌ Test connessione fallito:', error);
        
        // Messaggi di errore specifici
        if (error.message.includes('API_KEY_INVALID')) {
            showNotification('❌ API Key non valida', 'error');
        } else if (error.message.includes('PERMISSION_DENIED')) {
            showNotification('❌ Accesso negato - verificare condivisione Sheet', 'error');
        } else if (error.message.includes('NOT_FOUND')) {
            showNotification('❌ Google Sheet non trovato', 'error');
        } else {
            showNotification('❌ Test connessione fallito: ' + error.message, 'error');
        }
        
        return false;
    }
}
// QUOTE MANAGEMENT
function addEquipmentRow() {
    if (Object.keys(equipmentDatabase).length === 0) {
        showNotification('⚠️ Carica prima il database delle attrezzature', 'warning');
        return;
    }
    rowCounter++;
    const tbody = document.getElementById('equipmentRows');
    const row = document.createElement('tr');
    row.className = 'equipment-row';
    row.id = 'row-' + rowCounter;
    row.draggable = true;
    row.style.background = '#f8f9ff';
    
    row.innerHTML = `
    <td style="width: 40px;">
        <span class="drag-handle">☰</span>
        <div class="move-buttons">
            <button class="move-btn" onclick="moveRow(${rowCounter}, -1)">↑</button>
            <button class="move-btn" onclick="moveRow(${rowCounter}, 1)">↓</button>
        </div>
    </td>
        <td>
            <div class="select-search-wrapper">
                <input type="text" class="form-input" 
                    placeholder="Cerca categoria..." 
                    id="search-cat-${rowCounter}"
                    onclick="toggleSearchDropdown(${rowCounter}, 'category')"
                    onkeyup="filterSearchDropdown(${rowCounter}, 'category')"
                    autocomplete="off">
                <div class="select-search" id="dropdown-cat-${rowCounter}">
                    <input type="text" class="select-search-input" 
                        placeholder="Digita per cercare..." 
                        onkeyup="filterSearchDropdown(${rowCounter}, 'category')">
                    <div id="options-cat-${rowCounter}">
                        ${Object.keys(equipmentDatabase).map(cat => 
                            `<div class="select-search-item" onclick="selectCategory(${rowCounter}, '${cat}')">${cat}</div>`
                        ).join('')}
                    </div>
                </div>
            </div>
            <input type="hidden" id="category-${rowCounter}">
        </td>
        <td>
           <div class="select-search-wrapper">
    <input type="text" class="form-input" 
        placeholder="Cerca attrezzatura..." 
        id="search-eq-${rowCounter}"
        onclick="toggleSearchDropdown(${rowCounter}, 'equipment')"
        onkeyup="filterSearchDropdown(${rowCounter}, 'equipment')"
        onblur="updateCustomEquipmentName(${rowCounter})"
        autocomplete="off"
        disabled>
                <div class="select-search" id="dropdown-eq-${rowCounter}">
                    <input type="text" class="select-search-input" 
                        placeholder="Digita per cercare..." 
                        onkeyup="filterSearchDropdown(${rowCounter}, 'equipment')">
                    <div id="options-eq-${rowCounter}"></div>
                </div>
            </div>
            <input type="hidden" id="equipment-${rowCounter}">
            <textarea class="editable-input" 
    id="kit-${rowCounter}" 
    placeholder="Kit/Note personalizzate..." 
    style="margin-top: 5px; font-size: 12px; color: #666; width: 100%; min-height: 30px; resize: vertical;"
    onfocus="this.style.height='80px'" 
    onblur="if(!this.value) this.style.height='30px'"></textarea>
        </td>
        <td>
            <input type="number" class="form-input" value="1" min="1" 
       onchange="updateRowTotal(${rowCounter})" id="qty-${rowCounter}" 
       style="width: 80px; height: 40px; text-align: center; font-size: 16px; font-weight: bold; padding: 8px;">
        </td>
       <td>
            <input type="text" class="form-input" 
                id="price-${rowCounter}" 
                value="€ 0.00" 
                onchange="updateCustomPrice(${rowCounter})"
                style="width: 100%; height: 42px; text-align: right; font-weight: bold; color: #2e7d32; font-size: 16px; padding: 10px;">
        </td>
        <td style="text-align: right; font-weight: bold; color: #2e7d32; font-size: 18px; padding: 12px;" id="total-${rowCounter}">€ 0.00</td>
        <td>
            <button class="btn btn-danger" onclick="removeRow(${rowCounter})" 
                style="padding: 6px 12px; font-size: 12px;">✕</button>
        </td>
    `;
    
    tbody.appendChild(row);
    
    // Setup drag & drop
    setupDragAndDrop(row);
    
    // Close dropdowns on click outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.select-search-wrapper')) {
            document.querySelectorAll('.select-search').forEach(d => d.classList.remove('active'));
        }
    });
}

    // DRAG & DROP FUNCTIONS
function setupDragAndDrop(row) {
    row.addEventListener('dragstart', function(e) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
        this.classList.add('dragging');
        window.draggedRow = this;
    });
    
    row.addEventListener('dragend', function(e) {
        this.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(r => r.classList.remove('drag-over'));
    });
    
    row.addEventListener('dragover', function(e) {
        if (e.preventDefault) e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.classList.add('drag-over');
        return false;
    });
    
    row.addEventListener('dragleave', function(e) {
        this.classList.remove('drag-over');
    });
    
    row.addEventListener('drop', function(e) {
        if (e.stopPropagation) e.stopPropagation();
        if (window.draggedRow !== this) {
            this.parentNode.insertBefore(window.draggedRow, this.nextSibling);
        }
        return false;
    });
}

// MOVE ROW FUNCTIONS
function moveRow(rowId, direction) {
    const row = document.getElementById('row-' + rowId);
    if (!row) return;
    
    if (direction === -1 && row.previousElementSibling) {
        row.parentNode.insertBefore(row, row.previousElementSibling);
    } else if (direction === 1 && row.nextElementSibling) {
        row.parentNode.insertBefore(row.nextElementSibling, row);
    }
}

function toggleSearchDropdown(rowId, type) {
    const dropdown = document.getElementById(`dropdown-${type === 'category' ? 'cat' : 'eq'}-${rowId}`);
    const row = document.getElementById(`row-${rowId}`);
    const input = document.getElementById(`search-${type === 'category' ? 'cat' : 'eq'}-${rowId}`);
    const wasActive = dropdown.classList.contains('active');
    
    // Close all dropdowns
    document.querySelectorAll('.select-search').forEach(d => d.classList.remove('active'));
    document.querySelectorAll('.equipment-row').forEach(r => r.classList.remove('dropdown-open'));
    
    // Toggle this dropdown
    if (!wasActive) {
        // Calcola posizione dinamica
        const rect = input.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = (rect.bottom + 2) + 'px';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.width = rect.width + 'px';
        
        dropdown.classList.add('active');
        row.classList.add('dropdown-open');
        
        // Focus sulla ricerca interna
        const searchInput = dropdown.querySelector('.select-search-input');
        if (searchInput) {
            searchInput.focus();
        }
    }
}
// Previeni la chiusura del dropdown quando si clicca al suo interno
document.addEventListener('click', function(e) {
    // Se il click è dentro un dropdown, non chiuderlo
    if (e.target.closest('.select-search')) {
        e.stopPropagation();
        return;
    }
    
    // Se il click è su un input di ricerca, non chiudere
    if (e.target.matches('[id^="search-"]')) {
        return;
    }
    
    // Altrimenti chiudi tutti i dropdown
    if (!e.target.closest('.select-search-wrapper')) {
        document.querySelectorAll('.select-search').forEach(d => d.classList.remove('active'));
        document.querySelectorAll('.equipment-row').forEach(r => r.classList.remove('dropdown-open'));
    }
});
function filterSearchDropdown(rowId, type) {
    const searchInput = event.target;
    const searchTerm = searchInput.value.toLowerCase();
    const optionsContainer = document.getElementById(`options-${type === 'category' ? 'cat' : 'eq'}-${rowId}`);
    
    if (type === 'category') {
        const filtered = Object.keys(equipmentDatabase).filter(cat => 
            cat.toLowerCase().includes(searchTerm)
        );
        
        optionsContainer.innerHTML = filtered.map(cat => 
            `<div class="select-search-item" onclick="selectCategory(${rowId}, this)" data-category="${cat.replace(/'/g, '&apos;').replace(/"/g, '&quot;')}">${cat}</div>`
        ).join('');
    } else {
        const category = document.getElementById('category-' + rowId).value;
        if (!category) return;
        
        const items = Object.keys(equipmentDatabase[category]);
        const filtered = items.filter(item => 
            item.toLowerCase().includes(searchTerm) || 
            category.toLowerCase().includes(searchTerm)
        );
        
        optionsContainer.innerHTML = filtered.map(item => 
            `<div class="select-search-item" onclick="selectEquipment(${rowId}, this)" data-equipment="${item.replace(/'/g, '&apos;').replace(/"/g, '&quot;')}" data-category="${category}">
                ${item} <span class="category-label">${category}</span>
            </div>`
        ).join('');
    }
}

function selectCategory(rowId, categoryElement) {
    const category = categoryElement.dataset ? categoryElement.dataset.category : categoryElement;
    document.getElementById('search-cat-' + rowId).value = category;
    document.getElementById('dropdown-cat-' + rowId).classList.remove('active');
    document.getElementById('category-' + rowId).value = category;
    
    // Enable equipment search
    document.getElementById('search-eq-' + rowId).disabled = false;
    document.getElementById('search-eq-' + rowId).placeholder = 'Cerca in ' + category + '...';
    
    // Populate equipment options
    const items = Object.keys(equipmentDatabase[category]);
    const optionsContainer = document.getElementById('options-eq-' + rowId);
    optionsContainer.innerHTML = items.map(item => 
       `<div class="select-search-item" onclick="selectEquipment(${rowId}, this)" data-equipment="${item.replace(/'/g, '&apos;').replace(/"/g, '&quot;')}" data-category="${category}">
    ${item} <span class="category-label">${category}</span>
</div>`
    ).join('');
    
    // Reset equipment selection
    document.getElementById('equipment-' + rowId).value = '';
    document.getElementById('search-eq-' + rowId).value = '';
    document.getElementById('price-' + rowId).value = '€ 0.00';
    document.getElementById('total-' + rowId).textContent = '€ 0.00';
    updateTotals();
}

function selectEquipment(rowId, equipmentElement) {
    const equipment = equipmentElement.dataset ? equipmentElement.dataset.equipment : equipmentElement;
    const category = document.getElementById('category-' + rowId).value;
    
    document.getElementById('equipment-' + rowId).value = equipment;
    document.getElementById('search-eq-' + rowId).value = equipment;
    document.getElementById('dropdown-eq-' + rowId).classList.remove('active');
    
    // Dopo aver selezionato, rendi il campo modificabile
    const searchField = document.getElementById('search-eq-' + rowId);
    searchField.style.backgroundColor = '#fff';
    searchField.style.borderColor = '#2c5aa0';
    searchField.title = 'Puoi modificare il nome dell\'attrezzatura';
    
    if (category && equipment && equipmentDatabase[category][equipment]) {
        const data = equipmentDatabase[category][equipment];
        const duration = parseInt(document.getElementById('durata').value);
        const price = calculatePrice(data.price1, data.price3, data.price7, duration);
        document.getElementById('price-' + rowId).value = '€ ' + price.toFixed(2);
        
        // Set default kit info but keep it editable
        if (data.kit && !document.getElementById('kit-' + rowId).value) {
            document.getElementById('kit-' + rowId).value = data.kit;
        }
        
        updateRowTotal(rowId);
    }
}

function updateCustomPrice(rowId) {
    const priceInput = document.getElementById('price-' + rowId);
    let value = priceInput.value.replace('€', '').replace(',', '.').trim();
    const price = parseFloat(value) || 0;
    priceInput.value = '€ ' + price.toFixed(2);
    updateRowTotal(rowId);
}
function updateCustomEquipmentName(rowId) {
    const searchInput = document.getElementById('search-eq-' + rowId);
    const hiddenInput = document.getElementById('equipment-' + rowId);
    
    if (searchInput && hiddenInput) {
        // Aggiorna il valore nascosto con il nome modificato
        hiddenInput.value = searchInput.value;
        console.log('📝 Nome attrezzatura aggiornato:', searchInput.value);
    }
}
function updateEquipmentOptions(rowId) {
    const categorySelect = document.getElementById('category-' + rowId);
    const equipmentSelect = document.getElementById('equipment-' + rowId);
    const category = categorySelect.value;
    equipmentSelect.innerHTML = '<option value="">Seleziona attrezzatura...</option>';
    if (category && equipmentDatabase[category]) {
        equipmentSelect.disabled = false;
        Object.keys(equipmentDatabase[category]).forEach(equipment => {
            const option = document.createElement('option');
            option.value = equipment;
            option.textContent = equipment;
            equipmentSelect.appendChild(option);
        });
    } else {
        equipmentSelect.disabled = true;
    }
    document.getElementById('kit-' + rowId).textContent = '';
    document.getElementById('price-' + rowId).textContent = '€ 0.00';
    document.getElementById('total-' + rowId).textContent = '€ 0.00';
    updateTotals();
}

function updateRowData(rowId) {
    const categorySelect = document.getElementById('category-' + rowId);
    const equipmentSelect = document.getElementById('equipment-' + rowId);
    const category = categorySelect.value;
    const equipment = equipmentSelect.value;
    if (category && equipment && equipmentDatabase[category][equipment]) {
        const data = equipmentDatabase[category][equipment];
        const duration = parseInt(document.getElementById('durata').value);
        const price = calculatePrice(data.price1, data.price3, data.price7, duration);
        document.getElementById('price-' + rowId).textContent = '€ ' + price.toFixed(2);
        document.getElementById('kit-' + rowId).textContent = data.kit;
        updateRowTotal(rowId);
    }
}

function calculatePrice(price1, price3, price7, duration) {
    if (duration === 1) return price1;
    if (duration === 2) return price1 * 2;
    if (duration === 3) return price3;
    if (duration === 4) return price3 + price1;
    if (duration === 5) return price7;
    if (duration === 6) return price7 + price1;
    if (duration === 7) return price7 + (price1 * 2);
    if (duration === 8) return price7 + price3;
    if (duration === 9) return price7 + price3 + price1;
    if (duration >= 10) return price7 * 2;
    return price1;
}

function updateRowTotal(rowId) {
    const row = document.getElementById('row-' + rowId);
    let price = 0;
    let quantity = parseInt(document.getElementById('qty-' + rowId).value) || 0;
    
    if (row.classList.contains('service-row')) {
        price = parseFloat(document.getElementById('service-price-' + rowId).value) || 0;
    } else {
        const priceText = document.getElementById('price-' + rowId).value;
        price = parseFloat(priceText.replace('€ ', '')) || 0;
    }
    
    const total = price * quantity;
    document.getElementById('total-' + rowId).textContent = '€ ' + total.toFixed(2);
    updateTotals();
}

function updateAllPrices() {
    const rows = document.querySelectorAll('[id^="row-"]');
    rows.forEach(row => {
        const rowId = row.id.split('-')[1];
        if (!row.classList.contains('service-row')) {
            // Ricalcola il prezzo basato sulla durata
            const category = document.getElementById('category-' + rowId)?.value;
            const equipment = document.getElementById('equipment-' + rowId)?.value;
            
            if (category && equipment && equipmentDatabase[category] && equipmentDatabase[category][equipment]) {
                const data = equipmentDatabase[category][equipment];
                const duration = parseInt(document.getElementById('durata').value);
                const price = calculatePrice(data.price1, data.price3, data.price7, duration);
                document.getElementById('price-' + rowId).value = '€ ' + price.toFixed(2);
                updateRowTotal(rowId);
            }
        }
    });
}

function updateTotals() {
    let subtotal = 0;
    
    // Calcola totali da TUTTE le righe (normali, custom e servizi)
    const allRows = document.querySelectorAll('[id^="row-"]');
    
    allRows.forEach(row => {
        const rowId = row.id.split('-')[1];
        
        if (row.classList.contains('service-row')) {
            // Totale servizi
            const totalElement = document.getElementById('total-' + rowId);
            if (totalElement) {
                const value = parseFloat(totalElement.textContent.replace('€ ', '')) || 0;
                subtotal += value;
            }
        } else if (row.classList.contains('custom-row')) {
            // Totale custom
            const totalElement = document.getElementById('custom-total-' + rowId);
            if (totalElement) {
                const value = parseFloat(totalElement.textContent.replace('€ ', '')) || 0;
                subtotal += value;
            }
        } else {
            // Totale attrezzature normali
            const totalElement = document.getElementById('total-' + rowId);
            if (totalElement) {
                const value = parseFloat(totalElement.textContent.replace('€ ', '')) || 0;
                subtotal += value;
            }
        }
    });
    
    const discountPercent = parseFloat(document.getElementById('sconto').value) || 0;
    const discountAmount = subtotal * (discountPercent / 100);
    const imponibile = subtotal - discountAmount;
    const iva = imponibile * 0.22;
    const totale = imponibile + iva;
    
    document.getElementById('subtotale').textContent = '€ ' + subtotal.toFixed(2);
    document.getElementById('discount-percent').textContent = discountPercent.toFixed(1);
    document.getElementById('sconto-amount').textContent = '€ ' + discountAmount.toFixed(2);
    document.getElementById('imponibile').textContent = '€ ' + imponibile.toFixed(2);
    document.getElementById('iva').textContent = '€ ' + iva.toFixed(2);
    document.getElementById('totale').textContent = '€ ' + totale.toFixed(2);
}
// GESTIONE SUBTOTALE SBARRATO
function toggleCrossedSubtotal() {
    const checkbox = document.getElementById('enable-crossed-subtotal');
    const input = document.getElementById('crossed-subtotal-input');
    const line = document.getElementById('crossed-subtotal-line');
    
    if (checkbox.checked) {
        input.style.display = 'inline-block';
        input.focus();
        if (parseFloat(input.value) > 0) {
            line.style.display = 'flex';
        }
    } else {
        input.style.display = 'none';
        line.style.display = 'none';
        input.value = '0';
        updateCrossedSubtotal();
    }
}

function updateCrossedSubtotal() {
    const input = document.getElementById('crossed-subtotal-input');
    const line = document.getElementById('crossed-subtotal-line');
    const crossedElement = document.getElementById('crossed-subtotal');
    const checkbox = document.getElementById('enable-crossed-subtotal');
    
    const value = parseFloat(input.value) || 0;
    
    if (checkbox.checked && value > 0) {
        crossedElement.textContent = '€ ' + value.toFixed(2);
        line.style.display = 'flex';
    } else {
        line.style.display = 'none';
    }
}

function getCrossedSubtotalValue() {
    const checkbox = document.getElementById('enable-crossed-subtotal');
    const input = document.getElementById('crossed-subtotal-input');
    
    if (checkbox.checked && parseFloat(input.value) > 0) {
        return parseFloat(input.value);
    }
    return 0;
}
function removeRow(rowId) {
    const row = document.getElementById('row-' + rowId);
    if (row) {
        row.remove();
        updateTotals();
    }
}

function saveQuote() {
    const quoteName = document.getElementById('quoteName').value;
    if (!quoteName) {
        showNotification('❌ Inserisci un nome per il preventivo!', 'error');
        return;
    }
    
    let quote;
    
    if (isEditMode && currentQuoteId) {
        // MODALITÀ AGGIORNAMENTO
        const existingIndex = savedQuotes.findIndex(q => q.id === currentQuoteId);
        if (existingIndex === -1) {
            showNotification('❌ Preventivo originale non trovato!', 'error');
            return;
        }
        
        quote = {
            id: currentQuoteId, // Mantieni l'ID originale
            name: quoteName,
            cliente: document.getElementById('cliente').value,
            clientePiva: document.getElementById('clientePiva').value,
            clienteVia: document.getElementById('clienteVia').value,
            clientePec: document.getElementById('clientePec').value,
            codiceUnivoco: document.getElementById('codiceUnivoco').value,
            contatti: document.getElementById('contatti').value,
            carico: document.getElementById('carico').value,
            scarico: document.getElementById('scarico').value,
            durata: document.getElementById('durata').value,
            sconto: document.getElementById('sconto').value,
            equipment: [],
            createdAt: savedQuotes[existingIndex].createdAt, // Mantieni data originale
            updatedAt: new Date().toLocaleString('it-IT'), // Aggiungi data aggiornamento
            status: savedQuotes[existingIndex].status, // Mantieni status
            total: parseFloat(document.getElementById('totale').textContent.replace('€ ', '')) || 0,
            crossedSubtotal: getCrossedSubtotalValue(),
            showCrossedSubtotal: document.getElementById('enable-crossed-subtotal').checked
        };
        
        // Aggiorna l'array esistente
        savedQuotes[existingIndex] = quote;
        
    } else {
        // MODALITÀ NUOVO PREVENTIVO
        quote = {
            id: Date.now(),
            name: quoteName,
            cliente: document.getElementById('cliente').value,
            clientePiva: document.getElementById('clientePiva').value,
            clienteVia: document.getElementById('clienteVia').value,
            clientePec: document.getElementById('clientePec').value,
            codiceUnivoco: document.getElementById('codiceUnivoco').value,
            contatti: document.getElementById('contatti').value,
            carico: document.getElementById('carico').value,
            scarico: document.getElementById('scarico').value,
            durata: document.getElementById('durata').value,
            sconto: document.getElementById('sconto').value,
            equipment: [],
            createdAt: new Date().toLocaleString('it-IT'),
            status: 'draft',
            total: parseFloat(document.getElementById('totale').textContent.replace('€ ', '')) || 0,
            crossedSubtotal: getCrossedSubtotalValue(),
            showCrossedSubtotal: document.getElementById('enable-crossed-subtotal').checked
        };
        
        // Aggiungi nuovo preventivo
        savedQuotes.push(quote);
    }
    
    // Salva attrezzature e servizi
document.querySelectorAll('[id^="row-"]').forEach(row => {
    const rowId = row.id.split('-')[1];
    
    if (row.classList.contains('service-row')) {
        // SERVIZI - codice esistente
        const quantity = document.getElementById('qty-' + rowId) ? parseInt(document.getElementById('qty-' + rowId).value) || 1 : 1;
        const serviceName = document.getElementById('service-name-' + rowId) ? document.getElementById('service-name-' + rowId).value : '';
        const serviceNotes = document.getElementById('service-notes-' + rowId) ? document.getElementById('service-notes-' + rowId).value : '';
        const servicePrice = document.getElementById('service-price-' + rowId) ? parseFloat(document.getElementById('service-price-' + rowId).value) || 0 : 0;
        
        if (serviceName) {
            quote.equipment.push({
                category: 'SERVIZIO',
                equipment: serviceName,
                quantity: quantity,
                notes: serviceNotes,
                price: servicePrice,
                isService: true
            });
        }
    } else if (row.classList.contains('custom-row')) {
        // NUOVO - ATTREZZATURE CUSTOM
        const customCategory = document.getElementById('custom-category-' + rowId)?.value || 'CUSTOM';
        const customEquipment = document.getElementById('custom-equipment-' + rowId)?.value || '';
        const customKit = document.getElementById('custom-kit-' + rowId)?.value || '';
        const customQuantity = parseInt(document.getElementById('custom-qty-' + rowId)?.value || 1);
        const customPrice = parseFloat(document.getElementById('custom-price-' + rowId)?.value || 0);
        
        if (customEquipment) {
            quote.equipment.push({
                category: customCategory,
                equipment: customEquipment,
                quantity: customQuantity,
                kit: customKit,
                price: customPrice,
                isCustom: true  // Flag per identificare le custom
            });
        }
    } else {
        // ATTREZZATURE NORMALI - codice esistente
        const quantity = document.getElementById('qty-' + rowId) ? parseInt(document.getElementById('qty-' + rowId).value) || 1 : 1;
        const category = document.getElementById('category-' + rowId) ? document.getElementById('category-' + rowId).value : 
                        (document.getElementById('search-cat-' + rowId) ? document.getElementById('search-cat-' + rowId).value : '');
        const equipment = document.getElementById('equipment-' + rowId) ? document.getElementById('equipment-' + rowId).value : 
                         (document.getElementById('search-eq-' + rowId) ? document.getElementById('search-eq-' + rowId).value : '');
        const kitInfo = document.getElementById('kit-' + rowId) ? document.getElementById('kit-' + rowId).value : '';
        const priceText = document.getElementById('price-' + rowId) ? document.getElementById('price-' + rowId).value : '€ 0.00';
        const price = parseFloat(priceText.replace('€ ', '')) || 0;
        
        if (category && equipment) {
            quote.equipment.push({
                category: category,
                equipment: equipment,
                quantity: quantity,
                kit: kitInfo,
                price: price,
                isService: false
            });
        }
    }
});
    
    // SALVATAGGIO DOPPIO: localStorage + Google Sheets
    
    // 1. Salva sempre in localStorage (immediato)
localStorage.setItem('hubris_quotes', JSON.stringify(savedQuotes));

// 2. Poi prova a salvare su GitHub (in background)
saveQuoteToGitHub(quote).then(success => {
    if (success) {
        showNotification('✅ Salvato anche su GitHub', 'success');
    } else {
        showNotification('⚠️ Salvato solo localmente', 'warning');
    }
});

// 3. Aggiorna UI
renderSavedQuotes();
updateAnalytics();
showNotification('✅ Preventivo salvato!', 'success');
}

function updateUIMode() {
    const saveBtn = document.getElementById('saveBtn');
    const saveAsNewBtn = document.getElementById('saveAsNewBtn');
    const sectionTitle = document.querySelector('.section-title');
    
    if (isEditMode && currentQuoteId) {
        // MODALITÀ MODIFICA
        saveBtn.innerHTML = '✏️ Aggiorna';
        saveBtn.className = 'btn btn-warning';
        if (saveAsNewBtn) saveAsNewBtn.style.display = 'inline-block';
        
        const quoteName = document.getElementById('quoteName').value;
        if (sectionTitle) {
            sectionTitle.textContent = 'Modifica Preventivo: ' + quoteName;
            sectionTitle.style.color = '#ff9800';
        }
    } else {
        // MODALITÀ NUOVO
        saveBtn.innerHTML = '💾 Salva';
        saveBtn.className = 'btn btn-success';
        if (saveAsNewBtn) saveAsNewBtn.style.display = 'none';
        
        if (sectionTitle) {
            sectionTitle.textContent = 'Nuovo Preventivo';
            sectionTitle.style.color = '#2c5aa0';
        }
    }
}

function saveAsNew() {
    // Forza modalità nuovo preventivo
    const originalMode = isEditMode;
    const originalId = currentQuoteId;
    
    isEditMode = false;
    currentQuoteId = null;
    
    // Chiede nuovo nome
    const newName = prompt('Nome per il nuovo preventivo:', document.getElementById('quoteName').value + ' - Copia');
    if (!newName) {
        // Ripristina modalità originale se annullato
        isEditMode = originalMode;
        currentQuoteId = originalId;
        return;
    }
    
    document.getElementById('quoteName').value = newName;
    saveQuote(); // Salva come nuovo
    
    showNotification('📄 Nuovo preventivo "' + newName + '" creato!', 'success');
}

function loadQuoteById(quoteId) {
    if (!quoteId) {
        if (savedQuotes.length === 0) {
            showNotification('❌ Nessun preventivo salvato!', 'error');
            return;
        }
        showTab('saved');
        showNotification('📂 Seleziona un preventivo dalla lista', 'info');
        return;
    }
    const quote = savedQuotes.find(q => q.id === quoteId);
    if (!quote) {
        showNotification('❌ Preventivo non trovato!', 'error');
        return;
    }
    
    console.log('📂 Caricamento preventivo:', quote); // Debug
    
    // Clear existing rows
    document.getElementById('equipmentRows').innerHTML = '';
    rowCounter = 0;
    
    // Load basic data
    document.getElementById('quoteName').value = quote.name || '';
    document.getElementById('cliente').value = quote.cliente || '';
    document.getElementById('clientePiva').value = quote.clientePiva || '';
    document.getElementById('clienteVia').value = quote.clienteVia || '';
    document.getElementById('clientePec').value = quote.clientePec || '';
    document.getElementById('codiceUnivoco').value = quote.codiceUnivoco || '';
    document.getElementById('contatti').value = quote.contatti || '';
    document.getElementById('carico').value = quote.carico || '';
    document.getElementById('scarico').value = quote.scarico || '';
    document.getElementById('durata').value = quote.durata || '1';
    document.getElementById('sconto').value = quote.sconto || '0';

    // Carica subtotale sbarrato
    if (quote.showCrossedSubtotal && quote.crossedSubtotal > 0) {
        document.getElementById('enable-crossed-subtotal').checked = true;
        document.getElementById('crossed-subtotal-input').value = quote.crossedSubtotal;
        toggleCrossedSubtotal();
        updateCrossedSubtotal();
    } else {
        document.getElementById('enable-crossed-subtotal').checked = false;
        document.getElementById('crossed-subtotal-input').value = '0';
        toggleCrossedSubtotal();
    }
    
    // Load equipment and services
    if (quote.equipment && quote.equipment.length > 0) {
        console.log('🔧 Caricamento', quote.equipment.length, 'elementi'); // Debug
        
        quote.equipment.forEach((item, index) => {
            setTimeout(() => {
                if (item.isService) {
                    addServiceRow();
                    setTimeout(() => {
                        document.getElementById('service-name-' + rowCounter).value = item.equipment || '';
                        document.getElementById('service-notes-' + rowCounter).value = item.notes || '';
                        document.getElementById('service-price-' + rowCounter).value = item.price || '';
                        document.getElementById('qty-' + rowCounter).value = item.quantity || 1;
                        updateRowTotal(rowCounter);
                    }, 100);
} else if (item.isCustom) {
    // CARICA ATTREZZATURE CUSTOM
    addCustomEquipmentRow();
    setTimeout(() => {
        document.getElementById('custom-category-' + rowCounter).value = item.category || 'CUSTOM';
        document.getElementById('custom-equipment-' + rowCounter).value = item.equipment || '';
        document.getElementById('custom-kit-' + rowCounter).value = item.kit || '';
        document.getElementById('custom-price-' + rowCounter).value = item.price || 0;
        document.getElementById('custom-qty-' + rowCounter).value = item.quantity || 1;
        updateCustomRowTotal(rowCounter);
    }, 100);
                } else {
                    addEquipmentRow();
                    setTimeout(() => {
                        // Imposta categoria
                        document.getElementById('category-' + rowCounter).value = item.category || '';
                        document.getElementById('search-cat-' + rowCounter).value = item.category || '';
                        
                        // Abilita e popola equipment
                        document.getElementById('search-eq-' + rowCounter).disabled = false;
                        document.getElementById('search-eq-' + rowCounter).placeholder = 'Cerca in ' + item.category + '...';
                        
                        // Imposta equipment
                        document.getElementById('equipment-' + rowCounter).value = item.equipment || '';
                        document.getElementById('search-eq-' + rowCounter).value = item.equipment || '';
                        
                        // Imposta kit e prezzo
                        document.getElementById('kit-' + rowCounter).value = item.kit || '';
                        document.getElementById('price-' + rowCounter).value = '€ ' + (item.price || 0).toFixed(2);
                        document.getElementById('qty-' + rowCounter).value = item.quantity || 1;
                        
                        updateRowTotal(rowCounter);
                    }, 100);
                }
            }, 200 * index); // Delay progressivo per ogni elemento
        });
        
        // Aggiorna totali dopo aver caricato tutto
        setTimeout(() => {
            updateTotals();
        }, 200 * quote.equipment.length + 500);
    }
    
    // Switch to quotes tab
    showTab('quotes');
    document.querySelector('[onclick="showTab(\'quotes\')"]').classList.add('active');
    showNotification('✅ Preventivo "' + quote.name + '" caricato con ' + (quote.equipment ? quote.equipment.length : 0) + ' elementi!', 'success');
    currentQuoteId = quoteId;
    isEditMode = true;
    updateUIMode();
}
    function generateDDTFromQuote(quoteId) {
    const quote = savedQuotes.find(q => q.id === quoteId);
    if (!quote) {
        showNotification('❌ Preventivo non trovato!', 'error');
        return;
    }
    
    // Carica temporaneamente i dati del preventivo
    const originalName = document.getElementById('quoteName').value;
    const originalCliente = document.getElementById('cliente').value;
    const originalPiva = document.getElementById('clientePiva').value;
    const originalContatti = document.getElementById('contatti').value;
    const originalCarico = document.getElementById('carico').value;
    const originalScarico = document.getElementById('scarico').value;
    
    document.getElementById('quoteName').value = quote.name || '';
    document.getElementById('cliente').value = quote.cliente || '';
    document.getElementById('clientePiva').value = quote.clientePiva || '';
    document.getElementById('contatti').value = quote.contatti || '';
    document.getElementById('carico').value = quote.carico || '';
    document.getElementById('scarico').value = quote.scarico || '';
    
    // Genera il DDT
    setTimeout(() => {
        generateDDT();
        
        // Ripristina i valori originali
        document.getElementById('quoteName').value = originalName;
        document.getElementById('cliente').value = originalCliente;
        document.getElementById('clientePiva').value = originalPiva;
        document.getElementById('contatti').value = originalContatti;
        document.getElementById('carico').value = originalCarico;
        document.getElementById('scarico').value = originalScarico;
    }, 500);
}
function duplicateQuoteById(quoteId) {
    const quote = savedQuotes.find(q => q.id === quoteId);
    if (!quote) return;
    loadQuoteById(quoteId);
    document.getElementById('quoteName').value = quote.name + ' - Copia';
    showNotification('📄 Preventivo duplicato! Modifica il nome e salva.', 'info');
}

async function deleteQuote(quoteId) {
    const quote = savedQuotes.find(q => q.id === quoteId);
    if (!quote) return;
    
    // Messaggio di conferma più dettagliato
    if (!confirm('⚠️ ATTENZIONE!\n\nSei sicuro di voler eliminare il preventivo "' + quote.name + '"?\n\nTutte le informazioni andranno PERSE DEFINITIVAMENTE e il file verrà rimosso anche da GitHub.')) {
        return;
    }
    
    try {
        // Elimina da GitHub
        const token = getGitHubToken();
        if (token) {
            const date = new Date(quote.createdAt.split(', ')[0].split('/').reverse().join('-'));
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const fileName = `${year}/${month}/preventivo_${quote.id}.json`;
            
            // Prima ottieni lo SHA del file
            const checkResponse = await fetch(
                `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${fileName}`,
                {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (checkResponse.ok) {
                const fileData = await checkResponse.json();
                const sha = fileData.sha;
                
                // Ora elimina il file
                const deleteResponse = await fetch(
                    `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${fileName}`,
                    {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            message: `Elimina preventivo: ${quote.name}`,
                            sha: sha
                        })
                    }
                );
                
                if (deleteResponse.ok) {
                    console.log('✅ Eliminato da GitHub:', fileName);
                } else {
                    console.error('❌ Errore eliminazione da GitHub');
                }
            }
        }
        
        // Elimina da array locale e localStorage
        savedQuotes = savedQuotes.filter(q => q.id !== quoteId);
        localStorage.setItem('hubris_quotes', JSON.stringify(savedQuotes));
        renderSavedQuotes();
        updateAnalytics();
        showNotification('✅ Preventivo eliminato definitivamente', 'success');
        
    } catch (error) {
        console.error('❌ Errore eliminazione:', error);
        showNotification('⚠️ Preventivo eliminato localmente ma errore su GitHub', 'warning');
        
        // Elimina comunque localmente
        savedQuotes = savedQuotes.filter(q => q.id !== quoteId);
        localStorage.setItem('hubris_quotes', JSON.stringify(savedQuotes));
        renderSavedQuotes();
        updateAnalytics();
    }
}

// UTILITY FUNCTIONS
function filterDatabase() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#databaseBody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function filterByCategory() {
    const selectedCategory = document.getElementById('categoryFilter').value;
    const rows = document.querySelectorAll('#databaseBody tr');
    if (!selectedCategory) {
        rows.forEach(row => row.style.display = '');
        return;
    }
    let showNextItems = false;
    rows.forEach(row => {
        if (row.classList.contains('category-row')) {
            const categoryText = row.textContent.trim().replace('📁 ', '');
            showNextItems = (categoryText === selectedCategory);
            row.style.display = showNextItems ? '' : 'none';
        } else {
            row.style.display = showNextItems ? '' : 'none';
        }
    });
}

function syncDatabase() {
    const btn = document.getElementById('syncBtn');
    
    if (!CONFIG.API_KEY || !CONFIG.SHEETS_ID) {
        console.log('⚙️ Configurazione API mancante', 'warning');
        return;
    }
    
    if (btn) {
        btn.disabled = true;
        btn.textContent = '🔄 Sincronizzazione...';
    }
    
    showNotification('🔄 Sync manuale database avviato...');
    showNotification('🔄 Sincronizzazione database in corso...', 'info');
    
    loadDatabaseFromSheets()
        .then(() => {
            showNotification('✅ Database sincronizzato con successo!', 'success');
        })
        .catch((error) => {
            console.error('❌ Errore sync database:', error);
            showNotification('❌ Errore nella sincronizzazione database', 'error');
        })
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🔄 Sync';
            }
        });
}

function syncQuotes() {
    showNotification('🔄 Aggiornamento preventivi...', 'info');
    sFromGitHub().then(() => {
        showNotification('✅ Preventivi aggiornati!', 'success');
    });
}

function updateConnectionStatus(status, message) {
    const indicator = document.getElementById('connectionStatus');
    const text = document.getElementById('connectionText');
    
    if (indicator) {
        indicator.className = 'status-indicator status-' + status;
    }
    
    if (text) {
        text.textContent = message;
    }
    
    // Logging per debugging
    console.log(`📡 Status: ${status} - ${message}`);
    
    // Aggiorna variabili globali di stato
    switch(status) {
        case 'online':
            isConnected = true;
            break;
        case 'offline':
        case 'error':
            isConnected = false;
            gapi_loaded = false;
            break;
        case 'syncing':
            // Mantieni stato precedente durante sync
            break;
    }
}

function updateSyncTime() {
    const lastSync = document.getElementById('lastSync');
    const now = new Date();
    const timeString = now.toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    
    if (lastSync) {
        lastSync.textContent = 'Ultimo sync: ' + timeString;
    }
    
    console.log('⏰ Sync time aggiornato:', timeString);
}


// PDF GENERATION FUNCTIONS
function generateQuoteNumber() {
    const currentYear = new Date().getFullYear();
    const thisYearQuotes = savedQuotes.filter(q => {
        return q.createdAt && q.createdAt.includes(currentYear.toString());
    });
    const nextNumber = thisYearQuotes.length + 1;
    return `#${currentYear}-${nextNumber.toString().padStart(3, '0')}`;
}

function generatePDF() {
    const quoteName = document.getElementById('quoteName').value || 'Preventivo';
    const cliente = document.getElementById('cliente').value || 'Cliente';
    const clientePiva = document.getElementById('clientePiva').value || '';
    const clienteVia = document.getElementById('clienteVia').value || '';
    const clientePec = document.getElementById('clientePec').value || '';
    const codiceUnivoco = document.getElementById('codiceUnivoco').value || '';
    const contatti = document.getElementById('contatti').value || '';
    const carico = document.getElementById('carico').value || '';
    const scarico = document.getElementById('scarico').value || '';
    const durata = document.getElementById('durata').value || '1';
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const quoteNumber = generateQuoteNumber();
        
        // HEADER CON LOGO
        try {
            doc.addImage('https://i.imgur.com/ABMgyI8.png', 'PNG', 15, 10, 35, 35);
        } catch (e) {
            doc.setFillColor(44, 90, 160);
            doc.circle(32.5, 27.5, 17, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text('HP', 32.5, 32, { align: 'center' });
        }
        
        // INTESTAZIONE AZIENDA
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('HUBRIS PICTURES S.R.L.', 55, 22);
        
        // DATI AZIENDA
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('P.IVA: 09542051215', 55, 29);
        doc.text('PEC: hubrispictures@pec.it | Tel: +39 081 18893796 / +39 348 6901218', 55, 34);
        doc.text('Indirizzo: Piazza Vanvitelli, 5, 80127 Napoli NA', 55, 39);
        doc.text('Email: info@hubrispictures.com', 55, 44);
        
        // NUMERO PREVENTIVO E DATA - SISTEMATO POSIZIONAMENTO
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('PREVENTIVO', 195, 12, { align: 'right' });
        doc.text('N. ' + quoteNumber, 195, 20, { align: 'right' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Data: ' + new Date().toLocaleDateString('it-IT'), 195, 27, { align: 'right' });
        
        // LINEA SEPARATRICE PRINCIPALE
        doc.setDrawColor(44, 90, 160);
        doc.setLineWidth(1.5);
        doc.line(15, 50, 195, 50);
        
        // SEZIONE DESTINATARIO - METODO ALTERNATIVO
doc.setDrawColor(44, 90, 160);
doc.setLineWidth(0.3);
doc.setFillColor(248, 250, 255);
doc.roundedRect(15, 55, 85, 45, 0, 0, 'FD'); // Rettangolo con riempimento e bordo insieme
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('DESTINATARIO:', 18, 62);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        let yPos = 68;
        doc.text(cliente, 18, yPos);
        
        if (clientePiva) {
            yPos += 4;
            doc.text('P.IVA: ' + clientePiva, 18, yPos);
        }
        if (clienteVia) {
            yPos += 4;
            doc.text('Via: ' + clienteVia, 18, yPos, { maxWidth: 65 });
        }
        if (clientePec) {
            yPos += 4;
            doc.text('PEC: ' + clientePec, 18, yPos, { maxWidth: 65 });
        }
        if (codiceUnivoco) {
            yPos += 4;
            doc.text('SDI: ' + codiceUnivoco, 18, yPos);
        }
        if (contatti) {
            yPos += 4;
            doc.text('Tel: ' + contatti, 18, yPos, { maxWidth: 65 });
        }
        
        // PERIODO NOLEGGIO - OTTIMIZZATO  
doc.setFillColor(248, 250, 255);
doc.rect(110, 55, 85, 45, 'F'); // Più largo, meno alto, più vicino
doc.setDrawColor(44, 90, 160);
doc.setLineWidth(0.3); // Bordo più sottile
doc.rect(110, 55, 85, 45);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('PERIODO NOLEGGIO:', 113, 62);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.text('Carico: ' + (carico || 'Da definire'), 113, 68);
        doc.text('Scarico: ' + (scarico || 'Da definire'), 113, 73);
        doc.text('Durata: ' + durata + ' giorni', 113, 78);
        
        // TITOLO TABELLA
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
       doc.text('DETTAGLIO ATTREZZATURE E SERVIZI', 105, 110, { align: 'center' }); // Era 115
        
// PREPARAZIONE DATI TABELLA
const equipmentData = [];
const servicesData = [];

document.querySelectorAll('[id^="row-"]').forEach(row => {
    const rowId = row.id.split('-')[1];
    
    if (row.classList.contains('service-row')) {
        const serviceName = document.getElementById('service-name-' + rowId)?.value || '';
        const serviceNotes = document.getElementById('service-notes-' + rowId)?.value || '';
        const quantity = document.getElementById('qty-' + rowId)?.value || '';
        const price = parseFloat(document.getElementById('service-price-' + rowId)?.value || '0');
        const total = parseFloat(document.getElementById('total-' + rowId)?.textContent.replace('€ ', '') || '0');
        
        if (serviceName) {
            servicesData.push([
                'Servizi',
                serviceName + (serviceNotes ? '\n' + serviceNotes : ''),
                quantity,
                '€ ' + price.toFixed(2),
                '€ ' + total.toFixed(2)
            ]);
        }
    } else if (row.classList.contains('custom-row')) {
        // CUSTOM - AGGIUNTE ALLA TABELLA ATTREZZATURE
        const category = document.getElementById('custom-category-' + rowId)?.value || 'CUSTOM';
        const equipment = document.getElementById('custom-equipment-' + rowId)?.value || '';
        const kitInfo = document.getElementById('custom-kit-' + rowId)?.value || '';
        const quantity = document.getElementById('custom-qty-' + rowId)?.value || '';
        const price = parseFloat(document.getElementById('custom-price-' + rowId)?.value || '0');
        const total = parseFloat(document.getElementById('custom-total-' + rowId)?.textContent.replace('€ ', '') || '0');
        
        if (equipment) {
            equipmentData.push([
                category,
                equipment + (kitInfo ? '\n' + kitInfo : ''),
                quantity,
                '€ ' + price.toFixed(2),
                '€ ' + total.toFixed(2)
            ]);
        }
    } else {
        // ATTREZZATURE NORMALI
        const category = document.getElementById('category-' + rowId)?.value || '';
        const equipment = document.getElementById('equipment-' + rowId)?.value || '';
        const quantity = document.getElementById('qty-' + rowId)?.value || '';
        const priceText = document.getElementById('price-' + rowId)?.value || '€ 0.00';
        const total = parseFloat(document.getElementById('total-' + rowId)?.textContent.replace('€ ', '') || '0');
        const kitInfo = document.getElementById('kit-' + rowId)?.value || '';
        
        if (category && equipment) {
            equipmentData.push([
                category,
                equipment + (kitInfo ? '\n' + kitInfo : ''),
                quantity,
                priceText,
                '€ ' + total.toFixed(2)
            ]);
        }
    }
});
        
        // TABELLA ATTREZZATURE
        let currentY = 125;
        
        if (equipmentData.length > 0) {
            doc.autoTable({
                head: [['Categoria', 'Articolo', 'Qtà', 'Prezzo Unit.', 'Totale']],
                body: equipmentData,
                startY: currentY,
                theme: 'grid',
                headStyles: { 
                    fillColor: [44, 90, 160],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 11
                },
                bodyStyles: {
                    fontSize: 10,
                    cellPadding: 3
                },
                columnStyles: {
                    0: { cellWidth: 35 },
                    1: { cellWidth: 70 },
                    2: { cellWidth: 20, halign: 'center' },
                    3: { cellWidth: 25, halign: 'right' },
                    4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 255]
                }
            });
            
            currentY = doc.lastAutoTable.finalY + 10;
        }
        
        // TABELLA SERVIZI - ALLINEAMENTO PERFETTO
// TABELLA SERVIZI - STESSI COLORI ATTREZZATURE
if (servicesData.length > 0) {
    doc.autoTable({
        head: [['Categoria', 'Servizio', 'Qtà', 'Prezzo Unit.', 'Totale']],
        body: servicesData,
        startY: currentY,
        theme: 'grid',
        headStyles: { 
            fillColor: [44, 90, 160], // Stesso blu delle attrezzature
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 11
        },
        bodyStyles: {
            fontSize: 10,
            cellPadding: 3 // Stesso padding delle attrezzature
        },
        columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 70 },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: {
            fillColor: [248, 250, 255] // Stesso colore alternato delle attrezzature
        }
    });
    
    currentY = doc.lastAutoTable.finalY + 10;
}
        
        // TOTALI FINALI CON SUBTOTALE SBARRATO
        const crossedSubtotalValue = getCrossedSubtotalValue();
        const showCrossedSubtotal = document.getElementById('enable-crossed-subtotal').checked;
        const subtotalValue = parseFloat(document.getElementById('subtotale').textContent.replace('€ ', '')) || 0;
        const discountPercent = parseFloat(document.getElementById('sconto').value) || 0;
        const discountAmount = parseFloat(document.getElementById('sconto-amount').textContent.replace('€ ', '')) || 0;
        const imponibileValue = parseFloat(document.getElementById('imponibile').textContent.replace('€ ', '')) || 0;
        const ivaValue = parseFloat(document.getElementById('iva').textContent.replace('€ ', '')) || 0;
        const totaleValue = parseFloat(document.getElementById('totale').textContent.replace('€ ', '')) || 0;
        
        // BOX TOTALI
        const boxY = currentY;
        const boxWidth = 80;
        const boxHeight = (showCrossedSubtotal && crossedSubtotalValue > 0 ? 55 : 45) + (discountPercent > 0 ? 10 : 0);
        
        doc.setFillColor(248, 250, 255);
        doc.rect(115, boxY, boxWidth, boxHeight, 'F');
        doc.setDrawColor(44, 90, 160);
        doc.setLineWidth(0.5);
        doc.rect(115, boxY, boxWidth, boxHeight);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        let lineY = boxY + 7;
        
        // Subtotale sbarrato se presente - COLORE PIÙ SCURO
        if (showCrossedSubtotal && crossedSubtotalValue > 0) {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100); // PIÙ SCURO
            doc.text('Subtotale:', 118, lineY);
            const textWidth = doc.getTextWidth('€ ' + crossedSubtotalValue.toFixed(2));
            doc.text('€ ' + crossedSubtotalValue.toFixed(2), 190, lineY, { align: 'right' });
            doc.setDrawColor(100, 100, 100); // LINEA PIÙ SCURA
            doc.setLineWidth(1);
            doc.line(190 - textWidth, lineY - 1, 190, lineY - 1);
            lineY += 8;
            doc.setTextColor(0, 0, 0);
        }
        
        // Subtotale normale
        doc.setFont('helvetica', 'normal');
        doc.text('Subtotale:', 118, lineY);
        doc.text('€ ' + subtotalValue.toFixed(2), 190, lineY, { align: 'right' });
        lineY += 6;
        
        // Sconto se presente
        if (discountPercent > 0) {
            doc.text('Sconto (' + discountPercent.toFixed(1) + '%):', 118, lineY);
            doc.text('-€ ' + discountAmount.toFixed(2), 190, lineY, { align: 'right' });
            lineY += 6;
        }
        
        // Imponibile
        doc.text('Imponibile:', 118, lineY);
        doc.text('€ ' + imponibileValue.toFixed(2), 190, lineY, { align: 'right' });
        lineY += 6;
        
        // IVA
        doc.text('IVA 22%:', 118, lineY);
        doc.text('€ ' + ivaValue.toFixed(2), 190, lineY, { align: 'right' });
        lineY += 6;
        
        // LINEA SEPARATRICE
        doc.setLineWidth(1);
        doc.setDrawColor(44, 90, 160);
        doc.line(118, lineY, 190, lineY);
        lineY += 5;
        
        // TOTALE FINALE
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(44, 90, 160);
        doc.text('TOTALE FINALE:', 118, lineY);
        doc.text('€ ' + totaleValue.toFixed(2), 190, lineY, { align: 'right' });
        
        // NOTE FINALI - LARGHEZZA COMPLETA E POSIZIONE CORRETTA
        const finalY = boxY + boxHeight + 20;
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        
        const noteText = [
            "La società emette fattura al momento del ritiro materiale non si accettano dilazioni di pagamento che dovrà essere",
            "contestuale al RITIRO delle attrezzature. Ritiro e riconsegna a Vostra cura presso nostra sede. Il materiale non reso",
            "verrà addebitato al prezzo di listino della casa costruttrice. Eventuali danneggiamenti saranno valutati al momento",
            "della riconsegna ed addebitati per il loro valore. Il materiale eventualmente difettoso verrà riparato o sostituito presso",
            "la nostra sede. L'eventuale smarrimento dei MATERIALI, anche al fine di scongiurare una illecita utilizzazione dei",
            "medesimi, dovrà essere tempestivamente denunciato presso l'Autorità di Pubblica Sicurezza più vicina e quindi",
            "comunicato per iscritto."
        ];
        
        let noteY = finalY;
        noteText.forEach(line => {
            doc.text(line, 15, noteY, { maxWidth: 175 }); 
            noteY += 4;
        });
        
        // SALVATAGGIO FILE
        const fileName = quoteName.replace(/[^a-z0-9]/gi, '_') + '_' + quoteNumber + '.pdf';
        doc.save(fileName);
        
        showNotification('✅ PDF preventivo generato: ' + quoteNumber, 'success');
        
    } catch (error) {
        console.error('Errore generazione PDF:', error);
        showNotification('❌ Errore nella generazione del PDF: ' + error.message, 'error');
    }
}
    
function generateDDT() {
    const quoteName = document.getElementById('quoteName').value || 'DDT';
    const cliente = document.getElementById('cliente').value || 'Cliente';
    const clientePiva = document.getElementById('clientePiva').value || '';
    const clienteVia = document.getElementById('clienteVia').value || '';
    const clientePec = document.getElementById('clientePec').value || '';
    const codiceUnivoco = document.getElementById('codiceUnivoco').value || '';
    const contatti = document.getElementById('contatti').value || '';
    const carico = document.getElementById('carico').value || '';
    const scarico = document.getElementById('scarico').value || '';
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const ddtNumber = 'DDT-' + Date.now().toString().slice(-6);
        
        // HEADER CON LOGO
        try {
            doc.addImage('https://i.imgur.com/ABMgyI8.png', 'PNG', 15, 10, 35, 35);
        } catch (e) {
            doc.setFillColor(44, 90, 160);
            doc.circle(32.5, 27.5, 17, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text('HP', 32.5, 32, { align: 'center' });
        }
        
        // INTESTAZIONE AZIENDA
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('HUBRIS PICTURES S.R.L.', 55, 22);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('P.IVA: 09542051215', 55, 29);
        doc.text('PEC: hubrispictures@pec.it | Tel: +39 081 18893796 / +39 348 6901218', 55, 34);
        doc.text('Indirizzo: Piazza Vanvitelli, 5, 80127 Napoli NA', 55, 39);
        doc.text('Email: info@hubrispictures.com', 55, 44);
        
        // TITOLO DDT - SISTEMATO POSIZIONAMENTO
doc.setFontSize(16);
doc.setFont('helvetica', 'bold');
doc.setTextColor(44, 90, 160);
doc.text('DDT', 195, 8, { align: 'right' }); // Spostato più in alto
doc.setFontSize(9); // Font più piccolo
doc.text('(D.P.R. 472/95 comma 3)', 195, 15, { align: 'right' });
doc.setFontSize(12); // Font medio
doc.text('N. ' + ddtNumber, 195, 23, { align: 'right' });
doc.setFontSize(10);
doc.setFont('helvetica', 'normal');
doc.text('Data: ' + new Date().toLocaleDateString('it-IT'), 195, 30, { align: 'right' });
        
        // LINEA SEPARATRICE
        doc.setDrawColor(44, 90, 160);
        doc.setLineWidth(1.5);
        doc.line(15, 50, 195, 50);
        
        // SEZIONE DESTINATARIO - OTTIMIZZATO
doc.setFillColor(248, 250, 255);
doc.rect(15, 55, 85, 45, 'F'); // Più largo, meno alto
doc.setDrawColor(44, 90, 160);
doc.setLineWidth(0.3); // Bordo più sottile
doc.rect(15, 55, 85, 45);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('DESTINATARIO:', 18, 62);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        let yPos = 68;
        doc.text(cliente, 18, yPos);
        
        if (clientePiva) {
            yPos += 4;
            doc.text('P.IVA: ' + clientePiva, 18, yPos);
        }
        if (clienteVia) {
            yPos += 4;
            doc.text('Via: ' + clienteVia, 18, yPos, { maxWidth: 65 });
        }
        if (clientePec) {
            yPos += 4;
            doc.text('PEC: ' + clientePec, 18, yPos, { maxWidth: 65 });
        }
        if (codiceUnivoco) {
            yPos += 4;
            doc.text('SDI: ' + codiceUnivoco, 18, yPos);
        }
        if (contatti) {
            yPos += 4;
            doc.text('Tel: ' + contatti, 18, yPos, { maxWidth: 65 });
        }
        
       
doc.setFillColor(248, 250, 255);
doc.rect(110, 55, 85, 45, 'F'); // Più largo, meno alto, più vicino
doc.setDrawColor(44, 90, 160);
doc.setLineWidth(0.3); // Bordo più sottile
doc.rect(110, 55, 85, 45);
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('CAUSALE TRASPORTO:', 113, 62);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('Noleggio attrezzature', 113, 68);
        doc.text('Data carico: ' + (carico || 'Da definire'), 113, 73);
        doc.text('Data reso: ' + (scarico || 'Da definire'), 113, 78);
        
        // TITOLO TABELLA
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('BENI TRASPORTATI', 105, 115, { align: 'center' });
        
// PREPARAZIONE DATI TABELLA
const equipmentData = [];

document.querySelectorAll('[id^="row-"]').forEach(row => {
    const rowId = row.id.split('-')[1];
    
    if (row.classList.contains('custom-row')) {
        // CUSTOM nel DDT
        const category = document.getElementById('custom-category-' + rowId)?.value || 'CUSTOM';
        const equipment = document.getElementById('custom-equipment-' + rowId)?.value || '';
        const quantity = document.getElementById('custom-qty-' + rowId)?.value || '';
        const kitInfo = document.getElementById('custom-kit-' + rowId)?.value || '';
        
        if (equipment) {
            equipmentData.push([
                category,
                equipment,
                quantity,
                kitInfo || 'Kit personalizzato'
            ]);
        }
    } else if (!row.classList.contains('service-row')) {
        // Attrezzature normali
        const category = document.getElementById('category-' + rowId)?.value || '';
        const equipment = document.getElementById('equipment-' + rowId)?.value || '';
        const quantity = document.getElementById('qty-' + rowId)?.value || '';
        const kitInfo = document.getElementById('kit-' + rowId)?.value || '';
        
        if (category && equipment) {
            equipmentData.push([
                category,
                equipment,
                quantity,
                kitInfo || 'Kit standard'
            ]);
        }
    }
});
        
        // TABELLA BENI TRASPORTATI
        if (equipmentData.length > 0) {
            doc.autoTable({
                head: [['Categoria', 'Articolo', 'Qtà', 'Kit/Descrizione']],
                body: equipmentData,
                startY: 120, // Era 125
                theme: 'grid',
                headStyles: { 
                    fillColor: [44, 90, 160],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 11
                },
                bodyStyles: {
                    fontSize: 10,
                    cellPadding: 3
                },
                columnStyles: {
                    0: { cellWidth: 45 },
                    1: { cellWidth: 75 },
                    2: { cellWidth: 20, halign: 'center' },
                    3: { cellWidth: 40 }
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 255]
                }
            });
        }
        
        // FIRME - SISTEMATE DIMENSIONI
        const signY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 30 : 180;
        
        doc.setFillColor(248, 250, 255);
        doc.rect(15, signY, 85, 35, 'F'); // Ingranditi
        doc.rect(110, signY, 85, 35, 'F'); // Ingranditi
        doc.setDrawColor(44, 90, 160);
        doc.rect(15, signY, 85, 35);
        doc.rect(110, signY, 85, 35);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9); // Font più piccolo
        doc.setTextColor(44, 90, 160);
        doc.text('MITTENTE', 57.5, signY + 8, { align: 'center' });
        doc.text('DESTINATARIO', 152.5, signY + 8, { align: 'center' });
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8); // Font più piccolo
        doc.setTextColor(0, 0, 0);
        doc.text('Firma e timbro:', 18, signY + 16);
        doc.text('Firma per ricevuta:', 113, signY + 16);
        
        // NOTE FINALI - LARGHEZZA COMPLETA
        const finalY = signY + 45;
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        
        const noteText = [
            "La società emette fattura al momento del ritiro materiale non si accettano dilazioni di pagamento che dovrà essere",
            "contestuale al RITIRO delle attrezzature. Ritiro e riconsegna a Vostra cura presso nostra sede. Il materiale non reso",
            "verrà addebitato al prezzo di listino della casa costruttrice. Eventuali danneggiamenti saranno valutati al momento",
            "della riconsegna ed addebitati per il loro valore. Il materiale eventualmente difettoso verrà riparato o sostituito presso",
            "la nostra sede. L'eventuale smarrimento dei MATERIALI, anche al fine di scongiurare una illecita utilizzazione dei",
            "medesimi, dovrà essere tempestivamente denunciato presso l'Autorità di Pubblica Sicurezza più vicina e quindi",
            "comunicato per iscritto."
        ];
        
        let noteY = finalY;
        noteText.forEach(line => {
            doc.text(line, 15, noteY, { maxWidth: 175 }); 
            noteY += 4;
        });
        
        // SALVATAGGIO
        const fileName = quoteName.replace(/[^a-z0-9]/gi, '_') + '_DDT_' + ddtNumber + '.pdf';
        doc.save(fileName);
        
        showNotification('✅ DDT generato: ' + ddtNumber, 'success');
        
    } catch (error) {
        console.error('Errore generazione DDT:', error);
        showNotification('❌ Errore nella generazione del DDT', 'error');
    }
}
    
function generateNoPricesQuote() {
    const quoteName = document.getElementById('quoteName').value || 'Preventivo';
    const cliente = document.getElementById('cliente').value || 'Cliente';
    const clientePiva = document.getElementById('clientePiva').value || '';
    const clienteVia = document.getElementById('clienteVia').value || '';
    const clientePec = document.getElementById('clientePec').value || '';
    const codiceUnivoco = document.getElementById('codiceUnivoco').value || '';
    const contatti = document.getElementById('contatti').value || '';
    const carico = document.getElementById('carico').value || '';
    const scarico = document.getElementById('scarico').value || '';
    const durata = document.getElementById('durata').value || '1';
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const quoteNumber = generateQuoteNumber();
        
        // HEADER CON LOGO
        try {
            doc.addImage('https://i.imgur.com/ABMgyI8.png', 'PNG', 15, 10, 35, 35);
        } catch (e) {
            doc.setFillColor(44, 90, 160);
            doc.circle(32.5, 27.5, 17, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text('HP', 32.5, 32, { align: 'center' });
        }
        
        // INTESTAZIONE AZIENDA
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('HUBRIS PICTURES S.R.L.', 55, 22);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('P.IVA: 09542051215', 55, 29);
        doc.text('PEC: hubrispictures@pec.it | Tel: +39 081 18893796 / +39 348 6901218', 55, 34);
        doc.text('Indirizzo: Piazza Vanvitelli, 5, 80127 Napoli NA', 55, 39);
        doc.text('Email: info@hubrispictures.com', 55, 44);
        
        // TITOLO PREVENTIVO - SISTEMATO POSIZIONAMENTO
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('PREVENTIVO', 195, 12, { align: 'right' });
        doc.text('N. ' + quoteNumber, 195, 20, { align: 'right' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Data: ' + new Date().toLocaleDateString('it-IT'), 195, 27, { align: 'right' });
        
        // LINEA SEPARATRICE
        doc.setDrawColor(44, 90, 160);
        doc.setLineWidth(1.5);
        doc.line(15, 50, 195, 50);
        
        // SEZIONE DESTINATARIO - OTTIMIZZATO
doc.setFillColor(248, 250, 255);
doc.rect(15, 55, 85, 45, 'F'); // Più largo, meno alto
doc.setDrawColor(44, 90, 160);
doc.setLineWidth(0.3); // Bordo più sottile
doc.rect(15, 55, 85, 45);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('DESTINATARIO:', 18, 62);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        let yPos = 68;
        doc.text(cliente, 18, yPos);
        
        if (clientePiva) {
            yPos += 4;
            doc.text('P.IVA: ' + clientePiva, 18, yPos);
        }
        if (clienteVia) {
            yPos += 4;
            doc.text('Via: ' + clienteVia, 18, yPos, { maxWidth: 65 });
        }
        if (clientePec) {
            yPos += 4;
            doc.text('PEC: ' + clientePec, 18, yPos, { maxWidth: 65 });
        }
        if (codiceUnivoco) {
            yPos += 4;
            doc.text('SDI: ' + codiceUnivoco, 18, yPos);
        }
        if (contatti) {
            yPos += 4;
            doc.text('Tel: ' + contatti, 18, yPos, { maxWidth: 65 });
        }
        
        // PERIODO NOLEGGIO - OTTIMIZZATO  
doc.setFillColor(248, 250, 255);
doc.rect(110, 55, 85, 45, 'F'); // Più largo, meno alto, più vicino
doc.setDrawColor(44, 90, 160);
doc.setLineWidth(0.3); // Bordo più sottile
doc.rect(110, 55, 85, 45);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('PERIODO NOLEGGIO:', 113, 62);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.text('Carico: ' + (carico || 'Da definire'), 113, 68);
        doc.text('Scarico: ' + (scarico || 'Da definire'), 113, 73);
        doc.text('Durata: ' + durata + ' giorni', 113, 78);
        
        // TITOLO TABELLA
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('LISTA ATTREZZATURE E SERVIZI', 105, 115, { align: 'center' });
        
// PREPARAZIONE DATI SENZA PREZZI
const equipmentData = [];
const servicesData = [];

document.querySelectorAll('[id^="row-"]').forEach(row => {
    const rowId = row.id.split('-')[1];
    
    if (row.classList.contains('service-row')) {
        const serviceName = document.getElementById('service-name-' + rowId)?.value || '';
        const serviceNotes = document.getElementById('service-notes-' + rowId)?.value || '';
        const quantity = document.getElementById('qty-' + rowId)?.value || '';
        
        if (serviceName) {
            servicesData.push([
                'Servizi',
                serviceName,
                quantity,
                serviceNotes || 'Servizio personalizzato'
            ]);
        }
    } else if (row.classList.contains('custom-row')) {
        // CUSTOM senza prezzi
        const category = document.getElementById('custom-category-' + rowId)?.value || 'CUSTOM';
        const equipment = document.getElementById('custom-equipment-' + rowId)?.value || '';
        const quantity = document.getElementById('custom-qty-' + rowId)?.value || '';
        const kitInfo = document.getElementById('custom-kit-' + rowId)?.value || '';
        
        if (equipment) {
            equipmentData.push([
                category,
                equipment,
                quantity,
                kitInfo || 'Kit personalizzato'
            ]);
        }
    } else {
        const category = document.getElementById('category-' + rowId)?.value || '';
        const equipment = document.getElementById('equipment-' + rowId)?.value || '';
        const quantity = document.getElementById('qty-' + rowId)?.value || '';
        const kitInfo = document.getElementById('kit-' + rowId)?.value || '';
        
        if (category && equipment) {
            equipmentData.push([
                category,
                equipment,
                quantity,
                kitInfo || 'Kit completo'
            ]);
        }
    }
});
        
        // TABELLA ATTREZZATURE SENZA PREZZI
        let currentY = 125;
        
        if (equipmentData.length > 0) {
            doc.autoTable({
                head: [['Categoria', 'Articolo', 'Qtà', 'Kit']],
                body: equipmentData,
                startY: currentY,
                theme: 'grid',
                headStyles: { 
                    fillColor: [44, 90, 160],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 11
                },
                bodyStyles: {
                    fontSize: 10,
                    cellPadding: 3
                },
                columnStyles: {
                    0: { cellWidth: 40 },
                    1: { cellWidth: 80 },
                    2: { cellWidth: 20, halign: 'center' },
                    3: { cellWidth: 40 }
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 255]
                }
            });
            
            currentY = doc.lastAutoTable.finalY + 10;
        }
        
       // TABELLA SERVIZI - ALLINEAMENTO PERFETTO
// TABELLA SERVIZI - STESSI COLORI
if (servicesData.length > 0) {
    doc.autoTable({
        head: [['Categoria', 'Servizio', 'Qtà', 'Note']],
        body: servicesData,
        startY: currentY,
        theme: 'grid',
        headStyles: { 
            fillColor: [44, 90, 160], // Stesso blu
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 11
        },
        bodyStyles: {
            fontSize: 10,
            cellPadding: 4
        },
        columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 80 },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 40 }
        },
        alternateRowStyles: {
            fillColor: [248, 250, 255] // Stesso colore alternato
        }
    });
    
    currentY = doc.lastAutoTable.finalY + 15;
}
        
        // TOTALI FINALI CON SUBTOTALE SBARRATO
        const crossedSubtotalValue = getCrossedSubtotalValue();
        const showCrossedSubtotal = document.getElementById('enable-crossed-subtotal').checked;
        const totaleValue = parseFloat(document.getElementById('totale').textContent.replace('€ ', '')) || 0;
        const imponibileValue = parseFloat(document.getElementById('imponibile').textContent.replace('€ ', '')) || 0;
        const ivaValue = parseFloat(document.getElementById('iva').textContent.replace('€ ', '')) || 0;
        
        // BOX TOTALI SEMPLIFICATO CON SUBTOTALE SBARRATO
        const boxHeight = (showCrossedSubtotal && crossedSubtotalValue > 0 ? 35 : 25);
        
        doc.setFillColor(248, 250, 255);
        doc.rect(130, currentY, 65, boxHeight, 'F');
        doc.setDrawColor(44, 90, 160);
        doc.rect(130, currentY, 65, boxHeight);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        
        let lineY = currentY + 7;
        
        // Subtotale sbarrato se presente - COLORE PIÙ SCURO
        if (showCrossedSubtotal && crossedSubtotalValue > 0) {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100); // PIÙ SCURO
            doc.text('Totale:', 133, lineY);
            const textWidth = doc.getTextWidth('€ ' + crossedSubtotalValue.toFixed(2));
            doc.text('€ ' + crossedSubtotalValue.toFixed(2), 190, lineY, { align: 'right' });
            doc.setDrawColor(100, 100, 100); // LINEA PIÙ SCURA
            doc.setLineWidth(1);
            doc.line(190 - textWidth, lineY - 1, 190, lineY - 1);
            lineY += 7;
            doc.setTextColor(0, 0, 0);
        }
        
        doc.text('Totale imponibile:', 133, lineY);
        doc.text('€ ' + imponibileValue.toFixed(2), 190, lineY, { align: 'right' });
        
        doc.text('IVA 22%:', 133, lineY + 7);
        doc.text('€ ' + ivaValue.toFixed(2), 190, lineY + 7, { align: 'right' });
        
        // LINEA E TOTALE FINALE
        doc.setLineWidth(1);
        doc.line(133, lineY + 10, 190, lineY + 10);
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(44, 90, 160);
        doc.text('TOTALE FINALE:', 133, lineY + 17);
        doc.text('€ ' + totaleValue.toFixed(2), 190, lineY + 17, { align: 'right' });
        
        // NOTE FINALI - LARGHEZZA COMPLETA
        const finalY = currentY + boxHeight + 15;
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        
        const noteText = [
            "La società emette fattura al momento del ritiro materiale non si accettano dilazioni di pagamento che dovrà essere",
            "contestuale al RITIRO delle attrezzature. Ritiro e riconsegna a Vostra cura presso nostra sede. Il materiale non reso",
            "verrà addebitato al prezzo di listino della casa costruttrice. Eventuali danneggiamenti saranno valutati al momento",
            "della riconsegna ed addebitati per il loro valore. Il materiale eventualmente difettoso verrà riparato o sostituito presso",
            "la nostra sede. L'eventuale smarrimento dei MATERIALI, anche al fine di scongiurare una illecita utilizzazione dei",
            "medesimi, dovrà essere tempestivamente denunciato presso l'Autorità di Pubblica Sicurezza più vicina e quindi",
            "comunicato per iscritto."
        ];
        
        let noteY = finalY;
        noteText.forEach(line => {
            doc.text(line, 15, noteY, { maxWidth: 175 }); 
            noteY += 4;
        });
        
        // SALVATAGGIO
        const fileName = quoteName.replace(/[^a-z0-9]/gi, '_') + '_SenzaPrezzi_' + quoteNumber + '.pdf';
        doc.save(fileName);
        
        showNotification('✅ Preventivo senza prezzi generato: ' + quoteNumber, 'success');
        
    } catch (error) {
        console.error('Errore generazione PDF senza prezzi:', error);
        showNotification('❌ Errore nella generazione del PDF', 'error');
    }
}

function generateInsurance() {
     if (currentQuoteId) {
        const customInsuranceData = loadSavedInsuranceData(currentQuoteId);
        if (customInsuranceData) {
            generateInsurancePDFWithCustomValues(currentQuoteId);
            return;
        }
    }
    const quoteName = document.getElementById('quoteName').value || 'Preventivo';
    const cliente = document.getElementById('cliente').value || 'Cliente';
    const clientePiva = document.getElementById('clientePiva').value || '';
    const clienteVia = document.getElementById('clienteVia').value || '';
    const clientePec = document.getElementById('clientePec').value || '';
    const codiceUnivoco = document.getElementById('codiceUnivoco').value || '';
    const contatti = document.getElementById('contatti').value || '';
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const docNumber = 'ASS-' + Date.now().toString().slice(-6);
        
        // HEADER CON LOGO
        try {
            doc.addImage('https://i.imgur.com/ABMgyI8.png', 'PNG', 15, 10, 35, 35);
        } catch (e) {
            doc.setFillColor(44, 90, 160);
            doc.circle(32.5, 27.5, 17, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text('HP', 32.5, 32, { align: 'center' });
        }
        
        // INTESTAZIONE AZIENDA
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('HUBRIS PICTURES S.R.L.', 55, 22);
        
        // DATI AZIENDA
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('P.IVA: 09542051215', 55, 29);
        doc.text('PEC: hubrispictures@pec.it | Tel: +39 081 18893796 / +39 348 6901218', 55, 34);
        doc.text('Indirizzo: Piazza Vanvitelli, 5, 80127 Napoli NA', 55, 39);
        doc.text('Email: info@hubrispictures.com', 55, 44);
        
        // NUMERO DOCUMENTO E DATA - SISTEMATO POSIZIONAMENTO
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('VALORI', 195, 10, { align: 'right' });
        doc.text('ASSICURATIVI', 195, 18, { align: 'right' });
        doc.text('N. ' + docNumber, 195, 26, { align: 'right' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Data: ' + new Date().toLocaleDateString('it-IT'), 195, 33, { align: 'right' });
        
        // LINEA SEPARATRICE PRINCIPALE
        doc.setDrawColor(44, 90, 160);
        doc.setLineWidth(1.5);
        doc.line(15, 50, 195, 50);
        
        // SEZIONE DESTINATARIO - OTTIMIZZATO
doc.setFillColor(248, 250, 255);
doc.rect(15, 55, 85, 45, 'F'); // Più largo, meno alto
doc.setDrawColor(44, 90, 160);
doc.setLineWidth(0.3); // Bordo più sottile
doc.rect(15, 55, 85, 45);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('DESTINATARIO:', 18, 62);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        let yPos = 68;
        doc.text(cliente, 18, yPos);
        
        if (clientePiva) {
            yPos += 4;
            doc.text('P.IVA: ' + clientePiva, 18, yPos);
        }
        if (clienteVia) {
            yPos += 4;
            doc.text('Via: ' + clienteVia, 18, yPos, { maxWidth: 65 });
        }
        if (clientePec) {
            yPos += 4;
            doc.text('PEC: ' + clientePec, 18, yPos, { maxWidth: 65 });
        }
        if (codiceUnivoco) {
            yPos += 4;
            doc.text('SDI: ' + codiceUnivoco, 18, yPos);
        }
        if (contatti) {
            yPos += 4;
            doc.text('Tel: ' + contatti, 18, yPos, { maxWidth: 65 });
        }
        
        // PERIODO NOLEGGIO - OTTIMIZZATO  
doc.setFillColor(248, 250, 255);
doc.rect(110, 55, 85, 45, 'F'); // Più largo, meno alto, più vicino
doc.setDrawColor(44, 90, 160);
doc.setLineWidth(0.3); // Bordo più sottile
doc.rect(110, 55, 85, 45);
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('PROGETTO:', 113, 62);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(quoteName, 113, 68);
        doc.text('Tipo: Valutazione assicurativa', 113, 73);
        doc.text('Data: ' + new Date().toLocaleDateString('it-IT'), 113, 78);
        
        // TITOLO TABELLA
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('ATTREZZATURE DA ASSICURARE', 105, 115, { align: 'center' });
        
// PREPARAZIONE DATI ASSICURAZIONE CON SERIALI
const insuranceData = [];
let totalInsurance = 0;

document.querySelectorAll('[id^="row-"]').forEach(row => {
    const rowId = row.id.split('-')[1];
    
    if (row.classList.contains('custom-row')) {
        // CUSTOM - saltiamo per l'assicurazione (non hanno valore predefinito)
        // Verranno gestite nella pagina dedicata ai valori assicurativi
        
    } else if (!row.classList.contains('service-row')) {
        // Solo attrezzature normali dal database
        const category = document.getElementById('category-' + rowId)?.value || '';
        const equipment = document.getElementById('equipment-' + rowId)?.value || '';
        const quantity = parseInt(document.getElementById('qty-' + rowId)?.value || '1') || 1;
        
        if (category && equipment && equipmentDatabase[category] && equipmentDatabase[category][equipment]) {
            const itemData = equipmentDatabase[category][equipment];
            const insurance = itemData.insurance || 0;
            const serial = itemData.serial || 'N/A';
            
            if (insurance > 0) {
                const totalValue = insurance * quantity;
                totalInsurance += totalValue;
                
                insuranceData.push([
                    category,
                    equipment,
                    quantity.toString(),
                    serial,
                    '€ ' + insurance.toLocaleString('it-IT'),
                    '€ ' + totalValue.toLocaleString('it-IT')
                ]);
            }
        }
    }
});
        
        // TABELLA VALORI ASSICURATIVI CON SERIALI
        if (insuranceData.length > 0) {
            doc.autoTable({
                head: [['Categoria', 'Attrezzatura', 'Qtà', 'Seriale', 'Valore Unit.', 'Totale']],
                body: insuranceData,
                startY: 120, // Era 125
                theme: 'grid',
                headStyles: { 
                    fillColor: [44, 90, 160],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 11
                },
                bodyStyles: {
                    fontSize: 10,
                    cellPadding: 3
                },
                columnStyles: {
                    0: { cellWidth: 30 },
                    1: { cellWidth: 55 },
                    2: { cellWidth: 15, halign: 'center' },
                    3: { cellWidth: 25, halign: 'center' },
                    4: { cellWidth: 25, halign: 'right' },
                    5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 255]
                }
            });
            
            // TOTALE ASSICURAZIONE
            const finalY = doc.lastAutoTable.finalY + 15;
            
            // Box totale con stile coerente
            doc.setFillColor(248, 250, 255);
            doc.rect(115, finalY, 80, 25, 'F');
            doc.setDrawColor(44, 90, 160);
            doc.setLineWidth(0.5);
            doc.rect(115, finalY, 80, 25);
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(44, 90, 160);
            doc.text('VALORE TOTALE DA ASSICURARE:', 118, finalY + 10);
            doc.text('€ ' + totalInsurance.toLocaleString('it-IT'), 190, finalY + 18, { align: 'right' });
            
            // NOTE FINALI - LARGHEZZA COMPLETA CORRETTE
            const noteY = finalY + 35;
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            
            const noteText = [
                "La società emette fattura al momento del ritiro materiale non si accettano dilazioni di pagamento che dovrà essere",
                "contestuale al RITIRO delle attrezzature. Ritiro e riconsegna a Vostra cura presso nostra sede. Il materiale non reso",
                "verrà addebitato al prezzo di listino della casa costruttrice. Eventuali danneggiamenti saranno valutati al momento",
                "della riconsegna ed addebitati per il loro valore. Il materiale eventualmente difettoso verrà riparato o sostituito presso",
                "la nostra sede. L'eventuale smarrimento dei MATERIALI, anche al fine di scongiurare una illecita utilizzazione dei",
                "medesimi, dovrà essere tempestivamente denunciato presso l'Autorità di Pubblica Sicurezza più vicina e quindi",
                "comunicato per iscritto."
            ];
            
            let currentNoteY = noteY;
            noteText.forEach(line => {
                doc.text(line, 15, currentNoteY, { maxWidth: 180 });
                currentNoteY += 4;
            });
            
        } else {
            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100);
            doc.text('Nessuna attrezzatura con valore assicurativo trovata nel preventivo', 105, 140, { align: 'center' });
            
            // Note anche se non ci sono attrezzature - CORRETTE
            const noteY = 160;
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            
            const noteText = [
                "La società emette fattura al momento del ritiro materiale non si accettano dilazioni di pagamento che dovrà essere",
                "contestuale al RITIRO delle attrezzature. Ritiro e riconsegna a Vostra cura presso nostra sede. Il materiale non reso",
                "verrà addebitato al prezzo di listino della casa costruttrice. Eventuali danneggiamenti saranno valutati al momento",
                "della riconsegna ed addebitati per il loro valore. Il materiale eventualmente difettoso verrà riparato o sostituito presso",
                "la nostra sede. L'eventuale smarrimento dei MATERIALI, anche al fine di scongiurare una illecita utilizzazione dei",
                "medesimi, dovrà essere tempestivamente denunciato presso l'Autorità di Pubblica Sicurezza più vicina e quindi",
                "comunicato per iscritto."
            ];
            
            let currentNoteY = noteY;
            noteText.forEach(line => {
                doc.text(line, 15, currentNoteY, { maxWidth: 180 });
                currentNoteY += 4;
            });
        }
        
        // SALVATAGGIO FILE
        const fileName = quoteName.replace(/[^a-z0-9]/gi, '_') + '_ValoriAssicurativi_' + docNumber + '.pdf';
        doc.save(fileName);
        
        showNotification('✅ Documento valori assicurativi generato: ' + docNumber, 'success');
        
    } catch (error) {
        console.error('Errore generazione valori assicurativi:', error);
        showNotification('❌ Errore nella generazione del documento: ' + error.message, 'error');
    }
}
    function generateQuotePDF(quoteId) {
    const quote = savedQuotes.find(q => q.id === quoteId);
    if (!quote) {
        showNotification('❌ Preventivo non trovato!', 'error');
        return;
    }
    
    // Carica il preventivo temporaneamente per generare il PDF
    const originalName = document.getElementById('quoteName').value;
    const originalCliente = document.getElementById('cliente').value;
    const originalPiva = document.getElementById('clientePiva').value;
    const originalContatti = document.getElementById('contatti').value;
    const originalCarico = document.getElementById('carico').value;
    const originalScarico = document.getElementById('scarico').value;
    const originalDurata = document.getElementById('durata').value;
    const originalSconto = document.getElementById('sconto').value;
    
    // Carica i dati del preventivo salvato
    document.getElementById('quoteName').value = quote.name || '';
    document.getElementById('cliente').value = quote.cliente || '';
    document.getElementById('clientePiva').value = quote.clientePiva || '';
    document.getElementById('contatti').value = quote.contatti || '';
    document.getElementById('carico').value = quote.carico || '';
    document.getElementById('scarico').value = quote.scarico || '';
    document.getElementById('durata').value = quote.durata || '1';
    document.getElementById('sconto').value = quote.sconto || '0';
    
    // Simula i totali (approssimativo per il PDF)
    document.getElementById('subtotale').textContent = '€ ' + (quote.total / 1.22).toFixed(2);
    document.getElementById('totale').textContent = '€ ' + quote.total.toFixed(2);
    
    // Genera il PDF
    setTimeout(() => {
        generatePDF();
        
        // Ripristina i valori originali
        document.getElementById('quoteName').value = originalName;
        document.getElementById('cliente').value = originalCliente;
        document.getElementById('clientePiva').value = originalPiva;
        document.getElementById('contatti').value = originalContatti;
        document.getElementById('carico').value = originalCarico;
        document.getElementById('scarico').value = originalScarico;
        document.getElementById('durata').value = originalDurata;
        document.getElementById('sconto').value = originalSconto;
        
        updateTotals();
    }, 500);
}

function generateAnalyticsReport() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // HEADER CON LOGO
        try {
            doc.addImage('https://i.imgur.com/ABMgyI8.png', 'PNG', 15, 15, 20, 20);
        } catch (e) {
            doc.setFillColor(44, 90, 160);
            doc.circle(25, 25, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.text('HP', 25, 28, { align: 'center' });
        }
        
        // TITOLO
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('HUBRIS PICTURES - REPORT ANALYTICS', 45, 22);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('Generato il: ' + new Date().toLocaleDateString('it-IT'), 15, 42);
        
        // STATISTICHE
        const monthlyQuotes = document.getElementById('monthlyQuotes').textContent;
        const estimatedRevenue = document.getElementById('estimatedRevenue').textContent;
        const conversionRate = document.getElementById('conversionRate').textContent;
        const topEquipment = document.getElementById('topEquipment').textContent;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('STATISTICHE MENSILI', 15, 60);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('Preventivi questo mese: ' + monthlyQuotes, 20, 70);
        doc.text('Fatturato stimato: ' + estimatedRevenue, 20, 80);
        doc.text('Tasso di conversione: ' + conversionRate, 20, 90);
        doc.text('Attrezzatura più richiesta: ' + topEquipment, 20, 100);
        
        // TABELLA PREVENTIVI RECENTI
        const recentQuotes = savedQuotes.slice(-10).reverse();
        const tableData = recentQuotes.map(q => [
            q.name || 'N/A',
            q.cliente || 'N/A',
            q.createdAt ? q.createdAt.split(',')[0] : 'N/A',
            '€ ' + (q.total || 0).toFixed(2),
            q.status === 'draft' ? 'Bozza' : q.status === 'sent' ? 'Inviato' : 'Confermato'
        ]);
        
        if (tableData.length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(44, 90, 160);
            doc.text('PREVENTIVI RECENTI', 15, 120);
            
            doc.autoTable({
                head: [['Preventivo', 'Cliente', 'Data', 'Totale', 'Status']],
                body: tableData,
                startY: 130,
                theme: 'grid',
                headStyles: { 
                    fillColor: [44, 90, 160],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 10
                },
                bodyStyles: {
                    fontSize: 9,
                    cellPadding: 3
                },
                columnStyles: {
                    0: { cellWidth: 50 },
                    1: { cellWidth: 40 },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 30, halign: 'right' },
                    4: { cellWidth: 30, halign: 'center' }
                }
            });
        }
        
        doc.save('Hubris_Analytics_Report.pdf');
        showNotification('✅ Report analytics generato!', 'success');
        
    } catch (error) {
        console.error('Errore generazione report:', error);
        showNotification('❌ Errore nella generazione del report', 'error');
    }
}

function exportAllQuotes() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // HEADER CON LOGO
        try {
            doc.addImage('https://i.imgur.com/ABMgyI8.png', 'PNG', 15, 15, 20, 20);
        } catch (e) {
            doc.setFillColor(44, 90, 160);
            doc.circle(25, 25, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.text('HP', 25, 28, { align: 'center' });
        }
        
        // TITOLO
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('HUBRIS PICTURES - EXPORT PREVENTIVI', 45, 22);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('Esportato il: ' + new Date().toLocaleDateString('it-IT'), 15, 42);
        doc.text('Totale preventivi: ' + savedQuotes.length, 15, 48);
        
        // TABELLA TUTTI I PREVENTIVI
        const tableData = savedQuotes.map(q => [
            q.name || 'N/A',
            q.cliente || 'N/A',
            q.createdAt ? q.createdAt.split(',')[0] : 'N/A',
            (q.durata || '1') + ' gg',
            (q.sconto || '0') + '%',
            '€ ' + (q.total || 0).toFixed(2),
            q.status === 'draft' ? 'Bozza' : q.status === 'sent' ? 'Inviato' : 'Confermato'
        ]);
        
        if (tableData.length > 0) {
            doc.autoTable({
                head: [['Nome', 'Cliente', 'Data', 'Durata', 'Sconto', 'Totale', 'Status']],
                body: tableData,
                startY: 60,
                theme: 'grid',
                headStyles: { 
                    fillColor: [44, 90, 160],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 9
                },
                bodyStyles: {
                    fontSize: 8,
                    cellPadding: 2
                },
                columnStyles: {
                    0: { cellWidth: 35 },
                    1: { cellWidth: 35 },
                    2: { cellWidth: 25 },
                    3: { cellWidth: 20, halign: 'center' },
                    4: { cellWidth: 20, halign: 'center' },
                    5: { cellWidth: 30, halign: 'right' },
                    6: { cellWidth: 25, halign: 'center' }
                }
            });
        } else {
            doc.text('Nessun preventivo trovato', 15, 70);
        }
        
        doc.save('Hubris_Export_Tutti_Preventivi.pdf');
        showNotification('✅ Export completo generato!', 'success');
        
    } catch (error) {
        console.error('Errore export:', error);
        showNotification('❌ Errore nell\'export', 'error');
    }
}

// SUBTOTALE MODIFICABILE
function makeSubtotalEditable() {
    const subtotalElement = document.getElementById('subtotale');
    const currentValue = subtotalElement.textContent.replace('€ ', '');
    
    subtotalElement.innerHTML = `<input type="number" id="manual-subtotal" value="${currentValue}" 
        style="width: 100px; text-align: right; border: 1px solid #ddd; padding: 2px;" 
        onchange="updateManualtotals()" step="0.01" min="0">`;
    
    document.getElementById('manual-subtotal').focus();
}

function updateManualtotals() {
    const manualSubtotal = parseFloat(document.getElementById('manual-subtotal').value) || 0;
    const discountPercent = parseFloat(document.getElementById('sconto').value) || 0;
    const discountAmount = manualSubtotal * (discountPercent / 100);
    const imponibile = manualSubtotal - discountAmount;
    const iva = imponibile * 0.22;
    const totale = imponibile + iva;
    
    // Restore normal display
    document.getElementById('subtotale').innerHTML = '€ ' + manualSubtotal.toFixed(2);
    document.getElementById('discount-percent').textContent = discountPercent.toFixed(1);
    document.getElementById('sconto-amount').textContent = '€ ' + discountAmount.toFixed(2);
    document.getElementById('imponibile').textContent = '€ ' + imponibile.toFixed(2);
    document.getElementById('iva').textContent = '€ ' + iva.toFixed(2);
    document.getElementById('totale').textContent = '€ ' + totale.toFixed(2);
}
// ANALYTICS
function updateAnalytics() {
    const thisMonth = savedQuotes.filter(q => {
        const created = new Date(q.createdAt.split(', ')[0].split('/').reverse().join('-'));
        const now = new Date();
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    });
    const totalRevenue = thisMonth.reduce((sum, q) => sum + q.total, 0);
    const confirmedQuotes = savedQuotes.filter(q => q.status === 'confirmed').length;
    const conversionRate = savedQuotes.length > 0 ? (confirmedQuotes / savedQuotes.length * 100) : 0;
    document.getElementById('monthlyQuotes').textContent = thisMonth.length;
    document.getElementById('estimatedRevenue').textContent = '€ ' + totalRevenue.toFixed(0);
    document.getElementById('conversionRate').textContent = conversionRate.toFixed(1) + '%';
    const equipmentCount = {};
    savedQuotes.forEach(quote => {
        quote.equipment.forEach(item => {
            if (!item.isService) {
                equipmentCount[item.equipment] = (equipmentCount[item.equipment] || 0) + parseInt(item.quantity);
            }
        });
    });
    const mostRequested = Object.keys(equipmentCount).reduce((a, b) => 
        equipmentCount[a] > equipmentCount[b] ? a : b, 'N/A'
    );
    document.getElementById('topEquipment').textContent = mostRequested;
}

// PLACEHOLDER FUNCTIONS FOR FUTURE DEVELOPMENT
function addNewEquipment() {
    const newName = prompt('Nome della nuova attrezzatura:');
    if (!newName) return;
    
    const category = prompt('Categoria (lascia vuoto per creare nuova categoria):');
    const price1 = parseFloat(prompt('Prezzo 1 giorno:') || '0');
    const price3 = parseFloat(prompt('Prezzo 3 giorni:') || '0');
    const price7 = parseFloat(prompt('Prezzo 1 settimana:') || '0');
    const insurance = parseFloat(prompt('Valore assicurativo:') || '0');
    const kit = prompt('Kit/Note (opzionale):') || '';
    
    if (!category) {
        const newCategory = prompt('Nome nuova categoria:');
        if (!newCategory) return;
        
        if (!equipmentDatabase[newCategory]) {
            equipmentDatabase[newCategory] = {};
        }
        
        equipmentDatabase[newCategory][newName] = {
            price1, price3, price7, insurance, kit, notes: ''
        };
    } else if (equipmentDatabase[category]) {
        equipmentDatabase[category][newName] = {
            price1, price3, price7, insurance, kit, notes: ''
        };
    } else {
        showNotification('❌ Categoria non trovata!', 'error');
        return;
    }
    
    // Refresh display
    const processedData = [];
    Object.keys(equipmentDatabase).forEach(cat => {
        Object.keys(equipmentDatabase[cat]).forEach(item => {
            const data = equipmentDatabase[cat][item];
            processedData.push({
                category: cat,
                name: item,
                ...data
            });
        });
    });
    
    renderDatabase(processedData);
    updateCategoryFilter();
    updateDbStats();
    showNotification('✅ Attrezzatura "' + newName + '" aggiunta!', 'success');
}

function editEquipment(category, name) {
    if (!equipmentDatabase[category] || !equipmentDatabase[category][name]) {
        showNotification('❌ Attrezzatura non trovata!', 'error');
        return;
    }
    
    const current = equipmentDatabase[category][name];
    
    const newPrice1 = parseFloat(prompt('Prezzo 1 giorno:', current.price1) || current.price1);
    const newPrice3 = parseFloat(prompt('Prezzo 3 giorni:', current.price3) || current.price3);
    const newPrice7 = parseFloat(prompt('Prezzo 1 settimana:', current.price7) || current.price7);
    const newInsurance = parseFloat(prompt('Valore assicurativo:', current.insurance) || current.insurance);
    const newKit = prompt('Kit/Note:', current.kit) || current.kit;
    
    // Update data
    equipmentDatabase[category][name] = {
        price1: newPrice1,
        price3: newPrice3,
        price7: newPrice7,
        insurance: newInsurance,
        kit: newKit,
        notes: current.notes || ''
    };
    
    // Refresh display
    const processedData = [];
    Object.keys(equipmentDatabase).forEach(cat => {
        Object.keys(equipmentDatabase[cat]).forEach(item => {
            const data = equipmentDatabase[cat][item];
            processedData.push({
                category: cat,
                name: item,
                ...data
            });
        });
    });
    
    renderDatabase(processedData);
    showNotification('✅ Attrezzatura "' + name + '" modificata!', 'success');
}

// INITIALIZATION
window.addEventListener('load', function() {
    // Prima controlla se siamo autenticati
    const isAuthenticated = localStorage.getItem('hubris_authenticated');
    if (isAuthenticated !== 'true') {
        // Se non siamo autenticati, mostra il login
        document.getElementById('loginOverlay').style.display = 'flex';
        if (document.getElementById('passwordInput')) {
            document.getElementById('passwordInput').focus();
        }
        return; // Esci qui se non autenticato
    }
    
    // Se siamo autenticati, nascondi il login e continua
    document.getElementById('loginOverlay').style.display = 'none';
    
    console.log('🚀 Inizializzazione sistema Hubris Rental...');
    
    // CARICAMENTO PREVENTIVI - SUBITO DOPO LOGIN
    setTimeout(() => {
        console.log('📂 Caricamento preventivi salvati...');
        
        // Prima prova a caricare da localStorage
        const stored = localStorage.getItem('hubris_quotes');
        if (stored) {
            try {
                savedQuotes = JSON.parse(stored);
                renderSavedQuotes();
                console.log('✅ Caricati', savedQuotes.length, 'preventivi da cache locale');
            } catch (e) {
                console.error('Errore parsing preventivi locali:', e);
                savedQuotes = [];
            }
        }
        
        // Poi prova a sincronizzare con GitHub
        loadQuotesFromGitHub().catch(error => {
            console.log('⚠️ GitHub non disponibile, uso solo cache locale');
        });
    }, 500);
    
    // Carica configurazione salvata (NON DUPLICARE QUESTE RIGHE!)
    const savedApiKey = localStorage.getItem('hubris_api_key');
    const savedSheetsId = localStorage.getItem('hubris_sheets_id');
    
    if (savedApiKey && savedApiKey.trim()) {
        CONFIG.API_KEY = savedApiKey.trim();
        console.log('🔑 API Key caricata da localStorage');
    }
    
    if (savedSheetsId && savedSheetsId.trim()) {
        CONFIG.SHEETS_ID = savedSheetsId.trim();
        console.log('📊 Sheets ID caricato da localStorage');
    }
    
    // Log configurazione (senza esporre API key completa)
    console.log('⚙️ Configurazione:', {
        hasApiKey: !!CONFIG.API_KEY,
        apiKeyPrefix: CONFIG.API_KEY ? CONFIG.API_KEY.substring(0, 8) + '...' : 'non impostato',
        sheetsId: CONFIG.SHEETS_ID ? CONFIG.SHEETS_ID.substring(0, 10) + '...' : 'non impostato'
    });
    
    // RIMUOVI QUESTA RIGA - È DUPLICATA!
    // loadQuotesFromGitHub();  <-- ELIMINA QUESTA
    
    // Inizializza Google API solo se configurato
    if (CONFIG.API_KEY && CONFIG.SHEETS_ID) {
        
        // Verifica base della API key
        if (!CONFIG.API_KEY.startsWith('AIza') || CONFIG.API_KEY.length < 39) {
            console.error('❌ API Key non valida nel formato');
            showNotification('❌ API Key non valida - Clicca su Config per aggiornare', 'error');
            return;
        }
        
        // Ritardo per dare tempo al DOM di caricarsi completamente
        setTimeout(() => {
            initializeGoogleAPI();
        }, 1000);
    } else {
        console.log('⚙️ Configurazione incompleta, modalità offline');
        console.log('⚙️ Clicca su "Config" per configurare le API Google Sheets', 'warning');
    }
    
    // Auto-sync every 10 minutes (ridotto per evitare troppi tentativi)
    setInterval(() => {
        if (isConnected && gapi_loaded) {
            showNotification('🔄 Auto-sync programmato...');
            loadDatabaseFromSheets();
            updateSyncTime();
        }
    }, 600000); // 10 minuti
    
});
// Global error handler
// GESTIONE ERRORI GLOBALE MIGLIORATA
window.addEventListener('error', function(e) {
    console.error('❌ Errore globale:', e.error);
    console.error('📍 File:', e.filename, 'Linea:', e.lineno);
});
    
// Funzione per il bottone Duplica (preventivo corrente)
function duplicateQuote() {
    const quoteName = document.getElementById('quoteName').value;
    if (!quoteName) {
        showNotification('❌ Nessun preventivo da duplicare!', 'error');
        return;
    }
    
    // Cambia il nome aggiungendo "- Copia"
    document.getElementById('quoteName').value = quoteName + ' - Copia';
    
    // Reset modalità edit
    currentQuoteId = null;
    isEditMode = false;
    updateUIMode();
    
    showNotification('📄 Preventivo duplicato! Modifica il nome e salva.', 'info');
}

// Funzione per il bottone Reset (già esiste ma verificala)
function resetQuote() {
    if (confirm('Sei sicuro di voler cancellare tutto il preventivo?')) {
        document.getElementById('equipmentRows').innerHTML = '';
        document.getElementById('cliente').value = '';
        document.getElementById('clientePiva').value = '';
        document.getElementById('clienteVia').value = '';
        document.getElementById('clientePec').value = '';
        document.getElementById('codiceUnivoco').value = '';
        document.getElementById('contatti').value = '';
        document.getElementById('carico').value = '';
        document.getElementById('scarico').value = '';
        document.getElementById('durata').value = '1';
        document.getElementById('sconto').value = '0';
        document.getElementById('quoteName').value = '';
        
        // Reset subtotale sbarrato
        document.getElementById('enable-crossed-subtotal').checked = false;
        document.getElementById('crossed-subtotal-input').value = '0';
        toggleCrossedSubtotal();
        
        // Reset modalità
        currentQuoteId = null;
        isEditMode = false;
        updateUIMode();
        
        updateTotals();
        showNotification('🔄 Preventivo resettato', 'info');
    }
    }
    
    // ========================================
// GESTIONE VALORI ASSICURATIVI
// ========================================

let currentInsuranceData = null;
let insuranceDataStore = {}; // Store locale per i dati assicurativi

// Funzione per aprire la scheda assicurazione da un preventivo
function openInsuranceForQuote(quoteId) {
    // Carica il preventivo
    const quote = savedQuotes.find(q => q.id === quoteId);
    if (!quote) {
        showNotification('❌ Preventivo non trovato!', 'error');
        return;
    }
    
    // Passa alla tab assicurazione
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById('insurance').classList.add('active');
    document.querySelector('[onclick="showTab(\'insurance\')"]').classList.add('active');
    
    // Popola il selector e carica i dati
    populateInsuranceQuoteSelector();
    document.getElementById('insurance-quote-selector').value = quoteId;
    loadInsuranceForQuote();
    
    showNotification('🛡️ Scheda assicurazione caricata', 'success');
}

// Popola il dropdown con i preventivi salvati
function populateInsuranceQuoteSelector() {
    const selector = document.getElementById('insurance-quote-selector');
    selector.innerHTML = '<option value="">Seleziona un preventivo...</option>';
    
    savedQuotes.forEach(quote => {
        const option = document.createElement('option');
        option.value = quote.id;
        option.textContent = quote.name + ' - ' + quote.cliente + ' (' + quote.createdAt + ')';
        selector.appendChild(option);
    });
}

// Carica i dati assicurativi per un preventivo
function loadInsuranceForQuote() {
    const quoteId = document.getElementById('insurance-quote-selector').value;
    
    if (!quoteId) {
        document.getElementById('insurance-info').style.display = 'none';
        document.getElementById('insurance-empty').style.display = 'block';
        return;
    }
    
    const quote = savedQuotes.find(q => q.id == quoteId);
    if (!quote) {
        showNotification('❌ Preventivo non trovato!', 'error');
        return;
    }
    
    // Mostra la sezione info
    document.getElementById('insurance-info').style.display = 'block';
    document.getElementById('insurance-empty').style.display = 'none';
    
    // Popola i dati base
    document.getElementById('insurance-cliente').value = quote.cliente || '';
    document.getElementById('insurance-progetto').value = quote.name || '';
    document.getElementById('insurance-data').value = new Date().toISOString().split('T')[0];
    
    // Controlla se esistono dati salvati
    const savedInsuranceData = loadSavedInsuranceData(quoteId);
    
    if (savedInsuranceData) {
        // Usa i dati salvati
        renderInsuranceItems(savedInsuranceData.items);
        document.getElementById('insurance-data').value = savedInsuranceData.data_valutazione || new Date().toISOString().split('T')[0];
    } else {
        // Genera i dati dal preventivo
        const insuranceItems = generateInsuranceItemsFromQuote(quote);
        renderInsuranceItems(insuranceItems);
    }
    
    updateInsuranceTotals();
}

// Genera gli items assicurativi dal preventivo
function generateInsuranceItemsFromQuote(quote) {
    const items = [];
    
    if (!quote.equipment) return items;
    
    quote.equipment.forEach((eq, index) => {
        // Salta i servizi
        if (eq.isService) return;
        
        // Per attrezzature custom
        if (eq.isCustom) {
            items.push({
                id: 'item-' + index,
                categoria: eq.category || 'CUSTOM',
                attrezzatura: eq.equipment || '',
                quantita: eq.quantity || 1,
                seriale: '',
                valore_unitario: 0,
                incluso: true,
                isCustom: true
            });
        } else {
            // Per attrezzature da database
            let valoreDefault = 0;
            let serialeDefault = '';
            
            if (equipmentDatabase[eq.category] && equipmentDatabase[eq.category][eq.equipment]) {
                const dbItem = equipmentDatabase[eq.category][eq.equipment];
                valoreDefault = dbItem.insurance || 0;
                serialeDefault = dbItem.serial || '';
            }
            
            items.push({
                id: 'item-' + index,
                categoria: eq.category || '',
                attrezzatura: eq.equipment || '',
                quantita: eq.quantity || 1,
                seriale: serialeDefault,
                valore_unitario: valoreDefault,
                incluso: true,
                isCustom: false
            });
        }
    });
    
    return items;
}

// Renderizza gli items nella tabella
function renderInsuranceItems(items) {
    const tbody = document.getElementById('insurance-items');
    tbody.innerHTML = '';
    
    items.forEach((item, index) => {
        const row = document.createElement('tr');
        row.className = item.isCustom ? 'custom-insurance-row' : 'insurance-row';
        row.style.background = item.isCustom ? '#fffbf0' : '';
        
        row.innerHTML = `
            <td>
                <input type="checkbox" id="insurance-check-${index}" 
                    ${item.incluso ? 'checked' : ''} 
                    onchange="updateInsuranceTotals()">
            </td>
            <td>${item.categoria}</td>
            <td>${item.attrezzatura}</td>
            <td style="text-align: center;">${item.quantita}</td>
            <td>
                <input type="text" class="form-input" 
                    id="insurance-serial-${index}" 
                    value="${item.seriale || ''}" 
                    placeholder="${item.isCustom ? 'Inserisci seriale' : 'N/A'}"
                    style="width: 100%; padding: 4px;">
            </td>
            <td>
                <input type="number" class="form-input" 
                    id="insurance-value-${index}" 
                    value="${item.valore_unitario || 0}" 
                    min="0" step="100"
                    onchange="updateInsuranceTotals()"
                    style="width: 100%; padding: 4px; text-align: right; ${item.isCustom ? 'background: #fff3cd;' : ''}">
            </td>
            <td style="text-align: right; font-weight: bold;" id="insurance-total-${index}">
                € ${((item.valore_unitario || 0) * item.quantita).toLocaleString('it-IT')}
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Salva i dati correnti in memoria
    currentInsuranceData = items;
}

// Aggiorna i totali
function updateInsuranceTotals() {
    let totale = 0;
    
    if (currentInsuranceData) {
        currentInsuranceData.forEach((item, index) => {
            const checkbox = document.getElementById('insurance-check-' + index);
            const valueInput = document.getElementById('insurance-value-' + index);
            
            if (checkbox && checkbox.checked && valueInput) {
                const valore = parseFloat(valueInput.value) || 0;
                const subtotale = valore * item.quantita;
                totale += subtotale;
                
                // Aggiorna il totale della riga
                const totalCell = document.getElementById('insurance-total-' + index);
                if (totalCell) {
                    totalCell.textContent = '€ ' + subtotale.toLocaleString('it-IT');
                }
            }
        });
    }
    
    document.getElementById('insurance-total').textContent = 'Totale: € ' + totale.toLocaleString('it-IT');
}

// Salva i dati assicurativi
async function saveInsuranceData() {
    const quoteId = document.getElementById('insurance-quote-selector').value;
    if (!quoteId) {
        showNotification('❌ Nessun preventivo selezionato!', 'error');
        return;
    }
    
    // Raccogli i dati aggiornati
    const insuranceData = {
        preventivo_id: quoteId,
        preventivo_nome: document.getElementById('insurance-progetto').value,
        cliente: document.getElementById('insurance-cliente').value,
        data_valutazione: document.getElementById('insurance-data').value,
        items: [],
        totale: 0
    };
    
    let totale = 0;
    currentInsuranceData.forEach((item, index) => {
        const checkbox = document.getElementById('insurance-check-' + index);
        const serialInput = document.getElementById('insurance-serial-' + index);
        const valueInput = document.getElementById('insurance-value-' + index);
        
        const updatedItem = {
            ...item,
            incluso: checkbox ? checkbox.checked : false,
            seriale: serialInput ? serialInput.value : '',
            valore_unitario: valueInput ? parseFloat(valueInput.value) || 0 : 0
        };
        
        if (updatedItem.incluso) {
            totale += updatedItem.valore_unitario * updatedItem.quantita;
        }
        
        insuranceData.items.push(updatedItem);
    });
    
    insuranceData.totale = totale;
    
    // Validazione
    if (!validateInsuranceData(insuranceData)) {
        showNotification('❌ Dati non validi!', 'error');
        return;
    }
    
    // Salva in localStorage
    localStorage.setItem('insurance_' + quoteId, JSON.stringify(insuranceData));
    insuranceDataStore[quoteId] = insuranceData;
    
    // Salva su GitHub
    try {
        await saveInsuranceToGitHub(insuranceData);
        showNotification('✅ Valori assicurativi salvati!', 'success');
    } catch (error) {
        showNotification('⚠️ Salvato solo localmente', 'warning');
        console.error('Errore salvataggio GitHub:', error);
    }
}

// Validazione dati assicurativi
function validateInsuranceData(data) {
    if (!data || !data.preventivo_id || !data.items) {
        return false;
    }
    
    try {
        // Test che sia serializzabile
        const test = JSON.stringify(data);
        JSON.parse(test);
        return true;
    } catch (e) {
        console.error('Validazione fallita:', e);
        return false;
    }
}

// Salva su GitHub
async function saveInsuranceToGitHub(insuranceData) {
    const token = getGitHubToken();
    if (!token) {
        throw new Error('Token GitHub mancante');
    }
    
    // Crea path con struttura anno/mese
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const fileName = `assicurazioni/${year}/${month}/assicurazione_${insuranceData.preventivo_id}.json`;
    
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(insuranceData, null, 2))));
    
    // Controlla se il file esiste già
    let sha = null;
    try {
        const checkResponse = await fetch(
            `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${fileName}`,
            {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        if (checkResponse.ok) {
            const fileData = await checkResponse.json();
            sha = fileData.sha;
        }
    } catch (e) {
        console.log('File non esiste, verrà creato');
    }
    
    // Salva o aggiorna il file
    const response = await fetch(
        `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${fileName}`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `${sha ? 'Aggiorna' : 'Crea'} valori assicurativi per: ${insuranceData.preventivo_nome}`,
                content: content,
                sha: sha
            })
        }
    );
    
    if (!response.ok) {
        throw new Error('Errore salvataggio GitHub: ' + response.status);
    }
    
    return true;
}

// Carica dati salvati
function loadSavedInsuranceData(quoteId) {
    // Prima controlla localStorage
    const localData = localStorage.getItem('insurance_' + quoteId);
    if (localData) {
        try {
            return JSON.parse(localData);
        } catch (e) {
            console.error('Errore parsing dati locali:', e);
        }
    }
    
    // Poi controlla il datastore in memoria
    if (insuranceDataStore[quoteId]) {
        return insuranceDataStore[quoteId];
    }
    
    return null;
}

// Sincronizza con il preventivo
function syncInsuranceWithQuote() {
    const quoteId = document.getElementById('insurance-quote-selector').value;
    if (!quoteId) {
        showNotification('❌ Nessun preventivo selezionato!', 'error');
        return;
    }
    
    if (confirm('⚠️ Questo aggiornerà i valori con quelli del preventivo. I valori modificati manualmente potrebbero essere persi. Continuare?')) {
        loadInsuranceForQuote();
        showNotification('🔄 Sincronizzato con il preventivo', 'success');
    }
}

// Reset valori
function resetInsuranceValues() {
    if (!confirm('⚠️ Questo resetterà tutti i valori ai default del database. Continuare?')) {
        return;
    }
    
    const quoteId = document.getElementById('insurance-quote-selector').value;
    if (!quoteId) return;
    
    // Rimuovi dati salvati
    localStorage.removeItem('insurance_' + quoteId);
    delete insuranceDataStore[quoteId];
    
    // Ricarica
    loadInsuranceForQuote();
    showNotification('🔄 Valori resettati ai default', 'info');
}

// Genera PDF dalla tab assicurazione
function generateInsuranceFromTab() {
    const quoteId = document.getElementById('insurance-quote-selector').value;
    if (!quoteId) {
        showNotification('❌ Nessun preventivo selezionato!', 'error');
        return;
    }
    
    // Salva prima di generare
    saveInsuranceData().then(() => {
        // Poi genera il PDF usando i dati salvati
        generateInsurancePDFWithCustomValues(quoteId);
    });
}

// Genera PDF con valori custom
function generateInsurancePDFWithCustomValues(quoteId) {
    const insuranceData = loadSavedInsuranceData(quoteId);
    if (!insuranceData) {
        showNotification('❌ Nessun dato assicurativo trovato!', 'error');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const docNumber = 'ASS-' + Date.now().toString().slice(-6);
        
        // HEADER (uguale a prima)
        try {
            doc.addImage('https://i.imgur.com/ABMgyI8.png', 'PNG', 15, 10, 35, 35);
        } catch (e) {
            doc.setFillColor(44, 90, 160);
            doc.circle(32.5, 27.5, 17, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text('HP', 32.5, 32, { align: 'center' });
        }
        
        // INTESTAZIONE AZIENDA
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('HUBRIS PICTURES S.R.L.', 55, 22);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('P.IVA: 09542051215', 55, 29);
        doc.text('PEC: hubrispictures@pec.it | Tel: +39 081 18893796 / +39 348 6901218', 55, 34);
        doc.text('Indirizzo: Piazza Vanvitelli, 5, 80127 Napoli NA', 55, 39);
        doc.text('Email: info@hubrispictures.com', 55, 44);
        
        // NUMERO DOCUMENTO
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('VALORI', 195, 10, { align: 'right' });
        doc.text('ASSICURATIVI', 195, 18, { align: 'right' });
        doc.text('N. ' + docNumber, 195, 26, { align: 'right' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Data: ' + insuranceData.data_valutazione, 195, 33, { align: 'right' });
        
        // LINEA SEPARATRICE
        doc.setDrawColor(44, 90, 160);
        doc.setLineWidth(1.5);
        doc.line(15, 50, 195, 50);
        
        // INFO CLIENTE
        doc.setFillColor(248, 250, 255);
        doc.rect(15, 55, 85, 35, 'F');
        doc.setDrawColor(44, 90, 160);
        doc.setLineWidth(0.3);
        doc.rect(15, 55, 85, 35);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('CLIENTE:', 18, 62);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.text(insuranceData.cliente, 18, 68);
        doc.text('Progetto: ' + insuranceData.preventivo_nome, 18, 74);
        
        // INFO VALUTAZIONE
        doc.setFillColor(248, 250, 255);
        doc.rect(110, 55, 85, 35, 'F');
        doc.setDrawColor(44, 90, 160);
        doc.setLineWidth(0.3);
        doc.rect(110, 55, 85, 35);
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('VALUTAZIONE:', 113, 62);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('Data: ' + insuranceData.data_valutazione, 113, 68);
        doc.text('Totale: € ' + insuranceData.totale.toLocaleString('it-IT'), 113, 74);
        
        // TABELLA ATTREZZATURE
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 90, 160);
        doc.text('ATTREZZATURE DA ASSICURARE', 105, 105, { align: 'center' });
        
        // Prepara dati tabella
        const tableData = [];
        insuranceData.items.forEach(item => {
            if (item.incluso) {
                const totale = item.valore_unitario * item.quantita;
                tableData.push([
                    item.categoria,
                    item.attrezzatura,
                    item.quantita.toString(),
                    item.seriale || 'N/A',
                    '€ ' + item.valore_unitario.toLocaleString('it-IT'),
                    '€ ' + totale.toLocaleString('it-IT')
                ]);
            }
        });
        
        if (tableData.length > 0) {
            doc.autoTable({
                head: [['Categoria', 'Attrezzatura', 'Qtà', 'Seriale', 'Valore Unit.', 'Valore Tot.']],
                body: tableData,
                startY: 110,
                theme: 'grid',
                headStyles: { 
                    fillColor: [44, 90, 160],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 11
                },
                bodyStyles: {
                    fontSize: 10,
                    cellPadding: 3
                },
                columnStyles: {
                    0: { cellWidth: 30 },
                    1: { cellWidth: 55 },
                    2: { cellWidth: 15, halign: 'center' },
                    3: { cellWidth: 25, halign: 'center' },
                    4: { cellWidth: 25, halign: 'right' },
                    5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 255]
                }
            });
            
            // TOTALE FINALE
            const finalY = doc.lastAutoTable.finalY + 15;
            
            doc.setFillColor(248, 250, 255);
            doc.rect(115, finalY, 80, 25, 'F');
            doc.setDrawColor(44, 90, 160);
            doc.setLineWidth(0.5);
            doc.rect(115, finalY, 80, 25);
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(44, 90, 160);
            doc.text('VALORE TOTALE DA ASSICURARE:', 118, finalY + 10);
            doc.text('€ ' + insuranceData.totale.toLocaleString('it-IT'), 190, finalY + 18, { align: 'right' });
        }
        
        // SALVA PDF
        const fileName = insuranceData.preventivo_nome.replace(/[^a-z0-9]/gi, '_') + '_Assicurazione_' + docNumber + '.pdf';
        doc.save(fileName);
        
        showNotification('✅ PDF assicurazione generato!', 'success');
        
    } catch (error) {
        console.error('Errore generazione PDF:', error);
        showNotification('❌ Errore nella generazione del PDF', 'error');
    }
}

// Carica dati assicurativi da GitHub all'avvio
async function loadInsuranceDataFromGitHub() {
    try {
        const token = getGitHubToken();
        if (!token) {
            console.log('⚠️ Token GitHub mancante per assicurazioni');
            return;
        }
        
        // Funzione ricorsiva per leggere cartelle
        async function readDirectory(path = 'assicurazioni') {
            try {
                const response = await fetch(
                    `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${path}`,
                    {
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                
                if (!response.ok) {
                    if (response.status === 404) {
                        console.log('📁 Cartella assicurazioni non trovata');
                        return [];
                    }
                    return [];
                }
                
                const items = await response.json();
                const jsonFiles = [];
                
                for (const item of items) {
                    if (item.type === 'dir') {
                        const subFiles = await readDirectory(item.path);
                        jsonFiles.push(...subFiles);
                    } else if (item.name.startsWith('assicurazione_') && item.name.endsWith('.json')) {
                        jsonFiles.push(item);
                    }
                }
                
                return jsonFiles;
            } catch (error) {
                console.error('Errore lettura directory assicurazioni:', error);
                return [];
            }
        }
        
        const files = await readDirectory();
        
        for (const file of files) {
            try {
                const fileResponse = await fetch(file.download_url);
                const fileText = await fileResponse.text();
                const data = JSON.parse(fileText);
                
                if (validateInsuranceData(data)) {
                    insuranceDataStore[data.preventivo_id] = data;
                    // Salva anche in localStorage come backup
                    localStorage.setItem('insurance_' + data.preventivo_id, JSON.stringify(data));
                    console.log('✅ Caricati valori assicurativi per:', data.preventivo_nome);
                }
            } catch (e) {
                console.warn('⚠️ File assicurazione corrotto:', file.name);
            }
        }
        
        console.log('📂 Caricati', Object.keys(insuranceDataStore).length, 'documenti assicurativi');
        
    } catch (error) {
        console.error('❌ Errore caricamento assicurazioni da GitHub:', error);
    }
}  

// Override della funzione showTab per gestire la tab assicurazione
const originalShowTab = window.showTab;
if (originalShowTab) {
    window.showTab = function(tabName) {
        // Chiama la funzione originale
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
        event.target.classList.add('active');
        
        // Logica specifica per tab
        if (tabName === 'analytics') {
            updateAnalytics();
        }
        
        // NUOVO - per tab assicurazione
        if (tabName === 'insurance') {
            populateInsuranceQuoteSelector();
        }
    };
     // Event listeners per la tab assicurazione
document.addEventListener('DOMContentLoaded', function() {
    // Listener per il selector
    const insuranceSelector = document.getElementById('insurance-quote-selector');
    if (insuranceSelector) {
        insuranceSelector.addEventListener('change', loadInsuranceForQuote);
    }
    
    // Listener per il bottone sync
    const syncBtn = document.getElementById('syncInsuranceBtn');
    if (syncBtn) {
        syncBtn.addEventListener('click', syncInsuranceWithQuote);
    }
    
    // Carica dati assicurativi dopo i preventivi
    setTimeout(() => {
        loadInsuranceDataFromGitHub();
    }, 3000);
}); 
}

