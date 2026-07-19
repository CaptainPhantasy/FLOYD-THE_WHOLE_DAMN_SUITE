// FloydShell — minimal native window hosting the FLOYD frame.
// Single WKWebView, no tabs, no chrome. Solo-use packaged surface.
// Build: swiftc -O -framework Cocoa -framework WebKit FloydShell.swift -o FloydShell
import Cocoa
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var webView: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        // Frame + apps are same-machine loopback; media (mic for apps) allowed without prompt storms.
        config.mediaTypesRequiringUserActionForPlayback = []

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsMagnification = true

        let screen = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        window = NSWindow(
            contentRect: NSRect(x: screen.midX - 720, y: screen.midY - 450, width: 1440, height: 900),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered, defer: false)
        window.title = "FLOYD"
        window.titlebarAppearsTransparent = true
        window.isMovableByWindowBackground = false
        window.minSize = NSSize(width: 720, height: 480)
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        window.center()

        let port = ProcessInfo.processInfo.environment["FRAME_PORT"] ?? "13030"
        webView.load(URLRequest(url: URL(string: "http://127.0.0.1:\(port)/")!))
        NSApp.activate(ignoringOtherApps: true)
    }

    // Keep window.open / target=_blank inside the one surface.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { webView.load(URLRequest(url: url)) }
        return nil
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        let html = "<body style='background:#08090c;color:#9aa1b2;font:14px -apple-system;display:grid;place-items:center;height:100vh'><div>FLOYD frame unreachable — is frame-server running on 13030?<br><code style='color:#22d3ee'>node apps/frame/server/frame-server.mjs</code></div></body>"
        webView.loadHTMLString(html, baseURL: nil)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
