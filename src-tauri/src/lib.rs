use std::fs::File;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::Command;
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;

fn wait_for_server(port: u16, timeout_secs: u64) -> bool {
    let addr = format!("127.0.0.1:{}", port);
    let start = Instant::now();
    while start.elapsed().as_secs() < timeout_secs {
        if TcpStream::connect(&addr).is_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(300));
    }
    false
}

/// Find the Node.js binary by checking common installation paths.
fn find_node() -> String {
    let candidates = [
        "/opt/homebrew/bin/node",  // Homebrew on Apple Silicon
        "/usr/local/bin/node",     // Homebrew on Intel / manual install
        "/usr/bin/node",           // System Node.js
        "/opt/local/bin/node",     // MacPorts
    ];
    for candidate in &candidates {
        if std::path::Path::new(candidate).exists() {
            return candidate.to_string();
        }
    }
    "node".to_string() // Fall back to PATH lookup
}

/// Return the directory containing server.js.
/// In a packaged .app, resources live inside Contents/Resources.
/// In development (cargo run / tauri dev), use the current working directory.
fn find_server_dir(app: &tauri::App) -> PathBuf {
    // Try the Tauri resource directory first (packaged app)
    if let Ok(resource_dir) = app.path().resource_dir() {
        if resource_dir.join("server.js").exists() {
            return resource_dir;
        }
    }
    // Fall back to current working directory (development)
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

#[tauri::command]
async fn pick_folder() -> Option<String> {
    tokio::task::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Choose your docs folder")
            .pick_folder()
            .map(|p| p.to_string_lossy().into_owned())
    })
    .await
    .ok()
    .flatten()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port_str = std::env::var("HAKDOC_PORT").unwrap_or_else(|_| "14296".to_string());
    let port: u16 = port_str.parse().unwrap_or(14296);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let server_dir = find_server_dir(app);
            let node_bin = find_node();

            let log_file = File::create("/tmp/hakdoc-server.log").ok();

            let mut cmd = Command::new(&node_bin);
            cmd.arg("server.js")
                .env("PORT", &port_str)
                .current_dir(&server_dir);

            if let Some(f) = log_file {
                use std::os::unix::io::IntoRawFd;
                let fd = f.into_raw_fd();
                unsafe {
                    use std::os::unix::io::FromRawFd;
                    cmd.stdout(std::process::Stdio::from_raw_fd(fd));
                    cmd.stderr(std::process::Stdio::from_raw_fd(fd));
                }
            }

            let _ = cmd.spawn();

            // Wait until the server is accepting connections (max 15s)
            wait_for_server(port, 15);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![pick_folder])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
