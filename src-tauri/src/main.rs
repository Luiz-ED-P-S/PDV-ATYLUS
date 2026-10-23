#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri_plugin_shell::ShellExt;

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      // Inicia o sidecar PDV.API (.NET 8) em background
      let sidecar_result = app.shell().sidecar("pdv-api");
      match sidecar_result {
        Ok(cmd) => {
          match cmd
            .env("PDV_DESKTOP_MODE", "1")
            .env("ASPNETCORE_URLS", "http://localhost:5000")
            .spawn()
          {
            Ok((mut _rx, child)) => {
              println!("PDV.API iniciado com sucesso como sidecar. PID: {:?}", child.pid());
            }
            Err(e) => {
              eprintln!("Aviso: Não foi possível iniciar o sidecar pdv-api: {}", e);
            }
          }
        }
        Err(e) => {
          eprintln!("Aviso: Configuração do sidecar pdv-api não encontrada: {}", e);
        }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("Erro ao executar aplicação ATYLUS PDV");
}
