use sdl2::controller::Button;
use sdl2::event::Event;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::haptic::HapticRequest;

/// Maps SDL2 GameController buttons to W3C Gamepad API indices.
/// This ensures existing DeckPilot gamepadBindings config works unchanged.
fn button_to_w3c(button: Button) -> u8 {
    match button {
        Button::A => 0,
        Button::B => 1,
        Button::X => 2,
        Button::Y => 3,
        Button::LeftShoulder => 4,
        Button::RightShoulder => 5,
        // 6 = LT, 7 = RT (handled as axis triggers below)
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

const TRIGGER_THRESHOLD: i16 = 8000;

pub fn spawn_gamepad_thread(app: AppHandle, haptic_rx: mpsc::Receiver<HapticRequest>) {
    thread::spawn(move || {
        let sdl = sdl2::init().expect("Failed to init SDL2");
        let game_controller = sdl.game_controller().expect("Failed to init GameController");
        let haptic = sdl.haptic().expect("Failed to init haptic subsystem");
        let mut event_pump = sdl.event_pump().expect("Failed to get event pump");

        let mut controllers: Vec<sdl2::controller::GameController> = Vec::new();
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
                    // Try to open haptic on this controller's joystick
                    let h = sdl2::haptic::Haptic::from_joystick(
                        &haptic,
                        controller.as_ref(),
                    ).ok();
                    if let Some(ref h_dev) = h {
                        let _ = h_dev.rumble_init();
                    }
                    haptic_devices.push(h);
                    controllers.push(controller);
                }
            }
        }

        loop {
            // Process SDL events
            for event in event_pump.poll_iter() {
                match event {
                    Event::ControllerDeviceAdded { which, .. } => {
                        if let Ok(controller) = game_controller.open(which) {
                            let _ = app.emit("gamepad_status", GamepadStatusEvent {
                                connected: true,
                                name: controller.name(),
                            });
                            let h = sdl2::haptic::Haptic::from_joystick(
                                &haptic,
                                controller.as_ref(),
                            ).ok();
                            if let Some(ref h_dev) = h {
                                let _ = h_dev.rumble_init();
                            }
                            haptic_devices.push(h);
                            controllers.push(controller);
                        }
                    }
                    Event::ControllerDeviceRemoved { which, .. } => {
                        if let Some(idx) = controllers.iter().position(|c| c.instance_id() == which) {
                            let removed = controllers.remove(idx);
                            haptic_devices.remove(idx);
                            let _ = app.emit("gamepad_status", GamepadStatusEvent {
                                connected: false,
                                name: removed.name(),
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
                        // Left trigger → button 6, Right trigger → button 7
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

            // Process haptic requests from the frontend
            while let Ok(req) = haptic_rx.try_recv() {
                for h_opt in haptic_devices.iter() {
                    if let Some(ref h) = h_opt {
                        let lo = (req.strength * 0.3 * 65535.0) as u16;
                        let hi = (req.strength * 65535.0) as u16;
                        let _ = h.rumble_play(lo, hi, req.duration_ms);
                    }
                }
            }

            // ~120Hz poll rate
            thread::sleep(Duration::from_millis(8));
        }
    });
}
