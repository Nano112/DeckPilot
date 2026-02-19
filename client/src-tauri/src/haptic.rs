use std::sync::mpsc;

#[derive(Debug, Clone)]
pub struct HapticRequest {
    pub strength: f32,
    pub duration_ms: u32,
}

/// State managed by Tauri to bridge frontend commands to the gamepad thread.
pub struct HapticState {
    pub sender: mpsc::Sender<HapticRequest>,
}
