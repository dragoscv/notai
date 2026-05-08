use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_updater::UpdaterExt;
use tauri_plugin_window_state::StateFlags;

/// Base URL for the Notai web app — reads from env at compile time so
/// `cargo tauri build` can target prod, while `pnpm tauri dev` uses localhost.
fn app_url() -> String {
    std::env::var("NOTAI_WEB_URL").unwrap_or_else(|_| "http://localhost:15600".into())
}

/// Open a sticky-note window — always-on-top, no decorations, no taskbar
/// entry (widget-style), small + light.
///
/// Must be `async` — a sync command that creates a `WebviewWindow` deadlocks
/// the main thread on Windows, which produces a blank unclosable window and
/// also freezes the system tray. See tauri-apps/tauri#13963.
#[tauri::command]
async fn open_sticky(app: AppHandle, note_id: String) -> Result<(), String> {
    spawn_sticky(&app, &note_id)
}

/// Internal helper — the actual window creation. Safe to call from any
/// non-main thread (tray handler, deep-link callback, async command).
fn spawn_sticky(app: &AppHandle, note_id: &str) -> Result<(), String> {
    let label = format!("sticky-{}", sanitize(note_id));

    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.show();
        let _ = existing.unminimize();
        let _ = existing.set_focus();
        return Ok(());
    }

    let url = format!("{}/sticky/{}", app_url(), note_id);
    let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;

    // Position + size are persisted by `tauri-plugin-window-state` — it hooks
    // into `WebviewWindowBuilder::build()` and auto-restores saved state for
    // this label before the window appears, then auto-saves on close.
    let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(parsed))
        .title("Sticky")
        .inner_size(320.0, 400.0)
        .min_inner_size(220.0, 180.0)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(true)
        .visible(true)
        .focused(true)
        .build()
        .map_err(|e| e.to_string())?;

    let _ = window;
    Ok(())
}

