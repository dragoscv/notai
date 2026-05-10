//
//  ActionViewController.swift
//  Notai Share Extension
//
//  Receives the system Share Sheet payload (URL, plaintext, or web
//  page selection) and forwards it to the host Notai app via the
//  custom URL scheme `notai://quick-capture?shared=<url-encoded>`.
//
//  This file is the canonical version. When you bootstrap the iOS
//  project, copy it into the Action Extension target you create in
//  Xcode (the file produced by Xcode's "New Target → Share Extension"
//  template should be replaced with this one).
//

import UIKit
import MobileCoreServices
import UniformTypeIdentifiers

class ActionViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let providers = item.attachments else {
            self.complete(nil)
            return
        }

        // Try, in order: URL → plain text → property list (web page selection).
        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { (data, _) in
                    if let url = data as? URL {
                        self.openHost(with: url.absoluteString)
                    } else {
                        self.complete(nil)
                    }
                }
                return
            }

            if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { (data, _) in
                    if let s = data as? String {
                        self.openHost(with: s)
                    } else {
                        self.complete(nil)
                    }
                }
                return
            }
        }

        self.complete(nil)
    }

    private func openHost(with text: String) {
        let encoded = text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        guard let url = URL(string: "notai://quick-capture?shared=\(encoded)") else {
            self.complete(nil)
            return
        }
        DispatchQueue.main.async {
            // openURL(_:) is unavailable in extensions; walk the
            // responder chain to find a UIApplication that can open it.
            var responder: UIResponder? = self
            while let r = responder {
                if let application = r as? UIApplication {
                    application.open(url, options: [:], completionHandler: nil)
                    break
                }
                responder = r.next
            }
            self.complete(nil)
        }
    }

    private func complete(_ items: [Any]?) {
        self.extensionContext?.completeRequest(returningItems: items, completionHandler: nil)
    }
}
