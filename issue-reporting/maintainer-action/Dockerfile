FROM rust:1.99.1-slim-bookworm@sha256:f2c004e3d2d8b547e8cf7ffbc29205385f4e71d23e53e4e383065db5e9f822cd

RUN rustup toolchain install nightly-2026-11-12 --profile minimal --no-self-update
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ARG RUST_REV=29a5d066d98b58d948d285ba22390a5f849f5938
RUN mkdir -p /opt/inspect-repositories \
    && git init --bare --initial-branch=main /opt/inspect-repositories/rust.git \
    && git -C /opt/inspect-repositories/rust.git fetch --depth 1 https://github.com/rust-lang/rust.git "$RUST_REV" \
    && git -C /opt/inspect-repositories/rust.git update-ref refs/heads/main FETCH_HEAD \
    && git config --system --add url.file:///opt/inspect-repositories/rust.git.insteadOf https://github.com/rust-lang/rust.git \
    && git config --system --add url.file:///opt/inspect-repositories/rust.git.insteadOf https://github.com/rust-lang/rust
# Inspect's bash tool uses a login shell, which resets the image's PATH.
RUN printf '%s\n' 'export PATH="/usr/local/cargo/bin:$PATH"' > /etc/profile.d/rust.sh
WORKDIR /workspace
