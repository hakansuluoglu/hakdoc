use std::fs::File;
use std::net::TcpStream;
use std::process::Command;
use std::thread;
use std::time::{Duration, Instant};

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port_str = std::env::var("HAKDOC_PORT").unwrap_or_else(|_| "14296".to_string());
    let port: u16 = port_str.parse().unwrap_or(14296);

    let log_file = File::create("/tmp/hakdoc-server.log").ok();

    let mut cmd = Command::new("/opt/homebrew/bin/node");
    cmd.arg("server.js")
        .env("PORT", &port_str)
        .current_dir("/Users/hakan.suluoglu/Desktop/DocWebApp");

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

    // Wait until server is actually accepting connections (max 15s)
    wait_for_server(port, 15);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
