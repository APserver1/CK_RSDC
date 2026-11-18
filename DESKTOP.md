# Cheques RSDC para Windows

La aplicación Tauri incluye la interfaz compilada y conserva IndexedDB y la sesión en su propio perfil de Windows. La primera vez se necesita internet para iniciar sesión y descargar los cheques, personal y catálogos. Espera a que termine la sincronización antes de desconectar. Los cambios sin conexión quedan en la cola local existente.

El almacenamiento de la aplicación es independiente del navegador. Los datos pendientes del navegador deben sincronizarse antes de comenzar a usar la aplicación de escritorio. Cerrar sesión desactiva el acceso offline hasta volver a iniciar sesión con internet.

## Compilar en Windows

Instala Rust mediante rustup y Visual Studio Build Tools con la carga «Desarrollo para el escritorio con C++». Configura `.env.local` con las mismas variables públicas de Supabase que usa la web. Nunca incluyas una clave service_role.

Ejecuta `npm ci` y `npm run desktop:build`. El instalador estará en `src-tauri/target/release/bundle/nsis/`. Incluye el instalador offline de WebView2. Para desarrollo usa `npm run desktop:dev`.

También se puede ejecutar manualmente el workflow «Windows desktop installer» en GitHub Actions después de subir estos archivos. Configura los secretos `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` y, si corresponde, la variable `VITE_SUPABASE_CHEQUES_TABLE`. Descarga el artefacto Cheques-RSDC-Windows al terminar. El instalador no está firmado.

## Comprobación en el equipo de destino

Instala, inicia sesión con conexión y verifica que aparezcan los datos. Cierra la aplicación, desconecta internet y vuelve a abrirla. Comprueba que puedes abrir y guardar un cheque, imprimirlo, cerrar y reabrir conservando los cambios. Recupera la conexión y comprueba que la cola se sincronice. Confirma también que «Salir» exige iniciar sesión de nuevo.
