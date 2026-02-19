#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod gamepad;
mod haptic;

use std::sync::mpsc;
use haptic::{HapticRequest, HapticState};

#[tauri::command]
fn trigger_haptic(state: tauri::State<HapticState>, strength: f32, duration_ms: u32) {
    let _ = state.sender.send(HapticRequest {
        strength: strength.clamp(0.0, 1.0),
        duration_ms,
    });
}

fn main() {
    let (haptic_tx, haptic_rx) = mpsc::channel::<HapticRequest>();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(HapticState { sender: haptic_tx })
        .invoke_handler(tauri::generate_handler![trigger_haptic])
        .setup(|app| {
            gamepad::spawn_gamepad_thread(app.handle().clone(), haptic_rx);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
