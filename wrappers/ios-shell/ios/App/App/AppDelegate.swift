import UIKit
import WebKit
import GoogleSignIn
import os.log

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = WrapperWebViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        return GIDSignIn.sharedInstance.handle(url)
    }
}

final class WrapperWebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private let logger = Logger(subsystem: "ai.edurevolution.wrapper.ios", category: "GoogleAuth")
    private let appUrl = URL(string: "https://edurevolution-ai-wyxvlktr5q-uw.a.run.app/auth?ios_wrapper=1")!
    private let allowedHost = "edurevolution-ai-wyxvlktr5q-uw.a.run.app"
    private let userContentController = WKUserContentController()
    private lazy var googleClientID: String? = {
        guard
            let file = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
            let data = NSDictionary(contentsOfFile: file),
            let clientID = data["CLIENT_ID"] as? String,
            !clientID.isEmpty
        else {
            return nil
        }
        return clientID
    }()

    private lazy var webView: WKWebView = {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.allowsInlineMediaPlayback = true
        configuration.userContentController = userContentController
        configuration.userContentController.addUserScript(WKUserScript(
            source: nativeBridgeScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        ))
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.translatesAutoresizingMaskIntoConstraints = false
        view.customUserAgent = "EducationRevWrapper/1.0"
        view.navigationDelegate = self
        view.uiDelegate = self
        view.allowsBackForwardNavigationGestures = true
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.isOpaque = false
        view.backgroundColor = .white
        return view
    }()

    private let nativeBridgeScript = """
    (function() {
      window.__IS_NATIVE_IOS_GOOGLE_WRAPPER = true;
      window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeAuth && window.webkit.messageHandlers.nativeAuth.postMessage({ provider: 'bridgeReady' });

      function shouldInterceptGoogleClick(target) {
        var clickable = target && target.closest ? target.closest('button,a,[role="button"]') : null;
        if (!clickable) return false;
        var text = (clickable.innerText || clickable.textContent || '').toLowerCase().replace(/\\s+/g, ' ').trim();
        return text.includes('continue with google') ||
               text.includes('sign in with google') ||
               text.includes('login as student with google');
      }

      document.addEventListener('click', function(event) {
        if (!shouldInterceptGoogleClick(event.target)) return;
        if (!window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.nativeAuth) return;
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
        window.webkit.messageHandlers.nativeAuth.postMessage({ provider: 'google' });
      }, true);
    })();
    """

    private lazy var spinner: UIActivityIndicatorView = {
        let spinner = UIActivityIndicatorView(style: .large)
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.color = UIColor(red: 0.26, green: 0.41, blue: 0.96, alpha: 1)
        spinner.startAnimating()
        return spinner
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        userContentController.add(self, name: "nativeAuth")
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
        logger.log("Wrapper view did load")
        print("[EduRevWrapper] viewDidLoad")

        view.backgroundColor = .white
        view.addSubview(webView)
        view.addSubview(spinner)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])

        loadLatestAppPage()
    }

    deinit {
        userContentController.removeScriptMessageHandler(forName: "nativeAuth")
        NotificationCenter.default.removeObserver(self)
    }

    @objc
    private func handleAppWillEnterForeground() {
        logger.log("App will enter foreground, reloading web content from origin")
        print("[EduRevWrapper] handleAppWillEnterForeground")

        DispatchQueue.main.async {
            if
                let currentURL = self.webView.url,
                let host = currentURL.host,
                host == self.allowedHost
            {
                self.spinner.startAnimating()
                self.webView.reloadFromOrigin()
            } else {
                self.loadLatestAppPage()
            }
        }
    }

    private func loadLatestAppPage() {
        var request = URLRequest(url: appUrl, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        request.setValue("no-cache", forHTTPHeaderField: "Pragma")
        request.setValue("0", forHTTPHeaderField: "Expires")
        webView.load(request)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        logger.log("WKWebView did start provisional navigation")
        print("[EduRevWrapper] didStartProvisionalNavigation")
        spinner.startAnimating()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        logger.log("WKWebView did finish navigation to \(webView.url?.absoluteString ?? "unknown", privacy: .public)")
        print("[EduRevWrapper] didFinish \(webView.url?.absoluteString ?? "unknown")")
        spinner.stopAnimating()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        logger.error("WKWebView did fail navigation: \(error.localizedDescription, privacy: .public)")
        print("[EduRevWrapper] didFail \(error.localizedDescription)")
        spinner.stopAnimating()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        logger.error("WKWebView did fail provisional navigation: \(error.localizedDescription, privacy: .public)")
        print("[EduRevWrapper] didFailProvisionalNavigation \(error.localizedDescription)")
        spinner.stopAnimating()
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        if let scheme = url.scheme, ["mailto", "tel"].contains(scheme) {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }

        if let host = url.host, host == allowedHost || host.hasSuffix(".googleapis.com") || host.hasSuffix(".firebaseapp.com") || host == "login.microsoftonline.com" || host.hasSuffix(".microsoftonline.com") {
            decisionHandler(.allow)
            return
        }

        UIApplication.shared.open(url)
        decisionHandler(.cancel)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nativeAuth" else {
            return
        }

        let provider = (message.body as? [String: Any])?["provider"] as? String
        logger.log("Received nativeAuth message for provider \(provider ?? "nil", privacy: .public)")
        print("[EduRevWrapper] nativeAuth provider=\(provider ?? "nil")")
        if provider == "bridgeReady" {
            return
        }
        if provider == "google" {
            startNativeGoogleSignIn()
        }
    }

    private func startNativeGoogleSignIn() {
        guard let googleClientID else {
            logger.error("Missing Google iOS client configuration")
            print("[EduRevWrapper] Missing Google iOS client configuration")
            dispatchGoogleError("Missing Google iOS client configuration.")
            return
        }

        logger.log("Starting native Google sign in with client ID \(googleClientID, privacy: .public)")
        print("[EduRevWrapper] Starting native Google sign in")
        let configuration = GIDConfiguration(clientID: googleClientID)
        GIDSignIn.sharedInstance.configuration = configuration
        spinner.startAnimating()

        GIDSignIn.sharedInstance.signIn(withPresenting: self) { [weak self] result, error in
            guard let self else { return }
            DispatchQueue.main.async {
                self.spinner.stopAnimating()
            }

            if let error {
                self.logger.error("Google sign in returned error: \(error.localizedDescription, privacy: .public)")
                print("[EduRevWrapper] Google sign in returned error: \(error.localizedDescription)")
                self.dispatchGoogleError(error.localizedDescription)
                return
            }

            guard
                let user = result?.user,
                let idToken = user.idToken?.tokenString
            else {
                self.logger.error("Google sign in returned no ID token")
                print("[EduRevWrapper] Google sign in returned no ID token")
                self.dispatchGoogleError("Google sign-in returned no ID token.")
                return
            }

            let accessToken = user.accessToken.tokenString
            self.logger.log("Google sign in succeeded")
            print("[EduRevWrapper] Google sign in succeeded")
            self.dispatchGoogleSuccess(idToken: idToken, accessToken: accessToken)
        }
    }

    private func dispatchGoogleSuccess(idToken: String, accessToken: String) {
        logger.log("Dispatching native Google success back to web view")
        print("[EduRevWrapper] Dispatching native Google success back to web view")
        do {
            let data = try JSONSerialization.data(withJSONObject: [
                "idToken": idToken,
                "accessToken": accessToken,
            ])
            guard let json = String(data: data, encoding: .utf8) else {
                dispatchGoogleError("Unable to encode Google auth result.")
                return
            }

            let script = "window.__completeNativeGoogleSignIn && window.__completeNativeGoogleSignIn(\(json));"
            DispatchQueue.main.async {
                self.webView.evaluateJavaScript(script, completionHandler: nil)
            }
        } catch {
            dispatchGoogleError("Unable to encode Google auth result.")
        }
    }

    private func dispatchGoogleError(_ message: String) {
        logger.error("Dispatching native Google error back to web view: \(message, privacy: .public)")
        print("[EduRevWrapper] Dispatching native Google error: \(message)")
        let literal = jsStringLiteral(message)
        let script = "window.__nativeGoogleAuthError && window.__nativeGoogleAuthError(\(literal));"
        DispatchQueue.main.async {
            self.webView.evaluateJavaScript(script, completionHandler: nil)
            let alert = UIAlertController(title: "Google Sign-In Failed", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            if self.presentedViewController == nil {
                self.present(alert, animated: true)
            }
        }
    }

    private func jsStringLiteral(_ value: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: [value], options: [])
        let json = String(data: data ?? Data("[]".utf8), encoding: .utf8) ?? "[\"\"]"
        return String(json.dropFirst().dropLast())
    }
}
