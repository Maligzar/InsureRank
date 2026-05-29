import Foundation
import Capacitor
import TwilioVoice
import CallKit

// MARK: - TwilioVoicePlugin
//
// Bridges Twilio Programmable Voice + CallKit to the web layer.
// Add Twilio Voice SDK via Swift Package Manager:
//   https://github.com/twilio/twilio-voice-ios  (requires SPM support, or use CocoaPods)
//
// Capacitor registers this plugin automatically via autoRegisterPlugins() in AppDelegate.swift.

@objc(TwilioVoicePlugin)
public class TwilioVoicePlugin: CAPPlugin, CAPBridgedPlugin, CXProviderDelegate {

    public let identifier = "TwilioVoicePlugin"
    public let jsName = "TwilioVoice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "makeCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hangUp", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "mute", returnType: CAPPluginReturnPromise),
    ]

    private var callProvider: CXProvider?
    private var callController = CXCallController()
    private var activeCall: Call?
    private var activeCUUID = UUID()

    override public func load() {
        let config = CXProviderConfiguration()
        config.supportsVideo = false
        config.maximumCallsPerCallGroup = 1
        config.supportedHandleTypes = [.phoneNumber, .generic]
        callProvider = CXProvider(configuration: config)
        callProvider?.setDelegate(self, queue: nil)
        TwilioVoiceSDK.logLevel = .error
    }

    // MARK: - makeCall

    @objc func makeCall(_ call: CAPPluginCall) {
        guard let to = call.getString("to"),
              let accessToken = call.getString("accessToken") else {
            call.reject("Missing 'to' or 'accessToken'")
            return
        }

        let params = ConnectOptions(accessToken: accessToken) { builder in
            builder.params = ["To": to]
        }

        let uuid = UUID()
        activeCUUID = uuid

        let handle = CXHandle(type: .phoneNumber, value: to)
        let startCallAction = CXStartCallAction(call: uuid, handle: handle)
        let transaction = CXTransaction(action: startCallAction)

        callController.request(transaction) { [weak self] error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            self?.activeCall = TwilioVoiceSDK.connect(options: params, delegate: self!)
            call.resolve()
        }
    }

    // MARK: - hangUp

    @objc func hangUp(_ call: CAPPluginCall) {
        activeCall?.disconnect()
        call.resolve()
    }

    // MARK: - mute

    @objc func mute(_ call: CAPPluginCall) {
        let muted = call.getBool("muted") ?? false
        activeCall?.isMuted = muted
        call.resolve()
    }

    // MARK: - CXProviderDelegate

    public func providerDidReset(_ provider: CXProvider) {}

    public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        activeCall?.disconnect()
        action.fulfill()
    }
}

// MARK: - CallDelegate

extension TwilioVoicePlugin: CallDelegate {
    public func callDidConnect(_ call: Call) {
        notifyListeners("callConnected", data: ["callSid": call.sid ?? ""])
        callProvider?.reportOutgoingCall(with: activeCUUID, connectedAt: Date())
    }

    public func callDidDisconnect(_ call: Call, error: Error?) {
        notifyListeners("callDisconnected", data: ["callSid": call.sid ?? ""])
        callProvider?.reportCall(with: activeCUUID, endedAt: Date(), reason: .remoteEnded)
        activeCall = nil
    }

    public func callDidFailToConnect(_ call: Call, error: Error) {
        notifyListeners("callFailed", data: ["error": error.localizedDescription])
        callProvider?.reportCall(with: activeCUUID, endedAt: Date(), reason: .failed)
        activeCall = nil
    }
}