/// Close the sticky window that issued this call.
#[tauri::command]
async fn close_sticky(window: tauri::WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

/// Show the main window — recreating it from the config if it was destroyed.
///
/// The main window is configured with `hide_on_close` behavior via the
/// `WindowEvent::CloseRequested` handler, so normally it stays alive in the
/// background; but if it ever gets destroyed (user used `--no-background`,
/// a crash recovered, etc.) we rebuild it from the config.
async fn show_main_window(app: &AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        return Ok(());
    }
    // Rebuild from tauri.conf.json
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .cloned()
        .ok_or_else(|| "main window config missing".to_string())?;
    WebviewWindowBuilder::from_config(app, &config)
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn show_main(app: AppHandle) -> Result<(), String> {
    show_main_window(&app).await
}

/// Open (or focus) the Settings window.
#[tauri::command]
async fn open_settings(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        return Ok(());
    }
    let url = format!("{}/settings", app_url());
    let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;
    WebviewWindowBuilder::new(&app, "settings", WebviewUrl::External(parsed))
        .title("Notai — Settings")
        .inner_size(560.0, 520.0)
        .min_inner_size(420.0, 360.0)
        .resizable(true)
        .focused(true)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Spawn a fresh sticky-style capture window. Hits the web app's
/// `/app/quick-capture` route, which creates a note server-side and
/// streams the editor immediately. Always-on-top + small footprint —
/// designed for the "thought just landed, write it now" hotkey.
fn spawn_quick_capture(app: &AppHandle) -> Result<(), String> {
    let label = "quick-capture";
    if let Some(existing) = app.get_webview_window(label) {
        let _ = existing.show();
        let _ = existing.unminimize();
        let _ = existing.set_focus();
        return Ok(());
    }
    let url = format!("{}/app/quick-capture", app_url());
    let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;
    WebviewWindowBuilder::new(app, label, WebviewUrl::External(parsed))
        .title("Capture")
        .inner_size(360.0, 420.0)
        .min_inner_size(260.0, 200.0)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(true)
        .visible(true)
        .focused(true)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn quick_capture(app: AppHandle) -> Result<(), String> {
    spawn_quick_capture(&app)
}

/// Enable or disable Windows autostart via the autostart plugin.
#[tauri::command]
async fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mgr = app.autolaunch();
    if enabled {
        mgr.enable().map_err(|e| e.to_string())
    } else {
        mgr.disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
async fn get_autostart(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

/// Read the `start_minimized` flag from the shared settings store.
///
/// The web app persists settings to `settings.json` via `tauri-plugin-store`;
/// on boot we read it synchronously so we can decide whether to hide the
/// main window before the user sees it flash.
fn read_start_minimized(app: &AppHandle) -> bool {
    use tauri_plugin_store::StoreExt;
    match app.store("settings.json") {
        Ok(store) => store
            .get("start_minimized")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        Err(_) => false,
    }
}

fn sanitize(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect()
}

/// Dispatch a single `notai://…` URL to the right window.
fn handle_deep_link(app: &AppHandle, url: &str) {
    // notai://note/<id>  → open sticky window
    if let Some(id) = url.strip_prefix("notai://note/") {
        let _ = spawn_sticky(app, id);
        return;
    }

    // notai://auth?token=<handoff>  → finish desktop sign-in in main window
    if let Some(rest) = url.strip_prefix("notai://auth") {
        let parsed = url::Url::parse(&format!("http://x{}", rest)).ok();
        let token = parsed
            .as_ref()
            .and_then(|u| u.query_pairs().find(|(k, _)| k == "token").map(|(_, v)| v.into_owned()));
        if let Some(tok) = token {
            let target = format!("{}/api/desktop-auth/consume?token={}", app_url(), tok);
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.eval(&format!("window.location.href = {};", serde_json::to_string(&target).unwrap_or_default()));
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }
    }
}

/// Check GitHub Releases for a newer version. If one is found, download +
/// install in the background and restart the app. The endpoint URL +
/// signing pubkey live in `tauri.conf.json` under `plugins.updater`.
async fn check_for_updates(app: AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let Some(update) = updater.check().await.map_err(|e| e.to_string())? else {
        return Ok(());
    };
    println!("[updater] new version available: {}", update.version);
    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await
        .map_err(|e| e.to_string())?;
    println!("[updater] installed; restarting");
    app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Focus main window when a 2nd instance is launched
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            // Handle `notai://…` deep-links from a 2nd instance
            for arg in argv.iter().skip(1) {
                if arg.starts_with("notai://") {
                    handle_deep_link(app, arg);
                }
            }
        }))
        .plugin(
            // Persist window position + size per-label across restarts.
            // We intentionally don't persist `MAXIMIZED`/`VISIBLE`/`DECORATIONS`
            // for stickies — those are widget-style and always borderless.
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::POSITION | StateFlags::SIZE)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            open_sticky,
            close_sticky,
            show_main,
            open_settings,
            quick_capture,
            set_autostart,
            get_autostart,
        ])
        .on_window_event(|window, event| {
            // Hide the main window on close instead of destroying it — that
            // way the tray's "Show Notai" menu entry can bring it back
            // without rebooting the webview. The user quits via tray → Quit.
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .setup(|app| {
            // Check GitHub Releases for an update on startup. Runs in the
            // background so the UI doesn't block; if found, downloads +
            // installs + restarts. Errors (offline, rate-limited, etc.)
            // are silently ignored — they're not fatal.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = check_for_updates(handle).await {
                    eprintln!("[updater] {}", e);
                }
            });

            // Register the `notai://` scheme at runtime (needed in dev on
            // Windows/Linux; the installer handles this in release builds).
            #[cfg(any(windows, target_os = "linux"))]
            {
                let _ = app.deep_link().register_all();
            }

            // Handle deep-links while the app is already running.
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    handle_deep_link(&handle, url.as_str());
                }
            });

            // System tray menu
            let new_sticky =
                MenuItem::with_id(app, "new-sticky", "New sticky note", true, None::<&str>)?;
            let show_main_item =
                MenuItem::with_id(app, "show-main", "Show Notai", true, None::<&str>)?;
            let settings_item =
                MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[
                    &show_main_item,
                    &new_sticky,
                    &sep1,
                    &settings_item,
                    &sep2,
                    &quit,
                ],
            )?;

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                // Let right-click open the menu (default) and handle
                // left-click ourselves to show the main window.
                .show_menu_on_left_click(false)
                .tooltip("Notai")
                .on_menu_event(|app, ev| {
                    let handle = app.clone();
                    match ev.id.as_ref() {
                        "new-sticky" => {
                            let h = handle.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = spawn_quick_capture(&h);
                            });
                        }
                        "show-main" => {
                            tauri::async_runtime::spawn(async move {
                                let _ = show_main_window(&handle).await;
                            });
                        }
                        "settings" => {
                            tauri::async_runtime::spawn(async move {
                                let _ = open_settings(handle).await;
                            });
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Left-click (or double-click) → show main window.
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    }
                    | TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let handle = tray.app_handle().clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = show_main_window(&handle).await;
                        });
                    }
                })
                .build(app)?;

            // Start minimized? Either from the launcher (`--minimized`, used
            // by the autostart entry) or from the persisted setting in the
            // `tauri-plugin-store` file. When requested we hide the main
            // window immediately after setup — it stays alive in the
            // background and the tray icon brings it back.
            let started_with_minimized_flag =
                std::env::args().any(|a| a == "--minimized");
            let start_minimized_setting = read_start_minimized(app.handle());
            if started_with_minimized_flag || start_minimized_setting {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }

            // Global hotkey: Ctrl/Cmd + Shift + N → quick-capture sticky.
            // Registers at startup; if the user already has another app
            // bound to the same combo, registration silently fails and we
            // continue without the shortcut (Tauri returns Err on conflict).
            #[cfg(target_os = "macos")]
            let modifiers = Modifiers::SUPER | Modifiers::SHIFT;
            #[cfg(not(target_os = "macos"))]
            let modifiers = Modifiers::CONTROL | Modifiers::SHIFT;
            let capture_shortcut = Shortcut::new(Some(modifiers), Code::KeyN);

            let gs = app.global_shortcut();
            let cap_for_handler = capture_shortcut;
            if let Err(e) = gs.on_shortcut(cap_for_handler, move |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    let _ = spawn_quick_capture(app);
                }
            }) {
                eprintln!("[shortcut] failed to register quick-capture hotkey: {}", e);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Notai desktop");
}
