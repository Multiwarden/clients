//! Multiwarden: the desktop app's IPC sockets (browser integration, CLI, autofill) get their own
//! names, so Multiwarden and Bitwarden's desktop app can run side by side without taking over
//! each other's sockets. The proxy and the app both build their paths through `super::path`,
//! so they always agree.

const PREFIX: &str = "multiwarden.";

/// The Multiwarden name for an IPC socket. Calling it again on its result changes nothing.
pub(super) fn ipc_name(name: &str) -> String {
    if name.starts_with(PREFIX) {
        name.to_owned()
    } else {
        format!("{PREFIX}{name}")
    }
}

#[cfg(test)]
mod tests {
    use super::ipc_name;

    #[test]
    fn prefixes_once() {
        assert_eq!(ipc_name("bw"), "multiwarden.bw");
        assert_eq!(ipc_name(&ipc_name("bw")), "multiwarden.bw");
    }
}
