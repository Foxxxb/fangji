// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};
use std::fs::{File, self, OpenOptions, create_dir_all};
use std::io::{BufReader, Error as IoError, ErrorKind, Write};
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::Manager;
use std::str;
use std::{thread, time};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use serde_json;
use std::os::windows::fs::OpenOptionsExt;
use chrono::{Local as ChronoLocal, Datelike};
use std::process;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Prescription {
    pub 方名: String,
    pub 组成: String,
    pub 用法: String,
    pub 功用: String,
    pub 主治: String,
    pub 证治机理: String,
    pub 方解: String,
    pub 运用: String,
    pub 附方: String,
    pub 鉴别: String,
    pub 方论选录: String,
    pub 医案举例: String,
    pub 方歌: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DStruct {
    pub aestext: String,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PrescriptionTree {
    pub name: String,
    pub children: Vec<String>, // 这里只做一层树结构，children为所有方名
}

#[derive(Serialize, Deserialize)]
pub struct AuthResponse {
    pub success: bool,
    pub remaining_attempts: u32,
    pub should_exit: bool,
    pub remaining_time: Option<u64>,  // 剩余时间（秒）
    pub card_type: Option<String>,    // 卡类型
}

#[derive(Serialize, Deserialize, Debug)]
pub struct LicenseInfo {
    input_content: String,    // 输入的卡密内容
    device_id: String,        // 设备ID
    start_time: u64,         // 开始时间
    end_time: u64,           // 结束时间
    card_type: String,       // 卡类型
    is_valid: bool,          // 是否有效
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// 修改 get_prescriptions 函数
#[tauri::command]
fn get_prescriptions() -> Result<serde_json::Value, String> {
    // 获取应用程序目录
    let exe_path = match std::env::current_exe() {
        Ok(path) => path,
        Err(e) => {
            let error_msg = format!("无法获取当前可执行文件路径: {}", e);
            log_error(&error_msg);
            process::exit(1);
        }
    };

    let app_dir = match exe_path.parent() {
        Some(dir) => dir,
        None => {
            let error_msg = "无法获取应用程序目录".to_string();
            log_error(&error_msg);
            process::exit(1);
        }
    };

    let data_file_path = app_dir.join("prescriptions.data");

    let file = match File::open(&data_file_path) {
        Ok(file) => file,
        Err(e) => {
            let error_msg = format!("无法打开数据文件 {:?}: {}", data_file_path, e);
            log_error(&error_msg);
            process::exit(1);
        }
    };

    let mut rdr = csv::Reader::from_reader(BufReader::new(file));
    let mut prescriptions = Vec::new();

    for result in rdr.deserialize() {
        match result {
            Ok(mut record) => prescriptions.push(record),
            Err(e) => {
                let error_msg = format!("解析数据失败: {}", e);
                log_error(&error_msg);
                process::exit(1);
            }
        }
    }

    let tree = PrescriptionTree {
        name: "方剂列表".to_string(),
        children: prescriptions.iter().map(|p: &Prescription| p.方名.clone()).collect(),
    };

    Ok(serde_json::json!({
        "tree": tree,
        "data": prescriptions
    }))
}

#[tauri::command]
async fn check_auth(app_handle: tauri::AppHandle, password: String) -> Result<AuthResponse, String> {
    Ok(AuthResponse {
        success: true,
        remaining_attempts: 5 - 1,
        should_exit: false,
        remaining_time: Some(18446744073709551614),//license.end_time - SystemTime::now()
        //.duration_since(UNIX_EPOCH)
        //.unwrap()
        //.as_secs()
        card_type: Some("吾爱破解永久使用版本(202507版本) www.52pojie.cn kls404作者标识符".to_string()),
    })
}
#[tauri::command]
fn verify_license() -> Result<AuthResponse, String> {
    Ok(AuthResponse {
        success: true,
        remaining_attempts: 5 - 1,
        should_exit: false,
        remaining_time: Some(18446744073709551614),//license.end_time - SystemTime::now()
        //.duration_since(UNIX_EPOCH)
        //.unwrap()
        //.as_secs()
        card_type: Some("吾爱破解永久使用版本(202507版本) www.52pojie.cn kls404作者标识符".to_string()),
    })}
fn log_error(error: &str) {
    // 获取当前时间
    let now = ChronoLocal::now();
    let log_filename = format!("{:02}{:02}{:02}log.txt",
                               now.year() % 100,  // 使用 Datelike trait 的 year() 方法
                               now.month(),       // 月份 (1-12)
                               now.day()         // 日期 (1-31)
    );

    // 获取应用程序目录
    let exe_path = match std::env::current_exe() {
        Ok(path) => path,
        Err(e) => {
            eprintln!("无法获取当前可执行文件路径: {}", e);
            process::exit(1);
        }
    };

    let app_dir = match exe_path.parent() {
        Some(dir) => dir,
        None => {
            eprintln!("无法获取应用程序目录");
            process::exit(1);
        }
    };

    // 创建log目录
    let log_dir = app_dir.join("log");
    if let Err(e) = create_dir_all(&log_dir) {
        eprintln!("无法创建日志目录: {}", e);
        process::exit(1);
    }

    // 创建或打开日志文件
    let log_path = log_dir.join(log_filename);
    let mut file = match OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        Ok(file) => file,
        Err(e) => {
            eprintln!("无法打开日志文件: {}", e);
            process::exit(1);
        }
    };

    // 格式化日志内容
    let log_entry = format!(
        "[{}] {}\n",
        now.format("%Y-%m-%d %H:%M:%S"),
        error
    );

    // 写入日志
    if let Err(e) = writeln!(file, "{}", log_entry) {
        eprintln!("无法写入日志: {}", e);
        process::exit(1);
    }
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_prescriptions,check_auth,verify_license])//verify_license
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
