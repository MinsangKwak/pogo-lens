#import "PogoLensCapture.h"
#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import "PogoLens-Swift.h"

@implementation PogoLensCapture

RCT_EXPORT_MODULE(PogoLensCapture)

+ (BOOL)requiresMainQueueSetup { return YES; }

- (void)getState:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    resolve([[PogoLensCaptureCoordinator shared] stateJSON]);
  });
}

- (void)requestOverlayPermission:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  reject(@"E_UNSUPPORTED", @"iOS에서는 다른 앱 위에 임의의 오버레이를 표시하지 않아요.", nil);
}

- (void)startCapture:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [[PogoLensCaptureCoordinator shared] startCapture:^(NSError *error) {
      if (error) reject(@"E_CAPTURE_START", error.localizedDescription, error);
      else resolve(nil);
    }];
  });
}

- (void)stopCapture:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [[PogoLensCaptureCoordinator shared] stopCapture:^(NSError *error) {
      if (error) reject(@"E_CAPTURE_STOP", error.localizedDescription, error);
      else resolve(nil);
    }];
  });
}

- (void)getPendingScans:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    resolve([[PogoLensCaptureCoordinator shared] pendingScansJSON]);
  });
}

- (void)clearPendingScans:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [[PogoLensCaptureCoordinator shared] clearPendingScans:^(NSError *error) {
      if (error) reject(@"E_CAPTURE_CLEAR", error.localizedDescription, error);
      else resolve(nil);
    }];
  });
}

- (void)copyName:(NSString *)name resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [[PogoLensCaptureCoordinator shared] copyName:name completion:^(NSError *error) {
      if (error) reject(@"E_INVALID_NAME", error.localizedDescription, error);
      else resolve(nil);
    }];
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativePogoLensCaptureSpecJSI>(params);
}

@end
