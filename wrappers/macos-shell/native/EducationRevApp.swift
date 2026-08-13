import AppKit
import WebKit

private let appName = "EducationRev"
private let appURL = URL(string: "https://www.educationrevolution.qld.one/auth?shell=macos")!

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var window: NSWindow?
    private var webView: WKWebView?
    private var loadingView: NSView?
    private var externalBackButton: NSButton?
    private var lastEducationRevURL: URL?
    private var retryTimer: Timer?
    private var renderCheckTimer: Timer?
    private var blankRenderRetryCount = 0

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSAppleEventManager.shared().setEventHandler(
            self,
            andSelector: #selector(handleURLEvent(_:withReplyEvent:)),
            forEventClass: AEEventClass(kInternetEventClass),
            andEventID: AEEventID(kAEGetURL)
        )
        buildMenu()
        showMainWindow()
    }

    func applicationWillTerminate(_ notification: Notification) {
        NSAppleEventManager.shared().removeEventHandler(
            forEventClass: AEEventClass(kInternetEventClass),
            andEventID: AEEventID(kAEGetURL)
        )
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showMainWindow()
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }

    @objc private func showMainWindow() {
        if window == nil {
            createWindow()
        }
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc private func reloadWorkspace() {
        blankRenderRetryCount = 0
        showLoading()
        hideExternalBackButton()
        webView?.load(URLRequest(url: appURL, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: 30))
    }

    @objc private func returnToEducationRev() {
        let targetURL = lastEducationRevURL ?? appURL
        hideExternalBackButton()
        showLoading(message: "Returning to EducationRev.")
        webView?.load(URLRequest(url: targetURL, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: 30))
    }

    @objc private func openInBrowser() {
        openExternalURL(appURL)
    }

    @objc private func handleURLEvent(_ event: NSAppleEventDescriptor, withReplyEvent replyEvent: NSAppleEventDescriptor) {
        guard
            let urlString = event.paramDescriptor(forKeyword: keyDirectObject)?.stringValue,
            let url = URL(string: urlString)
        else {
            return
        }

        openDeepLink(url)
    }

    private func createWindow() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        let startupScript = WKUserScript(
            source: """
            try {
              window.localStorage.setItem('edurev-desktop-shell', '1');
              window.localStorage.setItem('edurev-wrapper-origin', 'native-macos');
              window.eduRevShell = Object.assign({}, window.eduRevShell || {}, {
                isDesktopShell: true,
                openExternalAuth: function(url) {
                  try {
                    window.webkit.messageHandlers.eduRevShell.postMessage({
                      type: 'openExternalAuth',
                      url: String(url || '')
                    });
                  } catch (error) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }
                }
              });
            } catch (error) {}
            try {
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations()
                  .then(function(registrations) {
                    registrations.forEach(function(registration) { registration.unregister(); });
                  })
                  .catch(function() {});
              }
            } catch (error) {}
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        configuration.userContentController.addUserScript(startupScript)
        configuration.userContentController.add(self, name: "eduRevShell")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 940),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = appName
        window.center()
        window.contentView = webView
        window.minSize = NSSize(width: 960, height: 640)

        self.window = window
        self.webView = webView

        showLoading()
        webView.load(URLRequest(url: appURL, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: 30))
    }

    private func buildMenu() {
        let mainMenu = NSMenu()

        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About \(appName)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Show \(appName)", action: #selector(showMainWindow), keyEquivalent: "0")
        appMenu.addItem(withTitle: "Reload Workspace", action: #selector(reloadWorkspace), keyEquivalent: "r")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit \(appName)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        mainMenu.addItem(appItem)

        let fileItem = NSMenuItem()
        let fileMenu = NSMenu(title: "File")
        fileMenu.addItem(withTitle: "Open \(appName) Window", action: #selector(showMainWindow), keyEquivalent: "n")
        fileMenu.addItem(withTitle: "Open Sign-In in Browser", action: #selector(openInBrowser), keyEquivalent: "")
        fileMenu.addItem(NSMenuItem.separator())
        fileMenu.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        fileItem.submenu = fileMenu
        mainMenu.addItem(fileItem)

        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu
        mainMenu.addItem(editItem)

        let windowItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Show \(appName)", action: #selector(showMainWindow), keyEquivalent: "0")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.miniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.zoom(_:)), keyEquivalent: "")
        windowMenu.addItem(NSMenuItem.separator())
        windowMenu.addItem(withTitle: appName, action: #selector(showMainWindow), keyEquivalent: "")
        windowItem.submenu = windowMenu
        mainMenu.addItem(windowItem)
        NSApp.windowsMenu = windowMenu

        let helpItem = NSMenuItem()
        let helpMenu = NSMenu(title: "Help")
        helpMenu.addItem(withTitle: "\(appName) Support", action: #selector(openSupport), keyEquivalent: "")
        helpItem.submenu = helpMenu
        mainMenu.addItem(helpItem)

        NSApp.mainMenu = mainMenu
    }

    @objc private func openSupport() {
        openExternalURL(URL(string: "https://www.educationrevolution.qld.one/support")!)
    }

    private func openExternalURL(_ url: URL) {
        let chromeBundleId = "com.google.Chrome"
        if
            let chromeURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: chromeBundleId),
            url.scheme == "http" || url.scheme == "https"
        {
            let configuration = NSWorkspace.OpenConfiguration()
            NSWorkspace.shared.open([url], withApplicationAt: chromeURL, configuration: configuration) { _, error in
                if error != nil {
                    NSWorkspace.shared.open(url)
                }
            }
            return
        }

        NSWorkspace.shared.open(url)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard
            message.name == "eduRevShell",
            let body = message.body as? [String: Any],
            let type = body["type"] as? String,
            type == "openExternalAuth",
            let urlString = body["url"] as? String,
            let url = URL(string: urlString),
            shouldOpenExternally(url)
        else {
            return
        }

        openExternalURL(url)
    }

    private func shouldOpenExternally(_ url: URL) -> Bool {
        guard url.scheme == "https" else {
            return false
        }

        if url.host == appURL.host {
            return url.path == "/auth/desktop-browser"
        }

        let host = (url.host ?? "").lowercased()
        if host == "accounts.google.com" || host.hasSuffix(".accounts.google.com") {
            return true
        }

        if host == "oauth2.googleapis.com" || host == "apis.google.com" || host.hasSuffix(".googleusercontent.com") {
            return true
        }

        return false
    }

    private func openDeepLink(_ url: URL) {
        guard url.scheme == "edurevolutionai", url.host == "auth-complete" else {
            openExternalURL(url)
            return
        }

        var components = URLComponents(url: appURL, resolvingAgainstBaseURL: false)
        components?.path = "/auth/desktop-complete"
        components?.queryItems = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems

        guard let completionURL = components?.url else {
            showError("Could not complete sign-in. Try again.")
            return
        }

        showMainWindow()
        showLoading(message: "Finishing sign-in.")
        webView?.load(URLRequest(url: completionURL, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: 30))
    }

    private func showLoading(message: String = "Loading the EducationRev workspace.") {
        guard let webView = webView else { return }
        retryTimer?.invalidate()
        renderCheckTimer?.invalidate()

        let overlay = NSView(frame: webView.bounds)
        overlay.autoresizingMask = [.width, .height]
        overlay.wantsLayer = true
        overlay.layer?.backgroundColor = NSColor(calibratedRed: 0.965, green: 0.982, blue: 1.0, alpha: 1.0).cgColor

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .centerX
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false

        let title = NSTextField(labelWithString: "Opening \(appName)")
        title.font = NSFont.boldSystemFont(ofSize: 30)
        title.textColor = NSColor(calibratedWhite: 0.08, alpha: 1)

        let detail = NSTextField(labelWithString: message)
        detail.font = NSFont.systemFont(ofSize: 15, weight: .semibold)
        detail.textColor = NSColor.secondaryLabelColor
        detail.alignment = .center
        detail.maximumNumberOfLines = 2

        let spinner = NSProgressIndicator()
        spinner.style = .spinning
        spinner.controlSize = .large
        spinner.startAnimation(nil)

        stack.addArrangedSubview(title)
        stack.addArrangedSubview(detail)
        stack.addArrangedSubview(spinner)
        overlay.addSubview(stack)
        webView.addSubview(overlay)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: overlay.centerYAnchor)
        ])

        loadingView?.removeFromSuperview()
        loadingView = overlay

        retryTimer = Timer.scheduledTimer(withTimeInterval: 25, repeats: false) { [weak self] _ in
            self?.showError("The web workspace did not finish loading. Check your connection, then try again.")
        }
    }

    private func showExternalBackButton(previousURL: URL?) {
        guard let webView = webView else { return }

        if let previousURL = previousURL, previousURL.host == appURL.host {
            lastEducationRevURL = previousURL
        }

        if externalBackButton != nil {
            externalBackButton?.isHidden = false
            return
        }

        let button = NSButton(title: "Back to EducationRev", target: self, action: #selector(returnToEducationRev))
        button.bezelStyle = .rounded
        button.font = NSFont.systemFont(ofSize: 13, weight: .bold)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.contentTintColor = NSColor.labelColor
        button.wantsLayer = true
        button.layer?.cornerRadius = 9
        button.layer?.backgroundColor = NSColor.windowBackgroundColor.withAlphaComponent(0.94).cgColor
        button.layer?.shadowColor = NSColor.black.cgColor
        button.layer?.shadowOpacity = 0.16
        button.layer?.shadowRadius = 12
        button.layer?.shadowOffset = NSSize(width: 0, height: -2)
        button.layer?.zPosition = 1000

        webView.addSubview(button)
        NSLayoutConstraint.activate([
            button.leadingAnchor.constraint(equalTo: webView.leadingAnchor, constant: 14),
            button.topAnchor.constraint(equalTo: webView.topAnchor, constant: 14),
            button.heightAnchor.constraint(equalToConstant: 36)
        ])

        externalBackButton = button
    }

    private func hideExternalBackButton() {
        externalBackButton?.isHidden = true
    }

    private func updateExternalBackButton(for url: URL, previousURL: URL? = nil) {
        guard url.scheme == "http" || url.scheme == "https" else { return }

        if url.host == appURL.host {
            lastEducationRevURL = url
            hideExternalBackButton()
            return
        }

        showExternalBackButton(previousURL: previousURL)
    }

    private func hideLoading() {
        retryTimer?.invalidate()
        retryTimer = nil
        renderCheckTimer?.invalidate()
        renderCheckTimer = nil
        loadingView?.removeFromSuperview()
        loadingView = nil
    }

    private func showError(_ message: String) {
        showLoading(message: message)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if let url = webView.url {
            updateExternalBackButton(for: url)
        }
        waitForRenderedWorkspace()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        renderCheckTimer?.invalidate()
        showError(error.localizedDescription)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        renderCheckTimer?.invalidate()
        showError(error.localizedDescription)
    }

    private func waitForRenderedWorkspace(attempt: Int = 0) {
        renderCheckTimer?.invalidate()
        renderCheckTimer = Timer.scheduledTimer(withTimeInterval: attempt == 0 ? 0.8 : 0.45, repeats: false) { [weak self] _ in
            self?.verifyRenderedWorkspace(attempt: attempt)
        }
    }

    private func verifyRenderedWorkspace(attempt: Int) {
        guard let webView = webView else { return }

        let script = """
        (() => {
          const root = document.getElementById('root');
          const body = document.body;
          const text = (body && body.innerText || '').replace(/\\s+/g, ' ').trim();
          const rootChildren = root ? root.childElementCount : 0;
          const hasAppShell = !!document.querySelector('[data-edurev-app-ready], main, nav, form, button, input, a');
          return {
            href: window.location.href,
            title: document.title,
            textLength: text.length,
            textPreview: text.slice(0, 140),
            rootChildren,
            hasAppShell,
            readyState: document.readyState
          };
        })();
        """

        webView.evaluateJavaScript(script) { [weak self] result, error in
            guard let self = self else { return }

            if let error = error {
                if attempt < 12 {
                    self.waitForRenderedWorkspace(attempt: attempt + 1)
                    return
                }
                self.showError("The page loaded, but the app could not be checked: \(error.localizedDescription)")
                return
            }

            guard let state = result as? [String: Any] else {
                if attempt < 12 {
                    self.waitForRenderedWorkspace(attempt: attempt + 1)
                    return
                }
                self.showError("The page loaded, but the EducationRev workspace did not report a usable state.")
                return
            }

            let textLength = state["textLength"] as? Int ?? 0
            let rootChildren = state["rootChildren"] as? Int ?? 0
            let hasAppShell = state["hasAppShell"] as? Bool ?? false
            let href = state["href"] as? String ?? ""
            let preview = state["textPreview"] as? String ?? ""
            let isUsable = textLength > 20 && (rootChildren > 0 || hasAppShell)

            if isUsable {
                self.blankRenderRetryCount = 0
                self.hideLoading()
                return
            }

            if attempt < 12 {
                self.waitForRenderedWorkspace(attempt: attempt + 1)
                return
            }

            if self.blankRenderRetryCount < 1 {
                self.blankRenderRetryCount += 1
                self.showLoading(message: "Refreshing the EducationRev workspace.")
                webView.load(URLRequest(url: appURL, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: 30))
                return
            }

            self.showError("Blank web view after loading \(href). Rendered text: \(preview)")
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        if shouldOpenExternally(url) {
            openExternalURL(url)
            decisionHandler(.cancel)
            return
        }

        if url.scheme == "edurevolutionai" {
            openDeepLink(url)
            decisionHandler(.cancel)
            return
        }

        if url.scheme == "http" || url.scheme == "https" {
            updateExternalBackButton(for: url, previousURL: webView.url)
            decisionHandler(.allow)
            return
        }

        openExternalURL(url)
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            if shouldOpenExternally(url) {
                openExternalURL(url)
                return nil
            }

            updateExternalBackButton(for: url, previousURL: webView.url)
            webView.load(URLRequest(url: url))
        }
        return nil
    }
}

let delegate = AppDelegate()
NSApplication.shared.delegate = delegate
NSApplication.shared.run()
