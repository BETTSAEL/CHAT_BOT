// ======================================================
// BOT DE WHATSAPP CON GPT + MYSQL + INFORMACIÓN LOCAL
// ======================================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { OpenAI } = require('openai');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');
const docx = require('docx-parser'); // npm install docx-parser

// === Validación de API Key ===
if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Falta la variable OPENAI_API_KEY en .env');
    process.exit(1);
}

// ======================================================
// 🧠 Lectura de archivo local (TXT o DOCX)
// ======================================================
let informacionBase = '';

function leerArchivoTXT() {
    try {
        const ruta = path.join(__dirname, 'informacion.txt');
        if (fs.existsSync(ruta)) {
            informacionBase = fs.readFileSync(ruta, 'utf8');
            console.log('📄 Información cargada desde informacion.txt');
        }
    } catch (err) {
        console.error('❌ Error leyendo informacion.txt:', err);
    }
}

async function leerArchivoDOCX() {
    const ruta = path.join(__dirname, 'informacion.docx');
    if (fs.existsSync(ruta)) {
        return new Promise((resolve, reject) => {
            docx.parseDocx(ruta, (data) => {
                if (!data) reject('Archivo vacío');
                informacionBase = data;
                console.log('📄 Información cargada desde informacion.docx');
                resolve();
            });
        });
    }
}

// Carga inicial del archivo
leerArchivoTXT();
leerArchivoDOCX();

// Actualización automática si cambia el archivo
fs.watchFile(path.join(__dirname, 'informacion.txt'), leerArchivoTXT);

