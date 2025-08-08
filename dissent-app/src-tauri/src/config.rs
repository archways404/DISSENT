use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, sync::Mutex};
use tauri::State;

// Shared state type
pub struct ConfigState(pub Mutex<Option<Config>>);

// Your structs
#[derive(Serialize, Deserialize, Clone)]
pub struct Settings {
    pub config_failed_decrypt_count: String,
    pub config_failed_decrypt_limit: String,
    pub config_failed_decrypt_erase: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Conversation {
    pub seed: String,
    #[serde(rename = "random-start-index")]
    pub random_start_index: String,
    #[serde(rename = "random-index-increment")]
    pub random_index_increment: String,
    #[serde(rename = "base-delay")]
    pub base_delay: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Config {
    pub settings: Settings,
    pub conversations: HashMap<String, Conversation>,
}

#[tauri::command]
pub fn create_config_file() -> Result<String, String> {
    let settings = Settings {
        config_failed_decrypt_count: "0".to_string(),
        config_failed_decrypt_limit: "5".to_string(),
        config_failed_decrypt_erase: true,
    };

    let mut conversations = HashMap::new();
    conversations.insert(
        "conversation_uuid".to_string(),
        Conversation {
            seed: "conversation_seed".to_string(),
            random_start_index: "324".to_string(),
            random_index_increment: "33".to_string(),
            base_delay: "2h".to_string(),
        },
    );

    conversations.insert(
        "some_other_conversation_uuid".to_string(),
        Conversation {
            seed: "conversation_seed".to_string(),
            random_start_index: "324".to_string(),
            random_index_increment: "33".to_string(),
            base_delay: "5h".to_string(),
        },
    );

    let config = Config {
        settings,
        conversations,
    };

    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;

    let path = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .join("config/dissent-config.json");

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(format!("Config written to {:?}", path))
}


#[tauri::command]
pub fn config_file_exists() -> Result<bool, String> {
    let path = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .join("config/dissent-config.json");

    Ok(path.exists())
}

#[tauri::command]
pub fn load_config_into_memory(state: State<ConfigState>) -> Result<(), String> {
    let path = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .join("config/dissent-config.json");

    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let config: Config = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    *guard = Some(config);
    Ok(())
}

#[tauri::command]
pub fn get_loaded_config(state: State<ConfigState>) -> Result<Config, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    guard.clone().ok_or("No config loaded".to_string())
}

/*
#[tauri::command]
pub fn save_config_file(config: Config) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;

    let path = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .join("config/dissent-config.json");

    std::fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(())
}
    */