mod config;
use config::ConfigState;
use std::sync::Mutex;


#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ConfigState(Mutex::new(None)))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            config::create_config_file,
            config::config_file_exists,
            config::load_config_into_memory,
            config::get_loaded_config   

        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}