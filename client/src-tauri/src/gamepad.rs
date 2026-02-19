use sdl2::controller::Button;
use sdl2::event::Event;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::haptic::HapticRequest;

/// Maps SDL2 GameController buttons to W3C Gamepad API indices.
fn button_to_w3c(button: Button) -> u8 {
    match button {
        Button::A => 0,
        Button::B => 1,
        Button::X => 2,
        Button::Y => 3,
        Button::LeftShoulder => 4,
        Button::RightShoulder => 5,
        Button::Back => 8,
        Button::Start => 9,
        Button::LeftStick => 10,
        Button::RightStick => 11,
        Button::DPadUp => 12,
        Button::DPadDown => 13,
        Button::DPadLeft => 14,
        Button::DPadRight => 15,
        Button::Guide => 16,
        _ => 255,
    }
}

#[derive(Clone, serde::Serialize)]
struct GamepadButtonEvent {
    button: u8,
}

#[derive(Clone, serde::Serialize)]
struct GamepadStatusEvent {
    connected: bool,
    name: String,
}

struct ControllerEntry {
    controller: sdl2::controller::GameController,
}

const TRIGGER_THRESHOLD: i16 = 8000;

pub fn spawn_gamepad_thread(app: AppHandle, haptic_rx: mpsc::Receiver<HapticRequest>) {
    thread::spawn(move || {
        let sdl = sdl2::init().expect("Failed to init SDL2");
        let game_controller = sdl.game_controller().expect("Failed to init GameController");
        let haptic_sub = sdl.haptic().expect("Failed to init haptic subsystem");
        let mut event_pump = sdl.event_pump().expect("Failed to get event pump");

        let mut controllers: Vec<ControllerEntry> = Vec::new();
        let mut haptic_devices: Vec<Option<sdl2::haptic::Haptic>> = Vec::new();
        let mut lt_pressed = false;
        let mut rt_pressed = false;

        // Open any already-connected controllers
        for i in 0..game_controller.num_joysticks().unwrap_or(0) {
            if game_controller.is_game_controller(i) {
                if let Ok(controller) = game_controller.open(i) {
                    let _ = app.emit("gamepad_status", GamepadStatusEvent {
                        connected: true,
                        name: controller.name(),
                    });
                    let h = haptic_sub.open_from_joystick_id(i).ok();
                    haptic_devices.push(h);
                    controllers.push(ControllerEntry { controller });
                }
            }
        }

        loop {
            for event in event_pump.poll_iter() {
                match event {
                    Event::ControllerDeviceAdded { which, .. } => {
                        if let Ok(controller) = game_controller.open(which) {
                            let _ = app.emit("gamepad_status", GamepadStatusEvent {
                                connected: true,
                                name: controller.name(),
                            });
                            let h = haptic_sub.open_from_joystick_id(which).ok();
                            haptic_devices.push(h);
                            controllers.push(ControllerEntry { controller });
                        }
                    }
                    Event::ControllerDeviceRemoved { which, .. } => {
                        if let Some(idx) = controllers.iter().position(|e| e.controller.instance_id() == which) {
                            let removed = controllers.remove(idx);
                            haptic_devices.remove(idx);
                            let _ = app.emit("gamepad_status", GamepadStatusEvent {
                                connected: false,
                                name: removed.controller.name(),
                            });
                            lt_pressed = false;
                            rt_pressed = false;
                        }
                    }
                    Event::ControllerButtonDown { button, .. } => {
                        let idx = button_to_w3c(button);
                        if idx != 255 {
                            let _ = app.emit("gamepad_button", GamepadButtonEvent { button: idx });
                        }
                    }
                    Event::ControllerAxisMotion { axis, value, .. } => {
                        match axis {
                            sdl2::controller::Axis::TriggerLeft => {
                                if value > TRIGGER_THRESHOLD && !lt_pressed {
                                    lt_pressed = true;
                                    let _ = app.emit("gamepad_button", GamepadButtonEvent { button: 6 });
                                } else if value < TRIGGER_THRESHOLD / 2 {
                                    lt_pressed = false;
                                }
                            }
                            sdl2::controller::Axis::TriggerRight => {
                                if value > TRIGGER_THRESHOLD && !rt_pressed {
                                    rt_pressed = true;
                                    let _ = app.emit("gamepad_button", GamepadButtonEvent { button: 7 });
                                } else if value < TRIGGER_THRESHOLD / 2 {
                                    rt_pressed = false;
                                }
                            }
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }

            // Process haptic requests
            while let Ok(req) = haptic_rx.try_recv() {
                for h_opt in haptic_devices.iter_mut() {
                    if let Some(ref mut h) = h_opt {
                        h.rumble_play(req.strength, req.duration_ms);
                    }
                }
            }

            thread::sleep(Duration::from_millis(8));
        }
    });
}
