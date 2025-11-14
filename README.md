# 🤖 Bot de WhatsApp para ALO45 (GPT + MySQL)

Este es un bot de WhatsApp automatizado diseñado para la asistencia a conductores de la empresa de taxis ALO45. Utiliza la API de OpenAI (GPT-4o-mini) para mantener conversaciones inteligentes y se conecta a una base de datos MySQL para la verificación y registro de conductores.

## 🚀 Características

* **Flujo de Registro de Conductores:** Identifica a los conductores por DNI. Si no existen, los guía a través de un proceso de registro paso a paso.
* **Conexión a WhatsApp:** Utiliza `whatsapp-web.js` para conectarse como un cliente de WhatsApp real, leyendo y respondiendo mensajes.
* **Inteligencia Artificial (OpenAI):** Las respuestas se generan dinámicamente usando `gpt-4o-mini`, permitiendo una conversación natural.
* **Base de Conocimiento Local:** El bot carga información desde un archivo local (`informacion.txt` o `informacion.docx`) para responder preguntas específicas sobre la empresa.
* **Persistencia de Sesión:** Mantiene el estado de la conversación (ej. `esperando_dni`, `registro`, `conectado`) para cada usuario.

## 🛠️ Requisitos Previos

Para ejecutar este proyecto, necesitarás:
* [Node.js](https://nodejs.org/) (v16 o superior)
* Un servidor de base de datos [MySQL](https://www.mysql.com/) (local o remoto)
* Una cuenta de [OpenAI](https://openai.com/) con créditos y una API Key.
* Un teléfono con WhatsApp (para escanear el código QR).

## ⚙️ Configuración

Sigue estos pasos para poner en marcha el bot:

### 1. Clona el Repositorio
(Si estás en GitHub)
```bash
git clone [https://github.com/tu-usuario/tu-repo.git](https://github.com/tu-usuario/tu-repo.git)
cd tu-repo
