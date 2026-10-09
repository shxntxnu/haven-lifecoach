//! FFI integration tests validating C-ABI exports for native platforms.

use std::ffi::{CStr, CString};
use haven_core::ffi::{
    haven_bandit_select_technique, haven_guardian_pre_scan, haven_session_advance_to_check_in,
    haven_session_create, haven_session_free, haven_session_get_phase, haven_session_set_contract,
    haven_string_free,
};

#[test]
fn test_ffi_session_lifecycle_and_transitions() {
    unsafe {
        let mode_cstr = CString::new("explore").unwrap();
        let session_ptr = haven_session_create(mode_cstr.as_ptr());
        assert!(!session_ptr.is_null());

        let initial_phase_ptr = haven_session_get_phase(session_ptr);
        let initial_phase = CStr::from_ptr(initial_phase_ptr).to_str().unwrap();
        assert_eq!(initial_phase, "Contract");
        haven_string_free(initial_phase_ptr);

        // Cannot advance without contract
        let fail_res = haven_session_advance_to_check_in(session_ptr);
        assert_eq!(fail_res, -1);

        // Set contract
        let contract_cstr = CString::new("Clarify career direction").unwrap();
        let set_res = haven_session_set_contract(session_ptr, contract_cstr.as_ptr());
        assert_eq!(set_res, 0);

        // Advance to CheckIn
        let ok_res = haven_session_advance_to_check_in(session_ptr);
        assert_eq!(ok_res, 0);

        let next_phase_ptr = haven_session_get_phase(session_ptr);
        let next_phase = CStr::from_ptr(next_phase_ptr).to_str().unwrap();
        assert_eq!(next_phase, "CheckIn");
        haven_string_free(next_phase_ptr);

        haven_session_free(session_ptr);
    }
}

#[test]
fn test_ffi_guardian_pre_scan() {
    unsafe {
        let red_input = CString::new("I want to kill myself tonight").unwrap();
        let region = CString::new("UK").unwrap();

        let json_ptr = haven_guardian_pre_scan(red_input.as_ptr(), region.as_ptr());
        assert!(!json_ptr.is_null());

        let json_str = CStr::from_ptr(json_ptr).to_str().unwrap();
        assert!(json_str.contains("\"tier\":\"red\""));
        assert!(json_str.contains("999"));

        haven_string_free(json_ptr);
    }
}

#[test]
fn test_ffi_bandit_technique_selection() {
    unsafe {
        let mode_cstr = CString::new("perform").unwrap();
        let tech_ptr = haven_bandit_select_technique(mode_cstr.as_ptr());
        assert!(!tech_ptr.is_null());

        let tech_name = CStr::from_ptr(tech_ptr).to_str().unwrap();
        assert!(!tech_name.is_empty());

        haven_string_free(tech_ptr);
    }
}