// ======================================================
// Inicialización de OpenAI
// ======================================================
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function hablarConGPT(mensajeUsuario, contexto) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Eres un asistente conversacional para un bot de taxis (ALO45).
                    Usa la información siguiente como referencia principal:
                    ${informacionBase || 'No hay información cargada actualmente.'}
                    Si el usuario no está registrado, guíalo para registrarse.
                    Si ya está registrado, salúdalo por su nombre y ofrécele ayuda.`
                },
                { role: "user", content: `Contexto actual: ${JSON.stringify(contexto)}` },
                { role: "user", content: mensajeUsuario }
            ],
            temperature: 0.6,
            max_tokens: 350
        });
        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('❌ Error GPT:', error);
        return '⚠️ No puedo responder en este momento.';
    }
}

// ======================================================
// Configuración del cliente de WhatsApp
// ======================================================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => {
    console.log('📱 Escanea este código QR para conectar WhatsApp:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => console.log('✅ Bot conectado y listo'));
client.initialize();

// ======================================================
// Estados de conversación
// ======================================================
const sesiones = new Map();

// ======================================================
// Lógica principal
// ======================================================
client.on('message', async msg => {
    const chatId = msg.from;
    const texto = msg.body.trim();
    const estado = sesiones.get(chatId) || { paso: 'inicio' };

    try {
        const comando = texto.toLowerCase().trim();
        if (['salir', 'reiniciar', 'volver', 'menu', 'inicio'].includes(comando)) {
            sesiones.delete(chatId);
            const saludo = await hablarConGPT("El usuario ha pedido reiniciar la conversación.", {});
            await msg.reply(saludo);
            return;
        }


        // === Paso 1: Solicitar DNI ===
        if (estado.paso === 'inicio') {
            sesiones.set(chatId, { paso: 'esperando_dni' });
            await msg.reply('👋 ¡Hola! Por favor, envíame tu *DNI* para identificarte.');
            return;
        }

        // === Paso 2: Verificación en base de datos ===
        if (estado.paso === 'esperando_dni') {
            const dni = texto.replace(/\D/g, '');
            if (!/^\d{8}$/.test(dni)) {
                await msg.reply('⚠️ DNI inválido. Envía 8 dígitos.');
                return;
            }

            db.query('SELECT * FROM usuario WHERE DNI = ?', [dni], async (err, results) => {
                if (err) {
                    console.error('❌ Error MySQL:', err);
                    await msg.reply('⚠️ Error al consultar la base de datos.');
                    return;
                }

                if (results.length > 0) {
                    const user = results[0];
                    sesiones.set(chatId, { paso: 'conectado', usuario: user });
                    const respuesta = await hablarConGPT(
                        `El usuario con DNI ${dni} ha sido identificado.`,
                        { usuario: user }
                    );
                    await msg.reply(respuesta);
                } else {
                    sesiones.set(chatId, { paso: 'registro', nuevoUsuario: { dni, campo: 'nombre' } });
                    const respuesta = await hablarConGPT(
                        `El usuario con DNI ${dni} no está registrado.`,
                        { accion: 'registro' }
                    );
                    await msg.reply(respuesta + '\n\nPor favor, dime tu *nombre* para registrarte:');
                }
            });
            return;
        }

        // === Paso 3: Registro paso a paso guiado por GPT con validación ===
        if (estado.paso === 'registro') {
            const nuevo = estado.nuevoUsuario;

            // Función para pedir el siguiente dato con instrucciones claras
            async function pedirSiguienteDato(campo) {
                const instrucciones = {
                    nombre: 'Tu nombre completo (solo letras, mínimo 2 caracteres).',
                    apellidos: 'Tus apellidos (solo letras, mínimo 2 caracteres).',
                    ZELLO: 'Tu usuario de ZELLO (mínimo 4 caracteres, sin espacios).',
                    ALO45: 'Tu código ALO45 (5 a 8 caracteres, puede incluir letras y números).'
                };

                const respuesta = await hablarConGPT(
                    `Estamos en el registro. El usuario debe proporcionar su ${campo}. 
            Explícale con amabilidad qué debe escribir y cuántos caracteres debe tener. 
            Usa tono conversacional y claro. 
            Instrucción para el campo ${campo}: ${instrucciones[campo]}`,
                    { progreso: nuevo }
                );

                await msg.reply(respuesta);
            }

            // === Validar y guardar cada campo ===
            if (nuevo.campo === 'nombre') {
                if (texto.length < 2 || /\d/.test(texto)) {
                    await msg.reply('⚠️ El nombre debe tener al menos 2 letras y no contener números.');
                    return;
                }
                nuevo.nombre = texto;
                nuevo.campo = 'apellidos';
                return pedirSiguienteDato('apellidos');
            }

            if (nuevo.campo === 'apellidos') {
                if (texto.length < 2 || /\d/.test(texto)) {
                    await msg.reply('⚠️ Los apellidos deben tener al menos 2 letras y no contener números.');
                    return;
                }
                nuevo.apellidos = texto;
                nuevo.campo = 'ZELLO';
                return pedirSiguienteDato('ZELLO');
            }

            if (nuevo.campo === 'ZELLO') {
                if (texto.length < 4 || /\s/.test(texto)) {
                    await msg.reply('⚠️ El usuario de ZELLO debe tener al menos 4 caracteres y sin espacios.');
                    return;
                }
                nuevo.ZELLO = texto;
                nuevo.campo = 'ALO45';
                return pedirSiguienteDato('ALO45');
            }

            if (nuevo.campo === 'ALO45') {
                if (texto.length < 5 || texto.length > 8) {
                    await msg.reply('⚠️ El código ALO45 debe tener entre 5 y 8 caracteres.');
                    return;
                }
                nuevo.ALO45 = texto;

                // === Registro completo ===
                db.query(
                    'INSERT INTO usuario (DNI, nombre, apellidos, ZELLO, ALO45) VALUES (?, ?, ?, ?, ?)',
                    [nuevo.dni, nuevo.nombre, nuevo.apellidos, nuevo.ZELLO, nuevo.ALO45],
                    async err => {
                        if (err) {
                            console.error('❌ Error al registrar:', err);
                            await msg.reply('⚠️ Error al registrar. Intenta más tarde.');
                            return;
                        }

                        sesiones.set(chatId, { paso: 'conectado', usuario: nuevo });
                        const respuesta = await hablarConGPT(
                            `El usuario ${nuevo.nombre} ${nuevo.apellidos} se ha registrado correctamente.`,
                            { usuario: nuevo }
                        );
                        await msg.reply(respuesta + '\n\n✅ ¡Registro completado!');
                    }
                );
                return;
            }
        }


        // === Paso 4: Usuario conectado ===
        if (estado.paso === 'conectado') {
            const respuesta = await hablarConGPT(texto, { usuario: estado.usuario });
            await msg.reply(respuesta);
            return;
        }

    } catch (err) {
        console.error('💥 Error general:', err);
        await msg.reply('⚠️ Ocurrió un error inesperado.');
    }
});
