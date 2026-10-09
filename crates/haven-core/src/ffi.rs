//! Cross-Platform Foreign Function Interface (FFI) bindings for Project Haven.
//!
//! Exposes C-compatible symbols allowing iOS (Swift via UniFFI/C-bridging)
//! and Android (Kotlin via JNI) to drive the deterministic coaching state machine,
//! Safety Guardian dual-tier firewall, and Thompson Sampling bandit.

use std::ffi::{CStr, CString};
use std::os::raw::c_char;

use crate::guardian::Guardian;
use crate::policy::ThompsonBandit;
use crate::state_machine::{CoachingMode, CoachingPhase, SessionStateMachine};

/// Create a new session state machine pointer for native host environments.
#[no_mangle]
pub unsafe extern "C" fn haven_session_create(mode_str: *const c_char) -> *mut SessionStateMachine {
    if mode_str.is_null() {
        return std::ptr::null_mut();
    }

    let mode_cstr = CStr::from_ptr(mode_str);
    let mode_slice = match mode_cstr.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    let mode = match mode_slice.to_lowercase().as_str() {
        "steady" => CoachingMode::Steady,
        "build" => CoachingMode::Build,
        "perform" => CoachingMode::Perform,
        _ => CoachingMode::Explore,
    };

    Box::into_raw(Box::new(SessionStateMachine::new(mode)))
}

/// Free a session state machine pointer.
#[no_mangle]
pub unsafe extern "C" fn haven_session_free(session_ptr: *mut SessionStateMachine) {
    if !session_ptr.is_null() {
        drop(Box::from_raw(session_ptr));
    }
}

/// Set session contract. Returns 0 on success, -1 on error.
#[no_mangle]
pub unsafe extern "C" fn haven_session_set_contract(
    session_ptr: *mut SessionStateMachine,
    contract_str: *const c_char,
) -> i32 {
    if session_ptr.is_null() || contract_str.is_null() {
        return -1;
    }
    let session = &mut *session_ptr;
    let text = match CStr::from_ptr(contract_str).to_str() {
        Ok(s) => s,
        Err(_) => return -1,
    };

    match session.set_contract(text) {
        Ok(_) => 0,
        Err(_) => -1,
    }
}

/// Advance session to CheckIn. Returns 0 on success, -1 on error.
#[no_mangle]
pub unsafe extern "C" fn haven_session_advance_to_check_in(session_ptr: *mut SessionStateMachine) -> i32 {
    if session_ptr.is_null() {
        return -1;
    }
    let session = &mut *session_ptr;
    match session.advance_to_check_in() {
        Ok(_) => 0,
        Err(_) => -1,
    }
}

/// Get the current phase as a C-string.
#[no_mangle]
pub unsafe extern "C" fn haven_session_get_phase(session_ptr: *const SessionStateMachine) -> *mut c_char {
    if session_ptr.is_null() {
        return std::ptr::null_mut();
    }
    let session = &*session_ptr;
    let phase_str = match session.current_phase {
        CoachingPhase::Contract => "Contract",
        CoachingPhase::CheckIn => "CheckIn",
        CoachingPhase::Focus => "Focus",
        CoachingPhase::Explore => "Explore",
        CoachingPhase::Options => "Options",
        CoachingPhase::Commit => "Commit",
        CoachingPhase::Close => "Close",
    };

    CString::new(phase_str).unwrap().into_raw()
}

/// Execute Safety Guardian Pre-Inference Scan. Returns JSON string of PreScanResult.
#[no_mangle]
pub unsafe extern "C" fn haven_guardian_pre_scan(
    input_str: *const c_char,
    region_str: *const c_char,
) -> *mut c_char {
    if input_str.is_null() || region_str.is_null() {
        return std::ptr::null_mut();
    }

    let input = match CStr::from_ptr(input_str).to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };
    let region = match CStr::from_ptr(region_str).to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    let guardian = Guardian::new();
    let result = guardian.pre_scan(input, region);

    let json_str = serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string());
    CString::new(json_str).unwrap().into_raw()
}

/// Sample technique using Thompson sampling bandit. Returns technique name string.
#[no_mangle]
pub unsafe extern "C" fn haven_bandit_select_technique(mode_str: *const c_char) -> *mut c_char {
    if mode_str.is_null() {
        return std::ptr::null_mut();
    }

    let mode_slice = match CStr::from_ptr(mode_str).to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };

    let mode = match mode_slice.to_lowercase().as_str() {
        "steady" => CoachingMode::Steady,
        "build" => CoachingMode::Build,
        "perform" => CoachingMode::Perform,
        _ => CoachingMode::Explore,
    };

    let bandit = ThompsonBandit::new();
    let technique = bandit.select_technique(mode, None);
    let tech_name = technique.display_name();

    CString::new(tech_name).unwrap().into_raw()
}

/// Free a C-string returned by haven FFI functions.
#[no_mangle]
pub unsafe extern "C" fn haven_string_free(s: *mut c_char) {
    if !s.is_null() {
        drop(CString::from_raw(s));
    }
}
